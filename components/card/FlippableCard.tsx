"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import ArcaImage from "@/components/ui/ArcaImage";

export type FlippableCardProps = {
  frontImageUrl: string;
  backImageUrl?: string | null;
  alt: string;
  className?: string;
  initiallyFlipped?: boolean;
  /** Hide footer controls; use in card tiles where tap flips in place */
  compact?: boolean;
  allowFlip?: boolean;
  imageClassName?: string;
};

function stopNavigation(event: MouseEvent | PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export default function FlippableCard({
  frontImageUrl,
  backImageUrl,
  alt,
  className = "",
  initiallyFlipped = false,
  compact = false,
  allowFlip = true,
  imageClassName = "object-contain",
}: FlippableCardProps) {
  const canFlip = Boolean(allowFlip && backImageUrl);
  const [flipped, setFlipped] = useState(Boolean(backImageUrl && initiallyFlipped));
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const handledSwipe = useRef(false);

  function finishPointer(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current || !canFlip) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
      handledSwipe.current = true;
      setFlipped(dx < 0);
    }
  }

  function toggleFlip(event?: MouseEvent | PointerEvent) {
    if (!canFlip) return;
    if (event) stopNavigation(event);
    setFlipped((current) => !current);
  }

  const stage = <div className={`flippable-card-stage ${flipped ? "is-flipped" : ""}`}>
    <div className="flippable-card-inner">
      <div className="flippable-card-face">
        <ArcaImage src={frontImageUrl} alt={`${alt} front`} className={imageClassName} sizes={compact ? "(max-width: 640px) 50vw, 25vw" : undefined} />
      </div>
      {backImageUrl && (
        <div className="flippable-card-face flippable-card-back">
          <ArcaImage src={backImageUrl} alt={`${alt} back`} className={imageClassName} sizes={compact ? "(max-width: 640px) 50vw, 25vw" : undefined} />
        </div>
      )}
    </div>
  </div>;

  if (!canFlip) {
    return <div className={`mx-auto aspect-[2.5/3.5] w-full ${className}`}>{stage}</div>;
  }

  if (compact) {
    return <div className={`h-full w-full ${className}`}>
      <button
        type="button"
        aria-label={`Flip card. ${flipped ? "Back" : "Front"} currently shown.`}
        aria-pressed={flipped}
        className="block h-full w-full touch-pan-y rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        onPointerDown={(event) => { stopNavigation(event); pointerStart.current = { x: event.clientX, y: event.clientY }; handledSwipe.current = false; }}
        onPointerUp={(event) => { stopNavigation(event); finishPointer(event); }}
        onPointerCancel={() => { pointerStart.current = null; }}
        onClick={(event) => {
          stopNavigation(event);
          if (handledSwipe.current) { handledSwipe.current = false; return; }
          toggleFlip();
        }}
      >
        {stage}
      </button>
    </div>;
  }

  return <div className={`mx-auto w-full ${className}`}>
    <button
      type="button"
      aria-label={`Flip card. ${flipped ? "Back" : "Front"} currently shown.`}
      aria-pressed={flipped}
      className="block aspect-[2.5/3.5] w-full touch-pan-y rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]"
      onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; handledSwipe.current = false; }}
      onPointerUp={finishPointer}
      onPointerCancel={() => { pointerStart.current = null; }}
      onClick={() => {
        if (handledSwipe.current) { handledSwipe.current = false; return; }
        toggleFlip();
      }}
    >
      {stage}
    </button>
    <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--text-tertiary)]">
      <span aria-live="polite">Viewing {flipped ? "back" : "front"}</span>
      <button type="button" className="min-h-11 touch-manipulation rounded-full border border-[var(--border-subtle)] px-4 font-semibold text-[var(--text-secondary)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]" onClick={() => toggleFlip()}>Flip card</button>
    </div>
  </div>;
}
