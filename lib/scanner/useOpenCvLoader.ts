"use client";

import { useEffect, useState } from "react";
import {
  getOpenCvLoadState,
  preloadOpenCv,
  subscribeOpenCvLoad,
  type OpenCvLoadState,
} from "@/lib/scanner/opencvLoader";
import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";

const DISABLED_STATE: OpenCvLoadState = { status: "idle", error: null, loadMs: null };

/**
 * Preloads OpenCV after camera startup — skipped entirely when feature flag is off.
 */
export function useOpenCvLoader(enabled: boolean, deferUntilCameraStarts = false, cameraStarted = true) {
  const opencvFeatureEnabled = isOpenCvScannerEnabled();
  const [state, setState] = useState<OpenCvLoadState>(() => (
    opencvFeatureEnabled ? getOpenCvLoadState() : DISABLED_STATE
  ));

  useEffect(() => {
    if (!opencvFeatureEnabled || !enabled) return;
    if (deferUntilCameraStarts && !cameraStarted) return;

    let cancelled = false;
    let unsubscribe = () => {};

    const startLoad = () => {
      if (cancelled) return;
      try {
        preloadOpenCv();
        unsubscribe = subscribeOpenCvLoad(setState);
      } catch (error) {
        console.warn("[ARCA Scanner] OpenCV preload failed:", error);
      }
    };

    const timerId = window.setTimeout(startLoad, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      unsubscribe();
    };
  }, [cameraStarted, deferUntilCameraStarts, enabled, opencvFeatureEnabled]);

  if (!opencvFeatureEnabled) return DISABLED_STATE;
  return state;
}
