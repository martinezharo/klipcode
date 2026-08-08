"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { Dictionary } from "@/i18n";

interface CreatedSnippetToastProps {
  /** Bumped each time a snippet is created via the modal; re-triggers the toast. */
  nonce: number;
  /** The id of the just-created snippet (captured at bump time). */
  snippetId: string | null;
  copy: Dictionary;
  onOpen: (snippetId: string) => void;
}

/**
 * Transient "Snippet created — open it?" bubble shown after creating a snippet
 * from the {@link CreateSnippetModal}. Dismisses automatically after 6s, or on
 * Esc / a click on the Open button. Mirrors the AccountToast two-timer pattern
 * so the popup keeps rendering through its exit fade after the parent clears the
 * payload.
 */
export function CreatedSnippetToast({ nonce, snippetId, copy, onOpen }: CreatedSnippetToastProps) {
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    setIsVisible(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    removeTimerRef.current = setTimeout(() => setVisibleId(null), 300);
  }

  useEffect(() => {
    if (nonce === 0 || !snippetId) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);

    // Mirror the incoming id into state so the toast keeps rendering through its
    // exit fade after the parent clears the payload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleId(snippetId);
    const show = setTimeout(() => setIsVisible(true), 10);
    hideTimerRef.current = setTimeout(() => setIsVisible(false), 6000);
    removeTimerRef.current = setTimeout(() => setVisibleId(null), 6300);

    return () => {
      clearTimeout(show);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, [nonce, snippetId]);

  useEffect(() => {
    if (!visibleId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [visibleId]);

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 klipcode-z-toast -translate-x-1/2 transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      {visibleId && (
        <div
          className="flex items-center gap-2 rounded-full border border-ink/[0.08] bg-background/90 px-3 py-1.5 text-[12px] text-ink/80 backdrop-blur-sm"
          style={{ boxShadow: "var(--popover-shadow)" }}
        >
          <Check size={13} className="text-emerald-400" />
          <span>{copy.forms.snippetCreated}</span>
          <button
            type="button"
            onClick={() => {
              onOpen(visibleId);
              dismiss();
            }}
            className="pointer-events-auto rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium text-ink/85 transition-colors hover:bg-ink/20"
          >
            {copy.forms.open}
          </button>
        </div>
      )}
    </div>
  );
}
