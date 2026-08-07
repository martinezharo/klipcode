import { useCallback } from "react";
import {
  Clipboard,
  Copy,
  ExternalLink,
  FilePlus,
  FolderPlus,
  PenLine,
  Pin,
  PinOff,
  Scissors,
  Trash2,
} from "lucide-react";
import type { ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import type { FolderRecord, SnippetRecord, ClipboardEntry, SelectedItem } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { openItemInNewTab } from "@/lib/navigation";
import { copyTextToClipboard } from "@/lib/utils";
import type { MenuTarget } from "./types";

interface UseContextMenuGroupsArgs {
  copy: Dictionary;
  clipboard: ClipboardEntry | null;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  onPaste: (targetFolderId: string | null) => Promise<void>;
  onPinFolder: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinSnippet: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  /** Soft-delete the whole multi-selection at once. */
  onDeleteMany: (items: SelectedItem[]) => Promise<void>;
  onCut: (entry: ClipboardEntry) => void;
  onCopy: (entry: ClipboardEntry) => void;
  setRenamingId: (id: string | null) => void;
  setCreatingFolderParentId: (id: string | null | undefined) => void;
  onOpenCreateModal: (folderId: string | null) => void;
  /** Ids in the current multi-selection — drives whether a row's menu acts on the
   *  whole set or just that row. */
  selectedIds: ReadonlySet<string>;
  /** The current multi-selection as typed items, for batch actions. */
  getSelectedItems: () => SelectedItem[];
  /** Drop the multi-selection (after a batch delete clears the acted-on rows). */
  clearSelection: () => void;
}

export function useContextMenuGroups({
  copy,
  clipboard,
  folders,
  snippets,
  onPaste,
  onPinFolder,
  onPinSnippet,
  onDeleteFolder,
  onDeleteSnippet,
  onDeleteMany,
  onCut,
  onCopy,
  setRenamingId,
  setCreatingFolderParentId,
  onOpenCreateModal,
  selectedIds,
  getSelectedItems,
  clearSelection,
}: UseContextMenuGroupsArgs) {
  return useCallback(
    (target: MenuTarget): ContextMenuGroup[] => {
      const { type, id } = target;
      const cm = copy.contextMenu;

      /* When the right-clicked row is part of a multi-selection, the
       * delete / cut / copy actions operate on the whole set — matching the
       * keyboard shortcuts and drag-move. (selectForMenu has already collapsed
       * the selection to this row if it was clicked from outside the set.) */
      const batchActive = !!id && selectedIds.has(id) && selectedIds.size > 1;
      const clipboardItems = (fallback: SelectedItem) =>
        (batchActive ? getSelectedItems() : [fallback]).map((i) => ({ itemType: i.type, id: i.id }));
      const deleteSelection = () => {
        const items = getSelectedItems();
        clearSelection();
        void onDeleteMany(items);
      };

      if (type === "root") {
        return [
          {
            items: [
              {
                id: "new-folder",
                label: cm.newFolder,
                Icon: FolderPlus,
                onClick: () => setCreatingFolderParentId(null),
              },
              {
                id: "new-snippet",
                label: cm.newSnippet,
                Icon: FilePlus,
                onClick: () => onOpenCreateModal(null),
              },
            ],
          },
          ...(clipboard
            ? [{
                items: [{
                  id: "paste",
                  label: cm.paste,
                  Icon: Clipboard,
                  onClick: () => void onPaste(null),
                }],
              }]
            : []),
        ];
      }

      if (type === "folder" && id) {
        const folder = folders.find((f) => f.id === id);
        if (!folder) return [];
        return [
          {
            items: [
              {
                id: "open-in-new-tab",
                label: cm.openInNewTab,
                Icon: ExternalLink,
                onClick: () => openItemInNewTab("folder", id),
              },
            ],
          },
          {
            items: [
              {
                id: "new-folder",
                label: cm.newFolder,
                Icon: FolderPlus,
                onClick: () => setCreatingFolderParentId(id),
              },
              {
                id: "new-snippet",
                label: cm.newSnippet,
                Icon: FilePlus,
                onClick: () => onOpenCreateModal(id),
              },
            ],
          },
          {
            items: [
              folder.isPinnedAside
                ? { id: "unpin", label: cm.unpin, Icon: PinOff, onClick: () => void onPinFolder(id, "aside", false) }
                : { id: "pin",   label: cm.pin,   Icon: Pin,    onClick: () => void onPinFolder(id, "aside", true)  },
              {
                id: "rename",
                label: cm.rename,
                Icon: PenLine,
                onClick: () => setRenamingId(id),
              },
            ],
          },
          {
            items: [
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  items: clipboardItems({ id, type: "folder" }) }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", items: clipboardItems({ id, type: "folder" }) }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(id) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: batchActive ? deleteSelection : () => void onDeleteFolder(id),
            }],
          },
        ];
      }

      if (type === "snippet" && id) {
        const snippet = snippets.find((s) => s.id === id);
        if (!snippet) return [];
        return [
          {
            items: [
              {
                id: "open-in-new-tab",
                label: cm.openInNewTab,
                Icon: ExternalLink,
                onClick: () => openItemInNewTab("snippet", id),
              },
            ],
          },
          {
            items: [{
              id: "copy-content",
              label: cm.copyContent,
              Icon: Copy,
              onClick: () => void copyTextToClipboard(snippet.code ?? ""),
            }],
          },
          {
            items: [
              snippet.isPinnedAside
                ? { id: "unpin-aside", label: cm.unpinAside, Icon: PinOff, onClick: () => void onPinSnippet(id, "aside", false) }
                : { id: "pin-aside",   label: cm.pinAside,   Icon: Pin,    onClick: () => void onPinSnippet(id, "aside", true)  },
              snippet.isPinnedHome
                ? { id: "unpin-home", label: cm.unpinHome, Icon: PinOff, onClick: () => void onPinSnippet(id, "home", false) }
                : { id: "pin-home",   label: cm.pinHome,   Icon: Pin,    onClick: () => void onPinSnippet(id, "home", true)  },
              {
                id: "rename",
                label: cm.rename,
                Icon: PenLine,
                onClick: () => setRenamingId(id),
              },
            ],
          },
          {
            items: [
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  items: clipboardItems({ id, type: "snippet" }) }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", items: clipboardItems({ id, type: "snippet" }) }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(snippet.folderId) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: batchActive ? deleteSelection : () => void onDeleteSnippet(id),
            }],
          },
        ];
      }

      return [];
    },
    [clipboard, copy.contextMenu, folders, snippets, onPaste, onPinFolder, onPinSnippet, onDeleteFolder, onDeleteSnippet, onDeleteMany, onCut, onCopy, setRenamingId, setCreatingFolderParentId, onOpenCreateModal, selectedIds, getSelectedItems, clearSelection],
  );
}
