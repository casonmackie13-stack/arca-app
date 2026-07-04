/** ARCA scanner foundation — shared types for the event-driven capture flow. */

export type ScanType = "raw" | "graded";

export type CaptureMode = "manual" | "auto";

export type ScannerPhase =
  | "INITIALIZING"
  | "CAMERA_READY"
  | "SEARCHING"
  | "READY"
  | "CAPTURING"
  | "PREVIEW"
  | "ERROR";

export type ScannerState = {
  phase: ScannerPhase;
  scanType: ScanType;
  autoCaptureEnabled: boolean;
  error: string | null;
  previewUrl: string | null;
  capturedFile: File | null;
  captureMode: CaptureMode | null;
};

export type ScannerEvent =
  | { type: "OPEN" }
  | { type: "CAMERA_READY" }
  | { type: "CAMERA_ERROR"; message: string }
  | { type: "SET_SCAN_TYPE"; scanType: ScanType }
  | { type: "TOGGLE_AUTO_CAPTURE" }
  | { type: "CAPTURE_START"; mode: CaptureMode }
  | { type: "CAPTURE_SUCCESS"; file: File; previewUrl: string; mode: CaptureMode }
  | { type: "CAPTURE_FAILED"; message: string }
  | { type: "PREVIEW_RETAKE" }
  | { type: "CLOSE" };

export type GuidedCaptureResult = {
  file: File;
  scanType: ScanType;
};

export const initialScannerState: ScannerState = {
  phase: "INITIALIZING",
  scanType: "raw",
  autoCaptureEnabled: false,
  error: null,
  previewUrl: null,
  capturedFile: null,
  captureMode: null,
};

export function isCameraPhase(phase: ScannerPhase) {
  return phase === "INITIALIZING"
    || phase === "CAMERA_READY"
    || phase === "SEARCHING"
    || phase === "READY"
    || phase === "CAPTURING";
}

export function scannerPhaseLabel(phase: ScannerPhase) {
  switch (phase) {
    case "INITIALIZING": return "Starting camera…";
    case "CAMERA_READY": return "Camera ready";
    case "SEARCHING": return "Fit card in frame";
    case "READY": return "Hold steady";
    case "CAPTURING": return "Capturing…";
    case "PREVIEW": return "Review capture";
    case "ERROR": return "Camera unavailable";
  }
}
