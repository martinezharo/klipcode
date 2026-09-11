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
 * Authentication result for a protected Cloudflare route. Keeping backend
 * failures distinct prevents a Convex outage from masquerading as a sign-out.
 *
 * `users.viewer` resolves to `null` for an anonymous caller rather than
 * throwing, so "guest" and "bad token" collapse into the same anonymous
 * result. The image upload also uses the authenticated id to scope its key.
 */
export type ViewerResult =
  | { status: "authenticated"; userId: string }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function readViewerId(request: Request): Promise<ViewerResult> {
  const token = readBearerToken(request);
  if (!token) return { status: "anonymous" };

  const convex = getConvexClientForToken(token);
  if (!convex) return { status: "unavailable" };

  try {
    const viewer = await convex.query(api.users.viewer, {});
    return viewer
      ? { status: "authenticated", userId: viewer.id }
      : { status: "anonymous" };
  } catch {
    return { status: "unavailable" };
  }
}
