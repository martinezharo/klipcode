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

/** Local-only fallback for components rendered without the session provider. */
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
