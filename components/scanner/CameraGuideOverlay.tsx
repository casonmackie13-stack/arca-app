"use client";

import { useEffect, useRef, useState } from "react";
import { defaultCornerFractions } from "@/lib/scanner/core/perspectiveTransform";

/**
 * Card-shaped alignment guide drawn over the live camera.
 * Positions itself against the object-contain video box so it maps 1:1 to
 * captured-frame coordinates (matching the crop editor's default corners).
 */
export default function CameraGuideOverlay({
  videoWidth,
  videoHeight,
  aspectRatio,
  fill = 0.8,
}: {
  videoWidth: number;
  videoHeight: number;
  aspectRatio: number;
  fill?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  let guide: { left: number; top: number; width: number; height: number } | null = null;
  if (size && size.w > 0 && size.h > 0 && videoWidth > 0 && videoHeight > 0) {
    const scale = Math.min(size.w / videoWidth, size.h / videoHeight);
    const boxW = videoWidth * scale;
    const boxH = videoHeight * scale;
    const boxLeft = (size.w - boxW) / 2;
    const boxTop = (size.h - boxH) / 2;

    const fractions = defaultCornerFractions(videoWidth, videoHeight, aspectRatio, fill);
    const x0 = fractions[0].x;
    const y0 = fractions[0].y;
    const x1 = fractions[2].x;
    const y1 = fractions[2].y;

    guide = {
      left: boxLeft + x0 * boxW,
      top: boxTop + y0 * boxH,
      width: (x1 - x0) * boxW,
      height: (y1 - y0) * boxH,
    };
  }

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10">
      {guide && (
        <div
          className="absolute rounded-xl"
          style={{
            left: guide.left,
            top: guide.top,
            width: guide.width,
            height: guide.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)",
            border: "2px solid rgba(201,164,93,0.9)",
          }}
        >
          {[
            "left-0 top-0 border-l-2 border-t-2 rounded-tl-xl",
            "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl",
            "right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl",
            "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-xl",
          ].map((corner) => (
            <span
              key={corner}
              className={`absolute h-6 w-6 border-white ${corner}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
