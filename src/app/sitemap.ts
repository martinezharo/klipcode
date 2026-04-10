import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://klipcode.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${siteUrl}/en`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
      alternates: {
        languages: { en: `${siteUrl}/en`, es: `${siteUrl}/es` },
      },
    },
    {
      url: `${siteUrl}/es`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
      alternates: {
        languages: { en: `${siteUrl}/en`, es: `${siteUrl}/es` },
      },
    },
    {
      url: `${siteUrl}/en/app`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: { en: `${siteUrl}/en/app`, es: `${siteUrl}/es/app` },
      },
    },
    {
      url: `${siteUrl}/es/app`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: { en: `${siteUrl}/en/app`, es: `${siteUrl}/es/app` },
      },
    },
  ];
}
