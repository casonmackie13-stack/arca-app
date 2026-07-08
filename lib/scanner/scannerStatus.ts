import type { CardEdgeDetection, ScannerMessage } from "@/lib/scanner/scanMetadata";
import type { ScannerPhase } from "@/lib/scanner/scannerTypes";

/** Premium user-facing scanner status copy. */
export function scannerStatusDisplay(
  phase: ScannerPhase,
  message: ScannerMessage,
  detection: CardEdgeDetection | null,
): string {
  if (phase === "CAPTURING") return "Capturing…";
  if (phase === "INITIALIZING") return "Starting camera…";
  if (message === "capturing") return "Capturing…";
  if (message === "ready") return "Perfect — capturing";
  if (message === "too-blurry") return "Image is blurry";
  if (message === "too-much-glare") return "Too much glare";
  if (message === "move-closer") return "Move closer";
  if (message === "hold-steady") return "Hold still…";
  if (message === "more-light") return "More light needed";
  if (detection?.found && detection.confidence >= 0.45) return "Card detected";
  return "Looking for card…";
}

export type ScanProgressStep = "front" | "back" | "review";

export function scanProgressStep(
  activeSide: "front" | "back",
  mode: "camera" | "preview" | "error",
): ScanProgressStep {
  if (mode === "preview") return "review";
  return activeSide;
}

export function qualityBadgeLabel(badge: "poor" | "good" | "excellent") {
  if (badge === "excellent") return "Excellent";
  if (badge === "good") return "Good";
  return "Poor";
}

export function qualityRetryMessage(badge: "poor" | "good" | "excellent", aiAction?: string | null) {
  if (badge === "excellent") return "";
  if (aiAction) return aiAction;
  return "This photo may be blurry or glared. Retake for better listing quality?";
}
