import { Suspense } from "react";
import KlipCodeApp from "@/components/KlipCodeApp";
import { AppProviders } from "@/components/AppProviders";

type Locale = "en" | "es";

export default async function AppPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <AppProviders>
      <Suspense>
        <KlipCodeApp locale={locale as Locale} />
      </Suspense>
    </AppProviders>
  );
}
