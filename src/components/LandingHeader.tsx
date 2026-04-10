"use client";

import { useEffect, useState } from "react";

export function LandingHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 z-50 w-full transition-[background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        backgroundColor: scrolled ? "rgba(10,10,10,0.8)" : "transparent",
        borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,0.06)" : "transparent"}`,
        backdropFilter: scrolled ? "blur(24px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px)" : "none",
      }}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-5 transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ height: scrolled ? "3.5rem" : "4rem" }}
      >
        {children}
      </nav>
    </header>
  );
}
