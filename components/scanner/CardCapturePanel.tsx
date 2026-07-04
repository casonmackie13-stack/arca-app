"use client";

import { useEffect, useRef, useState } from "react";
import ArcaImage from "@/components/ui/ArcaImage";

type CaptureSide = "front" | "back";

export default function CardCapturePanel({
  frontPreview,
  backPreview,
  frontProcessing,
  backProcessing,
  onScan,
  onRemove,
}: {
  frontPreview: string | null;
  backPreview: string | null;
  frontProcessing: boolean;
  backProcessing: boolean;
  onScan: (side: CaptureSide) => void;
  onRemove: (side: CaptureSide) => void;
}) {
  const [activeSide, setActiveSide] = useState<CaptureSide>("front");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const preview = activeSide === "front" ? frontPreview : backPreview;
  const processing = activeSide === "front" ? frontProcessing : backProcessing;
  const hasImage = Boolean(preview);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] p-1" role="tablist" aria-label="Capture side">
        {(["front", "back"] as const).map((side) => {
          const active = activeSide === side;
          return <button
            key={side}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => { setActiveSide(side); setMenuOpen(false); }}
            className={`min-w-[5rem] rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${active ? "bg-[var(--gold-primary)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {side}
            {side === "front" && <span className="sr-only"> (required)</span>}
          </button>;
        })}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Capture options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-lg leading-none text-[var(--text-secondary)] hover:border-[var(--gold-primary)] hover:text-[var(--text-primary)]"
        >
          ⋯
        </button>
        {menuOpen && <div className="absolute right-0 top-11 z-20 min-w-[10rem] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] shadow-lg">
          <button
            type="button"
            className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            onClick={() => { setMenuOpen(false); onScan(activeSide); }}
          >
            {hasImage ? "Rescan" : "Open camera"}
          </button>
          {hasImage && <button
            type="button"
            className="block w-full border-t border-[var(--border-subtle)] px-4 py-3 text-left text-sm font-medium text-[var(--status-error)] hover:bg-[var(--surface-hover)]"
            onClick={() => { setMenuOpen(false); onRemove(activeSide); }}
          >
            Remove image
          </button>}
        </div>}
      </div>
    </div>

    <button
      type="button"
      onClick={() => onScan(activeSide)}
      disabled={processing}
      className="group relative mx-auto block w-full max-w-sm touch-manipulation disabled:opacity-60"
      aria-label={activeSide === "front" ? "Scan front of card" : "Scan back of card"}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition ${hasImage ? "border-[var(--border-subtle)] bg-black" : "border-dashed border-[var(--border-strong)] bg-[var(--surface)] group-hover:border-[var(--gold-primary)] group-hover:bg-[var(--surface-hover)]"}`}
        style={{ aspectRatio: activeSide === "front" ? "5 / 7" : "5 / 7" }}
      >
        {preview ? (
          <ArcaImage src={preview} alt={`${activeSide} card preview`} className="object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {activeSide === "front" ? "Scan front" : "Scan back"}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
              Tap to open the camera{activeSide === "back" ? " · optional" : ""}
            </p>
          </div>
        )}
        {processing && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-medium text-white">Preparing…</div>}
        {hasImage && !processing && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
            Tap to rescan
          </div>
        )}
      </div>
    </button>

    <p className="text-center text-xs leading-5 text-[var(--text-tertiary)]">
      {activeSide === "front"
        ? "Front image required · use Library inside the scanner if needed"
        : "Back image improves autofill · optional"}
    </p>
  </div>;
}
