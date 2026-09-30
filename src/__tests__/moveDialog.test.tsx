/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoveDialog } from "@/components/MoveDialog/MoveDialog";
import { getDictionary } from "@/i18n";
import type { FolderRecord, SelectedItem, SnippetRecord } from "@/lib/types";

const copy = getDictionary("en");

function folder(id: string, parentId: string | null): FolderRecord {
  return { id, name: id, parentId } as FolderRecord;
}

// parent ─┬─ child ── grandchild
//         └─ (sibling of parent at root: other)
const folders = [
  folder("parent", null),
  folder("child", "parent"),
  folder("grandchild", "child"),
  folder("other", null),
];
const snippets = [
  { id: "s1", title: "note", language: "markdown", folderId: "other" } as SnippetRecord,
];

function renderDialog(items: SelectedItem[]) {
  const onMove = vi.fn();
  const onClose = vi.fn();
  render(
    <MoveDialog
      copy={copy}
      folders={folders}
      snippets={snippets}
      items={items}
      onMove={onMove}
      onClose={onClose}
    />,
  );
  return { onMove, onClose };
}

const row = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name: new RegExp(`^${name}$`) });
const expand = (name: string) =>
  fireEvent.click(
    screen
      .getAllByRole("button", { name: copy.folderSelect.expandFolder })
      .find((b) => b.nextElementSibling?.textContent === name)!,
  );

describe("MoveDialog", () => {
  afterEach(cleanup);

  it("won't move a folder into itself or its own subfolders", () => {
    renderDialog([{ type: "folder", id: "child" }]);
    // Moving it to where it already lives is a harmless no-op, so allowed.
    expect(row("parent").disabled).toBe(false);
    expand("parent");
    expect(row("child").disabled).toBe(true);
    expand("child");
    expect(row("grandchild").disabled).toBe(true);
    expect(row("other").disabled).toBe(false);
  });

  it("moves to the root as null and closes", () => {
    const { onMove, onClose } = renderDialog([{ type: "snippet", id: "s1" }]);
    fireEvent.click(row(copy.workspace.rootOption));
    expect(onMove).toHaveBeenCalledExactlyOnceWith(null);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves into the picked folder by id", () => {
    const { onMove } = renderDialog([{ type: "snippet", id: "s1" }]);
    fireEvent.click(row("parent"));
    expect(onMove).toHaveBeenCalledExactlyOnceWith("parent");
  });
});
