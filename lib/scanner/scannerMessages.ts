import type { CardEdgeDetection, ScannerMessage } from "@/lib/scanner/scanMetadata";
import { AUTO_CAPTURE_STABLE_MS } from "@/lib/scanner/core/constants";

const LABELS: Record<ScannerMessage, string> = {
  "find-edges": "Looking for card…",
  "move-closer": "Move closer",
  "hold-steady": "Hold steady",
  "too-blurry": "Image is blurry",
  "too-much-glare": "Too much glare",
  "more-light": "More light needed",
  ready: "Perfect — capturing",
  capturing: "Capturing…",
};

export function scannerMessageLabel(message: ScannerMessage) {
  return LABELS[message];
}

export function resolveScannerMessage(
  detection: CardEdgeDetection | null,
  stableMs: number,
  capturing: boolean,
): ScannerMessage {
  if (capturing) return "capturing";
  if (!detection?.found) return "find-edges";

  const quality = detection.quality;
  if (quality.blurScore < 0.28) return "too-blurry";
  if ((quality.glareScore ?? 0) > 0.22) return "too-much-glare";
  if (quality.brightnessScore < 0.18) return "more-light";
  if ((quality.fillRatio ?? 0) < 0.1) return "move-closer";

  const stableEnough = detection.confidence >= 0.55
    && quality.stabilityScore >= 0.65
    && stableMs >= AUTO_CAPTURE_STABLE_MS;

  if (stableEnough) return "ready";
  if (detection.confidence >= 0.45) return "hold-steady";
  return "find-edges";
}
