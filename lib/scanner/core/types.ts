import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { Point, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";
import type { OpenCvStatus } from "@/lib/scanner/opencvLoader";

export type CropMethod = "opencv_corners" | "guide_fallback" | "native_full" | "failed";

export type CapturedFrameAnalysis = {
  canvas: HTMLCanvasElement;
  detection: {
    found: boolean;
    corners?: Point[];
    confidence: number;
    quality: ScanQualityMetrics;
  } | null;
  blurScore: number;
  totalScore: number;
  index: number;
};

export type DocumentCaptureResult = {
  file: File;
  originalFile: File;
  scanType: ScanType;
  quality?: ScanQualityMetrics;
  metadata: {
    scanType: ScanType;
    captureMode: "manual" | "auto";
    crop_method: CropMethod;
    crop_fallback_reason?: string;
    edgeDetected: boolean;
    perspectiveCorrected: boolean;
    edgeConfidence?: number;
    corners?: Point[];
    captured_frame_corners?: Point[];
    live_corners_ignored: true;
    selected_burst_index?: number;
    guide_rect_native?: { sx: number; sy: number; sw: number; sh: number };
    videoWidth: number;
    videoHeight: number;
    opencv_status?: OpenCvStatus;
    quality?: ScanQualityMetrics;
  };
  qualityRecord?: {
    blur_score: number;
    glare_score: number;
    edge_confidence: number;
    lighting_score: number;
    overall_badge: "poor" | "good" | "excellent";
  };
};
