"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ScanType } from "@/components/scanner/scanTypes";
import { detectCardEdges, resolveScanUiState, shouldAutoCapture } from "@/lib/scanner/cardVision";
import type { CardEdgeDetection, ScanPoint, ScanUiState } from "@/lib/scanner/scanMetadata";

const TARGET_FPS = 10;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export function useLiveDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  scanType: ScanType | null,
  active: boolean,
) {
  const [detection, setDetection] = useState<CardEdgeDetection | null>(null);
  const [scanState, setScanState] = useState<ScanUiState>("searching");
  const [stableMs, setStableMs] = useState(0);
  const [opencvReady, setOpencvReady] = useState(false);
  const previousCornersRef = useRef<ScanPoint[] | undefined>(undefined);
  const stableSinceRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!active || !scanType) {
      stableSinceRef.current = null;
      previousCornersRef.current = undefined;
      return;
    }

    let cancelled = false;

    async function tick(now: number) {
      if (cancelled) return;
      if (now - lastTickRef.current < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight || runningRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      runningRef.current = true;
      try {
        const activeScanType = scanType;
        if (!activeScanType) return;
        const result = await detectCardEdges(video, activeScanType, previousCornersRef.current);
        if (cancelled) return;

        setOpencvReady(result.reason !== "OpenCV unavailable");
        setDetection(result);
        previousCornersRef.current = result.corners;

        const stableEnough = result.found
          && result.confidence >= 0.55
          && (result.metrics.stabilityScore ?? 0) >= 0.65
          && result.metrics.blurScore >= 0.28;

        if (stableEnough) {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          const elapsed = now - stableSinceRef.current;
          setStableMs(elapsed);
          setScanState(resolveScanUiState(result, elapsed));
        } else {
          stableSinceRef.current = null;
          setStableMs(0);
          setScanState(resolveScanUiState(result, 0));
        }
      } finally {
        runningRef.current = false;
        if (!cancelled) rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      stableSinceRef.current = null;
      previousCornersRef.current = undefined;
    };
  }, [active, scanType, videoRef]);

  return {
    detection,
    scanState,
    stableMs,
    opencvReady,
    readyForAutoCapture: detection ? shouldAutoCapture(detection, stableMs) : false,
  };
}
