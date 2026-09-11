import { ConvexHttpClient } from "convex/browser";

import { api } from "@convex/_generated/api";
import { getConvexUrl, isConvexConfigured } from "@/lib/convexEnv";

/**
 * Convex access for the route handlers that run on Cloudflare rather than
 * inside Convex (`/api/crypto/dek`, `/api/generate-title` and `/api/images`).
 *
 * They all act purely on behalf of the caller, so they carry the caller's own
 * token and hold no admin key: the identity checks inside the Convex functions
 * apply to them exactly as they would to the browser, and none can reach
 * anything the caller could not reach themselves.
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

/**
 * The id of the signed-in caller, or `null` for anyone this deployment cannot
 * vouch for — no token, a rejected one, or no Convex deployment at all.
 *
 * `users.viewer` resolves to `null` for an anonymous caller rather than
 * throwing, so "guest" and "bad token" collapse into the same answer: not
 * authorised. Routes that only need a yes/no can compare against `null`; the
 * image upload also uses the id to scope the object key it writes.
 */
export async function readViewerId(request: Request): Promise<string | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const convex = getConvexClientForToken(token);
  if (!convex) return null;

  try {
    return (await convex.query(api.users.viewer, {}))?.id ?? null;
  } catch {
    return null;
  }
}
