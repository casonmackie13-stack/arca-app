"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import CameraView from "@/components/scanner/CameraView";
import DetectionOverlay from "@/components/scanner/DetectionOverlay";
import GuideFrame, { type GuideFrameVisualState } from "@/components/scanner/GuideFrame";
import ScannerControls from "@/components/scanner/ScannerControls";
import ScannerDebugOverlay from "@/components/scanner/ScannerDebugOverlay";
import ScannerPortal from "@/components/scanner/ScannerPortal";
import ScannerPreview from "@/components/scanner/ScannerPreview";
import "./scanner.css";
import { processGuidedCapture } from "@/lib/scanner/captureProcessor";
import { AUTO_CAPTURE_STABLE_MS } from "@/lib/scanner/core/constants";
import { isOpenCvScannerEnabled } from "@/lib/scanner/scannerFlags";
import { opencvStatusLabel } from "@/lib/scanner/opencvLoader";
import { resolveScannerMessage } from "@/lib/scanner/scannerMessages";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import { scannerReducer } from "@/lib/scanner/scannerReducer";
import { scanProgressStep, scannerStatusDisplay } from "@/lib/scanner/scannerStatus";
import { useBodyScrollLock } from "@/lib/scanner/useBodyScrollLock";
import { useLiveDetection } from "@/lib/scanner/useLiveDetection";
import { useOpenCvLoader } from "@/lib/scanner/useOpenCvLoader";
import { SCANNER_CSS_DEFAULTS, useScannerLayout } from "@/lib/scanner/useScannerLayout";
import {
  initialScannerState,
  isCameraPhase,
  type CameraStatus,
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

function triggerLockHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(12);
  }
}

/**
 * Canonical document scanner — camera → live guidance → native capture → OpenCV on captured frame.
 * Post-scan AI runs only in AddCardClient, never during live preview.
 */
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
  const hapticLockRef = useRef(false);
  const autoCaptureTriggeredRef = useRef(false);
  const mountedRef = useRef(true);
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
  const opencvFeatureEnabled = isOpenCvScannerEnabled();
  const cameraStarted = state.cameraStatus === "requesting" || state.cameraStatus === "ready";
  const opencv = useOpenCvLoader(open && opencvFeatureEnabled, true, cameraStarted);
  const detectionActive = opencvFeatureEnabled
    && cameraActive
    && state.phase !== "CAPTURING"
    && opencv.status === "ready";

  const { detection, stableMs, readyForAutoCapture, autoCaptureBlockReason } = useLiveDetection(
    videoRef,
    state.scanType,
    detectionActive,
    opencv.status,
  );

  const layoutRootRef = useScannerLayout(open, videoRef, state.scanType, detection);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    scanFlowLog("DOCUMENT_SCANNER_MOUNTED", { opencvFeatureEnabled });
    dispatch({ type: "OPEN" });
    hapticLockRef.current = false;
    autoCaptureTriggeredRef.current = false;
  }, [open, activeSide, resetKey, opencvFeatureEnabled]);

  const handleCameraStatusChange = useCallback((status: CameraStatus) => {
    dispatch({ type: "CAMERA_STATUS", status });
  }, []);

  const handleCameraReady = useCallback(() => {
    dispatch({ type: "CAMERA_READY" });
  }, []);

  const handleCameraError = useCallback((message: string) => {
    dispatch({ type: "CAMERA_ERROR", message });
  }, []);

  const runCapture = useCallback(async (captureMode: CaptureMode) => {
    if (!videoRef.current || state.phase === "CAPTURING" || !mountedRef.current) return;
    scanFlowLog("Capture called", { mode: captureMode, scanType: state.scanType });
    dispatch({ type: "CAPTURE_START", mode: captureMode });
    try {
      const result = await processGuidedCapture({
        video: videoRef.current,
        overlayElement: guideFrameRef.current,
        scanType: state.scanType,
        captureMode,
        onCropComputed: (crop, output) => {
          if (!mountedRef.current) return;
          setLastCaptureCrop(`${Math.round(crop.sx)},${Math.round(crop.sy)},${Math.round(crop.sw)}x${Math.round(crop.sh)}`);
          setLastOutputSize(`${output.width}x${output.height}`);
        },
      });
      if (!mountedRef.current) return;
      const previewUrl = URL.createObjectURL(result.file);
      dispatch({
        type: "CAPTURE_SUCCESS",
        file: result.file,
        originalFile: result.originalFile,
        previewUrl,
        mode: captureMode,
        qualityRecord: result.qualityRecord,
        metadata: result.metadata,
      });
    } catch (cause) {
      if (!mountedRef.current) return;
      dispatch({
        type: "CAPTURE_FAILED",
        message: cause instanceof Error ? cause.message : "Capture failed.",
      });
    }
  }, [state.phase, state.scanType]);

  useEffect(() => {
    if (!readyForAutoCapture) {
      hapticLockRef.current = false;
      return;
    }
    if (!hapticLockRef.current) {
      triggerLockHaptic();
      hapticLockRef.current = true;
    }
  }, [readyForAutoCapture]);

  useEffect(() => {
    if (!opencvFeatureEnabled || !state.autoCaptureEnabled || !readyForAutoCapture) {
      autoCaptureTriggeredRef.current = false;
      return;
    }
    if (state.phase !== "SEARCHING" && state.phase !== "READY" && state.phase !== "CAMERA_READY") return;
    if (autoCaptureTriggeredRef.current) return;
    autoCaptureTriggeredRef.current = true;
    void runCapture("auto");
  }, [opencvFeatureEnabled, readyForAutoCapture, runCapture, state.autoCaptureEnabled, state.phase]);

  function closeScanner() {
    dispatch({ type: "CLOSE" });
    onClose();
  }

  function retake() {
    setLastCaptureCrop(null);
    setLastOutputSize(null);
    hapticLockRef.current = false;
    autoCaptureTriggeredRef.current = false;
    dispatch({ type: "PREVIEW_RETAKE" });
  }

  function useCapture() {
    if (!state.capturedFile || !state.capturedOriginalFile) return;
    onUseCapture({
      file: state.capturedFile,
      originalFile: state.capturedOriginalFile,
      scanType: state.scanType,
      qualityRecord: state.qualityRecord ?? undefined,
      metadata: state.captureMetadata ?? undefined,
    }, activeSide);
  }

  if (!open) return null;

  const showCamera = isCameraPhase(state.phase);
  const showSkipBack = activeSide === "back" && sequence === "front-back" && Boolean(onSkipBack);

  const scannerMessage = resolveScannerMessage(
    detection,
    stableMs,
    state.phase === "CAPTURING",
  );
  const statusText = scannerStatusDisplay(state.phase, scannerMessage, detection);
  const progressStep = scanProgressStep(activeSide, mode);
  const autoCaptureProgress = state.autoCaptureEnabled
    ? Math.min(100, Math.round((stableMs / AUTO_CAPTURE_STABLE_MS) * 100))
    : 0;

  let guideVisualState: GuideFrameVisualState = "searching";
  if (readyForAutoCapture) guideVisualState = "locked";
  else if (detection?.found && detection.confidence >= 0.45) guideVisualState = "detected";

  const opencvStatusText = opencvStatusLabel(opencv.status);

  const content = (
    <div ref={layoutRootRef} style={scannerRootStyle} className="text-white">
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
            onStatusChange={handleCameraStatusChange}
            onReady={handleCameraReady}
            onError={handleCameraError}
          />
          <DetectionOverlay
            videoRef={videoRef}
            detection={detection}
            active={detectionActive}
          />
          <GuideFrame
            scanType={state.scanType}
            guideFrameRef={guideFrameRef}
            visualState={guideVisualState}
          />
          <ScannerDebugOverlay
            videoRef={videoRef}
            guideFrameRef={guideFrameRef}
            scanType={state.scanType}
            activeSide={activeSide}
            active={showCamera}
            opencv={opencv}
            detection={detection}
            autoCaptureBlockReason={autoCaptureBlockReason}
            cameraStatus={state.cameraStatus}
            captureMetadata={state.captureMetadata}
            lastCaptureCrop={lastCaptureCrop}
            lastOutputSize={lastOutputSize}
          />
          <ScannerControls
            activeSide={activeSide}
            scanType={state.scanType}
            statusText={statusText}
            opencvStatusText={opencvStatusText}
            opencvStatus={opencv.status}
            opencvLoadMs={opencv.loadMs}
            opencvError={opencv.error}
            cameraStatus={state.cameraStatus}
            progressStep={progressStep}
            opencvFeatureEnabled={opencvFeatureEnabled}
            autoCaptureEnabled={state.autoCaptureEnabled}
            autoCaptureProgress={autoCaptureProgress}
            capturing={state.phase === "CAPTURING"}
            cameraInitializing={state.cameraStatus === "requesting" || state.phase === "INITIALIZING"}
            captureError={state.error}
            showSkipBack={showSkipBack}
            headerRef={headerRef}
            footerRef={footerRef}
            fileInputRef={fileInputRef}
            onClose={closeScanner}
            onScanTypeChange={(scanType) => dispatch({ type: "SET_SCAN_TYPE", scanType })}
            onToggleAutoCapture={() => dispatch({ type: "TOGGLE_AUTO_CAPTURE" })}
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
          qualityBadge={state.qualityRecord?.overall_badge}
          qualityLoading={false}
          retryMessage={
            state.qualityRecord && state.qualityRecord.overall_badge !== "excellent"
              ? "This photo may be blurry or glared. Retake for better listing quality?"
              : ""
          }
          onRetake={retake}
          onUse={useCapture}
        />
      )}
    </div>
  );

  return <ScannerPortal open={open}>{content}</ScannerPortal>;
}
