import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { isCursorExpired, readFrom } from "./lib/syncCursor";
import {
  applyWorkspaceBatch,
  folderInput,
  removeWorkspaceRecords,
  snippetInput,
} from "./lib/workspaceWrites";

// Database I/O is what the Convex plan meters, and every byte of a document
// counts when it is read, so nothing here reads the whole workspace except the
// explicit full pull (`list`, or `changes` without a usable cursor). Writes
// look records up by index; reads after the first are incremental.

/** Strips Convex bookkeeping so the client receives exactly the fields it stores. */
function toWireFolder(folder: Doc<"folders">) {
  const { _id, _creationTime, ownerId, serverUpdatedAt, ...rest } = folder;
  void _id;
  void _creationTime;
  void ownerId;
  void serverUpdatedAt;
  return rest;
}

function toWireSnippet(snippet: Doc<"snippets">) {
  const { _id, _creationTime, ownerId, serverUpdatedAt, ...rest } = snippet;
  void _id;
  void _creationTime;
  void ownerId;
  void serverUpdatedAt;
  return rest;
}

async function readWholeWorkspace(ctx: QueryCtx, ownerId: Id<"users">) {
  const [folders, snippets] = await Promise.all([
    ctx.db
      .query("folders")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    ctx.db
      .query("snippets")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
  ]);

  return { folders: folders.map(toWireFolder), snippets: snippets.map(toWireSnippet) };
}

/**
 * The whole account's workspace.
 *
 * Kept for clients that predate `changes` (a tab left open across a deploy),
 * and as the fallback the current client uses if `changes` is unavailable.
 * Remove once no client can still be calling it.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    return readWholeWorkspace(ctx, ownerId);
  },
});

/**
 * What changed in the account since `since`, a cursor this query handed out
 * earlier (`null` on a device that has none yet).
 *
 * - `full: true` — the whole workspace, sent when there is no cursor or it is
 *   older than the deletion log. The client then reconciles deletions by
 *   absence, exactly as with `list`.
 * - `full: false` — only rows written at or after the cursor (minus a small
 *   overlap, see `SYNC_OVERLAP_MS`), plus the client ids permanently deleted
 *   in that window.
 *
 * Either way the client stores the returned `cursor` once it has applied the
 * result, and passes it back next time.
 */
export const changes = query({
  args: { since: v.union(v.number(), v.null()) },
  handler: async (ctx, { since }) => {
    const ownerId = await requireUserId(ctx);
    const cursor = Date.now();

    if (since === null || isCursorExpired(since, cursor)) {
      return {
        full: true as const,
        ...(await readWholeWorkspace(ctx, ownerId)),
        deletedFolderIds: [] as string[],
        deletedSnippetIds: [] as string[],
        cursor,
      };
    }

    const from = readFrom(since);
    const [folders, snippets, deletions] = await Promise.all([
      ctx.db
        .query("folders")
        .withIndex("by_owner_server_updated", (q) => q.eq("ownerId", ownerId).gte("serverUpdatedAt", from))
        .collect(),
      ctx.db
        .query("snippets")
        .withIndex("by_owner_server_updated", (q) => q.eq("ownerId", ownerId).gte("serverUpdatedAt", from))
        .collect(),
      ctx.db
        .query("deletions")
        .withIndex("by_owner_deleted", (q) => q.eq("ownerId", ownerId).gte("deletedAt", from))
        .collect(),
    ]);

    return {
      full: false as const,
      folders: folders.map(toWireFolder),
      snippets: snippets.map(toWireSnippet),
      deletedFolderIds: deletions.filter((entry) => entry.kind === "folder").map((entry) => entry.clientId),
      deletedSnippetIds: deletions.filter((entry) => entry.kind === "snippet").map((entry) => entry.clientId),
      cursor,
    };
  },
});

/**
 * Whether the account already holds any cloud record. Distinguishes a brand-new
 * account (the seeded welcome content should be claimed and uploaded) from a
 * returning one (an untouched seed must be discarded, not re-uploaded).
 */
export const hasContent = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);

    const [folder, snippet] = await Promise.all([
      ctx.db
        .query("folders")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .first(),
      ctx.db
        .query("snippets")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .first(),
    ]);

    return folder !== null || snippet !== null;
  },
});

/**
 * Upload a batch of created/edited records, last-write-wins on the
 * client-authored `updatedAt`. See `applyWorkspaceBatch`.
 */
export const push = mutation({
  args: {
    folders: v.array(folderInput),
    snippets: v.array(snippetInput),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    await applyWorkspaceBatch(ctx, ownerId, args);
  },
});

/**
 * Permanently remove records, cascading folder deletes. See
 * `removeWorkspaceRecords`.
 */
export const remove = mutation({
  args: {
    folderIds: v.array(v.string()),
    snippetIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    await removeWorkspaceRecords(ctx, ownerId, args);
  },
});
