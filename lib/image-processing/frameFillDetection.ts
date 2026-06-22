import type { ScanType } from "@/components/scanner/scanTypes";
import type { VideoCropRect } from "@/lib/image-processing/perspectiveCorrection";
import { getVideoCropRectFromOverlay } from "@/lib/image-processing/perspectiveCorrection";

export type FrameFillStatus = {
  isFilled: boolean;
  fillScore: number;
  edgeScore: number;
  contrastScore: number;
  stabilityScore: number;
  reason: string;
};

type AnalyzeFrameFillOptions = {
  video: HTMLVideoElement;
  overlay: HTMLElement;
  canvas: HTMLCanvasElement;
  previous: Uint8ClampedArray | null;
  scanType: ScanType;
};

const sampleWidth = 60;
const sampleHeight = 84;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function cellActivity(sample: Uint8ClampedArray, width: number, height: number, columns: number, rows: number) {
  let active = 0;
  const total = columns * rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const startX = Math.floor(column * width / columns);
      const endX = Math.floor((column + 1) * width / columns);
      const startY = Math.floor(row * height / rows);
      const endY = Math.floor((row + 1) * height / rows);
      let min = 255;
      let max = 0;
      let edge = 0;
      let count = 0;
      for (let y = Math.max(1, startY); y < Math.min(height - 1, endY); y += 1) {
        for (let x = Math.max(1, startX); x < Math.min(width - 1, endX); x += 1) {
          const value = sample[y * width + x];
          min = Math.min(min, value);
          max = Math.max(max, value);
          edge += Math.abs(sample[y * width + x + 1] - sample[y * width + x - 1]) + Math.abs(sample[(y + 1) * width + x] - sample[(y - 1) * width + x]);
          count += 1;
        }
      }
      const localContrast = (max - min) / 255;
      const localEdge = count ? edge / (count * 255) : 0;
      if (localContrast > 0.08 || localEdge > 0.06) active += 1;
    }
  }
  return active / total;
}

function regionMean(sample: Uint8ClampedArray, width: number, height: number, x1: number, y1: number, x2: number, y2: number) {
  let sum = 0;
  let count = 0;
  for (let y = Math.floor(y1 * height); y < Math.floor(y2 * height); y += 1) {
    for (let x = Math.floor(x1 * width); x < Math.floor(x2 * width); x += 1) {
      sum += sample[y * width + x];
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

export function analyzeFrameFill({ video, overlay, canvas, previous, scanType }: AnalyzeFrameFillOptions): { status: FrameFillStatus; sample: Uint8ClampedArray | null; cropRect: VideoCropRect | null } {
  let cropRect: VideoCropRect;
  try {
    cropRect = getVideoCropRectFromOverlay({ videoElement: video, overlayElement: overlay });
  } catch {
    return { status: { isFilled: false, fillScore: 0, edgeScore: 0, contrastScore: 0, stabilityScore: 0, reason: "Camera is warming up" }, sample: previous, cropRect: null };
  }

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { status: { isFilled: false, fillScore: 0, edgeScore: 0, contrastScore: 0, stabilityScore: 0, reason: "Scanner unavailable" }, sample: previous, cropRect };
  context.drawImage(video, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const sample = new Uint8ClampedArray(canvas.width * canvas.height);
  let sum = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const offset = index * 4;
    const gray = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    sample[index] = gray;
    sum += gray;
  }
  const mean = sum / sample.length;
  let variance = 0;
  let edgeTotal = 0;
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const value = sample[y * canvas.width + x];
      variance += (value - mean) ** 2;
      edgeTotal += Math.abs(sample[y * canvas.width + x + 1] - sample[y * canvas.width + x - 1]) + Math.abs(sample[(y + 1) * canvas.width + x] - sample[(y - 1) * canvas.width + x]);
    }
  }

  let diff = 255;
  if (previous && previous.length === sample.length) {
    diff = 0;
    for (let index = 0; index < sample.length; index += 1) diff += Math.abs(sample[index] - previous[index]);
    diff /= sample.length;
  }

  const activeCoverage = cellActivity(sample, canvas.width, canvas.height, 5, 7);
  const centerMean = regionMean(sample, canvas.width, canvas.height, 0.28, 0.28, 0.72, 0.72);
  const borderMean = (
    regionMean(sample, canvas.width, canvas.height, 0, 0, 1, 0.13) +
    regionMean(sample, canvas.width, canvas.height, 0, 0.87, 1, 1) +
    regionMean(sample, canvas.width, canvas.height, 0, 0, 0.13, 1) +
    regionMean(sample, canvas.width, canvas.height, 0.87, 0, 1, 1)
  ) / 4;
  const centerBorderDifference = Math.abs(centerMean - borderMean) / 255;
  const edgeScore = clamp(edgeTotal / (sample.length * 22));
  const contrastScore = clamp(Math.sqrt(variance / sample.length) / 48);
  const stabilityScore = clamp(1 - diff / 18);
  const fillScore = clamp(activeCoverage * 0.62 + contrastScore * 0.2 + edgeScore * 0.14 + (1 - centerBorderDifference) * 0.04);
  const thresholds = scanType === "graded-slab" ? { fill: 0.68, edge: 0.28 } : { fill: 0.72, edge: 0.35 };

  let reason = scanType === "graded-slab" ? "Fit the full slab and label inside the frame" : "Fit card inside frame";
  if (fillScore > 0.45 || edgeScore > 0.2) reason = "Fill the frame";
  if (fillScore >= thresholds.fill && edgeScore < thresholds.edge) reason = "Move card into frame";
  if (fillScore >= thresholds.fill && edgeScore >= thresholds.edge && stabilityScore < 0.55) reason = "Hold steady";
  const isFilled = fillScore >= thresholds.fill && edgeScore >= thresholds.edge && contrastScore >= 0.12;
  if (isFilled) reason = "Hold steady";

  return { status: { isFilled, fillScore, edgeScore, contrastScore, stabilityScore, reason }, sample, cropRect };
}
