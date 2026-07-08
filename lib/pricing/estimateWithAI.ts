import {
  cardLabel,
  type PricingBasis,
  type PricingCardInput,
  type PricingConfidence,
  type PricingSale,
  type RecentSalesBundle,
} from "@/lib/pricing/types";

export type PricingEstimate = {
  estimated_value_low: number | null;
  estimated_value_mid: number | null;
  estimated_value_high: number | null;
  confidence: PricingConfidence;
  notes: string;
};

/** Which sales set drives the estimate, and the resulting basis label. */
export function determinePricingBasis(
  card: PricingCardInput,
  sales: RecentSalesBundle,
): { basis: PricingBasis; primarySales: PricingSale[] } {
  if (card.is_graded) {
    if (sales.exact_grade.length > 0) return { basis: "exact_grade_sales", primarySales: sales.exact_grade };
    if (sales.similar_comps.length > 0) return { basis: "similar_comps", primarySales: sales.similar_comps };
    return { basis: "insufficient_data", primarySales: [] };
  }

  if (sales.raw.length > 0) return { basis: "recent_raw_sales", primarySales: sales.raw };
  if (sales.similar_comps.length > 0) return { basis: "similar_comps", primarySales: sales.similar_comps };
  return { basis: "insufficient_data", primarySales: [] };
}

function summarizePrices(sales: PricingSale[]): { low: number; mid: number; high: number } | null {
  const prices = sales.map((sale) => sale.price).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  return {
    low: Math.round(sorted[0]),
    mid: Math.round(mid),
    high: Math.round(sorted[sorted.length - 1]),
  };
}

function baselineConfidence(basis: PricingBasis, count: number): PricingConfidence {
  if (basis === "similar_comps") return "low";
  if (basis === "insufficient_data") return "low";
  if (count >= 5) return "high";
  if (count >= 3) return "medium";
  return "low";
}

/** Deterministic estimate used when AI is unavailable or fails. */
export function deterministicEstimate(
  basis: PricingBasis,
  primarySales: PricingSale[],
): PricingEstimate {
  const summary = summarizePrices(primarySales);
  const confidence = baselineConfidence(basis, primarySales.length);
  if (!summary) {
    return {
      estimated_value_low: null,
      estimated_value_mid: null,
      estimated_value_high: null,
      confidence: "low",
      notes: "No usable sales prices were available to compute an estimate.",
    };
  }
  const basisNote = basis === "similar_comps"
    ? "Estimate is a statistical summary of similar comparable sales (lower confidence)."
    : "Estimate is a statistical summary (median/range) of the recent sales shown.";
  return {
    estimated_value_low: summary.low,
    estimated_value_mid: summary.mid,
    estimated_value_high: summary.high,
    confidence,
    notes: basisNote,
  };
}

const PRICING_PROMPT =
  "You are estimating trading card market value using only the provided recent sales and comparable sales. Do not invent sales. If exact sales are unavailable, clearly state that the estimate is based on similar comps. Return JSON only.";

const METADATA_PRICING_PROMPT =
  "You are estimating the approximate market value of a trading card using only the provided card metadata. Do not invent specific recent sales. Do not claim that you found live comps. Give a cautious estimated USD range and a fair midpoint. If metadata is incomplete, lower confidence and explain what is missing. Return JSON only.";

const estimateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["estimated_value_low", "estimated_value_mid", "estimated_value_high", "confidence", "notes"],
  properties: {
    estimated_value_low: { type: ["number", "null"] },
    estimated_value_mid: { type: ["number", "null"] },
    estimated_value_high: { type: ["number", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
} as const;

function outputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) if (typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
  }
  return "";
}

function coerceEstimate(raw: unknown): PricingEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const num = (input: unknown): number | null => (typeof input === "number" && Number.isFinite(input) ? input : null);
  const confidence = value.confidence;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") return null;
  return {
    estimated_value_low: num(value.estimated_value_low),
    estimated_value_mid: num(value.estimated_value_mid),
    estimated_value_high: num(value.estimated_value_high),
    confidence,
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

/**
 * OpenAI-only metadata estimate when no live sales provider is connected.
 * Does not fabricate sales or claim verified comps.
 */
export async function estimateFromMetadataWithAI(
  card: PricingCardInput,
): Promise<{ estimate: PricingEstimate; warning?: string }> {
  const emptyEstimate: PricingEstimate = {
    estimated_value_low: null,
    estimated_value_mid: null,
    estimated_value_high: null,
    confidence: "low",
    notes: "AI pricing is not configured. Enter an estimate manually.",
  };

  if (!process.env.OPENAI_API_KEY) {
    return { estimate: emptyEstimate, warning: "OPENAI_API_KEY is not configured." };
  }

  try {
    const promptContext = {
      card: {
        label: cardLabel(card),
        player_name: card.player_name,
        sport: card.sport,
        year: card.year,
        brand: card.brand,
        set_name: card.set_name,
        card_number: card.card_number,
        parallel: card.parallel,
        rookie_card: card.rookie_card,
        serial_number: card.serial_number,
        condition: card.condition,
        grading_company: card.grading_company,
        grade: card.grade,
        is_graded: card.is_graded,
      },
      instructions: card.is_graded
        ? "This card is graded. Estimate based on grading company and exact grade from metadata. Be cautious — no live sales are available."
        : "This card is raw/ungraded. Estimate raw market value from metadata. Be cautious — no live sales are available.",
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PRICING_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: METADATA_PRICING_PROMPT },
          { role: "user", content: `Estimate approximate market value from metadata only. Return JSON only.\n\n${JSON.stringify(promptContext)}` },
        ],
        text: { format: { type: "json_schema", name: "arca_metadata_price_estimate", strict: true, schema: estimateSchema } },
        temperature: 0.2,
      }),
    });

    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      console.warn("[ARCA Pricing] Metadata AI request failed:", payload);
      return {
        estimate: { ...emptyEstimate, notes: "AI price estimation failed. Enter an estimate manually." },
        warning: "AI estimation request failed.",
      };
    }

    const parsed = coerceEstimate(JSON.parse(outputText(payload)));
    if (!parsed) {
      return {
        estimate: { ...emptyEstimate, notes: "AI returned an unexpected response. Enter an estimate manually." },
        warning: "AI returned an unexpected response.",
      };
    }

    // Without verified sales, cap confidence at medium.
    const confidence: PricingConfidence = parsed.confidence === "high" ? "medium" : parsed.confidence;
    return {
      estimate: {
        ...parsed,
        confidence,
        notes: parsed.notes || "AI-estimated from card metadata. No verified recent sales were used.",
      },
    };
  } catch (error) {
    console.warn("[ARCA Pricing] Metadata AI estimation error:", error);
    return {
      estimate: { ...emptyEstimate, notes: "AI price estimation failed. Enter an estimate manually." },
      warning: "AI estimation failed.",
    };
  }
}

/**
 * Interpret the provided sales/comps with OpenAI and produce a fair value
 * range + confidence. The model only interprets supplied sales; it never
 * invents them. Falls back to a deterministic summary if AI is unavailable.
 */
export async function estimateWithAI(
  card: PricingCardInput,
  sales: RecentSalesBundle,
  basis: PricingBasis,
  primarySales: PricingSale[],
): Promise<{ estimate: PricingEstimate; usedAI: boolean; warning?: string }> {
  const fallback = deterministicEstimate(basis, primarySales);

  if (!process.env.OPENAI_API_KEY) {
    return { estimate: fallback, usedAI: false, warning: "AI estimation is not configured; showing a statistical summary." };
  }

  try {
    const promptContext = {
      card: {
        label: cardLabel(card),
        player_name: card.player_name,
        sport: card.sport,
        year: card.year,
        brand: card.brand,
        set_name: card.set_name,
        card_number: card.card_number,
        parallel: card.parallel,
        rookie_card: card.rookie_card,
        serial_number: card.serial_number,
        grading_company: card.grading_company,
        grade: card.grade,
        is_graded: card.is_graded,
      },
      pricing_basis: basis,
      instructions: card.is_graded
        ? "This is a graded card. Prefer exact grading company + grade sales only. If exact-grade sales are missing, use similar comps (nearby grades, same player/set/card) and clearly note the estimate is comp-based."
        : "This is a raw/ungraded card. Estimate primarily from recent raw sales. PSA 9 and PSA 10 sales are context only and must not be mixed into the raw estimate unless no raw sales exist. If no raw sales exist, estimate from similar comps and note it.",
      recent_sales: sales,
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PRICING_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: PRICING_PROMPT },
          { role: "user", content: `Estimate the fair market value for this card using only the provided sales. Return JSON only.\n\n${JSON.stringify(promptContext)}` },
        ],
        text: { format: { type: "json_schema", name: "arca_price_estimate", strict: true, schema: estimateSchema } },
        temperature: 0.1,
      }),
    });

    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      return { estimate: fallback, usedAI: false, warning: "AI estimation failed; showing a statistical summary." };
    }

    const parsed = coerceEstimate(JSON.parse(outputText(payload)));
    if (!parsed) {
      return { estimate: fallback, usedAI: false, warning: "AI returned an unexpected response; showing a statistical summary." };
    }

    return { estimate: parsed, usedAI: true };
  } catch (error) {
    console.warn("[ARCA Pricing] AI estimation error:", error);
    return { estimate: fallback, usedAI: false, warning: "AI estimation failed; showing a statistical summary." };
  }
}
