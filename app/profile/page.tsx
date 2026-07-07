"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/Icons";
import { LoadingState, Panel, Stat } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileRankBadge from "@/components/profile/ProfileRankBadge";
import { getFollowCounts } from "@/lib/social/follows";
import { countPublicUserCards, countPublicUserCollections } from "@/lib/social/profiles";
import { profilePath } from "@/lib/username";
import Link from "next/link";

const ranks = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII"];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [publicCardCount, setPublicCardCount] = useState(0);
  const [publicCollectionCount, setPublicCollectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }

      const userId = userData.user.id;
      const [{ data: profileData }, { data: collectionData }, { data: cardData }, counts, nextPublicCards, nextPublicCollections] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("collections").select("id,name").eq("owner_id", userId),
        supabase.from("cards").select("id,grader,estimated_value").eq("owner_id", userId),
        getFollowCounts(userId),
        countPublicUserCards(userId),
        countPublicUserCollections(userId),
      ]);

      if (!active) return;
      setProfile(profileData as CollectorProfile | null);
      setCollections((collectionData || []) as CollectionSummary[]);
      setCards((cardData || []) as CardSummary[]);
      setFollowCounts(counts);
      setPublicCardCount(nextPublicCards);
      setPublicCollectionCount(nextPublicCollections);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <main className="page-container"><LoadingState label="Retrieving collector profile…"/></main>;

  const rank = profile?.rank || "I";
  const rankIndex = Math.max(0, ranks.indexOf(rank));
  const graded = cards.filter((card) => card.grader && card.grader !== "Raw").length;
  const value = cards.reduce((total, card) => total + Number(card.estimated_value || 0), 0);
  const username = profile?.username || "collector";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return <main className="page-container cinematic-enter">
    <PageHeader action={<ThemeToggle compact/>} />
    <section className="grid items-center gap-8 border-b border-[var(--border-subtle)] pb-12 md:grid-cols-[auto_1fr] md:pb-16">
      <ProfileAvatar profile={profile || { username }} size="lg" />
      <div>
        <p className="eyebrow">Collector profile</p>
        <h1 className="display-l mt-3">{profile?.display_name || username}</h1>
        <p className="mt-2 text-sm font-semibold text-[var(--text-tertiary)]">@{username}</p>
        <div className="mt-3"><ProfileRankBadge rank={profile?.rank} /></div>
        {profile?.bio ? (
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--text-secondary)]">{profile.bio}</p>
        ) : (
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--text-tertiary)] italic">No bio yet.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/profile/edit" variant="secondary" size="sm">Edit profile</ButtonLink>
          {profile?.username && <ButtonLink href={profilePath(profile.username)} variant="outline" size="sm">View public profile</ButtonLink>}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`${profilePath(username)}/followers`} className="transition-colors hover:text-[var(--gold-primary)]">
            <strong className="tabular-nums">{followCounts.followers}</strong> <span className="text-[var(--text-tertiary)]">followers</span>
          </Link>
          <Link href={`${profilePath(username)}/following`} className="transition-colors hover:text-[var(--gold-primary)]">
            <strong className="tabular-nums">{followCounts.following}</strong> <span className="text-[var(--text-tertiary)]">following</span>
          </Link>
          <span><strong className="tabular-nums">{publicCardCount}</strong> <span className="text-[var(--text-tertiary)]">public cards</span></span>
          <span><strong className="tabular-nums">{publicCollectionCount}</strong> <span className="text-[var(--text-tertiary)]">public collections</span></span>
        </div>
      </div>
    </section>

    <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-5">
      <Stat value={cards.length} label="Cards"/>
      <Stat value={collections.length} label="Vaults"/>
      <Stat value={graded} label="Graded"/>
    </section>

    <section className="mt-16 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <Panel variant="featured" className="p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Collector rank</p>
            <p className="mt-4 font-display text-7xl leading-none">{rank}</p>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">{rankIndex + 1} / {ranks.length}</span>
        </div>
        <div className="mt-8 grid grid-cols-13 gap-1">{ranks.map((item, index) => <span key={item} className={`h-1 rounded-full ${index <= rankIndex ? "bg-[var(--gold-primary)]" : "bg-[var(--border-subtle)]"}`}/>)}</div>
        <div className="mt-4 flex justify-between text-[10px] text-[var(--text-tertiary)]"><span>I</span><span>V</span><span>IX</span><span>XIII</span></div>
      </Panel>
      <Panel className="p-6 md:p-8">
        <p className="eyebrow">Collection value</p>
        <p className="mt-5 font-display text-5xl tabular-nums">${value.toLocaleString()}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--text-tertiary)]">Based on values recorded in your card catalogue.</p>
      </Panel>
    </section>

    <section className="mt-16">
      <SectionHeader eyebrow="Preferences" title="Vault settings"/>
      <Panel className="mt-6 divide-y divide-[var(--border-subtle)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Appearance</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Move between vault dark and gallery light.</p>
          </div>
          <ThemeToggle/>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Account session</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Securely close this ARCA session.</p>
          </div>
          <Button variant="outline" onClick={() => { void signOut(); }}><LogoutIcon/>Sign out</Button>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Discover collectors</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Browse public collections and featured cards.</p>
          </div>
          <ButtonLink href="/explore" variant="outline" size="sm">Open Explore</ButtonLink>
        </div>
      </Panel>
    </section>
  </main>;
}
