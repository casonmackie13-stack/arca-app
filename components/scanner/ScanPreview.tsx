"use client";

import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function ScanPreview({
  previewUrl,
  scanType,
  onRetake,
  onUse,
}: {
  previewUrl: string;
  scanType: ScanType;
  onRetake: () => void;
  onUse: () => void;
}) {
  const config = scanTypeConfig[scanType];
  return <div className="flex min-h-[100svh] flex-col bg-black text-white">
    <div className="px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Preview</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{config.title}</h3>
      <p className="mt-2 text-sm text-white/65">Review the crop before using it.</p>
    </div>
    <div className="flex flex-1 items-center justify-center px-5 py-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black" style={{ aspectRatio: `${config.output.width} / ${config.output.height}` }}>
        <ArcaImage src={previewUrl} alt={`${config.title} capture preview`} className="object-contain" />
      </div>
    </div>
    <div className="grid gap-3 border-t border-white/10 bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={onRetake}>Retake</Button>
      <Button size="lg" className="w-full" onClick={onUse}>Use this image</Button>
    </div>
  </div>;
}
