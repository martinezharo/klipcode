"use client";

import { SWIPE_TRANSITION, TAB_PROGRESS_VAR } from "@/lib/tabSwipe";
import { cn } from "@/lib/utils";

/**
 * The feed's Recent / My Space switch.
 *
 * The pill is solid ink and the label under it is punched out in the background
 * colour, so a word inverts as the pill sweeps across it rather than merely
 * brightening. That means the row is painted three times over — resting labels,
 * the pill's own copy, and the buttons — and all three have to lay out
 * identically or the mask edge tears mid-slide, which is what `ROW` and `CELL`
 * are for.
 *
 * Only the two tabs exist, so the geometry is known at author time: each
 * segment is exactly half, the pill moves by its own width, and its inner copy
 * counter-slides by half of its own doubled width. No refs, no measuring, no
 * resize observer.
 *
 * The pill's position is not read from `active` but from {@link
 * TAB_PROGRESS_VAR}, inherited from the ancestor `useSwipeTabs` writes to. A
 * press moves that property between whole numbers and the transition below
 * animates the gap; a swipe moves it continuously and suspends the transition.
 * One pill, one animation, two ways to ask for it.
 */

/** The three stacked copies of the row must agree on their columns exactly. */
const ROW = "flex h-11 items-center";
const CELL = "flex-1 truncate px-3 text-center text-[13.5px] font-medium";

export interface FeedTabDef<T extends string> {
  id: T;
  /** Used for the button's `id`, which the tab panel points at. */
  domId: string;
  label: string;
}

export function FeedTabs<T extends string>({
  tabs,
  active,
  panelId,
  onSelect,
}: {
  /** Exactly two — the layout maths below assumes halves. */
  tabs: readonly [FeedTabDef<T>, FeedTabDef<T>];
  active: T;
  panelId: string;
  onSelect: (id: T) => void;
}) {
  return (
    <div role="tablist" className="relative h-11 overflow-hidden rounded-full bg-ink/[0.06]">
      <div aria-hidden="true" className={cn(ROW, "absolute inset-0")}>
        {tabs.map((t) => (
          <span key={t.id} className={cn(CELL, "text-faint")}>
            {t.label}
          </span>
        ))}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1/2 overflow-hidden rounded-full bg-ink",
          SWIPE_TRANSITION,
        )}
        style={{ translate: `calc(var(${TAB_PROGRESS_VAR}, 0) * 100%)` }}
      >
        <div
          className={cn(ROW, "absolute inset-y-0 left-0 w-[200%]", SWIPE_TRANSITION)}
          style={{ translate: `calc(var(${TAB_PROGRESS_VAR}, 0) * -50%)` }}
        >
          {tabs.map((t) => (
            <span key={t.id} className={cn(CELL, "text-background")}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* The real controls, transparent on top of both painted layers — the
          label stays as their accessible name. */}
      <div className={cn(ROW, "absolute inset-0")}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            id={t.domId}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={panelId}
            onClick={() => onSelect(t.id)}
            className={cn(CELL, "h-full rounded-full text-transparent")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
