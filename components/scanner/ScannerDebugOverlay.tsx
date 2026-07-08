"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { scanTypeConfig } from "@/components/scanner/scanTypes";
import { ACTIVE_CAPTURE_FUNCTION } from "@/lib/scanner/captureProcessor";
import { domRectLike, mapGuideFrameToVideoCrop } from "@/lib/scanner/cropMapping";
import { isScannerDebugEnabled } from "@/lib/scanner/scannerDebug";
import type { OpenCvLoadState } from "@/lib/scanner/opencvLoader";
import type { CardEdgeDetection, ScanMetadata } from "@/lib/scanner/scanMetadata";
import type { ScanType } from "@/lib/scanner/scannerTypes";

export default function ScannerDebugOverlay({
  videoRef,
  guideFrameRef,
  scanType,
  activeSide,
  active,
  opencv = { status: "loading", error: null, loadMs: null },
  detection = null,
  autoCaptureBlockReason = null,
  captureMetadata = null,
  lastCaptureCrop,
  lastOutputSize,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  guideFrameRef: RefObject<HTMLDivElement | null>;
  scanType: ScanType;
  activeSide: "front" | "back";
  active: boolean;
  opencv?: OpenCvLoadState;
  detection?: CardEdgeDetection | null;
  autoCaptureBlockReason?: string | null;
  captureMetadata?: ScanMetadata | null;
  lastCaptureCrop?: string | null;
  lastOutputSize?: string | null;
}) {
  const [snapshot, setSnapshot] = useState("");

  useEffect(() => {
    if (!active || !isScannerDebugEnabled()) {
      setSnapshot("");
      return;
    }

    function update() {
      const video = videoRef.current;
      const guide = guideFrameRef.current;
      if (!video || !guide) return;

      const crop = mapGuideFrameToVideoCrop({
        guideFrameRect: domRectLike(guide.getBoundingClientRect()),
        videoDisplayRect: domRectLike(video.getBoundingClientRect()),
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });

      const config = scanTypeConfig[scanType];
      const guideRect = guide.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();

      setSnapshot([
        "scanner=canonical",
        `side=${activeSide}`,
        `captureFn=${ACTIVE_CAPTURE_FUNCTION}`,
        `scan=${scanType}`,
        `opencv=${opencv.status}${opencv.loadMs != null ? ` (${opencv.loadMs}ms)` : ""}`,
        opencv.error ? `opencvError=${opencv.error}` : "opencvError=none",
        `found=${detection?.found ? "yes" : "no"}`,
        `confidence=${detection?.confidence?.toFixed(3) ?? "0"}`,
        detection?.corners?.length ? `corners=${detection.corners.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ")}` : "corners=none",
        `autoBlock=${autoCaptureBlockReason ?? "none"}`,
        captureMetadata?.crop_method ? `lastCropMethod=${captureMetadata.crop_method}` : "lastCropMethod=none",
        captureMetadata?.crop_fallback_reason ? `lastFallback=${captureMetadata.crop_fallback_reason}` : "lastFallback=none",
        `frame=${Math.round(guideRect.width)}x${Math.round(guideRect.height)}`,
        `frameLeft=${Math.round(guideRect.left)}`,
        `frameTop=${Math.round(guideRect.top)}`,
        `videoSrc=${video.videoWidth}x${video.videoHeight}`,
        `videoCss=${Math.round(videoRect.width)}x${Math.round(videoRect.height)}`,
        `target=${config.guideAspect}`,
        `out=${config.output.width}x${config.output.height}`,
        crop
          ? `liveCrop=${Math.round(crop.sx)},${Math.round(crop.sy)},${Math.round(crop.sw)}x${Math.round(crop.sh)}`
          : "liveCrop=unavailable",
        lastCaptureCrop ? `lastCrop=${lastCaptureCrop}` : "lastCrop=none",
        lastOutputSize ? `lastOut=${lastOutputSize}` : "lastOut=none",
      ].join("\n"));
    }

    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
    };
  }, [
    active,
    activeSide,
    autoCaptureBlockReason,
    captureMetadata,
    detection,
    guideFrameRef,
    lastCaptureCrop,
    lastOutputSize,
    opencv,
    scanType,
    videoRef,
  ]);

  if (!active || !isScannerDebugEnabled() || !snapshot) return null;

  return (
    <pre
      className="pointer-events-none absolute left-3 z-30 max-w-[min(92vw,20rem)] whitespace-pre-wrap rounded-lg border border-red-500/40 bg-black/80 p-3 text-[10px] leading-5 text-red-100 backdrop-blur"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 7.5rem)" }}
    >
      {snapshot}
    </pre>
  );
}
