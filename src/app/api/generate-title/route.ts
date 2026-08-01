import { getCloudflareContext } from "@opennextjs/cloudflare";
import { api } from "@convex/_generated/api";
import { getConvexClientForToken, readBearerToken } from "@/lib/convexServer";
import { truncateCodeForTitlePrompt } from "@/lib/utils";

// Small, fast, multilingual instruct model — a title is a handful of words,
// so there's no reason to reach for a bigger (slower, costlier) one.
const TITLE_MODEL = "@cf/meta/llama-3.2-3b-instruct";

const SYSTEM_PROMPT = `You are a filename generator embedded in a code-snippet manager. You will be shown the language and the first lines of a code snippet. Reply with ONLY a short name for it: 2 to 3 words, no spaces, no file extension, no quotes, no punctuation, no markdown. Infer the purpose from function/class/variable names, comments, imports, or overall structure — name what the code DOES, never a prose description.

ALWAYS return a name, even for very short or trivial snippets — there is no such thing as "unnameable". If there is only a single statement, name its main identifier, value, or action (e.g. \`const port = 3000\` → "define-port", \`background: red\` → "red-background", \`print("hi")\` → "print_hi"). Never refuse, never reply "untitled", never leave it blank, never explain.

Pick the casing convention idiomatic to what the code is:
- A React/Vue/Svelte component, or any class → PascalCase, e.g. UserCard, EventEmitter
- A hook or composable (a "use…" function) → camelCase, e.g. useDebounce, useFetchUser
- Python code → snake_case, e.g. fetch_user_data, parse_config
- Anything else (config, CSS, HTML, SQL, shell, plain functions/scripts) → kebab-case, e.g. eslint-config, format-date

Do NOT include filler words like "snippet", "code", or the language name by itself. Output the name and absolutely nothing else — no explanation, no reasoning.`;

const MAX_TITLE_CHARS = 48;

// Normalize the model output into a single filename-like token while PRESERVING
// its casing convention (PascalCase / camelCase / snake_case / kebab-case): keep
// the first line only, strip wrapping quotes/markdown, collapse any stray
// internal whitespace to a hyphen, and drop characters that don't belong in a name.
function sanitizeTitle(raw: string): string {
  return raw
    .split("\n")[0]
    .replace(/^["'`*_\s]+|["'`*_\s]+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_TITLE_CHARS)
    .replace(/[-_]+$/g, "");
}

async function isAuthenticated(request: Request): Promise<boolean> {
  const token = readBearerToken(request);
  if (!token) return false;

  const convex = getConvexClientForToken(token);
  if (!convex) return false;

  // `viewer` resolves to null for an anonymous caller rather than throwing, so a
  // rejected token and a valid-but-unknown one are both simply "not authorised".
  try {
    return (await convex.query(api.users.viewer, {})) !== null;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { code, language } = (body ?? {}) as { code?: unknown; language?: unknown };
  if (typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  const truncatedCode = truncateCodeForTitlePrompt(code);
  const languageLabel = typeof language === "string" && language.trim() ? language.trim() : "unknown";

  let ai: Ai;
  try {
    ai = getCloudflareContext().env.AI;
  } catch {
    return Response.json({ error: "AI unavailable" }, { status: 503 });
  }
  if (!ai) {
    return Response.json({ error: "AI unavailable" }, { status: 503 });
  }

  try {
    const result = await ai.run(TITLE_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Language: ${languageLabel}\n\nCode:\n${truncatedCode}` },
      ],
      max_tokens: 24,
      temperature: 0.3,
    });

    // The prompt forbids "untitled"/blank, so these should be rare — a safety net
    // for a stubborn model. When it trips, the caller keeps the "Untitled"
    // placeholder rather than displaying a literal "untitled" title.
    const title = sanitizeTitle(result.response ?? "");
    if (!title || /^untitled$/i.test(title)) {
      return Response.json({ error: "no title" }, { status: 422 });
    }

    return Response.json({ title });
  } catch {
    return Response.json({ error: "generation failed" }, { status: 502 });
  }
}
