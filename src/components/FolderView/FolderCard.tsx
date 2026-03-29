"use client";

import { Clipboard, Copy, Folder, MoreHorizontal, PenLine, Pin, PinOff, Scissors, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n";
import type { FolderRecord } from "@/lib/types";
import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";

/* ─────────────────── Menu builder ───────────────────────────────────────── */

function buildMenuGroups(
  folder: FolderRecord,
  cm: Dictionary["contextMenu"],
  callbacks: Pick<FolderCardProps, "onPinAside" | "onRename" | "onDelete" | "onCut" | "onCopy" | "onPaste" | "hasPaste">,
  startRenaming: () => void,
): ContextMenuGroup[] {
  const { onPinAside, onRename, onDelete, onCut, onCopy, onPaste, hasPaste } = callbacks;

  const groups: ContextMenuGroup[] = [
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
  onClick: () => void;
  onPinAside?: (pinned: boolean) => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  hasPaste?: boolean;
}

/* ─────────────────── Component ──────────────────────────────────────────── */

export function FolderCard({
  folder,
  snippetCount,
  subFolderCount,
  copy,
  onClick,
  onPinAside,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  hasPaste,
}: FolderCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const drag = useDragCtx();
  const isDraggingThis = drag.dragging?.id === folder.id && drag.dragging.type === "folder";
  const isDropTarget = drag.dragOverId === folder.id && drag.canDropOnFolder(folder.id);

  const hasMenu = !!(onPinAside || onRename || onDelete || onCut || onCopy);
  const cm = copy.contextMenu;

  const startRenaming = () => {
    setRenameValue(folder.name);
    setIsRenaming(true);
  };

  const menuGroups = hasMenu
    ? buildMenuGroups(folder, cm, { onPinAside, onRename, onDelete, onCut, onCopy, onPaste, hasPaste }, startRenaming)
    : [];

  const meta = [
    snippetCount > 0 ? `${snippetCount} ${copy.folderView.snippetLabel}` : null,
    subFolderCount > 0 ? `${subFolderCount} ${copy.folderView.subFolderLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
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
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!hasMenu) return;
    event.preventDefault();
    event.stopPropagation();
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
      draggable
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => {
        drag.startDrag("folder", folder.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => drag.endDrag()}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.enterDropTarget(folder.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = drag.canDropOnFolder(folder.id) ? "move" : "none";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.dropOnFolder(folder.id);
      }}
      className={cn(
        "group flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        isDraggingThis
          ? "opacity-40 cursor-grabbing"
          : "cursor-grab active:cursor-grabbing",
        isDropTarget
          ? "border-white/30 bg-white/[0.06] ring-1 ring-inset ring-white/20"
          : "border-white/[0.06] hover:border-white/[0.12] hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]">
          <Folder size={14} className="text-white/35 transition-colors group-hover:text-white/55" />
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
              className="w-full rounded bg-white/[0.07] px-2 py-0.5 text-[13px] font-medium text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
            />
          ) : (
            <>
              <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                {folder.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {meta || copy.folderView.emptyFolder}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {folder.isPinnedAside && onPinAside && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPinAside(false);
            }}
            className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-white/[0.08] hover:text-foreground"
            title={cm.unpinAside}
            aria-label={cm.unpinAside}
          >
            <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
            <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
          </button>
        )}

        {hasMenu && (
          <button
            type="button"
            onClick={handleMoreClick}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-muted transition-all hover:bg-white/[0.08] hover:text-foreground",
              menuAnchor ? "opacity-100 bg-white/[0.08] text-foreground" : "opacity-100",
            )}
            title={cm.moreOptions}
            aria-label={cm.moreOptions}
          >
            <MoreHorizontal size={14} />
          </button>
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
