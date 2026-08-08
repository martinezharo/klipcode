import type { Metadata } from "next";
import { AppPageClient } from "@/components/AppPageClient";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/lib/locale";
import { buildPageMetadata } from "@/lib/seo";

type Locale = "en" | "es";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc: Locale = isLocale(locale) ? locale : "en";
  const dict = getDictionary(loc);

  return buildPageMetadata({
    locale: loc,
    path: "/app",
    title: dict.meta.app.title,
    description: dict.meta.app.description,
  });
}

export default async function AppPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <AppPageClient locale={locale as Locale} />;
}
