import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }];
}

// Canonical/hreflang and Open Graph/Twitter metadata are page-specific (they
// must point at the page's own URL, not the locale root) so each page under
// this layout defines its own via generateMetadata + buildPageMetadata.

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <html
      lang={locale}
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        {/* Applies the stored theme before the body paints to avoid a flash of
            the wrong surface. Mirrors readTheme()/applyTheme() in lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
