import type { CardAutofillResponse, CardImageLookupResponse, CardSalesResponse } from "@/lib/card-intelligence";
import { createMobileSafeId } from "@/lib/mobile-id";
import { supabase } from "@/lib/supabase";

async function sessionToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw error || new Error("Please sign in again.");
  return data.session.access_token;
}

async function compressedDataUrl(file: File): Promise<string> {
  const fallback = () => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
  });
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    return canvas.toDataURL("image/jpeg", .82);
  } catch { return fallback(); }
}

export async function archiveOriginalImage(file: File, userId?: string) {
  const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${resolvedUserId}/${Date.now()}-${createMobileSafeId()}.${ext}`;
  const { error } = await supabase.storage.from("card_training_images").upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}

export async function autofillCardInfo(
  frontImage: File,
  backImage?: File | null,
  options?: { frontOcrText?: string; backOcrText?: string; scanMetadata?: Record<string, unknown> },
): Promise<CardAutofillResponse> {
  const token = await sessionToken();
  const user = (await supabase.auth.getUser()).data.user;
  const [frontArchivePath, backArchivePath, frontBase64, backBase64] = await Promise.all([
    archiveOriginalImage(frontImage, user?.id),
    backImage ? archiveOriginalImage(backImage, user?.id) : Promise.resolve(null),
    compressedDataUrl(frontImage),
    backImage ? compressedDataUrl(backImage) : Promise.resolve(null),
  ]);
  const response = await fetch("/api/card-autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      front_image_base64: frontBase64,
      back_image_base64: backBase64,
      front_archive_path: frontArchivePath,
      back_archive_path: backArchivePath,
      front_ocr_text: options?.frontOcrText,
      back_ocr_text: options?.backOcrText,
      scan_metadata: options?.scanMetadata,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Couldn’t autofill this card. Enter details manually.");
  return payload as CardAutofillResponse;
}

export async function fetchRecentSales(card: Record<string, unknown>, salesQuery: string): Promise<CardSalesResponse> {
  const token = await sessionToken();
  const response = await fetch("/api/card-sales", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ card, sales_query: salesQuery }) });
  const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Recent sales are unavailable."); return payload;
}

export async function lookupDisplayImage(card: Record<string, unknown>): Promise<CardImageLookupResponse> {
  const token = await sessionToken();
  const response = await fetch("/api/card-image-lookup", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ card }) });
  const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Better image lookup is unavailable."); return payload;
}
