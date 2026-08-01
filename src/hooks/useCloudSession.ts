"use client";

import { createContext, useContext } from "react";

import type { AccountUser } from "@/lib/types";

export interface CloudSession {
  /** The signed-in account, or `null` in local/anonymous mode. */
  user: AccountUser | null;
  /** False until the initial session check resolves. */
  ready: boolean;
  /** Whether a cloud deployment is configured at all. */
  configured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * The default is the fully-local workspace: no deployment configured, so there
 * is no session to wait for and the auth actions are inert.
 *
 * This is why the session is a context rather than a hook that calls Convex
 * directly. `ConvexAuthProvider` can only mount when a deployment URL exists, so
 * a hook reading Convex state would have to be called conditionally — instead
 * the bridge inside the provider publishes the session when it is there, and
 * everything downstream reads one unconditional context either way.
 */
const LOCAL_ONLY_SESSION: CloudSession = {
  user: null,
  ready: true,
  configured: false,
  signIn: async () => {},
  signOut: async () => {},
};

export const CloudSessionContext = createContext<CloudSession>(LOCAL_ONLY_SESSION);

export function useCloudSession(): CloudSession {
  return useContext(CloudSessionContext);
}
