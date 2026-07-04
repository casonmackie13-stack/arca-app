"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import type { ScanPoint } from "@/lib/scanner/scanMetadata";

export default function LiveEdgeOverlay({
  type,
  overlayRef,
  displayCorners,
}: {
  type: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
  displayCorners: ScanPoint[] | null;
}) {
  const config = scanTypeConfig[type];
  const aspect = `${config.output.width} / ${config.output.height}`;
  const widthFromHeight = `${Math.round((config.output.width / config.output.height) * 68)}vh`;
  const corners = displayCorners?.length === 4 ? displayCorners : null;

  return <div className="pointer-events-none absolute inset-0">
    <div className="absolute inset-0 flex items-center justify-center px-6 py-24">
      <div
        ref={overlayRef}
        className={`relative rounded-[1.35rem] border-2 transition-opacity duration-200 ${corners ? "border-white/25 opacity-35" : "border-white opacity-100 shadow-[0_0_0_9999px_rgba(0,0,0,.42),0_0_28px_rgba(201,164,93,.28)]"}`}
        style={{ aspectRatio: aspect, width: `min(78vw, ${widthFromHeight}, 22rem)` }}
      >
        {!corners && <>
          <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
        </>}
        {!corners && <div className="absolute -bottom-14 left-1/2 w-[82vw] max-w-sm -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur">
          {config.guidance}
        </div>}
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
        fill="rgba(201,164,93,0.08)"
        stroke="url(#edgeGlow)"
        strokeWidth="0.55"
        strokeLinejoin="round"
      />
      {corners.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="0.9" fill="rgba(201,164,93,0.95)" />
      ))}
    </svg>}
  </div>;
}
