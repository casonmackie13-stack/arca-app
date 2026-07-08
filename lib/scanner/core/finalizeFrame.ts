"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { perspectiveCorrect } from "@/lib/scanner/cardVision";
import { scaleCanvasTo } from "@/lib/scanner/burstCapture";
import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";
import { PERSPECTIVE_CONFIDENCE_THRESHOLD } from "@/lib/scanner/core/constants";
import { applyGuideFallback } from "@/lib/scanner/core/guideFallback";
import type { CropMethod } from "@/lib/scanner/core/types";
import type { Point } from "@/lib/scanner/scanMetadata";

export type FinalizeResult = {
  canvas: HTMLCanvasElement;
  cropMethod: CropMethod;
  reason?: string;
  perspectiveCorrected: boolean;
  corners?: Point[];
  guideRectNative?: { sx: number; sy: number; sw: number; sh: number };
};

export async function finalizeCapturedFrame(options: {
  nativeCanvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  guideElement: HTMLElement | null;
  scanType: ScanType;
  corners?: Point[];
  confidence: number;
}): Promise<FinalizeResult> {
  const { nativeCanvas, video, guideElement, scanType, corners, confidence } = options;
  const output = scanTypeConfig[scanType].output;
  const opencvEnabled = isOpenCvScannerEnabled();

  if (!opencvEnabled) {
    return {
      canvas: nativeCanvas,
      cropMethod: "native_full",
      perspectiveCorrected: false,
      reason: "opencv_disabled",
    };
  }

  const hasValidCorners = Boolean(corners?.length === 4 && confidence >= PERSPECTIVE_CONFIDENCE_THRESHOLD);

  if (hasValidCorners && corners) {
    const inset = 0.012;
    const insetCorners: Point[] = corners.map((point) => ({
      x: point.x * (1 - inset * 2) + nativeCanvas.width * inset,
      y: point.y * (1 - inset * 2) + nativeCanvas.height * inset,
    }));

    try {
      const corrected = await perspectiveCorrect(
        nativeCanvas,
        insetCorners,
        output.width,
        output.height,
      );
      return {
        canvas: corrected,
        cropMethod: "opencv_corners",
        perspectiveCorrected: true,
        corners,
      };
    } catch (error) {
      console.warn("[ARCA Scanner] Perspective correction failed:", error);
      if (guideElement) {
        const fallback = applyGuideFallback(
          nativeCanvas,
          video,
          guideElement,
          scanType,
          output.width,
          output.height,
        );
        return {
          canvas: fallback.canvas,
          cropMethod: "guide_fallback",
          reason: error instanceof Error ? error.message : "perspective_failed",
          perspectiveCorrected: false,
          guideRectNative: fallback.crop ?? undefined,
        };
      }
      return {
        canvas: scaleCanvasTo(nativeCanvas, output.width, output.height),
        cropMethod: "failed",
        reason: "perspective_and_guide_unavailable",
        perspectiveCorrected: false,
      };
    }
  }

  if (guideElement) {
    const fallback = applyGuideFallback(
      nativeCanvas,
      video,
      guideElement,
      scanType,
      output.width,
      output.height,
    );
    console.warn("[ARCA Scanner] Guide fallback crop:", fallback.reason);
    return {
      canvas: fallback.canvas,
      cropMethod: "guide_fallback",
      reason: !corners?.length ? "no_valid_corners" : `low_confidence_${confidence.toFixed(2)}`,
      perspectiveCorrected: false,
      guideRectNative: fallback.crop ?? undefined,
    };
  }

  return {
    canvas: scaleCanvasTo(nativeCanvas, output.width, output.height),
    cropMethod: "failed",
    reason: "no_detection_no_guide",
    perspectiveCorrected: false,
  };
}
