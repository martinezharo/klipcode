/**
 * Reading a request body without letting a caller decide how much memory the
 * Worker allocates. Shared by every route that accepts a body (`/api/images`
 * uploads, `/api/generate-title` payloads).
 *
 * The declared `content-length` is only a hint — it is checked first so obvious
 * oversize requests are rejected before a byte is read, but the stream is
 * counted as it arrives too, because that header can lie or be absent.
 */

export type LimitedBody =
  | { tooLarge: false; bytes: Uint8Array }
  | { tooLarge: true; bytes?: undefined };

export async function readBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<LimitedBody> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { tooLarge: true };
  }

  if (!request.body) return { tooLarge: false, bytes: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size limit has already been established; a source stream may
          // reject cancellation while it is closing, but that must not turn a
          // well-defined 413 into the generic malformed-body response.
        }
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { tooLarge: false, bytes };
}
