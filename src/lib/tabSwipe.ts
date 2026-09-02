/**
 * The swipe-between-tabs gesture: its maths, its painting, and the two classes
 * that let a stylesheet follow a finger.
 *
 * A horizontal drag across the mobile feed moves between Recent and My Space,
 * so the tabs stop being the only way in. Nothing here touches React state: a
 * gesture writes {@link TAB_PROGRESS_VAR} and {@link TAB_OVERSCROLL_VAR}
 * straight to the DOM on every pointer move — exactly as the aside's resize
 * handle writes its width — because routing 60 updates a second through a
 * render would re-render every card in the feed to move a 200px pill.
 *
 * The custom properties are inherited, so the switcher and the panel track read
 * the same two numbers from a shared ancestor without either knowing about the
 * other. React owns their resting values; a gesture only borrows them, and
 * writes the settled value back itself when the finger lifts.
 *
 * Both tabs are mounted side by side on one track, so a swipe — or a tap on the
 * switcher — slides one panel out while the other slides in, at the same pace
 * and over the same 420ms as the pill above them.
 */

/** How far a finger must travel before the gesture commits to an axis. Below
 *  this nothing moves, so a tap on a card is never a 3px swipe. */
export const SWIPE_AXIS_SLOP = 12;

/** Fraction of the panel's width that reads as a deliberate drag. */
export const SWIPE_COMMIT_RATIO = 0.28;

/** px/ms above which a flick commits however short it was. Without it, a fast
 *  confident swipe that only crosses a third of the screen would spring back. */
export const SWIPE_COMMIT_VELOCITY = 0.4;

/** Fraction of a drag that still moves the track once there is no further tab
 *  to reveal, which is what makes the first and last tab feel like ends rather
 *  than dead pixels. */
const EDGE_RESISTANCE = 0.35;

/** Hard cap on that rubber band, in px. */
const MAX_OVERSCROLL = 56;

/** Position between the tabs, as a fractional index (0 = first, 1 = second).
 *  The track sits at exactly `-progress` panel widths, so the panels follow the
 *  finger 1:1 and each is half on screen halfway through. */
export const TAB_PROGRESS_VAR = "--tab-progress";

/** How far the track has been pulled past an end, in px — zero everywhere
 *  inside the real range of tabs, where {@link TAB_PROGRESS_VAR} says it all. */
export const TAB_OVERSCROLL_VAR = "--tab-overscroll";

/** Marks the ancestor that owns the two custom properties. Anything animating
 *  off them pairs it with one of the transitions below. */
export const SWIPE_GROUP = "group/swipe";

/**
 * What every swipe-driven element has in common: it settles over 420ms, and —
 * crucially — does *not* animate while a finger is down, because a 420ms ease
 * between the finger and the pill would leave the pill trailing the gesture
 * that is supposed to be moving it.
 *
 * Tailwind v4 compiles translate utilities to the `translate` property, not to
 * `transform`, so that is what is transitioned here.
 */
const SWIPE_SETTLE =
  "transition-[translate] duration-[420ms] " +
  "group-data-[swiping]/swipe:transition-none motion-reduce:transition-none";

/** The switcher's spring. It overshoots slightly, which is what makes the pill
 *  feel thrown rather than driven. */
export const SWIPE_TRANSITION = SWIPE_SETTLE + " ease-[cubic-bezier(0.34,1.4,0.64,1)]";

/**
 * The panel track's settle: the same duration, so the panels and the pill
 * arrive together, but decelerating onto its mark without overshoot — a track
 * that sprang past its end would flash the background beyond the last panel.
 */
export const SWIPE_PAGE_TRANSITION = SWIPE_SETTLE + " ease-[cubic-bezier(0.32,0.72,0,1)]";

export type SwipeAxis = "horizontal" | "vertical";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Which way a gesture is going, or `null` while it is still too small to tell.
 *
 * The panel scrolls vertically, so the two axes cannot both be live: whichever
 * the finger commits to first owns the rest of the gesture. Ties go to the
 * scroll, which is the movement a list is expected to make.
 */
export function detectSwipeAxis(
  dx: number,
  dy: number,
  slop: number = SWIPE_AXIS_SLOP,
): SwipeAxis | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < slop) return null;
  return absX > absY ? "horizontal" : "vertical";
}

/**
 * Where the gesture sits mid-drag, as a fractional tab index — the switcher's
 * pill and the panel track both read it.
 *
 * Dragging left (negative `dx`) pulls the next tab in, so progress rises. It
 * never leaves the range of real tabs — there is no third panel to slide in —
 * and {@link overscrollShift} is what expresses the pull past an end instead.
 */
export function tabProgress(index: number, dx: number, width: number, count: number): number {
  if (!(width > 0) || count < 2) return index;
  return clamp(index - dx / width, 0, count - 1);
}

/** How far the track gives way to a finger pulling past the first or last tab,
 *  in px. Zero for any drag that has a panel to reveal. */
export function overscrollShift(index: number, dx: number, width: number, count: number): number {
  if (!(width > 0) || count < 2) return 0;
  // The drag that lands exactly on the first tab, and the one that lands on the
  // last: between them every pixel has a panel to show for itself.
  const toFirst = index * width;
  const toLast = (index - (count - 1)) * width;
  const overflow = dx - clamp(dx, toLast, toFirst);
  return clamp(overflow * EDGE_RESISTANCE, -MAX_OVERSCROLL, MAX_OVERSCROLL);
}

/**
 * The tab a released gesture lands on: the neighbour if the drag was long
 * enough or fast enough, otherwise the one it started from.
 */
export function resolveSwipe(
  index: number,
  dx: number,
  elapsedMs: number,
  width: number,
  count: number,
): number {
  if (count < 2) return index;
  const distance = Math.abs(dx);
  if (distance < SWIPE_AXIS_SLOP) return index;
  const velocity = elapsedMs > 0 ? distance / elapsedMs : Infinity;
  const far = width > 0 && distance >= width * SWIPE_COMMIT_RATIO;
  if (!far && velocity < SWIPE_COMMIT_VELOCITY) return index;
  return clamp(index + (dx < 0 ? 1 : -1), 0, count - 1);
}

/** Paints a position immediately, bypassing React. */
export function applyTabSwipe(el: HTMLElement | null, progress: number, overscroll: number): void {
  if (!el) return;
  el.style.setProperty(TAB_PROGRESS_VAR, String(progress));
  el.style.setProperty(TAB_OVERSCROLL_VAR, `${overscroll}px`);
}

/** Suspends the settle animation for as long as the finger is driving it. */
export function setTabSwiping(el: HTMLElement | null, swiping: boolean): void {
  if (!el) return;
  if (swiping) el.dataset.swiping = "true";
  else delete el.dataset.swiping;
}
