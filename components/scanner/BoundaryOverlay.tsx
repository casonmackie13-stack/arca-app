"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

type BoundaryDetectionState = "searching" | "detected" | "aligned" | "capturing" | "failed";
type OverlayBoundary = { corners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] };

const stateColor: Record<BoundaryDetectionState, string> = {
  searching: "rgba(255,255,255,.72)",
  detected: "rgba(255,255,255,.95)",
  aligned: "rgb(34,197,94)",
  capturing: "rgb(201,164,93)",
  failed: "rgb(248,113,113)",
};

export default function BoundaryOverlay({
  type,
  overlayRef,
  detectedBoundary,
  state = "searching",
  message,
}: {
  type: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
  detectedBoundary?: OverlayBoundary | null;
  state?: BoundaryDetectionState;
  message?: string;
}) {
  const config = scanTypeConfig[type];
  const aspect = `${config.output.width} / ${config.output.height}`;
  const widthFromHeight = `${Math.round((config.output.width / config.output.height) * 68)}vh`;
  const points = detectedBoundary?.corners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
  return <div className="pointer-events-none absolute inset-0">
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {points && <polygon points={points} fill="rgba(201,164,93,.08)" stroke={stateColor[state]} strokeWidth="0.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
    </svg>
    <div className="absolute inset-0 flex items-center justify-center px-6 py-24">
    <div
      ref={overlayRef}
      className="relative rounded-[1.35rem] border-2 border-white/45 shadow-[0_0_0_9999px_rgba(0,0,0,.34),0_0_28px_rgba(201,164,93,.18)]"
      style={{ aspectRatio: aspect, width: `min(78vw, ${widthFromHeight}, 22rem)` }}
    >
      <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
      <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
      <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
      <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
      <div className="absolute -bottom-16 left-1/2 w-[82vw] max-w-sm -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur">
        {message || config.guidance}
      </div>
    </div>
    </div>
  </div>;
}
