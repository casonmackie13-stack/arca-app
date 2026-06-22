import type { CardFormValue } from "@/lib/card-form";

export type AutofillField =
  | "playerName"
  | "sport"
  | "year"
  | "brand"
  | "setName"
  | "cardNumber"
  | "grader"
  | "grade";

export type AutofillResult = {
  fields: Partial<CardFormValue>;
  confidence: Partial<Record<AutofillField, number>>;
};

/** Future integration boundary for card-image extraction. No network request is made yet. */
export async function autofillCardInfo(image: File): Promise<AutofillResult> {
  void image;
  return { fields: {}, confidence: {} };
}
