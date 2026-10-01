import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function backendEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("D1 backend unavailable");
  return env;
}
