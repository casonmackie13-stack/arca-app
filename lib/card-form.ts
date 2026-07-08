import type { CardSummary } from "@/lib/types";
import { cardYearValidationMessage, normalizeCardYear } from "@/lib/card-year";

export type CardFormValue = {
  playerName: string;
  sport: string;
  year: string;
  brand: string;
  setName: string;
  cardNumber: string;
  team: string;
  parallel: string;
  rookieCard: "unknown" | "yes" | "no";
  serialNumber: string;
  condition: string;
  grader: string;
  grade: string;
  estimatedValue: string;
  status: string;
  notes: string;
};

export const emptyCardForm: CardFormValue = { playerName: "", sport: "Basketball", year: "", brand: "", setName: "", cardNumber: "", team: "", parallel: "", rookieCard: "unknown", serialNumber: "", condition: "", grader: "Raw", grade: "", estimatedValue: "", status: "personal_collection", notes: "" };

export function cardToForm(card: CardSummary): CardFormValue {
  return { playerName: card.player_name || "", sport: card.sport || "Basketball", year: card.year == null ? "" : normalizeCardYear(String(card.year)), brand: card.brand || "", setName: card.set_name || "", cardNumber: card.card_number || "", team: card.team || "", parallel: card.parallel || "", rookieCard: card.rookie_card == null ? "unknown" : card.rookie_card ? "yes" : "no", serialNumber: card.serial_number || "", condition: card.condition || "", grader: card.grader || "Raw", grade: card.grade === "Raw" ? "" : card.grade || "", estimatedValue: card.estimated_value == null ? "" : String(card.estimated_value), status: card.status || "personal_collection", notes: card.notes || "" };
}

export function validateCardForm(value: CardFormValue, imageFile?: File | null) {
  const identityError = validateCardIdentity(value);
  if (identityError) return identityError;
  const gradingError = validateCardGrading(value);
  if (gradingError) return gradingError;
  const valueError = validateCardValue(value);
  if (valueError) return valueError;
  if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 10 * 1024 * 1024)) return "Choose an image file no larger than 10 MB.";
  return "";
}

export function validateRequiredCardImage(imageFile?: File | null) {
  if (!imageFile) return "A card image is required.";
  if (!imageFile.type.startsWith("image/") || imageFile.size > 10 * 1024 * 1024) return "Choose an image file no larger than 10 MB.";
  return "";
}

export function validateOptionalCardImage(imageFile?: File | null) {
  if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 10 * 1024 * 1024)) return "Choose an image file no larger than 10 MB.";
  return "";
}

export function validateCardIdentity(value: CardFormValue) {
  if (!value.playerName.trim()) return "Player or subject name is required.";
  const yearError = cardYearValidationMessage(value.year);
  if (yearError) return yearError;
  return "";
}

export function validateCardGrading(value: CardFormValue) {
  if (value.grader !== "Raw" && !value.grade.trim()) return "Grade is required when a grading company is selected.";
  return "";
}

export function validateCardValue(value: CardFormValue) {
  const estimatedValue = value.estimatedValue.replace(/[$,]/g, "").trim();
  if (estimatedValue && (!Number.isFinite(Number(estimatedValue)) || Number(estimatedValue) < 0)) return "Estimated value must be a nonnegative number.";
  return "";
}

export function cardMutation(value: CardFormValue) {
  const estimatedValue = value.estimatedValue.replace(/[$,]/g, "").trim();
  const normalizedYear = normalizeCardYear(value.year);
  const parsedEstimate = estimatedValue ? Number(estimatedValue) : null;
  const safeEstimate = parsedEstimate != null && Number.isFinite(parsedEstimate) && parsedEstimate >= 0
    ? parsedEstimate
    : null;
  return {
    player_name: value.playerName.trim(),
    sport: value.sport,
    year: normalizedYear || null,
    brand: value.brand.trim() || null,
    set_name: value.setName.trim() || null,
    card_number: value.cardNumber.trim() || null,
    team: value.team.trim() || null,
    parallel: value.parallel.trim() || null,
    rookie_card: value.rookieCard === "unknown" ? null : value.rookieCard === "yes",
    serial_number: value.serialNumber.trim() || null,
    condition: value.condition.trim() || null,
    grader: value.grader,
    grade: value.grader === "Raw" ? "Raw" : value.grade.trim() || null,
    estimated_value: safeEstimate,
    status: value.status,
    notes: value.notes.trim() || null,
  };
}

function stripUndefined<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

/** Safe insert payload — known columns only, no undefined, empty strings → null. */
export function buildCardInsertPayload(
  value: CardFormValue,
  extras: {
    owner_id: string;
    collection_id: string;
    original_image_url: string;
    front_image_url: string;
    back_image_url: string | null;
    original_front_image_url: string;
    original_back_image_url: string | null;
    display_image_url: string;
    image_source: string;
    image_source_url: string | null;
    image_replacement_status: string;
  },
) {
  return stripUndefined({ ...cardMutation(value), ...extras });
}
