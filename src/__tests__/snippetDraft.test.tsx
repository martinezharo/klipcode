/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSnippetDraft } from "@/components/NewSnippet/useSnippetDraft";

describe("useSnippetDraft", () => {
  it("starts from the defaults", () => {
    const { result } = renderHook(() =>
      useSnippetDraft({ defaultLanguage: "python", defaultFolderId: "folder-1" }),
    );

    expect(result.current.toData()).toEqual({
      title: "",
      language: "python",
      folderId: "folder-1",
      code: "",
    });
  });

  it("picks the language from a recognised title extension", () => {
    const { result } = renderHook(() => useSnippetDraft());

    act(() => result.current.setTitle("index.html"));

    expect(result.current.language).toBe("html");
  });

  it("keeps a manual language choice while the title has no extension", () => {
    const { result } = renderHook(() => useSnippetDraft());

    act(() => result.current.setLanguage("rust"));
    act(() => result.current.setTitle("notes"));

    expect(result.current.language).toBe("rust");
  });

  it("follows a changed default folder", () => {
    const { result, rerender } = renderHook(
      ({ folderId }) => useSnippetDraft({ defaultFolderId: folderId }),
      { initialProps: { folderId: null as string | null } },
    );
    expect(result.current.folderId).toBe("");

    rerender({ folderId: "folder-2" });

    expect(result.current.folderId).toBe("folder-2");
  });

  it("resets every field back to the defaults", () => {
    const { result } = renderHook(() =>
      useSnippetDraft({ defaultLanguage: "python", defaultFolderId: "folder-1" }),
    );

    act(() => {
      result.current.setTitle("a.js");
      result.current.setCode("let a = 1");
      result.current.setFolderId("");
    });
    act(() => result.current.reset());

    expect(result.current.toData()).toEqual({
      title: "",
      language: "python",
      folderId: "folder-1",
      code: "",
    });
  });
});
