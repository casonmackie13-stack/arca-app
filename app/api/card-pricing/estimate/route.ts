import { NextResponse } from "next/server";
import { authenticatedServerClient } from "@/lib/server-auth";
import { searchRecentSales } from "@/lib/pricing/searchRecentSales";
import { determinePricingBasis, estimateWithAI } from "@/lib/pricing/estimateWithAI";
import {
  emptySalesBundle,
  normalizePricingCard,
  totalSalesCount,
  type PriceEstimateResponse,
} from "@/lib/pricing/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * AI-assisted price estimation. Runs AFTER card autofill as an additive
 * pipeline — it does not touch card identification/autofill. Fetches recent
 * sales/comps from the configured provider, then interprets them with AI.
 * Returns insufficient_data when no provider is configured or no sales exist.
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

    // No provider connected — be transparent, do not fabricate sales.
    if (!provider.configured) {
      const response: PriceEstimateResponse = {
        estimated_value_low: null,
        estimated_value_mid: null,
        estimated_value_high: null,
        currency: "USD",
        confidence: "low",
        pricing_basis: "insufficient_data",
        notes: "Live pricing is not connected yet, so no recent sales are available. Enter an estimate manually.",
        recent_sales: emptySalesBundle(),
        warnings: provider.warnings,
        provider: provider.provider,
        generated_at: generatedAt,
      };
      return NextResponse.json(response);
    }

    const { basis, primarySales } = determinePricingBasis(card, provider.sales);

    // Provider connected but returned nothing usable.
    if (basis === "insufficient_data" || totalSalesCount(provider.sales) === 0) {
      const notes = card.is_graded
        ? "No recent sales found for this exact grade. Estimate is based on similar comps."
        : "No recent raw sales found. Estimate is based on similar comps.";
      const response: PriceEstimateResponse = {
        estimated_value_low: null,
        estimated_value_mid: null,
        estimated_value_high: null,
        currency: "USD",
        confidence: "low",
        pricing_basis: "insufficient_data",
        notes: totalSalesCount(provider.sales) === 0 ? "No recent sales or comparable sales were found for this card." : notes,
        recent_sales: provider.sales,
        warnings: provider.warnings,
        provider: provider.provider,
        generated_at: generatedAt,
      };
      return NextResponse.json(response);
    }

    const { estimate, usedAI, warning } = await estimateWithAI(card, provider.sales, basis, primarySales);

    // Fallback estimates from similar comps are always lower-confidence.
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
