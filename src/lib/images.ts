/**
 * Shared contract for images embedded in Markdown snippets.
 *
 * Runs on both sides of the wire — the upload/serve route handlers on
 * Cloudflare and the editor in the browser — so it must stay free of any
 * runtime-specific API.
 *
 * ## Where the display width lives
 *
 * A snippet is a plain `.md` document: there is no schema to hang a "width"
 * column off, and Markdown's image syntax has no size field. The width the user
 * drags to is therefore encoded in the URL fragment (`…/abc.webp#w=480`), which
 * survives a round-trip through any Markdown tool, is ignored by the browser
 * when it fetches the image, and never reaches the server. Renderers that don't
 * know about it simply lay the image out at its natural size.
 */

/** Largest upload accepted, before transformation. */
export const IMAGE_MAX_UPLOAD_MB = 12;
export const IMAGE_MAX_UPLOAD_BYTES = IMAGE_MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Longest edge kept when re-encoding. The editor column is ~720px wide, so this
 * still covers 2x displays and a full-screen lightbox without storing the
 * 6000px originals phone cameras produce.
 */
export const IMAGE_MAX_STORED_DIMENSION = 2048;

/** WebP quality. 82 is the usual "no visible loss at a fraction of the size". */
export const IMAGE_WEBP_QUALITY = 82;

/**
 * Types accepted for upload. SVG is deliberately absent: it is a scriptable
 * document, and serving one from our own origin would hand any snippet author
 * a stored-XSS primitive.
 */
export const IMAGE_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

/** `accept` attribute for file pickers, kept in sync with the list above. */
export const IMAGE_ACCEPT_ATTRIBUTE = IMAGE_ACCEPTED_TYPES.join(",");

/** Bounds for the stored display width, in CSS pixels. */
export const IMAGE_MIN_DISPLAY_WIDTH = 80;
export const IMAGE_MAX_DISPLAY_WIDTH = IMAGE_MAX_STORED_DIMENSION;

export const IMAGE_ALIGNMENTS = ["left", "center", "right"] as const;
export type ImageAlignment = (typeof IMAGE_ALIGNMENTS)[number];

/** Path prefix under which uploaded images are both stored and served. */
export const IMAGE_ROUTE_PREFIX = "/api/images/";

/** Extension and content type every stored image ends up with. */
export const IMAGE_STORED_EXTENSION = "webp";
export const IMAGE_STORED_CONTENT_TYPE = "image/webp";

export function isAcceptedImageType(type: string): boolean {
  return (IMAGE_ACCEPTED_TYPES as readonly string[]).includes(type.toLowerCase());
}

/** Round and clamp a dragged width into the range we are willing to store. */
export function clampDisplayWidth(width: number): number {
  if (!Number.isFinite(width)) return IMAGE_MIN_DISPLAY_WIDTH;
  return Math.min(
    IMAGE_MAX_DISPLAY_WIDTH,
    Math.max(IMAGE_MIN_DISPLAY_WIDTH, Math.round(width)),
  );
}

/**
 * The object key for a newly uploaded image: the owner's id, then 128 bits of
 * randomness. The key IS the capability — `<img src>` cannot carry an
 * `Authorization` header, so the serve route authorises by unguessability
 * rather than by session (see the route for the full trade-off).
 */
export function newImageKey(userId: string): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${encodeURIComponent(userId)}/${id}.${IMAGE_STORED_EXTENSION}`;
}

/**
 * Whether an R2 key looks like one `newImageKey` could have minted. The serve
 * route rejects anything else, so a crafted path can never be used to probe for
 * other objects in the bucket.
 */
export function isValidImageKey(key: string): boolean {
  return new RegExp(
    `^(?!\\.{1,2}/)[^/]+/[0-9a-f]{32}\\.${IMAGE_STORED_EXTENSION}$`,
  ).test(key);
}

/** The URL an uploaded image is embedded and served under. */
export function imageUrlForKey(key: string): string {
  return `${IMAGE_ROUTE_PREFIX}${key}`;
}

/**
 * The display width encoded in `src`, or `null` when the image should render at
 * its natural size. Anything unparseable is treated as "no width" rather than
 * an error: a hand-edited document must still open.
 */
export function readImageWidth(src: string): number | null {
  const hash = src.indexOf("#");
  if (hash === -1) return null;

  const match = /(?:^|&)w=(\d+)(?:&|$)/.exec(src.slice(hash + 1));
  if (!match) return null;

  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? clampDisplayWidth(width) : null;
}

/** `src` with any width fragment removed — the URL actually worth fetching. */
export function stripImageWidth(src: string): string {
  const hash = src.indexOf("#");
  if (hash === -1) return src;

  const rest = src
    .slice(hash + 1)
    .split("&")
    .filter((part) => !/^w=\d+$/.test(part))
    .join("&");

  return rest ? `${src.slice(0, hash)}#${rest}` : src.slice(0, hash);
}

/** `src` carrying `width`, replacing any width it already had. */
export function writeImageWidth(src: string, width: number | null): string {
  const base = stripImageWidth(src);
  if (width === null) return base;
  return `${base}${base.includes("#") ? "&" : "#"}w=${clampDisplayWidth(width)}`;
}

/** The image alignment encoded in `src`; plain Markdown defaults to left. */
export function readImageAlignment(src: string): ImageAlignment {
  const hash = src.indexOf("#");
  if (hash === -1) return "left";

  const match = /(?:^|&)align=(left|center|right)(?:&|$)/.exec(src.slice(hash + 1));
  return (match?.[1] as ImageAlignment | undefined) ?? "left";
}

/** `src` with KlipCode's alignment fragment removed. */
export function stripImageAlignment(src: string): string {
  const hash = src.indexOf("#");
  if (hash === -1) return src;

  const rest = src
    .slice(hash + 1)
    .split("&")
    .filter((part) => !/^align=(?:left|center|right)$/.test(part))
    .join("&");

  return rest ? `${src.slice(0, hash)}#${rest}` : src.slice(0, hash);
}

/**
 * `src` carrying the chosen alignment. Left is Markdown's natural default, so
 * it removes the extension rather than adding redundant metadata.
 */
export function writeImageAlignment(src: string, alignment: ImageAlignment): string {
  const base = stripImageAlignment(src);
  if (alignment === "left") return base;
  return `${base}${base.includes("#") ? "&" : "#"}align=${alignment}`;
}
