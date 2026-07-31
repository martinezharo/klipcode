"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SlashCommandItem } from "./SlashCommand";

export interface SlashCommandListRef {
  /** Returns true when the key was handled (so the editor lets it through). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  /** Triggers the suggestion plugin's `command` for the chosen item. */
  command: (item: SlashCommandItem) => void;
  emptyText: string;
  groupLabel: string;
}

// Notion-style "/" block inserter. Rendered into a tippy popup by SlashCommand;
// keyboard navigation is driven from the editor via the imperative handle.
export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  function SlashCommandList({ items, command, emptyText, groupLabel }, ref) {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset the highlight to the top whenever the filtered set changes.
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(0);
    }, [items]);

    // Keep the active row in view as the user arrows through a long list.
    useEffect(() => {
      const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
      node?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    return (
      <div
        className="klipcode-menu-animate w-72 overflow-hidden rounded-xl"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid rgba(var(--ink-rgb),0.07)",
          boxShadow: "var(--panel-shadow)",
        }}
      >
        {items.length === 0 ? (
          <p className="px-3 py-3 text-xs text-faint">{emptyText}</p>
        ) : (
          <>
            <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-faint">
              {groupLabel}
            </p>
            <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1">
              {items.map((item, index) => {
                const isSelected = index === selected;
                return (
                  <button
                    key={item.title}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setSelected(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => command(item)}
                    className={[
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                      "transition-colors duration-75",
                      isSelected ? "bg-ink/[0.08]" : "hover:bg-ink/[0.05]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                        isSelected
                          ? "border-ink/15 bg-ink/[0.06] text-ink/80"
                          : "border-ink/[0.08] text-ink/50",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] leading-tight text-ink/90">
                        {item.title}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-faint">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  },
);
