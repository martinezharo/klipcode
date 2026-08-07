import { useEffect, useState } from "react";

import { MOBILE_MEDIA_QUERY } from "@/lib/constants/layout";

/**
 * Tracks whether we are on the touch layout, and whether the desktop aside is
 * open.
 *
 * The mobile drawer is gone: below `lg` the workspace tree is a destination
 * (see `MobileHome`) rather than a panel sliding over the canvas. That removed
 * the edge-swipe gesture recogniser this hook used to carry, along with its
 * non-passive `touchmove` listener that ran on every horizontal drag inside the
 * aside. `sidebarOpen` is now a desktop-only concern.
 */
export function useResponsiveSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      // Coming back to a wide viewport restores the aside; on touch it is not
      // rendered at all, so the flag just parks in a known state.
      setSidebarOpen(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { sidebarOpen, setSidebarOpen, isMobile };
}
