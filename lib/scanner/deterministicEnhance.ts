"use client";

import type { ScanQualityMetrics } from "@/lib/scanner/scanMetadata";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function luminance(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Mild, non-generative corrections only — no content invention.
 * Applies exposure, contrast, white balance, and optional light sharpening.
 */
export function applyDeterministicEnhance(
  source: HTMLCanvasElement,
  quality?: ScanQualityMetrics,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;

  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  const outCtx = output.getContext("2d");
  if (!srcCtx || !outCtx) return source;

  const { width, height } = source;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const samples = data.length / 4;
  for (let i = 0; i < data.length; i += 16) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const avgR = rSum / (samples / 4);
  const avgG = gSum / (samples / 4);
  const avgB = bSum / (samples / 4);
  const gray = (avgR + avgG + avgB) / 3 || 1;
  const wbR = gray / Math.max(1, avgR);
  const wbG = gray / Math.max(1, avgG);
  const wbB = gray / Math.max(1, avgB);

  const targetLum = quality && quality.brightnessScore < 0.35 ? 0.48 : 0.42;
  const exposureGain = quality && quality.brightnessScore < 0.3 ? 1.08 : 1.04;
  const contrast = quality && (quality.glareScore ?? 0) > 0.2 ? 1.02 : 1.05;
  const shouldSharpen = (quality?.blurScore ?? 0.5) >= 0.28;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * wbR;
    let g = data[i + 1] * wbG;
    let b = data[i + 2] * wbB;

    const lum = luminance(r, g, b);
    let adjusted = (lum - 0.5) * contrast + 0.5;
    adjusted = adjusted * exposureGain + (targetLum - 0.42) * 0.12;
    if (adjusted > 0.82) {
      const t = (adjusted - 0.82) / 0.18;
      adjusted = 0.82 + 0.18 * (1 - Math.pow(1 - t, 2));
    }
    adjusted = clamp01(adjusted);
    const scale = lum > 0.001 ? adjusted / lum : 1;

    r = clamp01((r / 255) * scale) * 255;
    g = clamp01((g / 255) * scale) * 255;
    b = clamp01((b / 255) * scale) * 255;

    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
  }

  if (shouldSharpen) {
    applyMildSharpen(data, width, height);
  }

  outCtx.putImageData(imageData, 0, 0);
  return output;
}

function applyMildSharpen(data: Uint8ClampedArray, width: number, height: number) {
  const copy = new Uint8ClampedArray(data);
  const kernel = [0, -0.08, 0, -0.08, 1.32, -0.08, 0, -0.08, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + channel;
            sum += copy[idx] * kernel[ki];
            ki += 1;
          }
        }
        const outIdx = (y * width + x) * 4 + channel;
        data[outIdx] = Math.max(0, Math.min(255, Math.round(sum)));
      }
    }
  }
}

export async function applyDeterministicEnhanceAsync(
  source: HTMLCanvasElement,
  quality?: ScanQualityMetrics,
): Promise<HTMLCanvasElement> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  return applyDeterministicEnhance(source, quality);
}
