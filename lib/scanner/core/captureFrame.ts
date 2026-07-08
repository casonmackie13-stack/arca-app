"use client";

/** Capture the full native-resolution video frame — never the CSS preview size. */
export function captureNativeVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is still loading. Try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  try {
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  } catch (error) {
    console.warn("[ARCA Scanner] Native frame capture failed:", error);
    throw error instanceof Error ? error : new Error("Could not capture video frame.");
  }

  return canvas;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** Capture multiple full native frames for burst selection. */
export async function captureNativeBurst(
  video: HTMLVideoElement,
  frameCount: number,
  intervalMs: number,
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    frames.push(captureNativeVideoFrame(video));
    if (index < frameCount - 1) await sleep(intervalMs);
  }
  return frames;
}
