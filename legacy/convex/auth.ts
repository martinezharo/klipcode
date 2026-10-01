import GitHub from "@auth/core/providers/github";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { convexAuth } from "@convex-dev/auth/server";

// GitHub is the only provider, matching the single "Sign in with GitHub" button
// in the aside. Credentials come from the Convex deployment env
// (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET), never from the client bundle.
const legacy = convexAuth({
  providers: [GitHub],
});

export const { auth, signOut, store, isAuthenticated } = legacy;
// Stop stale tabs from refreshing legacy tokens after the final copy.
export const signIn = action({
  args: {
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (process.env.KLIPCODE_MIGRATED === "true")
      throw new Error(
        "KlipCode has moved. Reload and sign in at klipcode.com.",
      );
    const source = legacy.signIn as unknown as {
      _handler: (
        ctx: ActionCtx,
        args: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    return source._handler(ctx, args);
  },
});
