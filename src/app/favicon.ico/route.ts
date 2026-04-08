export const dynamic = "force-static";

export function GET() {
  return new Response("Redirecting to /favicon.svg", {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "text/plain; charset=utf-8",
      Location: "/favicon.svg",
    },
  });
}