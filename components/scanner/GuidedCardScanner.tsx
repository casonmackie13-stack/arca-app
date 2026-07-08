"use client";

/**
 * LEGACY SCANNER PATH — do not use for Add button flow.
 * Use @/components/scanner/Scanner instead.
 */
import { useEffect, useReducer, useRef, type CSSProperties } from "react";
import GuideFrameOverlay from "@/components/scanner/GuideFrameOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScannerPortal from "@/components/scanner/ScannerPortal";
import ScannerDebugOverlay from "@/components/scanner/ScannerDebugOverlay";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import { processGuidedCapture } from "@/lib/scanner/captureProcessor";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import { acquireCameraStream } from "@/lib/scanner/cameraConstraints";
import { scannerReducer } from "@/lib/scanner/scannerReducer";
import { useBodyScrollLock } from "@/lib/scanner/useBodyScrollLock";
import { SCANNER_CSS_DEFAULTS, useScannerSafeArea } from "@/lib/scanner/useScannerSafeArea";
import {
  initialScannerState,
  isCameraPhase,
  scannerPhaseLabel,
  type CaptureMode,
  type GuidedCaptureResult,
  type ScanSequence,
} from "@/lib/scanner/scannerTypes";

const scannerRootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  maxHeight: "100dvh",
  overflow: "hidden",
  background: "#000",
  zIndex: 200,
  touchAction: "none",
  overscrollBehavior: "none",
  ...SCANNER_CSS_DEFAULTS,
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function sideLabel(side: "front" | "back") {
  return side === "front" ? "Scan Front" : "Scan Back";
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
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);

  useBodyScrollLock(open);

  const cameraActive = open && state.phase !== "PREVIEW" && state.phase !== "ERROR";
  const safeAreaRootRef = useScannerSafeArea(open, headerRef, footerRef, state.scanType);

  useEffect(() => {
    if (!open) return;
    scanFlowLog("LEGACY_SCANNER_MOUNTED: GuidedCardScanner");
    dispatch({ type: "OPEN" });
  }, [open, activeSide, resetKey]);

  useEffect(() => {
    if (!cameraActive) return;
    let active = true;

    async function startCamera() {
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available on this device.");
        const stream = await acquireCameraStream();
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
          ? "Camera permission was denied."
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
      dispatch({ type: "CAPTURE_SUCCESS", file: result.file, originalFile: result.originalFile, previewUrl, mode });
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
    if (!state.capturedFile || !state.capturedOriginalFile) return;
    onUseCapture({
      file: state.capturedFile,
      originalFile: state.capturedOriginalFile,
      scanType: state.scanType,
    }, activeSide);
  }

  if (!open) return null;

  const showCamera = isCameraPhase(state.phase);
  const showSkipBack = activeSide === "back" && sequence === "front-back" && Boolean(onSkipBack);
  const backInstruction = activeSide === "back" && sequence === "front-back"
    ? "Now scan the back of the card."
    : undefined;

  const content = <div ref={safeAreaRootRef} style={scannerRootStyle} className="text-white">
    {state.phase === "ERROR" && (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan</p>
        <h2 className="mt-4 text-2xl font-semibold">Camera unavailable</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">{state.error}</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-black">Choose from Library</button>
          <button type="button" onClick={closeScanner} className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white">Close</button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ""; onFileFallback(file, activeSide); }} />
      </div>
    )}

    {showCamera && <>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 z-0 h-full w-full object-cover" />
      <GuideFrameOverlay scanType={state.scanType} overlayRef={overlayRef} />
      <ScannerDebugOverlay videoRef={videoRef} guideFrameRef={overlayRef} scanType={state.scanType} activeSide={activeSide} active={showCamera} />
      <header ref={headerRef} className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={closeScanner} aria-label="Close scanner" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-xl font-light backdrop-blur">×</button>
          <div className="min-w-0 flex-1 pt-1 text-center">
            <p className="text-sm font-semibold tracking-[-0.01em]">{sideLabel(activeSide)}</p>
            {backInstruction && <p className="mt-1 text-xs text-white/75">{backInstruction}</p>}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gold-primary)]">{scannerPhaseLabel(state.phase)}</p>
          </div>
          <div className="h-11 w-11 shrink-0" aria-hidden />
        </div>
      </header>
      <footer ref={footerRef} className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/85 backdrop-blur-md" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)", paddingTop: "12px", paddingLeft: "16px", paddingRight: "16px" }}>
        <div className="mb-3 flex justify-center"><ScanTypeToggle value={state.scanType} onChange={(scanType) => dispatch({ type: "SET_SCAN_TYPE", scanType })} disabled={state.phase === "CAPTURING"} /></div>
        <div className="flex justify-center">
          <button type="button" disabled={state.phase === "CAPTURING" || state.phase === "INITIALIZING"} onClick={() => void runCapture("manual")} className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center disabled:opacity-50" aria-label="Capture image">
            <span className="relative flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full border-4 border-white bg-white/15"><span className="h-[2.5rem] w-[2.5rem] rounded-full bg-white" /></span>
          </button>
        </div>
      </footer>
    </>}

    {state.phase === "PREVIEW" && state.previewUrl && (
      <ScanPreview previewUrl={state.previewUrl} scanType={state.scanType} side={activeSide} onRetake={retake} onUse={useCapture} />
    )}
  </div>;

  return <ScannerPortal open={open}>{content}</ScannerPortal>;
}
