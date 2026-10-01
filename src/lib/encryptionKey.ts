import { base64ToBytes, importAesKey } from "@/lib/crypto";

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
 * - a thrown error → a transient failure (network, expired session, 5xx); the
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
  const response = await fetch("/api/crypto/dek", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Encryption key fetch failed with status ${response.status}`);
  }

  const body = (await response.json()) as { dek?: unknown; userId?: unknown };
  if (typeof body.dek !== "string" || !body.dek) {
    throw new Error("Malformed encryption key response");
  }

  // The session used may have belonged to a different account than the sync
  // pass we are serving (a sign-out/sign-in race). Uploading under the wrong
  // key would produce records nobody can read, so treat it as transient.
  if (body.userId !== userId) {
    throw new Error("Encryption key belongs to a different account");
  }

  const key = await importAesKey(base64ToBytes(body.dek));
  cached = { userId, key };
  return key;
}
