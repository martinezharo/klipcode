import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectLanguageFromTitle,
  normalizeTitleExtension,
  type LanguageId,
} from "@/lib/constants/languages";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Copy without leaking rejected clipboard promises into event handlers. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Split a VS Code-style "/"-separated path into trimmed, non-empty segments. */
export function splitWorkspacePath(input: string): string[] {
  return input
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Resolve a snippet name or path into the folders that should contain it and
 * the filename that should be stored as its title.
 *
 * `scripts/utils/index.ts` becomes `{ folderSegments: ["scripts", "utils"],
 * title: "index.ts" }`, while a plain `index.ts` keeps the current folder.
 */
export function resolveSnippetPath(input: string): {
  folderSegments: string[];
  title: string;
} {
  const segments = splitWorkspacePath(input);
  return {
    folderSegments: segments.slice(0, -1),
    title: segments.at(-1) ?? "",
  };
}

export function getSnippetDisplayName(title: string, language: string, untitledLabel: string): string {
  const extension = LANGUAGES.find((l) => l.id === language)?.extension ?? "";
  const baseName = title || untitledLabel;
  if (!extension || baseName.endsWith(extension)) return baseName;
  return `${baseName}${extension}`;
}

/**
 * The snippet's editable filename — its title with the language extension
 * appended (e.g. `index` + html → `index.html`). Unlike {@link getSnippetDisplayName}
 * it has no untitled fallback, so an empty title yields an empty string, which is
 * what a rename input should start from.
 */
export function getSnippetFileName(title: string, language: string): string {
  const baseName = title.trim();
  if (!baseName) return "";
  const extension = LANGUAGES.find((l) => l.id === language)?.extension ?? "";
  if (!extension || baseName.endsWith(extension)) return baseName;
  return `${baseName}${extension}`;
}

/**
 * Resolves a filename typed in a rename field into the stored `title` and
 * `language`. A recognized extension switches the language (e.g. `index.css`
 * makes it CSS); an unrecognized or missing one preserves the previous extension
 * by re-appending it (e.g. renaming `index.html` to `index.xxx` is stored as
 * `index.xxx.html`, keeping the HTML language).
 */
export function resolveSnippetRename(
  value: string,
  currentLanguage: string,
): { title: string; language: LanguageId } {
  const trimmed = value.trim();
  const detected = detectLanguageFromTitle(trimmed);
  if (detected) return { title: normalizeTitleExtension(trimmed), language: detected };

  const prevExt = LANGUAGES.find((l) => l.id === currentLanguage)?.extension ?? "";
  const title = prevExt && !trimmed.endsWith(prevExt) ? `${trimmed}${prevExt}` : trimmed;
  return {
    title,
    language: (LANGUAGES.find((l) => l.id === currentLanguage)?.id ?? DEFAULT_LANGUAGE) as LanguageId,
  };
}

/** Lines/characters fed to the AI title generator — enough for it to infer
 *  intent from a snippet without shipping arbitrarily large payloads. */
const AI_TITLE_PROMPT_MAX_LINES = 60;
const AI_TITLE_PROMPT_MAX_CHARS = 4000;

/**
 * Trims a snippet's code down to the leading slice used to prompt the AI
 * title generator, capped in both lines and characters.
 */
export function truncateCodeForTitlePrompt(code: string): string {
  const leadingLines = code.split("\n").slice(0, AI_TITLE_PROMPT_MAX_LINES).join("\n");
  return leadingLines.length > AI_TITLE_PROMPT_MAX_CHARS
    ? leadingLines.slice(0, AI_TITLE_PROMPT_MAX_CHARS)
    : leadingLines;
}
