/**
 * The current Convex session JWT, mirrored out of React so non-React code can
 * read it.
 *
 * Only `/api/crypto/dek` needs this. That route is the one piece of the backend
 * that deliberately does NOT live in Convex — it holds the master key that
 * wraps every user's DEK, and keeping it on Cloudflare is what stops the
 * encrypted data and the key that opens it from sitting with the same provider.
 * Since it is a plain HTTP endpoint rather than a Convex function, it has to be
 * handed the caller's token explicitly, and it forwards that same token back to
 * Convex so the identity checks in `convex/userKeys.ts` apply to it too.
 *
 * `ConvexAuthBridge` keeps this in sync with `useAuthToken()`.
 */

let currentToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function getAuthToken(): string | null {
  return currentToken;
}
