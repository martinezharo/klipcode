import { useEffect, useState } from "react";

import { useIsTouchLayout } from "./useIsTouchLayout";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsTouchLayout();

  useEffect(() => {
    // Coming back to a wide viewport restores the aside; on touch it is not
    // rendered at all, so the flag just parks in a known state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return { sidebarOpen, setSidebarOpen, isMobile };
}
