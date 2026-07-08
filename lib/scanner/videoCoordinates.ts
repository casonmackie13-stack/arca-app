import type { Point } from "@/lib/scanner/scanMetadata";

export type VideoCoverTransform = {
  /** Scale from native video pixels to CSS display pixels (object-fit: cover). */
  scale: number;
  /** Cropped native pixels hidden on the left/top of the rendered video. */
  offsetNativeX: number;
  offsetNativeY: number;
  /** Rendered video size in CSS pixels (may exceed the visible element). */
  renderedWidth: number;
  renderedHeight: number;
};

export type VideoDisplayMetrics = {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
};

/** object-fit: cover mapping shared by overlays, guide crops, and debug tooling. */
export function getVideoCoverTransform(metrics: VideoDisplayMetrics): VideoCoverTransform {
  const { videoWidth, videoHeight, displayWidth, displayHeight } = metrics;
  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetNativeX = (renderedWidth - displayWidth) / (2 * scale);
  const offsetNativeY = (renderedHeight - displayHeight) / (2 * scale);
  return {
    scale,
    offsetNativeX,
    offsetNativeY,
    renderedWidth,
    renderedHeight,
  };
}

/** Native video pixel → percentage within the visible video element (for SVG overlays). */
export function mapVideoPointToDisplayPercent(point: Point, metrics: VideoDisplayMetrics): Point {
  const { scale, offsetNativeX, offsetNativeY } = getVideoCoverTransform(metrics);
  const displayX = (point.x - offsetNativeX) * scale;
  const displayY = (point.y - offsetNativeY) * scale;
  return {
    x: (displayX / metrics.displayWidth) * 100,
    y: (displayY / metrics.displayHeight) * 100,
  };
}

export function mapCornersToDisplayPercent(corners: Point[], metrics: VideoDisplayMetrics): Point[] {
  return corners.map((point) => mapVideoPointToDisplayPercent(point, metrics));
}

/** CSS position within the video element → native video pixel. */
export function mapDisplayPointToVideo(
  localX: number,
  localY: number,
  metrics: VideoDisplayMetrics,
): Point {
  const { scale, offsetNativeX, offsetNativeY } = getVideoCoverTransform(metrics);
  return {
    x: localX / scale + offsetNativeX,
    y: localY / scale + offsetNativeY,
  };
}

/** DOM rect within the video element → native crop rectangle. */
export function mapDisplayRectToVideoCrop(
  localX: number,
  localY: number,
  width: number,
  height: number,
  metrics: VideoDisplayMetrics,
) {
  const topLeft = mapDisplayPointToVideo(localX, localY, metrics);
  const { scale } = getVideoCoverTransform(metrics);
  return {
    sx: topLeft.x,
    sy: topLeft.y,
    sw: width / scale,
    sh: height / scale,
  };
}
