import type { AutofillCard, CardSalesResponse, SaleResult } from "@/lib/card-intelligence";

const normalized = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
const isRaw = (company: unknown, grade: unknown) => ["", "raw", "ungraded"].includes(normalized(company)) && ["", "raw", "ungraded"].includes(normalized(grade));

export function salePrice(sale: SaleResult) {
  if (normalized(sale.currency) !== "usd") return null;
  const value = Number(sale.price.replace(/[$,\s]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function comparableSales(card: AutofillCard, sales: SaleResult[]) {
  const identityKeys = ["player_name", "year", "brand", "set_name", "card_number"] as const;
  const targetIsRaw = isRaw(card.grade_company, card.grade);
  let matches = sales.filter((sale) => {
    if (identityKeys.some((key) => !normalized(card[key]) || normalized(card[key]) !== normalized(sale[key]))) return false;
    if (normalized(card.parallel) !== normalized(sale.parallel)) return false;
    if (targetIsRaw !== isRaw(sale.grade_company, sale.grade)) return false;
    if (!targetIsRaw && (normalized(card.grade_company) !== normalized(sale.grade_company) || normalized(card.grade) !== normalized(sale.grade))) return false;
    return salePrice(sale) !== null;
  });
  const exactCondition = normalized(card.condition) && matches.filter((sale) => normalized(sale.condition) === normalized(card.condition));
  if (exactCondition && exactCondition.length) matches = exactCondition;
  return matches.sort((a, b) => (Date.parse(b.sale_date) || 0) - (Date.parse(a.sale_date) || 0));
}

export function summarizeComparableSales(card: AutofillCard, sales: SaleResult[], suggestedQuery: string): CardSalesResponse {
  const valid = comparableSales(card, sales);
  const prices = valid.map(salePrice).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!prices.length) return { available: true, message: "No close matching sale found. Estimate left blank.", suggested_query: suggestedQuery, sales: [], closest_sale: null };
  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  return { available: true, suggested_query: suggestedQuery, sales: valid, average, median, closest_sale: valid[0] };
}
