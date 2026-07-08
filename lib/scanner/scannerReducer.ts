import {
  initialScannerState,
  isCameraPhase,
  type CameraStatus,
  type ScannerEvent,
  type ScannerState,
} from "@/lib/scanner/scannerTypes";

export function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event.type) {
    case "OPEN":
      return { ...initialScannerState, phase: "INITIALIZING" };

    case "CAMERA_STATUS":
      if (state.phase === "ERROR" || state.phase === "PREVIEW") return state;
      return { ...state, cameraStatus: event.status };

    case "CAMERA_READY":
      if (state.phase === "ERROR" || state.phase === "PREVIEW") return state;
      return { ...state, phase: "SEARCHING", error: null, cameraStatus: "ready" };

    case "CAMERA_ERROR":
      return { ...state, phase: "ERROR", error: event.message, cameraStatus: "failed" };

    case "SET_SCAN_TYPE":
      if (!isCameraPhase(state.phase) || state.phase === "CAPTURING") return state;
      return { ...state, scanType: event.scanType };

    case "TOGGLE_AUTO_CAPTURE":
      return { ...state, autoCaptureEnabled: !state.autoCaptureEnabled };

    case "CAPTURE_START":
      if (state.phase !== "SEARCHING" && state.phase !== "READY" && state.phase !== "CAMERA_READY") return state;
      return { ...state, phase: "CAPTURING", captureMode: event.mode, error: null };

    case "CAPTURE_SUCCESS":
      return {
        ...state,
        phase: "PREVIEW",
        capturedFile: event.file,
        capturedOriginalFile: event.originalFile,
        previewUrl: event.previewUrl,
        captureMode: event.mode,
        qualityRecord: event.qualityRecord ?? null,
        captureMetadata: event.metadata ?? null,
        aiQuality: null,
        aiQualityLoading: false,
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
        cameraStatus: "idle",
        previewUrl: null,
        capturedFile: null,
        capturedOriginalFile: null,
        captureMode: null,
        qualityRecord: null,
        captureMetadata: null,
        aiQuality: null,
        aiQualityLoading: false,
        error: null,
      };

    case "AI_QUALITY_START":
      return { ...state, aiQualityLoading: true };

    case "AI_QUALITY_SUCCESS":
      return { ...state, aiQualityLoading: false, aiQuality: event.quality };

    case "AI_QUALITY_FAILED":
      return { ...state, aiQualityLoading: false };

    case "CLOSE":
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      return { ...initialScannerState };

    default:
      return state;
  }
}
