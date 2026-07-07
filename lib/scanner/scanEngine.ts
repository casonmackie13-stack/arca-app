/**
 * ARCA scanner foundation — public API for the Add Card capture flow.
 *
 * Active Add path: Navigation → /cards/new?scan=1 → AddCardClient → GuidedCardScanner → processGuidedCapture.
 * Unused in Add flow: cardVision.ts, BoundaryOverlay, LiveEdgeOverlay, useLiveDetection, app/scan/page.tsx.
 */

export { processGuidedCapture } from "@/lib/scanner/captureProcessor";
export { scannerReducer } from "@/lib/scanner/scannerReducer";

export {
  initialScannerState,
  isCameraPhase,
  scannerPhaseLabel,
} from "@/lib/scanner/scannerTypes";

export { useBodyScrollLock } from "@/lib/scanner/useBodyScrollLock";

export type {
  ScanType,
  CaptureMode,
  ScannerPhase,
  ScannerState,
  ScannerEvent,
  ScanSequence,
  ScannerSession,
  GuidedCaptureResult,
} from "@/lib/scanner/scannerTypes";

export { scanTypeConfig } from "@/components/scanner/scanTypes";
