import { getCloudflareContext } from "@opennextjs/cloudflare";
import { api } from "@convex/_generated/api";
import {
  base64ToBytes,
  bytesToBase64,
  decryptString,
  DEK_BYTES,
  encryptString,
  generateDekBytes,
  importAesKey,
} from "@/lib/crypto";
import { getConvexClientForToken, readBearerToken } from "@/lib/convexServer";

/**
 * Hands the signed-in user their data-encryption key (DEK).
 *
 * The DEK is stored in Convex ONLY wrapped (encrypted) by the master key (KEK),
 * which lives exclusively as the `ENCRYPTION_MASTER_KEY` Worker secret — so the
 * database alone can never decrypt anything, and this route is the only place
 * the two ever meet. Keeping it here on Cloudflare rather than moving it into a
 * Convex action is deliberate: it is what stops the encrypted records and the
 * key that opens them from living with the same provider.
 *
 * On a user's first call the DEK is generated here; losing a race against
 * another device is resolved by `userKeys.create`, which returns the key that
 * won rather than overwriting it.
 *
 * A 503 means "encryption not configured" and tells the client to sync in
 * plaintext; any other failure is transient and the client must retry rather
 * than downgrade.
 */

function getMasterKeyBase64(): string | null {
  let secret: string | undefined;
  try {
    // Cast because the secret isn't in wrangler.jsonc (it's set with
    // `wrangler secret put`), so `wrangler types` can't know about it.
    secret = (getCloudflareContext().env as unknown as Record<string, string | undefined>)
      .ENCRYPTION_MASTER_KEY;
  } catch {
    // Outside the Workers runtime (plain `next dev`, tests): fall through.
  }
  return secret ?? process.env.ENCRYPTION_MASTER_KEY ?? null;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "unauthorized" }, 401);
  }

  // The caller's own token drives every call, so the identity checks in
  // `convex/userKeys.ts` scope access to their record — this route holds no
  // admin key and can reach nothing the caller could not reach themselves.
  const convex = getConvexClientForToken(token);
  if (!convex) {
    return json({ error: "encryption not configured" }, 503);
  }

  const masterKeyBase64 = getMasterKeyBase64();
  if (!masterKeyBase64) {
    return json({ error: "encryption not configured" }, 503);
  }

  let kek: CryptoKey;
  try {
    const kekBytes = base64ToBytes(masterKeyBase64.trim());
    if (kekBytes.length !== DEK_BYTES) {
      throw new Error("master key must decode to 32 bytes");
    }
    kek = await importAesKey(kekBytes);
  } catch {
    // A present-but-broken secret is a deployment mistake; surface it as
    // "not configured" so clients keep working (in plaintext) instead of
    // erroring forever.
    return json({ error: "encryption not configured" }, 503);
  }

  let userId: string;
  let wrappedDek: string | null;
  try {
    ({ userId, wrappedDek } = await convex.query(api.userKeys.mine, {}));
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    if (wrappedDek === null) {
      const candidate = bytesToBase64(generateDekBytes());
      const stored = await convex.mutation(api.userKeys.create, {
        wrappedDek: await encryptString(kek, candidate),
      });
      wrappedDek = stored.wrappedDek;
    }

    return json({ dek: await decryptString(kek, wrappedDek), userId });
  } catch {
    return json({ error: "key retrieval failed" }, 500);
  }
}
