"use client";

import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";

declare global {
  interface Window {
    cv?: OpenCvNamespace & { onRuntimeInitialized?: () => void };
  }
}

export type OpenCvNamespace = {
  Mat: new (...args: unknown[]) => OpenCvMat;
  MatVector: new () => OpenCvMatVector;
  Size: new (width: number, height: number) => unknown;
  CLAHE: new (clipLimit: number, tileGridSize: unknown) => { apply: (src: OpenCvMat, dst: OpenCvMat) => void; delete: () => void };
  imread: (canvas: HTMLCanvasElement) => OpenCvMat;
  imshow: (canvas: HTMLCanvasElement, mat: OpenCvMat) => void;
  cvtColor: (src: OpenCvMat, dst: OpenCvMat, code: number) => void;
  GaussianBlur: (src: OpenCvMat, dst: OpenCvMat, ksize: unknown, sigma: number) => void;
  Canny: (src: OpenCvMat, dst: OpenCvMat, threshold1: number, threshold2: number) => void;
  findContours: (image: OpenCvMat, contours: OpenCvMatVector, hierarchy: OpenCvMat, mode: number, method: number) => void;
  contourArea: (contour: OpenCvMat, oriented?: boolean) => number;
  arcLength: (curve: OpenCvMat, closed: boolean) => number;
  approxPolyDP: (curve: OpenCvMat, approx: OpenCvMat, epsilon: number, closed: boolean) => void;
  matFromArray: (rows: number, cols: number, type: number, array: number[]) => OpenCvMat;
  getPerspectiveTransform: (src: OpenCvMat, dst: OpenCvMat) => OpenCvMat;
  warpPerspective: (src: OpenCvMat, dst: OpenCvMat, M: OpenCvMat, dsize: unknown, flags?: number, borderMode?: number) => void;
  split: (src: OpenCvMat, mv: OpenCvMatVector) => void;
  merge: (mv: OpenCvMatVector, dst: OpenCvMat) => void;
  filter2D: (src: OpenCvMat, dst: OpenCvMat, ddepth: number, kernel: OpenCvMat) => void;
  morphologyEx: (src: OpenCvMat, dst: OpenCvMat, op: number, kernel: OpenCvMat) => void;
  getStructuringElement: (shape: number, ksize: unknown) => OpenCvMat;
  dilate: (src: OpenCvMat, dst: OpenCvMat, kernel: OpenCvMat, anchor?: unknown, iterations?: number) => void;
  COLOR_RGBA2GRAY: number;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2Lab: number;
  COLOR_Lab2RGB: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
  CV_32FC1: number;
  CV_8U: number;
  INTER_LINEAR: number;
  BORDER_REPLICATE: number;
  MORPH_CLOSE: number;
  MORPH_RECT: number;
};

type OpenCvMat = { delete: () => void; rows: number; data32S: Int32Array };
type OpenCvMatVector = { size: () => number; get: (index: number) => OpenCvMat; set: (index: number, value: OpenCvMat) => void; delete: () => void };

export type { OpenCvMat, OpenCvMatVector };

export type OpenCvStatus = "idle" | "loading" | "ready" | "failed";

export type OpenCvLoadState = {
  status: OpenCvStatus;
  error: string | null;
  loadMs: number | null;
};

const LOCAL_OPENCV_PATH = "/vendor/opencv/opencv.js";
const CDN_OPENCV_URL = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";
const LOAD_TIMEOUT_MS = 25_000;
const SCRIPT_SELECTOR = "script[data-arca-opencv]";

let loadPromise: Promise<OpenCvNamespace> | null = null;
let cachedCv: OpenCvNamespace | null = null;
let loadState: OpenCvLoadState = { status: "idle", error: null, loadMs: null };
const listeners = new Set<(state: OpenCvLoadState) => void>();

function emitLoadState(next: OpenCvLoadState) {
  loadState = next;
  listeners.forEach((listener) => listener(next));
}

export function getOpenCvLoadState(): OpenCvLoadState {
  return loadState;
}

export function subscribeOpenCvLoad(listener: (state: OpenCvLoadState) => void) {
  listeners.add(listener);
  listener(loadState);
  return () => {
    listeners.delete(listener);
  };
}

function requiredApis(cv: OpenCvNamespace) {
  return ["Mat", "Canny", "findContours", "getPerspectiveTransform", "warpPerspective"] as const;
}

/** Runtime sanity check after WASM init — confirms core APIs work. */
export function verifyOpenCvRuntime(cv: OpenCvNamespace): void {
  for (const api of requiredApis(cv)) {
    if (typeof cv[api] !== "function" && api !== "Mat") {
      throw new Error(`OpenCV missing API: ${api}`);
    }
    if (api === "Mat" && typeof cv.Mat !== "function") {
      throw new Error("OpenCV missing API: Mat");
    }
  }

  const probe = document.createElement("canvas");
  probe.width = 8;
  probe.height = 8;
  const pctx = probe.getContext("2d");
  if (!pctx) throw new Error("OpenCV sanity check failed: canvas unavailable.");
  pctx.fillStyle = "#fff";
  pctx.fillRect(0, 0, 8, 8);
  pctx.strokeStyle = "#000";
  pctx.strokeRect(1, 1, 6, 6);

  let src: OpenCvMat | null = null;
  let blurred: OpenCvMat | null = null;
  let edges: OpenCvMat | null = null;
  let contours: OpenCvMatVector | null = null;
  let hierarchy: OpenCvMat | null = null;

  try {
    src = cv.imread(probe);
    blurred = new cv.Mat();
    edges = new cv.Mat();
    cv.GaussianBlur(src, blurred, new cv.Size(3, 3), 0);
    cv.Canny(blurred, edges, 50, 100);
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 1, 0, 1, 1, 0, 1]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 4, 0, 4, 4, 0, 4]);
    const transform = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, transform, new cv.Size(4, 4));
    srcTri.delete();
    dstTri.delete();
    transform.delete();
    warped.delete();
  } finally {
    src?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

function waitForCvRuntime(timeoutMs: number): Promise<OpenCvNamespace> {
  return new Promise((resolve, reject) => {
    const started = performance.now();

    function check() {
      if (window.cv?.Mat) {
        resolve(window.cv as OpenCvNamespace);
        return;
      }
      if (performance.now() - started > timeoutMs) {
        reject(new Error("OpenCV runtime initialization timed out."));
        return;
      }
      window.setTimeout(check, 40);
    }

    if (window.cv?.Mat) {
      resolve(window.cv as OpenCvNamespace);
      return;
    }

    const previous = window.cv?.onRuntimeInitialized;
    const cvRef = window.cv ?? ({} as NonNullable<Window["cv"]>);
    window.cv = cvRef;
    cvRef.onRuntimeInitialized = () => {
      previous?.();
      if (window.cv?.Mat) resolve(window.cv as OpenCvNamespace);
    };

    check();
  });
}

function injectScript(src: string, label: string): Promise<OpenCvNamespace> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
    if (existing && existing.src.endsWith(src.split("/").pop() ?? "")) {
      waitForCvRuntime(LOAD_TIMEOUT_MS).then(resolve).catch(reject);
      return;
    }

    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.arcaOpencv = "true";
    script.dataset.arcaOpencvSource = label;

    const timeoutId = window.setTimeout(() => {
      reject(new Error(`OpenCV load timed out (${label}).`));
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      waitForCvRuntime(LOAD_TIMEOUT_MS)
        .then((cv) => {
          window.clearTimeout(timeoutId);
          resolve(cv);
        })
        .catch((error) => {
          window.clearTimeout(timeoutId);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error(`OpenCV script failed to load (${label}).`));
    };

    document.head.appendChild(script);
  });
}

async function loadOpenCvInternal(): Promise<OpenCvNamespace> {
  if (cachedCv) return cachedCv;
  if (typeof window === "undefined") {
    throw new Error("OpenCV is only available in the browser.");
  }

  const started = performance.now();
  emitLoadState({ status: "loading", error: null, loadMs: null });

  let lastError = "OpenCV failed to load.";

  try {
    const cv = await injectScript(LOCAL_OPENCV_PATH, "local");
    verifyOpenCvRuntime(cv);
    cachedCv = cv;
    const loadMs = Math.round(performance.now() - started);
    emitLoadState({ status: "ready", error: null, loadMs });
    console.info(`[ARCA Scanner] OpenCV ready (local, ${loadMs}ms).`);
    return cv;
  } catch (localError) {
    lastError = localError instanceof Error ? localError.message : String(localError);
    console.warn("[ARCA Scanner] Local OpenCV load failed, trying CDN backup:", lastError);
  }

  try {
    const cv = await injectScript(CDN_OPENCV_URL, "cdn");
    verifyOpenCvRuntime(cv);
    cachedCv = cv;
    const loadMs = Math.round(performance.now() - started);
    emitLoadState({ status: "ready", error: null, loadMs });
    console.info(`[ARCA Scanner] OpenCV ready (CDN backup, ${loadMs}ms).`);
    return cv;
  } catch (cdnError) {
    const cdnMessage = cdnError instanceof Error ? cdnError.message : String(cdnError);
    const message = `OpenCV unavailable. Local: ${lastError} CDN: ${cdnMessage}`;
    const loadMs = Math.round(performance.now() - started);
    emitLoadState({ status: "failed", error: message, loadMs });
    console.error("[ARCA Scanner]", message);
    throw new Error(message);
  }
}

/** Start loading OpenCV immediately — safe to call multiple times. No-op when feature flag is off. */
export function preloadOpenCv(): void {
  if (typeof window === "undefined") return;
  if (!isOpenCvScannerEnabled()) return;
  if (cachedCv || loadState.status === "ready") return;
  if (!loadPromise) {
    loadPromise = loadOpenCvInternal().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
}

/** Returns OpenCV when ready; null when load failed or disabled. */
export async function loadOpenCv(): Promise<OpenCvNamespace | null> {
  if (typeof window === "undefined") return null;
  if (!isOpenCvScannerEnabled()) return null;
  if (cachedCv) return cachedCv;
  if (loadState.status === "failed") return null;

  if (!loadPromise) preloadOpenCv();
  try {
    return await loadPromise!;
  } catch {
    return null;
  }
}

export function opencvStatusLabel(status: OpenCvStatus): string | null {
  switch (status) {
    case "idle":
      return null;
    case "loading":
      return "Preparing edge detection…";
    case "ready":
      return "Edge detection ready";
    case "failed":
      return "Edge detection unavailable — manual crop fallback";
  }
}

export function resetOpenCvLoaderForTests() {
  loadPromise = null;
  cachedCv = null;
  loadState = { status: "idle", error: null, loadMs: null };
  document.querySelector(SCRIPT_SELECTOR)?.remove();
}
