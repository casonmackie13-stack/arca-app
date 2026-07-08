import {
  emptySalesBundle,
  type PricingCardInput,
  type RecentSalesBundle,
  type SalesProviderResult,
} from "@/lib/pricing/types";

/**
 * Pricing data abstraction layer.
 *
 * A SalesProvider fetches recent real sales/comps for a card. No provider is
 * bundled yet, so pricing returns insufficient_data until one is connected.
 * To add a provider later, implement this interface and register it in
 * `getSalesProvider()` — nothing else in the pricing pipeline needs to change.
 *
 * IMPORTANT: providers must return only real observed sales. Never fabricate
 * sales data.
 */
export interface SalesProvider {
  name: string;
  fetchRecentSales(card: PricingCardInput): Promise<RecentSalesBundle>;
}

/**
 * Returns the configured sales provider, or null when none is connected.
 * A real provider requires both a name and credentials via env, e.g.
 * PRICING_PROVIDER + PRICING_PROVIDER_API_KEY.
 */
export function getSalesProvider(): SalesProvider | null {
  const providerName = process.env.PRICING_PROVIDER?.trim();
  const apiKey = process.env.PRICING_PROVIDER_API_KEY?.trim();
  if (!providerName || !apiKey) return null;

  // No concrete provider implementation is bundled yet. When integrating a
  // real sales source (e.g. a card marketplace sold-listings API), return an
  // object implementing SalesProvider here based on `providerName`.
  return null;
}

export function isSalesProviderConfigured(): boolean {
  return getSalesProvider() !== null;
}

export async function searchRecentSales(card: PricingCardInput): Promise<SalesProviderResult> {
  const provider = getSalesProvider();

  if (!provider) {
    return {
      provider: "none",
      configured: false,
      sales: emptySalesBundle(),
      warnings: [
        "No sales data provider is configured. Connect a recent-sales source to enable live pricing.",
      ],
    };
  }

  try {
    const sales = await provider.fetchRecentSales(card);
    return { provider: provider.name, configured: true, sales, warnings: [] };
  } catch (error) {
    console.warn("[ARCA Pricing] Sales provider lookup failed:", error);
    return {
      provider: provider.name,
      configured: true,
      sales: emptySalesBundle(),
      warnings: ["The sales provider could not be reached. Try again shortly."],
    };
  }
}
