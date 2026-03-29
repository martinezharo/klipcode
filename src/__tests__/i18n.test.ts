import { describe, it, expect } from "vitest";
import { es } from "@/i18n/es";

// Top-level sections that must always exist
const REQUIRED_SECTIONS = [
  "app",
  "auth",
  "forms",
  "workspace",
  "snippetCard",
  "sync",
  "aside",
  "contextMenu",
  "languageSelect",
  "folderSelect",
  "pinnedToHome",
  "folderView",
  "snippetEditor",
  "confirmDeleteFolder",
] as const;

describe("i18n dictionary (es)", () => {
  it.each(REQUIRED_SECTIONS)('has section "%s"', (key) => {
    expect(es[key]).toBeDefined();
    expect(typeof es[key]).toBe("object");
  });

  it("sync section has all SyncStatus keys", () => {
    const statusKeys = ["editing", "saving", "savedLocal", "savedCloud", "error", "idle"] as const;
    for (const key of statusKeys) {
      expect(es.sync[key]).toBeTruthy();
    }
  });

  it("confirmDeleteFolder.containsFolders is a pluralisation function", () => {
    const fn = es.confirmDeleteFolder.containsFolders;
    expect(typeof fn).toBe("function");
    expect(fn(1)).toContain("1");
    expect(fn(3)).toContain("3");
    // Singular vs plural differ
    expect(fn(1)).not.toBe(fn(2));
  });

  it("confirmDeleteFolder.containsSnippets is a pluralisation function", () => {
    const fn = es.confirmDeleteFolder.containsSnippets;
    expect(typeof fn).toBe("function");
    expect(fn(1)).toContain("1");
    expect(fn(5)).toContain("5");
    expect(fn(1)).not.toBe(fn(5));
  });

  it("all contextMenu entries are non-empty strings", () => {
    for (const [key, value] of Object.entries(es.contextMenu)) {
      expect(typeof value, `contextMenu.${key} should be a string`).toBe("string");
      expect((value as string).trim().length, `contextMenu.${key} must not be empty`).toBeGreaterThan(0);
    }
  });
});
