"use client";

import { Check } from "lucide-react";

import { Toast } from "@/ui/Toast";

interface CopyToastProps {
  /** Bumped on every copy; each change re-triggers the toast (even repeats). */
  nonce: number;
  message: string;
}

/**
 * Brief "copied" confirmation shown when the user copies via a keyboard
 * shortcut (the click paths have their own inline check icons).
 */
export function CopyToast({ nonce, message }: CopyToastProps) {
  return (
    <Toast
      nonce={nonce}
      message={message}
      icon={<Check size={13} className="text-emerald-400" aria-hidden="true" />}
    />
  );
}
