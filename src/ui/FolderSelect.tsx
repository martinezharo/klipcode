"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
}

const INDENT = 16;

export function FolderSelect({ value, onChange, folders, rootLabel, copy }: FolderSelectProps) {
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
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function select(val: string) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
          open
            ? "border-white/20 bg-white/[0.04] text-foreground"
            : "border-white/[0.08] text-muted hover:border-white/15 hover:text-foreground",
        ].join(" ")}
      >
        <Folder size={12} className="shrink-0 text-white/30" />
        <span className="max-w-[160px] truncate leading-none">{displayLabel}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 text-white/30 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="klipcode-menu-animate fixed z-[999] overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(180deg, #181818 0%, #111111 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 56px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.5)",
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
                    ? "bg-white/[0.08] text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white/90",
                ].join(" ")}
              >
                <Folder size={12} className="shrink-0 opacity-50" />
                <span className="flex-1">{rootLabel}</span>
                {value === "" && <Check size={12} className="shrink-0 text-white/50" />}
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
                      className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-white/20 hover:text-white/50"
                    >
                      {hasChildren ? (
                        <ChevronRight
                          size={11}
                          className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        />
                      ) : (
                        <span className="inline-block h-px w-2 bg-white/[0.08]" />
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
                          ? "bg-white/[0.08] text-white"
                          : "text-white/60 hover:bg-white/[0.06] hover:text-white/90",
                      ].join(" ")}
                    >
                      {isExpanded && hasChildren ? (
                        <FolderOpen size={12} className="shrink-0 opacity-50" />
                      ) : (
                        <Folder size={12} className="shrink-0 opacity-50" />
                      )}
                      <span className="flex-1 truncate">{folder.name}</span>
                      {isSelected && <Check size={12} className="shrink-0 text-white/50" />}
                    </button>
                  </div>
                );
              })}

              {folders.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-white/25">{copy.noFolders}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
