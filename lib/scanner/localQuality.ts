"use client";

import { calculateQualityMetrics } from "@/lib/scanner/cardVision";
import type { Point, ScanDetectionResult, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

export type FrameScore = {
  total: number;
  quality: ScanQualityMetrics;
  edgeConfidence: number;
};

/** Blur score using luminance variance (higher = sharper). */
export async function computeBlurScore(canvas: HTMLCanvasElement): Promise<number> {
  const metrics = calculateQualityMetrics(canvas);
  return metrics.blurScore;
}

export function scoreCaptureFrame(
  canvas: HTMLCanvasElement,
  detection: ScanDetectionResult | null,
  blurScore: number,
): FrameScore {
  const quality = calculateQualityMetrics(canvas, detection?.corners);
  quality.blurScore = blurScore;

  const edgeConfidence = detection?.confidence ?? 0;
  const glarePenalty = (quality.glareScore ?? 0) > 0.22 ? 0.35 : 0;
  const blurPenalty = blurScore < 0.28 ? 0.4 : 0;
  const darkPenalty = quality.brightnessScore < 0.18 ? 0.25 : 0;
  const skewPenalty = (quality.tiltScore ?? 0.5) < 0.45 ? 0.15 : 0;

  const total = Math.max(
    0,
    blurScore * 0.35
      + edgeConfidence * 0.3
      + quality.brightnessScore * 0.15
      + (quality.tiltScore ?? 0.5) * 0.1
      + (quality.fillRatio ?? 0) * 0.1
      - glarePenalty
      - blurPenalty
      - darkPenalty
      - skewPenalty,
  );

  return { total, quality, edgeConfidence };
}

export function qualityBadgeFromMetrics(quality: ScanQualityMetrics, edgeConfidence = 0): "poor" | "good" | "excellent" {
  const score = quality.blurScore * 0.4
    + edgeConfidence * 0.25
    + quality.brightnessScore * 0.15
    + (1 - Math.min(1, (quality.glareScore ?? 0) * 3)) * 0.2;
  if (score >= 0.72 && quality.blurScore >= 0.35 && (quality.glareScore ?? 0) <= 0.18) return "excellent";
  if (score >= 0.48 && quality.blurScore >= 0.22) return "good";
  return "poor";
}

export function isBorderlineQuality(quality: ScanQualityMetrics, edgeConfidence = 0): boolean {
  const badge = qualityBadgeFromMetrics(quality, edgeConfidence);
  return badge === "good";
}

export function passesCaptureGate(detection: ScanDetectionResult | null, stableMs: number): boolean {
  if (!detection?.found) return false;
  const q = detection.quality;
  if (q.blurScore < 0.22) return false;
  if (q.brightnessScore < 0.15) return false;
  if ((q.glareScore ?? 0) > 0.28) return false;
  if (detection.confidence < 0.4) return false;
  if (stableMs < 400 && (q.stabilityScore ?? 0) < 0.55) return false;
  return true;
}

export function mapCornersToCropSpace(corners: Point[], crop: { sx: number; sy: number }): Point[] {
  return corners.map((point) => ({ x: point.x - crop.sx, y: point.y - crop.sy }));
}
