"use client";

import { scoreCaptureFrame, computeBlurScore } from "@/lib/scanner/localQuality";
import { detectCardEdges } from "@/lib/scanner/cardVision";
import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { CapturedFrameAnalysis } from "@/lib/scanner/core/types";

/** Run OpenCV detection on a captured native frame (not live preview). */
export async function analyzeCapturedFrame(
  canvas: HTMLCanvasElement,
  scanType: ScanType,
  index: number,
): Promise<CapturedFrameAnalysis> {
  let blurScore = 0;
  let detection = null;

  try {
    blurScore = await computeBlurScore(canvas);
    detection = await detectCardEdges(canvas, scanType, undefined, { force: true });
  } catch (error) {
    console.warn("[ARCA Scanner] Captured frame analysis failed:", error);
  }

  const scored = scoreCaptureFrame(canvas, detection, blurScore);
  return {
    canvas,
    detection,
    blurScore,
    totalScore: scored.total,
    index,
  };
}

export function pickBestCapturedFrame(analyses: CapturedFrameAnalysis[]): CapturedFrameAnalysis {
  return analyses.reduce((best, current) => (
    current.totalScore > best.totalScore ? current : best
  ));
}
