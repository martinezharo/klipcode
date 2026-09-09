"use client";

import { Clipboard, Copy, ExternalLink, Folder, MoreHorizontal, PenLine, Pin, PinOff, RotateCcw, Scissors, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n";
import type { FolderRecord, SelectedItem } from "@/lib/types";
import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { suppressModifierDragStart } from "@/hooks/useMultiSelection";
import { Tooltip, TruncateTooltip } from "@/ui/Tooltip";

/* ─────────────────── Menu builder ───────────────────────────────────────── */

function buildMenuGroups(
  folder: FolderRecord,
  cm: Dictionary["contextMenu"],
  callbacks: Pick<FolderCardProps, "onPinAside" | "onRename" | "onDelete" | "onCut" | "onCopy" | "onPaste" | "hasPaste" | "onOpenInNewTab">,
  startRenaming: () => void,
): ContextMenuGroup[] {
  const { onPinAside, onRename, onDelete, onCut, onCopy, onPaste, hasPaste, onOpenInNewTab } = callbacks;

  const groups: ContextMenuGroup[] = [
    {
      items: onOpenInNewTab
        ? [{ id: "open-in-new-tab", label: cm.openInNewTab, Icon: ExternalLink, onClick: () => onOpenInNewTab() }]
        : [],
    },
    {
      items: [
        ...(onPinAside
          ? [
              folder.isPinnedAside
                ? { id: "unpin-aside", label: cm.unpinAside, Icon: PinOff, onClick: () => onPinAside(false) }
                : { id: "pin-aside", label: cm.pinAside, Icon: Pin, onClick: () => onPinAside(true) },
            ]
          : []),
        ...(onRename ? [{ id: "rename", label: cm.rename, Icon: PenLine, onClick: startRenaming }] : []),
      ],
    },
    {
      items: [
        ...(onCut ? [{ id: "cut", label: cm.cut, Icon: Scissors, onClick: () => onCut() }] : []),
        ...(onCopy ? [{ id: "copy", label: cm.copy, Icon: Copy, onClick: () => onCopy() }] : []),
        ...(hasPaste && onPaste ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => onPaste() }] : []),
      ],
    },
    {
      items: onDelete
        ? [{ id: "delete", label: cm.delete, Icon: Trash2, variant: "destructive" as const, onClick: () => onDelete() }]
        : [],
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}

/* ─────────────────── Types ──────────────────────────────────────────────── */

export interface FolderCardProps {
  folder: FolderRecord;
  snippetCount: number;
  subFolderCount: number;
  copy: Dictionary;
  /** Click / Enter / Space on the card. Receives the event so the parent can
   *  route ⌘/Ctrl/Shift+click to multi-selection instead of navigating. */
  onClick: (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;
  onOpenInNewTab?: () => void;
  onPinAside?: (pinned: boolean) => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  hasPaste?: boolean;
  /** Part of the parent view's multi-selection — renders highlighted. */
  selected?: boolean;
  /** When the card belongs to a multi-selection, the whole set to drag as a batch. */
  dragItems?: SelectedItem[];
  /** Called right before the context/"more" menu opens, so the parent can sync
   *  its multi-selection with the card the menu will act on. */
  onMenuOpen?: () => void;
  /** When set, the card renders in trash mode: drag is disabled and the menu
   *  offers restore / delete-permanently instead of the normal actions. */
  trashActions?: { onRestore: () => void; onDeletePermanently: () => void };
}

/* ─────────────────── Component ──────────────────────────────────────────── */

export function FolderCard({
  folder,
  snippetCount,
  subFolderCount,
  copy,
  onClick,
  onOpenInNewTab,
  onPinAside,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  hasPaste,
  selected,
  dragItems,
  onMenuOpen,
  trashActions,
}: FolderCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const isTrash = !!trashActions;
  // Native dragging on an ancestor steals mouse gestures from the rename input.
  // Disable it for the full inline-edit session so text remains selectable.
  const canDrag = !isRenaming;

  const drag = useDragCtx();
  const isDraggingThis =
    canDrag &&
    drag.dragging !== null &&
    ((drag.dragging.id === folder.id && drag.dragging.type === "folder") ||
      Boolean(drag.dragging.items?.some((it) => it.id === folder.id)));
  // Trashed folders are draggable (to restore onto the tree) but never drop
  // targets themselves.
  const isDropTarget = !isTrash && drag.dragOverId === folder.id && drag.canDropOnFolder(folder.id);

  const cm = copy.contextMenu;
  const hasMenu = isTrash || !!(onOpenInNewTab || onPinAside || onRename || onDelete || onCut || onCopy);

  const startRenaming = () => {
    setRenameValue(folder.name);
    setIsRenaming(true);
  };

  const menuGroups: ContextMenuGroup[] = isTrash
    ? [
        { items: [{ id: "restore", label: cm.restore, Icon: RotateCcw, onClick: () => trashActions!.onRestore() }] },
        { items: [{ id: "delete-permanently", label: cm.deletePermanently, Icon: Trash2, variant: "destructive" as const, onClick: () => trashActions!.onDeletePermanently() }] },
      ]
    : hasMenu
      ? buildMenuGroups(folder, cm, { onOpenInNewTab, onPinAside, onRename, onDelete, onCut, onCopy, onPaste, hasPaste }, startRenaming)
      : [];

  const meta = [
    snippetCount > 0 ? copy.folderView.snippetCount(snippetCount) : null,
    subFolderCount > 0 ? copy.folderView.folderCount(subFolderCount) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(event);
    }
  };

  const openMenuAt = (x: number, y: number) => setMenuAnchor({ x, y });

  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (menuAnchor) {
      setMenuAnchor(null);
      return;
    }
    onMenuOpen?.();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!hasMenu) return;
    event.preventDefault();
    event.stopPropagation();
    onMenuOpen?.();
    openMenuAt(event.clientX, event.clientY);
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (name) onRename?.(name);
    setIsRenaming(false);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      draggable={canDrag}
      data-selectable-id={folder.id}
      data-selectable-type="folder"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onDragStart={canDrag ? (e) => {
        if (suppressModifierDragStart(e)) return;
        drag.startDrag("folder", folder.id, isTrash ? "trash" : "workspace", dragItems);
        e.dataTransfer.effectAllowed = "move";
      } : undefined}
      onDragEnd={canDrag ? () => drag.endDrag() : undefined}
      onDragEnter={isTrash ? undefined : (e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.enterDropTarget(folder.id);
      }}
      onDragOver={isTrash ? undefined : (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = drag.canDropOnFolder(folder.id) ? "move" : "none";
      }}
      onDrop={isTrash ? undefined : (e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.dropOnFolder(folder.id);
      }}
      className={cn(
        "group flex min-w-0 select-none items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 cursor-pointer",
        canDrag && (isDraggingThis ? "opacity-40 cursor-grabbing" : "active:cursor-grabbing"),
        isDropTarget
          ? "border-ink/30 bg-ink/[0.06] ring-1 ring-inset ring-ink/20"
          : selected
            ? "border-ink/30 bg-ink/[0.05] hover:bg-surface-hover"
            : "border-ink/[0.06] hover:border-ink/[0.12] hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] transition-colors group-hover:bg-ink/[0.08]">
          <Folder size={14} className="text-ink/35 transition-colors group-hover:text-ink/55" />
        </div>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="klipcode-editable-focus w-full select-text rounded bg-ink/[0.07] px-2 py-0.5 text-[13px] font-medium text-foreground outline-none ring-1 ring-ink/15 transition-shadow focus:ring-ink/45"
            />
          ) : (
            <>
              <TruncateTooltip text={folder.name} className="block truncate text-[13px] font-medium leading-tight text-foreground" placement="bottom" />
              <p className="mt-0.5 text-[11px] text-muted">
                {meta || copy.folderView.emptyFolder}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {folder.isPinnedAside && onPinAside && (
          <Tooltip content={cm.unpinAside} placement="bottom">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPinAside(false);
              }}
              className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-ink/[0.08] hover:text-foreground"
              aria-label={cm.unpinAside}
            >
              <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
              <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
            </button>
          </Tooltip>
        )}

        {hasMenu && (
          <Tooltip content={cm.moreOptions} placement="bottom">
            <button
              type="button"
              onClick={handleMoreClick}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded text-muted transition-all hover:bg-ink/[0.08] hover:text-foreground",
                menuAnchor ? "opacity-100 bg-ink/[0.08] text-foreground" : "opacity-100",
              )}
              aria-label={cm.moreOptions}
            >
              <MoreHorizontal size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {menuAnchor && menuGroups.length > 0 && (
        <ContextMenu
          x={menuAnchor.x}
          y={menuAnchor.y}
          groups={menuGroups}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </article>
  );
}
