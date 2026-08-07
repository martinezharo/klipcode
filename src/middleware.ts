import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/locale";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const INTERNAL_LOCALE_HEADER = "x-klipcode-internal-locale";

function setLocaleCookie(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

/**
 * Resolve the preferred locale for a prefix-less request: an explicit cookie
 * choice wins, then the browser's Accept-Language, then the default (English).
 */
function getPreferredLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const accept = request.headers.get("accept-language");
  if (accept) {
    for (const part of accept.split(",")) {
      const code = part.split(";")[0].trim().split("-")[0].toLowerCase();
      if (isLocale(code)) return code;
    }
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Spanish keeps its prefix. Treat visiting it as an explicit choice.
  if (pathname === "/es" || pathname.startsWith("/es/")) {
    return setLocaleCookie(NextResponse.next(), "es");
  }

  // Legacy English-prefixed URLs are gone: permanently (308) redirect to the
  // clean path and remember the explicit English choice.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    // A rewrite to the internal /en route tree passes through middleware a
    // second time in Next.js. Keep that internal request in the route tree;
    // otherwise /app would redirect forever between /app and /en/app.
    if (request.headers.get(INTERNAL_LOCALE_HEADER) === "en") {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = pathname.slice("/en".length) || "/";
    return setLocaleCookie(NextResponse.redirect(url, 308), "en");
  }

  // A clean (prefix-less) path is English by default, but a Spanish preference
  // (cookie or Accept-Language) redirects to /es. This redirect depends on the
  // request headers/cookie, so it is temporary (307) and must vary on them.
  const locale = getPreferredLocale(request);
  if (locale === "es") {
    const url = request.nextUrl.clone();
    url.pathname = `/es${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Vary", "Accept-Language, Cookie");
    return response;
  }

  // English: keep the clean URL but serve the /en route tree via an internal
  // rewrite (the [locale] segment can't match a prefix-less path directly).
  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INTERNAL_LOCALE_HEADER, "en");
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon\\.svg|favicon\\.ico|landing|.*\\..*).*)"],
};
