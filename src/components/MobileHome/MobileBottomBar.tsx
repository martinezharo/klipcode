"use client";

import { FilePlus, Search } from "lucide-react";

import type { Dictionary } from "@/i18n";

/**
 * The persistent bottom bar: search on the left, create on the right.
 *
 * These are the app's two highest-priority actions, and on the old layout both
 * sat at the very top of a drawer — the furthest point from a thumb — with the
 * create control as a 21px icon. Anchoring them here is the whole reason the
 * bar exists. It also clears the iOS home indicator via safe-area padding.
 */
export function MobileBottomBar({
  copy,
  onOpenSearch,
  onCreateSnippet,
}: {
  copy: Dictionary;
  onOpenSearch: () => void;
  onCreateSnippet: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-ink/6 bg-surface/95 px-3 pt-2.5 klipcode-safe-area-bottom backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-11 flex-1 items-center gap-2 rounded-full border border-ink/8 bg-ink/[0.03] px-4 text-left text-[14px] text-faint transition-colors active:bg-ink/[0.07]"
        >
          <Search size={17} className="shrink-0 text-ink/40" />
          {copy.aside.search}
        </button>
        <button
          type="button"
          onClick={onCreateSnippet}
          aria-label={copy.aside.addSnippet}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-surface transition-opacity active:opacity-80"
        >
          <FilePlus size={19} />
        </button>
      </div>
    </div>
  );
}
