"use client";

import { useEffect, useReducer, useRef } from "react";
import GuideFrameOverlay from "@/components/scanner/GuideFrameOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { processGuidedCapture } from "@/lib/scanner/captureProcessor";
import { scannerReducer } from "@/lib/scanner/scannerReducer";
import { useBodyScrollLock } from "@/lib/scanner/useBodyScrollLock";
import {
  initialScannerState,
  isCameraPhase,
  type CaptureMode,
  type GuidedCaptureResult,
  type ScanSequence,
} from "@/lib/scanner/scannerTypes";

const scannerRootClass =
  "fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden overscroll-none bg-black text-white touch-none";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function GuidedCardScanner({
  open,
  activeSide,
  sequence,
  resetKey,
  onClose,
  onUseCapture,
  onSkipBack,
  onFileFallback,
}: {
  open: boolean;
  activeSide: "front" | "back";
  sequence: ScanSequence;
  resetKey: number;
  onClose: () => void;
  onUseCapture: (result: GuidedCaptureResult, side: "front" | "back") => void;
  onSkipBack?: () => void;
  onFileFallback: (file: File | null, side: "front" | "back") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    dispatch({ type: "OPEN" });
  }, [open, activeSide, resetKey]);

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
  }, [cameraActive, activeSide, resetKey]);

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
    onUseCapture({ file: state.capturedFile, scanType: state.scanType }, activeSide);
  }

  function handleLibraryFile(file: File | null) {
    onFileFallback(file, activeSide);
  }

  if (!open) return null;

  const showCamera = isCameraPhase(state.phase) || state.phase === "ERROR";
  const showSkipBack = activeSide === "back" && sequence === "front-back" && Boolean(onSkipBack);
  const backInstruction = activeSide === "back" && sequence === "front-back"
    ? "Now scan the back of the card."
    : undefined;

  return <div className={scannerRootClass}>
    {showCamera && <>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {state.phase !== "ERROR" && (
        <GuideFrameOverlay
          scanType={state.scanType}
          overlayRef={overlayRef}
          phase={state.phase}
          instruction={backInstruction}
        />
      )}

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={closeScanner} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl font-light backdrop-blur">×</button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan · {activeSide}</p>
          <p className="mt-1 text-sm font-semibold">{scanTypeConfig[state.scanType].title}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center">
          <ScanTypeToggle
            value={state.scanType}
            onChange={(scanType) => dispatch({ type: "SET_SCAN_TYPE", scanType })}
            disabled={state.phase === "CAPTURING"}
          />
        </div>
      </header>

      {state.error && <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-20 rounded-xl border border-[var(--status-warning)] bg-black/85 p-4 text-sm leading-6 shadow-xl backdrop-blur">
        <p>{state.error}</p>
        <button type="button" className="mt-3 text-[var(--gold-primary)] underline" onClick={() => fileInputRef.current?.click()}>Choose from library</button>
      </div>}

      <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled
            title="Auto capture coming soon"
            className="cursor-not-allowed rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/40"
          >
            Auto Off
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white/85"
          >
            Library
          </button>
          {showSkipBack && (
            <button
              type="button"
              onClick={() => onSkipBack?.()}
              className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white/85"
            >
              Skip Back
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              handleLibraryFile(file);
            }}
          />
        </div>

        <div className="flex justify-center pb-1">
          <button
            type="button"
            disabled={state.phase === "CAPTURING" || state.phase === "INITIALIZING" || Boolean(state.error)}
            onClick={() => void runCapture("manual")}
            className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center disabled:opacity-50"
            aria-label="Capture image"
          >
            <span className="relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border-4 border-white bg-white/15 shadow-[0_0_0_6px_rgba(255,255,255,.12)]">
              <span className="h-[2.75rem] w-[2.75rem] rounded-full bg-white" />
            </span>
          </button>
        </div>
      </footer>
    </>}

    {state.phase === "PREVIEW" && state.previewUrl && (
      <ScanPreview
        previewUrl={state.previewUrl}
        scanType={state.scanType}
        side={activeSide}
        onRetake={retake}
        onUse={useCapture}
      />
    )}
  </div>;
}
