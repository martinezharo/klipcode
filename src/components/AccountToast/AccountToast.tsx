"use client";

import { useEffect, useRef, useState } from "react";

interface AccountToastProps {
  message?: string;
}

export function AccountToast({ message }: AccountToastProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);

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
    <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
      {visibleMessage && (
        <div
          aria-live="polite"
          className={`pointer-events-auto max-w-xs rounded-md px-3 py-1 text-[11px] transition-opacity duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {visibleMessage}
        </div>
      )}
    </div>
  );
}
