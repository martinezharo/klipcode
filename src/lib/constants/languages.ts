export interface LanguageConfig {
  id: string;
  label: string;
  extension: string;
}

export const LANGUAGES = [
  { id: "typescript",  label: "TypeScript",  extension: ".ts"    },
  { id: "tsx",         label: "TSX",         extension: ".tsx"   },
  { id: "javascript",  label: "JavaScript",  extension: ".js"    },
  { id: "jsx",         label: "JSX",         extension: ".jsx"   },
  { id: "html",        label: "HTML",        extension: ".html"  },
  { id: "css",         label: "CSS",         extension: ".css"   },
  { id: "python",      label: "Python",      extension: ".py"    },
  { id: "json",        label: "JSON",        extension: ".json"  },
  { id: "markdown",    label: "Markdown",    extension: ".md"    },
  { id: "sql",         label: "SQL",         extension: ".sql"   },
  { id: "bash",        label: "Bash",        extension: ".sh"    },
  { id: "go",          label: "Go",          extension: ".go"    },
  { id: "rust",        label: "Rust",        extension: ".rs"    },
  { id: "java",        label: "Java",        extension: ".java"  },
  { id: "cpp",         label: "C++",         extension: ".cpp"   },
  { id: "c",           label: "C",           extension: ".c"     },
  { id: "csharp",      label: "C#",          extension: ".cs"    },
  { id: "php",         label: "PHP",         extension: ".php"   },
  { id: "ruby",        label: "Ruby",        extension: ".rb"    },
  { id: "swift",       label: "Swift",       extension: ".swift" },
  { id: "kotlin",      label: "Kotlin",      extension: ".kt"    },
  { id: "yaml",        label: "YAML",        extension: ".yaml"  },
  { id: "xml",         label: "XML",         extension: ".xml"   },
  { id: "plaintext",   label: "Plain Text",  extension: ".txt"   },
] as const satisfies readonly LanguageConfig[];

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const DEFAULT_LANGUAGE: LanguageId = "javascript";
