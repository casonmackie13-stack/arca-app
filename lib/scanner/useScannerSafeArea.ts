"use client";

import { useEffect, useRef, type RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { computeGuideFrameSize } from "@/lib/scanner/cropMapping";
import type { ScanType } from "@/lib/scanner/scannerTypes";

const FRAME_CLEARANCE_PX = 20;

export function useScannerSafeArea(
  active: boolean,
  headerRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
  scanType: ScanType,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function applyMetrics(topPx: number, bottomPx: number) {
      const root = rootRef.current;
      if (!root) return;

      const rootRect = root.getBoundingClientRect();
      const bottomReserved = bottomPx + FRAME_CLEARANCE_PX;
      const usableWidth = Math.max(0, rootRect.width);
      const usableHeight = Math.max(0, rootRect.height - topPx - bottomReserved);
      const frame = computeGuideFrameSize(
        usableWidth,
        usableHeight,
        scanTypeConfig[scanType].aspectRatio,
      );

      root.style.setProperty("--scanner-top-reserved", `${topPx}px`);
      root.style.setProperty("--scanner-bottom-reserved", `${bottomReserved}px`);
      root.style.setProperty("--scanner-frame-clearance", `${FRAME_CLEARANCE_PX}px`);
      root.style.setProperty("--scanner-usable-width", `${usableWidth}px`);
      root.style.setProperty("--scanner-usable-height", `${usableHeight}px`);
      root.style.setProperty("--scanner-frame-width", `${frame.width}px`);
      root.style.setProperty("--scanner-frame-height", `${frame.height}px`);
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
    if (rootRef.current) observer.observe(rootRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      cancelAnimationFrame(layoutFrame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [active, footerRef, headerRef, scanType]);

  return rootRef;
}
