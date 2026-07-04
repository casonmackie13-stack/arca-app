"use client";

import { analyzeCardImage } from "@/lib/image-processing/cardDetection";
import type { ScanMetadata, ScanRecognitionPayload, ScanRecognitionPreview } from "@/lib/scanner/scanMetadata";

/**
 * ARCA Scan Engine v1 — post-capture AI recognition preview (safe, non-blocking).
 *
 * TODO: live card recognition overlay during camera preview
 * TODO: live value estimate from comparable sales
 * TODO: centering estimate for graded submissions
 * TODO: population report integration
 */

export async function runRecognitionPreview(file: File): Promise<ScanRecognitionPreview> {
  try {
    const analysis = await analyzeCardImage(file);
    const detectedLabel = analysis.multipleCards
      ? "Multiple cards"
      : analysis.boundary?.type === "graded-slab"
        ? "Graded slab"
        : "Raw card";

    return {
      available: true,
      detectedLabel,
      confidence: analysis.confidence,
      warnings: analysis.feedback.slice(0, 4),
      multipleCards: analysis.multipleCards,
    };
  } catch {
    return { available: false };
  }
}

/** Bundle scan metadata for autofill / future live recognition APIs */
export function buildRecognitionPayload(
  metadata: ScanMetadata,
  ocrText?: string,
): ScanRecognitionPayload {
  return {
    scanType: metadata.scanType,
    captureMode: metadata.captureMode,
    edgeDetected: metadata.edgeDetected,
    perspectiveCorrected: metadata.perspectiveCorrected,
    edgeConfidence: metadata.edgeConfidence,
    quality: metadata.quality,
    ocrText,
  };
}

export function recognitionPreviewLabel(preview: ScanRecognitionPreview | undefined) {
  if (!preview?.available || !preview.detectedLabel) return null;
  const confidence = preview.confidence != null ? ` · ${Math.round(preview.confidence * 100)}%` : "";
  return `${preview.detectedLabel}${confidence}`;
}
