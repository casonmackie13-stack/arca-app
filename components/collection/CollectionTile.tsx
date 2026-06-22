import Link from "next/link";
import type { CollectionSummary } from "@/lib/types";
import { ArrowRightIcon, VaultIcon } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Surface";
import ArcaImage from "@/components/ui/ArcaImage";

export default function CollectionTile({ collection, index = 0 }: { collection: CollectionSummary; index?: number }) {
  const count = collection.cards?.length || 0;
  const fallbackImage = collection.cards?.find((card) => card.card_images?.length)?.card_images?.[0]?.image_url;
  const image = collection.cover_image_url || fallbackImage;
  return <Link href={`/collections/${collection.id}`} className="panel interactive-card cinematic-enter group block overflow-hidden" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
    <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-elevated)]">
      {image ? <ArcaImage src={image} alt={`${collection.name} cover`} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"/> : <div className="flex h-full items-center justify-center text-[var(--border-strong)]"><VaultIcon className="h-10 w-10"/></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"/>
      <div className="absolute bottom-3 left-3"><Badge tone={collection.name === "Unsorted" ? "neutral" : "gold"}>{collection.visibility || "private"}</Badge></div>
    </div>
    <div className="p-5">
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-display text-3xl leading-none text-[var(--text-primary)]">{collection.name}</h3><p className="mt-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--gold-primary)]">{collection.category || "Collection"}</p></div><ArrowRightIcon className="mt-1 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--gold-primary)]"/></div>
      {collection.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{collection.description}</p>}
      <p className="mt-5 text-xs text-[var(--text-tertiary)]">{count} card{count === 1 ? "" : "s"}</p>
    </div>
  </Link>;
}
