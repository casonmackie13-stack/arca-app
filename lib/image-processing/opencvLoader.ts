type CvMat = { rows: number; data32S: Int32Array; delete: () => void };
type CvMatVector = { size: () => number; get: (index: number) => CvMat; delete: () => void };
type CvSize = { width: number; height: number };
type CvScalar = unknown;

export type OpenCvRuntime = {
  Mat: new () => CvMat;
  MatVector: new () => CvMatVector;
  Size: new (width: number, height: number) => CvSize;
  Scalar: new (...values: number[]) => CvScalar;
  imread: (source: HTMLCanvasElement) => CvMat;
  imshow: (target: HTMLCanvasElement, source: CvMat) => void;
  matFromArray: (rows: number, cols: number, type: number, data: number[]) => CvMat;
  cvtColor: (source: CvMat, destination: CvMat, code: number) => void;
  GaussianBlur: (source: CvMat, destination: CvMat, size: CvSize, sigmaX: number) => void;
  Canny: (source: CvMat, destination: CvMat, threshold1: number, threshold2: number) => void;
  findContours: (source: CvMat, contours: CvMatVector, hierarchy: CvMat, mode: number, method: number) => void;
  arcLength: (curve: CvMat, closed: boolean) => number;
  approxPolyDP: (curve: CvMat, approxCurve: CvMat, epsilon: number, closed: boolean) => void;
  contourArea: (contour: CvMat) => number;
  getPerspectiveTransform: (source: CvMat, destination: CvMat) => CvMat;
  warpPerspective: (source: CvMat, destination: CvMat, transform: CvMat, size: CvSize, flags: number, borderMode: number, borderValue: CvScalar) => void;
  COLOR_RGBA2GRAY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  onRuntimeInitialized?: () => void;
};

declare global {
  interface Window {
    cv?: OpenCvRuntime;
  }
}

let openCvPromise: Promise<OpenCvRuntime> | null = null;
const opencvScriptUrl = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js";

function waitForRuntime(cv: OpenCvRuntime) {
  return new Promise<OpenCvRuntime>((resolve) => {
    if (typeof cv.Mat === "function") {
      resolve(cv);
      return;
    }
    const previous = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => {
      previous?.();
      resolve(cv);
    };
  });
}

export function loadOpenCv() {
  if (typeof window === "undefined") return Promise.reject(new Error("OpenCV only loads in the browser."));
  if (window.cv) return waitForRuntime(window.cv);
  openCvPromise ||= new Promise<OpenCvRuntime>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-arca-opencv="true"]`);
    const script = existing || document.createElement("script");
    script.dataset.arcaOpencv = "true";
    script.async = true;
    script.src = opencvScriptUrl;
    script.onload = () => {
      if (!window.cv) {
        reject(new Error("OpenCV did not initialize."));
        return;
      }
      void waitForRuntime(window.cv).then(resolve);
    };
    script.onerror = () => reject(new Error("OpenCV failed to load."));
    if (!existing) document.head.appendChild(script);
  });
  return openCvPromise;
}
