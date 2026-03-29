import { useEffect, useState } from "react";

const MOBILE_BP = 1024;

export function useResponsiveSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

  return { sidebarOpen, setSidebarOpen, isMobile };
}
