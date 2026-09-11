import { getCloudflareContext } from "@opennextjs/cloudflare";

import { readViewerId } from "@/lib/convexServer";
import { readBodyWithinLimit } from "@/lib/requestBody";
import {
  IMAGE_MAX_STORED_DIMENSION,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_STORED_CONTENT_TYPE,
  IMAGE_WEBP_QUALITY,
  imageUrlForKey,
  isAcceptedImageType,
  newImageKey,
} from "@/lib/images";

/**
 * Accepts an image for a Markdown snippet, re-encodes it to WebP and stores it
 * in R2. The body is the raw file bytes; `content-type` names the source format.
 *
 * Every upload is normalised before it is stored — scaled down to fit
 * {@link IMAGE_MAX_STORED_DIMENSION} and re-encoded as WebP by the Cloudflare
 * Images binding — so a 4 MB phone photo becomes a couple of hundred KB and the
 * bucket only ever holds one format. It also means the bytes we serve are
 * always a real image we produced ourselves, never whatever the client claimed
 * to send.
 *
 * ## What the key protects, and what it does not
 *
 * `<img src>` cannot carry an `Authorization` header, and a snippet's images
 * have to load on every device the snippet syncs to, so the URL itself is the
 * capability: 128 bits of randomness under the owner's id, unguessable and
 * stable forever. Anyone the URL is shared with can fetch the image.
 *
 * That is a deliberate step down from how snippet *bodies* are handled, which
 * are end-to-end encrypted and unreadable to the storage provider. Images can't
 * get the same treatment while the server is the thing compressing them —
 * ciphertext is not transformable. Worth knowing before pasting a screenshot of
 * something sensitive; see docs/audit for the wider threat model.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Stream the buffered bytes back — the Images binding consumes streams only. */
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Response(bytes as unknown as BodyInit).body!;
}

export async function POST(request: Request) {
  // Signed-in only: an anonymous workspace is device-local by definition, and
  // uploading gives an unauthenticated caller a write into our storage.
  const userId = await readViewerId(request);
  if (userId === null) {
    return json({ error: "unauthorized" }, 401);
  }

  const declaredType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!isAcceptedImageType(declaredType)) {
    return json({ error: "unsupported type" }, 415);
  }

  const body = await readBodyWithinLimit(request, IMAGE_MAX_UPLOAD_BYTES);
  if (body.tooLarge) {
    return json({ error: "image too large" }, 413);
  }
  if (body.bytes.byteLength === 0) {
    return json({ error: "empty body" }, 400);
  }

  let env: CloudflareEnv;
  try {
    env = getCloudflareContext().env;
  } catch {
    // Outside the Workers runtime there is no Images binding and no bucket.
    return json({ error: "image storage unavailable" }, 503);
  }
  if (!env.IMAGES || !env.SNIPPET_IMAGES) {
    return json({ error: "image storage unavailable" }, 503);
  }

  let webp: Uint8Array;
  try {
    const transformed = await env.IMAGES.input(streamOf(body.bytes))
      // `scale-down` never enlarges: a small image is stored at its own size
      // rather than being upscaled into a bigger file.
      .transform({
        width: IMAGE_MAX_STORED_DIMENSION,
        height: IMAGE_MAX_STORED_DIMENSION,
        fit: "scale-down",
      })
      // `anim` keeps animated GIFs animated instead of freezing them on frame 1.
      .output({ format: IMAGE_STORED_CONTENT_TYPE, quality: IMAGE_WEBP_QUALITY, anim: true });

    webp = new Uint8Array(await new Response(transformed.image()).arrayBuffer());
  } catch {
    // The binding rejects anything that isn't a decodable image, which covers
    // both a corrupt file and a lying content-type.
    return json({ error: "not a valid image" }, 415);
  }

  // Measured on the *output* rather than derived from the input: EXIF
  // orientation can swap an image's axes during transformation, and the editor
  // needs the real aspect ratio to reserve the right amount of space.
  let width: number | undefined;
  let height: number | undefined;
  try {
    const info = await env.IMAGES.info(streamOf(webp));
    if ("width" in info && "height" in info) {
      width = info.width;
      height = info.height;
    }
  } catch {
    // Dimensions are an optimisation; the editor falls back to laying the image
    // out once it has loaded.
  }

  const key = newImageKey(userId);
  try {
    await env.SNIPPET_IMAGES.put(key, webp as unknown as ArrayBufferView, {
      httpMetadata: {
        contentType: IMAGE_STORED_CONTENT_TYPE,
        // Keys are random and an object is never rewritten, so the bytes behind
        // a URL can't change: cache them for as long as anything will hold them.
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return json({ error: "upload failed" }, 502);
  }

  return json({ url: imageUrlForKey(key), width, height, bytes: webp.byteLength }, 201);
}
