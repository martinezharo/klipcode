"use client";

import { useMemo } from "react";

import type { Dictionary } from "@/i18n";
import type { SnippetRecord } from "@/lib/types";
import { getSnippetDisplayName } from "@/lib/utils";
import { LanguageIcon } from "@/ui/LanguageIcon";

/** How many cards the strip holds before it stops being a shortcut. */
const MAX_CARDS = 12;

/**
 * Orders the strip: everything pinned to home first (most recently touched
 * first), then the rest by recency. Pinned entries are not repeated further
 * down, so the strip never shows the same snippet twice.
 */
export function orderStripSnippets(snippets: SnippetRecord[]): SnippetRecord[] {
  const byRecency = (a: SnippetRecord, b: SnippetRecord) =>
    b.updatedAt.localeCompare(a.updatedAt);
  const pinned = snippets.filter((s) => s.isPinnedHome).sort(byRecency);
  const rest = snippets.filter((s) => !s.isPinnedHome).sort(byRecency);
  return [...pinned, ...rest].slice(0, MAX_CARDS);
}

/**
 * Pinned + recently edited snippets as one horizontally scrolling row.
 *
 * Horizontal on purpose: a vertical strip would fight the page's own vertical
 * scroll for every gesture, and its height would grow with the number of items.
 * This way the strip costs a fixed slice of the screen no matter how many
 * snippets exist, which is what keeps the tree reachable without scrolling.
 */
export function RecentsStrip({
  snippets,
  copy,
  onSelectSnippet,
}: {
  snippets: SnippetRecord[];
  copy: Dictionary;
  onSelectSnippet: (id: string) => void;
}) {
  const cards = useMemo(() => orderStripSnippets(snippets), [snippets]);

  if (cards.length === 0) return null;

  return (
    <section aria-label={copy.mobileHome.recents} className="shrink-0">
      <h2 className="sr-only">{copy.mobileHome.recents}</h2>
      <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-3">
        {cards.map((snippet) => (
          <li key={snippet.id} className="snap-start">
            <button
              type="button"
              onClick={() => onSelectSnippet(snippet.id)}
              className="relative flex h-[104px] w-[132px] flex-col justify-between overflow-hidden rounded-xl border border-ink/8 bg-ink/[0.02] p-2.5 text-left transition-colors active:bg-ink/[0.06]"
            >
              {snippet.isPinnedHome && (
                <>
                  {/* Same leading accent the tree uses for pinned rows, so the
                      two surfaces read as one vocabulary. */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2.5 h-5 w-[2px] rounded-full bg-ink/30"
                  />
                  <span className="sr-only">{copy.aside.pinned}</span>
                </>
              )}
              <LanguageIcon language={snippet.language} size={18} className="text-ink/30" />
              <span className="truncate text-[12px] font-medium text-foreground">
                {getSnippetDisplayName(
                  snippet.title,
                  snippet.language,
                  copy.snippetCard.untitled,
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
