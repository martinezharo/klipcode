import { type NextRequest, NextResponse } from "next/server";

const locales = ["en", "es"] as const;
const defaultLocale = "en";

function getPreferredLocale(request: NextRequest): string {
  const accept = request.headers.get("accept-language");
  if (!accept) return defaultLocale;

  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().split("-")[0].toLowerCase();
    if (locales.includes(code as (typeof locales)[number])) return code;
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
  );
  if (pathnameHasLocale) return;

  const locale = getPreferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon\\.svg|favicon\\.ico|landing|.*\\..*).*)"],
};
