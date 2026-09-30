"use client";

import { useId } from "react";
import { createPortal } from "react-dom";

import { isDescendantOrSelf } from "@/components/Aside/utils";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import type { Dictionary } from "@/i18n";
import type { FolderRecord, SelectedItem, SnippetRecord } from "@/lib/types";
import { getSnippetDisplayName } from "@/lib/utils";
import { FolderTreeList } from "@/ui/FolderTreeList";

interface MoveDialogProps {
  copy: Dictionary;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  /** What is being moved — one row, or a whole multi-selection. */
  items: SelectedItem[];
  onMove: (targetFolderId: string | null) => void;
  onClose: () => void;
}

/**
 * "Move to…": pick a destination folder for one or more items.
 *
 * The menu's way of doing what drag & drop does on the desktop tree, and the
 * only way on touch, where there is no drag. Picking a folder moves straight
 * away — the choice is the confirmation, and a wrong one is undone by moving
 * back. Folders an item can't go into (itself, its own subfolders) are disabled
 * rather than hidden, so the tree keeps its shape.
 */
export function MoveDialog({ copy, folders, snippets, items, onMove, onClose }: MoveDialogProps) {
  const panelRef = useDialogA11y({ onClose });
  const titleId = useId();

  const movingFolderIds = items.filter((i) => i.type === "folder").map((i) => i.id);
  const parents = new Set(items.map((item) => locationOf(item, folders, snippets)));
  // Mark where the items already live — only meaningful when they share it.
  const current = parents.size === 1 ? ([...parents][0] ?? "") : undefined;

  const subtitle =
    items.length === 1
      ? nameOf(items[0], folders, snippets, copy.snippetCard.untitled)
      : copy.moveDialog.itemCount(items.length);

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 klipcode-z-dialog klipcode-scrim backdrop-blur-[2px]"
        onMouseDown={onClose}
      />

      <div className="pointer-events-none fixed inset-0 klipcode-z-dialog-sticky flex items-center justify-center p-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="klipcode-dialog-animate pointer-events-auto flex max-h-[min(480px,80dvh)] w-full max-w-[360px] flex-col rounded-xl focus:outline-none"
          style={{
            background: "var(--panel-bg)",
            border: "1px solid rgba(var(--ink-rgb),0.09)",
            boxShadow: "var(--panel-shadow)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 px-4 pb-2 pt-4">
            <h2 id={titleId} className="text-[13px] font-medium leading-snug text-ink/90">
              {copy.moveDialog.title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[12px] leading-snug text-muted" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-1.5 pt-0">
            <FolderTreeList
              folders={folders}
              value={current}
              onSelect={(value) => {
                onMove(value === "" ? null : value);
                onClose();
              }}
              rootLabel={copy.workspace.rootOption}
              copy={copy.folderSelect}
              isDisabled={(folderId) =>
                movingFolderIds.some((id) => isDescendantOrSelf(folders, id, folderId))
              }
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** The folder an item currently lives in (null = root). */
function locationOf(
  item: SelectedItem,
  folders: FolderRecord[],
  snippets: SnippetRecord[],
): string | null {
  if (item.type === "folder") return folders.find((f) => f.id === item.id)?.parentId ?? null;
  return snippets.find((s) => s.id === item.id)?.folderId ?? null;
}

function nameOf(
  item: SelectedItem,
  folders: FolderRecord[],
  snippets: SnippetRecord[],
  untitled: string,
): string | null {
  if (item.type === "folder") return folders.find((f) => f.id === item.id)?.name ?? null;
  const snippet = snippets.find((s) => s.id === item.id);
  return snippet ? getSnippetDisplayName(snippet.title, snippet.language, untitled) : null;
}
