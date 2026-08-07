"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { AppProviders } from "@/components/AppProviders";

// The workspace is entirely browser-owned: authentication, IndexedDB, and the
// editor all require client APIs. Keeping this tree out of the server render
// also prevents CodeMirror, lowlight, and the optional Prettier formatter from
// being bundled into the Cloudflare Worker.
const KlipCodeApp = dynamic(() => import("@/components/KlipCodeApp"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background" aria-hidden="true" />,
});

export function AppPageClient({ locale }: { locale: "en" | "es" }) {
  return (
    <AppProviders>
      <Suspense>
        <KlipCodeApp locale={locale} />
      </Suspense>
    </AppProviders>
  );
}
