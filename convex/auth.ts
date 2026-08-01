import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

// GitHub is the only provider, matching the single "Sign in with GitHub" button
// in the aside. Credentials come from the Convex deployment env
// (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET), never from the client bundle.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub],
});
