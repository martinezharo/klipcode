import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./pwa.css";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KlipCode",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
