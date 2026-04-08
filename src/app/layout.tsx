import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://klipcode.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KlipCode",
    template: "%s · KlipCode",
  },
  description:
    "Code snippet manager with cloud sync. Save, organize, and copy your snippets instantly across all your devices.",
  keywords: [
    "code snippets",
    "snippet manager",
    "developer tools",
    "cloud sync",
    "code organizer",
  ],
  authors: [{ name: "KlipCode" }],
  applicationName: "KlipCode",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "KlipCode — Multi-device snippet manager",
    description:
      "Code snippet manager with cloud sync. Save, organize, and copy your snippets instantly across all your devices.",
    siteName: "KlipCode",
  },
  twitter: {
    card: "summary",
    title: "KlipCode — Multi-device snippet manager",
    description:
      "Code snippet manager with cloud sync. Save, organize, and copy your snippets instantly across all your devices.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
