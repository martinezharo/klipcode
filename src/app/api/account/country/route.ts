import { getCloudflareContext } from "@opennextjs/cloudflare";
import { api } from "@convex/_generated/api";
import { normalizeCountry } from "@convex/lib/country";
import { getConvexClientForToken, readBearerToken } from "@/lib/convexServer";

/**
 * Tells Convex which country the signed-in user is connecting from.
 *
 * This has to be a Cloudflare route: the sign-in callback is served by Convex
 * itself, which never sees Cloudflare's geolocation, whereas every request that
 * reaches this Worker carries it. Only the two-letter country is read — the IP
 * address is neither looked at nor stored.
 *
 * Like the other routes here it acts purely as the caller (their own token, no
 * admin key), and `users.recordCountry` keeps the first value it is given.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function requestCountry(request: Request): string | null {
  const fromHeader = normalizeCountry(request.headers.get("cf-ipcountry"));
  if (fromHeader) return fromHeader;

  try {
    const cf = getCloudflareContext().cf as { country?: string } | undefined;
    return normalizeCountry(cf?.country);
  } catch {
    // Outside the Workers runtime (plain `next dev`, tests): no geolocation.
    return null;
  }
}

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "unauthorized" }, 401);
  }

  const convex = getConvexClientForToken(token);
  if (!convex) {
    return json({ stored: false });
  }

  const country = requestCountry(request);
  if (!country) {
    return json({ stored: false });
  }

  try {
    return json(await convex.mutation(api.users.recordCountry, { country }));
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
}
