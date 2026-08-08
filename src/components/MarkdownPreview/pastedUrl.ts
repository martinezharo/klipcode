/**
 * Returns the URL when the pasted plain text is exactly one http(s) URL
 * (surrounding whitespace ignored), otherwise null. Deliberately strict:
 * multi-word/multi-line pastes and other schemes fall through to the
 * normal paste path instead of being linkified.
 */
export function extractPastedUrl(text: string): string | null {
  const candidate = text.trim();
  if (!/^https?:\/\/\S+$/i.test(candidate)) return null;
  try {
    new URL(candidate);
  } catch {
    return null;
  }
  return candidate;
}

/** Validate URLs accepted by the manual link dialog. */
export function isValidLinkUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);

    if (url.protocol === "mailto:") {
      return url.pathname.includes("@");
    }

    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}
