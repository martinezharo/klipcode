import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

function request(pathname: string, headers?: HeadersInit) {
  return new NextRequest(`http://example.test${pathname}`, { headers });
}

describe("locale middleware", () => {
  it("rewrites the clean English app URL without redirecting", () => {
    const response = middleware(request("/app"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://example.test/en/app");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-klipcode-internal-locale")).toBe("en");
  });

  it("does not redirect the internal English rewrite back to the clean URL", () => {
    const response = middleware(
      request("/en/app", { "x-klipcode-internal-locale": "en" }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps explicit English URLs redirecting to their clean equivalent", () => {
    const response = middleware(request("/en/app"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://example.test/app");
  });
});
