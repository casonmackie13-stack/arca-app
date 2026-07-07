"use client";

type VideoAdvanced = MediaTrackConstraintSet & Record<string, unknown>;

function buildAdvancedConstraints(): VideoAdvanced[] {
  const advanced: VideoAdvanced[] = [];

  const focusModes = ["continuous", "auto"];
  const exposureModes = ["continuous", "auto"];
  const whiteBalanceModes = ["continuous", "auto"];

  for (const focusMode of focusModes) {
    advanced.push({ focusMode } as VideoAdvanced);
  }
  for (const exposureMode of exposureModes) {
    advanced.push({ exposureMode } as VideoAdvanced);
  }
  for (const whiteBalanceMode of whiteBalanceModes) {
    advanced.push({ whiteBalanceMode } as VideoAdvanced);
  }

  return advanced;
}

const CAMERA_ATTEMPTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30 },
      advanced: buildAdvancedConstraints(),
    } as MediaTrackConstraints,
    audio: false,
  },
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
      advanced: buildAdvancedConstraints(),
    } as MediaTrackConstraints,
    audio: false,
  },
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  },
  {
    video: { facingMode: "environment" },
    audio: false,
  },
  {
    video: true,
    audio: false,
  },
];

export async function optimizeCameraTrack(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track?.applyConstraints) return;

  const advanced = buildAdvancedConstraints();
  for (const constraint of advanced) {
    try {
      await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
      return;
    } catch {
      // Browser may ignore unsupported advanced constraints.
    }
  }

  try {
    await track.applyConstraints({
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
  } catch {
    // Best-effort only.
  }
}

export async function acquireCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available on this device.");
  }

  let lastError: unknown = null;

  for (const constraints of CAMERA_ATTEMPTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await optimizeCameraTrack(stream);
      return stream;
    } catch (cause) {
      lastError = cause;
    }
  }

  if (lastError instanceof DOMException && lastError.name === "NotAllowedError") {
    throw new Error("Camera permission was denied.");
  }

  throw lastError instanceof Error ? lastError : new Error("Camera is unavailable.");
}
