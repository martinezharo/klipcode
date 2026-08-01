import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

/**
 * The signed-in account, or `null` when there is no session.
 *
 * Deliberately does not throw on an anonymous caller: the app renders fine
 * signed out (fully local mode), so "no viewer" is a normal state the aside
 * shows, not an error.
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
