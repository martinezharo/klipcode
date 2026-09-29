import { beforeEach, describe, expect, it, vi } from "vitest";

const mutation = vi.fn();
let cfCountry: string | undefined;
let convexConfigured = true;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ cf: cfCountry === undefined ? undefined : { country: cfCountry } }),
}));

vi.mock("@/lib/convexServer", () => ({
  readBearerToken: (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") || null,
  getConvexClientForToken: () => (convexConfigured ? { mutation } : null),
}));

import { POST } from "@/app/api/account/country/route";

function post(headers: Record<string, string> = {}) {
  return POST(new Request("https://klipcode.test/api/account/country", { method: "POST", headers }));
}

beforeEach(() => {
  mutation.mockReset();
  mutation.mockResolvedValue({ stored: true });
  cfCountry = undefined;
  convexConfigured = true;
});

describe("POST /api/account/country", () => {
  it("rejects a request without a token", async () => {
    expect((await post({ "cf-ipcountry": "ES" })).status).toBe(401);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("reports the country from Cloudflare's header, normalised", async () => {
    const res = await post({ authorization: "Bearer t", "cf-ipcountry": "es" });
    expect(await res.json()).toEqual({ stored: true });
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { country: "ES" });
  });

  it("falls back to request.cf.country when the header is missing", async () => {
    cfCountry = "GB";
    await post({ authorization: "Bearer t" });
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { country: "GB" });
  });

  it.each(["XX", "T1", "", "ESP"])("stores nothing for %j", async (value) => {
    const res = await post({ authorization: "Bearer t", "cf-ipcountry": value });
    expect(await res.json()).toEqual({ stored: false });
    expect(mutation).not.toHaveBeenCalled();
  });

  it("stores nothing when Cloudflare gives no country at all", async () => {
    expect(await (await post({ authorization: "Bearer t" })).json()).toEqual({ stored: false });
    expect(mutation).not.toHaveBeenCalled();
  });

  it("does nothing without a Convex deployment", async () => {
    convexConfigured = false;
    expect(await (await post({ authorization: "Bearer t", "cf-ipcountry": "ES" })).json()).toEqual({ stored: false });
  });

  it("answers 401 when Convex rejects the token", async () => {
    mutation.mockRejectedValue(new Error("Not authenticated"));
    expect((await post({ authorization: "Bearer t", "cf-ipcountry": "ES" })).status).toBe(401);
  });
});
