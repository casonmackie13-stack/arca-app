/**
 * ARCA Scan Engine v1 — public API surface for the Add Card document scanner.
 *
 * Pipeline: live edge detection → auto/manual capture → perspective correction →
 * natural enhancement → quality review → OCR → AI recognition preview → Add Card pipeline.
 */

export {
  detectCardEdges,
  detectCardEdgesFromCanvas,
  orderCorners,
  scoreCandidateContour,
  perspectiveCorrect,
  enhanceScan,
  calculateQualityMetrics,
  isReadyForAutoCapture,
  shouldAutoCapture,
  canvasToJpegFile,
} from "@/lib/scanner/cardVision";

export { processGuidedCapture, redetectForCapture } from "@/lib/scanner/captureProcessor";
export { runLocalOCR, terminateOcrWorker } from "@/lib/scanner/ocr";
export { runRecognitionPreview, buildRecognitionPayload, recognitionPreviewLabel } from "@/lib/scanner/recognitionPreview";
export { previewQualityWarnings, previewNeedsReview, assessCaptureQuality } from "@/lib/scanner/previewQuality";
export { resolveScannerMessage, scannerMessageLabel } from "@/lib/scanner/scannerMessages";
export { useLiveDetection } from "@/lib/scanner/useLiveDetection";

export type {
  Point,
  ScanDetectionResult,
  ScanQualityMetrics,
  ScanMetadata,
  ScanRecognitionPreview,
  ScanRecognitionPayload,
  GuidedCaptureResult,
  ScannerMessage,
  OcrResult,
} from "@/lib/scanner/scanMetadata";

export type { ScanType } from "@/components/scanner/scanTypes";
