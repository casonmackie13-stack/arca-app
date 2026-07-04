"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { loadOpenCv, type OpenCvMat, type OpenCvMatVector } from "@/lib/scanner/opencvLoader";
import type { CardEdgeDetection, ScanPoint, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

export type EnhancementLevel = "natural" | "strong";

const DETECTION_INTERVAL_MS = 1000 / 10;
let lastDetectionAt = 0;

function targetAspect(scanType: ScanType) {
  return scanTypeConfig[scanType].aspectRatio;
}

function distance(a: ScanPoint, b: ScanPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeQuality(partial: Partial<ScanQualityMetrics>): ScanQualityMetrics {
  return {
    blurScore: partial.blurScore ?? 0,
    brightnessScore: partial.brightnessScore ?? 0.5,
    glareScore: partial.glareScore,
    shadowScore: partial.shadowScore,
    tiltScore: partial.tiltScore,
    fillRatio: partial.fillRatio ?? 0,
    stabilityScore: partial.stabilityScore ?? 0,
  };
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

export function scoreCandidateContour(
  corners: ScanPoint[],
  scanType: ScanType,
  frameSize: { width: number; height: number },
  area: number,
): number {
  const frameArea = frameSize.width * frameSize.height;
  const aspectTarget = targetAspect(scanType);
  const ordered = orderCorners(corners);
  const aspect = contourAspect(ordered);
  const aspectDelta = Math.abs(aspect - aspectTarget) / aspectTarget;
  const centerX = ordered.reduce((sum, point) => sum + point.x, 0) / 4;
  const centerY = ordered.reduce((sum, point) => sum + point.y, 0) / 4;
  const centerWeight = 1 - (Math.abs(centerX / frameSize.width - 0.5) + Math.abs(centerY / frameSize.height - 0.5));
  const areaWeight = Math.min(1, area / (frameArea * 0.45));
  const aspectWeight = Math.max(0, 1 - aspectDelta * 2.2);
  const rectangularity = tiltFromCorners(corners);
  return areaWeight * 0.3 + aspectWeight * 0.35 + centerWeight * 0.2 + rectangularity * 0.15;
}

export function calculateQualityMetrics(
  canvas: HTMLCanvasElement,
  corners?: ScanPoint[],
  previousCorners?: ScanPoint[],
): ScanQualityMetrics {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return normalizeQuality({ blurScore: 0, brightnessScore: 0.5 });
  }

  const { width, height } = canvas;
  const sample = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  let sumSq = 0;
  let brightPixels = 0;
  let darkPixels = 0;
  const total = width * height;

  for (let i = 0; i < sample.length; i += 16) {
    const lum = (0.299 * sample[i] + 0.587 * sample[i + 1] + 0.114 * sample[i + 2]) / 255;
    sum += lum;
    sumSq += lum * lum;
    if (lum > 0.92) brightPixels += 1;
    if (lum < 0.12) darkPixels += 1;
  }

  const samples = total / 4;
  const mean = sum / samples;
  const variance = Math.max(0, sumSq / samples - mean * mean);

  let fillRatio = 0;
  let tiltScore = 0.5;
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

  const stabilityScore = previousCorners?.length === 4 && corners?.length === 4
    ? (() => {
      const ordered = orderCorners(corners);
      const prev = orderCorners(previousCorners);
      const drift = ordered.reduce((acc, point, index) => acc + distance(point, prev[index]), 0) / 4;
      return Math.max(0, 1 - (drift / Math.max(width, height)) * 12);
    })()
    : 0;

  return normalizeQuality({
    blurScore: Math.min(1, variance * 18),
    brightnessScore: mean,
    glareScore: brightPixels / samples,
    shadowScore: darkPixels / samples,
    tiltScore,
    fillRatio,
    stabilityScore,
  });
}

export function isReadyForAutoCapture(
  detection: CardEdgeDetection,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number },
): boolean {
  return shouldAutoCapture(detection, stableMs, options);
}

export function shouldAutoCapture(
  detection: CardEdgeDetection,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number },
): boolean {
  const minConfidence = options?.minConfidence ?? 0.62;
  const minStableMs = options?.minStableMs ?? 800;
  const quality = detection.quality;
  if (!detection.found || !detection.corners?.length) return false;
  if (detection.confidence < minConfidence) return false;
  if (stableMs < minStableMs) return false;
  if (quality.blurScore < 0.28) return false;
  if (quality.brightnessScore < 0.18 || quality.brightnessScore > 0.96) return false;
  if ((quality.glareScore ?? 0) > 0.22) return false;
  if (quality.stabilityScore < 0.72) return false;
  if (quality.fillRatio < 0.12) return false;
  return true;
}

function emptyDetection(message: string, quality?: ScanQualityMetrics): CardEdgeDetection {
  return {
    found: false,
    confidence: 0,
    message,
    quality: quality ?? normalizeQuality({ blurScore: 0, brightnessScore: 0.5 }),
  };
}

export async function detectCardEdges(
  source: HTMLVideoElement | HTMLCanvasElement,
  scanType: ScanType,
  previousCorners?: ScanPoint[],
  options?: { force?: boolean },
): Promise<CardEdgeDetection> {
  const now = performance.now();
  if (!options?.force && now - lastDetectionAt < DETECTION_INTERVAL_MS) {
    return emptyDetection("throttled");
  }
  lastDetectionAt = now;

  const canvas = readSourceCanvas(source);
  const fallbackQuality = calculateQualityMetrics(canvas, undefined, previousCorners);

  const cv = await loadOpenCv();
  if (!cv) return emptyDetection("OpenCV unavailable", fallbackQuality);

  if (source instanceof HTMLVideoElement && (!source.videoWidth || !source.videoHeight)) {
    return emptyDetection("Camera not ready", fallbackQuality);
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

    const frameSize = { width: canvas.width, height: canvas.height };
    const frameArea = frameSize.width * frameSize.height;
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
        const score = scoreCandidateContour(ordered, scanType, frameSize, area);
        if (!best || score > best.score) best = { corners: ordered, score };
      }

      approx.delete();
      contour.delete();
    }

    if (!best) {
      return emptyDetection("No card edges found", calculateQualityMetrics(canvas, undefined, previousCorners));
    }

    const quality = calculateQualityMetrics(canvas, best.corners, previousCorners);
    const confidence = Math.min(1, best.score * 0.55 + (quality.tiltScore ?? 0.5) * 0.2 + quality.blurScore * 0.25);

    return { found: true, corners: best.corners, confidence, quality };
  } catch {
    return emptyDetection("Detection failed", fallbackQuality);
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
      0, 0, outputWidth, 0, outputWidth, outputHeight, 0, outputHeight,
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
    const clahe = new cv.CLAHE(level === "strong" ? 2.8 : 1.8, new cv.Size(8, 8));
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

export function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType, suffix = "scan"): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Unable to encode capture.")); return; }
      const label = scanType === "graded" ? "slab" : "card";
      resolve(new File([blob], `${label}-${suffix}-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.92);
  });
}
