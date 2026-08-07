"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TOUCH_TARGET_Y } from "@/lib/constants/layout";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import type { FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";

/* ── Tree helpers ──────────────────────────────────────────────────────────── */

interface TreeNode {
  folder: FolderRecord;
  children: TreeNode[];
}

function buildTree(folders: FolderRecord[], parentId: string | null = null): TreeNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((folder) => ({ folder, children: buildTree(folders, folder.id) }));
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

interface FolderSelectProps {
  value: string;                       // "" = root, folder id otherwise
  onChange: (value: string) => void;
  folders: FolderRecord[];
  rootLabel: string;
  copy: Dictionary["folderSelect"];
  /** CSS z-index for the portalled dropdown; raise it when used inside a dialog. */
  menuZIndex?: string;
  /** Below `lg`, stretch the trigger to fill its row (label left, chevron at the
   *  far edge) while keeping it visually slim — for touch footers where each
   *  control owns a row. Above `lg` the trigger stays intrinsically sized. */
  blockOnTouch?: boolean;
}

const INDENT = 16;

export function FolderSelect({
  value,
  onChange,
  folders,
  rootLabel,
  copy,
  menuZIndex = "var(--z-menu)",
  blockOnTouch = false,
}: FolderSelectProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tree = buildTree(folders);
  const visible = flatVisible(tree, expanded);
  const selectedFolder = folders.find((f) => f.id === value);
  const displayLabel = value === "" ? rootLabel : (selectedFolder?.name ?? rootLabel);

  /* Auto-expand path to selected folder when opening */
  useEffect(() => {
    if (!open || !value) return;
    // Intentional: expand the ancestor path each time the dropdown opens so the
    // selected folder is visible. Synchronize-on-open, not a derivable value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ancestorIds(value, folders)) next.add(id);
      return next;
    });
  }, [open, value, folders]);

  /* Position the dropdown below (or above) the trigger */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !dropdownRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const dr = dropdownRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const minW = Math.max(tr.width, 200);

    let left = tr.left;
    if (left + minW > vw - 8) left = Math.max(8, tr.right - minW);

    let top = tr.bottom + gap;
    if (top + dr.height > vh - 8) top = Math.max(8, tr.top - dr.height - gap);

    dropdownRef.current.style.left = `${left}px`;
    dropdownRef.current.style.top = `${top}px`;
    dropdownRef.current.style.minWidth = `${minW}px`;
  }, [open, visible.length]);

  /* Dismiss on outside click / Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    // Capture phase: a parent (e.g. the preferences dialog) may stopPropagation
    // on mousedown, which would otherwise hide this outside click from us.
    document.addEventListener("mousedown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside, true);
    };
  }, [open]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function select(val: string) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div className={blockOnTouch ? "relative max-lg:w-full" : "relative"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
          // Full width, but deliberately shorter than the primary action next to
          // it: the destination is secondary and shouldn't carry the same weight.
          // The phantom hit area keeps the finger's target at 44px regardless.
          // Radius and type size match the submit button — stacked at equal width
          // the two read as one pair, and a 6px/8px mismatch is visible there in
          // a way it never is across a spread-out desktop row.
          TOUCH_TARGET_Y,
          blockOnTouch ? "max-lg:h-8 max-lg:w-full max-lg:rounded-lg max-lg:px-3 max-lg:text-[13px]" : "",
          open
            ? "border-ink/20 bg-ink/[0.04] text-foreground"
            : "border-ink/[0.08] text-muted hover:border-ink/15 hover:text-foreground",
        ].join(" ")}
      >
        {/* `size` only sets the SVG's width/height attributes, so a utility class
            wins over it — that's what lets the glyph scale at the breakpoint
            instead of forcing a second, non-responsive prop value. It matches the
            14px `Plus` in the submit button it stacks under on touch. */}
        <Folder
          size={12}
          className={`shrink-0 text-ink/30 ${blockOnTouch ? "max-lg:size-[14px]" : ""}`}
        />
        <span
          className={[
            "truncate leading-none",
            blockOnTouch ? "max-lg:flex-1 max-lg:text-left lg:max-w-[160px]" : "max-w-[160px]",
          ].join(" ")}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={11}
          className={`shrink-0 text-ink/30 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="klipcode-menu-animate fixed overflow-hidden rounded-xl"
            style={{
              zIndex: menuZIndex,
              background: "var(--panel-bg)",
              border: "1px solid rgba(var(--ink-rgb),0.07)",
              boxShadow:
                "var(--panel-shadow)",
            }}
          >
            <div className="max-h-[280px] overflow-y-auto p-1">
              {/* Root option */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => select("")}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-left text-[13px] leading-none",
                  "transition-colors duration-75",
                  value === ""
                    ? "bg-ink/[0.08] text-ink"
                    : "text-ink/60 hover:bg-ink/[0.06] hover:text-ink/90",
                ].join(" ")}
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
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) toggleExpand(folder.id);
                      }}
                      className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-ink/20 hover:text-ink/50"
                    >
                      {hasChildren ? (
                        <ChevronRight
                          size={11}
                          className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        />
                      ) : (
                        <span className="inline-block h-px w-2 bg-ink/[0.08]" />
                      )}
                    </button>

                    {/* Folder select row */}
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => select(folder.id)}
                      className={[
                        "flex flex-1 min-w-0 items-center gap-2 rounded-lg px-2 py-[6px] text-left text-[13px] leading-none",
                        "transition-colors duration-75",
                        isSelected
                          ? "bg-ink/[0.08] text-ink"
                          : "text-ink/60 hover:bg-ink/[0.06] hover:text-ink/90",
                      ].join(" ")}
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
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
