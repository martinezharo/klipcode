"use client";

import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

import { useMenuKeyboardNav } from "@/hooks/useDialogA11y";

export interface ContextMenuItemDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export interface ContextMenuGroup {
  items: ContextMenuItemDef[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export function ContextMenu({ x, y, groups, onClose }: ContextMenuProps) {
  // Focuses the first item on open, drives arrow-key navigation and hands focus
  // back to the trigger on close — the menu is portalled out of the tab order.
  const menuRef = useMenuKeyboardNav(onClose);

  /* Adjust position so the menu never overflows the viewport */
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { right, bottom, width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    if (right > vw - gap) el.style.left = `${Math.max(gap, x - width)}px`;
    if (bottom > vh - gap) el.style.top = `${Math.max(gap, y - height)}px`;
  }, [x, y, menuRef]);

  const hasItems = groups.some((g) => g.items.length > 0);
  if (!hasItems) return null;

  return createPortal(
    <>
      {/* Full-screen backdrop: captures left-click and right-click to close */}
      <div
        aria-hidden="true"
        className="fixed inset-0 klipcode-z-menu"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Menu panel */}
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        className="klipcode-menu-animate fixed klipcode-z-popover min-w-52 overflow-hidden rounded-xl p-1"
        style={{
          left: x,
          top: y,
          background: "var(--panel-bg)",
          border: "1px solid rgba(var(--ink-rgb),0.07)",
          boxShadow:
            "var(--panel-shadow)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {groups.map((group, gi) => {
          if (group.items.length === 0) return null;
          return (
            // `role="menu"` only accepts menuitem/group/separator children, so
            // the visual wrappers carry the matching roles.
            <div key={gi} role="group">
              {gi > 0 && (
                <div
                  role="separator"
                  className="mx-1 my-1 h-px"
                  style={{ background: "rgba(var(--ink-rgb),0.06)" }}
                />
              )}
              {group.items.map((item) => {
                const Ic = item.Icon;
                const destructive = item.variant === "destructive";
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick();
                      onClose();
                    }}
                    className={[
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.75 text-left",
                      "text-[13px] leading-none transition-colors duration-75",
                      "disabled:pointer-events-none disabled:opacity-25",
                      destructive
                        ? "text-danger hover:bg-red-500/10 hover:text-danger-strong"
                        : "text-ink/60 hover:bg-ink/[0.07] hover:text-ink/90",
                    ].join(" ")}
                  >
                    <Ic
                      size={13}
                      aria-hidden="true"
                      className={`shrink-0 ${destructive ? "opacity-80" : "opacity-55"}`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
