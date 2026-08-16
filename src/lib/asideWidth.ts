import {
  DEFAULT_ASIDE_WIDTH,
  MAX_ASIDE_WIDTH,
  MIN_ASIDE_WIDTH,
} from "@/lib/constants/layout";
import { PREFERENCES_STORAGE_KEY } from "@/lib/preferences";

/**
 * The live width of the desktop aside, held as a CSS custom property on <html>
 * rather than in React state.
 *
 * The resize handle writes it on every pointer move, and routing that through a
 * render would re-render the whole workspace tree once per pixel. React only
 * learns the width when a drag ends, to persist it.
 *
 * The default lives in `globals.css` (`:root { --aside-w }`); a stored width
 * overrides it before first paint through {@link ASIDE_WIDTH_INIT_SCRIPT} — the
 * same trick the theme uses — so the panel never animates from the default to
 * the user's width on load. The bounds live in `constants/layout.ts`, shared
 * with the stored preference.
 */
export const ASIDE_WIDTH_VAR = "--aside-w";

/** The width currently painted, read back from the custom property. */
export function readAsideWidth(): number {
  if (typeof document === "undefined") return DEFAULT_ASIDE_WIDTH;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(ASIDE_WIDTH_VAR);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ASIDE_WIDTH;
}

/** Paints a width immediately, bypassing React. */
export function applyAsideWidth(width: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(ASIDE_WIDTH_VAR, `${width}px`);
}

/**
 * Marks a drag in progress on <html>. `globals.css` uses it to suspend the
 * panel's width transition — otherwise the edge trails 300ms behind the cursor —
 * and to hold the resize cursor while the pointer strays off the handle.
 */
export function setAsideResizing(resizing: boolean): void {
  if (typeof document === "undefined") return;
  if (resizing) document.documentElement.dataset.asideResizing = "true";
  else delete document.documentElement.dataset.asideResizing;
}

/** Applies the stored width before the body paints. Mirrors readPreferences()
 *  + clampAsideWidth(); a missing or malformed value leaves the CSS default. */
export const ASIDE_WIDTH_INIT_SCRIPT = `(function(){try{var r=localStorage.getItem(${JSON.stringify(
  PREFERENCES_STORAGE_KEY,
)});if(!r)return;var w=JSON.parse(r).asideWidth;if(typeof w!=="number"||!isFinite(w))return;w=Math.min(${MAX_ASIDE_WIDTH},Math.max(${MIN_ASIDE_WIDTH},Math.round(w)));document.documentElement.style.setProperty(${JSON.stringify(
  ASIDE_WIDTH_VAR,
)},w+"px");}catch(e){}})();`;
