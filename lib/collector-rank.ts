export const COLLECTOR_RANKS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"] as const;

export type CollectorRank = (typeof COLLECTOR_RANKS)[number];

export function normalizeCollectorRank(rank?: string | null): CollectorRank {
  if (rank && COLLECTOR_RANKS.includes(rank as CollectorRank)) return rank as CollectorRank;
  return "I";
}

export function formatCollectorRank(rank?: string | null) {
  return `Curator ${normalizeCollectorRank(rank)}`;
}

export function rankLabel(rank?: string | null) {
  return `Rank: ${formatCollectorRank(rank)}`;
}

export function rankIndex(rank?: string | null) {
  return Math.max(0, COLLECTOR_RANKS.indexOf(normalizeCollectorRank(rank)));
}
