import { getAuthToken } from "@/lib/authToken";
import { base64ToBytes, importAesKey } from "@/lib/crypto";
import { isConvexConfigured } from "@/lib/convexEnv";

/**
 * Client-side retrieval of the signed-in user's data-encryption key (DEK).
 *
 * The raw DEK never persists anywhere on the client: it is fetched from
 * `/api/crypto/dek` (which unwraps it with the server-held master key) and kept
 * only in memory, keyed by user. The sync engine calls this lazily, so the
 * three outcomes map onto sync behavior:
 *
 * - a `CryptoKey`  → uploads are encrypted (`cryptoVersion` 1) and encrypted
 *   cloud records can be decrypted;
 * - `null`         → encryption is unavailable (no Convex deployment, or the
 *   server has no master key configured); sync degrades to plaintext
 *   (`cryptoVersion` 0) exactly like before encryption existed;
 * - a thrown error → a transient failure (network, expired token, 5xx); the
 *   caller must NOT downgrade to plaintext — sync fails and the existing
 *   retry/backoff loop tries again.
 */

let cached: { userId: string; key: CryptoKey | null } | null = null;
let inflight: { userId: string; promise: Promise<CryptoKey | null> } | null = null;

export async function getWorkspaceEncryptionKey(userId: string): Promise<CryptoKey | null> {
  if (cached?.userId === userId) {
    return cached.key;
  }

  if (inflight?.userId === userId) {
    return inflight.promise;
  }

  const promise = fetchWorkspaceEncryptionKey(userId).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { userId, promise };
  return promise;
}

/** Drop the in-memory key, e.g. on sign-out on a shared machine. */
export function clearWorkspaceEncryptionKey(): void {
  cached = null;
  inflight = null;
}

async function fetchWorkspaceEncryptionKey(userId: string): Promise<CryptoKey | null> {
  // No deployment configured: plaintext mode. Not cached, so a later call
  // re-evaluates.
  if (!isConvexConfigured()) {
    return null;
  }

  const token = getAuthToken();

  if (!token) {
    // Sync is running for a user we hold no session for (sign-out race, token
    // refresh in flight). Treat as transient so nothing is uploaded plaintext.
    throw new Error("No active session for encryption key fetch");
  }

  const response = await fetch("/api/crypto/dek", {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // 404 (route not deployed) / 503 (master key not configured): encryption is
  // deliberately unavailable. Cache it so every sync cycle doesn't re-probe;
  // a page reload picks up a newly configured server.
  if (response.status === 404 || response.status === 503) {
    cached = { userId, key: null };
    return null;
  }

  if (!response.ok) {
    throw new Error(`Encryption key fetch failed with status ${response.status}`);
  }

  const body = (await response.json()) as { dek?: unknown; userId?: unknown };
  if (typeof body.dek !== "string" || !body.dek) {
    throw new Error("Malformed encryption key response");
  }

  // The token we sent may have belonged to a different account than the sync
  // pass we are serving (a sign-out/sign-in race). Uploading under the wrong
  // key would produce records nobody can read, so treat it as transient.
  if (body.userId !== userId) {
    throw new Error("Encryption key belongs to a different account");
  }

  const key = await importAesKey(base64ToBytes(body.dek));
  cached = { userId, key };
  return key;
}
