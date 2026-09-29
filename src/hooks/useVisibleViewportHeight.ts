import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    window.removeEventListener("resize", onChange);
  };
}

const getSnapshot = () => Math.round(window.visualViewport?.height ?? window.innerHeight);
const getServerSnapshot = () => 0;

/**
 * Height of the part of the screen the user can actually see. On mobile the
 * on-screen keyboard shrinks the visual viewport but not the layout viewport,
 * so a `fixed bottom-0` panel would sit behind the keyboard; sizing it from this
 * value keeps its footer above the keys.
 */
export function useVisibleViewportHeight(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
