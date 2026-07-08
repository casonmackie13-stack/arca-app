"use client";

import type { RefObject } from "react";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import type { ScanProgressStep } from "@/lib/scanner/scannerStatus";
import type { OpenCvStatus } from "@/lib/scanner/opencvLoader";
import type { ScanType } from "@/lib/scanner/scannerTypes";

const PROGRESS_STEPS: { id: ScanProgressStep; label: string }[] = [
  { id: "front", label: "Scan Front" },
  { id: "back", label: "Scan Back" },
  { id: "review", label: "Review" },
];

function sideTitle(side: "front" | "back") {
  return side === "front" ? "Scan Front" : "Scan Back";
}

/** Top and bottom controls — float over full-bleed camera preview. */
export default function ScannerControls({
  activeSide,
  scanType,
  statusText,
  opencvStatusText,
  opencvStatus,
  opencvLoadMs,
  progressStep,
  autoCaptureEnabled,
  autoCaptureProgress,
  capturing,
  cameraInitializing,
  captureError,
  showSkipBack,
  headerRef,
  footerRef,
  fileInputRef,
  onClose,
  onScanTypeChange,
  onToggleAutoCapture,
  onCapture,
  onSkipBack,
  onLibraryPick,
}: {
  activeSide: "front" | "back";
  scanType: ScanType;
  statusText: string;
  opencvStatusText: string;
  opencvStatus: OpenCvStatus;
  opencvLoadMs: number | null;
  progressStep: ScanProgressStep;
  autoCaptureEnabled: boolean;
  autoCaptureProgress: number;
  capturing: boolean;
  cameraInitializing: boolean;
  captureError: string | null;
  showSkipBack: boolean;
  headerRef: RefObject<HTMLElement | null>;
  footerRef: RefObject<HTMLElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onScanTypeChange: (scanType: ScanType) => void;
  onToggleAutoCapture: () => void;
  onCapture: () => void;
  onSkipBack?: () => void;
  onLibraryPick: (file: File | null) => void;
}) {
  const progressIndex = PROGRESS_STEPS.findIndex((step) => step.id === progressStep);

  return (
    <>
      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
      >
        <div
          className="pointer-events-none bg-gradient-to-b from-black/72 via-black/28 to-transparent px-4 pb-10"
        >
          <div className="pointer-events-auto flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scanner"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/45 text-lg font-light text-white/95 backdrop-blur-md"
            >
              ×
            </button>
            <div className="min-w-0 flex-1 pt-0.5 text-center">
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">{sideTitle(activeSide)}</p>
              <p className="mt-1 text-[13px] font-normal tracking-[-0.01em] text-white/72">
                Center your card inside the frame.
              </p>
            </div>
            <div className="h-10 w-10 shrink-0" aria-hidden />
          </div>

          <div className="pointer-events-none mt-4 flex items-center justify-center gap-2 px-2">
            {PROGRESS_STEPS.map((step, index) => {
              const active = index === progressIndex;
              const complete = index < progressIndex;
              return (
                <div key={step.id} className="scanner-progress-step flex items-center gap-2">
                  <span
                    className={`text-[11px] font-medium tracking-[-0.01em] ${
                      active ? "text-[var(--gold-primary)]" : complete ? "text-white/72" : "text-white/38"
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < PROGRESS_STEPS.length - 1 && (
                    <span className="text-[10px] text-white/24">→</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none mt-3 flex flex-col items-center gap-2 px-4">
            <div className="scanner-status-pill inline-flex min-h-8 max-w-[min(92vw,22rem)] items-center justify-center rounded-full border border-white/12 bg-black/48 px-4 py-1.5">
              <p className="text-[12px] font-medium tracking-[-0.01em] text-white/92">{statusText}</p>
            </div>
            <div
              className={`inline-flex min-h-7 max-w-[min(92vw,24rem)] items-center justify-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-[-0.01em] ${
                opencvStatus === "ready"
                  ? "border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]"
                  : opencvStatus === "failed"
                    ? "border-[var(--status-warning)]/50 bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                    : "border-white/12 bg-black/40 text-white/72"
              }`}
            >
              {opencvStatusText}
              {opencvStatus === "ready" && opencvLoadMs != null ? (
                <span className="ml-1.5 text-white/45">({opencvLoadMs}ms)</span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {captureError && (
        <div className="pointer-events-none absolute inset-x-4 z-20" style={{ top: "calc(env(safe-area-inset-top) + 7.5rem)" }}>
          <div className="pointer-events-auto rounded-xl border border-[var(--status-warning)]/80 bg-black/80 p-3 text-sm leading-6 text-white shadow-xl backdrop-blur-md">
            <p>{captureError}</p>
          </div>
        </div>
      )}

      <footer
        ref={footerRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="pointer-events-none bg-gradient-to-t from-black/78 via-black/34 to-transparent px-4 pb-2 pt-16">
          <div className="pointer-events-auto mx-auto flex max-w-md flex-col items-center gap-3">
            <ScanTypeToggle
              value={scanType}
              onChange={onScanTypeChange}
              disabled={capturing}
            />

            <div className="flex w-full items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onToggleAutoCapture}
                aria-pressed={autoCaptureEnabled}
                className={`min-w-[7.5rem] rounded-full border px-4 py-2 text-[12px] font-semibold tracking-[-0.01em] transition ${
                  autoCaptureEnabled
                    ? "border-[var(--gold-primary)]/60 bg-[var(--gold-primary)]/18 text-[var(--gold-primary)]"
                    : "border-white/18 bg-black/42 text-white/78"
                }`}
              >
                {autoCaptureEnabled ? "Auto Capture On" : "Auto Capture Off"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-white/18 bg-black/42 px-4 py-2 text-[12px] font-semibold tracking-[-0.01em] text-white/85"
              >
                Library
              </button>
              {showSkipBack && (
                <button
                  type="button"
                  onClick={() => onSkipBack?.()}
                  className="rounded-full border border-white/18 bg-black/42 px-4 py-2 text-[12px] font-semibold tracking-[-0.01em] text-white/85"
                >
                  Skip Back
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  onLibraryPick(file);
                }}
              />
            </div>

            {autoCaptureEnabled && autoCaptureProgress > 0 && !capturing && (
              <div className="h-1 w-32 overflow-hidden rounded-full bg-white/14">
                <div
                  className="h-full rounded-full bg-[var(--gold-primary)] transition-[width] duration-100 ease-linear"
                  style={{ width: `${autoCaptureProgress}%` }}
                />
              </div>
            )}

            <button
              type="button"
              disabled={capturing || cameraInitializing}
              onClick={onCapture}
              className="scanner-shutter-ring relative flex h-[5.1rem] w-[5.1rem] items-center justify-center disabled:opacity-45"
              aria-label="Capture image"
            >
              <span className="relative flex h-[4.2rem] w-[4.2rem] items-center justify-center rounded-full border-[3px] border-white bg-white/12 shadow-[0_0_0_5px_rgba(255,255,255,.1)]">
                <span className="h-[3rem] w-[3rem] rounded-full bg-white" />
              </span>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
