import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { normalizeCountry } from "./lib/country";

/**
 * The signed-in account, or `null` when there is no session.
 *
 * Deliberately does not throw on an anonymous caller: the app supports a guest
 * workspace, so "no viewer" is a normal state the aside shows, not an error.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const userId = identity.subject.split("|")[0] as Id<"users">;
    const user = await ctx.db.get(userId);

    if (!user) {
      return null;
    }

    return {
      id: userId as string,
      name: user.name ?? null,
      email: user.email ?? null,
      imageUrl: user.image ?? null,
    };
  },
});

/**
 * Whether the caller's account already has a country on record, or `null` when
 * signed out. The client asks this before reporting one, so an account that is
 * already known costs no further requests.
 */
export const hasCountry = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db.get(identity.subject.split("|")[0] as Id<"users">);
    return user ? user.country !== undefined : null;
  },
});

/**
 * Records the country an account was first seen from. First write wins: a
 * country already on file is never replaced, so travelling or a VPN cannot
 * rewrite it, and an unusable value ("XX", "T1", garbage) stores nothing.
 */
export const recordCountry = mutation({
  args: { country: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const country = normalizeCountry(args.country);
    if (!country) return { stored: false };

    const user = await ctx.db.get(userId);
    if (!user || user.country !== undefined) return { stored: false };

    await ctx.db.patch(userId, { country });
    return { stored: true };
  },
});
