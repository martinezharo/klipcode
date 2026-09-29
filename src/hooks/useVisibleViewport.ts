import { useSyncExternalStore } from "react";

interface VisibleViewport {
  /** Height of the part of the screen the user can actually see. */
  height: number;
  /** How far the visible part has scrolled down inside the layout viewport. */
  offsetTop: number;
}

const SERVER_SNAPSHOT: VisibleViewport = { height: 0, offsetTop: 0 };

// useSyncExternalStore compares snapshots by identity, so an unchanged viewport
// must hand back the same object or every render would loop.
let cached: VisibleViewport = SERVER_SNAPSHOT;

function getSnapshot(): VisibleViewport {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height ?? window.innerHeight);
  const offsetTop = Math.round(viewport?.offsetTop ?? 0);
  if (height !== cached.height || offsetTop !== cached.offsetTop) {
    cached = { height, offsetTop };
  }
  return cached;
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  // iOS scrolls the visual viewport when it brings a focused field into view.
  viewport?.addEventListener("scroll", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    viewport?.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * The part of the screen the user can actually see. On mobile the on-screen
 * keyboard shrinks the visual viewport but not the layout viewport, so a `fixed`
 * panel anchored to the layout viewport would sit behind the keyboard. Sizing it
 * from `height` and shifting it by `offsetTop` keeps it inside what is visible.
 * `height` is 0 before the first client render.
 */
export function useVisibleViewport(): VisibleViewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
