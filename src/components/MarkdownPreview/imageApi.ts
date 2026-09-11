import { getAuthToken } from "@/lib/authToken";
import {
  IMAGE_MAX_UPLOAD_BYTES,
  isAcceptedImageType,
} from "@/lib/images";

/**
 * Client half of the image pipeline: hand a file to `/api/images`, get back the
 * URL of the stored WebP. Every entry point (paste, drop, the slash menu) goes
 * through here — see `ImageUpload.ts` for the editor side — so validation,
 * failure modes and the request shape stay in one place.
 */

/** Why an upload could not happen, mapped to localized copy by the caller. */
export type ImageUploadFailure =
  | "unauthorized"
  | "too-large"
  | "unsupported"
  | "failed";

export class ImageUploadError extends Error {
  readonly reason: ImageUploadFailure;

  constructor(reason: ImageUploadFailure) {
    super(`image upload failed: ${reason}`);
    this.name = "ImageUploadError";
    this.reason = reason;
  }
}

export interface UploadedImage {
  /** Path the image is served from, e.g. `/api/images/<user>/<id>.webp`. */
  url: string;
  /** Pixel size of the stored image, when the server could measure it. */
  width?: number;
  height?: number;
}

/** Generous: a big upload still has to cross a phone network and be re-encoded. */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * The image files in a paste or drop, in the order they were given.
 *
 * Browsers do not expose clipboard images consistently: Chromium normally
 * populates `files`, while screenshots and images copied by some desktop apps
 * can exist only as `items`. Prefer the simpler file list, then fall back to
 * extracting file-kind clipboard items so both forms upload automatically.
 */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];

  const files = Array.from(data.files).filter((file) => file.type.startsWith("image/"));
  if (files.length > 0) return files;

  return Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
}

/**
 * Upload a single file. Rejects with an {@link ImageUploadError} whose `reason`
 * the caller turns into a message; anything unexpected collapses into "failed"
 * so a network blip and a 500 look the same to the user (they retry either way).
 *
 * Type and size are checked here before anything leaves the device: the server
 * checks them again, but there is no point spending a phone's upstream on a
 * file we already know will be rejected.
 */
export async function uploadSnippetImage(file: File): Promise<UploadedImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new ImageUploadError("unsupported");
  }
  if (file.size > IMAGE_MAX_UPLOAD_BYTES) {
    throw new ImageUploadError("too-large");
  }

  // Uploads are for signed-in users only — a guest workspace never leaves the
  // device, so there is no account to store the image against.
  const accessToken = getAuthToken();
  if (!accessToken) {
    throw new ImageUploadError("unauthorized");
  }

  let response: Response;
  try {
    response = await fetch("/api/images", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        Authorization: `Bearer ${accessToken}`,
      },
      body: file,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch {
    throw new ImageUploadError("failed");
  }

  if (!response.ok) {
    if (response.status === 401) throw new ImageUploadError("unauthorized");
    if (response.status === 413) throw new ImageUploadError("too-large");
    if (response.status === 415) throw new ImageUploadError("unsupported");
    throw new ImageUploadError("failed");
  }

  let payload: { url?: unknown; width?: unknown; height?: unknown };
  try {
    payload = await response.json();
  } catch {
    throw new ImageUploadError("failed");
  }

  if (typeof payload.url !== "string" || !payload.url) {
    throw new ImageUploadError("failed");
  }

  return {
    url: payload.url,
    width: typeof payload.width === "number" ? payload.width : undefined,
    height: typeof payload.height === "number" ? payload.height : undefined,
  };
}
