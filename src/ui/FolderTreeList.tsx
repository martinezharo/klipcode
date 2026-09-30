"use client";

import { useState } from "react";
import { Check, ChevronRight, Folder, FolderOpen } from "lucide-react";

import type { Dictionary } from "@/i18n";
import type { FolderRecord } from "@/lib/types";

/* ── Tree helpers ──────────────────────────────────────────────────────────── */

interface TreeNode {
  folder: FolderRecord;
  children: TreeNode[];
}

function buildTree(folders: FolderRecord[]): TreeNode[] {
  const byParent = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentId, siblings);
  }

  function build(currentParentId: string | null): TreeNode[] {
    return (byParent.get(currentParentId) ?? []).map((folder) => ({
      folder,
      children: build(folder.id),
    }));
  }

  return build(null);
}

/** DFS: return nodes in display order, skipping collapsed subtrees */
function flatVisible(nodes: TreeNode[], expanded: Set<string>): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = [];
  function walk(list: TreeNode[], depth: number) {
    for (const node of list) {
      result.push({ node, depth });
      if (expanded.has(node.folder.id) && node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(nodes, 0);
  return result;
}

/** Return ancestor IDs of a given folder (excluding itself) */
function ancestorIds(targetId: string, folders: FolderRecord[]): Set<string> {
  const ids = new Set<string>();
  let current = folders.find((f) => f.id === targetId);
  while (current?.parentId) {
    ids.add(current.parentId);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return ids;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

const INDENT = 16;

interface FolderTreeListProps {
  folders: FolderRecord[];
  /** "" = root, a folder id otherwise, undefined = nothing is marked current. */
  value: string | undefined;
  onSelect: (value: string) => void;
  rootLabel: string;
  copy: Dictionary["folderSelect"];
  /** Folders that can't be picked (e.g. a folder being moved into itself). */
  isDisabled?: (folderId: string) => boolean;
}

/**
 * A pickable folder tree: a root entry, then every folder with collapsible
 * children. Shared by every "choose a destination" surface — the
 * {@link FolderSelect} dropdown and the "Move to…" dialog — so expanding,
 * marking the current folder and the touch sizing only exist once.
 *
 * Mount it when it opens: the path to `value` starts expanded, so the current
 * folder is always in view.
 */
export function FolderTreeList({
  folders,
  value,
  onSelect,
  rootLabel,
  copy,
  isDisabled,
}: FolderTreeListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    value ? ancestorIds(value, folders) : new Set(),
  );

  const visible = flatVisible(buildTree(folders), expanded);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Rows grow below `lg`: on touch the list is picked with a finger, not a cursor.
  const rowClass = (isSelected: boolean) =>
    [
      "flex min-w-0 items-center gap-2 rounded-lg text-left text-[13px] leading-none",
      "transition-colors duration-75 max-lg:py-3",
      "disabled:pointer-events-none disabled:opacity-30",
      isSelected
        ? "bg-ink/[0.08] text-ink"
        : "text-ink/60 hover:bg-ink/[0.06] hover:text-ink/90 active:bg-ink/[0.06]",
    ].join(" ");

  return (
    <>
      {/* Root option */}
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => onSelect("")}
        className={`${rowClass(value === "")} w-full px-2.5 py-[7px]`}
      >
        <Folder size={12} className="shrink-0 opacity-50" />
        <span className="flex-1">{rootLabel}</span>
        {value === "" && <Check size={12} className="shrink-0 text-ink/50" />}
      </button>

      {/* Folder tree */}
      {visible.map(({ node, depth }) => {
        const { folder, children } = node;
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(folder.id);
        const isSelected = folder.id === value;

        return (
          <div
            key={folder.id}
            className="flex items-center"
            style={{ paddingLeft: `${depth * INDENT}px` }}
          >
            {/* Expand/collapse chevron */}
            {hasChildren ? (
              <button
                type="button"
                aria-label={isExpanded ? copy.collapseFolder : copy.expandFolder}
                aria-expanded={isExpanded}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(folder.id);
                }}
                className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-ink/20 hover:text-ink/50 max-lg:h-10 max-lg:w-8"
              >
                <ChevronRight
                  size={11}
                  className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="flex h-7 w-5 shrink-0 items-center justify-center max-lg:h-10 max-lg:w-8"
              >
                <span className="inline-block h-px w-2 bg-ink/[0.08]" />
              </span>
            )}

            {/* Folder select row */}
            <button
              type="button"
              disabled={isDisabled?.(folder.id)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(folder.id)}
              className={`${rowClass(isSelected)} flex-1 px-2 py-[6px]`}
            >
              {isExpanded && hasChildren ? (
                <FolderOpen size={12} className="shrink-0 opacity-50" />
              ) : (
                <Folder size={12} className="shrink-0 opacity-50" />
              )}
              <span className="flex-1 truncate">{folder.name}</span>
              {isSelected && <Check size={12} className="shrink-0 text-ink/50" />}
            </button>
          </div>
        );
      })}

      {folders.length === 0 && (
        <p className="px-2.5 py-2 text-xs text-faint">{copy.noFolders}</p>
      )}
    </>
  );
}
