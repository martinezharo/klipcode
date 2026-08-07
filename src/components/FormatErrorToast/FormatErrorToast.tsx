"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle } from "lucide-react";

interface FormatErrorToastProps {
  /** Bumped each time a format attempt fails; each change re-triggers the toast. */
  nonce: number;
  message: string;
}

/**
 * Brief error confirmation shown when code formatting fails (e.g. a syntax
 * error). Shared by the source editor's Format button and the Markdown
 * code-block menu so both surface failures identically. Mirrors CopyToast's
 * nonce-driven show/hide so consecutive failures re-animate.
 */
export function FormatErrorToast({ nonce, message }: FormatErrorToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (nonce === 0) return;
    // Defer both toggles into timers so neither is a synchronous setState in
    // the effect body; the short show delay also restarts the fade on repeats.
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), 2510);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [nonce]);

  // Portal to the body so the fixed toast escapes any contentEditable / clipped
  // container it may be rendered within (e.g. a TipTap code-block NodeView).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 klipcode-z-toast -translate-x-1/2 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-ink/[0.08] bg-background/90 px-3 py-1.5 text-[12px] text-ink/80 backdrop-blur-sm">
        <AlertCircle size={13} className="text-danger" aria-hidden="true" />
        {message}
      </div>
    </div>,
    document.body,
  );
}
