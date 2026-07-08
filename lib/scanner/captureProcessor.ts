"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { GuidedCaptureResult } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { captureBurstFrames, drawNativeVideoCrop, scaleCanvasTo } from "@/lib/scanner/burstCapture";
import { detectCardEdges } from "@/lib/scanner/cardVision";
import {
  applyDeterministicEnhanceAsync,
  finalizeCaptureCanvas,
} from "@/lib/scanner/deterministicEnhance";
import {
  computeBlurScore,
  qualityBadgeFromMetrics,
  scoreCaptureFrame,
} from "@/lib/scanner/localQuality";
import {
  domRectLike,
  enforceAspectRatioCrop,
  mapGuideFrameToVideoCrop,
} from "@/lib/scanner/cropMapping";
import { getOpenCvLoadState } from "@/lib/scanner/opencvLoader";
import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";
import { isScannerDebugEnabled, logCaptureMetadata, reportCaptureDebug } from "@/lib/scanner/scannerDebug";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { ScanMetadata } from "@/lib/scanner/scanMetadata";
import { calculateQualityMetrics } from "@/lib/scanner/cardVision";

/** Active Add Card capture path — burst select, perspective crop, deterministic enhance. */
export const ACTIVE_CAPTURE_FUNCTION = "processGuidedCapture";

async function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType, suffix = ""): Promise<File> {
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
  return new File([blob], `arca-${scanType}${suffix ? `-${suffix}` : ""}-${Date.now()}.jpg`, { type: "image/jpeg" });
}

async function cloneCanvas(canvas: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  return copy;
}

async function processGuideOnlyCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement;
  scanType: ScanType;
  captureMode: "manual" | "auto";
  crop: { sx: number; sy: number; sw: number; sh: number };
  output: { width: number; height: number };
}): Promise<Pick<GuidedCaptureResult, "file" | "originalFile" | "quality" | "metadata" | "qualityRecord">> {
  const { video, overlayElement, scanType, captureMode, crop, output } = options;
  const sourceCanvas = drawNativeVideoCrop(video, crop);
  const finalized = await finalizeCaptureCanvas({
    sourceCanvas,
    corners: undefined,
    confidence: 0,
    outputWidth: output.width,
    outputHeight: output.height,
  });

  const quality = calculateQualityMetrics(sourceCanvas);
  const enhancedCanvas = await applyDeterministicEnhanceAsync(finalized.canvas, quality);
  const qualityBadge = qualityBadgeFromMetrics(quality, 0);
  const originalSnapshot = await cloneCanvas(finalized.canvas);

  const metadata: ScanMetadata = {
    scanType,
    captureMode,
    edgeDetected: false,
    perspectiveCorrected: false,
    fallbackCrop: true,
    crop_method: "guide_fallback",
    crop_fallback_reason: "opencv_disabled",
    opencv_status: "idle",
    edgeConfidence: 0,
    selected_burst_index: 0,
    guide_rect_native: crop,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    quality,
  };

  const qualityRecord = {
    blur_score: quality.blurScore,
    glare_score: quality.glareScore ?? 0,
    edge_confidence: 0,
    lighting_score: quality.brightnessScore,
    overall_badge: qualityBadge,
  };

  reportCaptureDebug(video, overlayElement.getBoundingClientRect(), crop, scanType);
  if (isScannerDebugEnabled()) logCaptureMetadata(metadata);

  const [originalFile, file] = await Promise.all([
    canvasToJpegFile(originalSnapshot, scanType, "original"),
    canvasToJpegFile(enhancedCanvas, scanType),
  ]);

  return { file, originalFile, quality, metadata, qualityRecord };
}

export async function processGuidedCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement | null;
  scanType: ScanType;
  captureMode?: "manual" | "auto";
  onCropComputed?: (crop: { sx: number; sy: number; sw: number; sh: number }, output: { width: number; height: number }) => void;
}): Promise<GuidedCaptureResult> {
  try {
    const { video, overlayElement, scanType, captureMode = "manual", onCropComputed } = options;
    const config = scanTypeConfig[scanType];
    const output = config.output;
    const opencvEnabled = isOpenCvScannerEnabled();
    const opencvState = getOpenCvLoadState();

    scanFlowLog("Capture called", { opencvEnabled });

    if (!overlayElement) {
      throw new Error("Guide frame is not ready.");
    }

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera is still loading. Try again.");
    }

    const guideFrameRect = domRectLike(overlayElement.getBoundingClientRect());
    const videoDisplayRect = domRectLike(video.getBoundingClientRect());

    if (guideFrameRect.width === 0 || guideFrameRect.height === 0) {
      throw new Error("Guide frame is not ready.");
    }

    const mappedCrop = mapGuideFrameToVideoCrop({
      guideFrameRect,
      videoDisplayRect,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });

    if (!mappedCrop) {
      throw new Error("Camera is still loading. Try again.");
    }

    const crop = enforceAspectRatioCrop(
      mappedCrop,
      config.aspectRatio,
      video.videoWidth,
      video.videoHeight,
    );

    onCropComputed?.(crop, output);

    if (!opencvEnabled) {
      const simple = await processGuideOnlyCapture({
        video,
        overlayElement,
        scanType,
        captureMode,
        crop,
        output,
      });
      return { ...simple, scanType };
    }

    scanFlowLog("Video size", {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      displayWidth: Math.round(video.getBoundingClientRect().width),
      displayHeight: Math.round(video.getBoundingClientRect().height),
      opencv_status: opencvState.status,
    });

    scanFlowLog("Source crop", crop);
    reportCaptureDebug(video, overlayElement.getBoundingClientRect(), crop, scanType);

    const burstFrames = await captureBurstFrames(video, crop);
    let bestCanvas = burstFrames[0];
    let bestScore = -Infinity;
    let bestDetection = null as Awaited<ReturnType<typeof detectCardEdges>> | null;
    let bestQuality = scoreCaptureFrame(bestCanvas, null, 0).quality;
    let selectedBurstIndex = 0;

    for (let index = 0; index < burstFrames.length; index += 1) {
      const frame = burstFrames[index];
      let blurScore = 0;
      let detection = null as Awaited<ReturnType<typeof detectCardEdges>> | null;
      try {
        blurScore = await computeBlurScore(frame);
        detection = await detectCardEdges(frame, scanType, undefined, { force: true });
      } catch (error) {
        console.warn("[ARCA Scanner] Burst frame analysis failed:", error);
      }
      const scored = scoreCaptureFrame(frame, detection, blurScore);
      if (scored.total > bestScore) {
        bestScore = scored.total;
        bestCanvas = frame;
        bestDetection = detection;
        bestQuality = scored.quality;
        selectedBurstIndex = index;
      }
    }

    const finalized = await finalizeCaptureCanvas({
      sourceCanvas: bestCanvas,
      corners: bestDetection?.corners,
      confidence: bestDetection?.confidence ?? 0,
      outputWidth: output.width,
      outputHeight: output.height,
    });

    const processedCanvas = finalized.canvas;
    const edgeDetected = Boolean(bestDetection?.found && bestDetection.corners?.length === 4);
    const perspectiveCorrected = finalized.perspectiveCorrected;

    const originalSnapshot = await cloneCanvas(processedCanvas);
    const enhancedCanvas = await applyDeterministicEnhanceAsync(processedCanvas, bestQuality);
    const qualityBadge = qualityBadgeFromMetrics(bestQuality, bestDetection?.confidence ?? 0);

    const metadata: ScanMetadata = {
      scanType,
      captureMode,
      edgeDetected,
      perspectiveCorrected,
      fallbackCrop: finalized.cropMethod === "guide_fallback",
      crop_method: finalized.cropMethod,
      crop_fallback_reason: finalized.reason,
      opencv_status: opencvState.status,
      edgeConfidence: bestDetection?.confidence,
      corners: bestDetection?.corners,
      selected_burst_index: selectedBurstIndex,
      guide_rect_native: crop,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      quality: bestQuality,
    };

    const qualityRecord = {
      blur_score: bestQuality.blurScore,
      glare_score: bestQuality.glareScore ?? 0,
      edge_confidence: bestDetection?.confidence ?? 0,
      lighting_score: bestQuality.brightnessScore,
      overall_badge: qualityBadge,
    };

    if (isScannerDebugEnabled()) logCaptureMetadata(metadata);

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
  } catch (error) {
    console.error("[ARCA Scanner] processGuidedCapture failed:", error);
    throw error instanceof Error ? error : new Error("Capture failed.");
  }
}
