"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import ThemeToggle from "@/components/theme/ThemeToggle";
import CollectionTile from "@/components/collection/CollectionTile";
import CardTile from "@/components/card/CardTile";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon, PlusIcon } from "@/components/ui/Icons";
import { EmptyState, LoadingState, Stat } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { ensureUnsortedCollection } from "@/lib/collections";

export default function Home() {
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { window.location.href = "/auth"; return; }

      const [{ data: profileData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        ensureUnsortedCollection(user.id),
      ]);

      const [{ data: collectionData }, { data: cardData }] = await Promise.all([
        supabase.from("collections").select("*, cards ( id, player_name, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )").eq("owner_id", user.id).order("created_at", { ascending: true }),
        supabase.from("cards").select("*, card_images ( image_url, image_type )").eq("owner_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfile(profileData as CollectorProfile | null);
      setCollections((collectionData || []) as CollectionSummary[]);
      setCards((cardData || []) as CardSummary[]);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <main className="page-container"><LoadingState label="Opening your private collection…"/></main>;
  const featured = collections.find((item) => item.name !== "Unsorted") || collections[0];
  const collectorName = profile?.username || "Collector";

  return <main className="page-container cinematic-enter">
    <PageHeader action={<ThemeToggle compact/>}/>
    <section className="grid items-end gap-8 border-b border-[var(--border-subtle)] pb-12 md:grid-cols-[1fr_auto] md:pb-16">
      <div><p className="eyebrow">Private collection</p><h1 className="display-xl mt-4 max-w-4xl">Welcome back,<br/><span className="text-[var(--gold-primary)]">{collectorName}.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">Every card carries a history. Every collection preserves one.</p></div>
      <ButtonLink href="/collections/new" size="lg" className="w-full md:w-auto"><PlusIcon/>New collection</ButtonLink>
    </section>

    <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-12 md:gap-5">
      <Stat value={cards.length} label="Cards"/><Stat value={collections.length} label="Vaults"/><Stat value={profile?.rank || "I"} label="Collector rank"/>
    </section>

    <section className="mt-16 md:mt-20"><SectionHeader eyebrow="Curator's selection" title="Featured collection" description="A highlighted chapter from your private archive." action={<ButtonLink href="/collections" variant="ghost" size="sm">View the vault<ArrowRightIcon/></ButtonLink>}/><div className="mt-7">{featured ? <div className="max-w-2xl"><CollectionTile collection={featured}/></div> : <EmptyState title="Your vault awaits" description="Begin with a collection and give your cards a place in the archive." action={<ButtonLink href="/collections/new">Create collection</ButtonLink>}/>}</div></section>

    <section className="mt-16 md:mt-20"><SectionHeader eyebrow="Recently acquired" title="Latest cards" description="The newest objects added to your archive."/>{cards.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.slice(0, 4).map((card, index) => <CardTile key={card.id} card={card} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No cards catalogued" description="Add your first card to begin the collection record."/></div>}</section>
  </main>;
}
