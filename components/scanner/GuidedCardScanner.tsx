"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import BoundaryOverlay from "@/components/scanner/BoundaryOverlay";
import ScanPreview from "@/components/scanner/ScanPreview";
import ScanTypeSelector from "@/components/scanner/ScanTypeSelector";
import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { mapVideoPointToDisplayPoint, scanCardBoundary, type DetectedCardBoundary } from "@/lib/image-processing/cardBoundaryScanner";
import { loadOpenCv, type OpenCvRuntime } from "@/lib/image-processing/opencvLoader";
import { fixedOverlayCropVideoFrame, fullFrameCapture, perspectiveCorrectVideoFrame } from "@/lib/image-processing/perspectiveCorrection";

type ScannerPhase = "select" | "camera" | "preview";
type ScannerStatus =
  | "loading"
  | "searching"
  | "candidate"
  | "valid"
  | "stable"
  | "capturing"
  | "captured"
  | "fallback";

type CaptureSource = "guide-frame" | "fallback";

type CameraDiagnostics = {
  permissionState: string;
  streamActive: boolean;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  paused: boolean;
  currentTime: number;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function isLikelyMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

function averageCornerMovement(a: DetectedCardBoundary, b: DetectedCardBoundary) {
  return a.corners.reduce((sum, point, index) => sum + Math.hypot(point.x - b.corners[index].x, point.y - b.corners[index].y), 0) / 4;
}

function waitForLoadedMetadata(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth && video.videoHeight) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
    const handleLoaded = () => { cleanup(); resolve(); };
    const handleError = () => { cleanup(); reject(new Error("Camera video failed to load.")); };
    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

async function cameraPermissionState() {
  try {
    const permissions = navigator.permissions as Permissions & { query: (descriptor: { name: "camera" }) => Promise<PermissionStatus> };
    return (await permissions.query({ name: "camera" })).state;
  } catch {
    return "unknown";
  }
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
  const cvRef = useRef<OpenCvRuntime | null>(null);
  const previousBoundaryRef = useRef<DetectedCardBoundary | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const lastCaptureAtRef = useRef(0);
  const captureFrameRef = useRef<(boundary?: DetectedCardBoundary | null) => void>(() => {});
  const capturingRef = useRef(false);
  const [phase, setPhase] = useState<ScannerPhase>("select");
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraDiagnostics, setCameraDiagnostics] = useState<CameraDiagnostics>({ permissionState: "unknown", streamActive: false, readyState: 0, videoWidth: 0, videoHeight: 0, paused: true, currentTime: 0 });
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("searching");
  const [scannerMessage, setScannerMessage] = useState("Find card edges");
  const [openCvError, setOpenCvError] = useState("");
  const [detectedBoundary, setDetectedBoundary] = useState<DetectedCardBoundary | null>(null);
  const [displayBoundary, setDisplayBoundary] = useState<DetectedCardBoundary | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [stableDurationMs, setStableDurationMs] = useState(0);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [overlayCropSucceeded, setOverlayCropSucceeded] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(isLikelyMobile);
  const [lastCaptureSource, setLastCaptureSource] = useState<CaptureSource | "perspective">("guide-frame");

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  useEffect(() => {
    captureFrameRef.current = (boundary?: DetectedCardBoundary | null) => {
      void captureFrame(boundary);
    };
  });

  function resetScanner() {
    setPhase("select");
    setScanType(null);
    setCameraError("");
    setCameraReady(false);
    setCameraDiagnostics({ permissionState: "unknown", streamActive: false, readyState: 0, videoWidth: 0, videoHeight: 0, paused: true, currentTime: 0 });
    setScannerStatus("searching");
    setScannerMessage("Find card edges");
    setDetectedBoundary(null);
    setDisplayBoundary(null);
    setCandidateCount(0);
    setStableDurationMs(0);
    stableSinceRef.current = null;
    previousBoundaryRef.current = null;
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
      setCameraReady(false);
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available on this device.");
        setCameraDiagnostics((current) => ({ ...current, permissionState: "prompt" }));
        void cameraPermissionState().then((permissionState) => { if (active) setCameraDiagnostics((current) => ({ ...current, permissionState })); });
        const attempts: MediaStreamConstraints[] = [
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          { video: { facingMode: "environment" }, audio: false },
          { video: true, audio: false },
        ];
        let stream: MediaStream | null = null;
        let lastError: unknown = null;
        for (const constraints of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (cause) {
            lastError = cause;
          }
        }
        if (!stream) throw lastError instanceof Error ? lastError : new Error("Camera is unavailable.");
        if (!active) { stopStream(stream); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await waitForLoadedMetadata(videoRef.current);
          await videoRef.current.play();
          setCameraReady(true);
          setScannerStatus(cvRef.current ? "searching" : "loading");
          setScannerMessage(cvRef.current ? "Find card edges" : "Camera ready. Edge detection loading...");
          setCameraDiagnostics((current) => ({
            ...current,
            streamActive: stream.getVideoTracks().some((track) => track.readyState === "live"),
            readyState: videoRef.current?.readyState || 0,
            videoWidth: videoRef.current?.videoWidth || 0,
            videoHeight: videoRef.current?.videoHeight || 0,
            paused: Boolean(videoRef.current?.paused),
            currentTime: videoRef.current?.currentTime || 0,
          }));
        }
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied. You can still choose a photo from your library."
          : cause instanceof Error ? cause.message : "Camera is unavailable. You can still choose a photo from your library.";
        setCameraError(message);
        setCameraReady(false);
        setCameraDiagnostics((current) => ({ ...current, streamActive: false }));
      }
    }
    void startCamera();
    return () => {
      active = false;
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [open, phase, scanType]);

  useEffect(() => {
    if (!open || phase !== "camera" || !scanType || !cameraReady) return;
    let active = true;
    loadOpenCv()
      .then((cv) => {
        if (!active) return;
        cvRef.current = cv;
        setOpenCvError("");
        setScannerStatus("searching");
        setScannerMessage("Find card edges");
      })
      .catch((cause) => {
        if (!active) return;
        cvRef.current = null;
        setOpenCvError(cause instanceof Error ? cause.message : "OpenCV failed to load.");
        setScannerStatus("fallback");
        setScannerMessage("Camera ready. Manual scan available.");
      });
    return () => { active = false; };
  }, [open, phase, scanType, cameraReady]);

  useEffect(() => {
    if (!open || phase !== "camera" || !scanType || !cameraReady) return;
    analysisCanvasRef.current ||= document.createElement("canvas");
    const interval = window.setInterval(() => {
      const cv = cvRef.current;
      if (capturingRef.current || !videoRef.current || !analysisCanvasRef.current || !cv) return;
      const videoReady = videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Boolean(videoRef.current.videoWidth && videoRef.current.videoHeight);
      if (!videoReady) {
        setScannerStatus("searching");
        setScannerMessage("Camera is warming up");
        setDetectedBoundary(null);
        setDisplayBoundary(null);
        return;
      }
      const result = scanCardBoundary({ cv, video: videoRef.current, canvas: analysisCanvasRef.current, scanType });
      setCandidateCount(result.candidates);
      setDetectedBoundary(result.boundary);
      setDisplayBoundary(result.boundary ? { ...result.boundary, corners: result.boundary.corners.map((point) => mapVideoPointToDisplayPoint(point, videoRef.current as HTMLVideoElement)) as DetectedCardBoundary["corners"] } : null);
      const valid = Boolean(result.boundary && result.status === "valid" && result.boundary.confidence >= 0.62 && result.boundary.areaRatio >= 0.08 && result.boundary.centerOffset < 0.42);
      if (!valid) {
        previousBoundaryRef.current = result.boundary;
        stableSinceRef.current = null;
        setStableDurationMs(0);
        setScannerStatus(result.status as ScannerStatus);
        setScannerMessage(result.message);
        return;
      }
      const previous = previousBoundaryRef.current;
      const movement = previous ? averageCornerMovement(result.boundary as DetectedCardBoundary, previous) : 1;
      previousBoundaryRef.current = result.boundary;
      stableSinceRef.current = movement < 0.018 ? (stableSinceRef.current ?? performance.now()) : null;
      const stableMs = stableSinceRef.current ? performance.now() - stableSinceRef.current : 0;
      setStableDurationMs(stableMs);
      const stable = stableMs >= 900;
      setScannerStatus(stable ? "stable" : "valid");
      setScannerMessage(stable ? "Capturing..." : "Hold steady");
      const cooldownPassed = performance.now() - lastCaptureAtRef.current > 1800;
      if (autoCapture && stable && cooldownPassed) {
        lastCaptureAtRef.current = performance.now();
        captureFrameRef.current(result.boundary);
      }
    }, 120);
    return () => {
      window.clearInterval(interval);
      stableSinceRef.current = null;
    };
  }, [open, phase, scanType, autoCapture, cameraReady]);

  useEffect(() => {
    if (!open || phase !== "camera") return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      setCameraDiagnostics((current) => ({
        ...current,
        streamActive: streamRef.current?.getVideoTracks().some((track) => track.readyState === "live") || false,
        readyState: video?.readyState || 0,
        videoWidth: video?.videoWidth || 0,
        videoHeight: video?.videoHeight || 0,
        paused: video?.paused ?? true,
        currentTime: video?.currentTime || 0,
      }));
    }, 500);
    return () => window.clearInterval(interval);
  }, [open, phase]);

  if (!open) return null;

  function closeScanner() {
    stopStream(streamRef.current);
    streamRef.current = null;
    resetScanner();
    onClose();
  }

  function selectType(type: ScanType) {
    setScanType(type);
    setCameraReady(false);
    setScannerStatus("searching");
    setScannerMessage("Starting camera...");
    stableSinceRef.current = null;
    previousBoundaryRef.current = null;
    setStableDurationMs(0);
    setDetectedBoundary(null);
    setDisplayBoundary(null);
    setPhase("camera");
  }

  async function captureFrame(boundaryOverride?: DetectedCardBoundary | null) {
    if (!videoRef.current || !overlayRef.current || !scanType || capturing) return;
    setCapturing(true);
    setScannerStatus("capturing");
    try {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const boundary = boundaryOverride || detectedBoundary;
      const capture = boundary?.isValidForScanType && cvRef.current
        ? await perspectiveCorrectVideoFrame({ cv: cvRef.current, video, corners: boundary.corners, scanType }).catch(() => fixedOverlayCropVideoFrame(video, overlay, scanType))
        : await fixedOverlayCropVideoFrame(video, overlay, scanType);
      const url = URL.createObjectURL(capture.file);
      setCapturedFile(capture.file);
      setLastCaptureSource(capture.method === "perspective" ? "perspective" : "guide-frame");
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
    setScannerStatus("searching");
    setScannerMessage("Find card edges");
    stableSinceRef.current = null;
    previousBoundaryRef.current = null;
    setStableDurationMs(0);
    setDetectedBoundary(null);
    setDisplayBoundary(null);
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

  const detectionState = capturing || scannerStatus === "stable" ? "capturing" : scannerStatus === "valid" ? "aligned" : scannerStatus === "candidate" ? "detected" : scannerStatus === "fallback" ? "failed" : "searching";
  const detectionMessage = capturing ? "Capturing..." : scannerMessage;
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
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 z-0 h-full w-full bg-black object-cover" />
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
          <input type="checkbox" className="accent-[var(--gold-primary)]" checked={autoCapture} onChange={(event) => { setAutoCapture(event.target.checked); stableSinceRef.current = null; setStableDurationMs(0); }} />
          Auto capture
        </label>
      </div>
      {showDebug && <div className="absolute right-4 top-24 max-w-[12rem] rounded-xl border border-white/15 bg-black/70 p-3 text-[10px] leading-4 text-white/80 backdrop-blur">
        <p>opencv: {cvRef.current ? "loaded" : openCvError ? "error" : "loading"}</p>
        <p>permission: {cameraDiagnostics.permissionState}</p>
        <p>stream: {cameraDiagnostics.streamActive ? "active" : "inactive"}</p>
        <p>ready: {cameraDiagnostics.readyState}</p>
        <p>video: {cameraDiagnostics.videoWidth}x{cameraDiagnostics.videoHeight}</p>
        <p>paused: {cameraDiagnostics.paused ? "yes" : "no"}</p>
        <p>time: {cameraDiagnostics.currentTime.toFixed(1)}</p>
        <p>cameraError: {cameraError || "none"}</p>
        <p>status: {scannerStatus}</p>
        <p>candidates: {candidateCount}</p>
        <p>confidence: {Math.round((detectedBoundary?.confidence || 0) * 100)}%</p>
        <p>aspect: {detectedBoundary?.aspectRatio.toFixed(2) || "n/a"}</p>
        <p>area: {detectedBoundary?.areaRatio.toFixed(2) || "n/a"}</p>
        <p>center: {detectedBoundary?.centerOffset.toFixed(2) || "n/a"}</p>
        <p>stable: {Math.round(stableDurationMs)}ms</p>
        <p>auto: {autoCapture ? "on" : "off"}</p>
        <p>capture: {lastCaptureSource}</p>
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
