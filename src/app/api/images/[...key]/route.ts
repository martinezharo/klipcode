import { getCloudflareContext } from "@opennextjs/cloudflare";

import { IMAGE_STORED_CONTENT_TYPE, isValidImageKey } from "@/lib/images";

/**
 * Serves an image uploaded by {@link ../route POST /api/images}.
 *
 * Going through the Worker rather than exposing the bucket on a public R2 domain
 * keeps the app self-contained: images move with the deployment, and there is no
 * second hostname to configure (or to keep alive) when it moves.
 *
 * Authorisation is the unguessable key — see the upload route for why a session
 * check is not an option here. Everything else is defence in depth: only keys
 * shaped like one we minted are looked up, the stored bytes are always WebP we
 * produced ourselves, and the response tells the browser in three different ways
 * not to treat them as anything but an image.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  // Next decodes path segments; re-encoding rebuilds the exact key that was
  // stored, and keeps a crafted `../` out of the lookup.
  const objectKey = (key ?? []).map(encodeURIComponent).join("/");

  if (!isValidImageKey(objectKey)) {
    return new Response(null, { status: 404 });
  }

  let bucket: R2Bucket | undefined;
  try {
    bucket = getCloudflareContext().env.SNIPPET_IMAGES;
  } catch {
    // Outside the Workers runtime (tests, plain Node): nothing to serve from.
  }
  if (!bucket) {
    return new Response(null, { status: 503 });
  }

  // Do not forward the request's `Headers` as an R2 conditional. In local
  // `next dev`, OpenNext proxies this binding to Cloudflare and its RPC bridge
  // cannot serialize the platform Headers object. Image keys are immutable and
  // responses are cached for a year anyway, so an unconditional read keeps the
  // local and deployed paths identical without giving up useful caching.
  const object = await bucket.get(objectKey);
  if (!object) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  // `writeHttpMetadata(headers)` is convenient inside a deployed Worker, but
  // it also passes a platform Headers instance through OpenNext's remote-
  // binding RPC bridge in local development. Copy the serializable metadata
  // fields explicitly so this path works in both runtimes.
  const metadata = object.httpMetadata;
  if (metadata?.cacheControl) headers.set("cache-control", metadata.cacheControl);
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  headers.set("content-type", IMAGE_STORED_CONTENT_TYPE);
  headers.set("etag", object.httpEtag);
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");

  return new Response(object.body, { headers });
}
