import type { CardSummary } from "@/lib/types";

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
  return { playerName: card.player_name || "", sport: card.sport || "Basketball", year: card.year == null ? "" : String(card.year), brand: card.brand || "", setName: card.set_name || "", cardNumber: card.card_number || "", team: card.team || "", parallel: card.parallel || "", rookieCard: card.rookie_card == null ? "unknown" : card.rookie_card ? "yes" : "no", serialNumber: card.serial_number || "", condition: card.condition || "", grader: card.grader || "Raw", grade: card.grade === "Raw" ? "" : card.grade || "", estimatedValue: card.estimated_value == null ? "" : String(card.estimated_value), status: card.status || "personal_collection", notes: card.notes || "" };
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
  if (value.year.trim() && !/^\d+$/.test(value.year.trim())) return "Year must be a positive whole number.";
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
  return { player_name: value.playerName.trim(), sport: value.sport, year: value.year.trim() ? Number(value.year) : null, brand: value.brand.trim(), set_name: value.setName.trim(), card_number: value.cardNumber.trim(), team: value.team.trim(), parallel: value.parallel.trim(), rookie_card: value.rookieCard === "unknown" ? null : value.rookieCard === "yes", serial_number: value.serialNumber.trim(), condition: value.condition.trim(), grader: value.grader, grade: value.grader === "Raw" ? "Raw" : value.grade.trim(), estimated_value: estimatedValue ? Number(estimatedValue) : null, status: value.status, notes: value.notes.trim() };
}
