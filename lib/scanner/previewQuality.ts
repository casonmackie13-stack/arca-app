import type { ScanMetadata, ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

export function previewQualityWarnings(metadata?: ScanMetadata): string[] {
  if (!metadata) return [];
  const warnings: string[] = [];
  const quality = metadata.quality;

  if (!metadata.edgeDetected || metadata.fallbackCrop) {
    warnings.push("Card edges were not fully detected");
  }
  if (quality) {
    if (quality.blurScore < 0.32) warnings.push("Image may be blurry");
    if (quality.brightnessScore < 0.2) warnings.push("Low light");
    if ((quality.glareScore ?? 0) > 0.18) warnings.push("Glare detected");
    if ((quality.shadowScore ?? 0) > 0.28) warnings.push("Heavy shadows detected");
  }
  if (warnings.length === 0 && metadata.edgeDetected && metadata.perspectiveCorrected) {
    return [];
  }
  if (warnings.length > 0 && !warnings.includes("Try retaking for a cleaner listing image")) {
    warnings.push("Try retaking for a cleaner listing image");
  }
  return warnings;
}

export function previewNeedsReview(metadata?: ScanMetadata): boolean {
  return previewQualityWarnings(metadata).length > 0;
}

export function assessCaptureQuality(canvas: HTMLCanvasElement): ScanQualityMetrics {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { blurScore: 0.5, brightnessScore: 0.5, fillRatio: 0.5, stabilityScore: 1 };
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

  return {
    blurScore: Math.min(1, variance * 18),
    brightnessScore: mean,
    glareScore: brightPixels / samples,
    shadowScore: darkPixels / samples,
    fillRatio: 0.85,
    stabilityScore: 1,
  };
}
