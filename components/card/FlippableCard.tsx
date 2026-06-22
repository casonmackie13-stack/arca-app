"use client";

import { useRef, useState } from "react";
import ArcaImage from "@/components/ui/ArcaImage";

export default function FlippableCard({ frontImageUrl, backImageUrl, alt, className = "", initiallyFlipped = false }: { frontImageUrl: string; backImageUrl?: string | null; alt: string; className?: string; initiallyFlipped?: boolean }) {
  const [flipped, setFlipped] = useState(Boolean(backImageUrl && initiallyFlipped));
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const handledSwipe = useRef(false);

  function finishPointer(event: React.PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current || !backImageUrl) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
      handledSwipe.current = true;
      setFlipped(dx < 0);
    }
  }

  const card = <div className={`flippable-card-stage ${flipped ? "is-flipped" : ""}`}>
    <div className="flippable-card-inner">
      <div className="flippable-card-face"><ArcaImage src={frontImageUrl} alt={`${alt} front`} className="object-contain"/></div>
      {backImageUrl && <div className="flippable-card-face flippable-card-back"><ArcaImage src={backImageUrl} alt={`${alt} back`} className="object-contain"/></div>}
    </div>
  </div>;

  if (!backImageUrl) return <div className={`mx-auto aspect-[2.5/3.5] w-full ${className}`}>{card}</div>;
  return <div className={`mx-auto w-full ${className}`}>
    <button type="button" aria-label={`Flip card. ${flipped ? "Back" : "Front"} currently shown.`} aria-pressed={flipped} className="block aspect-[2.5/3.5] w-full touch-pan-y rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]" onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; handledSwipe.current = false; }} onPointerUp={finishPointer} onPointerCancel={() => { pointerStart.current = null; }} onClick={() => { if (handledSwipe.current) { handledSwipe.current = false; return; } setFlipped((current) => !current); }}>{card}</button>
    <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--text-tertiary)]"><span aria-live="polite">Viewing {flipped ? "back" : "front"}</span><button type="button" className="min-h-11 touch-manipulation rounded-full border border-[var(--border-subtle)] px-4 font-semibold text-[var(--text-secondary)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]" onClick={() => setFlipped((current) => !current)}>Flip card</button></div>
  </div>;
}
