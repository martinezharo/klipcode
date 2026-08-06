"use client";

import { api } from "@convex/_generated/api";
import { ConvexAuthProvider, useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";

import { CloudSessionContext, type CloudSession } from "@/hooks/useCloudSession";
import { setAuthToken } from "@/lib/authToken";
import { getConvexBrowserClient } from "@/lib/convex";

/**
 * Turns Convex's auth state into the app's `CloudSession` and publishes it.
 *
 * Also mirrors the session token into a module so `/api/crypto/dek` can be
 * called from the sync engine, which is plain async code and cannot use hooks —
 * see `src/lib/authToken.ts` for why that route is not a Convex function.
 */
function CloudSessionBridge({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const token = useAuthToken();

  // `"skip"` keeps the query from running (and from erroring) while signed out.
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  useEffect(() => {
    setAuthToken(token ?? null);
  }, [token]);

  const handleSignIn = useCallback(async () => {
    await signIn("github", { redirectTo: window.location.href });
  }, [signIn]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const session = useMemo<CloudSession>(
    () => ({
      user: viewer ?? null,
      // Signed out there is nothing left to wait for; signed in we also wait for
      // the viewer, so consumers never see "authenticated but no account yet".
      ready: !isLoading && (!isAuthenticated || viewer !== undefined),
      configured: true,
      signIn: handleSignIn,
      signOut: handleSignOut,
    }),
    [handleSignIn, handleSignOut, isAuthenticated, isLoading, viewer]
  );

  return <CloudSessionContext.Provider value={session}>{children}</CloudSessionContext.Provider>;
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const client = getConvexBrowserClient();

  // With no deployment configured the app renders the signed-out guest
  // workspace instead of failing to mount, and `useCloudSession` falls back to
  // its unauthenticated default.
  if (!client) {
    return children;
  }

  return (
    <ConvexAuthProvider client={client}>
      <CloudSessionBridge>{children}</CloudSessionBridge>
    </ConvexAuthProvider>
  );
}
