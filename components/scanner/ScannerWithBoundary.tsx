"use client";

import dynamic from "next/dynamic";
import ScannerErrorBoundary from "@/components/scanner/ScannerErrorBoundary";
import type { GuidedCaptureResult, ScanSequence } from "@/lib/scanner/scannerTypes";

const Scanner = dynamic(() => import("@/components/scanner/SimpleScanner"), {
  ssr: false,
  loading: () => null,
});

/** SSR-safe scanner entry — dynamic import + error boundary. */
export default function ScannerWithBoundary({
  open,
  activeSide,
  sequence,
  resetKey,
  onClose,
  onUseCapture,
  onSkipBack,
  onFileFallback,
}: {
  open: boolean;
  activeSide: "front" | "back";
  sequence: ScanSequence;
  resetKey: number;
  onClose: () => void;
  onUseCapture: (result: GuidedCaptureResult, side: "front" | "back") => void;
  onSkipBack?: () => void;
  onFileFallback: (file: File | null, side: "front" | "back") => void;
}) {
  if (!open) return null;

  return (
    <ScannerErrorBoundary
      activeSide={activeSide}
      onClose={onClose}
      onFileFallback={onFileFallback}
    >
      <Scanner
        open={open}
        activeSide={activeSide}
        sequence={sequence}
        resetKey={resetKey}
        onClose={onClose}
        onUseCapture={onUseCapture}
        onSkipBack={onSkipBack}
        onFileFallback={onFileFallback}
      />
    </ScannerErrorBoundary>
  );
}
