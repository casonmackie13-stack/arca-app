import type { ScanPoint } from "@/lib/scanner/scanMetadata";

export type VideoDisplayMetrics = {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
};

export function mapVideoPointToDisplay(point: ScanPoint, metrics: VideoDisplayMetrics) {
  const scale = Math.max(metrics.displayWidth / metrics.videoWidth, metrics.displayHeight / metrics.videoHeight);
  const renderedWidth = metrics.videoWidth * scale;
  const renderedHeight = metrics.videoHeight * scale;
  const offsetX = (metrics.displayWidth - renderedWidth) / 2;
  const offsetY = (metrics.displayHeight - renderedHeight) / 2;
  const displayX = offsetX + point.x * scale;
  const displayY = offsetY + point.y * scale;
  return {
    x: (displayX / metrics.displayWidth) * 100,
    y: (displayY / metrics.displayHeight) * 100,
  };
}

export function mapCornersToDisplay(corners: ScanPoint[], metrics: VideoDisplayMetrics) {
  return corners.map((point) => mapVideoPointToDisplay(point, metrics));
}
