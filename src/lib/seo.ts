import type { Metadata } from "next";
import { localeHref, type Locale } from "@/lib/locale";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://klipcode.com";

/**
 * Builds canonical/hreflang + Open Graph/Twitter metadata for a single page.
 * `path` must match the page this is called from (e.g. "" for the home page,
 * "/app" for the app) so the canonical points at that page, not the locale root.
 */
export function buildPageMetadata({
  locale,
  path = "",
  title,
  description,
  markdownAlternate,
}: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  markdownAlternate?: string;
}): Metadata {
  const canonical = `${siteUrl}${localeHref(locale, path)}`;
  const socialImage = `${siteUrl}/og-image.png`;
  // Titles that are already fully branded (e.g. "KlipCode — ...") would
  // otherwise get "· KlipCode" appended twice via the root layout's
  // title.template; `absolute` opts out of the template for those.
  const pageTitle = title.startsWith("KlipCode") ? { absolute: title } : title;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${siteUrl}${localeHref("en", path)}`,
        es: `${siteUrl}${localeHref("es", path)}`,
        "x-default": `${siteUrl}${localeHref("en", path)}`,
      },
      ...(markdownAlternate
        ? { types: { "text/markdown": `${siteUrl}${markdownAlternate}` } }
        : {}),
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "KlipCode",
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "KlipCode" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

/**
 * JSON-LD `WebApplication` schema for the landing page. The free offer and
 * product features are reflected in structured data for search engines.
 */
export function buildWebApplicationJsonLd({
  locale,
  name,
  description,
  featureList,
}: {
  locale: Locale;
  name: string;
  description: string;
  featureList?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: `${siteUrl}${localeHref(locale)}`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    isAccessibleForFree: true,
    screenshot: `${siteUrl}/landing/ui-dark.webp`,
    sameAs: ["https://github.com/martinezharo/klipcode"],
    ...(featureList?.length ? { featureList } : {}),
    inLanguage: locale,
  };
}

/**
 * JSON-LD `FAQPage` schema built from the landing page's FAQ section, so the
 * rendered questions and the structured data can never drift apart.
 */
export function buildFaqJsonLd(items: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
