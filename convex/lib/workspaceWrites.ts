import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertNoFolderCycles, collectDescendantFolderIds, type ParentLink } from "./hierarchy";
import { DELETION_RETENTION_MS } from "./syncCursor";
import { assertUniqueClientIds } from "./sync";

// ── Wire shape ──────────────────────────────────────────────────────────────
// What crosses the wire is the record minus its ownership and Convex bookkeeping:
// `ownerId` is taken from the authenticated identity (or, for the internal
// import, from the resolved account), never from the payload, so a client
// cannot write into another account no matter what it sends.

const syncedInput = {
  clientId: v.string(),
  isPinnedAside: v.boolean(),
  isPinnedHome: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.union(v.string(), v.null()),
  cryptoVersion: v.number(),
};

export const folderInput = v.object({
  ...syncedInput,
  name: v.string(),
  parentId: v.union(v.string(), v.null()),
});

export const snippetInput = v.object({
  ...syncedInput,
  title: v.string(),
  code: v.string(),
  language: v.string(),
  folderId: v.union(v.string(), v.null()),
});

type FolderInput = Infer<typeof folderInput>;
type SnippetInput = Infer<typeof snippetInput>;

/**
 * A snippet row by its client id. Indexes are not unique constraints, so a
 * legacy duplicate can exist; `first()` tolerates it the way the old
 * whole-table map did (one row wins) instead of failing the write.
 */
function findSnippet(ctx: MutationCtx, ownerId: Id<"users">, clientId: string) {
  return ctx.db
    .query("snippets")
    .withIndex("by_owner_client", (q) => q.eq("ownerId", ownerId).eq("clientId", clientId))
    .first();
}

function ownedFolders(ctx: MutationCtx, ownerId: Id<"users">) {
  return ctx.db
    .query("folders")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
}

/**
 * Whether a folder exists (by client id) once the batch has been applied. A
 * batch with folders loads the owner's whole folder graph anyway (the cycle
 * check needs it); a snippet-only batch — the usual edit — looks up just the
 * folders its snippets point at, so it never reads the rest of the workspace.
 */
async function folderGraph(ctx: MutationCtx, ownerId: Id<"users">, folders: FolderInput[]) {
  if (folders.length === 0) {
    const known = new Map<string, boolean>();
    return {
      stored: new Map<string, Doc<"folders">>(),
      links: null,
      async has(clientId: string) {
        if (!known.has(clientId)) {
          const folder = await ctx.db
            .query("folders")
            .withIndex("by_owner_client", (q) => q.eq("ownerId", ownerId).eq("clientId", clientId))
            .first();
          known.set(clientId, folder !== null);
        }
        return known.get(clientId)!;
      },
    };
  }

  const stored = await ownedFolders(ctx, ownerId);
  const links = new Map<string, string | null>(stored.map((folder) => [folder.clientId, folder.parentId]));
  return {
    stored: new Map(stored.map((folder) => [folder.clientId, folder])),
    links,
    async has(clientId: string) {
      return links.has(clientId);
    },
  };
}

/**
 * Upsert a batch of folders and snippets for one account, last-write-wins on
 * the client-authored `updatedAt`: an incoming record older than the stored one
 * is ignored, so a slow retry can never clobber a newer edit that already
 * landed from another device. Every row written is stamped with the server
 * clock (`serverUpdatedAt`) so incremental readers pick it up.
 *
 * Folders and snippets land in one transaction and are validated after they
 * are applied, so a child folder can arrive with its parent in the same batch.
 *
 * Returns how many records were actually written.
 */
export async function applyWorkspaceBatch(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  batch: { folders: FolderInput[]; snippets: SnippetInput[] },
): Promise<{ folders: number; snippets: number }> {
  // Convex indexes are not unique constraints. Reject malformed batches
  // before any insert can create two rows for the same logical record.
  assertUniqueClientIds(batch.folders, "folder");
  assertUniqueClientIds(batch.snippets, "snippet");

  const written = { folders: 0, snippets: 0 };
  if (batch.folders.length === 0 && batch.snippets.length === 0) {
    return written;
  }

  const serverUpdatedAt = Date.now();
  const graph = await folderGraph(ctx, ownerId, batch.folders);

  if (graph.links) {
    const links = graph.links;

    // Build the effective post-write graph before resolving parents, but do
    // not let a stale payload overwrite the stored relationship. Otherwise an
    // old move can make a valid sibling update look cyclic and reject the
    // entire transaction. Applied before the parent references are resolved,
    // so a batch that creates a parent and its child together sees both.
    for (const folder of batch.folders) {
      const existing = graph.stored.get(folder.clientId);
      if (!existing || existing.updatedAt <= folder.updatedAt) {
        links.set(folder.clientId, folder.parentId);
      }
    }

    // A parent that is absent even after applying the batch was deleted on
    // another device. Reparenting to the root keeps the folder and its contents
    // reachable; deleting it here would destroy data the user never removed.
    const resolveParent = (parentId: string | null) =>
      parentId !== null && links.has(parentId) ? parentId : null;

    const touchedFolderIds: string[] = [];

    for (const incoming of batch.folders) {
      const existing = graph.stored.get(incoming.clientId);
      if (existing && existing.updatedAt > incoming.updatedAt) {
        continue;
      }

      const parentId = resolveParent(incoming.parentId);
      links.set(incoming.clientId, parentId);
      touchedFolderIds.push(incoming.clientId);
      written.folders += 1;

      if (existing) {
        await ctx.db.patch(existing._id, { ...incoming, parentId, serverUpdatedAt });
      } else {
        await ctx.db.insert("folders", { ...incoming, parentId, ownerId, serverUpdatedAt });
      }
    }

    const parentLinks: ParentLink[] = [...links].map(([clientId, parentId]) => ({ clientId, parentId }));
    assertNoFolderCycles(parentLinks, touchedFolderIds);
  }

  for (const incoming of batch.snippets) {
    const existing = await findSnippet(ctx, ownerId, incoming.clientId);
    if (existing && existing.updatedAt > incoming.updatedAt) {
      continue;
    }

    // Mirrors the old `on delete set null`: a snippet whose folder is gone
    // falls back to the root instead of failing the whole push.
    const folderId = incoming.folderId !== null && (await graph.has(incoming.folderId)) ? incoming.folderId : null;
    written.snippets += 1;

    if (existing) {
      await ctx.db.patch(existing._id, { ...incoming, folderId, serverUpdatedAt });
    } else {
      await ctx.db.insert("snippets", { ...incoming, folderId, ownerId, serverUpdatedAt });
    }
  }

  return written;
}

/**
 * Permanently remove records for one account. Deleting a folder cascades to
 * its descendant folders and detaches the snippets inside them, reproducing the
 * `on delete cascade` / `on delete set null` pair from the old foreign keys —
 * so a stale client can never strand rows that nothing links to.
 *
 * Every removed row is logged in `deletions` so incremental readers learn about
 * it; entries past the retention window are pruned here as a side effect.
 * Ids that no longer exist are ignored: the client retries tombstones until
 * they succeed, and a delete that already landed must not fail the retry.
 */
export async function removeWorkspaceRecords(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  ids: { folderIds: string[]; snippetIds: string[] },
): Promise<void> {
  if (ids.folderIds.length === 0 && ids.snippetIds.length === 0) {
    return;
  }

  const now = Date.now();

  async function logDeletion(kind: "folder" | "snippet", row: Doc<"folders"> | Doc<"snippets">) {
    await ctx.db.delete(row._id);
    await ctx.db.insert("deletions", { ownerId, kind, clientId: row.clientId, docId: row._id, deletedAt: now });
  }

  for (const clientId of new Set(ids.snippetIds)) {
    const rows = await ctx.db
      .query("snippets")
      .withIndex("by_owner_client", (q) => q.eq("ownerId", ownerId).eq("clientId", clientId))
      .collect();
    for (const row of rows) await logDeletion("snippet", row);
  }

  if (ids.folderIds.length > 0) {
    const folders = await ownedFolders(ctx, ownerId);
    const doomed = collectDescendantFolderIds(folders, ids.folderIds);

    for (const folderId of doomed) {
      const inside = await ctx.db
        .query("snippets")
        .withIndex("by_owner_folder", (q) => q.eq("ownerId", ownerId).eq("folderId", folderId))
        .collect();
      for (const snippet of inside) {
        await ctx.db.patch(snippet._id, { folderId: null, serverUpdatedAt: now });
      }
    }

    for (const folder of folders) {
      if (doomed.has(folder.clientId)) await logDeletion("folder", folder);
    }
  }

  const expired = await ctx.db
    .query("deletions")
    .withIndex("by_owner_deleted", (q) => q.eq("ownerId", ownerId).lt("deletedAt", now - DELETION_RETENTION_MS))
    .take(100);
  for (const entry of expired) await ctx.db.delete(entry._id);
}
