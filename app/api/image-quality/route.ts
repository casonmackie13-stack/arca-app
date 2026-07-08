import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import type { AiImageQualityResult } from "@/lib/scanner/scannerTypes";

export const runtime = "nodejs";
export const maxDuration = 30;

const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "blurry",
    "glare",
    "too_dark",
    "cropped_edges",
    "skewed",
    "text_readable",
    "overall_quality",
    "recommended_action",
  ],
  properties: {
    blurry: { type: "boolean" },
    glare: { type: "boolean" },
    too_dark: { type: "boolean" },
    cropped_edges: { type: "boolean" },
    skewed: { type: "boolean" },
    text_readable: { type: "boolean" },
    overall_quality: { type: "string", enum: ["poor", "acceptable", "excellent"] },
    recommended_action: { type: "string" },
  },
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

function normalizeImage(value: string, mimeType: string) {
  const dataUrl = /^data:image\/(jpeg|png|webp);base64,/i.test(value);
  const rawBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  if (dataUrl || rawBase64) {
    if (value.length > 1_200_000) throw new Error("Image is too large.");
    return dataUrl ? value : `data:${mimeType};base64,${value}`;
  }
  throw new Error("Invalid image payload.");
}

export async function POST(request: Request) {
  if (process.env.ENABLE_OPENAI_IMAGE_QA !== "true") {
    return NextResponse.json({ error: "Image quality QA is disabled." }, { status: 503 });
  }

  const auth = await authenticatedServerClient(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required." }, { status: 400 });
  }

  const mimeType = body.mimeType && /^image\/(jpeg|png|webp)$/i.test(body.mimeType)
    ? body.mimeType
    : "image/jpeg";

  let imageUrl: string;
  try {
    imageUrl = normalizeImage(body.imageBase64, mimeType);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Invalid image." },
      { status: 400 },
    );
  }

  const prompt = `You are a trading-card capture quality judge. Analyze this image only for capture quality. Do not identify the player unless needed for readability. Do not invent missing details. Do not suggest visual edits that recreate or alter the card. Return JSON with:
{
  blurry: boolean,
  glare: boolean,
  too_dark: boolean,
  cropped_edges: boolean,
  skewed: boolean,
  text_readable: boolean,
  overall_quality: 'poor' | 'acceptable' | 'excellent',
  recommended_action: string
}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl, detail: "low" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "card_capture_quality",
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: detail || "Quality analysis failed." }, { status: 502 });
  }

  const payload = await response.json() as Record<string, unknown>;
  const text = outputText(payload);
  let quality: AiImageQualityResult;
  try {
    quality = JSON.parse(text) as AiImageQualityResult;
  } catch {
    return NextResponse.json({ error: "Quality analysis returned invalid JSON." }, { status: 502 });
  }

  return NextResponse.json({ quality });
}
