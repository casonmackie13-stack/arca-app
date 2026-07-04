import type { ScanType } from "@/components/scanner/scanTypes";

export type ScanPoint = { x: number; y: number };

export type ScanQualityMetrics = {
  blurScore: number;
  brightnessScore: number;
  glareScore?: number;
  shadowScore?: number;
  tiltScore?: number;
  fillRatio?: number;
  stabilityScore?: number;
};

export type CardEdgeDetection = {
  found: boolean;
  corners?: ScanPoint[];
  confidence: number;
  reason?: string;
  metrics: ScanQualityMetrics;
};

export type ScanCaptureMode = "edge-detected" | "guide-frame" | "full-frame";

export type ScanCaptureMetadata = {
  captureMode: ScanCaptureMode;
  perspectiveCorrected: boolean;
  overlayCropSucceeded: boolean;
  edgeConfidence?: number;
  qualityMetrics?: ScanQualityMetrics;
  scanType: ScanType;
};

export type GuidedCaptureResult = {
  file: File;
  scanType: ScanType;
  metadata: ScanCaptureMetadata;
};

export type ScanUiState = "searching" | "unstable" | "quality-issue" | "ready";

export type OcrWord = {
  text: string;
  confidence: number;
};

export type OcrResult = {
  text: string;
  confidence?: number;
  words?: OcrWord[];
};

export type SideOcrState = {
  loading: boolean;
  result: OcrResult | null;
  error?: string;
};
