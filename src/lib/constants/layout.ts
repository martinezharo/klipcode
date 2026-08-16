/**
 * The single boundary between the touch layout and the pointer layout.
 *
 * IMPORTANT: this value must stay equal to Tailwind's `lg` breakpoint (1024px),
 * because the two are used together and cannot be allowed to drift:
 *
 *   - JS reads {@link MOBILE_BP} through `useResponsiveSidebar` to decide which
 *     shell to render (mobile home vs. desktop aside).
 *   - CSS uses `max-lg:` / `lg:` for the per-element touch sizing.
 *
 * They used to disagree — the row actions were gated on `md:` (768px) while the
 * shell switched at 1024px, so between 768px and 1023px the app rendered its
 * touch layout with hover-only controls that a finger could never reveal. Any
 * new responsive rule must use `lg`, never `md`.
 */
export const MOBILE_BP = 1024;

/** `(max-width: 1023px)` — the media query matching `max-lg:` exactly. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BP - 1}px)`;

/* ─── Desktop aside width ───────────────────────────────────────────────────
   The panel is user-resizable, so its width is a range rather than a constant.
   The bounds live here because three layers need to agree on them: the resize
   handle, the stored preference, and the pre-paint init script that applies a
   stored width before React mounts (see `src/lib/asideWidth.ts`). */

export const DEFAULT_ASIDE_WIDTH = 240;
export const MIN_ASIDE_WIDTH = 200;
export const MAX_ASIDE_WIDTH = 420;

/** Releasing the resize handle narrower than this collapses the panel instead
 *  of leaving it pinned at {@link MIN_ASIDE_WIDTH}. */
export const ASIDE_COLLAPSE_THRESHOLD = 150;

/** Constrains any width — dragged, stored or hand-edited — to the bounds. */
export function clampAsideWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_ASIDE_WIDTH;
  return Math.min(MAX_ASIDE_WIDTH, Math.max(MIN_ASIDE_WIDTH, Math.round(width)));
}

/**
 * Minimum touch target, in px. WCAG 2.2 SC 2.5.8 requires 24; Apple asks for 44
 * and Material for 48. We hold 44 as the floor for anything tappable.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * The visible box an icon control gets on touch. Deliberately much smaller than
 * {@link MIN_TOUCH_TARGET}: the two are separate concerns, and conflating them
 * is what makes a touch UI look like a zoomed-in desktop.
 */
export const TOUCH_VISUAL_BOX = 32;

/**
 * Gives a control a {@link MIN_TOUCH_TARGET}-square hit area *without* changing
 * how big it looks, by centring an invisible `::after` over it. The glyph and
 * its visible chrome stay compact; only the finger notices the difference.
 *
 * Growing the real box instead (`h-11 w-11`) is what pushed the layout apart
 * and read as "zoomed" — it forced every neighbour to move for a target only
 * the finger ever sees.
 *
 * Caveat: overlapping hit areas silently steal each other's taps, so adjacent
 * controls must sit at least {@link MIN_TOUCH_TARGET} apart centre-to-centre.
 * `WorkspaceTree`'s create pair spaces itself for exactly this reason.
 */
export const TOUCH_TARGET =
  "relative max-lg:after:absolute max-lg:after:left-1/2 max-lg:after:top-1/2 " +
  "max-lg:after:h-11 max-lg:after:w-11 max-lg:after:-translate-x-1/2 " +
  "max-lg:after:-translate-y-1/2 max-lg:after:content-['']";

/**
 * The same trick for controls that are already wide enough — pills, chips and
 * text buttons — where only the height falls short. Expands the hit area to 44px
 * vertically across the control's own width, so a 28px-tall chip stays 28px tall
 * to the eye.
 */
export const TOUCH_TARGET_Y =
  "relative max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:top-1/2 " +
  "max-lg:after:h-11 max-lg:after:-translate-y-1/2 max-lg:after:content-['']";
