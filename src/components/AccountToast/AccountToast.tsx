"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface AccountToastProps {
  message?: string;
  /**
   * Position override. The default bottom-left corner is free on the desktop
   * canvas but not on the mobile home, where the create button owns that edge.
   */
  className?: string;
}

export function AccountToast({ message, className }: AccountToastProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);

      // Intentional: mirror the incoming message into state so the toast keeps
      // rendering the previous text through its 300ms exit fade after `message`
      // clears. This is a synchronize-on-change effect, not a derivable value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleMessage(message);
      setTimeout(() => setIsVisible(true), 10);

      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      removeTimerRef.current = setTimeout(() => {
        setVisibleMessage(null);
      }, 3300);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, [message]);

  return (
    // The live region is the always-mounted wrapper: screen readers only
    // announce changes inside a region that already existed, so putting
    // aria-live on the conditionally rendered bubble would announce nothing.
    <div
      role="status"
      aria-live="polite"
      className={cn("absolute bottom-4 left-4 z-50 pointer-events-none", className)}
    >
      {visibleMessage && (
        <div
          // Sits over the main canvas, so it needs its own surface + ink rather
          // than inheriting whatever is behind it (previously unreadable text).
          className={`pointer-events-auto max-w-xs rounded-md border border-ink/[0.08] bg-background/90 px-3 py-1 text-[11px] text-ink/80 backdrop-blur-sm transition-opacity duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {visibleMessage}
        </div>
      )}
    </div>
  );
}
