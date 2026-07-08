"use client";

import { acquireCameraStream } from "@/lib/scanner/cameraConstraints";

/** Canonical camera entry for Scanner.tsx — wraps progressive getUserMedia attempts. */
export async function startCameraStream(): Promise<MediaStream> {
  return acquireCameraStream();
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
