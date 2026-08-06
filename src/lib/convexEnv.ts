/**
 * Deployment configuration, deliberately free of any React or client import.
 *
 * The route handlers on Cloudflare need this check too, and pulling it out of
 * `src/lib/convex.ts` keeps `convex/react` (and React itself) out of the server
 * bundle — importing it there breaks the Workers build.
 */

export function getConvexUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_CONVEX_URL;
}

/**
 * Without a deployment URL, authentication and cloud storage are unavailable;
 * the guest workspace remains on the current device and cloud paths no-op.
 */
export function isConvexConfigured(): boolean {
  return Boolean(getConvexUrl());
}
