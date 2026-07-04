import {
  initialScannerState,
  isCameraPhase,
  type ScannerEvent,
  type ScannerState,
} from "@/lib/scanner/scannerTypes";

export function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event.type) {
    case "OPEN":
      return { ...initialScannerState, phase: "INITIALIZING" };

    case "CAMERA_READY":
      if (state.phase === "ERROR" || state.phase === "PREVIEW") return state;
      return { ...state, phase: "SEARCHING", error: null };

    case "CAMERA_ERROR":
      return { ...state, phase: "ERROR", error: event.message };

    case "SET_SCAN_TYPE":
      if (!isCameraPhase(state.phase) || state.phase === "CAPTURING") return state;
      return { ...state, scanType: event.scanType };

    case "TOGGLE_AUTO_CAPTURE":
      // Reserved for future auto-capture; toggle state only.
      return { ...state, autoCaptureEnabled: !state.autoCaptureEnabled };

    case "CAPTURE_START":
      if (state.phase !== "SEARCHING" && state.phase !== "READY" && state.phase !== "CAMERA_READY") return state;
      return { ...state, phase: "CAPTURING", captureMode: event.mode, error: null };

    case "CAPTURE_SUCCESS":
      return {
        ...state,
        phase: "PREVIEW",
        capturedFile: event.file,
        previewUrl: event.previewUrl,
        captureMode: event.mode,
        error: null,
      };

    case "CAPTURE_FAILED":
      return {
        ...state,
        phase: state.capturedFile ? "PREVIEW" : "SEARCHING",
        error: event.message,
        captureMode: null,
      };

    case "PREVIEW_RETAKE":
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      return {
        ...state,
        phase: "INITIALIZING",
        previewUrl: null,
        capturedFile: null,
        captureMode: null,
        error: null,
      };

    case "CLOSE":
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      return { ...initialScannerState };

    default:
      return state;
  }
}
