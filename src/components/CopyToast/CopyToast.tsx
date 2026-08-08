"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface CopyToastProps {
  /** Bumped on every copy; each change re-triggers the toast (even repeats). */
  nonce: number;
  message: string;
}

/**
 * Brief "copied" confirmation shown when the user copies via a keyboard
 * shortcut (the click paths have their own inline check icons). Keyed off a
 * nonce so consecutive copies of the same content re-animate.
 */
export function CopyToast({ nonce, message }: CopyToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (nonce === 0) return;
    // Defer both toggles into timers so neither is a synchronous setState in
    // the effect body; the short show delay also restarts the fade on repeats.
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), 1810);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [nonce]);

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 klipcode-z-toast -translate-x-1/2 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-ink/[0.08] bg-background/90 px-3 py-1.5 text-[12px] text-ink/80 backdrop-blur-sm">
        <Check size={13} className="text-emerald-400" />
        {message}
      </div>
    </div>
  );
}
