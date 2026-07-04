"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { runLocalOCR } from "@/lib/scanner/ocr";
import { previewNeedsReview, previewQualityWarnings } from "@/lib/scanner/previewQuality";
import { recognitionPreviewLabel, runRecognitionPreview } from "@/lib/scanner/recognitionPreview";
import type { OcrResult, ScanMetadata, ScanRecognitionPreview } from "@/lib/scanner/scanMetadata";

export default function ScanPreview({
  previewUrl,
  scanType,
  metadata,
  file,
  onRetake,
  onUse,
}: {
  previewUrl: string;
  scanType: ScanType;
  metadata: ScanMetadata;
  file: File;
  onRetake: () => void;
  onUse: (extras: { ocrText?: string; recognition?: ScanRecognitionPreview }) => void;
}) {
  const config = scanTypeConfig[scanType];
  const warnings = previewQualityWarnings(metadata);
  const needsReview = previewNeedsReview(metadata);
  const [recognition, setRecognition] = useState<ScanRecognitionPreview | null>(metadata.recognition ?? null);
  const [recognitionLoading, setRecognitionLoading] = useState(!metadata.recognition);
  const [ocrLoading, setOcrLoading] = useState(true);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  useEffect(() => {
    let active = true;
    setRecognitionLoading(true);
    void runRecognitionPreview(file).then((preview) => {
      if (!active) return;
      setRecognition(preview);
      setRecognitionLoading(false);
    });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    let active = true;
    setOcrLoading(true);
    void runLocalOCR(file).then((result) => {
      if (!active) return;
      setOcrResult(result.text ? result : null);
      setOcrLoading(false);
    });
    return () => { active = false; };
  }, [file]);

  const recognitionLabel = recognitionPreviewLabel(recognition ?? undefined);

  return <div className="flex min-h-[100svh] flex-col bg-black text-white">
    <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan</p>
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

      {(recognitionLoading || recognitionLabel || ocrLoading) && <div className="mt-5 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/80">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gold-primary)]">Recognition preview</p>
        {recognitionLoading && <p className="mt-2">Analyzing card type…</p>}
        {!recognitionLoading && recognitionLabel && <p className="mt-2">Detected: {recognitionLabel}</p>}
        {!recognitionLoading && recognition?.multipleCards && <p className="mt-1 text-[var(--status-warning)]">Multiple cards detected — retake with one card in frame.</p>}
        {!recognitionLoading && recognition?.warnings?.slice(0, 2).map((warning) => (
          <p key={warning} className="mt-1 text-white/65">{warning}</p>
        ))}
        {ocrLoading && <p className="mt-2 text-white/55">Reading card text…</p>}
        {!ocrLoading && ocrResult?.text && (
          <p className="mt-2 text-white/55">
            Local OCR captured {ocrResult.text.split(/\s+/).filter(Boolean).length} words for autofill hints.
          </p>
        )}
      </div>}

      {warnings.length > 0 && <ul className="mt-4 w-full max-w-sm space-y-2 text-sm leading-6 text-white/70">
        {warnings.map((warning) => <li key={warning} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">{warning}</li>)}
      </ul>}
    </div>

    <div className="grid gap-3 border-t border-white/10 bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={onRetake}>Retake</Button>
      <Button size="lg" className="w-full" onClick={() => onUse({ ocrText: ocrResult?.text, recognition: recognition ?? undefined })}>Use this image</Button>
    </div>
  </div>;
}
