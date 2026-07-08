/**
 * Shared pricing types for ARCA AI-assisted price estimation.
 * This module is client-safe: pure types + pure helpers, no process.env,
 * no server-only imports. Server logic lives in searchRecentSales.ts and
 * estimateWithAI.ts.
 */

export type PricingCardInput = {
  player_name: string;
  sport: string;
  year: string;
  brand: string;
  set_name: string;
  card_number: string;
  parallel: string;
  rookie_card: boolean;
  serial_number: string;
  grading_company: string;
  grade: string;
  is_graded: boolean;
  condition: string;
};

export type PricingSale = {
  title: string;
  price: number;
  currency: string;
  sale_date: string;
  source: string;
  url: string;
  grading_company: string;
  grade: string;
  is_raw: boolean;
  note?: string;
};

export type PricingConfidence = "low" | "medium" | "high";

export type PricingBasis =
  | "recent_exact_sales"
  | "recent_raw_sales"
  | "exact_grade_sales"
  | "similar_comps"
  | "ai_metadata_estimate"
  | "insufficient_data";

export type RecentSalesBundle = {
  raw: PricingSale[];
  psa_9: PricingSale[];
  psa_10: PricingSale[];
  exact_grade: PricingSale[];
  similar_comps: PricingSale[];
};

export type SalesProviderResult = {
  provider: string;
  configured: boolean;
  sales: RecentSalesBundle;
  warnings: string[];
};

export type PriceEstimateResponse = {
  estimated_value_low: number | null;
  estimated_value_mid: number | null;
  estimated_value_high: number | null;
  currency: "USD";
  confidence: PricingConfidence;
  pricing_basis: PricingBasis;
  notes: string;
  recent_sales: RecentSalesBundle;
  warnings: string[];
  provider: string;
  generated_at: string;
};

export function emptySalesBundle(): RecentSalesBundle {
  return { raw: [], psa_9: [], psa_10: [], exact_grade: [], similar_comps: [] };
}

export function totalSalesCount(bundle: RecentSalesBundle): number {
  return (
    bundle.raw.length +
    bundle.psa_9.length +
    bundle.psa_10.length +
    bundle.exact_grade.length +
    bundle.similar_comps.length
  );
}

function toStringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Coerce arbitrary request input into a well-formed PricingCardInput. */
export function normalizePricingCard(raw: unknown): PricingCardInput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const player_name = toStringField(value.player_name).trim();
  if (!player_name) return null;

  const grading_company = toStringField(value.grading_company).trim();
  const grade = toStringField(value.grade).trim();
  const is_graded = typeof value.is_graded === "boolean"
    ? value.is_graded
    : Boolean(grading_company && grading_company.toLowerCase() !== "raw");

  return {
    player_name,
    sport: toStringField(value.sport).trim(),
    year: toStringField(value.year).trim(),
    brand: toStringField(value.brand).trim(),
    set_name: toStringField(value.set_name).trim(),
    card_number: toStringField(value.card_number).trim(),
    parallel: toStringField(value.parallel).trim(),
    rookie_card: value.rookie_card === true,
    serial_number: toStringField(value.serial_number).trim(),
    grading_company: is_graded ? grading_company : "",
    grade: is_graded ? grade : "",
    is_graded,
    condition: toStringField(value.condition).trim(),
  };
}

export function cardLabel(card: PricingCardInput): string {
  return [card.year, card.brand, card.set_name, card.player_name, card.card_number ? `#${card.card_number}` : "", card.parallel]
    .filter(Boolean)
    .join(" ");
}
