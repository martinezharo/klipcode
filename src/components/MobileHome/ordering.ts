import type { SnippetRecord } from "@/lib/types";

/**
 * Order for the "Recent" tab: everything pinned to home first (most recently
 * touched within the group), then the rest by recency. Pinned entries are never
 * repeated further down, so no snippet appears twice in the feed.
 *
 * Pinning to home is the user's explicit "keep this reachable" signal, so it
 * outranks recency — the same rule the desktop home page applies with its
 * separate "Pinned to home" section. The mobile feed is one list, so the pin
 * becomes an ordering rule plus a glyph on the row instead of a second section.
 */
export function orderRecentSnippets(snippets: SnippetRecord[]): SnippetRecord[] {
  const byRecency = (a: SnippetRecord, b: SnippetRecord) =>
    b.updatedAt.localeCompare(a.updatedAt);
  const pinned = snippets.filter((s) => s.isPinnedHome).sort(byRecency);
  const rest = snippets.filter((s) => !s.isPinnedHome).sort(byRecency);
  return [...pinned, ...rest];
}
