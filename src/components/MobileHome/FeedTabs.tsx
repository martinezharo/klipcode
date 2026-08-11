"use client";

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
 */

/** Tailwind v4 compiles `translate-x-full` to the `translate` property, not to
 *  `transform` — transitioning the wrong one leaves the pill snapping. Kept as
 *  classes rather than an inline style so `motion-reduce` can still win. */
const SLIDE =
  "transition-[translate] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none";

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
  const shifted = active === tabs[1].id;

  return (
    <div
      role="tablist"
      className="relative h-11 overflow-hidden rounded-full bg-ink/[0.06]"
    >
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
          SLIDE,
          shifted && "translate-x-full",
        )}
      >
        <div
          className={cn(
            ROW,
            "absolute inset-y-0 left-0 w-[200%]",
            SLIDE,
            shifted && "-translate-x-1/2",
          )}
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
