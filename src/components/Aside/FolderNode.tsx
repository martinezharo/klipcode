"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Pin } from "lucide-react";
import type { FolderRecord, SnippetRecord } from "@/lib/types";
import { useAsideCtx } from "./AsideContext";
import { ItemActions } from "./ItemActions";
import { NewFolderInput } from "./NewFolderInput";
import { SnippetNode } from "./SnippetNode";
import { STEP, sortByPinThenAlpha } from "./utils";

export function FolderNode({
  folder,
  folders,
  snippets,
  depth,
}: {
  folder: FolderRecord;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  depth: number;
}) {
  const ctx = useAsideCtx();
  const [isOpen, setIsOpen] = useState(false);

  const isRenaming = ctx.renamingId === folder.id;
  const isCreatingHere = ctx.creatingFolderParentId === folder.id;

  const childFolders = sortByPinThenAlpha(
    folders.filter((f) => f.parentId === folder.id),
    (f) => f.name,
  );
  const childSnippets = sortByPinThenAlpha(
    snippets.filter((s) => s.folderId === folder.id),
    (s) => s.title ?? "",
  );

  const prevCreating = useRef(false);
  useEffect(() => {
    if (isCreatingHere && !prevCreating.current) setIsOpen(true);
    prevCreating.current = isCreatingHere;
  }, [isCreatingHere]);

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.openMenu({ type: "folder", id: folder.id, x: e.clientX, y: e.clientY });
  }

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "folder", id: folder.id, x: rect.left, y: rect.bottom + 4 });
  }

  const paddingLeft = 10 + depth * STEP;
  const isDraggingThis = ctx.dragging?.id === folder.id;
  const isDropTarget = ctx.dragOverId === folder.id && ctx.canDropOnFolder(folder.id);
  const sharedRowClass = [
    "group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-all duration-100 hover:bg-white/[0.04] hover:text-foreground",
    isDraggingThis ? "opacity-40" : "",
    isDropTarget ? "bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/[0.18]" : "",
  ].filter(Boolean).join(" ");
  const hasChildren = childFolders.length > 0 || childSnippets.length > 0;

  return (
    <div>
      {isRenaming ? (
        <div
          className={sharedRowClass}
          style={{ paddingLeft }}
          onContextMenu={openContextMenu}
        >
          <ChevronRight
            size={13}
            className={`shrink-0 text-white/25 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
          {isOpen && hasChildren ? (
            <FolderOpen size={13} className="shrink-0 text-white/25" />
          ) : (
            <Folder size={13} className="shrink-0 text-white/25" />
          )}
          <input
            autoFocus
            defaultValue={folder.name}
            onBlur={(e) => ctx.submitFolderRename(folder.id, e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter")
                ctx.submitFolderRename(folder.id, (e.target as HTMLInputElement).value);
              if (e.key === "Escape") ctx.cancelRename();
            }}
            className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
          />
        </div>
      ) : (
        <div
          className={sharedRowClass}
          style={{ paddingLeft }}
          role="button"
          tabIndex={0}
          onClick={() => ctx.selectFolder(folder.id)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ctx.selectFolder(folder.id);
            }
          }}
          onContextMenu={openContextMenu}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.enterDropTarget(folder.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = ctx.canDropOnFolder(folder.id) ? "move" : "none";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.dropOnTarget(folder.id);
          }}
        >
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center text-white/25 transition-colors hover:text-white/45"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((value) => !value);
            }}
            title={ctx.copy.aside.toggleFolder}
            aria-label={ctx.copy.aside.toggleFolder}
          >
            <ChevronRight
              size={13}
              className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            />
          </button>

          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              ctx.startDrag("folder", folder.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => ctx.endDrag()}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-grab active:cursor-grabbing"
          >
            {isOpen && hasChildren ? (
              <FolderOpen size={13} className="shrink-0 text-white/25" />
            ) : (
              <Folder size={13} className="shrink-0 text-white/25" />
            )}
            <span className="flex-1 truncate leading-none">{folder.name}</span>
          </button>

          <ItemActions
            showAdd
            onAdd={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              ctx.beginCreateFolder(folder.id);
            }}
            onMore={openMoreMenu}
          />
          {folder.isPinnedAside && (
            <Pin size={10} className="shrink-0 text-white/30" />
          )}
        </div>
      )}

      {(isOpen || isCreatingHere) && (
        <div className="relative">
          {(hasChildren || isCreatingHere) && (
            <div
              className="absolute bottom-1 top-0 w-px bg-white/[0.05]"
              style={{ left: `${paddingLeft + 6}px` }}
            />
          )}
          {isCreatingHere && (
            <NewFolderInput depth={depth + 1} parentId={folder.id} />
          )}
          {childFolders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              snippets={snippets}
              depth={depth + 1}
            />
          ))}
          {childSnippets.map((snippet) => (
            <SnippetNode key={snippet.id} snippet={snippet} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
