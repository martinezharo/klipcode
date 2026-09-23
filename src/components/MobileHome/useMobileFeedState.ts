import { useCallback, useRef, useState } from "react";

import { SPACE_ROOT_ID } from "@/lib/navigation";
import type { FolderRecord } from "@/lib/types";

/** The two lists the home switches between, in the order they sit on the track:
 *  a swipe moves between neighbours and has to know which is which. */
export const FEED_TABS = ["recent", "space"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export interface MobileFeedState {
  tab: FeedTab;
  setTab: (tab: FeedTab) => void;
  expandedIds: ReadonlySet<string>;
  setFolderExpanded: (id: string, open: boolean) => void;
  /** A folder that was just revealed and still has to be scrolled to. */
  scrollTargetId: string | null;
  clearScrollTarget: () => void;
  /** Last scroll offset of each tab's list, to restore when the home remounts. */
  saveScroll: (tab: FeedTab, top: number) => void;
  savedScroll: (tab: FeedTab) => number;
}

/**
 * Where the user is on the mobile home, kept above it.
 *
 * The home unmounts whenever a snippet opens, so anything it held itself —
 * which tab, which folders were open, how far down the list — was gone by the
 * time the user came back. Now that folders are browsed by expanding them in
 * place rather than in a view of their own, losing that would mean digging
 * back down on every return.
 *
 * It also answers `?folder=` on touch. There is no folder view there: a link to
 * a folder (an editor breadcrumb, a deep link, "open in new tab") lands on the
 * structure tab with that folder and its ancestors expanded, and scrolls it
 * into view. `SPACE_ROOT_ID` just picks the structure tab.
 */
export function useMobileFeedState({
  revealFolderId,
  folders,
}: {
  /** The folder the URL points at on touch, or null. */
  revealFolderId: string | null;
  folders: readonly FolderRecord[];
}): MobileFeedState {
  const [tab, setTab] = useState<FeedTab>("recent");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const scrollTops = useRef<Record<FeedTab, number>>({ recent: 0, space: 0 });

  // Reveal once per arrival at a target, adjusting state during render rather
  // than in an effect so the home never paints collapsed first. A target the
  // workspace doesn't hold (yet) stays pending: the folders may still be loading.
  const [revealedId, setRevealedId] = useState<string | null>(null);
  if (revealFolderId !== revealedId) {
    if (revealFolderId === null) {
      setRevealedId(null);
    } else if (revealFolderId === SPACE_ROOT_ID) {
      setRevealedId(revealFolderId);
      setTab("space");
    } else {
      const byId = new Map(folders.map((f) => [f.id, f]));
      if (byId.has(revealFolderId)) {
        setRevealedId(revealFolderId);
        setTab("space");
        setScrollTargetId(revealFolderId);
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (let f = byId.get(revealFolderId); f; f = f.parentId ? byId.get(f.parentId) : undefined) {
            next.add(f.id);
          }
          return next;
        });
      }
    }
  }

  const setFolderExpanded = useCallback((id: string, open: boolean) => {
    setExpandedIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearScrollTarget = useCallback(() => setScrollTargetId(null), []);

  const saveScroll = useCallback((t: FeedTab, top: number) => {
    scrollTops.current[t] = top;
  }, []);
  const savedScroll = useCallback((t: FeedTab) => scrollTops.current[t], []);

  return {
    tab,
    setTab,
    expandedIds,
    setFolderExpanded,
    scrollTargetId,
    clearScrollTarget,
    saveScroll,
    savedScroll,
  };
}
