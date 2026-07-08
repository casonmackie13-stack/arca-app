"use client";

import { useEffect, useState } from "react";
import {
  getOpenCvLoadState,
  preloadOpenCv,
  subscribeOpenCvLoad,
  type OpenCvLoadState,
} from "@/lib/scanner/opencvLoader";

/** Preloads OpenCV on mount and mirrors global load state into React. */
export function useOpenCvLoader(active: boolean): OpenCvLoadState {
  const [state, setState] = useState<OpenCvLoadState>(() => getOpenCvLoadState());

  useEffect(() => {
    if (!active) return;
    preloadOpenCv();
    return subscribeOpenCvLoad(setState);
  }, [active]);

  return state;
}
