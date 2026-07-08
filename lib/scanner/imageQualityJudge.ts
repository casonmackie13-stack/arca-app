import type { AiImageQualityResult } from "@/lib/scanner/scannerTypes";

export type ImageQualityJudgeRequest = {
  imageBase64: string;
  mimeType?: string;
};

const qualityCache = new Map<string, AiImageQualityResult>();

function cacheKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function isOpenAiImageQaEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_OPENAI_IMAGE_QA === "true";
}

export async function judgeImageQuality(
  file: File,
  options?: { force?: boolean },
): Promise<AiImageQualityResult | null> {
  if (!isOpenAiImageQaEnabled()) return null;

  const key = cacheKey(file);
  if (!options?.force && qualityCache.has(key)) {
    return qualityCache.get(key) ?? null;
  }

  const preview = await fileToPreviewBase64(file, 512);
  const response = await fetch("/api/image-quality", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: preview.base64,
      mimeType: preview.mimeType,
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json() as { quality?: AiImageQualityResult };
  if (!payload.quality) return null;

  qualityCache.set(key, payload.quality);
  return payload.quality;
}

async function fileToPreviewBase64(file: File, maxWidth: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not encode preview."));
    }, mimeType, 0.82);
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mimeType };
}

export function shouldRequestAiQuality(
  badge: "poor" | "good" | "excellent",
): boolean {
  return badge === "poor" || badge === "good";
}

export function aiQualityToBadge(quality: AiImageQualityResult): "poor" | "good" | "excellent" {
  if (quality.overall_quality === "excellent") return "excellent";
  if (quality.overall_quality === "acceptable") return "good";
  return "poor";
}
