import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import type { Point } from "@/lib/image-processing/cardBoundaryScanner";
import type { OpenCvRuntime } from "@/lib/image-processing/opencvLoader";

export type CaptureMethod = "perspective" | "fixed-overlay-crop" | "full-frame-fallback";

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

export async function perspectiveCorrectVideoFrame({
  cv,
  video,
  corners,
  scanType,
}: {
  cv: OpenCvRuntime;
  video: HTMLVideoElement;
  corners: [Point, Point, Point, Point];
  scanType: ScanType;
}): Promise<CorrectedCapture> {
  const output = scanTypeConfig[scanType].output;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = video.videoWidth;
  sourceCanvas.height = video.videoHeight;
  const context = sourceCanvas.getContext("2d");
  if (!context || !sourceCanvas.width || !sourceCanvas.height) throw new Error("Camera frame is not ready.");
  context.drawImage(video, 0, 0, sourceCanvas.width, sourceCanvas.height);

  let source: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let destination: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  let transform: InstanceType<OpenCvRuntime["Mat"]> | null = null;
  try {
    source = cv.imread(sourceCanvas);
    destination = new cv.Mat();
    const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x * sourceCanvas.width, corners[0].y * sourceCanvas.height,
      corners[1].x * sourceCanvas.width, corners[1].y * sourceCanvas.height,
      corners[2].x * sourceCanvas.width, corners[2].y * sourceCanvas.height,
      corners[3].x * sourceCanvas.width, corners[3].y * sourceCanvas.height,
    ]);
    const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      output.width - 1, 0,
      output.width - 1, output.height - 1,
      0, output.height - 1,
    ]);
    transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
    cv.warpPerspective(source, destination, transform, new cv.Size(output.width, output.height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = output.width;
    targetCanvas.height = output.height;
    cv.imshow(targetCanvas, destination);
    sourcePoints.delete();
    destinationPoints.delete();
    return { file: await canvasToFile(targetCanvas, scanType, "perspective"), method: "perspective" };
  } finally {
    source?.delete();
    destination?.delete();
    transform?.delete();
  }
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
