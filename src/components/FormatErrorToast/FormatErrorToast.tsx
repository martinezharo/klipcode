"use client";

import { AlertCircle } from "lucide-react";

import { Toast } from "@/ui/Toast";

interface FormatErrorToastProps {
  /** Bumped each time a format attempt fails; each change re-triggers the toast. */
  nonce: number;
  message: string;
}

/**
 * Brief error confirmation shown when code formatting fails (e.g. a syntax
 * error). Shared by the source editor's Format button and the Markdown
 * code-block menu so both surface failures identically. Held a little longer
 * than a success toast — an error is worth reading.
 */
export function FormatErrorToast({ nonce, message }: FormatErrorToastProps) {
  return (
    <Toast
      nonce={nonce}
      message={message}
      durationMs={2500}
      icon={<AlertCircle size={13} className="text-danger" aria-hidden="true" />}
    />
  );
}
