"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ToastProps {
  /**
   * Bumped on every occurrence; each change re-triggers the toast, so repeating
   * the same action re-animates instead of sitting there silently. `0` means
   * "nothing has happened yet" and shows nothing.
   */
  nonce: number;
  message: string;
  /** Leading glyph. Rendered at 13px to match the label. */
  icon?: ReactNode;
  /** How long the toast stays up once shown. */
  durationMs?: number;
}

/**
 * The app's transient status pill: a brief, non-blocking confirmation centred
 * at the bottom of the viewport.
 *
 * Every toast in the app is this component — copy confirmations, formatting
 * failures, image upload errors — so they animate, stack and read identically
 * wherever they are triggered from. It portals to `document.body` so a `fixed`
 * toast still escapes any clipped or `contentEditable` container it happens to
 * be rendered inside (e.g. a TipTap NodeView).
 */
export function Toast({ nonce, message, icon, durationMs = 1800 }: ToastProps) {
  const [visibleNonce, setVisibleNonce] = useState<number | null>(null);

  useEffect(() => {
    if (nonce === 0) return;
    // The rendered nonce becomes hidden immediately when a newer one arrives;
    // the delay then gives React a frame at opacity zero before showing it.
    const show = setTimeout(() => setVisibleNonce(nonce), 10);
    const hide = setTimeout(() => setVisibleNonce(null), durationMs + 10);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [nonce, durationMs]);

  const visible = nonce !== 0 && visibleNonce === nonce;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 klipcode-z-toast -translate-x-1/2 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      {visible ? (
        <div className="flex items-center gap-1.5 rounded-full border border-ink/[0.08] bg-background/90 px-3 py-1.5 text-[12px] text-ink/80 backdrop-blur-sm">
          {icon}
          {message}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
