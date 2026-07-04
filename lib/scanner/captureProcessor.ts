"use client";

import type { ScanType } from "@/lib/scanner/scannerTypes";
import type { GuidedCaptureResult } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(video, 0, 0);
  return canvas;
}

function cropGuideFrame(
  video: HTMLVideoElement,
  overlayRect: DOMRect,
  output: { width: number; height: number },
): HTMLCanvasElement {
  const videoRect = video.getBoundingClientRect();
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight || !videoRect.width || !videoRect.height) {
    throw new Error("Camera frame is not ready.");
  }

  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;
  const sourceX = (overlayRect.left - videoRect.left - offsetX) / scale;
  const sourceY = (overlayRect.top - videoRect.top - offsetY) / scale;
  const sourceWidth = overlayRect.width / scale;
  const sourceHeight = overlayRect.height / scale;
  const sx = Math.max(0, Math.min(videoWidth, sourceX));
  const sy = Math.max(0, Math.min(videoHeight, sourceY));
  const sw = Math.max(1, Math.min(videoWidth - sx, sourceWidth));
  const sh = Math.max(1, Math.min(videoHeight - sy, sourceHeight));

  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, output.width, output.height);
  return canvas;
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not encode capture."));
    }, "image/jpeg", 0.92);
  });
  return new File([blob], `arca-${scanType}-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export async function processGuidedCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement | null;
  scanType: ScanType;
}): Promise<GuidedCaptureResult> {
  const { video, overlayElement, scanType } = options;
  const output = scanTypeConfig[scanType].output;

  if (overlayElement) {
    try {
      const cropped = cropGuideFrame(video, overlayElement.getBoundingClientRect(), output);
      const file = await canvasToJpegFile(cropped, scanType);
      return { file, scanType };
    } catch {
      // Fall through to full frame.
    }
  }

  const frame = captureVideoFrame(video);
  const full = document.createElement("canvas");
  full.width = output.width;
  full.height = output.height;
  full.getContext("2d")?.drawImage(frame, 0, 0, output.width, output.height);
  const file = await canvasToJpegFile(full, scanType);
  return { file, scanType };
}
