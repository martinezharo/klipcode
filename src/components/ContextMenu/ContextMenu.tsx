"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

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
  const menuRef = useRef<HTMLDivElement>(null);

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
  }, [x, y]);

  /* Keyboard dismiss */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const hasItems = groups.some((g) => g.items.length > 0);
  if (!hasItems) return null;

  return createPortal(
    <>
      {/* Full-screen backdrop: captures left-click and right-click to close */}
      <div
        className="fixed inset-0 z-[998]"
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
        className="kodeboard-menu-animate fixed z-[999] min-w-[208px] overflow-hidden rounded-xl p-1"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #181818 0%, #111111 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 64px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.6)",
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
            <div key={gi}>
              {gi > 0 && (
                <div
                  className="mx-1 my-1 h-px"
                  style={{ background: "rgba(255,255,255,0.06)" }}
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
                    onClick={() => {
                      item.onClick();
                      onClose();
                    }}
                    className={[
                      "flex w-full items-center gap-[10px] rounded-lg px-2.5 py-[7px] text-left",
                      "text-[13px] leading-none transition-colors duration-75",
                      "disabled:pointer-events-none disabled:opacity-25",
                      destructive
                        ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        : "text-white/60 hover:bg-white/[0.07] hover:text-white/90",
                    ].join(" ")}
                  >
                    <Ic
                      size={13}
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
