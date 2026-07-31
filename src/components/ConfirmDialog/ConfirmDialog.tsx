"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, FolderOpen, FileCode2 } from "lucide-react";

import { useDialogA11y } from "@/hooks/useDialogA11y";

interface ConfirmDialogProps {
  title: string;
  /** Optional secondary line under the title (e.g. an item name). */
  subtitle?: string;
  warning: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Optional counts shown in the summary box. */
  folderCount?: number;
  snippetCount?: number;
  folderCountLabel?: (n: number) => string;
  snippetCountLabel?: (n: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  subtitle,
  warning,
  confirmLabel,
  cancelLabel,
  folderCount = 0,
  snippetCount = 0,
  folderCountLabel,
  snippetCountLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Destructive confirmation: land focus on Cancel, not on the destructive action.
  const panelRef = useDialogA11y({ onClose: onCancel, initialFocusRef: cancelRef });
  const titleId = useId();
  const descriptionId = useId();

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[var(--z-dialog)] bg-[var(--scrim)] backdrop-blur-[2px]"
        onMouseDown={onCancel}
      />

      {/* Dialog panel */}
      <div className="fixed inset-0 z-[var(--z-dialog-sticky)] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          tabIndex={-1}
          className="klipcode-dialog-animate pointer-events-auto w-full max-w-[360px] rounded-xl p-5 focus:outline-none"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          style={{
            background: "var(--panel-bg)",
            border: "1px solid rgba(var(--ink-rgb),0.09)",
            boxShadow:
              "var(--panel-shadow)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg w-8 h-8"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Trash2 size={14} className="text-danger" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[13px] font-medium leading-snug text-ink/90">
                {title}
              </h2>
              {subtitle && (
                <p
                  className="mt-0.5 text-[12px] leading-snug truncate max-w-[260px]"
                  style={{ color: "rgba(var(--ink-rgb),0.62)" }}
                  title={subtitle}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Content counts */}
          {((folderCount > 0 && folderCountLabel) || (snippetCount > 0 && snippetCountLabel)) && (
            <div
              className="mb-4 rounded-lg px-3 py-2.5 space-y-1.5"
              style={{ background: "rgba(var(--ink-rgb),0.03)", border: "1px solid rgba(var(--ink-rgb),0.06)" }}
            >
              {folderCount > 0 && folderCountLabel && (
                <div className="flex items-center gap-2">
                  <FolderOpen size={12} style={{ color: "rgba(var(--ink-rgb),0.35)" }} />
                  <span className="text-[12px]" style={{ color: "rgba(var(--ink-rgb),0.68)" }}>
                    {folderCountLabel(folderCount)}
                  </span>
                </div>
              )}
              {snippetCount > 0 && snippetCountLabel && (
                <div className="flex items-center gap-2">
                  <FileCode2 size={12} style={{ color: "rgba(var(--ink-rgb),0.35)" }} />
                  <span className="text-[12px]" style={{ color: "rgba(var(--ink-rgb),0.68)" }}>
                    {snippetCountLabel(snippetCount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Warning */}
          <p
            id={descriptionId}
            className="mb-4 text-[12px] leading-relaxed"
            style={{ color: "rgba(var(--ink-rgb),0.62)" }}
          >
            {warning}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-75"
              style={{
                color: "rgba(var(--ink-rgb),0.7)",
                background: "transparent",
                border: "1px solid rgba(var(--ink-rgb),0.08)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(var(--ink-rgb),0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(var(--ink-rgb),0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(var(--ink-rgb),0.7)";
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-75"
              style={{
                color: "var(--danger)",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--danger-strong)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
