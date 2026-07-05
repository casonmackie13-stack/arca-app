"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { scannerPhaseLabel, type ScannerPhase } from "@/lib/scanner/scannerTypes";

export default function GuideFrameOverlay({
  scanType,
  overlayRef,
  phase,
  instruction,
}: {
  scanType: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
  phase: ScannerPhase;
  instruction?: string;
}) {
  const config = scanTypeConfig[scanType];
  const aspect = config.guideAspect;

  return <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-10 px-4 text-center">
      {instruction && <p className="mx-auto mb-2 max-w-sm text-sm font-medium text-white/90">{instruction}</p>}
      <div className="mx-auto inline-flex max-w-sm rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
        {scannerPhaseLabel(phase)}
      </div>
    </div>

    <div
      className="absolute inset-x-0 flex items-center justify-center px-6"
      style={{
        top: "calc(env(safe-area-inset-top) + 7rem)",
        bottom: "calc(env(safe-area-inset-bottom) + 13.5rem)",
      }}
    >
      <div
        ref={overlayRef}
        className="relative max-h-full rounded-[1.35rem] border-2 border-white opacity-100 shadow-[0_0_0_9999px_rgba(0,0,0,.42),0_0_28px_rgba(201,164,93,.28)] transition-all duration-200"
        style={{ aspectRatio: aspect, width: "min(78vw, 100%)" }}
      >
        <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
        <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
        <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
        <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
      </div>
    </div>
  </div>;
}
