import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import { isAutofillResponse, type CardAutofillRequest } from "@/lib/card-intelligence";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = { type: "object", additionalProperties: false, required: ["card", "sales_query"], properties: {
  card: { type: "object", additionalProperties: false, required: ["player_name", "sport", "year", "brand", "set_name", "card_number", "team", "parallel", "rookie_card", "serial_number", "grade_company", "grade", "condition", "estimated_value", "notes", "confidence"], properties: {
    player_name: { type: "string" }, sport: { type: "string" }, year: { type: "string" }, brand: { type: "string" }, set_name: { type: "string" }, card_number: { type: "string" }, team: { type: "string" }, parallel: { type: "string" }, rookie_card: { type: "boolean" }, serial_number: { type: "string" }, grade_company: { type: "string" }, grade: { type: "string" }, condition: { type: "string" }, estimated_value: { type: "string" }, notes: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 },
  } }, sales_query: { type: "string" },
} };

type VisionContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" };

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
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Card autofill is not configured." }, { status: 503 });

  try {
    const body = await request.json() as CardAutofillRequest;
    const frontUrl = body.front_image_url || body.image_url;
    const frontBase64 = body.front_image_base64 || body.image_base64;
    if ([frontUrl, frontBase64].filter(Boolean).length !== 1) return NextResponse.json({ error: "Provide exactly one front card image." }, { status: 400 });
    if ([body.back_image_url, body.back_image_base64].filter(Boolean).length > 1) return NextResponse.json({ error: "Provide only one back card image source." }, { status: 400 });

    const front = normalizeImage(frontBase64 || frontUrl || "", body.front_image_mime_type || body.image_mime_type || "image/jpeg");
    const backSource = body.back_image_base64 || body.back_image_url;
    const back = backSource ? normalizeImage(backSource, body.back_image_mime_type || "image/jpeg") : null;
    const content: VisionContent[] = [
      { type: "input_text", text: "Analyze this trading card using the labeled images. FRONT is authoritative for player, team, brand, parallel or variant, design clues, and slab/grading information. BACK is authoritative for card number, copyright year, set/manufacturer text, stats/team details, and printed identifiers. Reconcile both views into one card. Use empty strings when uncertain and do not guess. estimated_value must always be an empty string; valuation comes only from verified comparable sales. Produce a concise sold-sales search query." },
      { type: "input_text", text: "FRONT IMAGE" },
      { type: "input_image", image_url: front, detail: "high" },
    ];
    if (body.front_ocr_text?.trim()) {
      content.push({ type: "input_text", text: `LOCAL OCR FRONT TEXT (may contain noise, use as hints only):\n${body.front_ocr_text.trim()}` });
    }
    if (back) content.push({ type: "input_text", text: "BACK IMAGE" }, { type: "input_image", image_url: back, detail: "high" });
    if (body.back_ocr_text?.trim()) {
      content.push({ type: "input_text", text: `LOCAL OCR BACK TEXT (may contain noise, use as hints only):\n${body.back_ocr_text.trim()}` });
    }
    if (body.scan_metadata && typeof body.scan_metadata === "object") {
      content.push({ type: "input_text", text: `SCAN METADATA (hints only): ${JSON.stringify(body.scan_metadata)}` });
    }

    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini", input: [{ role: "user", content }], text: { format: { type: "json_schema", name: "arca_card_autofill", strict: true, schema } }, temperature: 0.1 }),
    });
    const payload = await ai.json() as Record<string, unknown>;
    if (!ai.ok) return NextResponse.json({ error: "Couldn’t autofill this card. Enter details manually." }, { status: 502 });
    const parsed = JSON.parse(outputText(payload)) as unknown;
    if (!isAutofillResponse(parsed)) throw new Error("Invalid structured output");
    parsed.card.estimated_value = "";

    const frontArchivePath = body.front_archive_path || body.archive_path || null;
    const backArchivePath = body.back_archive_path || null;
    const { data } = await auth.client.from("card_training_events").insert({
      user_id: auth.user.id,
      original_image_path: frontArchivePath,
      original_front_image_path: frontArchivePath,
      original_back_image_path: backArchivePath,
      ai_extracted_json: parsed.card,
      sales_query: parsed.sales_query,
      confidence: parsed.card.confidence,
      source: back ? "openai_vision_front_back" : "openai_vision_front",
      training_eligible: false,
    }).select("id").maybeSingle();

    return NextResponse.json({ ...parsed, training_event_id: data?.id || null, front_archive_path: frontArchivePath, back_archive_path: backArchivePath });
  } catch {
    return NextResponse.json({ error: "Couldn’t autofill this card. Enter details manually." }, { status: 500 });
  }
}
