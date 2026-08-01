import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

// ── Where the encryption boundary sits ──────────────────────────────────────
// These two functions only ever see the WRAPPED key. The master key that wraps
// it (`ENCRYPTION_MASTER_KEY`) is a Cloudflare Worker secret and is deliberately
// not a Convex environment variable, so the data and the key that opens it never
// live with the same provider: an export of this deployment yields ciphertext
// and a wrapped DEK that cannot be unwrapped from anything stored here.
// `/api/crypto/dek` on Cloudflare is the only place the two meet, and it calls
// these functions with the caller's own Convex token — so the identity check
// below applies to it exactly as it would to the browser.

/** The caller's wrapped DEK, or `null` if they have never had one minted. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const record = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return { userId: userId as string, wrappedDek: record?.wrappedDek ?? null };
  },
});

/**
 * Store a freshly minted wrapped DEK, once. If a key already exists it is
 * returned untouched and the candidate is discarded — a user's DEK is immutable,
 * because replacing it would orphan every record already encrypted with it. That
 * also makes the endpoint safe under the race where two tabs mint a key at the
 * same time: both end up on whichever key landed first.
 */
export const create = mutation({
  args: { wrappedDek: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("userKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return { wrappedDek: existing.wrappedDek };
    }

    await ctx.db.insert("userKeys", { userId, wrappedDek: args.wrappedDek });

    return { wrappedDek: args.wrappedDek };
  },
});
