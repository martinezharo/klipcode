"use client";

import { useState, useEffect, type CSSProperties } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { foldGutter } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

// Custom fold gutter with VS Code-style SVG markers (our own classes so CSS can target them)
const customFoldGutter = foldGutter({
  markerDOM: (open) => {
    const el = document.createElement("span");
    el.className = open ? "cm-fold-open" : "cm-fold-closed";
    return el;
  },
});

// Module-level cache so repeated language loads are instant
const extensionCache = new Map<string, Extension[]>();

async function loadExtension(language: string): Promise<Extension[]> {
  const cached = extensionCache.get(language);
  if (cached) return cached;

  let extensions: Extension[] = [];

  switch (language) {
    case "javascript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      extensions = [javascript()];
      break;
    }
    case "typescript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      extensions = [javascript({ typescript: true })];
      break;
    }
    case "tsx": {
      const { javascript } = await import("@codemirror/lang-javascript");
      extensions = [javascript({ jsx: true, typescript: true })];
      break;
    }
    case "jsx": {
      const { javascript } = await import("@codemirror/lang-javascript");
      extensions = [javascript({ jsx: true })];
      break;
    }
    case "html": {
      const { html } = await import("@codemirror/lang-html");
      extensions = [html()];
      break;
    }
    case "css": {
      const { css } = await import("@codemirror/lang-css");
      extensions = [css()];
      break;
    }
    case "python": {
      const { python } = await import("@codemirror/lang-python");
      extensions = [python()];
      break;
    }
    case "json": {
      const { json } = await import("@codemirror/lang-json");
      extensions = [json()];
      break;
    }
    case "markdown": {
      const { markdown } = await import("@codemirror/lang-markdown");
      extensions = [markdown()];
      break;
    }
    case "sql": {
      const { sql } = await import("@codemirror/lang-sql");
      extensions = [sql()];
      break;
    }
    case "java": {
      const { java } = await import("@codemirror/lang-java");
      extensions = [java()];
      break;
    }
    case "c":
    case "cpp": {
      const { cpp } = await import("@codemirror/lang-cpp");
      extensions = [cpp()];
      break;
    }
    case "php": {
      const { php } = await import("@codemirror/lang-php");
      extensions = [php()];
      break;
    }
    case "xml": {
      const { xml } = await import("@codemirror/lang-xml");
      extensions = [xml()];
      break;
    }
    case "bash": {
      const [{ StreamLanguage }, { shell }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/shell"),
      ]);
      extensions = [StreamLanguage.define(shell)];
      break;
    }
    case "yaml": {
      const [{ StreamLanguage }, { yaml }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/yaml"),
      ]);
      extensions = [StreamLanguage.define(yaml)];
      break;
    }
    case "go": {
      const [{ StreamLanguage }, { go }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/go"),
      ]);
      extensions = [StreamLanguage.define(go)];
      break;
    }
    case "rust": {
      const [{ StreamLanguage }, { rust }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/rust"),
      ]);
      extensions = [StreamLanguage.define(rust)];
      break;
    }
    case "csharp": {
      const [{ StreamLanguage }, { csharp }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      extensions = [StreamLanguage.define(csharp)];
      break;
    }
    case "ruby": {
      const [{ StreamLanguage }, { ruby }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/ruby"),
      ]);
      extensions = [StreamLanguage.define(ruby)];
      break;
    }
    case "swift": {
      const [{ StreamLanguage }, { swift }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/swift"),
      ]);
      extensions = [StreamLanguage.define(swift)];
      break;
    }
    case "kotlin": {
      const [{ StreamLanguage }, { kotlin }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      extensions = [StreamLanguage.define(kotlin)];
      break;
    }
    case "dart": {
      const [{ StreamLanguage }, { dart }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      extensions = [StreamLanguage.define(dart)];
      break;
    }
    case "scala": {
      const [{ StreamLanguage }, { scala }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      extensions = [StreamLanguage.define(scala)];
      break;
    }
    case "groovy": {
      const [{ StreamLanguage }, { groovy }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/groovy"),
      ]);
      extensions = [StreamLanguage.define(groovy)];
      break;
    }
    case "lua": {
      const [{ StreamLanguage }, { lua }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/lua"),
      ]);
      extensions = [StreamLanguage.define(lua)];
      break;
    }
    case "haskell": {
      const [{ StreamLanguage }, { haskell }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/haskell"),
      ]);
      extensions = [StreamLanguage.define(haskell)];
      break;
    }
    case "erlang": {
      const [{ StreamLanguage }, { erlang }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/erlang"),
      ]);
      extensions = [StreamLanguage.define(erlang)];
      break;
    }
    case "r": {
      const [{ StreamLanguage }, { r }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/r"),
      ]);
      extensions = [StreamLanguage.define(r)];
      break;
    }
    case "powershell": {
      const [{ StreamLanguage }, { powerShell }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/powershell"),
      ]);
      extensions = [StreamLanguage.define(powerShell)];
      break;
    }
    case "toml": {
      const [{ StreamLanguage }, { toml }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/toml"),
      ]);
      extensions = [StreamLanguage.define(toml)];
      break;
    }
    case "scss": {
      const [{ StreamLanguage }, { sass }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/sass"),
      ]);
      extensions = [StreamLanguage.define(sass)];
      break;
    }
    case "dockerfile": {
      const [{ StreamLanguage }, { dockerFile }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/dockerfile"),
      ]);
      extensions = [StreamLanguage.define(dockerFile)];
      break;
    }
    default:
      extensions = [];
  }

  extensionCache.set(language, extensions);
  return extensions;
}

const EDIT_SETUP = {
  lineNumbers: true,
  highlightActiveLineGutter: true,
  highlightActiveLine: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: false,
  foldGutter: false, // handled manually via customFoldGutter extension
  indentOnInput: true,
  tabSize: 2,
} as const;

const PREVIEW_SETUP = {
  lineNumbers: true,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  foldGutter: false,
  dropCursor: false,
  allowMultipleSelections: false,
  indentOnInput: false,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  rectangularSelection: false,
  crosshairCursor: false,
  highlightSelectionMatches: false,
  searchKeymap: false,
} as const;

export interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
  placeholder?: string;
  fontSize?: number;
  gutterBackground?: string;
}

export function Editor({
  value,
  onChange,
  language,
  readOnly = false,
  height = "200px",
  placeholder,
  fontSize = 13,
  gutterBackground,
}: EditorProps) {
  const [extensions, setExtensions] = useState<Extension[]>([]);

  const editorStyle = {
    fontSize: `${fontSize}px`,
    ...(gutterBackground
      ? { "--klipcode-editor-gutter-background": gutterBackground }
      : {}),
    ...(readOnly ? { pointerEvents: "none" } : {}),
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;

    loadExtension(language).then((exts) => {
      if (!cancelled) setExtensions(exts);
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={vscodeDark}
      extensions={readOnly ? extensions : [...extensions, customFoldGutter]}
      editable={!readOnly}
      readOnly={readOnly}
      placeholder={placeholder}
      basicSetup={readOnly ? PREVIEW_SETUP : EDIT_SETUP}
      height={height}
      style={editorStyle}
    />
  );
}
