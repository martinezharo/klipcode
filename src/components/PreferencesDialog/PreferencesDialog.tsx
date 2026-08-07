"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
import { Lock, Settings, X } from "lucide-react";
import { IconButton } from "@/ui/IconButton";

import { useDialogA11y } from "@/hooks/useDialogA11y";

import type { Dictionary } from "@/i18n";
import type { FolderRecord } from "@/lib/types";
import type { Preferences } from "@/lib/preferences";
import type { Locale } from "@/lib/locale";
import {
  getThemeTransitionOrigin,
  type Theme,
  type ThemeTransitionOrigin,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { LANGUAGES, type LanguageId } from "@/lib/constants/languages";
import { LanguageSelect } from "@/ui/LanguageSelect";
import { FolderSelect } from "@/ui/FolderSelect";

interface PreferencesDialogProps {
  copy: Dictionary;
  locale: Locale;
  theme: Theme;
  folders: FolderRecord[];
  preferences: Preferences;
  /** Whether a user is signed in — AI naming is auth-gated, so its toggle locks
   *  when anonymous. */
  isAuthenticated: boolean;
  onChangePreferences: (patch: Partial<Preferences>) => void;
  onChangeLocale: (locale: Locale) => void;
  onChangeTheme: (theme: Theme, origin?: ThemeTransitionOrigin) => void;
  onClose: () => void;
}

/** Pill segmented control used for the locale and theme rows. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T, control: HTMLButtonElement) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-ink/[0.08] p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={(event) => onChange(opt.value, event.currentTarget)}
            aria-pressed={active}
            className={[
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              active ? "bg-ink/[0.08] text-ink" : "text-ink/65 hover:text-ink/90",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch. When `disabled` it dims and stops responding — used to gate
 *  the AI-naming preference behind sign-in. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-ink/80" : "bg-ink/15",
        disabled ? "cursor-not-allowed opacity-40" : "hover:brightness-110",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full shadow transition-transform",
          checked ? "translate-x-4 bg-background" : "translate-x-0.5 bg-ink",
        )}
      />
    </button>
  );
}

/**
 * A labelled preference row: title + helper text on the left, control on the
 * right. Wrapped in a `group` so assistive tech announces the row's title and
 * helper text as context for the control, which otherwise carries only its own
 * option labels ("Light", "Dark", …).
 */
function Row({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="flex items-center justify-between gap-4 px-4 py-3.5"
    >
      <div className="min-w-0">
        <p id={titleId} className="text-[13px] text-foreground/90">
          {title}
        </p>
        <p id={descriptionId} className="mt-0.5 text-[12px] text-faint">
          {description}
        </p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const LOCALE_OPTIONS: { value: Locale; key: "en" | "es" }[] = [
  { value: "en", key: "en" },
  { value: "es", key: "es" },
];

export function PreferencesDialog({
  copy,
  locale,
  theme,
  folders,
  preferences,
  isAuthenticated,
  onChangePreferences,
  onChangeLocale,
  onChangeTheme,
  onClose,
}: PreferencesDialogProps) {
  const t = copy.preferences;
  const panelRef = useDialogA11y({ onClose });
  const titleId = useId();

  // The snippet creator's default language is constrained to a known LanguageId;
  // fall back to the first language if a persisted value somehow drifts.
  const defaultLanguage: LanguageId = LANGUAGES.some((l) => l.id === preferences.defaultLanguage)
    ? preferences.defaultLanguage
    : (LANGUAGES[0].id as LanguageId);

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
        className="klipcode-menu-animate relative flex w-full max-w-md flex-col overflow-hidden rounded-xl focus:outline-none"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid rgba(var(--ink-rgb),0.08)",
          boxShadow:
            "var(--panel-shadow)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-4 py-3">
          <Settings size={16} className="shrink-0 text-ink/35" aria-hidden="true" />
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
        <div className="divide-y divide-ink/[0.05]">
          {/* Appearance (theme) */}
          <Row
            title={t.appearance.label}
            description={t.appearance.description}
            control={
              <Segmented<Theme>
                value={theme}
                onChange={(next, control) =>
                  onChangeTheme(next, getThemeTransitionOrigin(control))
                }
                options={[
                  { value: "light", label: t.appearance.light },
                  { value: "dark", label: t.appearance.dark },
                ]}
              />
            }
          />

          {/* Interface language */}
          <Row
            title={t.language.label}
            description={t.language.description}
            control={
              <Segmented<Locale>
                value={locale}
                onChange={onChangeLocale}
                options={LOCALE_OPTIONS.map(({ value, key }) => ({
                  value,
                  label: t.language[key],
                }))}
              />
            }
          />

          {/* Default folder for new snippets */}
          <Row
            title={t.defaultFolder.label}
            description={t.defaultFolder.description}
            control={
              <FolderSelect
                value={preferences.defaultFolderId ?? ""}
                onChange={(value) => onChangePreferences({ defaultFolderId: value || null })}
                folders={folders}
                rootLabel={copy.workspace.rootOption}
                copy={copy.folderSelect}
                menuZIndex="var(--z-dialog-menu)"
              />
            }
          />

          {/* Default language for new snippets */}
          <Row
            title={t.defaultLanguage.label}
            description={t.defaultLanguage.description}
            control={
              <LanguageSelect
                value={defaultLanguage}
                onChange={(value) => onChangePreferences({ defaultLanguage: value })}
                copy={copy.languageSelect}
                menuZIndex="var(--z-dialog-menu)"
              />
            }
          />

          {/* Auto-generate a name for untitled snippets (AI, sign-in gated) */}
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] text-foreground/90">
                {t.autoGenerateTitle.label}
                {!isAuthenticated && (
                  <Lock size={11} className="shrink-0 text-ink/30" aria-hidden="true" />
                )}
              </p>
              <p className="mt-0.5 text-[12px] text-faint">
                {isAuthenticated
                  ? t.autoGenerateTitle.description
                  : t.autoGenerateTitle.lockedHint}
              </p>
            </div>
            <div className="shrink-0">
              <Toggle
                checked={preferences.autoGenerateTitle}
                disabled={!isAuthenticated}
                onChange={(value) => onChangePreferences({ autoGenerateTitle: value })}
                label={t.autoGenerateTitle.label}
              />
            </div>
          </div>

          {/* Long code lines: horizontal scroll vs soft wrap */}
          <Row
            title={t.codeWrap.label}
            description={t.codeWrap.description}
            control={
              <Segmented<"scroll" | "wrap">
                value={preferences.codeWrap ? "wrap" : "scroll"}
                onChange={(value) => onChangePreferences({ codeWrap: value === "wrap" })}
                options={[
                  { value: "scroll", label: t.codeWrap.scroll },
                  { value: "wrap", label: t.codeWrap.wrap },
                ]}
              />
            }
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
