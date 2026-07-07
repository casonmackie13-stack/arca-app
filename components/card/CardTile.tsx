import Link from "next/link";
import type { CardSummary } from "@/lib/types";
import FlippableCard from "@/components/card/FlippableCard";
import { Badge } from "@/components/ui/Surface";
import { cardBackImage, cardFrontImage } from "@/lib/card-images";

const statusTone = (status?: string | null) => status === "for_sale" ? "success" : status === "for_trade" ? "trade" : status === "watchlist" || status === "wishlist" ? "info" : status === "sold" ? "warning" : "neutral";

export default function CardTile({ card, index = 0 }: { card: CardSummary; index?: number }) {
  const frontImage = cardFrontImage(card);
  const backImage = cardBackImage(card);
  const hasBack = Boolean(backImage);

  return <article className="panel interactive-card cinematic-enter group overflow-hidden" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}>
    <div className="relative aspect-[2.5/3.15] overflow-hidden bg-black">
      {frontImage ? (
        <FlippableCard
          compact
          frontImageUrl={frontImage}
          backImageUrl={backImage}
          alt={card.player_name}
          className="h-full"
          imageClassName="object-contain p-3"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">No image</div>
      )}
      {hasBack && <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/75 backdrop-blur">Tap to flip</span>}
    </div>
    <Link href={`/cards/${card.id}`} className="block p-4 transition-colors hover:bg-[var(--surface-hover)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl leading-none">{card.player_name}</h3>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{[card.year, card.brand].filter(Boolean).join(" · ") || "Uncatalogued year and brand"}</p>
          {card.collection?.name && <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{card.collection.name}</p>}
        </div>
        {card.status && <Badge tone={statusTone(card.status)}>{card.status.replaceAll("_", " ")}</Badge>}
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
        <span className="text-[var(--gold-primary)]">{card.grader || "Raw"} {card.grade && card.grade !== "Raw" ? card.grade : ""}</span>
        <span className="tabular-nums text-[var(--text-secondary)]">{card.estimated_value ? `$${Number(card.estimated_value).toLocaleString()}` : "Value unset"}</span>
      </div>
    </Link>
  </article>;
}
