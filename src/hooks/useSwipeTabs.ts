"use client";

import { useRef, type CSSProperties, type MouseEvent, type PointerEvent, type Ref } from "react";

import {
  applyTabSwipe,
  detectSwipeAxis,
  overscrollShift,
  resolveSwipe,
  setTabSwiping,
  TAB_OVERSCROLL_VAR,
  TAB_PROGRESS_VAR,
  tabProgress,
  type SwipeAxis,
} from "@/lib/tabSwipe";

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  /** Width of the swipe surface, measured once so a resize mid-drag can't
   *  make the pill jump. */
  width: number;
  /** `null` until the finger has moved far enough to commit to one. */
  axis: SwipeAxis | null;
}

export interface SwipeTabs {
  /** For the ancestor both the switcher and the panels live under: it carries
   *  the custom properties they animate off. */
  containerProps: { ref: Ref<HTMLElement | null>; style: CSSProperties };
  /** For the row that holds every panel side by side, inside a clipping
   *  viewport: it is what actually slides. */
  trackProps: { style: CSSProperties };
  /** For the element the finger actually lands on. */
  surfaceProps: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClickCapture: (e: MouseEvent<HTMLElement>) => void;
  };
}

/**
 * Makes a horizontal drag across a surface move between tabs.
 *
 * Tapping a tab and swiping the panel are the same movement here: both end up
 * as a fractional position in {@link TAB_PROGRESS_VAR}, so the switcher only
 * has one animation to get right and it cannot drift between the two ways of
 * asking for it. React renders the resting position; the gesture writes the
 * in-between values directly to the DOM and hands control back by writing the
 * settled one when the finger lifts.
 *
 * Vertical drags are left entirely alone — each panel keeps `touch-action:
 * pan-y`, so the browser scrolls the list natively and cancels the pointer,
 * rather than us re-implementing momentum scrolling on the main thread.
 */
export function useSwipeTabs<T extends string>({
  ids,
  active,
  onSelect,
}: {
  ids: readonly T[];
  active: T;
  onSelect: (id: T) => void;
}): SwipeTabs {
  const containerRef = useRef<HTMLElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  /** A drag that ends on a card would otherwise open it — the browser still
   *  fires a click for the pointer that started there. */
  const swallowClick = useRef(false);

  const index = Math.max(0, ids.indexOf(active));

  function paint(dx: number, width: number) {
    applyTabSwipe(
      containerRef.current,
      tabProgress(index, dx, width, ids.length),
      overscrollShift(index, dx, width, ids.length),
    );
  }

  function settle(next: number) {
    setTabSwiping(containerRef.current, false);
    applyTabSwipe(containerRef.current, next, 0);
    if (next !== index) onSelect(ids[next]);
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    swallowClick.current = false;
    if (!e.isPrimary || ids.length < 2 || gesture.current) return;
    // Text fields own their own horizontal drags (caret placement, selection).
    if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) {
      return;
    }
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startedAt: e.timeStamp,
      width: e.currentTarget.getBoundingClientRect().width,
      axis: null,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;

    const dx = e.clientX - g.startX;
    if (!g.axis) {
      const axis = detectSwipeAxis(dx, e.clientY - g.startY);
      if (!axis) return;
      if (axis === "vertical") {
        // The list is scrolling. Bow out for the rest of this gesture instead
        // of fighting the browser for the same finger.
        gesture.current = null;
        return;
      }
      g.axis = "horizontal";
      swallowClick.current = true;
      setTabSwiping(containerRef.current, true);
      // Capture keeps the gesture alive when the finger leaves the panel —
      // over the tab strip, or off the edge of the screen.
      e.currentTarget.setPointerCapture(g.pointerId);
    }

    paint(dx, g.width);
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gesture.current = null;
    // Nothing was painted for a tap or a scroll, so there is nothing to settle.
    if (g.axis !== "horizontal") return;
    settle(resolveSwipe(index, e.clientX - g.startX, e.timeStamp - g.startedAt, g.width, ids.length));
  }

  function onPointerCancel(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gesture.current = null;
    if (g.axis !== "horizontal") return;
    settle(index);
  }

  function onClickCapture(e: MouseEvent<HTMLElement>) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    containerProps: {
      ref: containerRef,
      // React owns the resting position: a tab pressed with the keyboard or a
      // finger animates through the very same property a swipe drives.
      style: { [TAB_PROGRESS_VAR]: index, [TAB_OVERSCROLL_VAR]: "0px" } as CSSProperties,
    },
    trackProps: {
      // One panel width per whole tab, so the track's offset *is* the gesture:
      // halfway through, each panel is half on screen.
      style: {
        translate: `calc(var(${TAB_PROGRESS_VAR}, 0) * -100% + var(${TAB_OVERSCROLL_VAR}, 0px))`,
      },
    },
    surfaceProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
