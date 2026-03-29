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
  { id: "toml",        label: "TOML",        extension: ".toml"  },
  { id: "xml",         label: "XML",         extension: ".xml"   },
  { id: "scss",        label: "SCSS",        extension: ".scss"  },
  { id: "dart",        label: "Dart",        extension: ".dart"  },
  { id: "scala",       label: "Scala",       extension: ".scala" },
  { id: "groovy",      label: "Groovy",      extension: ".groovy"},
  { id: "lua",         label: "Lua",         extension: ".lua"   },
  { id: "haskell",     label: "Haskell",     extension: ".hs"    },
  { id: "erlang",      label: "Erlang",      extension: ".erl"   },
  { id: "r",           label: "R",           extension: ".r"     },
  { id: "powershell",  label: "PowerShell",  extension: ".ps1"   },
  { id: "dockerfile",  label: "Dockerfile",  extension: ".dockerfile" },
  { id: "plaintext",   label: "Plain Text",  extension: ".txt"   },
] as const satisfies readonly LanguageConfig[];

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const DEFAULT_LANGUAGE: LanguageId = "javascript";
