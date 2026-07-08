"use client";

import { useEffect, useRef, type RefObject } from "react";
import { startCameraStream, stopCameraStream } from "@/lib/scanner/cameraService";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";

export default function CameraView({
  active,
  videoRef,
  onReady,
  onError,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      return;
    }

    let alive = true;

    async function bootCamera() {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not available on this device.");
        }
        const stream = await startCameraStream();
        if (!alive) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopCameraStream(stream);
          streamRef.current = null;
          onError("Camera preview failed to start.");
          return;
        }
        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          const onMetadata = () => {
            video.removeEventListener("loadedmetadata", onMetadata);
            resolve();
          };
          const onVideoError = () => {
            video.removeEventListener("error", onVideoError);
            reject(new Error("Camera failed to start."));
          };
          video.addEventListener("loadedmetadata", onMetadata);
          video.addEventListener("error", onVideoError);
          void video.play().catch(reject);
        });
        if (!alive) return;
        scanFlowLog("Video metadata loaded", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        onReady();
      } catch (cause) {
        if (!alive) return;
        const message = cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied."
          : cause instanceof Error ? cause.message : "Camera is unavailable.";
        onError(message);
      }
    }

    void bootCamera();
    return () => {
      alive = false;
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, [active, onError, onReady, videoRef]);

  if (!active) return null;

  return (
    <video
      ref={(node) => {
        videoRef.current = node;
        if (node) scanFlowLog("Video mounted");
      }}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 z-0 h-full w-full object-cover"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
