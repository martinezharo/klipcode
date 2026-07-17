import { useEffect, useRef, useState } from "react";

const MOBILE_BP = 1024;
const EDGE_SWIPE_WIDTH = 24;
const SWIPE_THRESHOLD = 64;
const DIRECTION_LOCK_THRESHOLD = 8;

export function useResponsiveSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarOpenRef = useRef(sidebarOpen);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) setSidebarOpen(false);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontalGesture = false;

    const reset = () => {
      tracking = false;
      horizontalGesture = false;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const target = event.target;
      const startsInsideSidebar =
        target instanceof Element && target.closest("aside") !== null;

      const canStart = sidebarOpenRef.current
        ? startsInsideSidebar
        : touch.clientX <= EDGE_SWIPE_WIDTH;

      if (!canStart) return;

      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      horizontalGesture = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!horizontalGesture) {
        if (
          Math.abs(deltaX) < DIRECTION_LOCK_THRESHOLD &&
          Math.abs(deltaY) < DIRECTION_LOCK_THRESHOLD
        ) {
          return;
        }

        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          reset();
          return;
        }

        horizontalGesture = true;
      }

      event.preventDefault();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!tracking || !horizontalGesture) {
        reset();
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;

      if (!sidebarOpenRef.current && deltaX >= SWIPE_THRESHOLD) {
        setSidebarOpen(true);
      } else if (sidebarOpenRef.current && deltaX <= -SWIPE_THRESHOLD) {
        setSidebarOpen(false);
      }

      reset();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, [isMobile]);

  return { sidebarOpen, setSidebarOpen, isMobile };
}
