import { describe, it, expect } from "vitest";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/constants/languages";

describe("LANGUAGES constant", () => {
  it("is non-empty", () => {
    expect(LANGUAGES.length).toBeGreaterThan(0);
  });

  it("has no duplicate IDs", () => {
    const ids = LANGUAGES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate extensions", () => {
    const extensions = LANGUAGES.map((l) => l.extension);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("all IDs are non-empty strings", () => {
    for (const lang of LANGUAGES) {
      expect(lang.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("all labels are non-empty strings", () => {
    for (const lang of LANGUAGES) {
      expect(lang.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("all extensions start with a dot", () => {
    for (const lang of LANGUAGES) {
      expect(lang.extension).toMatch(/^\./);
    }
  });

  it("DEFAULT_LANGUAGE exists in LANGUAGES", () => {
    const ids = LANGUAGES.map((l) => l.id);
    expect(ids).toContain(DEFAULT_LANGUAGE);
  });
});
