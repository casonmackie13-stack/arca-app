"use client";

import { useEffect, type RefObject } from "react";
import GuideFrame from "@/components/scanner/GuideFrame";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** LEGACY SCANNER PATH — do not use for Add button flow. Use GuideFrame instead. */
export default function GuideFrameOverlay({
  scanType,
  overlayRef,
}: {
  scanType: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    scanFlowLog("LEGACY_SCANNER_MOUNTED: GuideFrameOverlay");
  }, []);

  return <GuideFrame scanType={scanType} guideFrameRef={overlayRef} />;
}
