"use client";

import { useEffect, useRef, useState } from "react";

export function HeroPerspective({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0 to 1
    const y = (e.clientY - rect.top) / rect.height; // 0 to 1
    
    // Convert to -1 to 1
    setMousePos({ x: (x - 0.5) * 2, y: (y - 0.5) * 2 });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setMousePos({ x: 0, y: 0 });
  };

  // rotateX goes from 12deg (tilted back) to 0deg (flat)
  const baseRotateX = 12 * (1 - progress);
  
  // Apply hover modifiers
  const rotateX = isHovering ? baseRotateX - (mousePos.y * 3) : baseRotateX;
  const rotateY = isHovering ? mousePos.x * 5 : 0;
  const scale = (0.96 + 0.04 * progress) * (isHovering ? 1.01 : 1);

  return (
    <div 
      ref={ref} 
      className="group perspective-distant md:perspective-[2000px]"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
