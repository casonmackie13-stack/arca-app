import type { ScanPoint } from "@/lib/scanner/scanMetadata";
import {
  mapCornersToDisplayPercent,
  mapVideoPointToDisplayPercent,
  type VideoDisplayMetrics,
} from "@/lib/scanner/videoCoordinates";

export type { VideoDisplayMetrics };

/** @deprecated Use mapVideoPointToDisplayPercent from videoCoordinates.ts */
export function mapVideoPointToDisplay(point: ScanPoint, metrics: VideoDisplayMetrics) {
  return mapVideoPointToDisplayPercent(point, metrics);
}

/** @deprecated Use mapCornersToDisplayPercent from videoCoordinates.ts */
export function mapCornersToDisplay(corners: ScanPoint[], metrics: VideoDisplayMetrics) {
  return mapCornersToDisplayPercent(corners, metrics);
}
