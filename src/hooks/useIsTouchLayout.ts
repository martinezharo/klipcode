import { useEffect, useState } from "react";

import { MOBILE_MEDIA_QUERY } from "@/lib/constants/layout";

/**
 * Whether the viewport is on the touch layout (below `lg`).
 *
 * The single JS mirror of the `max-lg:` breakpoint — see `MOBILE_MEDIA_QUERY`,
 * which the CSS and this hook must never be allowed to disagree on. Starts
 * `false` so the server render and the first client render match, then settles
 * on the real value in an effect.
 */
export function useIsTouchLayout(): boolean {
  const [isTouchLayout, setIsTouchLayout] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouchLayout(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsTouchLayout(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isTouchLayout;
}
