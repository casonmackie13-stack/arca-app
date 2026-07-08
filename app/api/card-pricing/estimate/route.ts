import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import { searchRecentSales } from "@/lib/pricing/searchRecentSales";
import { determinePricingBasis, estimateFromMetadataWithAI, estimateWithAI } from "@/lib/pricing/estimateWithAI";
import {
  emptySalesBundle,
  normalizePricingCard,
  totalSalesCount,
  type PriceEstimateResponse,
} from "@/lib/pricing/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const NO_SALES_WARNING =
  "No live recent sales provider connected. Estimate is based on AI reasoning, not verified recent sales.";

/**
 * AI-assisted price estimation — additive post-autofill pipeline.
 * When no sales provider is connected, uses OpenAI metadata-only estimation.
 */
export async function POST(request: Request) {
  const auth = await authenticatedServerClient(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let card;
  try {
    const body = await request.json() as { card?: unknown };
    card = normalizePricingCard(body.card);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!card) {
    return NextResponse.json({ error: "A card with at least a player/subject name is required." }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();

  try {
    const provider = await searchRecentSales(card);
    const hasLiveSales = provider.configured && totalSalesCount(provider.sales) > 0;

    // Live sales provider with data — interpret verified sales with AI.
    if (hasLiveSales) {
      const { basis, primarySales } = determinePricingBasis(card, provider.sales);
      const { estimate, usedAI, warning } = await estimateWithAI(card, provider.sales, basis, primarySales);
      const confidence = basis === "similar_comps" && estimate.confidence !== "low" ? "low" : estimate.confidence;
      const warnings = [...provider.warnings];
      if (warning) warnings.push(warning);
      if (!usedAI) warnings.push("This estimate was computed statistically without AI interpretation.");

      const response: PriceEstimateResponse = {
        estimated_value_low: estimate.estimated_value_low,
        estimated_value_mid: estimate.estimated_value_mid,
        estimated_value_high: estimate.estimated_value_high,
        currency: "USD",
        confidence,
        pricing_basis: basis,
        notes: estimate.notes,
        recent_sales: provider.sales,
        warnings,
        provider: provider.provider,
        generated_at: generatedAt,
      };
      return NextResponse.json(response);
    }

    // No live sales — OpenAI metadata-only estimate.
    const { estimate, warning } = await estimateFromMetadataWithAI(card);
    const warnings = [NO_SALES_WARNING];
    if (warning) warnings.push(warning);

    const response: PriceEstimateResponse = {
      estimated_value_low: estimate.estimated_value_low,
      estimated_value_mid: estimate.estimated_value_mid,
      estimated_value_high: estimate.estimated_value_high,
      currency: "USD",
      confidence: estimate.confidence,
      pricing_basis: "ai_metadata_estimate",
      notes: estimate.notes || "No live recent sales provider connected yet. This estimate is based on AI market reasoning from card metadata and similar general comps.",
      recent_sales: emptySalesBundle(),
      warnings,
      provider: "openai_metadata",
      generated_at: generatedAt,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.warn("[ARCA Pricing] Estimate route failed:", error);
    const response: PriceEstimateResponse = {
      estimated_value_low: null,
      estimated_value_mid: null,
      estimated_value_high: null,
      currency: "USD",
      confidence: "low",
      pricing_basis: "insufficient_data",
      notes: "Price estimation is temporarily unavailable. You can still enter an estimate manually.",
      recent_sales: emptySalesBundle(),
      warnings: ["Pricing service error."],
      provider: "none",
      generated_at: generatedAt,
    };
    return NextResponse.json(response);
  }
}
