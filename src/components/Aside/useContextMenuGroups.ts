import { useCallback } from "react";
import {
  Clipboard,
  Copy,
  FilePlus,
  FolderPlus,
  PenLine,
  Pin,
  PinOff,
  Scissors,
  Trash2,
} from "lucide-react";
import type { ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import type { FolderRecord, SnippetRecord, ClipboardEntry } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { MenuTarget } from "./types";

interface UseContextMenuGroupsArgs {
  copy: Dictionary;
  clipboard: ClipboardEntry | null;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  onGoHome: () => void;
  onNewSnippetAt: (folderId: string | null) => void;
  onPaste: (targetFolderId: string | null) => Promise<void>;
  onPinFolder: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinSnippet: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  onCut: (entry: ClipboardEntry) => void;
  onCopy: (entry: ClipboardEntry) => void;
  setRenamingId: (id: string | null) => void;
  setCreatingFolderParentId: (id: string | null | undefined) => void;
  setCreatingSnippetFolderId: (id: string | null | undefined) => void;
}

export function useContextMenuGroups({
  copy,
  clipboard,
  folders,
  snippets,
  onGoHome,
  onNewSnippetAt,
  onPaste,
  onPinFolder,
  onPinSnippet,
  onDeleteFolder,
  onDeleteSnippet,
  onCut,
  onCopy,
  setRenamingId,
  setCreatingFolderParentId,
  setCreatingSnippetFolderId,
}: UseContextMenuGroupsArgs) {
  return useCallback(
    (target: MenuTarget): ContextMenuGroup[] => {
      const { type, id } = target;
      const cm = copy.contextMenu;

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
                onClick: () => setCreatingSnippetFolderId(null),
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
                id: "new-folder",
                label: cm.newFolder,
                Icon: FolderPlus,
                onClick: () => setCreatingFolderParentId(id),
              },
              {
                id: "new-snippet",
                label: cm.newSnippet,
                Icon: FilePlus,
                onClick: () => setCreatingSnippetFolderId(id),
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
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  itemType: "folder", id }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", itemType: "folder", id }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(id) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: () => void onDeleteFolder(id),
            }],
          },
        ];
      }

      if (type === "snippet" && id) {
        const snippet = snippets.find((s) => s.id === id);
        if (!snippet) return [];
        return [
          {
            items: [{
              id: "copy-content",
              label: cm.copyContent,
              Icon: Copy,
              onClick: () => void navigator.clipboard.writeText(snippet.code ?? ""),
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
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  itemType: "snippet", id }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", itemType: "snippet", id }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(snippet.folderId) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: () => void onDeleteSnippet(id),
            }],
          },
        ];
      }

      return [];
    },
    [clipboard, copy.contextMenu, folders, snippets, onGoHome, onNewSnippetAt, onPaste, onPinFolder, onPinSnippet, onDeleteFolder, onDeleteSnippet, onCut, onCopy, setRenamingId, setCreatingFolderParentId, setCreatingSnippetFolderId],
  );
}
