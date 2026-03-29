"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, FolderOpen, FileCode2 } from "lucide-react";

import type { Dictionary } from "@/i18n";

interface ConfirmDialogProps {
  copy: Dictionary["confirmDeleteFolder"];
  folderName: string;
  nestedFolderCount: number;
  snippetCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  copy,
  folderName,
  nestedFolderCount,
  snippetCount,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onCancel]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[998] bg-black/70 backdrop-blur-[2px]"
        onMouseDown={onCancel}
      />

      {/* Dialog panel */}
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="klipcode-dialog-animate pointer-events-auto w-full max-w-[360px] rounded-xl p-5"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          style={{
            background: "linear-gradient(180deg, #181818 0%, #111111 100%)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.03) inset, 0 32px 80px rgba(0,0,0,0.95), 0 4px 20px rgba(0,0,0,0.7)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg w-8 h-8"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Trash2 size={14} className="text-red-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="confirm-dialog-title"
                className="text-[13px] font-medium leading-snug text-white/90"
              >
                {copy.title}
              </h2>
              <p
                className="mt-0.5 text-[12px] leading-snug truncate max-w-[260px]"
                style={{ color: "rgba(255,255,255,0.4)" }}
                title={folderName}
              >
                {folderName}
              </p>
            </div>
          </div>

          {/* Content counts */}
          <div
            className="mb-4 rounded-lg px-3 py-2.5 space-y-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {nestedFolderCount > 0 && (
              <div className="flex items-center gap-2">
                <FolderOpen size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {copy.containsFolders(nestedFolderCount)}
                </span>
              </div>
            )}
            {snippetCount > 0 && (
              <div className="flex items-center gap-2">
                <FileCode2 size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {copy.containsSnippets(snippetCount)}
                </span>
              </div>
            )}
          </div>

          {/* Warning */}
          <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            {copy.permanentWarning}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-75"
              style={{
                color: "rgba(255,255,255,0.55)",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
              }}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-75"
              style={{
                color: "rgba(239,68,68,0.9)",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgb(248,113,113)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,68,68,0.9)";
              }}
            >
              {copy.confirm}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
