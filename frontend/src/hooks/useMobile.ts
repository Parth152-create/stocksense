"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when viewport width is <= the given breakpoint (default 768px).
 * Safe for SSR — returns false on the server so layout matches desktop first.
 */
export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Returns the current breakpoint label.
 * "xs" < 480 | "sm" < 640 | "md" < 768 | "lg" < 1024 | "xl" >= 1024
 */
export function useBreakpoint(): "xs" | "sm" | "md" | "lg" | "xl" {
  const [bp, setBp] = useState<"xs" | "sm" | "md" | "lg" | "xl">("xl");

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w < 480)  return setBp("xs");
      if (w < 640)  return setBp("sm");
      if (w < 768)  return setBp("md");
      if (w < 1024) return setBp("lg");
      setBp("xl");
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return bp;
}