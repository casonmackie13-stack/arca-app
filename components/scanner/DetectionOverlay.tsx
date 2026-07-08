"use client";

import { useEffect, useState, type RefObject } from "react";
import { mapCornersToDisplay } from "@/lib/scanner/displayMapping";
import type { CardEdgeDetection } from "@/lib/scanner/scanMetadata";

type OverlayState = {
  points: string;
  opacity: number;
};

/** Thin OpenCV edge outline and corner markers — shares the video coordinate space. */
export default function DetectionOverlay({
  videoRef,
  detection,
  active,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  detection: CardEdgeDetection | null;
  active: boolean;
}) {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);

  useEffect(() => {
    if (!active || !detection?.found || detection.corners?.length !== 4) {
      setOverlay(null);
      return;
    }

    let rafId = 0;
    let lastPaint = 0;

    function paint(now: number) {
      if (now - lastPaint < 66) {
        rafId = requestAnimationFrame(paint);
        return;
      }
      lastPaint = now;

      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight || !detection?.corners) {
        rafId = requestAnimationFrame(paint);
        return;
      }

      const videoRect = video.getBoundingClientRect();
      if (!videoRect.width || !videoRect.height) {
        rafId = requestAnimationFrame(paint);
        return;
      }

      const displayCorners = mapCornersToDisplay(detection.corners, {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        displayWidth: videoRect.width,
        displayHeight: videoRect.height,
      });

      setOverlay({
        points: displayCorners.map((point) => `${point.x},${point.y}`).join(" "),
        opacity: Math.min(1, 0.35 + detection.confidence * 0.55),
      });

      rafId = requestAnimationFrame(paint);
    }

    rafId = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(rafId);
  }, [active, detection, videoRef]);

  if (!overlay) return null;

  return (
    <svg
      className="scanner-edge-svg pointer-events-none absolute z-[14] overflow-visible"
      style={{
        left: "var(--scanner-video-left, 0)",
        top: "var(--scanner-video-top, 0)",
        width: "var(--scanner-video-width, 100%)",
        height: "var(--scanner-video-height, 100%)",
        opacity: overlay.opacity,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon
        points={overlay.points}
        fill="rgba(201,164,93,0.06)"
        stroke="rgba(201,164,93,0.82)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {overlay.points.split(" ").map((pair, index) => {
        const [x, y] = pair.split(",").map(Number);
        return (
          <g key={index}>
            <circle cx={x} cy={y} r="1.35" fill="rgba(0,0,0,0.4)" />
            <circle cx={x} cy={y} r="0.85" fill="rgba(201,164,93,0.95)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.2" />
          </g>
        );
      })}
    </svg>
  );
}
