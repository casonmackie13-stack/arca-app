"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { defaultCornerFractions, type Point } from "@/lib/scanner/core/perspectiveTransform";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Manual four-corner crop editor. Corners are tracked as normalized fractions
 * (0..1) of the image so they map directly to both display and native pixels.
 */
export default function CornerCropEditor({
  imageUrl,
  aspectRatio,
  confirming,
  onConfirm,
  onRetake,
  onClose,
}: {
  imageUrl: string;
  aspectRatio: number;
  confirming: boolean;
  onConfirm: (corners: Point[]) => void;
  onRetake: () => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const draggingRef = useRef<number | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [imageReady, setImageReady] = useState(false);

  const initCorners = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    setCorners(defaultCornerFractions(img.naturalWidth, img.naturalHeight, aspectRatio));
    setImageReady(true);
  }, [aspectRatio]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) initCorners();
  }, [initCorners]);

  const updateCornerFromEvent = useCallback((clientX: number, clientY: number) => {
    const index = draggingRef.current;
    const wrapper = wrapperRef.current;
    if (index == null || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fx = clamp01((clientX - rect.left) / rect.width);
    const fy = clamp01((clientY - rect.top) / rect.height);
    setCorners((current) => {
      if (!current) return current;
      const next = [...current];
      next[index] = { x: fx, y: fy };
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = index;
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture unsupported — pointer move on window still works.
    }
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current == null) return;
    event.preventDefault();
    updateCornerFromEvent(event.clientX, event.clientY);
  }, [updateCornerFromEvent]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (draggingRef.current == null) return;
      updateCornerFromEvent(event.clientX, event.clientY);
    }
    function onUp() {
      draggingRef.current = null;
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [updateCornerFromEvent]);

  const polygonPoints = corners
    ? corners.map((corner) => `${corner.x * 100},${corner.y * 100}`).join(" ")
    : "";

  return (
    <div
      className="absolute inset-0 flex max-h-[100dvh] flex-col bg-black text-white"
      style={{ touchAction: "none" }}
    >
      <div
        className="pointer-events-auto flex shrink-0 items-center justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "8px" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-lg font-light text-white/95 backdrop-blur-md"
        >
          ×
        </button>
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-white/90">Drag corners to the card edges</p>
        <div className="h-10 w-10" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-2">
        <div ref={wrapperRef} className="relative inline-block max-h-full max-w-full select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Captured card"
            onLoad={initCorners}
            className="block max-h-[calc(100dvh-13rem)] max-w-full object-contain"
            draggable={false}
          />

          {imageReady && corners && (
            <>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                <polygon
                  points={polygonPoints}
                  fill="rgba(201,164,93,0.12)"
                  stroke="rgba(201,164,93,0.95)"
                  strokeWidth="0.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {corners.map((corner, index) => (
                <div
                  key={index}
                  onPointerDown={handlePointerDown(index)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{
                    left: `${corner.x * 100}%`,
                    top: `${corner.y * 100}%`,
                    touchAction: "none",
                    cursor: "grab",
                  }}
                >
                  <span className="absolute h-11 w-11 rounded-full bg-[var(--gold-primary)]/15" />
                  <span className="h-5 w-5 rounded-full border-2 border-white bg-[var(--gold-primary)] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div
        className="shrink-0 grid grid-cols-2 gap-3 border-t border-white/10 bg-black/90 p-4 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          type="button"
          onClick={onRetake}
          disabled={confirming}
          className="w-full rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={() => corners && onConfirm(corners)}
          disabled={confirming || !corners}
          className="w-full rounded-full bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {confirming ? "Cropping…" : "Crop Card"}
        </button>
      </div>
    </div>
  );
}
