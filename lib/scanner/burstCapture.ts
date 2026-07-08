"use client";

import type { VideoCropRect } from "@/lib/scanner/cropMapping";

const BURST_FRAME_COUNT = 4;
const BURST_INTERVAL_MS = 90;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Draw a native-resolution crop from the video stream (not the CSS preview size). */
export function drawNativeVideoCrop(
  video: HTMLVideoElement,
  crop: VideoCropRect,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.sw));
  canvas.height = Math.max(1, Math.round(crop.sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    video,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export async function captureBurstFrames(
  video: HTMLVideoElement,
  crop: VideoCropRect,
  frameCount = BURST_FRAME_COUNT,
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    frames.push(drawNativeVideoCrop(video, crop));
    if (index < frameCount - 1) await sleep(BURST_INTERVAL_MS);
  }
  return frames;
}

export function scaleCanvasTo(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}
