import { formatCollectorRank } from "@/lib/collector-rank";

export default function ProfileRankBadge({ rank, className = "" }: { rank?: string | null; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gold-primary)] ${className}`}>
      {formatCollectorRank(rank)}
    </span>
  );
}
