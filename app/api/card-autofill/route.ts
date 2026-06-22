import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import { isAutofillResponse, type CardAutofillRequest } from "@/lib/card-intelligence";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = { type: "object", additionalProperties: false, required: ["card","sales_query"], properties: {
  card: { type: "object", additionalProperties: false, required: ["player_name","sport","year","brand","set_name","card_number","team","parallel","rookie_card","serial_number","grade_company","grade","condition","estimated_value","notes","confidence"], properties: {
    player_name:{type:"string"}, sport:{type:"string"}, year:{type:"string"}, brand:{type:"string"}, set_name:{type:"string"}, card_number:{type:"string"}, team:{type:"string"}, parallel:{type:"string"}, rookie_card:{type:"boolean"}, serial_number:{type:"string"}, grade_company:{type:"string"}, grade:{type:"string"}, condition:{type:"string"}, estimated_value:{type:"string"}, notes:{type:"string"}, confidence:{type:"number",minimum:0,maximum:1}
  }}, sales_query:{type:"string"}
}};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) for (const content of Array.isArray((item as {content?:unknown[]}).content) ? (item as {content:unknown[]}).content : []) {
    const text = (content as {text?:unknown}).text; if (typeof text === "string") return text;
  }
  return "";
}

export async function POST(request: Request) {
  const auth = await authenticatedServerClient(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Card autofill is not configured." }, { status: 503 });
  try {
    const body = await request.json() as CardAutofillRequest;
    const supplied = [body.image_url, body.image_base64].filter(Boolean);
    if (supplied.length !== 1) return NextResponse.json({ error: "Provide exactly one card image." }, { status: 400 });
    let image = body.image_base64 || body.image_url || "";
    if (body.image_base64) {
      const dataUrl = /^data:image\/(jpeg|png|webp);base64,/i.test(body.image_base64);
      const rawBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(body.image_base64);
      if ((!dataUrl && !rawBase64) || body.image_base64.length > 5_500_000) return NextResponse.json({ error: "Invalid or oversized image." }, { status: 413 });
      if (!dataUrl) image = `data:${body.image_mime_type || "image/jpeg"};base64,${body.image_base64}`;
    }
    if (body.image_url) {
      const url = new URL(body.image_url);
      if (url.protocol !== "https:") return NextResponse.json({ error: "Image URL must use HTTPS." }, { status: 400 });
    }
    const ai = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" }, body:JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input:[{ role:"user", content:[{type:"input_text",text:"Analyze this trading card image. Extract visible and reasonably inferable metadata. Use empty strings when uncertain; do not guess wildly. Carefully distinguish parallels, serial numbering, grading, and raw condition. Produce a concise sold-sales search query."},{type:"input_image",image_url:image,detail:"high"}]}],
      text:{format:{type:"json_schema",name:"arca_card_autofill",strict:true,schema}}, temperature:0.1
    }) });
    const payload = await ai.json() as Record<string, unknown>;
    if (!ai.ok) return NextResponse.json({ error: "Couldn’t autofill this card. Enter details manually." }, { status: 502 });
    const parsed = JSON.parse(outputText(payload)) as unknown;
    if (!isAutofillResponse(parsed)) throw new Error("Invalid structured output");
    let trainingEventId: string | null = null;
    const { data } = await auth.client.from("card_training_events").insert({ user_id:auth.user.id, original_image_path:body.archive_path || null, ai_extracted_json:parsed.card, sales_query:parsed.sales_query, confidence:parsed.card.confidence, source:"openai_vision", training_eligible:false }).select("id").maybeSingle();
    trainingEventId = data?.id || null;
    return NextResponse.json({ ...parsed, training_event_id: trainingEventId, archive_path: body.archive_path || null });
  } catch { return NextResponse.json({ error: "Couldn’t autofill this card. Enter details manually." }, { status: 500 }); }
}
