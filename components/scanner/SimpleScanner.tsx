"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraView from "@/components/scanner/CameraView";
import CornerCropEditor from "@/components/scanner/CornerCropEditor";
import ScannerPortal from "@/components/scanner/ScannerPortal";
import ScanTypeToggle from "@/components/scanner/ScanTypeToggle";
import ArcaImage from "@/components/ui/ArcaImage";
import { Button } from "@/components/ui/Button";
import "./scanner.css";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { captureNativeVideoFrame } from "@/lib/scanner/core/captureFrame";
import { warpPerspective, type Point } from "@/lib/scanner/core/perspectiveTransform";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import { useBodyScrollLock } from "@/lib/scanner/useBodyScrollLock";
import type {
  CameraStatus,
  GuidedCaptureResult,
  ScanSequence,
  ScanType,
} from "@/lib/scanner/scannerTypes";

type Phase = "camera" | "cropping" | "preview" | "error";

async function canvasToJpegFile(canvas: HTMLCanvasElement, scanType: ScanType, suffix = ""): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Could not encode capture."));
      }, "image/jpeg", suffix === "original" ? 0.95 : 0.92);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Could not encode capture."));
    }
  });
  return new File(
    [blob],
    `arca-${scanType}${suffix ? `-${suffix}` : ""}-${Date.now()}.jpg`,
    { type: "image/jpeg" },
  );
}

/**
 * Simple, reliable manual-crop scanner.
 * Camera → manual capture → four-corner crop → pure-JS perspective correct → save.
 * No OpenCV, no live detection, no burst, no auto-capture, no AI.
 */
export default function SimpleScanner({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const capturedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const resultRef = useRef<GuidedCaptureResult | null>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [scanType, setScanType] = useState<ScanType>("raw");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useBodyScrollLock(open);

  const revokeCaptured = useCallback(() => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokeCaptured();
      revokePreview();
    };
  }, [revokeCaptured, revokePreview]);

  useEffect(() => {
    if (!open) return;
    scanFlowLog("SIMPLE_SCANNER_MOUNTED", { activeSide, resetKey });
    setPhase("camera");
    setErrorMessage(null);
    setConfirming(false);
    capturedCanvasRef.current = null;
    resultRef.current = null;
    revokeCaptured();
    revokePreview();
    setCapturedUrl(null);
    setPreviewUrl(null);
  }, [open, activeSide, resetKey, revokeCaptured, revokePreview]);

  const handleCameraStatusChange = useCallback((status: CameraStatus) => {
    if (mountedRef.current) setCameraStatus(status);
  }, []);

  const handleCameraError = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setErrorMessage(message);
    setPhase("error");
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = captureNativeVideoFrame(video);
      capturedCanvasRef.current = canvas;
      canvas.toBlob((blob) => {
        if (!mountedRef.current || !blob) return;
        revokeCaptured();
        const url = URL.createObjectURL(blob);
        capturedUrlRef.current = url;
        setCapturedUrl(url);
        setPhase("cropping");
      }, "image/jpeg", 0.95);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Capture failed.");
    }
  }, [revokeCaptured]);

  const confirmCrop = useCallback(async (cornerFractions: Point[]) => {
    const canvas = capturedCanvasRef.current;
    if (!canvas) return;
    setConfirming(true);
    try {
      const output = scanTypeConfig[scanType].output;
      const nativeCorners: Point[] = cornerFractions.map((corner) => ({
        x: corner.x * canvas.width,
        y: corner.y * canvas.height,
      }));

      scanFlowLog("Manual crop confirmed", {
        scanType,
        corners: nativeCorners.map((c) => `${Math.round(c.x)},${Math.round(c.y)}`).join(" "),
        output: `${output.width}x${output.height}`,
      });

      const cropped = warpPerspective(canvas, nativeCorners, output.width, output.height);
      const [file, originalFile] = await Promise.all([
        canvasToJpegFile(cropped, scanType),
        canvasToJpegFile(canvas, scanType, "original"),
      ]);

      if (!mountedRef.current) return;

      revokePreview();
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      resultRef.current = {
        file,
        originalFile,
        scanType,
        metadata: {
          scanType,
          captureMode: "manual",
          edgeDetected: false,
          perspectiveCorrected: true,
          crop_method: "manual_corners",
          videoWidth: canvas.width,
          videoHeight: canvas.height,
        },
      };
      setPreviewUrl(url);
      setPhase("preview");
    } catch (cause) {
      console.error("[ARCA Scanner] Manual crop failed:", cause);
      if (mountedRef.current) {
        setErrorMessage(cause instanceof Error ? cause.message : "Could not crop the card.");
      }
    } finally {
      if (mountedRef.current) setConfirming(false);
    }
  }, [revokePreview, scanType]);

  const retakeToCamera = useCallback(() => {
    capturedCanvasRef.current = null;
    resultRef.current = null;
    revokeCaptured();
    revokePreview();
    setCapturedUrl(null);
    setPreviewUrl(null);
    setConfirming(false);
    setErrorMessage(null);
    setPhase("camera");
  }, [revokeCaptured, revokePreview]);

  const closeScanner = useCallback(() => {
    onClose();
  }, [onClose]);

  const useResult = useCallback(() => {
    if (resultRef.current) onUseCapture(resultRef.current, activeSide);
  }, [activeSide, onUseCapture]);

  if (!open) return null;

  const cameraActive = open && phase === "camera";
  const showSkipBack = activeSide === "back" && sequence === "front-back" && Boolean(onSkipBack);
  const cameraInitializing = cameraStatus === "requesting" || cameraStatus === "idle";

  const content = (
    <div
      className="fixed inset-0 z-[200] bg-black text-white"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan</p>
          <h2 className="mt-4 text-2xl font-semibold">Camera unavailable</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">{errorMessage}</p>
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
        </div>
      )}

      {phase === "camera" && (
        <>
          <CameraView
            active={cameraActive}
            videoRef={videoRef}
            onStatusChange={handleCameraStatusChange}
            onReady={() => handleCameraStatusChange("ready")}
            onError={handleCameraError}
          />

          <header
            className="pointer-events-none absolute inset-x-0 top-0 z-20"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
          >
            <div className="bg-gradient-to-b from-black/70 via-black/25 to-transparent px-4 pb-10">
              <div className="pointer-events-auto flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={closeScanner}
                  aria-label="Close scanner"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-lg font-light text-white/95 backdrop-blur-md"
                >
                  ×
                </button>
                <div className="min-w-0 flex-1 pt-0.5 text-center">
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                    {activeSide === "front" ? "Scan Front" : "Scan Back"}
                  </p>
                  <p className="mt-1 text-[13px] text-white/72">Fit the card in the frame, then capture.</p>
                </div>
                <div className="h-10 w-10" aria-hidden />
              </div>
            </div>
          </header>

          <footer
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="bg-gradient-to-t from-black/78 via-black/34 to-transparent px-4 pb-2 pt-16">
              <div className="pointer-events-auto mx-auto flex max-w-md flex-col items-center gap-3">
                <ScanTypeToggle value={scanType} onChange={setScanType} disabled={cameraInitializing} />

                <div className="flex w-full items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-white/18 bg-black/42 px-4 py-2 text-[12px] font-semibold text-white/85"
                  >
                    Library
                  </button>
                  {showSkipBack && (
                    <button
                      type="button"
                      onClick={() => onSkipBack?.()}
                      className="rounded-full border border-white/18 bg-black/42 px-4 py-2 text-[12px] font-semibold text-white/85"
                    >
                      Skip Back
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={cameraInitializing}
                  onClick={captureFrame}
                  className="scanner-shutter-ring relative flex h-[5.1rem] w-[5.1rem] items-center justify-center disabled:opacity-45"
                  aria-label="Capture image"
                >
                  <span className="relative flex h-[4.2rem] w-[4.2rem] items-center justify-center rounded-full border-[3px] border-white bg-white/12 shadow-[0_0_0_5px_rgba(255,255,255,.1)]">
                    <span className="h-[3rem] w-[3rem] rounded-full bg-white" />
                  </span>
                </button>
              </div>
            </div>
          </footer>
        </>
      )}

      {phase === "cropping" && capturedUrl && (
        <CornerCropEditor
          imageUrl={capturedUrl}
          aspectRatio={scanTypeConfig[scanType].aspectRatio}
          confirming={confirming}
          onConfirm={confirmCrop}
          onRetake={retakeToCamera}
          onClose={closeScanner}
        />
      )}

      {phase === "preview" && previewUrl && (
        <div className="absolute inset-0 flex max-h-[100dvh] flex-col bg-black text-white">
          <div
            className="shrink-0 px-5 pb-2"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">Preview</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              {activeSide === "front" ? "Scan Front" : "Scan Back"}
            </h3>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5">
            <div
              className="relative max-h-full w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black"
              style={{
                aspectRatio: scanTypeConfig[scanType].guideAspect,
                maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 11rem)",
              }}
            >
              <ArcaImage src={previewUrl} alt={`${activeSide} capture preview`} className="h-full w-full object-contain" />
            </div>
          </div>

          <div
            className="shrink-0 grid grid-cols-2 gap-3 border-t border-white/10 bg-black/90 p-4 backdrop-blur"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            <Button variant="secondary" size="lg" className="w-full" onClick={retakeToCamera}>Retake</Button>
            <Button size="lg" className="w-full" onClick={useResult}>
              {activeSide === "front" ? "Use Front" : "Use Back"}
            </Button>
          </div>
        </div>
      )}

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
  );

  return <ScannerPortal open={open}>{content}</ScannerPortal>;
}
