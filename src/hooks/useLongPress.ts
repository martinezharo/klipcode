"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

import { useLatestRef } from "./useLatestRef";

/** How long a finger has to rest on an element before it counts as a press. */
export const LONG_PRESS_MS = 450;
/** How far it may drift meanwhile — any further and it is a scroll or a swipe. */
const LONG_PRESS_SLOP = 10;
/** What a touch still sends after the press fired, all of it hit-tested. */
const SWALLOWED = ["contextmenu", "mousedown", "mouseup", "click"] as const;
/** How long after the finger lifts those can still arrive. */
const GUARD_LINGER_MS = 400;

/** Viewport coordinates a menu opened by the gesture should anchor at. */
export interface PressPoint {
  x: number;
  y: number;
}

interface PendingPress {
  pointerId: number;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * Opens a row's actions menu the way each input expects: pressing and holding
 * with a finger, and right-clicking (or the context-menu key) with a mouse.
 * Spread the returned handlers onto the element.
 *
 * Browsers don't agree on touch: Android fires `contextmenu` for a long press,
 * iOS Safari never does. So the hold is timed here, and a native `contextmenu`
 * that beats the timer just fires it early — whichever comes first opens the
 * menu, exactly once.
 *
 * Once the press has fired, the rest of that touch belongs to it, so every
 * mouse-flavoured event the platform still sends for it is swallowed: Android's
 * own `contextmenu` arriving just after our timer, iOS's emulated mousedown and
 * click on release. The menu's backdrop is under the finger by then, so any of
 * them would close the menu the moment it opened (or the click would open the
 * row). They are hit-tested and land on the backdrop, not the row — which is
 * why the guard sits on the window rather than on the element.
 */
export function useLongPress(
  onLongPress: (point: PressPoint) => void,
  { enabled = true }: { enabled?: boolean } = {},
): LongPressHandlers | Record<string, never> {
  const pending = useRef<PendingPress | null>(null);
  /** The current touch already opened the menu (it is only sliding off now). */
  const fired = useRef(false);
  const callback = useLatestRef(onLongPress);
  /** Lifts the window-level guard installed by a touch press. */
  const releaseGuard = useRef<(() => void) | null>(null);

  /** Swallow the rest of this touch's mouse events, until the next gesture. */
  function guardRestOfTouch() {
    releaseGuard.current?.();
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    let lingering: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      clearTimeout(lingering);
      for (const type of SWALLOWED) window.removeEventListener(type, swallow, true);
      window.removeEventListener("pointerdown", release, true);
      window.removeEventListener("touchend", releaseSoon, true);
      window.removeEventListener("touchcancel", releaseSoon, true);
      releaseGuard.current = null;
    };
    // iOS sends its emulated mouse events right after the finger lifts; past
    // that, a click is a real one — a keyboard or screen reader picking an item
    // needs no pointerdown to get through.
    const releaseSoon = () => {
      clearTimeout(lingering);
      lingering = setTimeout(release, GUARD_LINGER_MS);
    };
    for (const type of SWALLOWED) window.addEventListener(type, swallow, true);
    // A new gesture always starts with a pointerdown, and nothing this touch
    // sends comes after one.
    window.addEventListener("pointerdown", release, true);
    window.addEventListener("touchend", releaseSoon, true);
    window.addEventListener("touchcancel", releaseSoon, true);
    releaseGuard.current = release;
  }

  function clear() {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    pending.current = null;
  }

  /** Only a touch owns what follows it; a mouse or keyboard menu leaves the
   *  next click alone. */
  function fire(point: PressPoint, byTouch: boolean) {
    clear();
    fired.current = byTouch;
    if (byTouch) {
      guardRestOfTouch();
      navigator.vibrate?.(10);
    }
    callback.current(point);
  }

  // A row that unmounts mid-press (deleted by sync, say) must not fire later.
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer);
      releaseGuard.current?.();
    },
    [],
  );

  if (!enabled) return {};

  return {
    onPointerDown(e) {
      clear();
      fired.current = false;
      // A mouse has its own button for this; see onContextMenu.
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      const { pointerId, clientX: x, clientY: y } = e;
      pending.current = {
        pointerId,
        x,
        y,
        timer: setTimeout(() => fire({ x, y }, true), LONG_PRESS_MS),
      };
    },
    onPointerMove(e) {
      if (fired.current) {
        // Keep an ancestor's swipe gesture (the feed's tab swipe) from picking
        // up a finger that is only sliding off the row after the menu opened.
        e.stopPropagation();
        return;
      }
      const press = pending.current;
      if (!press || e.pointerId !== press.pointerId) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) clear();
    },
    // Scrolling cancels the pointer too (`touch-action: pan-y`), which is what
    // stops a slow scroll from ever counting as a hold.
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu(e) {
      e.preventDefault();
      e.stopPropagation();
      if (fired.current) return;
      if (pending.current) {
        // The platform's own long press beat our timer.
        fire({ x: pending.current.x, y: pending.current.y }, true);
        return;
      }
      // The context-menu key reports no position: anchor under the row instead.
      if (e.clientX === 0 && e.clientY === 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        fire({ x: rect.left, y: rect.bottom + 4 }, false);
        return;
      }
      fire({ x: e.clientX, y: e.clientY }, false);
    },
  };
}
