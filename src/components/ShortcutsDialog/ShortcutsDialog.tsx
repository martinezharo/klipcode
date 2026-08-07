"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { Keyboard, X } from "lucide-react";
import { IconButton } from "@/ui/IconButton";

import type { Dictionary } from "@/i18n";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  SHORTCUTS,
  SHORTCUT_SECTION_ORDER,
  formatShortcutKeys,
  isMac,
} from "@/lib/constants/shortcuts";

interface ShortcutsDialogProps {
  copy: Dictionary;
  onClose: () => void;
}

export function ShortcutsDialog({ copy, onClose }: ShortcutsDialogProps) {
  const t = copy.shortcuts;
  const mac = isMac();
  const panelRef = useDialogA11y({ onClose });
  const titleId = useId();

  const groups = SHORTCUT_SECTION_ORDER.map((section) => ({
    section,
    items: SHORTCUTS.filter((s) => s.section === section),
  })).filter((g) => g.items.length > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-dialog)] flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className="klipcode-menu-animate relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl focus:outline-none"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid rgba(var(--ink-rgb),0.08)",
          boxShadow:
            "var(--panel-shadow)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-4 py-3">
          <Keyboard size={16} className="shrink-0 text-ink/35" aria-hidden="true" />
          <h2 id={titleId} className="flex-1 text-sm font-medium text-foreground">
            {t.title}
          </h2>
          <IconButton
            aria-label={copy.common.close}
            onClick={onClose}
            className="-mr-1 text-ink/45 hover:bg-ink/6 hover:text-ink/80 lg:p-1"
          >
            <X size={15} aria-hidden="true" />
          </IconButton>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {groups.map(({ section, items }) => (
            <div key={section} className="mb-1 last:mb-0">
              <h3 className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-faint">
                {t.sections[section]}
              </h3>
              {items.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                >
                  <span className="text-[13px] text-foreground/90">
                    {t.items[shortcut.id]}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {formatShortcutKeys(shortcut, mac).map((token, i) => (
                      <kbd
                        key={i}
                        className="rounded bg-ink/[0.07] px-1.5 py-0.5 font-mono text-[11px] text-ink/60"
                      >
                        {token}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
