"use client";

import { useEffect, useReducer, useRef } from "react";
import GuideFrameOverlay from "@/components/scanner/GuideFrameOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { processGuidedCapture } from "@/lib/scanner/captureProcessor";
import { scannerReducer } from "@/lib/scanner/scannerReducer";
import {
  initialScannerState,
  isCameraPhase,
  type CaptureMode,
  type GuidedCaptureResult,
} from "@/lib/scanner/scannerTypes";

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
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);

  useEffect(() => {
    if (!open) return;
    dispatch({ type: "OPEN" });
  }, [open, side]);

  const cameraActive = open && state.phase !== "PREVIEW";

  useEffect(() => {
    if (!cameraActive) return;
    let active = true;

    async function startCamera() {
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
        if (!video) {
          stopStream(stream);
          streamRef.current = null;
          dispatch({ type: "CAMERA_ERROR", message: "Camera preview failed to start." });
          return;
        }
        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          const onReady = () => { video.removeEventListener("loadedmetadata", onReady); resolve(); };
          const onError = () => { video.removeEventListener("error", onError); reject(new Error("Camera failed to start.")); };
          video.addEventListener("loadedmetadata", onReady);
          video.addEventListener("error", onError);
          void video.play().catch(reject);
        });
        if (!active) return;
        dispatch({ type: "CAMERA_READY" });
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied. Choose a photo from your library instead."
          : cause instanceof Error ? cause.message : "Camera is unavailable.";
        dispatch({ type: "CAMERA_ERROR", message });
      }
    }

    void startCamera();
    return () => {
      active = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [cameraActive, side]);

  async function runCapture(mode: CaptureMode) {
    if (!videoRef.current || state.phase === "CAPTURING") return;
    dispatch({ type: "CAPTURE_START", mode });
    try {
      const result = await processGuidedCapture({
        video: videoRef.current,
        overlayElement: overlayRef.current,
        scanType: state.scanType,
      });
      const previewUrl = URL.createObjectURL(result.file);
      stopStream(streamRef.current);
      streamRef.current = null;
      dispatch({ type: "CAPTURE_SUCCESS", file: result.file, previewUrl, mode });
    } catch (cause) {
      dispatch({
        type: "CAPTURE_FAILED",
        message: cause instanceof Error ? cause.message : "Capture failed.",
      });
    }
  }

  function closeScanner() {
    stopStream(streamRef.current);
    streamRef.current = null;
    dispatch({ type: "CLOSE" });
    onClose();
  }

  function retake() {
    dispatch({ type: "PREVIEW_RETAKE" });
  }

  function useCapture() {
    if (!state.capturedFile) return;
    onCapture({ file: state.capturedFile, scanType: state.scanType });
    closeScanner();
  }

  if (!open) return null;

  const showCamera = isCameraPhase(state.phase) || state.phase === "ERROR";

  return <div className="fixed inset-0 z-[100] bg-black text-white">
    {showCamera && <div className="relative min-h-[100svh] overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {state.phase !== "ERROR" && (
        <GuideFrameOverlay scanType={state.scanType} overlayRef={overlayRef} phase={state.phase} />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={closeScanner} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl font-light backdrop-blur">×</button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan · {side}</p>
          <p className="mt-1 text-sm font-semibold">{scanTypeConfig[state.scanType].title}</p>
        </div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      {state.error && <div className="absolute inset-x-4 top-24 rounded-xl border border-[var(--status-warning)] bg-black/85 p-4 text-sm leading-6 shadow-xl backdrop-blur">
        <p>{state.error}</p>
        <button type="button" className="mt-3 text-[var(--gold-primary)] underline" onClick={() => fileInputRef.current?.click()}>Choose from library</button>
      </div>}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mb-4 flex justify-center">
          <ScanTypeToggle
            value={state.scanType}
            onChange={(scanType) => dispatch({ type: "SET_SCAN_TYPE", scanType })}
            disabled={state.phase === "CAPTURING"}
          />
        </div>

        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled
            title="Auto capture coming soon"
            className="cursor-not-allowed rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/40 backdrop-blur"
          >
            Auto Off
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
            disabled={state.phase === "CAPTURING" || state.phase === "INITIALIZING" || Boolean(state.error)}
            onClick={() => void runCapture("manual")}
            className="relative flex h-20 w-20 items-center justify-center disabled:opacity-50"
            aria-label="Capture image"
          >
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/15 shadow-[0_0_0_6px_rgba(255,255,255,.12)]">
              <span className="h-12 w-12 rounded-full bg-white" />
            </span>
          </button>
        </div>
      </div>
    </div>}

    {state.phase === "PREVIEW" && state.previewUrl && (
      <ScanPreview
        previewUrl={state.previewUrl}
        scanType={state.scanType}
        onRetake={retake}
        onUse={useCapture}
      />
    )}
  </div>;
}
