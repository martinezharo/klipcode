/* eslint-disable @next/next/no-img-element -- preserve the pre-optimized native-resolution WebP */

"use client";

import { useLayoutEffect, useRef } from "react";

import { readTheme, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";

interface LandingHeroImageProps {
  alt: string;
  width: number;
  height: number;
  className?: string;
}

const DARK_SRC = "/landing/ui-dark.webp";
const LIGHT_SRC = "/landing/ui-light.webp";
const HERO_IMAGE_ID = "landing-hero-image";

// The blocking theme script has already set <html data-theme> before the body
// parser reaches this component. Assign the matching source immediately, while
// HTML is still being parsed, so the browser never downloads the wrong theme's
// screenshot and does not have to wait for React hydration to discover the LCP
// resource. The layout effect below covers client-side locale navigation,
// where an inline script inserted by React is not guaranteed to execute.
const HERO_IMAGE_INIT_SCRIPT = `(function(){var i=document.getElementById(${JSON.stringify(
  HERO_IMAGE_ID,
)});if(i)i.src=document.documentElement.dataset.theme==="light"?i.dataset.lightSrc:i.dataset.darkSrc;})();`;

export function LandingHeroImage({ alt, width, height, className }: LandingHeroImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const applyImageTheme = (theme: Theme) => {
      image.src = theme === "light" ? LIGHT_SRC : DARK_SRC;
    };
    const onThemeChange = (event: Event) => {
      applyImageTheme((event as CustomEvent<Theme>).detail);
    };

    // Runs before paint on client-side locale navigation. On a full document
    // load the parser-time script has already selected this same URL.
    applyImageTheme(readTheme());
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  // Plain <img> on purpose: this is a fixed, pre-optimized WebP served from
  // /public. Next/Image would only re-encode it (lossy) and pick a resized
  // variant — here we want the exact original bytes, downscaled by the browser
  // into the slot with no extra processing.
  return (
    <>
      <img
        ref={imageRef}
        id={HERO_IMAGE_ID}
        alt={alt}
        width={width}
        height={height}
        className={className}
        fetchPriority="high"
        data-dark-src={DARK_SRC}
        data-light-src={LIGHT_SRC}
        suppressHydrationWarning
      />
      <script dangerouslySetInnerHTML={{ __html: HERO_IMAGE_INIT_SCRIPT }} />
    </>
  );
}
