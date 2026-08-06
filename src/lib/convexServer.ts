import { ConvexHttpClient } from "convex/browser";

import { getConvexUrl, isConvexConfigured } from "@/lib/convexEnv";

/**
 * Convex access for the two route handlers that run on Cloudflare rather than
 * inside Convex (`/api/crypto/dek` and `/api/generate-title`).
 *
 * Both act purely on behalf of the caller, so they carry the caller's own token
 * and hold no admin key: the identity checks inside the Convex functions apply
 * to them exactly as they would to the browser, and neither can reach anything
 * the caller could not reach themselves.
 */

/** The bearer token on the request, or `null` when absent or malformed. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token || null;
}

/**
 * A client authenticated as the caller, or `null` when no deployment is
 * configured. These routes degrade gracefully so the guest workspace remains
 * usable in development without a backend.
 */
export function getConvexClientForToken(token: string): ConvexHttpClient | null {
  if (!isConvexConfigured()) {
    return null;
  }

  const client = new ConvexHttpClient(getConvexUrl()!);
  client.setAuth(token);
  return client;
}
