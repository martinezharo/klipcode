import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { assertNoFolderCycles, collectDescendantFolderIds, type ParentLink } from "./lib/hierarchy";

// ── Wire shape ──────────────────────────────────────────────────────────────
// What crosses the wire is the record minus its ownership and Convex bookkeeping:
// `ownerId` is taken from the authenticated identity, never from the payload, so
// a client cannot write into another account no matter what it sends.

const syncedInput = {
  clientId: v.string(),
  isPinnedAside: v.boolean(),
  isPinnedHome: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.union(v.string(), v.null()),
  cryptoVersion: v.number(),
};

const folderInput = v.object({
  ...syncedInput,
  name: v.string(),
  parentId: v.union(v.string(), v.null()),
});

const snippetInput = v.object({
  ...syncedInput,
  title: v.string(),
  code: v.string(),
  language: v.string(),
  folderId: v.union(v.string(), v.null()),
});

/** Strips Convex bookkeeping so the client receives exactly the fields it stores. */
function toWireFolder(folder: Doc<"folders">) {
  const { _id, _creationTime, ownerId, ...rest } = folder;
  void _id;
  void _creationTime;
  void ownerId;
  return rest;
}

function toWireSnippet(snippet: Doc<"snippets">) {
  const { _id, _creationTime, ownerId, ...rest } = snippet;
  void _id;
  void _creationTime;
  void ownerId;
  return rest;
}

async function ownedFolders(ctx: MutationCtx, ownerId: Id<"users">) {
  return ctx.db
    .query("folders")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
}

async function ownedSnippets(ctx: MutationCtx, ownerId: Id<"users">) {
  return ctx.db
    .query("snippets")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
}

/**
 * The whole account's workspace. The client diffs this against IndexedDB, so it
 * always wants everything — there is no pagination to add here until a workspace
 * outgrows a single response.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);

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
 * Upload a batch of created/edited records.
 *
 * Folders and snippets go up together in one transaction, which is the main
 * structural win over the Postgres version: there, the `(owner_id, parent_id)`
 * foreign key meant a child folder could not land before its parent, so the
 * client had to upload one depth level per round trip. Here the whole batch is
 * validated after it is applied, so depth costs nothing and a push is a single
 * round trip.
 *
 * Writes are last-write-wins on the client-authored `updatedAt`: an incoming
 * record older than the stored one is ignored, so a slow retry can never
 * clobber a newer edit that already landed from another device.
 */
export const push = mutation({
  args: {
    folders: v.array(folderInput),
    snippets: v.array(snippetInput),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);

    if (args.folders.length === 0 && args.snippets.length === 0) {
      return;
    }

    const existingFolders = await ownedFolders(ctx, ownerId);
    const folderByClientId = new Map(existingFolders.map((folder) => [folder.clientId, folder]));

    // Applied before the parent references are resolved, so a batch that creates
    // a parent and its child together sees both.
    const links = new Map<string, string | null>(
      existingFolders.map((folder) => [folder.clientId, folder.parentId])
    );
    for (const folder of args.folders) {
      links.set(folder.clientId, folder.parentId);
    }

    // A parent that is absent even after applying the batch was deleted on
    // another device. Reparenting to the root keeps the folder and its contents
    // reachable; deleting it here would destroy data the user never removed.
    const resolveParent = (parentId: string | null) =>
      parentId !== null && links.has(parentId) ? parentId : null;

    const touchedFolderIds: string[] = [];

    for (const incoming of args.folders) {
      const existing = folderByClientId.get(incoming.clientId);

      if (existing && existing.updatedAt > incoming.updatedAt) {
        continue;
      }

      const parentId = resolveParent(incoming.parentId);
      links.set(incoming.clientId, parentId);
      touchedFolderIds.push(incoming.clientId);

      if (existing) {
        await ctx.db.patch(existing._id, { ...incoming, parentId });
      } else {
        await ctx.db.insert("folders", { ...incoming, parentId, ownerId });
      }
    }

    const parentLinks: ParentLink[] = [...links].map(([clientId, parentId]) => ({
      clientId,
      parentId,
    }));
    assertNoFolderCycles(parentLinks, touchedFolderIds);

    if (args.snippets.length === 0) {
      return;
    }

    const existingSnippets = await ownedSnippets(ctx, ownerId);
    const snippetByClientId = new Map(
      existingSnippets.map((snippet) => [snippet.clientId, snippet])
    );

    for (const incoming of args.snippets) {
      const existing = snippetByClientId.get(incoming.clientId);

      if (existing && existing.updatedAt > incoming.updatedAt) {
        continue;
      }

      // Mirrors the old `on delete set null`: a snippet whose folder is gone
      // falls back to the root instead of failing the whole push.
      const folderId =
        incoming.folderId !== null && links.has(incoming.folderId) ? incoming.folderId : null;

      if (existing) {
        await ctx.db.patch(existing._id, { ...incoming, folderId });
      } else {
        await ctx.db.insert("snippets", { ...incoming, folderId, ownerId });
      }
    }
  },
});

/**
 * Permanently remove records. Deleting a folder cascades to its descendant
 * folders and detaches the snippets inside them, reproducing the
 * `on delete cascade` / `on delete set null` pair from the old foreign keys —
 * so a stale client can never strand rows that nothing links to.
 *
 * Ids that no longer exist are ignored: the client retries tombstones until they
 * succeed, and a delete that already landed must not fail the retry.
 */
export const remove = mutation({
  args: {
    folderIds: v.array(v.string()),
    snippetIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);

    if (args.folderIds.length === 0 && args.snippetIds.length === 0) {
      return;
    }

    const [folders, snippets] = await Promise.all([
      ownedFolders(ctx, ownerId),
      ownedSnippets(ctx, ownerId),
    ]);

    const doomedFolderIds = collectDescendantFolderIds(folders, args.folderIds);
    const doomedSnippetIds = new Set(args.snippetIds);

    for (const snippet of snippets) {
      if (doomedSnippetIds.has(snippet.clientId)) {
        await ctx.db.delete(snippet._id);
        continue;
      }

      if (snippet.folderId !== null && doomedFolderIds.has(snippet.folderId)) {
        await ctx.db.patch(snippet._id, { folderId: null });
      }
    }

    for (const folder of folders) {
      if (doomedFolderIds.has(folder.clientId)) {
        await ctx.db.delete(folder._id);
      }
    }
  },
});
