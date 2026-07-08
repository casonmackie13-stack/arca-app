"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import {
  domRectLike,
  enforceAspectRatioCrop,
  mapGuideFrameToVideoCrop,
  type VideoCropRect,
} from "@/lib/scanner/cropMapping";
import { scaleCanvasTo } from "@/lib/scanner/burstCapture";

/** Crop the guide-frame region from an already-captured native full frame. */
export function cropGuideRegionFromNativeFrame(
  nativeCanvas: HTMLCanvasElement,
  crop: VideoCropRect,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.sw));
  canvas.height = Math.max(1, Math.round(crop.sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(
    nativeCanvas,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export function computeGuideCropOnNativeFrame(
  video: HTMLVideoElement,
  guideElement: HTMLElement,
  scanType: ScanType,
): VideoCropRect | null {
  const guideFrameRect = domRectLike(guideElement.getBoundingClientRect());
  const videoDisplayRect = domRectLike(video.getBoundingClientRect());

  if (!video.videoWidth || !video.videoHeight || !guideFrameRect.width) return null;

  const mapped = mapGuideFrameToVideoCrop({
    guideFrameRect,
    videoDisplayRect,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  });
  if (!mapped) return null;

  return enforceAspectRatioCrop(
    mapped,
    scanTypeConfig[scanType].aspectRatio,
    video.videoWidth,
    video.videoHeight,
  );
}

export function applyGuideFallback(
  nativeCanvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  guideElement: HTMLElement,
  scanType: ScanType,
  outputWidth: number,
  outputHeight: number,
) {
  const crop = computeGuideCropOnNativeFrame(video, guideElement, scanType);
  if (!crop) {
    return {
      canvas: scaleCanvasTo(nativeCanvas, outputWidth, outputHeight),
      crop,
      reason: "guide_crop_unavailable",
    };
  }

  const cropped = cropGuideRegionFromNativeFrame(nativeCanvas, crop);
  return {
    canvas: scaleCanvasTo(cropped, outputWidth, outputHeight),
    crop,
    reason: "opencv_detection_failed",
  };
}
