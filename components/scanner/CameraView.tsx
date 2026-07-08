"use client";

import { useEffect, useRef, type RefObject } from "react";
import { startCameraStream, stopCameraStream } from "@/lib/scanner/cameraService";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { CameraStatus } from "@/lib/scanner/scannerTypes";

const VIDEO_MOUNT_RETRY_MS = 50;
const VIDEO_MOUNT_MAX_ATTEMPTS = 40;

async function waitForVideoElement(videoRef: RefObject<HTMLVideoElement | null>) {
  for (let attempt = 0; attempt < VIDEO_MOUNT_MAX_ATTEMPTS; attempt += 1) {
    if (videoRef.current) return videoRef.current;
    await new Promise<void>((resolve) => window.setTimeout(resolve, VIDEO_MOUNT_RETRY_MS));
  }
  return null;
}

export default function CameraView({
  active,
  videoRef,
  onStatusChange,
  onReady,
  onError,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStatusChange?: (status: CameraStatus) => void;
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) {
      onStatusChange?.("idle");
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      return;
    }

    let alive = true;

    async function bootCamera() {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      onStatusChange?.("requesting");

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not available on this device.");
        }

        scanFlowLog("Requesting camera stream");
        const streamPromise = startCameraStream();
        const video = await waitForVideoElement(videoRef);
        const stream = await streamPromise;

        if (!alive) {
          stopCameraStream(stream);
          return;
        }

        if (!video) {
          stopCameraStream(stream);
          onStatusChange?.("failed");
          onError("Camera preview failed to start.");
          return;
        }

        streamRef.current = stream;
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
        onStatusChange?.("ready");
        onReady();
      } catch (cause) {
        if (!alive) return;
        onStatusChange?.("failed");
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
  }, [active, onError, onReady, onStatusChange, videoRef]);

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
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        visibility: active ? "visible" : "hidden",
      }}
    />
  );
}
