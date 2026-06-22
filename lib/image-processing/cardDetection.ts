export type CardImageClass =
  | "raw-card"
  | "psa-slab"
  | "bgs-slab"
  | "sgc-slab"
  | "unknown-slab"
  | "multiple-cards"
  | "poor-quality";

export type CardBoundaryType = "raw-card" | "graded-slab";

export type CardBoundary = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  type: CardBoundaryType;
  confidence: number;
};

export type CardQualityIssue = "blurry" | "low-lighting" | "extreme-tilt" | "partial-card-visibility";

export type CardQuality = {
  blurry: boolean;
  lowLighting: boolean;
  extremeTilt: boolean;
  partialCardVisibility: boolean;
  issues: CardQualityIssue[];
};

export type CardDetectionSource = "openai" | "fallback";

export type CardDetectionAnalysis = {
  classification: CardImageClass;
  boundary: CardBoundary | null;
  confidence: number;
  multipleCards: boolean;
  quality: CardQuality;
  feedback: string[];
  source: CardDetectionSource;
  model?: string;
  error?: string;
};

export type CardDetectionApiRequest = {
  image_base64: string;
  image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
};

const classes: CardImageClass[] = ["raw-card", "psa-slab", "bgs-slab", "sgc-slab", "unknown-slab", "multiple-cards", "poor-quality"];
const issueNames: CardQualityIssue[] = ["blurry", "low-lighting", "extreme-tilt", "partial-card-visibility"];

async function sessionToken() {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw error || new Error("Please sign in again.");
  return data.session.access_token;
}

function clamp(value: unknown, fallback: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, next));
}

function isCardClass(value: unknown): value is CardImageClass {
  return typeof value === "string" && classes.includes(value as CardImageClass);
}

function isIssue(value: unknown): value is CardQualityIssue {
  return typeof value === "string" && issueNames.includes(value as CardQualityIssue);
}

export function isGradedSlabClass(value: CardImageClass) {
  return value === "psa-slab" || value === "bgs-slab" || value === "sgc-slab" || value === "unknown-slab";
}

export function normalizeCardDetection(value: unknown, source: CardDetectionSource = "openai"): CardDetectionAnalysis {
  if (!value || typeof value !== "object") return fallbackCardDetection(undefined, "AI analysis returned an unreadable result.");
  const record = value as Record<string, unknown>;
  const classification = isCardClass(record.classification) ? record.classification : "poor-quality";
  const qualityRecord = record.quality && typeof record.quality === "object" ? record.quality as Record<string, unknown> : {};
  const issues = Array.isArray(qualityRecord.issues) ? qualityRecord.issues.filter(isIssue) : [];
  const quality: CardQuality = {
    blurry: Boolean(qualityRecord.blurry) || issues.includes("blurry"),
    lowLighting: Boolean(qualityRecord.lowLighting) || issues.includes("low-lighting"),
    extremeTilt: Boolean(qualityRecord.extremeTilt) || issues.includes("extreme-tilt"),
    partialCardVisibility: Boolean(qualityRecord.partialCardVisibility) || issues.includes("partial-card-visibility"),
    issues,
  };
  quality.issues = issueNames.filter((issue) => {
    if (issue === "blurry") return quality.blurry;
    if (issue === "low-lighting") return quality.lowLighting;
    if (issue === "extreme-tilt") return quality.extremeTilt;
    return quality.partialCardVisibility;
  });

  const rawBoundary = record.boundary && typeof record.boundary === "object" ? record.boundary as Record<string, unknown> : null;
  const boundaryType: CardBoundaryType = isGradedSlabClass(classification) ? "graded-slab" : "raw-card";
  const boundary = rawBoundary ? normalizeBoundary(rawBoundary, boundaryType) : null;
  const feedback = Array.isArray(record.feedback) ? record.feedback.filter((item): item is string => typeof item === "string") : [];

  return {
    classification,
    boundary,
    confidence: clamp(record.confidence, boundary?.confidence ?? 0.5),
    multipleCards: Boolean(record.multipleCards) || classification === "multiple-cards",
    quality,
    feedback: feedback.length ? feedback : cardDetectionFeedback({ classification, boundary, confidence: 0.5, multipleCards: classification === "multiple-cards", quality, feedback: [], source }),
    source,
    model: typeof record.model === "string" ? record.model : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

export function normalizeBoundary(value: Record<string, unknown>, type: CardBoundaryType): CardBoundary {
  let left = clamp(value.left, 0);
  let top = clamp(value.top, 0);
  let right = clamp(value.right, 1);
  let bottom = clamp(value.bottom, 1);
  if (right <= left) { left = 0; right = 1; }
  if (bottom <= top) { top = 0; bottom = 1; }
  return { left, top, right, bottom, type, confidence: clamp(value.confidence, 0.5) };
}

export function fallbackCardDetection(size?: { width: number; height: number }, error?: string): CardDetectionAnalysis {
  const ratio = size && size.height > 0 ? size.width / size.height : 0.714;
  const graded = ratio < 0.66;
  const classification: CardImageClass = graded ? "unknown-slab" : "raw-card";
  const boundary: CardBoundary = { left: 0, top: 0, right: 1, bottom: 1, type: graded ? "graded-slab" : "raw-card", confidence: 0.35 };
  const quality: CardQuality = { blurry: false, lowLighting: false, extremeTilt: false, partialCardVisibility: false, issues: [] };
  const analysis: CardDetectionAnalysis = {
    classification,
    boundary,
    confidence: 0.35,
    multipleCards: false,
    quality,
    feedback: [],
    source: "fallback",
    error,
  };
  analysis.feedback = cardDetectionFeedback(analysis);
  return analysis;
}

export function cardDetectionFeedback(analysis: CardDetectionAnalysis) {
  const feedback: string[] = [];
  if (analysis.multipleCards) feedback.push("We detected more than one card. Please photograph one card at a time.");
  if (analysis.quality.blurry) feedback.push("The image looks blurry. A sharper photo will create a better 3D preview.");
  if (analysis.quality.lowLighting) feedback.push("The image looks underlit. Try brighter, even lighting.");
  if (analysis.quality.extremeTilt) feedback.push("The card appears heavily tilted. A straighter photo will improve the crop.");
  if (analysis.quality.partialCardVisibility) feedback.push("Part of the card may be outside the frame. Capture the full card or slab.");
  if (analysis.source === "fallback") feedback.push("AI boundary detection was unavailable, so ARCA used centered formatting.");
  if (!feedback.length && analysis.boundary) {
    feedback.push(analysis.boundary.type === "graded-slab" ? "Slab detected. ARCA will preserve the full holder and label." : "Raw card detected. ARCA will crop to the card edges.");
  }
  return feedback;
}

async function imageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return undefined;
  }
}

export async function compressedImageDataUrl(file: File, maxDimension = 1600): Promise<string> {
  const fallback = () => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return fallback();
  }
}

export async function analyzeCardImage(file: File): Promise<CardDetectionAnalysis> {
  const size = await imageSize(file);
  try {
    const token = await sessionToken();
    const dataUrl = await compressedImageDataUrl(file);
    const response = await fetch("/api/card-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image_base64: dataUrl, image_mime_type: "image/jpeg" } satisfies CardDetectionApiRequest),
    });
    const payload = await response.json();
    if (!response.ok) return fallbackCardDetection(size, payload.error || "AI boundary detection failed.");
    return normalizeCardDetection(payload, payload.source === "fallback" ? "fallback" : "openai");
  } catch (cause) {
    return fallbackCardDetection(size, cause instanceof Error ? cause.message : "AI boundary detection failed.");
  }
}
