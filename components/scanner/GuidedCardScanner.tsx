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
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const [phase, setPhase] = useState<ScannerPhase>("select");
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [detection, setDetection] = useState<BoundaryDetectionResult>({ boundary: null, state: "searching", message: "Align card inside frame" });
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [overlayCropSucceeded, setOverlayCropSucceeded] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(isLikelyMobile);

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  function resetScanner() {
    setPhase("select");
    setScanType(null);
    setCameraError("");
    setDetection({ boundary: null, state: "searching", message: "Align card inside frame" });
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
    const interval = window.setInterval(() => {
      if (capturingRef.current || !videoRef.current || !analysisCanvasRef.current) return;
      const result = detectLiveBoundary(videoRef.current, analysisCanvasRef.current, scanType);
      setDetection(result);
      const readyForAutoCapture = autoCapture && result.boundary && result.state === "aligned" && result.boundary.confidence >= 0.76;
      if (!readyForAutoCapture) {
        stableSinceRef.current = null;
        return;
      }
      stableSinceRef.current ||= performance.now();
      if (performance.now() - stableSinceRef.current >= 1000) {
        stableSinceRef.current = null;
        void captureFrame(result.boundary);
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
      setOverlayCropSucceeded(capture.method !== "full-frame-fallback");
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      stopStream(streamRef.current);
      streamRef.current = null;
      setPhase("preview");
    } catch (cause) {
      try {
        const video = videoRef.current;
        if (!video || !scanType) throw cause;
        const capture = await fullFrameCapture(video, scanType);
        const url = URL.createObjectURL(capture.file);
        setCapturedFile(capture.file);
        setOverlayCropSucceeded(false);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
        stopStream(streamRef.current);
        streamRef.current = null;
        setPhase("preview");
      } catch {
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

  const displayBoundary = boundaryForDisplay(detection.boundary);
  const detectionState = capturing ? "capturing" : detection.state;
  const detectionMessage = capturing ? "Capturing..." : detection.message;

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
      {cameraError && <div className="absolute inset-x-4 top-24 rounded-xl border border-[var(--status-warning)] bg-black/80 p-4 text-sm leading-6 text-white shadow-xl backdrop-blur">
        <p>{cameraError}</p>
        <div className="mt-4"><ImageUpload label="Choose photo instead" onChange={(file) => { onFileFallback(file); closeScanner(); }} aspect="card" allowRemove={false} /></div>
      </div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={capturing || Boolean(cameraError)} onClick={() => { void captureFrame(); }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_8px_rgba(255,255,255,.16)] backdrop-blur disabled:opacity-50" aria-label="Capture image">
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
        <div className="mt-4 text-center text-xs text-white/65">Line up the edges, then tap capture.</div>
      </div>
    </div>}

    {phase === "preview" && scanType && previewUrl && <ScanPreview previewUrl={previewUrl} scanType={scanType} onRetake={retake} onUse={useCapture} />}
  </div>;
}
