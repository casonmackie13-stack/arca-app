"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CardTile from "@/components/card/CardTile";
import CollectionTile from "@/components/collection/CollectionTile";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { getFollowCounts, isFollowing } from "@/lib/social/follows";
import {
  countPublicUserCards,
  countPublicUserCollections,
  getOwnUserCards,
  getOwnUserCollections,
  getPublicProfileByUsername,
  getPublicUserCards,
  getPublicUserCollections,
} from "@/lib/social/profiles";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import { EmptyState, LoadingState } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

export default function PublicProfilePage() {
  const params = useParams();
  const username = decodeURIComponent(String(params.username || ""));
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [publicCardCount, setPublicCardCount] = useState(0);
  const [publicCollectionCount, setPublicCollectionCount] = useState(0);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [{ data: authData }, profileData] = await Promise.all([
          supabase.auth.getUser(),
          getPublicProfileByUsername(username),
        ]);
        if (!active) return;
        if (!profileData?.id) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const viewer = authData.user?.id || null;
        const isSelf = viewer === profileData.id;
        setViewerId(viewer);
        const [followCounts, nextFollowing, nextCollections, nextCards, nextPublicCardCount, nextPublicCollectionCount] = await Promise.all([
          getFollowCounts(profileData.id),
          viewer && !isSelf ? isFollowing(viewer, profileData.id) : Promise.resolve(false),
          isSelf ? getOwnUserCollections(profileData.id) : getPublicUserCollections(profileData.id),
          isSelf ? getOwnUserCards(profileData.id) : getPublicUserCards(profileData.id),
          countPublicUserCards(profileData.id),
          countPublicUserCollections(profileData.id),
        ]);

        if (!active) return;
        setProfile(profileData);
        setCounts(followCounts);
        setFollowing(nextFollowing);
        setCollections(nextCollections);
        setCards(nextCards);
        setPublicCardCount(nextPublicCardCount);
        setPublicCollectionCount(nextPublicCollectionCount);
      } catch (cause) {
        if (!active) return;
        console.error(cause);
        setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [username]);

  if (loading) return <main className="page-container"><LoadingState label="Opening collector profile…"/></main>;
  if (!profile?.id) return <main className="page-container cinematic-enter"><PageHeader backHref="/explore" backLabel="Explore"/><EmptyState title="Collector not found" description="This profile may have been renamed or is no longer available."/></main>;

  const isSelf = viewerId === profile.id;

  function handleFollowChange(nextFollowing: boolean) {
    setFollowing(nextFollowing);
    setCounts((current) => ({
      ...current,
      followers: Math.max(0, current.followers + (nextFollowing ? 1 : -1)),
    }));
  }

  return <main className="page-container cinematic-enter">
    <PageHeader backHref="/explore" backLabel="Explore" />
    <ProfileHeader
      profile={profile}
      counts={counts}
      publicCardCount={publicCardCount}
      publicCollectionCount={publicCollectionCount}
      isSelf={isSelf}
      isFollowing={following}
      onFollowChange={handleFollowChange}
    />

    <section className="mt-12">
      <SectionHeader eyebrow="Vaults" title={isSelf ? "Your collections" : "Public collections"} />
      {collections.length ? <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{collections.map((collection, index) => <CollectionTile key={collection.id} collection={collection} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No collections to show" description={isSelf ? "Create a collection and set visibility to public to share it on your profile." : "This collector has not shared any public collections yet."} action={isSelf ? <ButtonLink href="/collections/new">Create collection</ButtonLink> : undefined}/></div>}
    </section>

    <section className="mt-16 pb-8">
      <SectionHeader eyebrow="Catalogue" title={isSelf ? "Your cards" : "Public cards"} />
      {cards.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((card, index) => <CardTile key={card.id} card={card} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No cards to show" description={isSelf ? "Catalogue cards in public collections or leave cards unassigned to share them publicly." : "This collector has not shared any public cards yet."}/></div>}
    </section>
  </main>;
}
