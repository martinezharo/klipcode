/**
 * The swipe-between-tabs gesture: its maths, its painting, and the two classes
 * that let a stylesheet follow a finger.
 *
 * A horizontal drag across the mobile feed moves between Recent and My Space,
 * so the tabs stop being the only way in. Nothing here touches React state: a
 * gesture writes {@link TAB_PROGRESS_VAR} and {@link TAB_SHIFT_VAR} straight to
 * the DOM on every pointer move — exactly as the aside's resize handle writes
 * its width — because routing 60 updates a second through a render would
 * re-render every card in the feed to move a 200px pill.
 *
 * The custom properties are inherited, so the switcher and the list read the
 * same two numbers from a shared ancestor without either knowing about the
 * other. React owns their resting values; a gesture only borrows them, and
 * writes the settled value back itself when the finger lifts.
 */

/** How far a finger must travel before the gesture commits to an axis. Below
 *  this nothing moves, so a tap on a card is never a 3px swipe. */
export const SWIPE_AXIS_SLOP = 12;

/** Fraction of the panel's width that reads as a deliberate drag. */
export const SWIPE_COMMIT_RATIO = 0.28;

/** px/ms above which a flick commits however short it was. Without it, a fast
 *  confident swipe that only crosses a third of the screen would spring back. */
export const SWIPE_COMMIT_VELOCITY = 0.4;

/** The list follows the finger at this fraction of its travel. Deliberately
 *  small: the list is not a carousel — there is no second page sliding in
 *  behind it — so it acknowledges the gesture rather than pretending to be
 *  dragged by it. */
const CONTENT_TRAVEL = 0.18;

/** And at this fraction of that once there is no further tab to reveal, which
 *  is what makes the first and last tab feel like ends rather than dead pixels. */
const EDGE_RESISTANCE = 0.35;

/** Hard cap on the list's follow, in px. */
const MAX_CONTENT_SHIFT = 56;

/** Position between the tabs, as a fractional index (0 = first, 1 = second). */
export const TAB_PROGRESS_VAR = "--tab-progress";

/** How far the list itself has given way to the finger, in px. */
export const TAB_SHIFT_VAR = "--tab-shift";

/** Marks the ancestor that owns the two custom properties. Anything animating
 *  off them pairs it with {@link SWIPE_TRANSITION}. */
export const SWIPE_GROUP = "group/swipe";

/**
 * The spring every swipe-driven element settles with — and, crucially, does
 * *not* animate with while a finger is down: a 420ms ease between the finger
 * and the pill would leave the pill trailing the gesture that is supposed to be
 * moving it.
 *
 * Tailwind v4 compiles translate utilities to the `translate` property, not to
 * `transform`, so that is what is transitioned here.
 */
export const SWIPE_TRANSITION =
  "transition-[translate] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] " +
  "group-data-[swiping]/swipe:transition-none motion-reduce:transition-none";

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
 * Where the switcher's pill sits mid-gesture, as a fractional tab index.
 *
 * Dragging left (negative `dx`) pulls the next tab in, so progress rises. It
 * never leaves the range of real tabs — the pill has nowhere to go past the
 * ends, and {@link contentShift} is what expresses the overshoot instead.
 */
export function tabProgress(index: number, dx: number, width: number, count: number): number {
  if (!(width > 0) || count < 2) return index;
  return clamp(index - dx / width, 0, count - 1);
}

/** How far the list gives way to the finger, in px, damped past the ends. */
export function contentShift(index: number, dx: number, width: number, count: number): number {
  if (!(width > 0) || count < 2) return 0;
  // The part of the drag that maps onto a tab that actually exists...
  const travelled = (index - tabProgress(index, dx, width, count)) * width;
  // ...and the part pulling against an end.
  const overflow = dx - travelled;
  const shift = (travelled + overflow * EDGE_RESISTANCE) * CONTENT_TRAVEL;
  return clamp(shift, -MAX_CONTENT_SHIFT, MAX_CONTENT_SHIFT);
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
export function applyTabSwipe(el: HTMLElement | null, progress: number, shift: number): void {
  if (!el) return;
  el.style.setProperty(TAB_PROGRESS_VAR, String(progress));
  el.style.setProperty(TAB_SHIFT_VAR, `${shift}px`);
}

/** Suspends the settle animation for as long as the finger is driving it. */
export function setTabSwiping(el: HTMLElement | null, swiping: boolean): void {
  if (!el) return;
  if (swiping) el.dataset.swiping = "true";
  else delete el.dataset.swiping;
}
