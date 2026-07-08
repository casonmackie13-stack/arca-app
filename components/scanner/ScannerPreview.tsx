"use client";

import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** Canonical post-capture preview for Scanner.tsx. */
export default function ScannerPreview({
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

  return (
    <div className="absolute inset-0 flex max-h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <div
        className="shrink-0 px-5 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Preview</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{side === "front" ? "Scan Front" : "Scan Back"}</h3>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5">
        <div
          className="relative max-h-full w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black"
          style={{
            aspectRatio: config.guideAspect,
            maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 10rem)",
          }}
        >
          <ArcaImage src={previewUrl} alt={`${side} capture preview`} className="h-full w-full object-contain" />
        </div>
      </div>

      <div
        className="shrink-0 grid gap-3 border-t border-white/10 bg-black/90 p-4 backdrop-blur sm:grid-cols-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <Button variant="secondary" size="lg" className="w-full" onClick={onRetake}>Retake</Button>
        <Button size="lg" className="w-full" onClick={onUse}>{useLabel}</Button>
      </div>
    </div>
  );
}
