"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function BoundaryOverlay({ type, overlayRef }: { type: ScanType; overlayRef: RefObject<HTMLDivElement | null> }) {
  const config = scanTypeConfig[type];
  const aspect = `${config.output.width} / ${config.output.height}`;
  const widthFromHeight = `${Math.round((config.output.width / config.output.height) * 68)}vh`;
  return <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 py-24">
    <div
      ref={overlayRef}
      className="relative rounded-[1.35rem] border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.42),0_0_28px_rgba(201,164,93,.28)]"
      style={{ aspectRatio: aspect, width: `min(78vw, ${widthFromHeight}, 22rem)` }}
    >
      <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
      <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
      <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
      <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
      <div className="absolute -bottom-14 left-1/2 w-[82vw] max-w-sm -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur">
        {config.guidance}
      </div>
    </div>
  </div>;
}
