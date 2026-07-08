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
  if (message === "ready" || message === "hold-steady") return "Hold still…";
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
