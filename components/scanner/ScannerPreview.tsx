"use client";

import { Button } from "@/components/ui/Button";
import ArcaImage from "@/components/ui/ArcaImage";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { qualityBadgeLabel } from "@/lib/scanner/scannerStatus";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** Canonical post-capture preview for Scanner.tsx. */
export default function ScannerPreview({
  previewUrl,
  scanType,
  side,
  qualityBadge,
  qualityLoading,
  retryMessage,
  onRetake,
  onUse,
}: {
  previewUrl: string;
  scanType: ScanType;
  side: "front" | "back";
  qualityBadge?: "poor" | "good" | "excellent";
  qualityLoading?: boolean;
  retryMessage?: string;
  onRetake: () => void;
  onUse: () => void;
}) {
  const config = scanTypeConfig[scanType];
  const useLabel = side === "front" ? "Use Front" : "Use Back";
  const badgeTone = qualityBadge === "excellent"
    ? "border-[var(--status-success)]/50 bg-[var(--status-success-bg)] text-[var(--status-success)]"
    : qualityBadge === "good"
      ? "border-[var(--gold-primary)]/40 bg-[color-mix(in_srgb,var(--gold-primary)_12%,transparent)] text-[var(--gold-primary)]"
      : "border-[var(--status-warning)]/50 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";

  return (
    <div className="absolute inset-0 flex max-h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <div
        className="shrink-0 px-5 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Preview</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{side === "front" ? "Scan Front" : "Scan Back"}</h3>
        {(qualityBadge || qualityLoading) && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[-0.01em] ${badgeTone}`}>
              {qualityLoading ? "Checking quality…" : qualityBadge ? qualityBadgeLabel(qualityBadge) : "Quality"}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5">
        <div
          className="relative max-h-full w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black"
          style={{
            aspectRatio: config.guideAspect,
            maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 12rem)",
          }}
        >
          <ArcaImage src={previewUrl} alt={`${side} capture preview`} className="h-full w-full object-contain" />
        </div>
      </div>

      {retryMessage && (
        <p className="shrink-0 px-5 pb-3 text-center text-sm leading-6 text-white/78">
          {retryMessage}
        </p>
      )}

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
