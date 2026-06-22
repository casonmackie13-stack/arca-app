import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import { normalizeCardDetection, type CardDetectionApiRequest } from "@/lib/image-processing/cardDetection";

export const runtime = "nodejs";
export const maxDuration = 30;

type VisionContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" };

const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "boundary", "confidence", "multipleCards", "quality", "feedback"],
  properties: {
    classification: { type: "string", enum: ["raw-card", "psa-slab", "bgs-slab", "sgc-slab", "unknown-slab", "multiple-cards", "poor-quality"] },
    boundary: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["left", "top", "right", "bottom", "type", "confidence"],
          properties: {
            left: { type: "number", minimum: 0, maximum: 1 },
            top: { type: "number", minimum: 0, maximum: 1 },
            right: { type: "number", minimum: 0, maximum: 1 },
            bottom: { type: "number", minimum: 0, maximum: 1 },
            type: { type: "string", enum: ["raw-card", "graded-slab"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        { type: "null" },
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    multipleCards: { type: "boolean" },
    quality: {
      type: "object",
      additionalProperties: false,
      required: ["blurry", "lowLighting", "extremeTilt", "partialCardVisibility", "issues"],
      properties: {
        blurry: { type: "boolean" },
        lowLighting: { type: "boolean" },
        extremeTilt: { type: "boolean" },
        partialCardVisibility: { type: "boolean" },
        issues: { type: "array", items: { type: "string", enum: ["blurry", "low-lighting", "extreme-tilt", "partial-card-visibility"] } },
      },
    },
    feedback: { type: "array", items: { type: "string" } },
  },
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) if (typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
  }
  return "";
}

function normalizeImage(value: string, mimeType: string) {
  const dataUrl = /^data:image\/(jpeg|png|webp);base64,/i.test(value);
  const rawBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  if (dataUrl || rawBase64) {
    if (value.length > 5_500_000) throw new Error("Image is too large.");
    return dataUrl ? value : `data:${mimeType};base64,${value}`;
  }
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Image URL must use HTTPS.");
  return url.toString();
}

export async function POST(request: Request) {
  const auth = await authenticatedServerClient(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI boundary detection is not configured." }, { status: 503 });

  try {
    const body = await request.json() as CardDetectionApiRequest;
    if (!body.image_base64) return NextResponse.json({ error: "Provide a card image." }, { status: 400 });
    const image = normalizeImage(body.image_base64, body.image_mime_type || "image/jpeg");
    const content: VisionContent[] = [
      {
        type: "input_text",
        text: [
          "Analyze this trading card upload for ARCA's premium 3D rendering pipeline.",
          "Classify exactly one of: raw-card, psa-slab, bgs-slab, sgc-slab, unknown-slab, multiple-cards, poor-quality.",
          "Estimate the visible object boundary in normalized image coordinates from 0 to 1.",
          "For raw cards, boundary must follow the actual cardboard card edges and preserve printed borders.",
          "For graded slabs, boundary must include the full slab, grading label, and outer plastic edges.",
          "Do not use generic aspect ratio boxes when a card/slab edge is visible.",
          "If multiple cards are visible, set classification multiple-cards, multipleCards true, and boundary null.",
          "Detect blurry images, low lighting, extreme tilt, and partial card visibility.",
          "Return short user-friendly feedback strings only.",
        ].join(" "),
      },
      { type: "input_image", image_url: image, detail: "high" },
    ];

    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "arca_card_detection", strict: true, schema } },
        temperature: 0.1,
      }),
    });
    const payload = await ai.json() as Record<string, unknown>;
    if (!ai.ok) return NextResponse.json({ error: "AI boundary detection failed." }, { status: 502 });
    const parsed = JSON.parse(outputText(payload)) as unknown;
    return NextResponse.json({ ...normalizeCardDetection(parsed, "openai"), source: "openai", model });
  } catch {
    return NextResponse.json({ error: "AI boundary detection failed." }, { status: 500 });
  }
}
