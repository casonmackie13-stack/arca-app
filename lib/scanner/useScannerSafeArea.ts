"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { computeGuideFrameSize } from "@/lib/scanner/cropMapping";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanType } from "@/lib/scanner/scannerTypes";

const FRAME_CLEARANCE_PX = 20;
const MIN_FRAME_WIDTH = 200;

export const SCANNER_CSS_DEFAULTS = {
  "--scanner-top-reserved": "calc(env(safe-area-inset-top) + 72px)",
  "--scanner-bottom-reserved": "calc(env(safe-area-inset-bottom) + 220px)",
  "--scanner-frame-width": "280px",
  "--scanner-frame-height": "392px",
} as Record<string, string>;

export function useScannerSafeArea(
  open: boolean,
  headerRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
  scanType: ScanType,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    function applyMetrics(topPx: number, bottomPx: number) {
      const root = rootRef.current;
      if (!root) return;

      const rootRect = root.getBoundingClientRect();
      const bottomReserved = bottomPx + FRAME_CLEARANCE_PX;
      const usableWidth = Math.max(0, rootRect.width);
      const usableHeight = Math.max(0, rootRect.height - topPx - bottomReserved);
      let frame = computeGuideFrameSize(
        usableWidth,
        usableHeight,
        scanTypeConfig[scanType].aspectRatio,
      );

      if (frame.width < MIN_FRAME_WIDTH || frame.height < MIN_FRAME_WIDTH) {
        const fallback = computeGuideFrameSize(
          Math.max(usableWidth, 320),
          Math.max(usableHeight, 480),
          scanTypeConfig[scanType].aspectRatio,
          0.85,
        );
        frame = {
          width: Math.max(frame.width, fallback.width, MIN_FRAME_WIDTH),
          height: Math.max(
            frame.height,
            fallback.height,
            MIN_FRAME_WIDTH / scanTypeConfig[scanType].aspectRatio,
          ),
        };
        scanFlowLog("Guide frame used fallback dimensions", frame);
      }

      root.style.setProperty("--scanner-top-reserved", `${topPx}px`);
      root.style.setProperty("--scanner-bottom-reserved", `${bottomReserved}px`);
      root.style.setProperty("--scanner-frame-clearance", `${FRAME_CLEARANCE_PX}px`);
      root.style.setProperty("--scanner-usable-width", `${usableWidth}px`);
      root.style.setProperty("--scanner-usable-height", `${usableHeight}px`);
      root.style.setProperty("--scanner-frame-width", `${frame.width}px`);
      root.style.setProperty("--scanner-frame-height", `${frame.height}px`);

      scanFlowLog("Guide frame metrics", {
        scanType,
        topPx,
        bottomPx,
        usableWidth,
        usableHeight,
        frameWidth: frame.width,
        frameHeight: frame.height,
      });
    }

    function measure() {
      const topPx = headerRef.current?.getBoundingClientRect().height ?? 72;
      const bottomPx = footerRef.current?.getBoundingClientRect().height ?? 200;
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
  }, [open, footerRef, headerRef, scanType]);

  return rootRef;
}
