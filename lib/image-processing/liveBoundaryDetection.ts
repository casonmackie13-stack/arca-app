import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export type Point = { x: number; y: number };

export type DetectedBoundary = {
  corners: [Point, Point, Point, Point];
  confidence: number;
  aspectRatio: number;
  areaRatio: number;
  centerOffset: number;
  tiltScore: number;
};

export type BoundaryDetectionState =
  | "searching"
  | "detected"
  | "aligned"
  | "capturing"
  | "failed";

export type BoundaryDetectionResult = {
  boundary: DetectedBoundary | null;
  state: BoundaryDetectionState;
  message: string;
};

type EdgePoint = Point & { magnitude: number };

const sampleWidth = 220;
const minAreaRatio = 0.08;
const maxAreaRatio = 0.82;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values: number[], amount: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * amount)))];
}

function fitLine(points: Point[], mode: "x-from-y" | "y-from-x") {
  if (points.length < 2) return null;
  let sumA = 0, sumB = 0, sumAA = 0, sumAB = 0;
  for (const point of points) {
    const a = mode === "x-from-y" ? point.y : point.x;
    const b = mode === "x-from-y" ? point.x : point.y;
    sumA += a; sumB += b; sumAA += a * a; sumAB += a * b;
  }
  const count = points.length;
  const denominator = count * sumAA - sumA * sumA;
  if (Math.abs(denominator) < 0.0001) return { slope: 0, intercept: sumB / count };
  const slope = (count * sumAB - sumA * sumB) / denominator;
  const intercept = (sumB - slope * sumA) / count;
  return { slope, intercept };
}

function intersect(vertical: { slope: number; intercept: number }, horizontal: { slope: number; intercept: number }) {
  const denominator = 1 - vertical.slope * horizontal.slope;
  if (Math.abs(denominator) < 0.0001) return null;
  const x = (vertical.slope * horizontal.intercept + vertical.intercept) / denominator;
  const y = horizontal.slope * x + horizontal.intercept;
  return { x, y };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(corners: [Point, Point, Point, Point]) {
  let sum = 0;
  for (let index = 0; index < corners.length; index++) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function edgePointsFromImage(data: ImageData) {
  const { width, height } = data;
  const gray = new Uint8ClampedArray(width * height);
  for (let index = 0; index < gray.length; index++) {
    const offset = index * 4;
    gray[index] = data.data[offset] * 0.299 + data.data[offset + 1] * 0.587 + data.data[offset + 2] * 0.114;
  }

  const magnitudes: number[] = [];
  const raw: EdgePoint[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const magnitude = Math.hypot(gx, gy);
      if (magnitude > 36) {
        magnitudes.push(magnitude);
        raw.push({ x, y, magnitude });
      }
    }
  }
  const threshold = Math.max(48, percentile(magnitudes, 0.72));
  return raw.filter((point) => point.magnitude >= threshold);
}

function buildBoundary(points: EdgePoint[], width: number, height: number, scanType: ScanType): DetectedBoundary | null {
  if (points.length < 80) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = percentile(xs, 0.06);
  const right = percentile(xs, 0.94);
  const top = percentile(ys, 0.06);
  const bottom = percentile(ys, 0.94);
  const boxWidth = right - left;
  const boxHeight = bottom - top;
  if (boxWidth < width * 0.18 || boxHeight < height * 0.18) return null;

  const marginX = Math.max(8, boxWidth * 0.16);
  const marginY = Math.max(8, boxHeight * 0.16);
  const leftLine = fitLine(points.filter((point) => point.x <= left + marginX && point.y >= top - marginY && point.y <= bottom + marginY), "x-from-y");
  const rightLine = fitLine(points.filter((point) => point.x >= right - marginX && point.y >= top - marginY && point.y <= bottom + marginY), "x-from-y");
  const topLine = fitLine(points.filter((point) => point.y <= top + marginY && point.x >= left - marginX && point.x <= right + marginX), "y-from-x");
  const bottomLine = fitLine(points.filter((point) => point.y >= bottom - marginY && point.x >= left - marginX && point.x <= right + marginX), "y-from-x");
  if (!leftLine || !rightLine || !topLine || !bottomLine) return null;

  const corners = [
    intersect(leftLine, topLine),
    intersect(rightLine, topLine),
    intersect(rightLine, bottomLine),
    intersect(leftLine, bottomLine),
  ];
  if (corners.some((point) => !point)) return null;
  const normalized = corners.map((point) => ({
    x: clamp((point as Point).x / width, 0, 1),
    y: clamp((point as Point).y / height, 0, 1),
  })) as [Point, Point, Point, Point];

  const topWidth = distance(normalized[0], normalized[1]);
  const bottomWidth = distance(normalized[3], normalized[2]);
  const leftHeight = distance(normalized[0], normalized[3]);
  const rightHeight = distance(normalized[1], normalized[2]);
  const averageWidth = (topWidth + bottomWidth) / 2;
  const averageHeight = (leftHeight + rightHeight) / 2;
  if (!averageWidth || !averageHeight) return null;

  const areaRatio = polygonArea(normalized);
  const aspectRatio = averageWidth / averageHeight;
  const target = scanTypeConfig[scanType].output.width / scanTypeConfig[scanType].output.height;
  const aspectScore = clamp(1 - Math.abs(aspectRatio - target) / (target * 0.35), 0, 1);
  const center = normalized.reduce((current, point) => ({ x: current.x + point.x / 4, y: current.y + point.y / 4 }), { x: 0, y: 0 });
  const centerOffset = Math.hypot(center.x - 0.5, center.y - 0.5) / Math.SQRT1_2;
  const verticalTilt = Math.max(Math.abs(leftLine.slope), Math.abs(rightLine.slope)) / 1.15;
  const horizontalTilt = Math.max(Math.abs(topLine.slope), Math.abs(bottomLine.slope)) / 1.15;
  const tiltScore = clamp(Math.max(verticalTilt, horizontalTilt), 0, 1);
  const areaScore = areaRatio < minAreaRatio ? areaRatio / minAreaRatio : areaRatio > maxAreaRatio ? (1 - areaRatio) / (1 - maxAreaRatio) : 1;
  const centerScore = clamp(1 - centerOffset / 0.5, 0, 1);
  const confidence = clamp(0.42 * aspectScore + 0.26 * areaScore + 0.2 * centerScore + 0.12 * (1 - tiltScore), 0, 1);

  return { corners: normalized, confidence, aspectRatio, areaRatio, centerOffset, tiltScore };
}

function stateForBoundary(boundary: DetectedBoundary | null, scanType: ScanType): BoundaryDetectionResult {
  if (!boundary) return { boundary: null, state: "searching", message: "Align card inside frame" };
  const target = scanTypeConfig[scanType].output.width / scanTypeConfig[scanType].output.height;
  if (Math.abs(boundary.aspectRatio - target) > target * 0.35) return { boundary, state: "detected", message: "Check scan type" };
  if (boundary.areaRatio < minAreaRatio) return { boundary, state: "detected", message: "Move closer" };
  if (boundary.tiltScore > 0.62) return { boundary, state: "detected", message: "Too much tilt" };
  if (boundary.centerOffset > 0.34) return { boundary, state: "detected", message: "Center the card" };
  if (boundary.confidence >= 0.72) return { boundary, state: "aligned", message: "Hold steady" };
  return { boundary, state: "detected", message: "Card detected" };
}

export function detectLiveBoundary(video: HTMLVideoElement, canvas: HTMLCanvasElement, scanType: ScanType): BoundaryDetectionResult {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) return { boundary: null, state: "searching", message: "Camera is warming up" };
  const width = sampleWidth;
  const height = Math.max(1, Math.round(sampleWidth * videoHeight / videoWidth));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { boundary: null, state: "failed", message: "Scanner unavailable" };
  context.drawImage(video, 0, 0, width, height);
  const points = edgePointsFromImage(context.getImageData(0, 0, width, height));
  if (points.length > width * height * 0.22) return { boundary: null, state: "detected", message: "Multiple edges detected" };
  const boundary = buildBoundary(points, width, height, scanType);
  return stateForBoundary(boundary, scanType);
}
