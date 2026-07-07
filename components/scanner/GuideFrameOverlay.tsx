"use client";

import type { RefObject } from "react";
import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function GuideFrameOverlay({
  scanType,
  overlayRef,
}: {
  scanType: ScanType;
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  const config = scanTypeConfig[scanType];

  return (
    <div className="pointer-events-none absolute inset-x-0 overflow-hidden">
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{
          top: "var(--scanner-top-reserved)",
          bottom: "var(--scanner-bottom-reserved)",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div
          ref={overlayRef}
          className="relative box-border rounded-[1.35rem] border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.42),0_0_28px_rgba(201,164,93,.28)]"
          style={{
            width: "var(--scanner-frame-width)",
            height: "var(--scanner-frame-height)",
            maxWidth: "calc(100% - 2rem)",
            maxHeight: "100%",
            aspectRatio: config.guideAspect,
          }}
        >
          <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[1.35rem] border-l-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[1.35rem] border-r-4 border-t-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[1.35rem] border-b-4 border-l-4 border-[var(--gold-primary)]" />
          <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[1.35rem] border-b-4 border-r-4 border-[var(--gold-primary)]" />
        </div>
      </div>
    </div>
  );
}
