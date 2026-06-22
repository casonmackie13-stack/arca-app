"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import BoundaryOverlay from "@/components/scanner/BoundaryOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeSelector from "@/components/scanner/ScanTypeSelector";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { detectLiveBoundary, type BoundaryDetectionResult, type DetectedBoundary } from "@/lib/image-processing/liveBoundaryDetection";
import { fixedOverlayCropVideoFrame, fullFrameCapture, perspectiveCorrectVideoFrame } from "@/lib/image-processing/perspectiveCorrection";

type ScannerPhase = "select" | "camera" | "preview";
type ScannerStatus =
  | "searching"
  | "aligning"
  | "detected"
  | "hold-steady"
  | "capturing"
  | "captured"
  | "fallback";

type GuideStability = {
  hasObject: boolean;
  isStable: boolean;
  stableMs: number;
  motionScore: number;
  edgeScore: number;
  contrastScore: number;
  message: string;
};

type CaptureSource = "perspective" | "guide-crop" | "fallback";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function isLikelyMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

function mapOverlayToVideo(video: HTMLVideoElement, overlay: HTMLElement) {
  const videoRect = video.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight || !videoRect.width || !videoRect.height) return null;
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;
  const sourceX = (overlayRect.left - videoRect.left - offsetX) / scale;
  const sourceY = (overlayRect.top - videoRect.top - offsetY) / scale;
  const sourceWidth = overlayRect.width / scale;
  const sourceHeight = overlayRect.height / scale;
  const sx = Math.max(0, Math.min(videoWidth, sourceX));
  const sy = Math.max(0, Math.min(videoHeight, sourceY));
  const sw = Math.max(1, Math.min(videoWidth - sx, sourceWidth));
  const sh = Math.max(1, Math.min(videoHeight - sy, sourceHeight));
  return { sx, sy, sw, sh };
}

function analyzeGuideFrame({
  video,
  overlay,
  canvas,
  previous,
  stableSince,
  now,
}: {
  video: HTMLVideoElement;
  overlay: HTMLElement;
  canvas: HTMLCanvasElement;
  previous: Uint8ClampedArray | null;
  stableSince: number | null;
  now: number;
}) {
  const region = mapOverlayToVideo(video, overlay);
  if (!region) return { result: { hasObject: false, isStable: false, stableMs: 0, motionScore: 1, edgeScore: 0, contrastScore: 0, message: "Camera is warming up" } satisfies GuideStability, sample: previous, stableSince: null };
  canvas.width = 48;
  canvas.height = 68;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { result: { hasObject: false, isStable: false, stableMs: 0, motionScore: 1, edgeScore: 0, contrastScore: 0, message: "Scanner unavailable" } satisfies GuideStability, sample: previous, stableSince: null };
  context.drawImage(video, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const sample = new Uint8ClampedArray(canvas.width * canvas.height);
  let sum = 0;
  for (let index = 0; index < sample.length; index++) {
    const offset = index * 4;
    const gray = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    sample[index] = gray;
    sum += gray;
  }
  const mean = sum / sample.length;
  let variance = 0;
  let edgeTotal = 0;
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const value = sample[y * canvas.width + x];
      variance += (value - mean) ** 2;
      const gx = Math.abs(sample[y * canvas.width + x + 1] - sample[y * canvas.width + x - 1]);
      const gy = Math.abs(sample[(y + 1) * canvas.width + x] - sample[(y - 1) * canvas.width + x]);
      edgeTotal += gx + gy;
    }
  }
  const contrastScore = Math.min(1, Math.sqrt(variance / sample.length) / 54);
  const edgeScore = Math.min(1, edgeTotal / (sample.length * 34));
  let motionScore = 1;
  if (previous && previous.length === sample.length) {
    let diff = 0;
    for (let index = 0; index < sample.length; index++) diff += Math.abs(sample[index] - previous[index]);
    motionScore = diff / (sample.length * 255);
  }
  const hasObject = edgeScore > 0.12 || contrastScore > 0.18;
  const lowMotion = motionScore < 0.018;
  const nextStableSince = hasObject && lowMotion ? (stableSince ?? now) : null;
  const stableMs = nextStableSince ? now - nextStableSince : 0;
  const isStable = hasObject && stableMs >= 1000;
  const message = !hasObject ? "Place card inside frame" : !lowMotion ? "Hold steady" : stableMs >= 650 ? "Capturing in 1..." : "Hold steady";
  return { result: { hasObject, isStable, stableMs, motionScore, edgeScore, contrastScore, message }, sample, stableSince: nextStableSince };
}

export default function GuidedCardScanner({
  open,
  side,
  onClose,
  onCapture,
  onFileFallback,
}: {
  open: boolean;
  side: "front" | "back";
  onClose: () => void;
  onCapture: (file: File, scanType: ScanType, overlayCropSucceeded: boolean) => void;
  onFileFallback: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const guideStableSinceRef = useRef<number | null>(null);
  const previousGuideFrameRef = useRef<Uint8ClampedArray | null>(null);
  const captureFrameRef = useRef<(boundary?: DetectedBoundary | null) => void>(() => {});
  const capturingRef = useRef(false);
  const [phase, setPhase] = useState<ScannerPhase>("select");
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [detection, setDetection] = useState<BoundaryDetectionResult>({ boundary: null, state: "searching", message: "Align card inside frame" });
  const [displayBoundary, setDisplayBoundary] = useState<DetectedBoundary | null>(null);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("searching");
  const [guideStability, setGuideStability] = useState<GuideStability>({ hasObject: false, isStable: false, stableMs: 0, motionScore: 1, edgeScore: 0, contrastScore: 0, message: "Place card inside frame" });
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [overlayCropSucceeded, setOverlayCropSucceeded] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(isLikelyMobile);
  const [lastCaptureSource, setLastCaptureSource] = useState<CaptureSource>("guide-crop");

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  useEffect(() => {
    captureFrameRef.current = (boundary?: DetectedBoundary | null) => {
      void captureFrame(boundary);
    };
  });

  function resetScanner() {
    setPhase("select");
    setScanType(null);
    setCameraError("");
    setDetection({ boundary: null, state: "searching", message: "Align card inside frame" });
    setDisplayBoundary(null);
    setScannerStatus("searching");
    setGuideStability({ hasObject: false, isStable: false, stableMs: 0, motionScore: 1, edgeScore: 0, contrastScore: 0, message: "Place card inside frame" });
    stableSinceRef.current = null;
    guideStableSinceRef.current = null;
    previousGuideFrameRef.current = null;
    setCapturedFile(null);
    setOverlayCropSucceeded(true);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  useEffect(() => () => {
    stopStream(streamRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open || phase !== "camera" || !scanType) return;
    let active = true;
    async function startCamera() {
      setCameraError("");
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available on this device.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { stopStream(stream); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied. You can still choose a photo from your library."
          : cause instanceof Error ? cause.message : "Camera is unavailable. You can still choose a photo from your library.";
        setCameraError(message);
      }
    }
    void startCamera();
    return () => {
      active = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, phase, scanType]);

  useEffect(() => {
    if (!open || phase !== "camera" || !scanType) return;
    analysisCanvasRef.current ||= document.createElement("canvas");
    guideCanvasRef.current ||= document.createElement("canvas");
    const interval = window.setInterval(() => {
      if (capturingRef.current || !videoRef.current || !analysisCanvasRef.current || !guideCanvasRef.current || !overlayRef.current) return;
      const videoReady = videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Boolean(videoRef.current.videoWidth && videoRef.current.videoHeight);
      if (!videoReady) {
        setScannerStatus("searching");
        setDetection({ boundary: null, state: "searching", message: "Camera is warming up" });
        setDisplayBoundary(null);
        return;
      }
      const result = detectLiveBoundary(videoRef.current, analysisCanvasRef.current, scanType);
      const guide = analyzeGuideFrame({
        video: videoRef.current,
        overlay: overlayRef.current,
        canvas: guideCanvasRef.current,
        previous: previousGuideFrameRef.current,
        stableSince: guideStableSinceRef.current,
        now: performance.now(),
      });
      previousGuideFrameRef.current = guide.sample;
      guideStableSinceRef.current = guide.stableSince;
      setDetection(result);
      setDisplayBoundary(boundaryForDisplay(result.boundary));
      setGuideStability(guide.result);
      const liveAligned = Boolean(result.boundary && result.state === "aligned" && result.boundary.confidence >= 0.58);
      const guideAligned = guide.result.isStable;
      const status: ScannerStatus = result.state === "failed" ? "fallback" : liveAligned || guide.result.stableMs >= 650 ? "hold-steady" : result.boundary ? "detected" : guide.result.hasObject ? "aligning" : "searching";
      setScannerStatus(status);
      if (autoCapture && guideAligned) {
        stableSinceRef.current = null;
        captureFrameRef.current(liveAligned ? result.boundary : null);
        return;
      }
      if (!autoCapture || !liveAligned) {
        stableSinceRef.current = null;
        return;
      }
      stableSinceRef.current ||= performance.now();
      if (performance.now() - stableSinceRef.current >= 1000) {
        stableSinceRef.current = null;
        captureFrameRef.current(result.boundary);
      }
    }, 220);
    return () => {
      window.clearInterval(interval);
      stableSinceRef.current = null;
    };
  }, [open, phase, scanType, autoCapture]);

  if (!open) return null;

  function closeScanner() {
    stopStream(streamRef.current);
    streamRef.current = null;
    resetScanner();
    onClose();
  }

  function selectType(type: ScanType) {
    setScanType(type);
    setDetection({ boundary: null, state: "searching", message: "Align card inside frame" });
    setDisplayBoundary(null);
    setScannerStatus("searching");
    guideStableSinceRef.current = null;
    previousGuideFrameRef.current = null;
    setPhase("camera");
  }

  function boundaryForDisplay(boundary: DetectedBoundary | null) {
    const video = videoRef.current;
    if (!video || !boundary || !video.videoWidth || !video.videoHeight || !video.clientWidth || !video.clientHeight) return boundary;
    const scale = Math.max(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const offsetX = (video.clientWidth - renderedWidth) / 2;
    const offsetY = (video.clientHeight - renderedHeight) / 2;
    return {
      ...boundary,
      corners: boundary.corners.map((point) => ({
        x: (point.x * video.videoWidth * scale + offsetX) / video.clientWidth,
        y: (point.y * video.videoHeight * scale + offsetY) / video.clientHeight,
      })) as [DetectedBoundary["corners"][number], DetectedBoundary["corners"][number], DetectedBoundary["corners"][number], DetectedBoundary["corners"][number]],
    };
  }

  async function captureFrame(boundaryOverride?: DetectedBoundary | null) {
    if (!videoRef.current || !overlayRef.current || !scanType || capturing) return;
    setCapturing(true);
    setScannerStatus("capturing");
    setDetection((current) => ({ ...current, state: "capturing", message: "Capturing..." }));
    try {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const boundary = boundaryOverride || detection.boundary;
      const capture = boundary && boundary.confidence >= 0.64
        ? await perspectiveCorrectVideoFrame(video, boundary.corners, scanType).catch(() => fixedOverlayCropVideoFrame(video, overlay, scanType))
        : await fixedOverlayCropVideoFrame(video, overlay, scanType);
      const url = URL.createObjectURL(capture.file);
      setCapturedFile(capture.file);
      setLastCaptureSource(capture.method === "perspective-correction" ? "perspective" : "guide-crop");
      setOverlayCropSucceeded(capture.method !== "full-frame-fallback");
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      stopStream(streamRef.current);
      streamRef.current = null;
      setScannerStatus("captured");
      setPhase("preview");
    } catch (cause) {
      try {
        const video = videoRef.current;
        if (!video || !scanType) throw cause;
        const capture = await fullFrameCapture(video, scanType);
        const url = URL.createObjectURL(capture.file);
        setCapturedFile(capture.file);
        setLastCaptureSource("fallback");
        setOverlayCropSucceeded(false);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
        stopStream(streamRef.current);
        streamRef.current = null;
        setScannerStatus("captured");
        setPhase("preview");
      } catch {
        setScannerStatus("fallback");
        setCameraError(cause instanceof Error ? `${cause.message} Try again or choose a photo from your library.` : "Capture failed. Try again or choose a photo from your library.");
      }
    } finally {
      setCapturing(false);
    }
  }

  function retake() {
    setCapturedFile(null);
    setOverlayCropSucceeded(true);
    setDetection({ boundary: null, state: "searching", message: "Align card inside frame" });
    setDisplayBoundary(null);
    setScannerStatus("searching");
    guideStableSinceRef.current = null;
    previousGuideFrameRef.current = null;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhase("camera");
  }

  function useCapture() {
    if (!capturedFile || !scanType) return;
    onCapture(capturedFile, scanType, overlayCropSucceeded);
    closeScanner();
  }

  const detectionState = capturing ? "capturing" : detection.state;
  const defaultGuideMessage = scanType ? scanTypeConfig[scanType].guidance : "Place card inside frame";
  const detectionMessage = capturing ? "Capturing..." : scannerStatus === "hold-steady" ? guideStability.message : detection.boundary ? detection.message : guideStability.hasObject ? guideStability.message : defaultGuideMessage;
  const showDebug = process.env.NODE_ENV === "development";

  return <div className="fixed inset-0 z-50 bg-[var(--background)] text-[var(--text-primary)]">
    {phase === "select" && <div className="flex min-h-[100svh] flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="text-sm font-semibold capitalize text-[var(--text-secondary)]">Scan {side}</span>
        <button type="button" onClick={closeScanner} className="min-h-11 rounded-full px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Close</button>
      </div>
      <div className="flex flex-1 items-center px-5 py-6">
        <div className="mx-auto w-full max-w-md"><ScanTypeSelector onSelect={selectType} /></div>
      </div>
    </div>}

    {phase === "camera" && scanType && <div className="relative min-h-[100svh] overflow-hidden bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <BoundaryOverlay type={scanType} overlayRef={overlayRef} detectedBoundary={displayBoundary} state={detectionState} message={detectionMessage} />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => { stopStream(streamRef.current); streamRef.current = null; setPhase("select"); }} className="min-h-11 rounded-full bg-black/45 px-4 text-sm font-semibold text-white backdrop-blur">Back</button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Scan {side}</p>
          <p className="mt-1 text-sm font-semibold">{scanTypeConfig[scanType].title}</p>
        </div>
        <button type="button" onClick={closeScanner} className="min-h-11 rounded-full bg-black/45 px-4 text-sm font-semibold text-white backdrop-blur">Close</button>
      </div>
      <div className="absolute left-4 top-24 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-[var(--gold-primary)]" checked={autoCapture} onChange={(event) => setAutoCapture(event.target.checked)} />
          Auto capture
        </label>
      </div>
      {showDebug && <div className="absolute right-4 top-24 max-w-[12rem] rounded-xl border border-white/15 bg-black/70 p-3 text-[10px] leading-4 text-white/80 backdrop-blur">
        <p>status: {scannerStatus}</p>
        <p>confidence: {Math.round((detection.boundary?.confidence || 0) * 100)}%</p>
        <p>stable: {Math.round(guideStability.stableMs)}ms</p>
        <p>auto: {autoCapture ? "on" : "off"}</p>
        <p>capture: {lastCaptureSource}</p>
        <p>motion: {guideStability.motionScore.toFixed(3)}</p>
        <p>edge: {guideStability.edgeScore.toFixed(2)}</p>
      </div>}
      {cameraError && <div className="absolute inset-x-4 top-24 rounded-xl border border-[var(--status-warning)] bg-black/80 p-4 text-sm leading-6 text-white shadow-xl backdrop-blur">
        <p>{cameraError}</p>
        <div className="mt-4"><ImageUpload label="Choose photo instead" onChange={(file) => { onFileFallback(file); closeScanner(); }} aspect="card" allowRemove={false} /></div>
      </div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={capturing || Boolean(cameraError)} onClick={() => { void captureFrame(); }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_8px_rgba(255,255,255,.16)] backdrop-blur disabled:opacity-50" aria-label="Capture image">
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
        <div className="mt-4 text-center text-xs text-white/65">Tap capture if auto-scan does not start.</div>
      </div>
    </div>}

    {phase === "preview" && scanType && previewUrl && <ScanPreview previewUrl={previewUrl} scanType={scanType} onRetake={retake} onUse={useCapture} />}
  </div>;
}
