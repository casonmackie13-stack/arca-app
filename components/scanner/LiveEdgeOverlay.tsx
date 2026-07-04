"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { scannerMessageLabel } from "@/lib/scanner/scannerMessages";
import type { ScanPoint, ScannerMessage } from "@/lib/scanner/scanMetadata";

export default function LiveEdgeOverlay({
  type,
  overlayRef,
  displayCorners,
  statusMessage,
  autoCaptureEnabled,
  stableMs,
}: {
  type: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
  displayCorners: ScanPoint[] | null;
  statusMessage: ScannerMessage;
  autoCaptureEnabled: boolean;
  stableMs: number;
}) {
  const config = scanTypeConfig[type];
  const aspect = `${config.output.width} / ${config.output.height}`;
  const widthFromHeight = `${Math.round((config.output.width / config.output.height) * 68)}vh`;
  const corners = displayCorners?.length === 4 ? displayCorners : null;
  const progress = autoCaptureEnabled && statusMessage !== "find-edges"
    ? Math.min(100, Math.round((stableMs / 800) * 100))
    : 0;

  return <div className="pointer-events-none absolute inset-0">
    <div className="absolute inset-x-0 top-[42%] z-10 px-6 text-center">
      <div className="mx-auto inline-flex max-w-sm rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
        {scannerMessageLabel(statusMessage)}
      </div>
      {autoCaptureEnabled && progress > 0 && statusMessage !== "capturing" && <div className="mx-auto mt-2 h-1 w-28 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[var(--gold-primary)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>}
    </div>

    <div className="absolute inset-0 flex items-center justify-center px-6 py-24">
      <div
        ref={overlayRef}
        className={`relative rounded-[1.35rem] border-2 transition-all duration-200 ${corners ? "border-white/20 opacity-30" : "border-white opacity-100 shadow-[0_0_0_9999px_rgba(0,0,0,.42),0_0_28px_rgba(201,164,93,.28)]"}`}
        style={{ aspectRatio: aspect, width: `min(78vw, ${widthFromHeight}, 22rem)` }}
      >
        {!corners && <>
          <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
        </>}
      </div>
    </div>

    {corners && <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(201,164,93,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
        </linearGradient>
      </defs>
      <polygon
        points={corners.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="rgba(201,164,93,0.1)"
        stroke="url(#edgeGlow)"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
      {corners.map((point, index) => (
        <g key={index}>
          <circle cx={point.x} cy={point.y} r="1.6" fill="rgba(0,0,0,0.35)" />
          <circle cx={point.x} cy={point.y} r="1.1" fill="rgba(201,164,93,0.95)" stroke="white" strokeWidth="0.15" />
        </g>
      ))}
    </svg>}
  </div>;
}
