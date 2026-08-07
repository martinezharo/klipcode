"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link as LinkIcon } from "lucide-react";

import { useDialogA11y } from "@/hooks/useDialogA11y";

interface LinkDialogProps {
  /** Current href of the mark, if any (drives "edit" vs "insert" wording). */
  initialHref?: string;
  copy: {
    title: string;
    editTitle: string;
    label: string;
    placeholder: string;
    apply: string;
    cancel: string;
    remove: string;
    invalid: string;
  };
  onCancel: () => void;
  /** Called with the entered URL. An empty string means "unset the link". */
  onSubmit: (url: string) => void;
  /** Called when the user explicitly removes an existing link. */
  onRemove: () => void;
}

// Minimal, dependency-free URL validity check — accepts anything that parses
// with a scheme+routed via `URL`, or a bare host the Link extension would also
// autolink. Keeps the dialog self-contained and SSR-safe.
function isValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!url.hostname) return false;
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function LinkDialog({ initialHref, copy, onCancel, onSubmit, onRemove }: LinkDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const titleId = useId();
  const panelRef = useDialogA11y({ onClose: onCancel, initialFocusRef: inputRef });
  const isEditing = Boolean(initialHref);

  const [value, setValue] = useState(initialHref ?? "https://");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // useDialogA11y already focused the input; place the caret after the
    // pre-filled https:// so the user continues typing the host.
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []);

  const trimmed = value.trim();
  const showError = touched && trimmed !== "" && !isValidUrl(trimmed);

  const submit = () => {
    setTouched(true);
    if (!isValidUrl(trimmed)) return;
    onSubmit(trimmed);
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 klipcode-z-dialog klipcode-scrim backdrop-blur-[2px]"
        onMouseDown={onCancel}
      />

      {/* Dialog panel */}
      <div className="fixed inset-0 klipcode-z-dialog-sticky flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          tabIndex={-1}
          className="klipcode-dialog-animate pointer-events-auto flex w-full max-w-[380px] flex-col rounded-xl focus:outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            background: "var(--panel-bg)",
            border: "1px solid rgba(var(--ink-rgb),0.09)",
            boxShadow: "var(--panel-shadow)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-4 py-3">
            <LinkIcon size={16} className="shrink-0 text-ink/35" aria-hidden="true" />
            <h2 id={titleId} className="text-sm font-medium text-foreground">
              {isEditing ? copy.editTitle : copy.title}
            </h2>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <label htmlFor={inputId} className="mb-1.5 block text-[12px] font-medium text-ink/55">
              {copy.label}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={value}
              placeholder={copy.placeholder}
              onChange={(e) => {
                setValue(e.target.value);
                setTouched(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              onBlur={() => setTouched(true)}
              aria-invalid={showError || undefined}
              aria-describedby={showError ? errorId : undefined}
              className="w-full rounded-lg bg-ink/[0.04] px-3 py-2 text-[13px] text-ink/90 transition-colors placeholder:text-faint focus:bg-ink/[0.06]"
              style={{ border: "1px solid rgba(var(--ink-rgb),0.08)" }}
            />
            {showError && (
              <p id={errorId} role="alert" className="mt-1.5 text-[12px] text-danger">
                {copy.invalid}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 px-4 pb-4">
            <div className="min-w-0">
              {isEditing && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="truncate rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-75"
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
                  {copy.remove}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
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
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#0a0a0a] transition-colors duration-75"
                style={{
                  background: "rgba(var(--ink-rgb),0.92)",
                  border: "1px solid rgba(var(--ink-rgb),0.92)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--ink-rgb))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(var(--ink-rgb),0.92)";
                }}
              >
                {copy.apply}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
