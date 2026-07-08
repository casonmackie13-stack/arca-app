import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import type { VideoCropRect } from "@/lib/scanner/cropMapping";
import type { ScanMetadata } from "@/lib/scanner/scanMetadata";

const DEBUG_KEY = "arcaScannerDebug";

export function isScannerDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage.getItem(DEBUG_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export type ScannerDebugSnapshot = {
  scanType: ScanType;
  targetAspect: number;
  outputWidth: number;
  outputHeight: number;
  videoWidth: number;
  videoHeight: number;
  videoDisplayWidth: number;
  videoDisplayHeight: number;
  guideLeft: number;
  guideTop: number;
  guideWidth: number;
  guideHeight: number;
  crop: VideoCropRect;
};

export function logScannerDebug(snapshot: ScannerDebugSnapshot) {
  if (!isScannerDebugEnabled()) return;
  console.group("[ARCA Scanner Debug]");
  console.table(snapshot);
  console.groupEnd();
}

export function logCaptureMetadata(metadata: ScanMetadata) {
  if (!isScannerDebugEnabled()) return;
  console.group("[ARCA Scanner Debug] capture metadata");
  console.info({
    opencv_status: metadata.opencv_status,
    crop_method: metadata.crop_method,
    crop_fallback_reason: metadata.crop_fallback_reason,
    edge_confidence: metadata.edgeConfidence,
    corners: metadata.corners,
    selected_burst_index: metadata.selected_burst_index,
    guide_rect_native: metadata.guide_rect_native,
    videoWidth: metadata.videoWidth,
    videoHeight: metadata.videoHeight,
  });
  console.groupEnd();
}

export function createCaptureDebugCanvas(
  video: HTMLVideoElement,
  crop: VideoCropRect,
): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0);
  ctx.strokeStyle = "#ff2d2d";
  ctx.lineWidth = Math.max(2, Math.round(video.videoWidth / 500));
  ctx.strokeRect(crop.sx, crop.sy, crop.sw, crop.sh);
  return canvas;
}

export function reportCaptureDebug(
  video: HTMLVideoElement,
  guideFrameRect: DOMRect,
  crop: VideoCropRect,
  scanType: ScanType,
) {
  if (!isScannerDebugEnabled()) return;

  const config = scanTypeConfig[scanType];
  const videoRect = video.getBoundingClientRect();
  const snapshot: ScannerDebugSnapshot = {
    scanType,
    targetAspect: config.aspectRatio,
    outputWidth: config.output.width,
    outputHeight: config.output.height,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    videoDisplayWidth: videoRect.width,
    videoDisplayHeight: videoRect.height,
    guideLeft: guideFrameRect.left,
    guideTop: guideFrameRect.top,
    guideWidth: guideFrameRect.width,
    guideHeight: guideFrameRect.height,
    crop,
  };

  logScannerDebug(snapshot);

  const debugCanvas = createCaptureDebugCanvas(video, crop);
  if (debugCanvas) {
    const url = debugCanvas.toDataURL("image/jpeg", 0.85);
    console.info("[ARCA Scanner Debug] source frame with crop rectangle:", url);
  }
}
