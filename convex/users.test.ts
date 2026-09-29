/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { normalizeCountry } from "./lib/country";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

let t: ReturnType<typeof convexTest>;
let alice: Id<"users">;
let bob: Id<"users">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  alice = await t.run((ctx) => ctx.db.insert("users", {}));
  bob = await t.run((ctx) => ctx.db.insert("users", {}));
});

const as = (userId: Id<"users">) => t.withIdentity({ subject: userId });
const countryOf = (userId: Id<"users">) => t.run(async (ctx) => (await ctx.db.get(userId))?.country ?? null);

describe("normalizeCountry", () => {
  it("accepts two letters in any case and rejects everything else", () => {
    expect(normalizeCountry("es")).toBe("ES");
    expect(normalizeCountry(" GB ")).toBe("GB");
    for (const bad of ["", "E", "ESP", "E1", "1E", null, undefined]) expect(normalizeCountry(bad)).toBeNull();
  });

  it("does not treat Cloudflare's unknown and Tor markers as countries", () => {
    expect(normalizeCountry("XX")).toBeNull();
    expect(normalizeCountry("T1")).toBeNull();
  });
});

describe("recordCountry", () => {
  it("requires a signed-in caller", async () => {
    await expect(t.mutation(api.users.recordCountry, { country: "ES" })).rejects.toThrow("Not authenticated");
  });

  it("stores the country once and never replaces it", async () => {
    expect(await as(alice).mutation(api.users.recordCountry, { country: "es" })).toEqual({ stored: true });
    expect(await as(alice).mutation(api.users.recordCountry, { country: "FR" })).toEqual({ stored: false });
    expect(await countryOf(alice)).toBe("ES");
  });

  it("ignores values that are not a country", async () => {
    expect(await as(alice).mutation(api.users.recordCountry, { country: "XX" })).toEqual({ stored: false });
    expect(await as(alice).mutation(api.users.recordCountry, { country: "not-a-country" })).toEqual({ stored: false });
    expect(await countryOf(alice)).toBeNull();
  });

  it("only ever writes the caller's own account", async () => {
    await as(alice).mutation(api.users.recordCountry, { country: "ES" });
    expect(await countryOf(bob)).toBeNull();
  });
});

describe("hasCountry", () => {
  it("is null signed out, false until a country is recorded, then true", async () => {
    expect(await t.query(api.users.hasCountry, {})).toBeNull();
    expect(await as(alice).query(api.users.hasCountry, {})).toBe(false);
    await as(alice).mutation(api.users.recordCountry, { country: "US" });
    expect(await as(alice).query(api.users.hasCountry, {})).toBe(true);
    expect(await as(bob).query(api.users.hasCountry, {})).toBe(false);
  });
});
