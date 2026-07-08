import type { ScanType } from "@/components/scanner/scanTypes";

/** ARCA Scan Engine v1 — shared geometry & quality types */

export type Point = { x: number; y: number };

/** @deprecated alias — use Point */
export type ScanPoint = Point;

export type ScanQualityMetrics = {
  blurScore: number;
  brightnessScore: number;
  glareScore?: number;
  shadowScore?: number;
  tiltScore?: number;
  fillRatio: number;
  stabilityScore: number;
};

export type ScanDetectionResult = {
  found: boolean;
  corners?: Point[];
  confidence: number;
  message?: string;
  quality: ScanQualityMetrics;
};

/** @deprecated alias — use ScanDetectionResult */
export type CardEdgeDetection = ScanDetectionResult;

export type ScanRecognitionPreview = {
  available: boolean;
  detectedLabel?: string;
  confidence?: number;
  warnings?: string[];
  multipleCards?: boolean;
};

export type ScanMetadata = {
  scanType: ScanType;
  captureMode: "auto" | "manual";
  edgeDetected: boolean;
  perspectiveCorrected: boolean;
  fallbackCrop?: boolean;
  edgeConfidence?: number;
  quality?: ScanQualityMetrics;
  /** Prepared for future live recognition; v1 uses post-capture preview only */
  recognition?: ScanRecognitionPreview;
};

/** @deprecated Use ScanMetadata */
export type ScanCaptureMetadata = ScanMetadata & {
  overlayCropSucceeded?: boolean;
};

/** @deprecated Use GuidedCaptureResult from scannerTypes.ts */
export type LegacyGuidedCaptureResult = {
  file: File;
  scanType: ScanType;
  metadata: ScanMetadata;
  ocrText?: string;
};

export type ScannerMessage =
  | "find-edges"
  | "move-closer"
  | "hold-steady"
  | "too-blurry"
  | "too-much-glare"
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

export type ScanRecognitionPayload = {
  scanType: ScanType;
  captureMode: "auto" | "manual";
  edgeDetected: boolean;
  perspectiveCorrected: boolean;
  edgeConfidence?: number;
  quality?: ScanQualityMetrics;
  ocrText?: string;
};
