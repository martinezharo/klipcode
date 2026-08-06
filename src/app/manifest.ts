import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. The middleware matcher already excludes any
// path containing a dot, so this is not rewritten/redirected by the locale
// routing. Launching opens the app shell directly (a Spanish-preferring user is
// then redirected to /es/app by the middleware).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KlipCode — Code Snippet Manager",
    short_name: "KlipCode",
    description:
      "Cloud-synced code snippet manager. Save, organize, and access your library across every device.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "any",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
