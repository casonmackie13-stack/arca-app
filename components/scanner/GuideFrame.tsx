"use client";

import { useEffect, type RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanType } from "@/lib/scanner/scannerTypes";

export type GuideFrameVisualState = "searching" | "detected" | "locked";

/** Canonical visible guide frame — positioned in video coordinate space via CSS vars. */
export default function GuideFrame({
  scanType,
  guideFrameRef,
  visualState,
}: {
  scanType: ScanType;
  guideFrameRef: RefObject<HTMLDivElement | null>;
  visualState: GuideFrameVisualState;
}) {
  const config = scanTypeConfig[scanType];
  const isGold = visualState === "detected" || visualState === "locked";
  const borderColor = isGold ? "rgba(201, 164, 93, 0.88)" : "rgba(255, 255, 255, 0.62)";

  useEffect(() => {
    scanFlowLog("Guide frame mounted", { component: "GuideFrame", scanType, aspect: config.guideAspect });
  }, [config.guideAspect, scanType]);

  return (
    <div
      ref={guideFrameRef}
      data-arca-guide-frame
      className={`scanner-guide-frame pointer-events-none absolute z-[15] box-border rounded-xl bg-transparent ${
        visualState === "searching"
          ? "scanner-guide-frame--searching"
          : visualState === "locked"
            ? "scanner-guide-frame--locked"
            : "scanner-guide-frame--detected"
      }`}
      style={{
        left: "var(--scanner-frame-left, 50%)",
        top: "var(--scanner-frame-top, 50%)",
        width: "var(--scanner-frame-width, 280px)",
        height: "var(--scanner-frame-height, 392px)",
        minWidth: "200px",
        minHeight: scanType === "graded" ? "320px" : "280px",
        border: `1.5px solid ${borderColor}`,
        boxShadow: isGold
          ? "0 0 0 9999px rgba(0,0,0,0.38), 0 0 0 1px rgba(201,164,93,0.18), 0 0 24px rgba(201,164,93,0.22)"
          : "0 0 0 9999px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    />
  );
}
