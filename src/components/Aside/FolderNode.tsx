"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import type { FolderRecord, SnippetRecord } from "@/lib/types";
import { Tooltip, TruncateTooltip } from "@/ui/Tooltip";
import { useAsideCtx } from "./AsideContext";
import { ItemActions } from "./ItemActions";
import { PinnedAccent } from "./PinnedAccent";
import { NewFolderInput } from "./NewFolderInput";
import { SnippetNode } from "./SnippetNode";
import { ROW_LEAD_SPACER, STEP, sortByPinThenAlpha, suppressRowDragStart, treeRowClass } from "./utils";
import { IconButton } from "@/ui/IconButton";

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
    // Intentional: auto-expand this folder the moment inline folder creation
    // starts here. A synchronize-on-transition effect, guarded by the prev ref.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isCreatingHere && !prevCreating.current) setIsOpen(true);
    prevCreating.current = isCreatingHere;
  }, [isCreatingHere]);

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.selectForMenu(folder.id);
    ctx.openMenu({ type: "folder", id: folder.id, x: e.clientX, y: e.clientY });
  }

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.selectForMenu(folder.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "folder", id: folder.id, x: rect.left, y: rect.bottom + 4 });
  }

  const paddingLeft = 10 + depth * STEP;
  const isDraggingThis = ctx.isDraggingItem(folder.id);
  const isDropTarget = ctx.dragOverId === folder.id && ctx.canDropOnFolder(folder.id);
  // The active row (open in the main view) gets a bordered highlight; rows that
  // are only part of a multi-selection get a borderless fill.
  const isActive = ctx.selectedFolderId === folder.id;
  const isMultiSelected = ctx.isItemSelected(folder.id) && !isActive;
  const sharedRowClass = treeRowClass({
    isActive,
    isMultiSelected,
    isDragging: isDraggingThis,
    isDropTarget,
  });
  const hasChildren = childFolders.length > 0 || childSnippets.length > 0;
  const isAnyCreatingHere = isCreatingHere;

  return (
    <div>
      {isRenaming ? (
        <div
          className={sharedRowClass}
          style={{ paddingLeft }}
          onContextMenu={openContextMenu}
        >
          {/* Matches the chevron button's footprint so the row doesn't shift
              sideways when it flips into rename mode. */}
          <span className={`${ROW_LEAD_SPACER} flex items-center justify-center`} aria-hidden="true">
            <ChevronRight
              size={13}
              className={`text-ink/25 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            />
          </span>
          {isOpen && hasChildren ? (
            <FolderOpen size={13} className="shrink-0 text-ink/25" />
          ) : (
            <Folder size={13} className="shrink-0 text-ink/25" />
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
            className="min-w-0 flex-1 rounded bg-ink/[0.07] px-2 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-ink/15 focus:ring-ink/35 transition-shadow"
          />
        </div>
      ) : (
        <div
          className={`${sharedRowClass} cursor-pointer select-none active:cursor-grabbing`}
          style={{ paddingLeft }}
          // A tree row, not a button: `button` makes its children presentational,
          // which hides the expand toggle and the actions menu from assistive
          // tech. treeitem also carries the expanded / level / selected state.
          role="treeitem"
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-level={depth + 1}
          aria-selected={isActive}
          aria-label={folder.name}
          tabIndex={0}
          data-selectable-id={folder.id}
          data-selectable-type="folder"
          draggable
          onDragStart={(e) => {
            if (suppressRowDragStart(e)) return;
            ctx.startDrag("folder", folder.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => ctx.endDrag()}
          onClick={(e) => ctx.activateItem(e, { id: folder.id, type: "folder" })}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ctx.activateItem(e, { id: folder.id, type: "folder" });
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
          <PinnedAccent pinned={!!folder.isPinnedAside} label={ctx.copy.aside.pinned} />
          <Tooltip content={isOpen ? ctx.copy.aside.collapseFolder : ctx.copy.aside.expandFolder}>
            <IconButton
              data-no-drag=""
              className="text-ink/25 hover:text-ink/45 lg:h-4 lg:w-4"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((value) => !value);
              }}
              aria-label={isOpen ? ctx.copy.aside.collapseFolder : ctx.copy.aside.expandFolder}
            >
              <ChevronRight
                size={14}
                className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
              />
            </IconButton>
          </Tooltip>

          {/* Presentational: the row itself is the activation target, so this
              was a tab stop with no handler attached. */}
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            {isOpen && hasChildren ? (
              <FolderOpen size={13} className="shrink-0 text-ink/25" aria-hidden="true" />
            ) : (
              <Folder size={13} className="shrink-0 text-ink/25" aria-hidden="true" />
            )}
            <TruncateTooltip text={folder.name} className="flex-1 truncate leading-none" />
          </span>

          <ItemActions
            onMore={openMoreMenu}
            label={ctx.copy.contextMenu.moreOptions}
          />
        </div>
      )}

      {(isOpen || isAnyCreatingHere) && (
        <div role="group" className="relative">
          {(hasChildren || isAnyCreatingHere) && (
            <div
              className="absolute bottom-1 top-0 w-px bg-ink/[0.05]"
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
