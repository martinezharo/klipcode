"use client";

/**
 * Client-side code formatting via Prettier's standalone build. Prettier and its
 * plugins are sizeable, so they are dynamically imported only when a format is
 * actually requested — they never enter the main bundle.
 *
 * Shared by the source editor's "Format" button and the Markdown code-block
 * menu, so the set of formattable languages stays consistent between them.
 */

/** Maps a KlipCode language id to the Prettier parser that handles it. A
 *  language absent from this map is not formattable. */
export const PRETTIER_PARSERS: Partial<Record<string, string>> = {
  javascript: "babel",
  jsx: "babel",
  typescript: "babel-ts",
  tsx: "babel-ts",
  html: "html",
  css: "css",
  scss: "css",
  json: "json",
  markdown: "markdown",
};

/** Whether `formatCode` can format the given language. */
export function isFormattable(language: string): boolean {
  return language in PRETTIER_PARSERS;
}

/**
 * Formats `code` for the given language and returns the result with any
 * trailing whitespace trimmed. Rejects if the language is unsupported or the
 * source can't be parsed (e.g. a syntax error) — callers decide how to surface
 * that. All parsers above are covered by the babel/estree/html/postcss/markdown
 * plugins, so the full set is loaded regardless of parser.
 */
export async function formatCode(code: string, language: string): Promise<string> {
  const parser = PRETTIER_PARSERS[language];
  if (!parser) throw new Error(`No Prettier parser for language "${language}"`);

  const prettier = await import("prettier/standalone");
  const plugins = await Promise.all([
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
    import("prettier/plugins/markdown"),
  ]);

  const formatted = await prettier.format(code, {
    parser,
    plugins,
    printWidth: 100,
    tabWidth: 2,
    singleQuote: false,
    trailingComma: "es5",
  });

  return formatted.trimEnd();
}
