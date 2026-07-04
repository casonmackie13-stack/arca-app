import type { ScanType } from "@/components/scanner/scanTypes";

export type ScanPoint = { x: number; y: number };

export type ScanQualityMetrics = {
  blurScore: number;
  brightnessScore: number;
  glareScore?: number;
  shadowScore?: number;
  tiltScore?: number;
  fillRatio: number;
  stabilityScore: number;
};

export type CardEdgeDetection = {
  found: boolean;
  corners?: ScanPoint[];
  confidence: number;
  message?: string;
  quality: ScanQualityMetrics;
};

export type ScanMetadata = {
  scanType: ScanType;
  captureMode: "auto" | "manual";
  edgeDetected: boolean;
  perspectiveCorrected: boolean;
  fallbackCrop?: boolean;
  edgeConfidence?: number;
  quality?: ScanQualityMetrics;
};

/** @deprecated Use ScanMetadata — kept for Add Card pipeline compatibility */
export type ScanCaptureMetadata = ScanMetadata & {
  overlayCropSucceeded?: boolean;
};

export type GuidedCaptureResult = {
  file: File;
  scanType: ScanType;
  metadata: ScanMetadata;
};

export type ScannerMessage =
  | "find-edges"
  | "move-closer"
  | "hold-steady"
  | "too-blurry"
  | "more-light"
  | "ready"
  | "capturing";

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
