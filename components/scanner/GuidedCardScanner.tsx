"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import LiveEdgeOverlay from "@/components/scanner/LiveEdgeOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanQualityHints from "@/components/scanner/ScanQualityHints";
import ScanTypeSelector from "@/components/scanner/ScanTypeSelector";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { processGuidedCapture, redetectForCapture } from "@/lib/scanner/captureProcessor";
import { mapCornersToDisplay, type VideoDisplayMetrics } from "@/lib/scanner/displayMapping";
import { terminateOcrWorker } from "@/lib/scanner/ocr";
import type { GuidedCaptureResult } from "@/lib/scanner/scanMetadata";
import { useLiveDetection } from "@/lib/scanner/useLiveDetection";

type ScannerPhase = "select" | "camera" | "preview";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
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
  onCapture: (result: GuidedCaptureResult) => void;
  onFileFallback: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCapturedRef = useRef(false);
  const runCaptureRef = useRef<() => Promise<GuidedCaptureResult | null>>(async () => null);
  const [phase, setPhase] = useState<ScannerPhase>("select");
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [capturedResult, setCapturedResult] = useState<GuidedCaptureResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [videoMetrics, setVideoMetrics] = useState<VideoDisplayMetrics | null>(null);

  const liveActive = open && phase === "camera" && Boolean(scanType) && !cameraError;
  const { detection, scanState, stableMs, readyForAutoCapture } = useLiveDetection(videoRef, scanType, liveActive);
  const detectionRef = useRef(detection);

  useEffect(() => {
    detectionRef.current = detection;
  }, [detection]);

  useEffect(() => {
    if (!liveActive) return;
    const video = videoRef.current;
    if (!video) return;

    function updateMetrics() {
      const current = videoRef.current;
      if (!current?.videoWidth || !current.videoHeight) return;
      const rect = current.getBoundingClientRect();
      setVideoMetrics({
        videoWidth: current.videoWidth,
        videoHeight: current.videoHeight,
        displayWidth: rect.width,
        displayHeight: rect.height,
      });
    }

    video.addEventListener("loadedmetadata", updateMetrics);
    const interval = window.setInterval(updateMetrics, 120);
    updateMetrics();
    return () => {
      video.removeEventListener("loadedmetadata", updateMetrics);
      window.clearInterval(interval);
    };
  }, [liveActive, scanType]);

  const displayCorners = useMemo(() => {
    if (!liveActive || !detection?.corners || detection.corners.length !== 4 || !videoMetrics) return null;
    return mapCornersToDisplay(detection.corners, videoMetrics);
  }, [detection, liveActive, videoMetrics]);

  function resetScanner() {
    setPhase("select");
    setScanType(null);
    setCameraError("");
    setCapturedResult(null);
    autoCapturedRef.current = false;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  useEffect(() => () => {
    stopStream(streamRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    void terminateOcrWorker();
  }, [previewUrl]);

  useEffect(() => {
    if (!open || phase !== "camera" || !scanType) return;
    let active = true;
    autoCapturedRef.current = false;

    async function startCamera() {
      setCameraError("");
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available on this device.");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!active) { stopStream(stream); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await new Promise<void>((resolve, reject) => {
            const onReady = () => { video.removeEventListener("loadedmetadata", onReady); resolve(); };
            const onError = () => { video.removeEventListener("error", onError); reject(new Error("Camera failed to start.")); };
            video.addEventListener("loadedmetadata", onReady);
            video.addEventListener("error", onError);
            void video.play().catch(reject);
          });
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

  async function runCapture() {
    if (!videoRef.current || !scanType || capturing) return null;
    setCapturing(true);
    try {
      const freshDetection = await redetectForCapture(videoRef.current, scanType, detectionRef.current?.corners);
      const result = await processGuidedCapture({
        video: videoRef.current,
        overlayElement: overlayRef.current,
        scanType,
        liveDetection: freshDetection,
      });
      const url = URL.createObjectURL(result.file);
      setCapturedResult(result);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      stopStream(streamRef.current);
      streamRef.current = null;
      setPhase("preview");
      return result;
    } catch (cause) {
      setCameraError(cause instanceof Error ? `${cause.message} Try again or choose a photo from your library.` : "Capture failed. Try again or choose a photo from your library.");
      return null;
    } finally {
      setCapturing(false);
    }
  }

  useEffect(() => {
    runCaptureRef.current = runCapture;
  });

  useEffect(() => {
    if (!autoCaptureEnabled || !liveActive || capturing || autoCapturedRef.current) return;
    if (!readyForAutoCapture) return;
    autoCapturedRef.current = true;
    void runCaptureRef.current();
  }, [autoCaptureEnabled, capturing, liveActive, readyForAutoCapture]);

  if (!open) return null;

  function closeScanner() {
    stopStream(streamRef.current);
    streamRef.current = null;
    resetScanner();
    onClose();
  }

  function selectType(type: ScanType) {
    setScanType(type);
    setPhase("camera");
  }

  function retake() {
    setCapturedResult(null);
    autoCapturedRef.current = false;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhase("camera");
  }

  function useCapture() {
    if (!capturedResult) return;
    onCapture(capturedResult);
    closeScanner();
  }

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
      <LiveEdgeOverlay type={scanType} overlayRef={overlayRef} displayCorners={displayCorners} />
      <ScanQualityHints
        state={scanState}
        autoCaptureEnabled={autoCaptureEnabled}
        stableMs={stableMs}
        confidence={detection?.confidence ?? 0}
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => { stopStream(streamRef.current); streamRef.current = null; autoCapturedRef.current = false; setPhase("select"); }} className="min-h-11 rounded-full bg-black/45 px-4 text-sm font-semibold text-white backdrop-blur">Back</button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Scan {side}</p>
          <p className="mt-1 text-sm font-semibold">{scanTypeConfig[scanType].title}</p>
        </div>
        <button type="button" onClick={closeScanner} className="min-h-11 rounded-full bg-black/45 px-4 text-sm font-semibold text-white backdrop-blur">Close</button>
      </div>
      <div className="absolute right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))]">
        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
          <input
            type="checkbox"
            checked={autoCaptureEnabled}
            onChange={(event) => {
              autoCapturedRef.current = false;
              setAutoCaptureEnabled(event.target.checked);
            }}
            className="h-4 w-4 accent-[var(--gold-primary)]"
          />
          Auto capture
        </label>
      </div>
      {cameraError && <div className="absolute inset-x-4 top-24 rounded-xl border border-[var(--status-warning)] bg-black/80 p-4 text-sm leading-6 text-white shadow-xl backdrop-blur">
        <p>{cameraError}</p>
        <div className="mt-4"><ImageUpload label="Choose photo instead" onChange={(file) => { onFileFallback(file); closeScanner(); }} aspect="card" allowRemove={false} /></div>
      </div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={capturing || Boolean(cameraError)} onClick={() => { void runCapture(); }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_8px_rgba(255,255,255,.16)] backdrop-blur disabled:opacity-50" aria-label="Capture image">
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
        <div className="mt-4 text-center text-xs text-white/65">{autoCaptureEnabled ? "Hold steady for auto capture, or tap to capture now." : "Line up the edges, then tap capture."}</div>
      </div>
    </div>}

    {phase === "preview" && scanType && previewUrl && capturedResult && <ScanPreview previewUrl={previewUrl} scanType={scanType} onRetake={retake} onUse={useCapture} />}
  </div>;
}
