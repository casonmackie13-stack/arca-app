"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LiveEdgeOverlay from "@/components/scanner/LiveEdgeOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { processGuidedCapture, redetectForCapture } from "@/lib/scanner/captureProcessor";
import { mapCornersToDisplay, type VideoDisplayMetrics } from "@/lib/scanner/displayMapping";
import { terminateOcrWorker } from "@/lib/scanner/ocr";
import { resolveScannerMessage } from "@/lib/scanner/scannerMessages";
import type { GuidedCaptureResult, ScanDetectionResult, ScanRecognitionPreview } from "@/lib/scanner/scanMetadata";
import { useLiveDetection } from "@/lib/scanner/useLiveDetection";

type ScannerPhase = "camera" | "preview";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCapturedRef = useRef(false);
  const runCaptureRef = useRef<(mode: "auto" | "manual") => Promise<GuidedCaptureResult | null>>(async () => null);
  const detectionRef = useRef<ScanDetectionResult | null>(null);

  const [phase, setPhase] = useState<ScannerPhase>("camera");
  const [scanType, setScanType] = useState<ScanType>("raw");
  const [cameraError, setCameraError] = useState("");
  const [capturedResult, setCapturedResult] = useState<GuidedCaptureResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [videoMetrics, setVideoMetrics] = useState<VideoDisplayMetrics | null>(null);

  const liveActive = open && phase === "camera" && !cameraError;
  const { detection, stableMs, readyForAutoCapture } = useLiveDetection(videoRef, scanType, liveActive);

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

  const statusMessage = resolveScannerMessage(detection, stableMs, capturing);

  useEffect(() => () => {
    stopStream(streamRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    void terminateOcrWorker();
  }, [previewUrl]);

  useEffect(() => {
    if (!open || phase !== "camera") return;
    let active = true;
    autoCapturedRef.current = false;

    async function startCamera() {
      setCameraError("");
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available on this device.");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
          ? "Camera permission was denied. Choose a photo from your library instead."
          : cause instanceof Error ? cause.message : "Camera is unavailable.";
        setCameraError(message);
      }
    }

    void startCamera();
    return () => {
      active = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, phase]);

  async function runCapture(mode: "auto" | "manual") {
    if (!videoRef.current || capturing) return null;
    setCapturing(true);
    try {
      const freshDetection = await redetectForCapture(videoRef.current, scanType, detectionRef.current?.corners);
      const result = await processGuidedCapture({
        video: videoRef.current,
        overlayElement: overlayRef.current,
        scanType,
        captureMode: mode,
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
      setCameraError(cause instanceof Error ? cause.message : "Capture failed.");
      autoCapturedRef.current = false;
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
    void runCaptureRef.current("auto");
  }, [autoCaptureEnabled, capturing, liveActive, readyForAutoCapture]);

  if (!open) return null;

  function closeScanner() {
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhase("camera");
    setScanType("raw");
    setCameraError("");
    setCapturedResult(null);
    autoCapturedRef.current = false;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    onClose();
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

  function useCapture(extras?: { ocrText?: string; recognition?: ScanRecognitionPreview }) {
    if (!capturedResult) return;
    onCapture({
      ...capturedResult,
      ocrText: extras?.ocrText,
      metadata: {
        ...capturedResult.metadata,
        recognition: extras?.recognition ?? capturedResult.metadata.recognition,
      },
    });
    closeScanner();
  }

  return <div className="fixed inset-0 z-50 bg-black text-white">
    {phase === "camera" && <div className="relative min-h-[100svh] overflow-hidden">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <LiveEdgeOverlay
        type={scanType}
        overlayRef={overlayRef}
        displayCorners={displayCorners}
        statusMessage={statusMessage}
        autoCaptureEnabled={autoCaptureEnabled}
        stableMs={stableMs}
      />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={closeScanner} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl font-light backdrop-blur">×</button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan · {side}</p>
          <p className="mt-1 text-sm font-semibold">{scanTypeConfig[scanType].title}</p>
        </div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      {cameraError && <div className="absolute inset-x-4 top-24 rounded-xl border border-[var(--status-warning)] bg-black/85 p-4 text-sm leading-6 shadow-xl backdrop-blur">
        <p>{cameraError}</p>
        <button type="button" className="mt-3 text-[var(--gold-primary)] underline" onClick={() => fileInputRef.current?.click()}>Choose from library</button>
      </div>}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mb-4 flex justify-center">
          <ScanTypeToggle value={scanType} onChange={(type) => { autoCapturedRef.current = false; setScanType(type); }} disabled={capturing} />
        </div>

        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => { autoCapturedRef.current = false; setAutoCaptureEnabled((current) => !current); }}
            className={`rounded-full border px-3 py-2 text-xs font-semibold backdrop-blur ${autoCaptureEnabled ? "border-[var(--gold-primary)] bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]" : "border-white/20 bg-black/45 text-white/75"}`}
          >
            Auto {autoCaptureEnabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur"
          >
            Library
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              onFileFallback(file);
              closeScanner();
            }}
          />
        </div>

        <div className="flex justify-center pb-2">
          <button
            type="button"
            disabled={capturing || Boolean(cameraError)}
            onClick={() => { autoCapturedRef.current = true; void runCapture("manual"); }}
            className="relative flex h-20 w-20 items-center justify-center disabled:opacity-50"
            aria-label="Capture image"
          >
            {autoCaptureEnabled && readyForAutoCapture && !capturing && (
              <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="var(--gold-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={226}
                  strokeDashoffset={226 - (226 * Math.min(stableMs, 800)) / 800}
                />
              </svg>
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/15 shadow-[0_0_0_6px_rgba(255,255,255,.12)]">
              <span className="h-12 w-12 rounded-full bg-white" />
            </span>
          </button>
        </div>
      </div>
    </div>}

    {phase === "preview" && previewUrl && capturedResult && (
      <ScanPreview
        previewUrl={previewUrl}
        scanType={scanType}
        metadata={capturedResult.metadata}
        file={capturedResult.file}
        onRetake={retake}
        onUse={useCapture}
      />
    )}
  </div>;
}
