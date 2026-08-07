"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { LANGUAGES, type LanguageId } from "@/lib/constants/languages";
import { TOUCH_TARGET_Y } from "@/lib/constants/layout";
import { LanguageIcon } from "@/ui/LanguageIcon";
import type { Dictionary } from "@/i18n";

interface LanguageSelectProps {
  value: LanguageId;
  onChange: (value: LanguageId) => void;
  copy: Dictionary["languageSelect"];
  /** CSS z-index for the portalled dropdown; raise it when used inside a dialog. */
  menuZIndex?: string;
}

export function LanguageSelect({
  value,
  onChange,
  copy,
  menuZIndex = "var(--z-menu)",
}: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLang = LANGUAGES.find((l) => l.id === value);

  const sortedLanguages = [...LANGUAGES].sort((a, b) => a.label.localeCompare(b.label));

  const filtered = search.trim()
    ? sortedLanguages.filter(
        (l) =>
          l.label.toLowerCase().includes(search.toLowerCase()) ||
          l.extension.toLowerCase().includes(search.toLowerCase()),
      )
    : sortedLanguages;

  /* Position the dropdown */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !dropdownRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const dr = dropdownRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const minW = Math.max(tr.width, 220);

    let left = tr.left;
    if (left + minW > vw - 8) left = Math.max(8, tr.right - minW);

    let top = tr.bottom + gap;
    if (top + dr.height > vh - 8) top = Math.max(8, tr.top - dr.height - gap);

    dropdownRef.current.style.left = `${left}px`;
    dropdownRef.current.style.top = `${top}px`;
    dropdownRef.current.style.minWidth = `${minW}px`;
  }, [open]);

  /* Focus search on open */
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
    // Intentional: clear the filter when the dropdown closes so it reopens fresh.
    // Synchronize-on-close effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setSearch("");
  }, [open]);

  /* Dismiss on outside click or Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
          TOUCH_TARGET_Y,
          open
            ? "border-ink/20 bg-ink/[0.04] text-foreground"
            : "border-ink/[0.08] text-muted hover:border-ink/15 hover:text-foreground",
        ].join(" ")}
      >
        <LanguageIcon language={value} size={13} className="shrink-0" />
        <span className="leading-none">{selectedLang?.label ?? value}</span>
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
            {/* Search input */}
            <div className="border-b border-ink/[0.06] px-2 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-ink/[0.05] px-2.5 py-1.5">
                <Search size={12} className="shrink-0 text-ink/30" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full bg-transparent text-xs text-ink/70 placeholder:text-faint outline-none"
                />
              </div>
            </div>

            {/* Language list */}
            <div className="max-h-[240px] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-faint">{copy.noResults}</p>
              ) : (
                filtered.map((lang) => {
                  const isSelected = lang.id === value;
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        onChange(lang.id as LanguageId);
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] leading-none",
                        "transition-colors duration-75",
                        isSelected
                          ? "bg-ink/[0.08] text-ink"
                          : "text-ink/60 hover:bg-ink/[0.06] hover:text-ink/90",
                      ].join(" ")}
                    >
                      <LanguageIcon language={lang.id} size={14} className="shrink-0" />
                      <span className="flex-1">{lang.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-faint">
                        {lang.extension}
                      </span>
                      {isSelected && (
                        <Check size={12} className="shrink-0 text-ink/50" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
