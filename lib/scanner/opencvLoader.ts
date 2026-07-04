"use client";

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
};

type OpenCvMat = { delete: () => void; rows: number; data32S: Int32Array };
type OpenCvMatVector = { size: () => number; get: (index: number) => OpenCvMat; set: (index: number, value: OpenCvMat) => void; delete: () => void };

export type { OpenCvMat, OpenCvMatVector };

const OPENCV_CDN = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0/dist/opencv.js";

let loadPromise: Promise<OpenCvNamespace | null> | null = null;

function injectOpenCvScript() {
  return new Promise<OpenCvNamespace>((resolve, reject) => {
    if (window.cv?.Mat) {
      resolve(window.cv as OpenCvNamespace);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-arca-opencv]");
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.cv?.Mat) resolve(window.cv as OpenCvNamespace);
        else window.cv!.onRuntimeInitialized = () => resolve(window.cv as OpenCvNamespace);
      });
      existing.addEventListener("error", () => reject(new Error("OpenCV failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;
    script.dataset.arcaOpencv = "true";
    script.onload = () => {
      if (window.cv?.Mat) {
        resolve(window.cv as OpenCvNamespace);
        return;
      }
      window.cv!.onRuntimeInitialized = () => resolve(window.cv as OpenCvNamespace);
    };
    script.onerror = () => reject(new Error("OpenCV failed to load."));
    document.head.appendChild(script);
  });
}

/** Lazy-load OpenCV.js from CDN on the client. Returns null if WASM fails to initialize. */
export async function loadOpenCv(): Promise<OpenCvNamespace | null> {
  if (typeof window === "undefined") return null;
  if (loadPromise) return loadPromise;
  loadPromise = injectOpenCvScript().catch(() => null);
  return loadPromise;
}

export function resetOpenCvLoaderForTests() {
  loadPromise = null;
}
