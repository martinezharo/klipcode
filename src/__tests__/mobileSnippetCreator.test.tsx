/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileSnippetCreator } from "@/components/CreateSnippetModal/MobileSnippetCreator";
import { getDictionary } from "@/i18n";

// CodeMirror needs real layout; the creator only cares that it gets a value.
vi.mock("@/components/Editor/Editor", () => ({
  Editor: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="code" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

const copy = getDictionary("en");

function renderCreator(onCreateSnippet: () => Promise<string | undefined>) {
  return render(
    <MobileSnippetCreator
      copy={copy}
      folders={[]}
      defaultFolderId={null}
      onCreateSnippet={onCreateSnippet}
      onOpenInEditor={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("MobileSnippetCreator", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates once however many times Create is tapped", () => {
    const onCreateSnippet = vi.fn(() => new Promise<string | undefined>(() => {}));
    renderCreator(onCreateSnippet);

    const create = screen.getByRole("button", { name: copy.forms.submitSnippetShort });
    fireEvent.click(create);
    fireEvent.click(create);

    expect(onCreateSnippet).toHaveBeenCalledTimes(1);
  });

  it("lets the user retry after a failed create", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onCreateSnippet = vi
      .fn<() => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce("id");
    renderCreator(onCreateSnippet);

    const create = screen.getByRole("button", { name: copy.forms.submitSnippetShort });
    fireEvent.click(create);
    await waitFor(() => expect(logError).toHaveBeenCalled());

    fireEvent.click(create);

    expect(onCreateSnippet).toHaveBeenCalledTimes(2);
  });
});
