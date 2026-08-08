import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { assertNoFolderCycles, type ParentLink } from "./lib/hierarchy";
import { assertUniqueClientIds } from "./lib/sync";

// ── One-off import from the Supabase backend ────────────────────────────────
//
// Internal only: it writes on behalf of accounts that have never signed in, so
// it must never be reachable from a client. Run it with
// `npx convex run --prod migrations:importAccount '<json>'`, which authenticates
// with a deploy key. `scripts/migrate-supabase-to-convex.mjs` drives it.
//
// Two things make this a copy rather than a re-encryption:
//
//   1. The master key that wraps every per-user DEK never moved — it is still
//      the same Cloudflare Worker secret. So a user's `wrapped_dek` from
//      Supabase is still openable by `/api/crypto/dek` here, and the record
//      ciphertext transfers byte for byte. Nothing is ever decrypted during the
//      migration, which is also why it cannot corrupt anything.
//   2. Supabase stores the GitHub numeric id in `auth.identities.provider_id`,
//      and Convex Auth keys `authAccounts` on that same value. Pre-creating the
//      account means the user's first GitHub sign-in here lands on the user
//      that already owns their imported records, with no linking step.
//
// Idempotent: re-running upserts by `(ownerId, clientId)` with last-write-wins,
// so an interrupted run is simply resumed.

const importedFolder = v.object({
  clientId: v.string(),
  name: v.string(),
  parentId: v.union(v.string(), v.null()),
  isPinnedAside: v.boolean(),
  isPinnedHome: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.union(v.string(), v.null()),
  cryptoVersion: v.number(),
});

const importedSnippet = v.object({
  clientId: v.string(),
  folderId: v.union(v.string(), v.null()),
  title: v.string(),
  code: v.string(),
  language: v.string(),
  isPinnedAside: v.boolean(),
  isPinnedHome: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.union(v.string(), v.null()),
  cryptoVersion: v.number(),
});

async function resolveUserId(
  ctx: MutationCtx,
  args: {
    githubId: string;
    email: string | null;
    name: string | null;
    image: string | null;
  }
): Promise<{ userId: Id<"users">; created: boolean }> {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "github").eq("providerAccountId", args.githubId)
    )
    .unique();

  if (account) {
    return { userId: account.userId, created: false };
  }

  const userId = await ctx.db.insert("users", {
    ...(args.email !== null ? { email: args.email } : {}),
    ...(args.name !== null ? { name: args.name } : {}),
    ...(args.image !== null ? { image: args.image } : {}),
  });

  await ctx.db.insert("authAccounts", {
    userId,
    provider: "github",
    providerAccountId: args.githubId,
  });

  return { userId, created: true };
}

export const importAccount = internalMutation({
  args: {
    githubId: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    image: v.union(v.string(), v.null()),
    /** The account's `wrapped_dek` row from Supabase, or null if it had none. */
    wrappedDek: v.union(v.string(), v.null()),
    folders: v.array(importedFolder),
    snippets: v.array(importedSnippet),
  },
  handler: async (ctx, args) => {
    assertUniqueClientIds(args.folders, "folder");
    assertUniqueClientIds(args.snippets, "snippet");

    const { userId, created } = await resolveUserId(ctx, args);

    const existingKey = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // The one case that must NOT be imported. A user who already signed in here
    // was given a fresh DEK, and the incoming records are ciphertext under their
    // OLD one — importing them would add records nobody can ever decrypt. Their
    // data comes back the other way instead: their device still holds it in
    // plaintext and re-uploads it (see `adoptLegacyRecords` in src/lib/sync.ts).
    if (existingKey && args.wrappedDek !== null) {
      return {
        userId,
        created,
        importedFolders: 0,
        importedSnippets: 0,
        skipped: "account already has its own encryption key",
      };
    }

    if (!existingKey && args.wrappedDek !== null) {
      await ctx.db.insert("userKeys", { userId, wrappedDek: args.wrappedDek });
    }

    const storedFolders = await ctx.db
      .query("folders")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const folderByClientId = new Map(storedFolders.map((f) => [f.clientId, f]));

    const links = new Map<string, string | null>(
      storedFolders.map((folder) => [folder.clientId, folder.parentId])
    );
    for (const folder of args.folders) {
      const existing = folderByClientId.get(folder.clientId);
      if (!existing || existing.updatedAt <= folder.updatedAt) {
        links.set(folder.clientId, folder.parentId);
      }
    }

    const resolveParent = (parentId: string | null) =>
      parentId !== null && links.has(parentId) ? parentId : null;

    let importedFolders = 0;
    const touched: string[] = [];

    for (const incoming of args.folders) {
      const existing = folderByClientId.get(incoming.clientId);
      if (existing && existing.updatedAt > incoming.updatedAt) continue;

      const parentId = resolveParent(incoming.parentId);
      links.set(incoming.clientId, parentId);
      touched.push(incoming.clientId);
      importedFolders += 1;

      if (existing) {
        await ctx.db.patch(existing._id, { ...incoming, parentId });
      } else {
        await ctx.db.insert("folders", { ...incoming, parentId, ownerId: userId });
      }
    }

    const parentLinks: ParentLink[] = [...links].map(([clientId, parentId]) => ({
      clientId,
      parentId,
    }));
    assertNoFolderCycles(parentLinks, touched);

    const storedSnippets: Doc<"snippets">[] = await ctx.db
      .query("snippets")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const snippetByClientId = new Map(storedSnippets.map((s) => [s.clientId, s]));

    let importedSnippets = 0;

    for (const incoming of args.snippets) {
      const existing = snippetByClientId.get(incoming.clientId);
      if (existing && existing.updatedAt > incoming.updatedAt) continue;

      const folderId =
        incoming.folderId !== null && links.has(incoming.folderId) ? incoming.folderId : null;
      importedSnippets += 1;

      if (existing) {
        await ctx.db.patch(existing._id, { ...incoming, folderId });
      } else {
        await ctx.db.insert("snippets", { ...incoming, folderId, ownerId: userId });
      }
    }

    return { userId, created, importedFolders, importedSnippets, skipped: null };
  },
});
