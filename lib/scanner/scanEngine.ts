/**
 * ARCA scanner foundation — public API for the Add Card capture flow.
 *
 * Vision, OCR, and enhancement modules are intentionally not exported here yet.
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
