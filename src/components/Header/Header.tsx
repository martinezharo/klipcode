"use client";

import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import type { Dictionary } from "@/i18n";
import { useEffect, useRef, useState } from "react";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

interface HeaderProps {
  user: User | null;
  authReady: boolean;
  supabaseConfigured: boolean;
  copy: Dictionary;
  onSignIn: () => void;
  onSignOut: () => void;
  accountMessage?: string;
}

export function Header({
  user,
  authReady,
  supabaseConfigured,
  copy,
  onSignIn,
  onSignOut,
  accountMessage,
}: HeaderProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When a new accountMessage arrives, show it and schedule auto-dismiss
    if (accountMessage) {
      // clear any existing timers
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
      }

      setVisibleMessage(accountMessage);
      // trigger visible state (for animation)
      // small tick to ensure transition runs even if same message repeats
      setTimeout(() => setIsVisible(true), 10);

      // hide after 3s
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      // remove from DOM after transition (300ms)
      removeTimerRef.current = setTimeout(() => {
        setVisibleMessage(null);
      }, 3300);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, [accountMessage]);

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
