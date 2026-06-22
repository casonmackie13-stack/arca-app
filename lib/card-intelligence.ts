export type AutofillCard = {
  player_name: string; sport: string; year: string; brand: string; set_name: string;
  card_number: string; team: string; parallel: string; rookie_card: boolean;
  serial_number: string; grade_company: string; grade: string; condition: string;
  estimated_value: string; notes: string; confidence: number;
};

export type CardAutofillRequest = {
  front_image_url?: string;
  back_image_url?: string;
  front_image_base64?: string;
  back_image_base64?: string;
  front_image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
  back_image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
  front_archive_path?: string;
  back_archive_path?: string;
  /** Temporary compatibility aliases for the original front-only API. */
  image_url?: string;
  image_base64?: string;
  image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
  archive_path?: string;
};
export type CardAutofillResponse = { card: AutofillCard; sales_query: string; training_event_id?: string | null; front_archive_path?: string | null; back_archive_path?: string | null };
export type SaleResult = { title: string; price: string; currency: string; sale_date: string; source: string; sale_type: "auction" | "buy_it_now" | "best_offer" | "unknown"; condition: string; grade_company: string; grade: string; url: string; confidence: number; player_name?: string; year?: string; brand?: string; set_name?: string; card_number?: string; parallel?: string };
export type CardSalesResponse = { available: boolean; message?: string; suggested_query: string; sales: SaleResult[]; average?: number; median?: number; closest_sale?: SaleResult | null };
export type ImageSuggestion = { image_url: string; source: string; source_url: string; match_confidence: number; notes: string };
export type CardImageLookupResponse = { available: boolean; message?: string; suggestions: ImageSuggestion[] };

export const catalogueKeys = ["player_name","sport","year","brand","set_name","card_number","team","parallel","rookie_card","serial_number","grade_company","grade","condition","estimated_value","notes"] as const;

export function isAutofillResponse(value: unknown): value is CardAutofillResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (!response.card || typeof response.card !== "object" || typeof response.sales_query !== "string") return false;
  const card = response.card as Record<string, unknown>;
  const stringKeys = catalogueKeys.filter((key) => key !== "rookie_card");
  return stringKeys.every((key) => typeof card[key] === "string")
    && typeof card.rookie_card === "boolean"
    && typeof card.confidence === "number" && card.confidence >= 0 && card.confidence <= 1;
}
