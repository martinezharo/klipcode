import { useState } from "react";

import type { NewSnippetData } from "@/components/NewSnippet/NewSnippet";
import {
  DEFAULT_LANGUAGE,
  detectLanguageFromTitle,
  normalizeTitleExtension,
  type LanguageId,
} from "@/lib/constants/languages";

interface UseSnippetDraftOptions {
  defaultLanguage?: LanguageId;
  defaultFolderId?: string | null;
}

/**
 * Form state shared by every new-snippet layout (the desktop form and the touch
 * creator): the four fields, the "extension in the title picks the language"
 * rule, and the pre-selected folder / language handling. Layouts only differ in
 * how they arrange these, so none of it is duplicated per layout.
 */
export function useSnippetDraft({
  defaultLanguage = DEFAULT_LANGUAGE,
  defaultFolderId,
}: UseSnippetDraftOptions = {}) {
  const [title, setTitleState] = useState("");
  const [language, setLanguage] = useState<LanguageId>(defaultLanguage);
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [code, setCode] = useState("");

  // Sync the pre-selected folder coming from the aside context menu by adjusting
  // state during render when the prop changes — no effect needed.
  const [prevDefaultFolderId, setPrevDefaultFolderId] = useState(defaultFolderId);
  if (defaultFolderId !== prevDefaultFolderId) {
    setPrevDefaultFolderId(defaultFolderId);
    if (defaultFolderId != null) setFolderId(defaultFolderId);
  }

  // Same pattern for the preferred default language: pick it up when the stored
  // preference loads (or changes) so the dropdown reflects the user's choice.
  const [prevDefaultLanguage, setPrevDefaultLanguage] = useState(defaultLanguage);
  if (defaultLanguage !== prevDefaultLanguage) {
    setPrevDefaultLanguage(defaultLanguage);
    setLanguage(defaultLanguage);
  }

  // Auto-select the language when the title carries a recognizable extension
  // (e.g. `index.html` → HTML). A manual dropdown choice still wins until the
  // user types another recognized extension.
  function setTitle(value: string) {
    setTitleState(value);
    const detected = detectLanguageFromTitle(value);
    if (detected) setLanguage(detected);
  }

  function toData(): NewSnippetData {
    return { title: normalizeTitleExtension(title), language, folderId, code };
  }

  function reset() {
    setTitleState("");
    setLanguage(defaultLanguage);
    setFolderId(defaultFolderId ?? "");
    setCode("");
  }

  return { title, language, folderId, code, setTitle, setLanguage, setFolderId, setCode, toData, reset };
}
