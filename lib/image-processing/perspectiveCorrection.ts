import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export type Point = { x: number; y: number };

export type CaptureMethod = "perspective-correction" | "fixed-overlay-crop" | "full-frame-fallback";

export type CorrectedCapture = {
  file: File;
  method: CaptureMethod;
};

export type VideoCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  videoWidth: number;
  videoHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export function getVideoCropRectFromOverlay({
  videoElement,
  overlayElement,
}: {
  videoElement: HTMLVideoElement;
  overlayElement: HTMLElement;
}): VideoCropRect {
  const videoRect = videoElement.getBoundingClientRect();
  const overlayRect = overlayElement.getBoundingClientRect();
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;
  if (!videoWidth || !videoHeight || !videoRect.width || !videoRect.height) throw new Error("Camera frame is not ready.");

  // The video element uses object-fit: cover. CSS pixels map to source video pixels
  // through the cover scale, with centered overflow cropped outside the element.
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;
  const sourceX = (overlayRect.left - videoRect.left - offsetX) / scale;
  const sourceY = (overlayRect.top - videoRect.top - offsetY) / scale;
  const sourceWidth = overlayRect.width / scale;
  const sourceHeight = overlayRect.height / scale;
  const sx = Math.max(0, Math.min(videoWidth, sourceX));
  const sy = Math.max(0, Math.min(videoHeight, sourceY));
  const sw = Math.max(1, Math.min(videoWidth - sx, sourceWidth));
  const sh = Math.max(1, Math.min(videoHeight - sy, sourceHeight));
  return { sx, sy, sw, sh, videoWidth, videoHeight, clientWidth: videoRect.width, clientHeight: videoRect.height };
}

function canvasToFile(canvas: HTMLCanvasElement, scanType: ScanType, method: CaptureMethod) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Unable to capture image.")); return; }
      const suffix = scanType === "graded-slab" ? "slab" : "card";
      resolve(new File([blob], `${suffix}-${method}-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.9);
  });
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-8) throw new Error("Perspective transform is unstable.");
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let entry = column; entry <= size; entry++) augmented[column][entry] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry++) augmented[row][entry] -= factor * augmented[column][entry];
    }
  }
  return augmented.map((row) => row[size]);
}

function homographyFromDestinationToSource(source: [Point, Point, Point, Point], width: number, height: number) {
  const destination = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  const matrix: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index++) {
    const from = destination[index];
    const to = source[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0, -from.x * to.x, -from.y * to.x]);
    values.push(to.x);
    matrix.push([0, 0, 0, from.x, from.y, 1, -from.x * to.y, -from.y * to.y]);
    values.push(to.y);
  }
  const h = solveLinearSystem(matrix, values);
  return [...h, 1];
}

function sampleBilinear(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, offset: number, output: Uint8ClampedArray) {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = clampedX - x0;
  const dy = clampedY - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;
  for (let channel = 0; channel < 4; channel++) {
    const top = data[i00 + channel] * (1 - dx) + data[i10 + channel] * dx;
    const bottom = data[i01 + channel] * (1 - dx) + data[i11 + channel] * dx;
    output[offset + channel] = top * (1 - dy) + bottom * dy;
  }
}

export async function perspectiveCorrectVideoFrame(video: HTMLVideoElement, corners: [Point, Point, Point, Point], scanType: ScanType): Promise<CorrectedCapture> {
  const output = scanTypeConfig[scanType].output;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = video.videoWidth;
  sourceCanvas.height = video.videoHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !sourceCanvas.width || !sourceCanvas.height) throw new Error("Camera frame is not ready.");
  sourceContext.drawImage(video, 0, 0, sourceCanvas.width, sourceCanvas.height);
  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const pixelCorners = corners.map((point) => ({ x: point.x * sourceCanvas.width, y: point.y * sourceCanvas.height })) as [Point, Point, Point, Point];
  const transform = homographyFromDestinationToSource(pixelCorners, output.width, output.height);
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = output.width;
  targetCanvas.height = output.height;
  const targetContext = targetCanvas.getContext("2d");
  if (!targetContext) throw new Error("Canvas is unavailable.");
  const targetImage = targetContext.createImageData(output.width, output.height);
  for (let y = 0; y < output.height; y++) {
    for (let x = 0; x < output.width; x++) {
      const denominator = transform[6] * x + transform[7] * y + transform[8];
      const sourceX = (transform[0] * x + transform[1] * y + transform[2]) / denominator;
      const sourceY = (transform[3] * x + transform[4] * y + transform[5]) / denominator;
      sampleBilinear(sourceData.data, sourceCanvas.width, sourceCanvas.height, sourceX, sourceY, (y * output.width + x) * 4, targetImage.data);
    }
  }
  targetContext.putImageData(targetImage, 0, 0);
  return { file: await canvasToFile(targetCanvas, scanType, "perspective-correction"), method: "perspective-correction" };
}

export async function fixedOverlayCropVideoFrame(video: HTMLVideoElement, overlay: HTMLElement, scanType: ScanType): Promise<CorrectedCapture> {
  const { sx, sy, sw, sh } = getVideoCropRectFromOverlay({ videoElement: video, overlayElement: overlay });
  const output = scanTypeConfig[scanType].output;
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(video, sx, sy, sw, sh, 0, 0, output.width, output.height);
  return { file: await canvasToFile(canvas, scanType, "fixed-overlay-crop"), method: "fixed-overlay-crop" };
}

export async function fullFrameCapture(video: HTMLVideoElement, scanType: ScanType): Promise<CorrectedCapture> {
  if (!video.videoWidth || !video.videoHeight) throw new Error("Camera frame is not ready.");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { file: await canvasToFile(canvas, scanType, "full-frame-fallback"), method: "full-frame-fallback" };
}
