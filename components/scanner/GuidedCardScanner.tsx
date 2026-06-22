"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import BoundaryOverlay from "@/components/scanner/BoundaryOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeSelector from "@/components/scanner/ScanTypeSelector";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { analyzeFrameFill, type FrameFillStatus } from "@/lib/image-processing/frameFillDetection";
import { fixedOverlayCropVideoFrame, fullFrameCapture, type VideoCropRect } from "@/lib/image-processing/perspectiveCorrection";

type ScannerPhase = "select" | "camera" | "preview";
type ScannerStatus =
  | "searching"
  | "aligning"
  | "detected"
  | "hold-steady"
  | "capturing"
  | "captured"
  | "fallback";

type CaptureSource = "guide-frame" | "fallback";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function isLikelyMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
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
  const guideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousGuideFrameRef = useRef<Uint8ClampedArray | null>(null);
  const greenSinceRef = useRef<number | null>(null);
  const lastCaptureAtRef = useRef(0);
  const captureFrameRef = useRef<() => void>(() => {});
  const capturingRef = useRef(false);
  const [phase, setPhase] = useState<ScannerPhase>("select");
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("searching");
  const [frameFillStatus, setFrameFillStatus] = useState<FrameFillStatus>({ isFilled: false, fillScore: 0, edgeScore: 0, contrastScore: 0, stabilityScore: 0, reason: "Fit card inside frame" });
  const [cropRect, setCropRect] = useState<VideoCropRect | null>(null);
  const [greenDurationMs, setGreenDurationMs] = useState(0);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [overlayCropSucceeded, setOverlayCropSucceeded] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(isLikelyMobile);
  const [lastCaptureSource, setLastCaptureSource] = useState<CaptureSource>("guide-frame");

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  useEffect(() => {
    captureFrameRef.current = () => {
      void captureFrame();
    };
  });

  function resetScanner() {
    setPhase("select");
    setScanType(null);
    setCameraError("");
    setScannerStatus("searching");
    setFrameFillStatus({ isFilled: false, fillScore: 0, edgeScore: 0, contrastScore: 0, stabilityScore: 0, reason: "Fit card inside frame" });
    setCropRect(null);
    setGreenDurationMs(0);
    greenSinceRef.current = null;
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
    guideCanvasRef.current ||= document.createElement("canvas");
    const interval = window.setInterval(() => {
      if (capturingRef.current || !videoRef.current || !guideCanvasRef.current || !overlayRef.current) return;
      const videoReady = videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Boolean(videoRef.current.videoWidth && videoRef.current.videoHeight);
      if (!videoReady) {
        setScannerStatus("searching");
        setFrameFillStatus((current) => ({ ...current, isFilled: false, reason: "Camera is warming up" }));
        setCropRect(null);
        return;
      }
      const frameFill = analyzeFrameFill({
        video: videoRef.current,
        overlay: overlayRef.current,
        canvas: guideCanvasRef.current,
        previous: previousGuideFrameRef.current,
        scanType,
      });
      previousGuideFrameRef.current = frameFill.sample;
      setCropRect(frameFill.cropRect);
      setFrameFillStatus(frameFill.status);
      const green = frameFill.status.isFilled && frameFill.status.stabilityScore >= 0.55;
      greenSinceRef.current = green ? (greenSinceRef.current ?? performance.now()) : null;
      const greenDuration = greenSinceRef.current ? performance.now() - greenSinceRef.current : 0;
      setGreenDurationMs(greenDuration);
      const status: ScannerStatus = green ? "hold-steady" : frameFill.status.fillScore > 0.42 || frameFill.status.edgeScore > 0.18 ? "detected" : videoReady ? "aligning" : "searching";
      setScannerStatus(status);
      const cooldownPassed = performance.now() - lastCaptureAtRef.current > 1800;
      if (autoCapture && green && greenDuration >= 1500 && cooldownPassed) {
        lastCaptureAtRef.current = performance.now();
        captureFrameRef.current();
      }
    }, 220);
    return () => {
      window.clearInterval(interval);
      greenSinceRef.current = null;
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
    setScannerStatus("searching");
    greenSinceRef.current = null;
    previousGuideFrameRef.current = null;
    setGreenDurationMs(0);
    setPhase("camera");
  }

  async function captureFrame() {
    if (!videoRef.current || !overlayRef.current || !scanType || capturing) return;
    setCapturing(true);
    setScannerStatus("capturing");
    try {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const capture = await fixedOverlayCropVideoFrame(video, overlay, scanType);
      const url = URL.createObjectURL(capture.file);
      setCapturedFile(capture.file);
      setLastCaptureSource("guide-frame");
      setOverlayCropSucceeded(true);
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
    setScannerStatus("searching");
    greenSinceRef.current = null;
    previousGuideFrameRef.current = null;
    setGreenDurationMs(0);
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

  const defaultGuideMessage = scanType ? scanTypeConfig[scanType].guidance : "Place card inside frame";
  const countdownReady = autoCapture && scannerStatus === "hold-steady" && greenDurationMs >= 1200;
  const detectionState = capturing || countdownReady ? "capturing" : scannerStatus === "hold-steady" ? "aligned" : scannerStatus === "detected" ? "detected" : "searching";
  const detectionMessage = capturing ? "Capturing..." : countdownReady ? "Capturing..." : scannerStatus === "hold-steady" ? "Hold steady" : scannerStatus === "detected" ? frameFillStatus.reason : defaultGuideMessage;
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
      <BoundaryOverlay type={scanType} overlayRef={overlayRef} state={detectionState} message={detectionMessage} />
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
          <input type="checkbox" className="accent-[var(--gold-primary)]" checked={autoCapture} onChange={(event) => { setAutoCapture(event.target.checked); greenSinceRef.current = null; setGreenDurationMs(0); }} />
          Auto capture
        </label>
      </div>
      {showDebug && <div className="absolute right-4 top-24 max-w-[12rem] rounded-xl border border-white/15 bg-black/70 p-3 text-[10px] leading-4 text-white/80 backdrop-blur">
        <p>status: {scannerStatus}</p>
        <p>video: {cropRect ? `${cropRect.videoWidth}x${cropRect.videoHeight}` : "pending"}</p>
        <p>client: {cropRect ? `${Math.round(cropRect.clientWidth)}x${Math.round(cropRect.clientHeight)}` : "pending"}</p>
        <p>crop: {cropRect ? `${Math.round(cropRect.sx)},${Math.round(cropRect.sy)},${Math.round(cropRect.sw)},${Math.round(cropRect.sh)}` : "pending"}</p>
        <p>filled: {frameFillStatus.isFilled ? "yes" : "no"}</p>
        <p>fill: {frameFillStatus.fillScore.toFixed(2)}</p>
        <p>contrast: {frameFillStatus.contrastScore.toFixed(2)}</p>
        <p>stability: {frameFillStatus.stabilityScore.toFixed(2)}</p>
        <p>green: {Math.round(greenDurationMs)}ms</p>
        <p>auto: {autoCapture ? "on" : "off"}</p>
        <p>capture: {lastCaptureSource}</p>
        <p>edge: {frameFillStatus.edgeScore.toFixed(2)}</p>
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
