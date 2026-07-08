"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { defaultCornerFractions, type Point } from "@/lib/scanner/core/perspectiveTransform";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

type DragKind = "corner" | "edge";
type DragState = { kind: DragKind; index: number; last: Point } | null;

const LOUPE_SIZE = 128;
const LOUPE_ZOOM = 2.4;

/**
 * Manual four-corner crop editor with corner + edge handles and a magnifier
 * loupe. Corners are normalized fractions (0..1) of the image so they map
 * directly to display pixels and native capture pixels.
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
  const draggingRef = useRef<DragState>(null);
  const cornersRef = useRef<Point[] | null>(null);

  const [corners, setCorners] = useState<Point[] | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [active, setActive] = useState<Point | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  const setCornersSynced = useCallback((next: Point[]) => {
    cornersRef.current = next;
    setCorners(next);
  }, []);

  const initCorners = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    setCornersSynced(defaultCornerFractions(img.naturalWidth, img.naturalHeight, aspectRatio));
    setImageReady(true);
  }, [aspectRatio, setCornersSynced]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) initCorners();
  }, [initCorners]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const update = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [imageReady]);

  const eventToFraction = useCallback((clientX: number, clientY: number): Point | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const beginDrag = useCallback((kind: DragKind, index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const f = eventToFraction(event.clientX, event.clientY);
    draggingRef.current = { kind, index, last: f ?? { x: 0, y: 0 } };
    const current = cornersRef.current;
    if (current) {
      setActive(kind === "corner"
        ? current[index]
        : {
            x: (current[index].x + current[(index + 1) % 4].x) / 2,
            y: (current[index].y + current[(index + 1) % 4].y) / 2,
          });
    }
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture unsupported — window listeners still handle movement.
    }
  }, [eventToFraction]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = draggingRef.current;
      if (!drag) return;
      event.preventDefault();
      const f = eventToFraction(event.clientX, event.clientY);
      const current = cornersRef.current;
      if (!f || !current) return;

      if (drag.kind === "corner") {
        const next = [...current];
        next[drag.index] = f;
        cornersRef.current = next;
        setCorners(next);
        setActive(f);
        return;
      }

      const dx = f.x - drag.last.x;
      const dy = f.y - drag.last.y;
      drag.last = f;
      const a = drag.index;
      const b = (drag.index + 1) % 4;
      const next = [...current];
      next[a] = { x: clamp01(next[a].x + dx), y: clamp01(next[a].y + dy) };
      next[b] = { x: clamp01(next[b].x + dx), y: clamp01(next[b].y + dy) };
      cornersRef.current = next;
      setCorners(next);
      setActive({ x: (next[a].x + next[b].x) / 2, y: (next[a].y + next[b].y) / 2 });
    }
    function onUp() {
      draggingRef.current = null;
      setActive(null);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [eventToFraction]);

  const resetCorners = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth || !img.naturalHeight) return;
    setCornersSynced(defaultCornerFractions(img.naturalWidth, img.naturalHeight, aspectRatio));
  }, [aspectRatio, setCornersSynced]);

  const polygonPoints = corners
    ? corners.map((corner) => `${corner.x * 100},${corner.y * 100}`).join(" ")
    : "";

  const edges = corners
    ? corners.map((corner, index) => {
        const next = corners[(index + 1) % 4];
        return { index, x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 };
      })
    : [];

  // Magnifier: place it away from the finger (top when dragging the bottom half).
  const loupeOnTop = active ? active.y > 0.4 : true;
  const loupeStyle: React.CSSProperties | null = active && box
    ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${box.w * LOUPE_ZOOM}px ${box.h * LOUPE_ZOOM}px`,
        backgroundPosition: `${LOUPE_SIZE / 2 - active.x * box.w * LOUPE_ZOOM}px ${LOUPE_SIZE / 2 - active.y * box.h * LOUPE_ZOOM}px`,
      }
    : null;

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
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-white/90">Align to the card edges</p>
        <button
          type="button"
          onClick={resetCorners}
          className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-semibold text-white/85"
        >
          Reset
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-2">
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

              {edges.map((edge) => (
                <div
                  key={`edge-${edge.index}`}
                  onPointerDown={beginDrag("edge", edge.index)}
                  className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{
                    left: `${edge.x * 100}%`,
                    top: `${edge.y * 100}%`,
                    touchAction: "none",
                    cursor: "move",
                  }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--gold-primary)] bg-black/60 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
                </div>
              ))}

              {corners.map((corner, index) => (
                <div
                  key={`corner-${index}`}
                  onPointerDown={beginDrag("corner", index)}
                  className="absolute z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{
                    left: `${corner.x * 100}%`,
                    top: `${corner.y * 100}%`,
                    touchAction: "none",
                    cursor: "grab",
                  }}
                >
                  <span className="absolute h-12 w-12 rounded-full bg-[var(--gold-primary)]/15" />
                  <span className="h-5 w-5 rounded-full border-2 border-white bg-[var(--gold-primary)] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
                </div>
              ))}
            </>
          )}
        </div>

        {loupeStyle && (
          <div
            className="pointer-events-none absolute z-30 overflow-hidden rounded-full border-2 border-white/80 shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
            style={{
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              top: loupeOnTop ? "calc(env(safe-area-inset-top) + 14px)" : "auto",
              bottom: loupeOnTop ? "auto" : 20,
              left: "50%",
              transform: "translateX(-50%)",
              ...loupeStyle,
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--gold-primary)]/90" />
            <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 bg-[var(--gold-primary)]/90" />
          </div>
        )}
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
