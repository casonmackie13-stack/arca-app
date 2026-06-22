import {
  fallbackCardDetection,
  isGradedSlabClass,
  type CardBoundary,
  type CardDetectionAnalysis,
} from "@/lib/image-processing/cardDetection";

export type CardFormatKind = "raw-card" | "graded-slab";

export type CardFormattingResult = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  kind: CardFormatKind;
  usedFallback: boolean;
};

const rawOutput = { width: 1000, height: 1400 };
const slabOutput = { width: 1000, height: 1600 };
const paddingColor = "#050505";

function outputSize(kind: CardFormatKind) {
  return kind === "graded-slab" ? slabOutput : rawOutput;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function boundaryPixels(boundary: CardBoundary, width: number, height: number) {
  return {
    left: clamp(boundary.left * width, 0, width),
    top: clamp(boundary.top * height, 0, height),
    right: clamp(boundary.right * width, 0, width),
    bottom: clamp(boundary.bottom * height, 0, height),
  };
}

function expandToAspect(box: { left: number; top: number; right: number; bottom: number }, width: number, height: number, targetAspect: number) {
  const boxWidth = box.right - box.left;
  const boxHeight = box.bottom - box.top;
  if (boxWidth <= 0 || boxHeight <= 0) return { left: 0, top: 0, right: width, bottom: height };
  let nextWidth = boxWidth;
  let nextHeight = boxHeight;
  const currentAspect = boxWidth / boxHeight;
  if (currentAspect > targetAspect) nextHeight = boxWidth / targetAspect;
  else nextWidth = boxHeight * targetAspect;
  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  let left = centerX - nextWidth / 2;
  let top = centerY - nextHeight / 2;
  let right = centerX + nextWidth / 2;
  let bottom = centerY + nextHeight / 2;
  if (left < 0) { right -= left; left = 0; }
  if (right > width) { left -= right - width; right = width; }
  if (top < 0) { bottom -= top; top = 0; }
  if (bottom > height) { top -= bottom - height; bottom = height; }
  return {
    left: clamp(left, 0, width),
    top: clamp(top, 0, height),
    right: clamp(right, 0, width),
    bottom: clamp(bottom, 0, height),
  };
}

function canvasToFile(canvas: HTMLCanvasElement, source: File, suffix: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Unable to format image.")); return; }
      const baseName = source.name.replace(/\.[^.]+$/, "") || "card";
      resolve(new File([blob], `${baseName}-${suffix}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.9);
  });
}

function containDrawRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export async function formatCardImage(file: File, analysis?: CardDetectionAnalysis | null): Promise<CardFormattingResult> {
  try {
    const bitmap = await createImageBitmap(file);
    const fallback = fallbackCardDetection({ width: bitmap.width, height: bitmap.height });
    const resolved = analysis?.boundary ? analysis : fallback;
    const kind: CardFormatKind = resolved.boundary?.type === "graded-slab" || isGradedSlabClass(resolved.classification) ? "graded-slab" : "raw-card";
    const target = outputSize(kind);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = paddingColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const boundary = resolved.boundary || fallback.boundary;
    const pixels = boundary ? boundaryPixels(boundary, bitmap.width, bitmap.height) : { left: 0, top: 0, right: bitmap.width, bottom: bitmap.height };
    const source = kind === "raw-card"
      ? expandToAspect(pixels, bitmap.width, bitmap.height, target.width / target.height)
      : pixels;
    const sourceWidth = Math.max(1, source.right - source.left);
    const sourceHeight = Math.max(1, source.bottom - source.top);

    if (kind === "raw-card") {
      context.drawImage(bitmap, source.left, source.top, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
    } else {
      const destination = containDrawRect(sourceWidth, sourceHeight, target.width, target.height);
      context.drawImage(bitmap, source.left, source.top, sourceWidth, sourceHeight, destination.x, destination.y, destination.width, destination.height);
    }

    bitmap.close();
    const formattedFile = await canvasToFile(canvas, file, kind === "graded-slab" ? "slab-formatted" : "card-formatted");
    return {
      file: formattedFile,
      previewUrl: URL.createObjectURL(formattedFile),
      width: target.width,
      height: target.height,
      kind,
      usedFallback: !analysis || analysis.source === "fallback",
    };
  } catch {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      kind: "raw-card",
      usedFallback: true,
    };
  }
}
