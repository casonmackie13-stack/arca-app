"use client";

import type { RefObject } from "react";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import type { ScanType } from "@/lib/scanner/scannerTypes";

function sideLabel(side: "front" | "back") {
  return side === "front" ? "Scan Front" : "Scan Back";
}

/** Top and bottom controls for the canonical Scanner.tsx shell. */
export default function ScannerControls({
  activeSide,
  scanType,
  phaseLabel,
  backInstruction,
  capturing,
  cameraInitializing,
  captureError,
  showSkipBack,
  headerRef,
  footerRef,
  fileInputRef,
  onClose,
  onScanTypeChange,
  onCapture,
  onSkipBack,
  onLibraryPick,
}: {
  activeSide: "front" | "back";
  scanType: ScanType;
  phaseLabel: string;
  backInstruction?: string;
  capturing: boolean;
  cameraInitializing: boolean;
  captureError: string | null;
  showSkipBack: boolean;
  headerRef: RefObject<HTMLElement | null>;
  footerRef: RefObject<HTMLElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onScanTypeChange: (scanType: ScanType) => void;
  onCapture: () => void;
  onSkipBack?: () => void;
  onLibraryPick: (file: File | null) => void;
}) {
  return (
    <>
      <header
        ref={headerRef}
        className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-xl font-light backdrop-blur"
          >
            ×
          </button>
          <div className="min-w-0 flex-1 pt-1 text-center">
            <p className="text-sm font-semibold tracking-[-0.01em]">{sideLabel(activeSide)}</p>
            {backInstruction && <p className="mt-1 text-xs text-white/75">{backInstruction}</p>}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gold-primary)]">
              {phaseLabel}
            </p>
          </div>
          <div className="h-11 w-11 shrink-0" aria-hidden />
        </div>
      </header>

      {captureError && (
        <div
          className="absolute inset-x-4 z-20 rounded-xl border border-[var(--status-warning)] bg-black/85 p-3 text-sm leading-6 shadow-xl backdrop-blur"
          style={{ top: "var(--scanner-top-reserved, calc(env(safe-area-inset-top) + 72px))" }}
        >
          <p>{captureError}</p>
        </div>
      )}

      <footer
        ref={footerRef}
        className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/85 backdrop-blur-md"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          paddingTop: "12px",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        <div className="mb-3 flex justify-center">
          <ScanTypeToggle
            value={scanType}
            onChange={onScanTypeChange}
            disabled={capturing}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled
            title="Auto capture coming soon"
            className="cursor-not-allowed rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/40"
          >
            Auto Off
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white/85"
          >
            Library
          </button>
          {showSkipBack && (
            <button
              type="button"
              onClick={() => onSkipBack?.()}
              className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white/85"
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

        <div className="flex justify-center">
          <button
            type="button"
            disabled={capturing || cameraInitializing}
            onClick={onCapture}
            className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center disabled:opacity-50"
            aria-label="Capture image"
          >
            <span className="relative flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full border-4 border-white bg-white/15 shadow-[0_0_0_6px_rgba(255,255,255,.12)]">
              <span className="h-[2.5rem] w-[2.5rem] rounded-full bg-white" />
            </span>
          </button>
        </div>
      </footer>
    </>
  );
}
