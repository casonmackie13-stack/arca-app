"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { mapCornersToDisplay } from "@/lib/scanner/displayMapping";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { CardEdgeDetection } from "@/lib/scanner/scanMetadata";
import type { ScanType } from "@/lib/scanner/scannerTypes";

/** Target guide width as a fraction of the rendered video width (75–80%). */
const FRAME_WIDTH_RATIO = 0.775;
const MAX_FRAME_HEIGHT_RATIO = 0.88;
const MIN_FRAME_WIDTH = 200;

export const SCANNER_CSS_DEFAULTS = {
  "--scanner-frame-left": "50%",
  "--scanner-frame-top": "50%",
  "--scanner-frame-width": "280px",
  "--scanner-frame-height": "392px",
  "--scanner-video-left": "0px",
  "--scanner-video-top": "0px",
  "--scanner-video-width": "100%",
  "--scanner-video-height": "100%",
} as Record<string, string>;

/**
 * Positions the guide frame in the same coordinate space as the rendered video.
 * Centers within the video bounding rect — not the header/footer reserved area.
 */
export function useScannerLayout(
  open: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
  scanType: ScanType,
  detection: CardEdgeDetection | null,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const smoothedRef = useRef({ left: 0, top: 0, width: 0, height: 0, initialized: false });

  useLayoutEffect(() => {
    if (!open) {
      smoothedRef.current.initialized = false;
      return;
    }

    function applyFrameRect(
      frameLeft: number,
      frameTop: number,
      frameWidth: number,
      frameHeight: number,
      videoLeft: number,
      videoTop: number,
      videoWidth: number,
      videoHeight: number,
    ) {
      const root = rootRef.current;
      if (!root) return;

      const smooth = smoothedRef.current;
      const lerp = smooth.initialized ? 0.28 : 1;
      const nextLeft = smooth.initialized ? smooth.left + (frameLeft - smooth.left) * lerp : frameLeft;
      const nextTop = smooth.initialized ? smooth.top + (frameTop - smooth.top) * lerp : frameTop;
      const nextWidth = smooth.initialized ? smooth.width + (frameWidth - smooth.width) * lerp : frameWidth;
      const nextHeight = smooth.initialized ? smooth.height + (frameHeight - smooth.height) * lerp : frameHeight;

      smooth.left = nextLeft;
      smooth.top = nextTop;
      smooth.width = nextWidth;
      smooth.height = nextHeight;
      smooth.initialized = true;

      root.style.setProperty("--scanner-frame-left", `${nextLeft}px`);
      root.style.setProperty("--scanner-frame-top", `${nextTop}px`);
      root.style.setProperty("--scanner-frame-width", `${nextWidth}px`);
      root.style.setProperty("--scanner-frame-height", `${nextHeight}px`);
      root.style.setProperty("--scanner-video-left", `${videoLeft}px`);
      root.style.setProperty("--scanner-video-top", `${videoTop}px`);
      root.style.setProperty("--scanner-video-width", `${videoWidth}px`);
      root.style.setProperty("--scanner-video-height", `${videoHeight}px`);

      scanFlowLog("Guide frame layout", {
        frameLeft: Math.round(nextLeft),
        frameTop: Math.round(nextTop),
        frameWidth: Math.round(nextWidth),
        frameHeight: Math.round(nextHeight),
        videoWidth: Math.round(videoWidth),
        videoHeight: Math.round(videoHeight),
      });
    }

    function measure() {
      const video = videoRef.current;
      const root = rootRef.current;
      if (!video || !root) return;

      const videoRect = video.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      if (!videoRect.width || !videoRect.height) return;

      const videoLeft = videoRect.left - rootRect.left;
      const videoTop = videoRect.top - rootRect.top;
      const aspect = scanTypeConfig[scanType].aspectRatio;

      let frameWidth = Math.max(MIN_FRAME_WIDTH, videoRect.width * FRAME_WIDTH_RATIO);
      let frameHeight = frameWidth / aspect;

      const maxHeight = videoRect.height * MAX_FRAME_HEIGHT_RATIO;
      if (frameHeight > maxHeight) {
        frameHeight = maxHeight;
        frameWidth = frameHeight * aspect;
      }

      let frameLeft = videoLeft + (videoRect.width - frameWidth) / 2;
      let frameTop = videoTop + (videoRect.height - frameHeight) / 2;

      if (
        detection?.found
        && detection.corners?.length === 4
        && video.videoWidth
        && video.videoHeight
        && detection.confidence >= 0.4
      ) {
        const displayCorners = mapCornersToDisplay(detection.corners, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          displayWidth: videoRect.width,
          displayHeight: videoRect.height,
        });

        const pxCorners = displayCorners.map((point) => ({
          x: videoLeft + (point.x / 100) * videoRect.width,
          y: videoTop + (point.y / 100) * videoRect.height,
        }));

        const minX = Math.min(...pxCorners.map((p) => p.x));
        const maxX = Math.max(...pxCorners.map((p) => p.x));
        const minY = Math.min(...pxCorners.map((p) => p.y));
        const maxY = Math.max(...pxCorners.map((p) => p.y));

        const detectCenterX = (minX + maxX) / 2;
        const detectCenterY = (minY + maxY) / 2;
        const track = Math.min(0.42, 0.12 + detection.confidence * 0.3);

        const targetLeft = detectCenterX - frameWidth / 2;
        const targetTop = detectCenterY - frameHeight / 2;

        frameLeft += (targetLeft - frameLeft) * track;
        frameTop += (targetTop - frameTop) * track;

        frameLeft = Math.max(videoLeft, Math.min(frameLeft, videoLeft + videoRect.width - frameWidth));
        frameTop = Math.max(videoTop, Math.min(frameTop, videoTop + videoRect.height - frameHeight));
      }

      applyFrameRect(
        frameLeft,
        frameTop,
        frameWidth,
        frameHeight,
        videoLeft,
        videoTop,
        videoRect.width,
        videoRect.height,
      );
    }

    measure();
    let rafId = 0;

    function tick() {
      measure();
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    const observer = new ResizeObserver(measure);
    if (videoRef.current) observer.observe(videoRef.current);
    if (rootRef.current) observer.observe(rootRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [detection, open, scanType, videoRef]);

  return rootRef;
}
