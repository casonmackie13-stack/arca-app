import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import type { OpenCvRuntime } from "@/lib/image-processing/opencvLoader";

export type Point = { x: number; y: number };

export type DetectedCardBoundary = {
  corners: [Point, Point, Point, Point];
  confidence: number;
  aspectRatio: number;
  areaRatio: number;
  centerOffset: number;
  isValidForScanType: boolean;
};

export type BoundaryScannerStatus =
  | "loading"
  | "searching"
  | "candidate"
  | "valid"
  | "stable"
  | "capturing"
  | "fallback";

export type CardBoundaryScanResult = {
  boundary: DetectedCardBoundary | null;
  candidates: number;
  status: BoundaryScannerStatus;
  message: string;
};

type Candidate = DetectedCardBoundary & { score: number };

const analysisWidth = 360;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(corners: [Point, Point, Point, Point]) {
  let sum = 0;
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function orderCorners(points: Point[]): [Point, Point, Point, Point] {
  const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const start = sorted.reduce((best, point, index) => point.x + point.y < sorted[best].x + sorted[best].y ? index : best, 0);
  const ordered = [...sorted.slice(start), ...sorted.slice(0, start)] as [Point, Point, Point, Point];
  if (ordered[1].y > ordered[3].y) return [ordered[0], ordered[3], ordered[2], ordered[1]];
  return ordered;
}

function aspectRange(scanType: ScanType) {
  return scanType === "graded-slab" ? { min: 0.48, max: 0.78 } : { min: 0.55, max: 0.85 };
}

function buildCandidate(points: Point[], scanType: ScanType, width: number, height: number, contourArea: number): Candidate | null {
  const corners = orderCorners(points).map((point) => ({ x: point.x / width, y: point.y / height })) as [Point, Point, Point, Point];
  const topWidth = distance(corners[0], corners[1]);
  const bottomWidth = distance(corners[3], corners[2]);
  const leftHeight = distance(corners[0], corners[3]);
  const rightHeight = distance(corners[1], corners[2]);
  const averageWidth = (topWidth + bottomWidth) / 2;
  const averageHeight = (leftHeight + rightHeight) / 2;
  if (!averageWidth || !averageHeight) return null;
  const aspectRatio = averageWidth / averageHeight;
  const areaRatio = polygonArea(corners);
  if (areaRatio < 0.05 || areaRatio > 0.86) return null;
  const center = corners.reduce((total, point) => ({ x: total.x + point.x / 4, y: total.y + point.y / 4 }), { x: 0, y: 0 });
  const centerOffset = Math.hypot(center.x - 0.5, center.y - 0.5) / Math.SQRT1_2;
  const target = scanTypeConfig[scanType].output.width / scanTypeConfig[scanType].output.height;
  const range = aspectRange(scanType);
  const isValidForScanType = aspectRatio >= range.min && aspectRatio <= range.max;
  const aspectScore = clamp(1 - Math.abs(aspectRatio - target) / (target * 0.48));
  const areaScore = areaRatio < 0.14 ? areaRatio / 0.14 : areaRatio > 0.72 ? (1 - areaRatio) / 0.28 : 1;
  const centerScore = clamp(1 - centerOffset / 0.58);
  const rectangularity = clamp(contourArea / Math.max(1, width * height * areaRatio));
  const confidence = clamp(0.34 * aspectScore + 0.28 * areaScore + 0.22 * centerScore + 0.16 * rectangularity);
  const score = confidence + (isValidForScanType ? 0.12 : 0) + areaRatio * 0.08;
  return { corners, confidence, aspectRatio, areaRatio, centerOffset, isValidForScanType, score };
}

export function mapVideoPointToDisplayPoint(point: Point, video: HTMLVideoElement): Point {
  const rect = video.getBoundingClientRect();
  if (!video.videoWidth || !video.videoHeight || !rect.width || !rect.height) return point;
  const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  return {
    x: (point.x * video.videoWidth * scale + offsetX) / rect.width,
    y: (point.y * video.videoHeight * scale + offsetY) / rect.height,
  };
}

export function mapAnalysisPointToVideoPoint(point: Point, analysisSize: { width: number; height: number }): Point {
  return { x: point.x / analysisSize.width, y: point.y / analysisSize.height };
}

export function scanCardBoundary({
  cv,
  video,
  canvas,
  scanType,
}: {
  cv: OpenCvRuntime;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  scanType: ScanType;
}): CardBoundaryScanResult {
  if (!video.videoWidth || !video.videoHeight) return { boundary: null, candidates: 0, status: "searching", message: "Find card edges" };
  const width = analysisWidth;
  const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { boundary: null, candidates: 0, status: "fallback", message: "Tap capture if auto-scan does not start" };
  context.drawImage(video, 0, 0, width, height);

  let source: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let gray: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let blurred: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let edges: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let contours: InstanceType<OpenCvRuntime["MatVector"]> | null = null;
  let hierarchy: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  try {
    source = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 48, 132);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates: Candidate[] = [];
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.035 * peri, true);
      const area = Math.abs(cv.contourArea(approx));
      if (approx.rows === 4 && area > width * height * 0.035) {
        const points: Point[] = [];
        for (let row = 0; row < 4; row += 1) {
          points.push({ x: approx.data32S[row * 2], y: approx.data32S[row * 2 + 1] });
        }
        const candidate = buildCandidate(points, scanType, width, height, area);
        if (candidate) candidates.push(candidate);
      }
      approx.delete();
      contour.delete();
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    if (!best) return { boundary: null, candidates: 0, status: "searching", message: "Find card edges" };
    const status: BoundaryScannerStatus = best.isValidForScanType && best.confidence >= 0.66 && best.centerOffset < 0.42 && best.areaRatio >= 0.08 ? "valid" : "candidate";
    const message = status === "valid" ? "Hold steady" : best.areaRatio < 0.08 ? "Move closer" : best.centerOffset >= 0.42 ? "Center card" : "Find card edges";
    return { boundary: best, candidates: candidates.length, status, message };
  } catch {
    return { boundary: null, candidates: 0, status: "fallback", message: "Tap capture if auto-scan does not start" };
  } finally {
    source?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}
