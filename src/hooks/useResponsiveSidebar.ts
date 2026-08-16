import { useCallback, useEffect, useRef, useState } from "react";

import { useIsTouchLayout } from "./useIsTouchLayout";

/**
 * Marks the two halves of the same control: the collapse button inside the
 * aside header, and the open button that takes its place in the top bar. Only
 * one of them is reachable at a time, so a collapse/expand has to hand focus
 * from one to the other.
 */
export type SidebarToggle = "collapse" | "open";

/**
 * Tracks whether we are on the touch layout, and whether the desktop aside is
 * open.
 *
 * The mobile drawer is gone: below `lg` the workspace tree is a destination
 * (see `MobileHome`) rather than a panel sliding over the canvas. That removed
 * the edge-swipe gesture recogniser this hook used to carry, along with its
 * non-passive `touchmove` listener that ran on every horizontal drag inside the
 * aside. `sidebarOpen` is now a desktop-only concern.
 *
 * The breakpoint itself lives in {@link useIsTouchLayout}, shared with anything
 * else that needs to branch on the layout in JS.
 */
export function useResponsiveSidebar() {
  const [sidebarOpen, setOpen] = useState(true);
  const isMobile = useIsTouchLayout();
  const pendingFocus = useRef<SidebarToggle | null>(null);

  useEffect(() => {
    // Coming back to a wide viewport restores the aside; on touch it is not
    // rendered at all, so the flag just parks in a known state. Deliberately
    // bypasses `setSidebarOpen`: a layout change is not a user gesture, and
    // must not steal focus.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!isMobile);
  }, [isMobile]);

  /** Opens or closes the aside in response to a user gesture, moving focus to
   *  whichever toggle survives the change. */
  const setSidebarOpen = useCallback((open: boolean) => {
    pendingFocus.current = open ? "collapse" : "open";
    setOpen(open);
  }, []);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    // A collapsed aside is inert, so the button the user just pressed may no
    // longer be focusable at all — without this hand-off, collapsing with the
    // keyboard (or ⌘B) drops focus back onto <body> and loses the user's place.
    document.querySelector<HTMLElement>(`[data-sidebar-toggle="${target}"]`)?.focus();
  }, [sidebarOpen]);

  return { sidebarOpen, setSidebarOpen, isMobile };
}
