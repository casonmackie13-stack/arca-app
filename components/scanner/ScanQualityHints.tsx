"use client";

import type { ScanUiState } from "@/lib/scanner/scanMetadata";

const messages: Record<ScanUiState, string> = {
  searching: "Line up the card inside the frame",
  unstable: "Hold steady",
  "quality-issue": "Improve lighting or reduce glare",
  ready: "Ready to scan",
};

export default function ScanQualityHints({
  state,
  autoCaptureEnabled,
  stableMs,
  confidence,
}: {
  state: ScanUiState;
  autoCaptureEnabled: boolean;
  stableMs: number;
  confidence: number;
}) {
  const progress = autoCaptureEnabled && state !== "searching"
    ? Math.min(100, Math.round((stableMs / 850) * 100))
    : 0;

  return <div className="absolute inset-x-0 bottom-28 px-5 text-center">
    <div className="mx-auto inline-flex min-h-10 max-w-sm items-center justify-center rounded-full border border-white/15 bg-black/65 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
      {messages[state]}
      {state === "ready" && confidence > 0 ? ` · ${Math.round(confidence * 100)}%` : ""}
    </div>
    {autoCaptureEnabled && state !== "searching" && <div className="mx-auto mt-3 h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full bg-[var(--gold-primary)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>}
  </div>;
}
