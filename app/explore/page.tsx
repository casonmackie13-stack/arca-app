"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardTile from "@/components/card/CardTile";
import CollectionTile from "@/components/collection/CollectionTile";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { getExploreCards, getExploreCollections, getExploreCollectors, type ExploreCollector } from "@/lib/social/explore";
import type { CardSummary, CollectionSummary } from "@/lib/types";
import { EmptyState, LoadingState } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { profilePath } from "@/lib/username";

export default function ExplorePage() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [collectors, setCollectors] = useState<ExploreCollector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [nextCollections, nextCards, nextCollectors] = await Promise.all([
          getExploreCollections(),
          getExploreCards(),
          getExploreCollectors(),
        ]);
        if (!active) return;
        setCollections(nextCollections);
        setCards(nextCards);
        setCollectors(nextCollectors);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) return <main className="page-container"><LoadingState label="Curating the explore feed…"/></main>;

  const empty = !collections.length && !cards.length && !collectors.length;

  return <main className="page-container cinematic-enter">
    <PageHeader />
    <section className="border-b border-[var(--border-subtle)] pb-10">
      <p className="eyebrow">Community</p>
      <h1 className="display-l mt-3">Explore</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">Discover public collections, featured cards, and collectors sharing their vaults across ARCA.</p>
    </section>

    {empty ? <div className="mt-12"><EmptyState title="The gallery is still quiet" description="Public collections and cards will appear here as collectors share their vaults."/></div> : <>
      <section className="mt-12">
        <SectionHeader eyebrow="Vaults" title="Featured collections" />
        {collections.length ? <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{collections.map((collection, index) => <CollectionTile key={collection.id} collection={collection} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No public collections yet" description="Recently shared public collections will appear here."/></div>}
      </section>

      <section className="mt-16">
        <SectionHeader eyebrow="Catalogue" title="Featured cards" />
        {cards.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((card, index) => <CardTile key={card.id} card={card} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No featured cards yet" description="Recently added public cards with images will appear here."/></div>}
      </section>

      <section className="mt-16 pb-8">
        <SectionHeader eyebrow="Collectors" title="Collectors to watch" />
        {collectors.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{collectors.map((collector) => <Link key={collector.id} href={profilePath(collector.username || "")} className="panel interactive-card flex items-center gap-4 p-5">
          <ProfileAvatar profile={collector} size="md" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none">{collector.display_name || collector.username}</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">@{collector.username}</p>
            {collector.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{collector.bio}</p>}
            <p className="mt-3 text-xs text-[var(--gold-primary)]">{collector.publicCollectionCount} public collection{collector.publicCollectionCount === 1 ? "" : "s"}</p>
          </div>
        </Link>)}</div> : <div className="mt-7"><EmptyState title="No collectors to highlight yet" description="Collectors with public collections will appear here."/></div>}
      </section>
    </>}
  </main>;
}
