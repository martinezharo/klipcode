import type { Metadata } from "next";
import "./globals.css";

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
  return children;
}
