import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internalQuery } from "./_generated/server";
import { readFrom } from "./lib/syncCursor";

// ── Owner analytics ─────────────────────────────────────────────────────────
//
// Read by the private klipcode-analytics console through
// `npx convex run --prod analytics:<name> '<json>'`, which authenticates with
// the CLI's deploy credentials. Internal only: no client can reach these.
//
// They exist so the console never has to `convex export` the deployment. An
// export reads every document in full on each sync, and Database I/O is what
// the plan meters. Here each sync reads only what was written since the
// previous one (the same server-clock cursor the app's own sync uses), and
// returns only the fields the console keeps: no titles, code, folder names,
// emails or avatars ever leave the deployment.

const table = v.union(
  v.literal("users"),
  v.literal("authSessions"),
  v.literal("snippets"),
  v.literal("folders"),
  v.literal("deletions"),
);

/**
 * One page of one table: every row when `since` is null, otherwise only rows
 * created (users, sign-ins), written (snippets, folders) or deleted since that
 * cursor. `now` is the cursor to pass next time; take it from the first page
 * of a sync so rows written while paging are read again, not skipped.
 */
export const page = internalQuery({
  args: {
    table,
    since: v.union(v.number(), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { table, since, paginationOpts }) => {
    const now = Date.now();
    const from = since === null ? null : readFrom(since);

    switch (table) {
      case "users": {
        const result = await ctx.db
          .query("users")
          .withIndex("by_creation_time", (q) => (from === null ? q : q.gte("_creationTime", from)))
          .paginate(paginationOpts);
        const rows = await Promise.all(
          result.page.map(async (user) => {
            const account = await ctx.db
              .query("authAccounts")
              .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
              .first();
            return { id: user._id, createdAt: user._creationTime, provider: account?.provider ?? null };
          }),
        );
        return { rows, isDone: result.isDone, continueCursor: result.continueCursor, now };
      }

      case "authSessions": {
        const result = await ctx.db
          .query("authSessions")
          .withIndex("by_creation_time", (q) => (from === null ? q : q.gte("_creationTime", from)))
          .paginate(paginationOpts);
        const rows = result.page.map((session) => ({ id: session._id, userId: session.userId, createdAt: session._creationTime }));
        return { rows, isDone: result.isDone, continueCursor: result.continueCursor, now };
      }

      case "snippets": {
        const result = await (from === null
          ? ctx.db.query("snippets")
          : ctx.db.query("snippets").withIndex("by_server_updated", (q) => q.gte("serverUpdatedAt", from))
        ).paginate(paginationOpts);
        const rows = result.page.map((snippet) => ({
          id: snippet._id,
          ownerId: snippet.ownerId,
          language: snippet.language,
          createdAt: snippet.createdAt,
          updatedAt: snippet.updatedAt,
          deletedAt: snippet.deletedAt,
          pinned: snippet.isPinnedAside || snippet.isPinnedHome,
          inFolder: snippet.folderId !== null,
        }));
        return { rows, isDone: result.isDone, continueCursor: result.continueCursor, now };
      }

      case "folders": {
        const result = await (from === null
          ? ctx.db.query("folders")
          : ctx.db.query("folders").withIndex("by_server_updated", (q) => q.gte("serverUpdatedAt", from))
        ).paginate(paginationOpts);
        const rows = result.page.map((folder) => ({ id: folder._id, ownerId: folder.ownerId, createdAt: folder.createdAt }));
        return { rows, isDone: result.isDone, continueCursor: result.continueCursor, now };
      }

      case "deletions": {
        // A full read rebuilds from the live tables, so it needs no log.
        if (from === null) return { rows: [], isDone: true, continueCursor: "", now };
        const result = await ctx.db
          .query("deletions")
          .withIndex("by_deleted", (q) => q.gte("deletedAt", from))
          .paginate(paginationOpts);
        const rows = result.page.map((entry) => ({ kind: entry.kind, docId: entry.docId }));
        return { rows, isDone: result.isDone, continueCursor: result.continueCursor, now };
      }
    }
  },
});

/**
 * Ids of the accounts behind these emails (the owner's own), so the console
 * can leave them out without ever receiving anyone's email address.
 */
export const accountsByEmail = internalQuery({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const wanted = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
    if (wanted.size === 0) return [];

    // Stored emails keep the provider's casing, which an index lookup cannot
    // match case-insensitively. `users` rows are a few hundred bytes (no
    // workspace content), so comparing them all stays cheap.
    const users = await ctx.db.query("users").collect();
    return users.filter((user) => user.email && wanted.has(user.email.trim().toLowerCase())).map((user) => user._id);
  },
});
