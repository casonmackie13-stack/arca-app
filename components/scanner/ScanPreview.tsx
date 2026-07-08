"use client";

import { useEffect } from "react";
import ScannerPreview from "@/components/scanner/ScannerPreview";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** LEGACY SCANNER PATH — do not use for Add button flow. Use ScannerPreview instead. */
export default function ScanPreview(props: {
  previewUrl: string;
  scanType: ScanType;
  side: "front" | "back";
  onRetake: () => void;
  onUse: () => void;
}) {
  useEffect(() => {
    scanFlowLog("LEGACY_SCANNER_MOUNTED: ScanPreview");
  }, []);

  return <ScannerPreview {...props} />;
}
