import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler causes a benign Performance.measure timing error in
  // Turbopack dev mode (React 19 issue). Keep it enabled only for production.
  reactCompiler: process.env.NODE_ENV === "production",
  // Allow the dev client to connect when the app is reached through a
  // tailnet hostname or a temporary HTTPS tunnel instead of localhost.
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? ["100.122.18.49", "dev-oli.tail74d55a.ts.net", "*.trycloudflare.com"]
      : undefined,
  // Isolate ad-hoc remote dev servers from the regular `.next` directory.
  distDir: process.env.KLIPCODE_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;

// Remote bindings let `env.AI` work in local `next dev` — Workers AI has no
// local emulation and must proxy to Cloudflare. Enable them ONLY for the dev
// server: the remote proxy needs a `wrangler login` session, so turning it on
// during `next build` (CI/production, never logged in) crashes with "You must
// be logged in to use wrangler dev in remote mode". Only bindings marked
// `"remote": true` in wrangler.jsonc (currently just `ai`) use the proxy; the
// rest stay local. In dev without a login the AI route degrades to local-only.
const enableRemoteBindings =
  process.env.NODE_ENV === "development" && process.env.KLIPCODE_REMOTE_BINDINGS !== "false";
import('@opennextjs/cloudflare').then((m) =>
  m.initOpenNextCloudflareForDev({ remoteBindings: enableRemoteBindings }),
);
