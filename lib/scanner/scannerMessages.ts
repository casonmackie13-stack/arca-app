import type { CardEdgeDetection, ScannerMessage } from "@/lib/scanner/scanMetadata";

const LABELS: Record<ScannerMessage, string> = {
  "find-edges": "Find card edges",
  "move-closer": "Move closer",
  "hold-steady": "Hold steady",
  "too-blurry": "Too blurry",
  "more-light": "More light needed",
  ready: "Ready",
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
  if (quality.brightnessScore < 0.18) return "more-light";
  if ((quality.fillRatio ?? 0) < 0.1) return "move-closer";

  const stableEnough = detection.confidence >= 0.55
    && quality.stabilityScore >= 0.65
    && stableMs >= 800;

  if (stableEnough) return "ready";
  if (detection.found && detection.confidence >= 0.45) return "hold-steady";
  return "find-edges";
}
