"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary } from "@/lib/types";
import CardTile from "@/components/card/CardTile";
import { Badge, EmptyState, LoadingState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { PlusIcon } from "@/components/ui/Icons";
import ArcaImage from "@/components/ui/ArcaImage";

export default function CollectionDetailPage() {
  const collectionId = useParams().id as string;
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    const [{ data: collectionData }, { data: cardData }, { data: userData }] = await Promise.all([
      supabase.from("collections").select("*").eq("id", collectionId).single(),
      supabase.from("cards").select("*, card_images ( image_url, image_type )").eq("collection_id", collectionId).order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setCollection(collectionData as CollectionSummary | null); setCards((cardData || []) as CardSummary[]); setIsOwner(Boolean(userData.user && collectionData?.owner_id === userData.user.id)); setLoading(false);
  })(); }, [collectionId]);
  if (loading) return <main className="page-container"><LoadingState label="Opening the collection…"/></main>;
  if (!collection) return <main className="page-container"><EmptyState title="Collection unavailable" description="This collection may be private or no longer exist."/></main>;

  return <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref="/collections" backLabel="Vault" action={isOwner ? <ButtonLink href={`/collections/${collectionId}/edit`} variant="secondary" size="sm">Edit collection</ButtonLink> : undefined}/>
    <section className="relative overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="relative aspect-[16/9] min-h-64 overflow-hidden bg-black md:aspect-[2/1]">{collection.cover_image_url ? <ArcaImage src={collection.cover_image_url} alt={`${collection.name} cover`} sizes="(max-width: 1024px) 100vw, 960px" className="image-reveal object-cover"/> : <div className="h-full bg-[radial-gradient(circle_at_25%_20%,var(--border-strong),transparent_42%)]"/>}<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"/></div>
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-10"><p className="eyebrow">Collection</p><h1 className="display-l mt-3 text-white">{collection.name}</h1><div className="mt-5 flex flex-wrap gap-2"><Badge tone="gold">{collection.category || "Collection"}</Badge><Badge>{collection.visibility || "private"}</Badge><Badge>{cards.length} card{cards.length === 1 ? "" : "s"}</Badge></div></div>
    </section>
    {collection.description && <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">{collection.description}</p>}
    <section className="mt-16"><SectionHeader eyebrow="Catalogue" title="Objects in this collection" action={isOwner ? <ButtonLink href={`/cards/new?collection=${collectionId}`} size="sm"><PlusIcon/>Add card</ButtonLink> : undefined}/>{cards.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((card, index) => <CardTile key={card.id} card={card} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="An empty exhibition" description="Catalogue the first card to begin this collection." action={isOwner ? <ButtonLink href={`/cards/new?collection=${collectionId}`}>Add first card</ButtonLink> : undefined}/></div>}</section>
  </div></main>;
}
