"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { loadOpenCv, type OpenCvMat, type OpenCvMatVector } from "@/lib/scanner/opencvLoader";
import type { CardEdgeDetection, ScanPoint, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

export type EnhancementLevel = "natural" | "strong";

const DETECTION_INTERVAL_MS = 1000 / 10;
let lastDetectionAt = 0;

function targetAspect(scanType: ScanType) {
  const { width, height } = scanTypeConfig[scanType].output;
  return width / height;
}

function distance(a: ScanPoint, b: ScanPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Order corners: top-left, top-right, bottom-right, bottom-left. */
export function orderCorners(points: ScanPoint[]): ScanPoint[] {
  if (points.length !== 4) return points;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function contourAspect(corners: ScanPoint[]) {
  const ordered = orderCorners(corners);
  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[3], ordered[2]);
  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);
  const width = (widthTop + widthBottom) / 2;
  const height = (heightLeft + heightRight) / 2;
  if (height <= 0) return 0;
  return width / height;
}

function tiltFromCorners(corners: ScanPoint[]) {
  const ordered = orderCorners(corners);
  const topAngle = Math.atan2(ordered[1].y - ordered[0].y, ordered[1].x - ordered[0].x);
  const leftAngle = Math.atan2(ordered[3].y - ordered[0].y, ordered[3].x - ordered[0].x);
  const deviation = Math.abs(topAngle) + Math.abs(Math.abs(leftAngle) - Math.PI / 2);
  return Math.max(0, 1 - deviation / 1.2);
}

function readSourceCanvas(source: HTMLVideoElement | HTMLCanvasElement): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.videoWidth;
  canvas.height = source.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function calculateQualityMetrics(
  canvas: HTMLCanvasElement,
  corners?: ScanPoint[],
  previousCorners?: ScanPoint[],
): ScanQualityMetrics {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { blurScore: 0, brightnessScore: 0.5 };
  }

  const { width, height } = canvas;
  const sample = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  let sumSq = 0;
  let brightPixels = 0;
  let darkPixels = 0;
  const total = width * height;

  for (let i = 0; i < sample.length; i += 16) {
    const r = sample[i];
    const g = sample[i + 1];
    const b = sample[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    sum += lum;
    sumSq += lum * lum;
    if (lum > 0.92) brightPixels += 1;
    if (lum < 0.12) darkPixels += 1;
  }

  const samples = total / 4;
  const mean = sum / samples;
  const variance = Math.max(0, sumSq / samples - mean * mean);
  const blurScore = Math.min(1, variance * 18);
  const brightnessScore = mean;
  const glareScore = brightPixels / samples;
  const shadowScore = darkPixels / samples;

  let fillRatio: number | undefined;
  let tiltScore: number | undefined;
  if (corners?.length === 4) {
    const ordered = orderCorners(corners);
    const area = Math.abs(
      (ordered[0].x * ordered[1].y - ordered[1].x * ordered[0].y)
      + (ordered[1].x * ordered[2].y - ordered[2].x * ordered[1].y)
      + (ordered[2].x * ordered[3].y - ordered[3].x * ordered[2].y)
      + (ordered[3].x * ordered[0].y - ordered[0].x * ordered[3].y),
    ) / 2;
    fillRatio = area / (width * height);
    tiltScore = tiltFromCorners(corners);
  }

  let stabilityScore: number | undefined;
  if (corners?.length === 4 && previousCorners?.length === 4) {
    const ordered = orderCorners(corners);
    const prev = orderCorners(previousCorners);
    const drift = ordered.reduce((acc, point, index) => acc + distance(point, prev[index]), 0) / 4;
    const normalized = drift / Math.max(width, height);
    stabilityScore = Math.max(0, 1 - normalized * 12);
  }

  return {
    blurScore,
    brightnessScore,
    glareScore,
    shadowScore,
    tiltScore,
    fillRatio,
    stabilityScore,
  };
}

export function shouldAutoCapture(
  detection: CardEdgeDetection,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number },
): boolean {
  const minConfidence = options?.minConfidence ?? 0.62;
  const minStableMs = options?.minStableMs ?? 850;
  const metrics = detection.metrics;
  if (!detection.found || !detection.corners?.length) return false;
  if (detection.confidence < minConfidence) return false;
  if (stableMs < minStableMs) return false;
  if (metrics.blurScore < 0.28) return false;
  if (metrics.brightnessScore < 0.18 || metrics.brightnessScore > 0.96) return false;
  if ((metrics.glareScore ?? 0) > 0.22) return false;
  if ((metrics.stabilityScore ?? 0) < 0.72) return false;
  if ((metrics.fillRatio ?? 0) < 0.12) return false;
  return true;
}

export async function detectCardEdges(
  source: HTMLVideoElement | HTMLCanvasElement,
  scanType: ScanType,
  previousCorners?: ScanPoint[],
  options?: { force?: boolean },
): Promise<CardEdgeDetection> {
  const now = performance.now();
  if (!options?.force && now - lastDetectionAt < DETECTION_INTERVAL_MS) {
    return {
      found: false,
      confidence: 0,
      reason: "throttled",
      metrics: { blurScore: 0, brightnessScore: 0.5 },
    };
  }
  lastDetectionAt = now;

  const canvas = readSourceCanvas(source);
  const fallbackMetrics = calculateQualityMetrics(canvas, undefined, previousCorners);

  const cv = await loadOpenCv();
  if (!cv) {
    return {
      found: false,
      confidence: 0,
      reason: "OpenCV unavailable",
      metrics: fallbackMetrics,
    };
  }

  if (source instanceof HTMLVideoElement && (!source.videoWidth || !source.videoHeight)) {
    return {
      found: false,
      confidence: 0,
      reason: "Camera not ready",
      metrics: fallbackMetrics,
    };
  }

  let src: OpenCvMat | null = null;
  let gray: OpenCvMat | null = null;
  let blurred: OpenCvMat | null = null;
  let edges: OpenCvMat | null = null;
  let contours: OpenCvMatVector | null = null;
  let hierarchy: OpenCvMat | null = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = canvas.width * canvas.height;
    const aspectTarget = targetAspect(scanType);
    let best: { corners: ScanPoint[]; score: number } | null = null;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour, false);
      if (area < frameArea * 0.08 || area > frameArea * 0.92) {
        contour.delete();
        continue;
      }

      const approx = new cv.Mat();
      const epsilon = 0.02 * cv.arcLength(contour, true);
      cv.approxPolyDP(contour, approx, epsilon, true);

      if (approx.rows === 4) {
        const corners: ScanPoint[] = [];
        for (let row = 0; row < 4; row += 1) {
          corners.push({ x: approx.data32S[row * 2], y: approx.data32S[row * 2 + 1] });
        }
        const ordered = orderCorners(corners);
        const aspect = contourAspect(ordered);
        const aspectDelta = Math.abs(aspect - aspectTarget) / aspectTarget;
        const centerX = ordered.reduce((sum, point) => sum + point.x, 0) / 4;
        const centerY = ordered.reduce((sum, point) => sum + point.y, 0) / 4;
        const centerWeight = 1 - (Math.abs(centerX / canvas.width - 0.5) + Math.abs(centerY / canvas.height - 0.5));
        const areaWeight = Math.min(1, area / (frameArea * 0.45));
        const aspectWeight = Math.max(0, 1 - aspectDelta * 2.2);
        const score = areaWeight * 0.35 + aspectWeight * 0.4 + centerWeight * 0.25;

        if (!best || score > best.score) {
          best = { corners: ordered, score };
        }
      }

      approx.delete();
      contour.delete();
    }

    if (!best) {
      const metrics = calculateQualityMetrics(canvas, undefined, previousCorners);
      return {
        found: false,
        confidence: 0,
        reason: "No card edges found",
        metrics,
      };
    }

    const metrics = calculateQualityMetrics(canvas, best.corners, previousCorners);
    const confidence = Math.min(1, best.score * 0.55 + (metrics.tiltScore ?? 0.5) * 0.2 + metrics.blurScore * 0.25);

    return {
      found: true,
      corners: best.corners,
      confidence,
      metrics,
    };
  } catch {
    return {
      found: false,
      confidence: 0,
      reason: "Detection failed",
      metrics: fallbackMetrics,
    };
  } finally {
    src?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

export async function perspectiveCorrect(
  sourceCanvas: HTMLCanvasElement,
  corners: ScanPoint[],
  outputWidth: number,
  outputHeight: number,
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCv();
  const ordered = orderCorners(corners);
  if (!cv) {
    const fallback = document.createElement("canvas");
    fallback.width = outputWidth;
    fallback.height = outputHeight;
    fallback.getContext("2d")?.drawImage(sourceCanvas, 0, 0, outputWidth, outputHeight);
    return fallback;
  }

  let src: OpenCvMat | null = null;
  let dst: OpenCvMat | null = null;
  let srcTri: OpenCvMat | null = null;
  let dstTri: OpenCvMat | null = null;
  let transform: OpenCvMat | null = null;

  try {
    src = cv.imread(sourceCanvas);
    dst = new cv.Mat();
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      ordered[0].x, ordered[0].y,
      ordered[1].x, ordered[1].y,
      ordered[2].x, ordered[2].y,
      ordered[3].x, ordered[3].y,
    ]);
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth, 0,
      outputWidth, outputHeight,
      0, outputHeight,
    ]);
    transform = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, transform, new cv.Size(outputWidth, outputHeight), cv.INTER_LINEAR, cv.BORDER_REPLICATE);

    const output = document.createElement("canvas");
    output.width = outputWidth;
    output.height = outputHeight;
    cv.imshow(output, dst);
    return output;
  } finally {
    src?.delete();
    dst?.delete();
    srcTri?.delete();
    dstTri?.delete();
    transform?.delete();
  }
}

export async function enhanceScan(
  canvas: HTMLCanvasElement,
  level: EnhancementLevel = "natural",
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCv();
  if (!cv) return canvas;

  let src: OpenCvMat | null = null;
  let lab: OpenCvMat | null = null;
  let channels: OpenCvMatVector | null = null;
  let enhancedL: OpenCvMat | null = null;
  let merged: OpenCvMat | null = null;
  let rgb: OpenCvMat | null = null;
  let sharpened: OpenCvMat | null = null;
  let kernel: OpenCvMat | null = null;

  try {
    src = cv.imread(canvas);
    lab = new cv.Mat();
    cv.cvtColor(src, lab, cv.COLOR_RGBA2RGB);
    cv.cvtColor(lab, lab, cv.COLOR_RGB2Lab);
    channels = new cv.MatVector();
    cv.split(lab, channels);
    enhancedL = new cv.Mat();
    const clipLimit = level === "strong" ? 2.8 : 1.8;
    const clahe = new cv.CLAHE(clipLimit, new cv.Size(8, 8));
    clahe.apply(channels.get(0), enhancedL);
    clahe.delete();
    channels.set(0, enhancedL);
    enhancedL = null;
    merged = new cv.Mat();
    cv.merge(channels, merged);
    rgb = new cv.Mat();
    cv.cvtColor(merged, rgb, cv.COLOR_Lab2RGB);

    sharpened = new cv.Mat();
    kernel = cv.matFromArray(3, 3, cv.CV_32FC1, [
      0, level === "strong" ? -0.6 : -0.35, 0,
      level === "strong" ? -0.6 : -0.35, level === "strong" ? 3.4 : 2.4, level === "strong" ? -0.6 : -0.35,
      0, level === "strong" ? -0.6 : -0.35, 0,
    ]);
    cv.filter2D(rgb, sharpened, cv.CV_8U, kernel);

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    cv.imshow(output, sharpened);
    return output;
  } catch {
    return canvas;
  } finally {
    src?.delete();
    lab?.delete();
    channels?.delete();
    enhancedL?.delete();
    merged?.delete();
    rgb?.delete();
    sharpened?.delete();
    kernel?.delete();
  }
}

export function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType, suffix = "pro"): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode capture."));
        return;
      }
      const label = scanType === "graded-slab" ? "guided-slab" : "guided-card";
      resolve(new File([blob], `${label}-${suffix}-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.92);
  });
}

export function resolveScanUiState(
  detection: CardEdgeDetection | null,
  stableMs: number,
): import("@/lib/scanner/scanMetadata").ScanUiState {
  if (!detection?.found) return "searching";
  const metrics = detection.metrics;
  if (metrics.blurScore < 0.28 || metrics.brightnessScore < 0.18 || metrics.brightnessScore > 0.96 || (metrics.glareScore ?? 0) > 0.22) {
    return "quality-issue";
  }
  if (shouldAutoCapture(detection, stableMs)) return "ready";
  if ((metrics.stabilityScore ?? 0) < 0.72 || stableMs < 850) return "unstable";
  return detection.confidence >= 0.62 ? "ready" : "unstable";
}
