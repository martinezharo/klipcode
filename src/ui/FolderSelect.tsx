"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TOUCH_TARGET_Y } from "@/lib/constants/layout";
import { createPortal } from "react-dom";
import { ChevronDown, Folder } from "lucide-react";
import type { FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { FolderTreeList } from "./FolderTreeList";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedFolder = folders.find((f) => f.id === value);
  const displayLabel = value === "" ? rootLabel : (selectedFolder?.name ?? rootLabel);

  /* Position the dropdown below (or above) the trigger — again whenever it
     resizes, since expanding a folder can push it past the viewport's edge. */
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!open || !trigger || !dropdown) return;

    function position() {
      if (!trigger || !dropdown) return;
      const tr = trigger.getBoundingClientRect();
      const dr = dropdown.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 4;
      const minW = Math.max(tr.width, 200);

      let left = tr.left;
      if (left + minW > vw - 8) left = Math.max(8, tr.right - minW);

      let top = tr.bottom + gap;
      if (top + dr.height > vh - 8) top = Math.max(8, tr.top - dr.height - gap);

      dropdown.style.left = `${left}px`;
      dropdown.style.top = `${top}px`;
      dropdown.style.minWidth = `${minW}px`;
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(dropdown);
    return () => observer.disconnect();
  }, [open]);

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
              <FolderTreeList
                folders={folders}
                value={value}
                onSelect={select}
                rootLabel={rootLabel}
                copy={copy}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
