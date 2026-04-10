"use client";

import { useEffect, useRef, useState } from "react";

export function HeroPerspective({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when element top is at viewport bottom, 1 when it's scrolled well into view
      const raw = 1 - rect.top / vh;
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // rotateX goes from 12deg (tilted back) to 0deg (flat)
  const rotateX = 12 * (1 - progress);
  const scale = 0.96 + 0.04 * progress;

  return (
    <div ref={ref} className="group perspective-distant">
      <div
        className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:rotate-x-2 group-hover:scale-[1.01]"
        style={{
          transform: `rotateX(${rotateX}deg) scale(${scale})`,
          transformOrigin: "center bottom",
        }}
      >
        {children}
      </div>
    </div>
  );
}
