"use client";

import { useEffect, useRef, type RefObject } from "react";

const FRAME_CLEARANCE_PX = 16;

export function useScannerSafeArea(
  active: boolean,
  headerRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function applyMetrics(topPx: number, bottomPx: number) {
      const root = rootRef.current;
      if (!root) return;
      const bottomReserved = bottomPx + FRAME_CLEARANCE_PX;
      root.style.setProperty("--scanner-top-reserved", `${topPx}px`);
      root.style.setProperty("--scanner-bottom-reserved", `${bottomReserved}px`);
      root.style.setProperty("--scanner-frame-clearance", `${FRAME_CLEARANCE_PX}px`);
      root.style.setProperty(
        "--scanner-usable-height",
        `calc(100dvh - ${topPx}px - ${bottomReserved}px)`,
      );
    }

    function measure() {
      const topPx = headerRef.current?.getBoundingClientRect().height ?? 0;
      const bottomPx = footerRef.current?.getBoundingClientRect().height ?? 0;
      applyMetrics(topPx, bottomPx);
    }

    measure();

    const layoutFrame = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    if (footerRef.current) observer.observe(footerRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      cancelAnimationFrame(layoutFrame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [active, footerRef, headerRef]);

  return rootRef;
}
