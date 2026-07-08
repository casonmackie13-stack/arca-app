"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { GuidedCaptureResult } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { applyDeterministicEnhanceAsync } from "@/lib/scanner/deterministicEnhance";
import { qualityBadgeFromMetrics } from "@/lib/scanner/localQuality";
import { getOpenCvLoadState } from "@/lib/scanner/opencvLoader";
import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";
import { isScannerDebugEnabled, logCaptureMetadata } from "@/lib/scanner/scannerDebug";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import { captureNativeBurst, captureNativeVideoFrame } from "@/lib/scanner/core/captureFrame";
import { BURST_FRAME_COUNT, BURST_INTERVAL_MS } from "@/lib/scanner/core/constants";
import { finalizeCapturedFrame } from "@/lib/scanner/core/finalizeFrame";
import { analyzeCapturedFrame, pickBestCapturedFrame } from "@/lib/scanner/core/frameScoring";
import { calculateQualityMetrics } from "@/lib/scanner/cardVision";
import type { DocumentCaptureResult } from "@/lib/scanner/core/types";

/** Active Add Card capture path — document scanner pipeline. */
export const ACTIVE_CAPTURE_FUNCTION = "processDocumentCapture";

async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  scanType: ScanType,
  suffix = "",
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Could not encode capture."));
      }, "image/jpeg", suffix === "original" ? 0.95 : 0.92);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Could not encode capture."));
    }
  });
  return new File(
    [blob],
    `arca-${scanType}${suffix ? `-${suffix}` : ""}-${Date.now()}.jpg`,
    { type: "image/jpeg" },
  );
}

async function cloneCanvas(canvas: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  return copy;
}

/**
 * Document-scanner pipeline:
 * native frame capture → OpenCV on captured frame → perspective → light enhance.
 * Live preview corners are never used for the final crop.
 */
export async function processDocumentCapture(options: {
  video: HTMLVideoElement;
  guideElement: HTMLElement | null;
  scanType: ScanType;
  captureMode?: "manual" | "auto";
}): Promise<DocumentCaptureResult> {
  const { video, guideElement, scanType, captureMode = "manual" } = options;
  const opencvEnabled = isOpenCvScannerEnabled();
  const opencvState = getOpenCvLoadState();

  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is still loading. Try again.");
  }

  scanFlowLog("processDocumentCapture", {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    opencvEnabled,
    captureMode,
  });

  let selectedAnalysis;
  let burstFrames: HTMLCanvasElement[];

  if (opencvEnabled) {
    burstFrames = await captureNativeBurst(video, BURST_FRAME_COUNT, BURST_INTERVAL_MS);
    const analyses = await Promise.all(
      burstFrames.map((frame, index) => analyzeCapturedFrame(frame, scanType, index)),
    );
    selectedAnalysis = pickBestCapturedFrame(analyses);
  } else {
    const single = captureNativeVideoFrame(video);
    burstFrames = [single];
    selectedAnalysis = {
      canvas: single,
      detection: null,
      blurScore: 0,
      totalScore: 0,
      index: 0,
    };
  }

  const detection = selectedAnalysis.detection;
  const capturedCorners = detection?.corners;
  const confidence = detection?.confidence ?? 0;

  const finalized = await finalizeCapturedFrame({
    nativeCanvas: selectedAnalysis.canvas,
    video,
    guideElement,
    scanType,
    corners: capturedCorners,
    confidence,
  });

  const bestQuality = detection?.quality ?? calculateQualityMetrics(selectedAnalysis.canvas);

  const originalSnapshot = await cloneCanvas(finalized.canvas);
  const enhancedCanvas = opencvEnabled
    ? await applyDeterministicEnhanceAsync(finalized.canvas, bestQuality)
    : finalized.canvas;

  const qualityBadge = qualityBadgeFromMetrics(bestQuality, confidence);
  const edgeDetected = Boolean(detection?.found && capturedCorners?.length === 4);

  const metadata: DocumentCaptureResult["metadata"] = {
    scanType,
    captureMode,
    crop_method: finalized.cropMethod,
    crop_fallback_reason: finalized.reason,
    edgeDetected,
    perspectiveCorrected: finalized.perspectiveCorrected,
    edgeConfidence: confidence,
    corners: capturedCorners,
    captured_frame_corners: capturedCorners,
    live_corners_ignored: true,
    selected_burst_index: selectedAnalysis.index,
    guide_rect_native: finalized.guideRectNative,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    opencv_status: opencvState.status,
    quality: bestQuality,
  };

  const qualityRecord = {
    blur_score: bestQuality.blurScore,
    glare_score: bestQuality.glareScore ?? 0,
    edge_confidence: confidence,
    lighting_score: bestQuality.brightnessScore,
    overall_badge: qualityBadge,
  };

  scanFlowLog("Capture complete", {
    crop_method: finalized.cropMethod,
    selected_burst_index: selectedAnalysis.index,
    edgeConfidence: confidence,
    output: `${enhancedCanvas.width}x${enhancedCanvas.height}`,
  });

  if (isScannerDebugEnabled()) {
    logCaptureMetadata({
      ...metadata,
      fallbackCrop: finalized.cropMethod !== "opencv_corners",
      perspectiveCorrected: finalized.perspectiveCorrected,
    });
  }

  const [originalFile, file] = await Promise.all([
    canvasToJpegFile(originalSnapshot, scanType, "original"),
    canvasToJpegFile(enhancedCanvas, scanType),
  ]);

  return {
    file,
    originalFile,
    scanType,
    quality: bestQuality,
    metadata,
    qualityRecord,
  };
}

/** Adapter for existing GuidedCaptureResult consumers. */
export async function processGuidedCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement | null;
  scanType: ScanType;
  captureMode?: "manual" | "auto";
  onCropComputed?: (crop: { sx: number; sy: number; sw: number; sh: number }, output: { width: number; height: number }) => void;
}): Promise<GuidedCaptureResult> {
  try {
    const result = await processDocumentCapture({
      video: options.video,
      guideElement: options.overlayElement,
      scanType: options.scanType,
      captureMode: options.captureMode,
    });

    if (options.onCropComputed && result.metadata.guide_rect_native) {
      const output = scanTypeConfig[options.scanType].output;
      options.onCropComputed(result.metadata.guide_rect_native, output);
    }

    return {
      file: result.file,
      originalFile: result.originalFile,
      scanType: result.scanType,
      quality: result.quality,
      metadata: {
        ...result.metadata,
        fallbackCrop: result.metadata.crop_method !== "opencv_corners",
      },
      qualityRecord: result.qualityRecord,
    };
  } catch (error) {
    console.error("[ARCA Scanner] processGuidedCapture failed:", error);
    throw error instanceof Error ? error : new Error("Capture failed.");
  }
}
