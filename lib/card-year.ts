const CARD_YEAR_PATTERN = /^\d{4}$/;
const CARD_SEASON_YEAR_PATTERN = /^\d{4}-\d{2}$/;

/** Normalize en/em dashes, spaces, slashes, and full season ranges (2025-2026 → 2025-26). */
export function normalizeCardYear(value: string): string {
  let normalized = value.trim().replace(/[\u2013\u2014]/g, "-");
  normalized = normalized.replace(/\s*[-/]\s*/g, "-");

  const fullSeason = /^(\d{4})-(\d{4})$/.exec(normalized);
  if (fullSeason) {
    const startYear = Number(fullSeason[1]);
    const endYear = Number(fullSeason[2]);
    if (endYear === startYear + 1) {
      normalized = `${fullSeason[1]}-${String(endYear).slice(-2)}`;
    }
  }

  return normalized;
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
  return "Year must be a four-digit year (e.g. 2020) or season format (e.g. 2025-26).";
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
