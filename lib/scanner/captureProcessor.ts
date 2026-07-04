"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import {
  canvasToJpegFile,
  detectCardEdges,
  enhanceScan,
  perspectiveCorrect,
} from "@/lib/scanner/cardVision";
import type { CardEdgeDetection, GuidedCaptureResult, ScanCaptureMetadata, ScanPoint } from "@/lib/scanner/scanMetadata";

const EDGE_CONFIDENCE_THRESHOLD = 0.55;

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

async function buildCaptureFromCanvas(
  canvas: HTMLCanvasElement,
  scanType: ScanType,
  metadata: Omit<ScanCaptureMetadata, "scanType">,
): Promise<GuidedCaptureResult> {
  const enhanced = await enhanceScan(canvas, "natural");
  const file = await canvasToJpegFile(enhanced, scanType, metadata.captureMode === "edge-detected" ? "edge" : "guide");
  return {
    file,
    scanType,
    metadata: { ...metadata, scanType },
  };
}

export async function processGuidedCapture(options: {
  video: HTMLVideoElement;
  overlayElement: HTMLElement | null;
  scanType: ScanType;
  liveDetection?: CardEdgeDetection | null;
}): Promise<GuidedCaptureResult> {
  const { video, overlayElement, scanType, liveDetection } = options;
  const output = scanTypeConfig[scanType].output;
  const frame = captureVideoFrame(video);

  const corners = liveDetection?.found && liveDetection.confidence >= EDGE_CONFIDENCE_THRESHOLD
    ? liveDetection.corners
    : undefined;

  if (corners?.length === 4) {
    try {
      const corrected = await perspectiveCorrect(frame, corners, output.width, output.height);
      return buildCaptureFromCanvas(corrected, scanType, {
        captureMode: "edge-detected",
        perspectiveCorrected: true,
        overlayCropSucceeded: true,
        edgeConfidence: liveDetection?.confidence,
        qualityMetrics: liveDetection?.metrics,
      });
    } catch {
      // Fall through to guide-frame crop.
    }
  }

  if (overlayElement) {
    try {
      const cropped = cropGuideFrame(video, overlayElement.getBoundingClientRect(), output);
      return buildCaptureFromCanvas(cropped, scanType, {
        captureMode: "guide-frame",
        perspectiveCorrected: false,
        overlayCropSucceeded: true,
        edgeConfidence: liveDetection?.confidence,
        qualityMetrics: liveDetection?.metrics,
      });
    } catch {
      // Fall through to full frame.
    }
  }

  const full = document.createElement("canvas");
  full.width = output.width;
  full.height = output.height;
  full.getContext("2d")?.drawImage(frame, 0, 0, output.width, output.height);
  return buildCaptureFromCanvas(full, scanType, {
    captureMode: "full-frame",
    perspectiveCorrected: false,
    overlayCropSucceeded: false,
    edgeConfidence: liveDetection?.confidence,
    qualityMetrics: liveDetection?.metrics,
  });
}

export async function redetectForCapture(
  video: HTMLVideoElement,
  scanType: ScanType,
  previousCorners?: ScanPoint[],
): Promise<CardEdgeDetection> {
  return detectCardEdges(video, scanType, previousCorners, { force: true });
}
