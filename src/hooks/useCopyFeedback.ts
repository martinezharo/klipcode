"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { COPY_FEEDBACK_MS } from "@/lib/constants/timing";
import { copyTextToClipboard } from "@/lib/utils";

/**
 * Copy to the clipboard and hold a "copied" flag for {@link COPY_FEEDBACK_MS}.
 *
 * Every copy control in the app wants exactly this — the snippet cards, the
 * editor toolbar, the Markdown code blocks and the mobile feed — and each one
 * used to carry its own `copied` state plus a bare `setTimeout`, two of which
 * leaked the timer when the control unmounted mid-countdown. One hook, one
 * cleanup, one duration.
 *
 * A failed copy (no clipboard permission, insecure context) resets the flag
 * rather than confirming something that never happened, and is reported back to
 * the caller so it can react.
 */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!(await copyTextToClipboard(text))) {
      setCopied(false);
      return false;
    }

    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return true;
  }, []);

  return { copied, copy };
}
