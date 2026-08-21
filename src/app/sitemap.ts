import type { MetadataRoute } from "next";
import { localeHref } from "@/lib/locale";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://klipcode.com";

const url = (path: string) => `${siteUrl}${path}`;

// lastmod only carries weight with Google when it actually reflects real
// content changes — a fresh `new Date()` on every build/request makes Google
// ignore it. Bump this constant when the indexed pages meaningfully change.
const LAST_UPDATED = new Date("2026-07-04");

const languages = (path: string) => ({
  en: url(localeHref("en", path)),
  es: url(localeHref("es", path)),
  "x-default": url(localeHref("en", path)),
});

export default function sitemap(): MetadataRoute.Sitemap {
  // English is prefix-less (localeHref("en", ...)); Spanish keeps /es.
  return [
    {
      url: url(localeHref("en")),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages: languages("") },
    },
    {
      url: url(localeHref("es")),
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages: languages("") },
    },
  ];
}
