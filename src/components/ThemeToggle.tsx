"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/useTheme";
import { getThemeTransitionOrigin } from "@/lib/theme";
import { Tooltip } from "@/ui/Tooltip";

interface ThemeToggleProps {
  /** Accessible label shown when the action switches TO light. */
  toLightLabel: string;
  /** Accessible label shown when the action switches TO dark. */
  toDarkLabel: string;
  className?: string;
}

/**
 * Compact icon button that flips the color theme. Used in the landing header so
 * first-time visitors can switch without entering the app; inside the app the
 * same choice is offered as a segmented control in Preferences.
 */
export function ThemeToggle({ toLightLabel, toDarkLabel, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const nextIsLight = theme === "dark";
  const label = nextIsLight ? toLightLabel : toDarkLabel;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    toggleTheme(getThemeTransitionOrigin(event.currentTarget));
  };

  return (
    <Tooltip content={label} placement="bottom">
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={
          className ??
          "flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-ink/6 hover:text-foreground"
        }
      >
        {nextIsLight ? <Moon size={15} /> : <Sun size={15} />}
      </button>
    </Tooltip>
  );
}
