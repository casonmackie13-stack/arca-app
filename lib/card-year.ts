const CARD_YEAR_PATTERN = /^\d{4}$/;
const CARD_SEASON_YEAR_PATTERN = /^\d{4}-\d{2}$/;

/** Normalize en/em dashes to hyphen and trim whitespace. */
export function normalizeCardYear(value: string): string {
  return value.trim().replace(/[\u2013\u2014]/g, "-");
}

export function isValidCardYear(value: string): boolean {
  const normalized = normalizeCardYear(value);
  if (!normalized) return true;
  return CARD_YEAR_PATTERN.test(normalized) || CARD_SEASON_YEAR_PATTERN.test(normalized);
}

export function cardYearValidationMessage(value: string): string {
  const normalized = normalizeCardYear(value);
  if (!normalized) return "";
  if (isValidCardYear(normalized)) return "";
  return 'Year must be a four-digit year (e.g. 2020) or season format (e.g. 2020-21).';
}

/** Sort key for year descending (newest seasons first). */
export function cardYearSortValue(year?: string | number | null): number {
  const normalized = normalizeCardYear(year == null ? "" : String(year));
  if (!normalized) return 0;
  if (CARD_YEAR_PATTERN.test(normalized)) return Number(normalized);
  const season = CARD_SEASON_YEAR_PATTERN.exec(normalized);
  if (season) return Number(season[1]) + 0.5;
  return 0;
}
