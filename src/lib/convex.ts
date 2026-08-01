import { ConvexReactClient } from "convex/react";

import { getConvexUrl, isConvexConfigured } from "@/lib/convexEnv";

let browserClient: ConvexReactClient | null | undefined;

/**
 * The one client for the tab. `ConvexAuthProvider` attaches the session to this
 * same instance, so the imperative callers in `src/lib/sync.ts` are authenticated
 * without having to thread a token through the sync engine.
 *
 * Returns `null` when no deployment is configured — see `convexEnv.ts`.
 */
export function getConvexBrowserClient() {
  if (!isConvexConfigured()) {
    return null;
  }

  if (browserClient === undefined) {
    browserClient = new ConvexReactClient(getConvexUrl()!);
  }

  return browserClient;
}
