"use client";

import { useEffect, useState } from "react";
import {
  getOpenCvLoadState,
  preloadOpenCv,
  subscribeOpenCvLoad,
  type OpenCvLoadState,
} from "@/lib/scanner/opencvLoader";

/**
 * Preloads OpenCV after camera startup effects run — never blocks getUserMedia.
 * Pass `enabled` once the scanner is open; optionally wait until camera has started requesting.
 */
export function useOpenCvLoader(enabled: boolean, deferUntilCameraStarts = false, cameraStarted = true) {
  const [state, setState] = useState<OpenCvLoadState>(() => getOpenCvLoadState());

  useEffect(() => {
    if (!enabled) return;
    if (deferUntilCameraStarts && !cameraStarted) return;

    let cancelled = false;
    let unsubscribe = () => {};

    const startLoad = () => {
      if (cancelled) return;
      preloadOpenCv();
      unsubscribe = subscribeOpenCvLoad(setState);
    };

    // Defer until after child CameraView effect invokes getUserMedia.
    const timerId = window.setTimeout(startLoad, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      unsubscribe();
    };
  }, [cameraStarted, deferUntilCameraStarts, enabled]);

  return state;
}
