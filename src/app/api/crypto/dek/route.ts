import {
  base64ToBytes,
  bytesToBase64,
  decryptString,
  DEK_BYTES,
  encryptString,
  generateDekBytes,
  importAesKey,
} from "@/lib/crypto";
import { backendEnv } from "@/server/env";
import { readSessionUser } from "@/server/auth";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
/** Keys stay wrapped in D1; the existing master key remains a Worker secret. */
export async function GET(request: Request) {
  try {
    const env = await backendEnv();
    const user = await readSessionUser(request, env.DB);
    if (!user) return json({ error: "Unauthorized" }, 401);
    // Fail closed: a missing/broken secret must never downgrade uploads to plaintext.
    const master = base64ToBytes(env.ENCRYPTION_MASTER_KEY?.trim() ?? "");
    if (master.length !== DEK_BYTES)
      throw new Error("Invalid encryption configuration");
    const kek = await importAesKey(master);
    let row = await env.DB.prepare(
      "SELECT wrapped_dek FROM user_keys WHERE user_id=?",
    )
      .bind(user.id)
      .first<{ wrapped_dek: string }>();
    if (!row) {
      const wrapped = await encryptString(
        kek,
        bytesToBase64(generateDekBytes()),
      );
      const results = await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO user_keys(user_id,wrapped_dek) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING",
        ).bind(user.id, wrapped),
        env.DB.prepare(
          "SELECT wrapped_dek FROM user_keys WHERE user_id=?",
        ).bind(user.id),
      ]);
      row = results[1].results[0] as { wrapped_dek: string };
    }
    return json({
      dek: await decryptString(kek, row.wrapped_dek),
      userId: user.id,
    });
  } catch {
    return json({ error: "Key retrieval temporarily unavailable" }, 500);
  }
}
