"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { LANGUAGES, type LanguageId } from "@/lib/constants/languages";
import type { Dictionary } from "@/i18n";

/* Brand-aligned language colors */
const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  tsx:        "#3178c6",
  javascript: "#f0db4f",
  jsx:        "#61dafb",
  html:       "#e34c26",
  css:        "#563d7c",
  python:     "#3572a5",
  json:       "#8b9198",
  markdown:   "#083fa1",
  sql:        "#e38c00",
  bash:       "#4eaa25",
  go:         "#00add8",
  rust:       "#dea584",
  java:       "#b07219",
  cpp:        "#f34b7d",
  c:          "#a8a8a8",
  csharp:     "#178600",
  php:        "#787cb4",
  ruby:       "#701516",
  swift:      "#fa7343",
  kotlin:     "#a97bff",
  yaml:       "#cb171e",
  xml:        "#0060ac",
  plaintext:  "#858585",
};

interface LanguageSelectProps {
  value: LanguageId;
  onChange: (value: LanguageId) => void;
  copy: Dictionary["languageSelect"];
}

export function LanguageSelect({ value, onChange, copy }: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLang = LANGUAGES.find((l) => l.id === value);

  const filtered = search.trim()
    ? LANGUAGES.filter(
        (l) =>
          l.label.toLowerCase().includes(search.toLowerCase()) ||
          l.extension.toLowerCase().includes(search.toLowerCase()),
      )
    : LANGUAGES;

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
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside);
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
          open
            ? "border-white/20 bg-white/[0.04] text-foreground"
            : "border-white/[0.08] text-muted hover:border-white/15 hover:text-foreground",
        ].join(" ")}
      >
        {/* Color dot */}
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: LANG_COLORS[value] ?? "#858585" }}
        />
        <span className="leading-none">{selectedLang?.label ?? value}</span>
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
            {/* Search input */}
            <div className="border-b border-white/[0.06] px-2 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5">
                <Search size={12} className="shrink-0 text-white/30" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full bg-transparent text-xs text-white/70 placeholder:text-white/25 outline-none"
                />
              </div>
            </div>

            {/* Language list */}
            <div className="max-h-[240px] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-white/25">{copy.noResults}</p>
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
                          ? "bg-white/[0.08] text-white"
                          : "text-white/60 hover:bg-white/[0.06] hover:text-white/90",
                      ].join(" ")}
                    >
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ backgroundColor: LANG_COLORS[lang.id] ?? "#858585" }}
                      />
                      <span className="flex-1">{lang.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-white/25">
                        {lang.extension}
                      </span>
                      {isSelected && (
                        <Check size={12} className="shrink-0 text-white/50" />
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
