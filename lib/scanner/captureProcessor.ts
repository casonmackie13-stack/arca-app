"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { GuidedCaptureResult } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { assessCaptureQuality } from "@/lib/scanner/previewQuality";
import { enhanceListingCanvasAsync } from "@/lib/scanner/imageEnhancement";
import {
  domRectLike,
  enforceAspectRatioCrop,
  mapGuideFrameToVideoCrop,
} from "@/lib/scanner/cropMapping";
import { reportCaptureDebug } from "@/lib/scanner/scannerDebug";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";

/** Active Add Card capture path — guide-frame crop only. */
export const ACTIVE_CAPTURE_FUNCTION = "processGuidedCapture";

function drawMappedCrop(
  video: HTMLVideoElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
  output: { width: number; height: number },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height);
  return canvas;
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType, suffix = ""): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not encode capture."));
    }, "image/jpeg", suffix === "original" ? 0.95 : 0.92);
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

export async function processGuidedCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement | null;
  scanType: ScanType;
  onCropComputed?: (crop: { sx: number; sy: number; sw: number; sh: number }, output: { width: number; height: number }) => void;
}): Promise<GuidedCaptureResult> {
  const { video, overlayElement, scanType, onCropComputed } = options;
  const config = scanTypeConfig[scanType];
  const output = config.output;

  scanFlowLog("Capture called");

  if (!overlayElement) {
    scanFlowLog("Crop mode: unknown (missing guide frame ref)");
    throw new Error("Guide frame is not ready.");
  }

  if (!video.videoWidth || !video.videoHeight) {
    scanFlowLog("Crop mode: unknown (video dimensions unavailable)");
    throw new Error("Camera is still loading. Try again.");
  }

  scanFlowLog("Video size", {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    displayWidth: Math.round(video.getBoundingClientRect().width),
    displayHeight: Math.round(video.getBoundingClientRect().height),
  });

  const guideFrameRect = domRectLike(overlayElement.getBoundingClientRect());
  const videoDisplayRect = domRectLike(video.getBoundingClientRect());

  scanFlowLog("Guide rect", guideFrameRect);

  if (guideFrameRect.width === 0 || guideFrameRect.height === 0) {
    scanFlowLog("Crop mode: unknown (guide frame has zero size)");
    throw new Error("Guide frame is not ready.");
  }

  const mappedCrop = mapGuideFrameToVideoCrop({
    guideFrameRect,
    videoDisplayRect,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  });

  if (!mappedCrop) {
    scanFlowLog("Crop mode: unknown (crop mapping failed)");
    throw new Error("Camera is still loading. Try again.");
  }

  const crop = enforceAspectRatioCrop(
    mappedCrop,
    config.aspectRatio,
    video.videoWidth,
    video.videoHeight,
  );

  scanFlowLog("Source crop", crop);
  scanFlowLog("Crop mode: guide-frame");

  onCropComputed?.(crop, output);

  reportCaptureDebug(video, overlayElement.getBoundingClientRect(), crop, scanType);

  const originalCanvas = drawMappedCrop(video, crop, output);
  const originalSnapshot = await cloneCanvas(originalCanvas);
  const enhancedCanvas = await enhanceListingCanvasAsync(originalSnapshot);
  const quality = assessCaptureQuality(enhancedCanvas);

  scanFlowLog("Output size", {
    original: `${originalCanvas.width}x${originalCanvas.height}`,
    enhanced: `${enhancedCanvas.width}x${enhancedCanvas.height}`,
  });

  const [originalFile, file] = await Promise.all([
    canvasToJpegFile(originalCanvas, scanType, "original"),
    canvasToJpegFile(enhancedCanvas, scanType),
  ]);

  return { file, originalFile, scanType, quality };
}
