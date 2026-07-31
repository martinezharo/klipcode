"use client";

import { useIsMac } from "@/hooks/useIsMac";
import { formatShortcutKeys, getShortcut, type ShortcutId } from "@/lib/constants/shortcuts";

interface ShortcutHintProps {
  id: ShortcutId;
  /** "light" = pale keys for dark surfaces (default); "dark" = for light buttons. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Inline `<kbd>` badges for a registered shortcut, rendered platform-aware
 * (⌘/⌥ on macOS, Ctrl/Alt elsewhere). Single source of truth via the shortcut
 * registry so hints can't drift from the actual bindings.
 */
export function ShortcutHint({ id, tone = "light", className }: ShortcutHintProps) {
  const mac = useIsMac();
  const kbdClass =
    tone === "dark"
      ? "rounded bg-background/10 px-1 py-0.5 font-mono text-[10px] text-background/80"
      : "rounded bg-ink/[0.07] px-1 py-0.5 font-mono text-[10px] text-ink/75";

  return (
    <span className={`flex shrink-0 items-center gap-0.5 ${className ?? ""}`}>
      {formatShortcutKeys(getShortcut(id), mac).map((token, i) => (
        <kbd key={i} className={kbdClass}>
          {token}
        </kbd>
      ))}
    </span>
  );
}
