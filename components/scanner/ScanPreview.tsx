"use client";

import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import type { ScanType } from "@/lib/scanner/scannerTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function ScanPreview({
  previewUrl,
  scanType,
  side,
  onRetake,
  onUse,
}: {
  previewUrl: string;
  scanType: ScanType;
  side: "front" | "back";
  onRetake: () => void;
  onUse: () => void;
}) {
  const config = scanTypeConfig[scanType];
  const useLabel = side === "front" ? "Use Front" : "Use Back";

  return <div className="absolute inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white">
    <div className="shrink-0 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan · {side}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{config.title}</h3>
      <p className="mt-2 text-sm text-white/70">Review before continuing</p>
    </div>

    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-2">
      <div
        className="relative max-h-full w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,.45)]"
        style={{ aspectRatio: config.guideAspect }}
      >
        <ArcaImage src={previewUrl} alt={`${side} capture preview`} className="object-contain" />
      </div>
    </div>

    <div className="shrink-0 grid gap-3 border-t border-white/10 bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={onRetake}>Retake</Button>
      <Button size="lg" className="w-full" onClick={onUse}>{useLabel}</Button>
    </div>
  </div>;
}
