"use client";

import { useEffect, type RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** Canonical visible guide frame for Scanner.tsx. */
export default function GuideFrame({
  scanType,
  guideFrameRef,
}: {
  scanType: ScanType;
  guideFrameRef: RefObject<HTMLDivElement | null>;
}) {
  const config = scanTypeConfig[scanType];

  useEffect(() => {
    scanFlowLog("Guide frame mounted", { component: "GuideFrame", scanType, aspect: config.guideAspect });
  }, [config.guideAspect, scanType]);

  return (
    <div className="pointer-events-none absolute inset-x-0 z-[15]">
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{
          top: "var(--scanner-top-reserved, calc(env(safe-area-inset-top) + 72px))",
          bottom: "var(--scanner-bottom-reserved, calc(env(safe-area-inset-bottom) + 220px))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div
          ref={guideFrameRef}
          data-arca-guide-frame
          className="relative box-border rounded-[1.35rem] bg-transparent"
          style={{
            width: "var(--scanner-frame-width, min(72vw, 320px))",
            height: "var(--scanner-frame-height, auto)",
            minWidth: "200px",
            minHeight: scanType === "graded" ? "320px" : "280px",
            maxWidth: "calc(100% - 2rem)",
            maxHeight: "100%",
            aspectRatio: config.guideAspect,
            border: "3px solid #C9A45D",
            boxShadow: "0 0 0 9999px rgba(0,0,0,.42)",
          }}
        />
      </div>
    </div>
  );
}
