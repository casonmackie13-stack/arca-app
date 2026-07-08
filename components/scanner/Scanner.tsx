"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import CameraView from "@/components/scanner/CameraView";
import GuideFrame from "@/components/scanner/GuideFrame";
import ScannerControls from "@/components/scanner/ScannerControls";
import ScannerDebugOverlay from "@/components/scanner/ScannerDebugOverlay";
import ScannerPortal from "@/components/scanner/ScannerPortal";
import ScannerPreview from "@/components/scanner/ScannerPreview";
import { processGuidedCapture } from "@/lib/scanner/captureProcessor";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
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

/** Canonical fullscreen scanner for the bottom Add button and Add Card capture step. */
export default function Scanner({
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
  const guideFrameRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);
  const [lastCaptureCrop, setLastCaptureCrop] = useState<string | null>(null);
  const [lastOutputSize, setLastOutputSize] = useState<string | null>(null);

  useBodyScrollLock(open);

  const mode: "camera" | "preview" | "error" = state.phase === "ERROR"
    ? "error"
    : state.phase === "PREVIEW"
      ? "preview"
      : "camera";

  const cameraActive = open && mode === "camera";
  const safeAreaRootRef = useScannerSafeArea(open, headerRef, footerRef, state.scanType);

  useEffect(() => {
    if (!open) return;
    scanFlowLog("CANONICAL_SCANNER_MOUNTED");
    dispatch({ type: "OPEN" });
  }, [open, activeSide, resetKey]);

  const handleCameraReady = useCallback(() => {
    dispatch({ type: "CAMERA_READY" });
  }, []);

  const handleCameraError = useCallback((message: string) => {
    dispatch({ type: "CAMERA_ERROR", message });
  }, []);

  async function runCapture(captureMode: CaptureMode) {
    if (!videoRef.current || state.phase === "CAPTURING") return;
    scanFlowLog("Capture called: runCapture", {
      mode: captureMode,
      scanType: state.scanType,
      hasGuideRef: Boolean(guideFrameRef.current),
    });
    dispatch({ type: "CAPTURE_START", mode: captureMode });
    try {
      const result = await processGuidedCapture({
        video: videoRef.current,
        overlayElement: guideFrameRef.current,
        scanType: state.scanType,
        onCropComputed: (crop, output) => {
          setLastCaptureCrop(`${Math.round(crop.sx)},${Math.round(crop.sy)},${Math.round(crop.sw)}x${Math.round(crop.sh)}`);
          setLastOutputSize(`${output.width}x${output.height}`);
        },
      });
      const previewUrl = URL.createObjectURL(result.file);
      dispatch({
        type: "CAPTURE_SUCCESS",
        file: result.file,
        originalFile: result.originalFile,
        previewUrl,
        mode: captureMode,
      });
    } catch (cause) {
      dispatch({
        type: "CAPTURE_FAILED",
        message: cause instanceof Error ? cause.message : "Capture failed.",
      });
    }
  }

  function closeScanner() {
    dispatch({ type: "CLOSE" });
    onClose();
  }

  function retake() {
    setLastCaptureCrop(null);
    setLastOutputSize(null);
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

  const content = (
    <div ref={safeAreaRootRef} style={scannerRootStyle} className="text-white">
      {mode === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan</p>
          <h2 className="mt-4 text-2xl font-semibold">Camera unavailable</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">{state.error}</p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-black"
            >
              Choose from Library
            </button>
            <button
              type="button"
              onClick={closeScanner}
              className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              onFileFallback(file, activeSide);
            }}
          />
        </div>
      )}

      {showCamera && (
        <>
          <CameraView
            active={cameraActive}
            videoRef={videoRef}
            onReady={handleCameraReady}
            onError={handleCameraError}
          />
          <GuideFrame scanType={state.scanType} guideFrameRef={guideFrameRef} />
          <ScannerDebugOverlay
            videoRef={videoRef}
            guideFrameRef={guideFrameRef}
            scanType={state.scanType}
            activeSide={activeSide}
            active={showCamera}
            lastCaptureCrop={lastCaptureCrop}
            lastOutputSize={lastOutputSize}
          />
          <ScannerControls
            activeSide={activeSide}
            scanType={state.scanType}
            phaseLabel={scannerPhaseLabel(state.phase)}
            backInstruction={backInstruction}
            capturing={state.phase === "CAPTURING"}
            cameraInitializing={state.phase === "INITIALIZING"}
            captureError={state.error}
            showSkipBack={showSkipBack}
            headerRef={headerRef}
            footerRef={footerRef}
            fileInputRef={fileInputRef}
            onClose={closeScanner}
            onScanTypeChange={(scanType) => dispatch({ type: "SET_SCAN_TYPE", scanType })}
            onCapture={() => void runCapture("manual")}
            onSkipBack={onSkipBack}
            onLibraryPick={(file) => onFileFallback(file, activeSide)}
          />
        </>
      )}

      {mode === "preview" && state.previewUrl && (
        <ScannerPreview
          previewUrl={state.previewUrl}
          scanType={state.scanType}
          side={activeSide}
          onRetake={retake}
          onUse={useCapture}
        />
      )}
    </div>
  );

  return <ScannerPortal open={open}>{content}</ScannerPortal>;
}
