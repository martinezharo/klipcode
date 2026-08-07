import type { DragEvent as ReactDragEvent } from "react";

import type { FolderRecord } from "@/lib/types";
import { suppressModifierDragStart } from "@/hooks/useMultiSelection";

export const STEP = 14;

/**
 * Width of the slot a row reserves where a folder's expand chevron sits, so
 * chevron-less rows (snippets, the inline new-folder input) line their icons up
 * with folder rows. It has to track the chevron's own responsive size — the
 * button is 16px for a pointer and a 44px touch target below `lg` — which is
 * why this is a spacer element rather than a magic number added to paddingLeft.
 */
export const ROW_LEAD_SPACER = "shrink-0 w-[13px] max-lg:w-8";

/**
 * The class list every tree row shares.
 *
 * Folder and snippet rows used to each carry their own near-identical copy of
 * this, which is how they drifted into a 26px height that no finger could hit
 * reliably. Rows are 48px on touch and stay compact for a pointer, and that
 * decision now lives here only.
 */
export function treeRowClass({
  isActive,
  isMultiSelected,
  isDragging = false,
  isDropTarget = false,
}: {
  isActive: boolean;
  isMultiSelected: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
}): string {
  return [
    "group relative mr-1 flex items-center gap-1.5 rounded-md pr-2 text-left transition-all duration-100",
    // Touch rows are 44px — the tap floor, and no taller. The text only steps
    // up one point; going further is what starts to look magnified.
    "max-lg:h-11 max-lg:text-[14px] lg:py-[5px] lg:text-[13px]",
    isActive
      ? "bg-ink/[0.08] text-foreground ring-1 ring-inset ring-ink/25"
      : isMultiSelected
        ? "bg-ink/[0.08] text-foreground"
        : "text-muted hover:bg-ink/[0.04] hover:text-foreground",
    isDragging ? "opacity-40" : "",
    isDropTarget ? "bg-ink/[0.07] text-foreground ring-1 ring-inset ring-ink/[0.18]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Whether a row's dragstart should be cancelled: it began with a selection
 * modifier held (the click must reach the multi-selection), or on one of the
 * row's small `[data-no-drag]` controls (chevron / pin / "…"), where a
 * slightly-sloppy press must stay a click.
 */
export function suppressRowDragStart(e: ReactDragEvent): boolean {
  if (suppressModifierDragStart(e)) return true;
  if (e.target instanceof Element && e.target.closest("[data-no-drag]")) {
    e.preventDefault();
    return true;
  }
  return false;
}

export function sortByPinThenAlpha<T extends { isPinnedAside: boolean }>(
  items: T[],
  key: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
    return key(a).localeCompare(key(b));
  });
}

/** Returns true if `targetId` is `ancestorId` itself or a descendant of it. */
export function isDescendantOrSelf(
  folders: FolderRecord[],
  ancestorId: string,
  targetId: string,
): boolean {
  if (targetId === ancestorId) return true;
  let current = folders.find((f) => f.id === targetId);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = folders.find((f) => f.id === current!.parentId);
  }
  return false;
}
