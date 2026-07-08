"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import {
  getOpenCvLoadState,
  loadOpenCv,
  type OpenCvMat,
  type OpenCvMatVector,
} from "@/lib/scanner/opencvLoader";
import type { Point, ScanDetectionResult, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

export type EnhancementLevel = "natural" | "strong";

export const PERSPECTIVE_CONFIDENCE_THRESHOLD = 0.45;

const DETECTION_INTERVAL_MS = 1000 / 10;
let lastDetectionAt = 0;

function targetAspect(scanType: ScanType) {
  return scanTypeConfig[scanType].aspectRatio;
}

function distance(a: Point, b: Point) {
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
export function orderCorners(points: Point[]): Point[] {
  if (points.length !== 4) return points;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function contourAspect(corners: Point[]) {
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

function tiltFromCorners(corners: Point[]) {
  const ordered = orderCorners(corners);
  const topAngle = Math.atan2(ordered[1].y - ordered[0].y, ordered[1].x - ordered[0].x);
  const leftAngle = Math.atan2(ordered[3].y - ordered[0].y, ordered[3].x - ordered[0].x);
  const deviation = Math.abs(topAngle) + Math.abs(Math.abs(leftAngle) - Math.PI / 2);
  return Math.max(0, 1 - deviation / 1.2);
}

function rectangularityScore(corners: Point[]) {
  const ordered = orderCorners(corners);
  const opposite1 = Math.abs(distance(ordered[0], ordered[2]) - distance(ordered[1], ordered[3]));
  const opposite2 = Math.abs(distance(ordered[0], ordered[1]) - distance(ordered[3], ordered[2]));
  const diag = distance(ordered[0], ordered[2]);
  const sideAvg = (distance(ordered[0], ordered[1]) + distance(ordered[1], ordered[2])) / 2 || 1;
  const parallelPenalty = (opposite1 + opposite2) / (sideAvg * 2);
  const diagRatio = Math.abs(distance(ordered[0], ordered[2]) - distance(ordered[1], ordered[3])) / (diag || 1);
  return Math.max(0, 1 - parallelPenalty * 0.55 - diagRatio * 0.25);
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

/** Higher compactness favors card-like closed contours (tolerates partial shiny-card edge breaks). */
function contourEdgeStrength(cv: NonNullable<Awaited<ReturnType<typeof loadOpenCv>>>, contour: OpenCvMat, area: number) {
  const perimeter = cv.arcLength(contour, true);
  if (perimeter <= 0 || area <= 0) return 0;
  const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
  return Math.min(1, compactness * 1.75);
}

export function scoreCandidateContour(
  corners: Point[],
  scanType: ScanType,
  frameSize: { width: number; height: number },
  area: number,
  edgeStrength = 0.5,
): number {
  const frameArea = frameSize.width * frameSize.height;
  const aspectTarget = targetAspect(scanType);
  const ordered = orderCorners(corners);
  const aspect = contourAspect(ordered);
  const aspectDelta = Math.abs(aspect - aspectTarget) / aspectTarget;
  const centerX = ordered.reduce((sum, point) => sum + point.x, 0) / 4;
  const centerY = ordered.reduce((sum, point) => sum + point.y, 0) / 4;
  const centerWeight = 1 - (Math.abs(centerX / frameSize.width - 0.5) + Math.abs(centerY / frameSize.height - 0.5));
  const areaWeight = Math.min(1, area / (frameArea * 0.42));
  const aspectWeight = Math.max(0, 1 - aspectDelta * 2.4);
  const rectangularity = rectangularityScore(corners) * 0.55 + tiltFromCorners(corners) * 0.45;
  const edgeWeight = Math.min(1, edgeStrength * 1.15);
  return areaWeight * 0.28 + aspectWeight * 0.3 + centerWeight * 0.18 + rectangularity * 0.14 + edgeWeight * 0.1;
}

export function calculateQualityMetrics(
  canvas: HTMLCanvasElement,
  corners?: Point[],
  previousCorners?: Point[],
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
  detection: ScanDetectionResult,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number; opencvReady?: boolean },
): boolean {
  return shouldAutoCapture(detection, stableMs, options);
}

export function getAutoCaptureBlockReason(
  detection: ScanDetectionResult | null,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number; opencvReady?: boolean },
): string | null {
  const opencvReady = options?.opencvReady ?? true;
  if (!opencvReady) {
    const state = getOpenCvLoadState();
    if (state.status === "idle" || state.status === "loading") return "opencv_loading";
    if (state.status === "failed") return "opencv_failed";
    return "opencv_not_ready";
  }
  if (!detection?.found || !detection.corners?.length) return "no_edges";
  const minConfidence = options?.minConfidence ?? 0.62;
  const minStableMs = options?.minStableMs ?? 800;
  const quality = detection.quality;
  if (detection.confidence < minConfidence) return "low_confidence";
  if (stableMs < minStableMs) return "unstable";
  if (quality.blurScore < 0.28) return "too_blurry";
  if (quality.brightnessScore < 0.18 || quality.brightnessScore > 0.96) return "bad_lighting";
  if ((quality.glareScore ?? 0) > 0.22) return "too_much_glare";
  if (quality.stabilityScore < 0.72) return "unstable";
  if (quality.fillRatio < 0.12) return "too_small";
  return null;
}

export function shouldAutoCapture(
  detection: ScanDetectionResult,
  stableMs: number,
  options?: { minConfidence?: number; minStableMs?: number; opencvReady?: boolean },
): boolean {
  if (options?.opencvReady === false) return false;
  return getAutoCaptureBlockReason(detection, stableMs, options) === null;
}

function emptyDetection(message: string, quality?: ScanQualityMetrics): ScanDetectionResult {
  return {
    found: false,
    confidence: 0,
    message,
    quality: quality ?? normalizeQuality({ blurScore: 0, brightnessScore: 0.5 }),
  };
}

function extractCornersFromApprox(cv: NonNullable<Awaited<ReturnType<typeof loadOpenCv>>>, approx: OpenCvMat): Point[] {
  const corners: Point[] = [];
  for (let row = 0; row < approx.rows; row += 1) {
    corners.push({ x: approx.data32S[row * 2], y: approx.data32S[row * 2 + 1] });
  }
  return orderCorners(corners);
}

export async function detectCardEdges(
  source: HTMLVideoElement | HTMLCanvasElement,
  scanType: ScanType,
  previousCorners?: Point[],
  options?: { force?: boolean },
): Promise<ScanDetectionResult> {
  const now = performance.now();
  if (!options?.force && now - lastDetectionAt < DETECTION_INTERVAL_MS) {
    return emptyDetection("throttled");
  }
  lastDetectionAt = now;

  const opencvState = getOpenCvLoadState();
  if (opencvState.status === "idle" || opencvState.status === "loading") {
    return emptyDetection("OpenCV loading");
  }
  if (opencvState.status === "failed") {
    return emptyDetection(opencvState.error ?? "OpenCV unavailable");
  }

  const canvas = readSourceCanvas(source);
  const fallbackQuality = calculateQualityMetrics(canvas, undefined, previousCorners);

  const cv = await loadOpenCv();
  if (!cv) {
    return emptyDetection(opencvState.error ?? "OpenCV unavailable", fallbackQuality);
  }

  if (source instanceof HTMLVideoElement && (!source.videoWidth || !source.videoHeight)) {
    return emptyDetection("Camera not ready", fallbackQuality);
  }

  let src: OpenCvMat | null = null;
  let gray: OpenCvMat | null = null;
  let blurred: OpenCvMat | null = null;
  let edges: OpenCvMat | null = null;
  let closed: OpenCvMat | null = null;
  let kernel: OpenCvMat | null = null;
  let contours: OpenCvMatVector | null = null;
  let hierarchy: OpenCvMat | null = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    closed = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const cannyPasses: [number, number][] = [[40, 120], [55, 150], [30, 90]];
    const frameSize = { width: canvas.width, height: canvas.height };
    const frameArea = frameSize.width * frameSize.height;
    let best: { corners: Point[]; score: number } | null = null;

    for (const [low, high] of cannyPasses) {
      cv.Canny(blurred, edges, low, high);
      cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
      cv.dilate(closed, closed, kernel, undefined, 1);

      contours?.delete();
      hierarchy?.delete();
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i += 1) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour, false);
        if (area < frameArea * 0.06 || area > frameArea * 0.94) {
          contour.delete();
          continue;
        }

        const edgeStrength = contourEdgeStrength(cv, contour, area);
        const epsilons = [0.015, 0.02, 0.028, 0.035];
        for (const epsilonFactor of epsilons) {
          const approx = new cv.Mat();
          const epsilon = epsilonFactor * cv.arcLength(contour, true);
          cv.approxPolyDP(contour, approx, epsilon, true);

          if (approx.rows >= 4 && approx.rows <= 6) {
            let corners: Point[];
            if (approx.rows === 4) {
              corners = extractCornersFromApprox(cv, approx);
            } else {
              const hull = new cv.Mat();
              cv.approxPolyDP(contour, hull, epsilon * 1.4, true);
              if (hull.rows !== 4) {
                hull.delete();
                approx.delete();
                continue;
              }
              corners = extractCornersFromApprox(cv, hull);
              hull.delete();
            }

            const score = scoreCandidateContour(corners, scanType, frameSize, area, edgeStrength);
            if (!best || score > best.score) best = { corners, score };
          }
          approx.delete();
        }

        contour.delete();
      }

      if (best && best.score >= 0.42) break;
    }

    if (!best) {
      return emptyDetection("No card edges found", calculateQualityMetrics(canvas, undefined, previousCorners));
    }

    const quality = calculateQualityMetrics(canvas, best.corners, previousCorners);
    const confidence = Math.min(1, best.score * 0.5 + (quality.tiltScore ?? 0.5) * 0.22 + quality.blurScore * 0.28);

    return { found: true, corners: best.corners, confidence, quality };
  } catch (error) {
    console.warn("[ARCA Scanner] detectCardEdges failed:", error);
    return emptyDetection("Detection failed", fallbackQuality);
  } finally {
    src?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    closed?.delete();
    kernel?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

export async function detectCardEdgesFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  scanType: ScanType,
  previousCorners?: Point[],
  options?: { force?: boolean },
): Promise<ScanDetectionResult> {
  return detectCardEdges(sourceCanvas, scanType, previousCorners, options);
}

export async function perspectiveCorrect(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[],
  outputWidth: number,
  outputHeight: number,
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCv();
  if (!cv) {
    throw new Error("OpenCV is not available for perspective correction.");
  }

  const ordered = orderCorners(corners);
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
