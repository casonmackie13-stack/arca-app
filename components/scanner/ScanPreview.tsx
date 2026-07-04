"use client";

import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { previewNeedsReview, previewQualityWarnings } from "@/lib/scanner/previewQuality";
import type { ScanMetadata } from "@/lib/scanner/scanMetadata";

export default function ScanPreview({
  previewUrl,
  scanType,
  metadata,
  onRetake,
  onUse,
}: {
  previewUrl: string;
  scanType: ScanType;
  metadata: ScanMetadata;
  onRetake: () => void;
  onUse: () => void;
}) {
  const config = scanTypeConfig[scanType];
  const warnings = previewQualityWarnings(metadata);
  const needsReview = previewNeedsReview(metadata);

  return <div className="flex min-h-[100svh] flex-col bg-black text-white">
    <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Preview</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{config.title}</h3>
        <p className={`mt-2 text-sm ${needsReview ? "text-[var(--status-warning)]" : "text-[var(--status-success)]"}`}>
          {needsReview ? "Needs review" : "Good scan"}
        </p>
      </div>
    </div>

    <div className="flex flex-1 flex-col items-center justify-center px-5 py-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,.45)]" style={{ aspectRatio: `${config.output.width} / ${config.output.height}` }}>
        <ArcaImage src={previewUrl} alt={`${config.title} capture preview`} className="object-contain" />
      </div>
      {warnings.length > 0 && <ul className="mt-5 w-full max-w-sm space-y-2 text-sm leading-6 text-white/70">
        {warnings.map((warning) => <li key={warning} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">{warning}</li>)}
      </ul>}
    </div>

    <div className="grid gap-3 border-t border-white/10 bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={onRetake}>Retake</Button>
      <Button size="lg" className="w-full" onClick={onUse}>Use this image</Button>
    </div>
  </div>;
}
