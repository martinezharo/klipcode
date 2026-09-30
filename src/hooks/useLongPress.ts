"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";

import { useLatestRef } from "./useLatestRef";

/** How long a finger has to rest on an element before it counts as a press. */
export const LONG_PRESS_MS = 450;
/** How far it may drift meanwhile — any further and it is a scroll or a swipe. */
const LONG_PRESS_SLOP = 10;

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
  onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  onClickCapture: (e: MouseEvent<HTMLElement>) => void;
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
 * Once the press has fired, the rest of that touch belongs to it: the click
 * that would open the row is swallowed, and so are the emulated mouse events
 * that would otherwise land on the menu's backdrop and close it on release.
 */
export function useLongPress(
  onLongPress: (point: PressPoint) => void,
  { enabled = true }: { enabled?: boolean } = {},
): LongPressHandlers | Record<string, never> {
  const pending = useRef<PendingPress | null>(null);
  /** The current touch already opened the menu. */
  const fired = useRef(false);
  const callback = useLatestRef(onLongPress);

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
    if (byTouch) navigator.vibrate?.(10);
    callback.current(point);
  }

  // A row that unmounts mid-press (deleted by sync, say) must not fire later.
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer);
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
    onTouchEnd(e) {
      if (fired.current) e.preventDefault();
    },
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
    onClickCapture(e) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
