"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/Icons";
import { LoadingState, Panel, Stat } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";

const ranks = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII"];
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CollectorProfile | null>(null), [collections, setCollections] = useState<CollectionSummary[]>([]), [cards, setCards] = useState<CardSummary[]>([]), [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const { data: userData } = await supabase.auth.getUser(); if (!userData.user) { router.push("/auth"); return; } const [{ data: profileData }, { data: collectionData }, { data: cardData }] = await Promise.all([supabase.from("profiles").select("*").eq("id", userData.user.id).single(), supabase.from("collections").select("id,name").eq("owner_id", userData.user.id), supabase.from("cards").select("id,grader,estimated_value").eq("owner_id", userData.user.id)]); setProfile(profileData as CollectorProfile | null); setCollections((collectionData || []) as CollectionSummary[]); setCards((cardData || []) as CardSummary[]); setLoading(false); })(); }, [router]);
  if (loading) return <main className="page-container"><LoadingState label="Retrieving collector profile…"/></main>;
  const rank = profile?.rank || "I", rankIndex = Math.max(0, ranks.indexOf(rank));
  const graded = cards.filter((card) => card.grader && card.grader !== "Raw").length;
  const value = cards.reduce((total, card) => total + Number(card.estimated_value || 0), 0);
  const initials = (profile?.username || "AR").slice(0, 2).toUpperCase();
  async function signOut() { await supabase.auth.signOut(); router.push("/auth"); router.refresh(); }
  return <main className="page-container cinematic-enter"><PageHeader action={<ThemeToggle compact/>}/>
    <section className="grid items-center gap-8 border-b border-[var(--border-subtle)] pb-12 md:grid-cols-[auto_1fr] md:pb-16"><div className="flex h-28 w-28 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] font-display text-5xl text-[var(--gold-primary)]">{initials}</div><div><p className="eyebrow">Collector profile</p><h1 className="display-l mt-3">{profile?.username || "Collector"}</h1><p className="mt-3 max-w-xl text-base leading-7 text-[var(--text-secondary)]">{profile?.bio || "Collector. Curator. Custodian of the archive."}</p></div></section>
    <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-5"><Stat value={cards.length} label="Cards"/><Stat value={collections.length} label="Vaults"/><Stat value={graded} label="Graded"/></section>
    <section className="mt-16 grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><Panel variant="featured" className="p-6 md:p-8"><div className="flex items-start justify-between"><div><p className="eyebrow">Collector rank</p><p className="mt-4 font-display text-7xl leading-none">{rank}</p></div><span className="text-xs text-[var(--text-tertiary)]">{rankIndex + 1} / {ranks.length}</span></div><div className="mt-8 grid grid-cols-13 gap-1">{ranks.map((item, index) => <span key={item} className={`h-1 rounded-full ${index <= rankIndex ? "bg-[var(--gold-primary)]" : "bg-[var(--border-subtle)]"}`}/>)}</div><div className="mt-4 flex justify-between text-[10px] text-[var(--text-tertiary)]"><span>I</span><span>V</span><span>IX</span><span>XIII</span></div></Panel><Panel className="p-6 md:p-8"><p className="eyebrow">Collection value</p><p className="mt-5 font-display text-5xl tabular-nums">${value.toLocaleString()}</p><p className="mt-3 text-sm leading-6 text-[var(--text-tertiary)]">Based on values recorded in your card catalogue.</p></Panel></section>
    <section className="mt-16"><SectionHeader eyebrow="Preferences" title="Vault settings"/><Panel className="mt-6 divide-y divide-[var(--border-subtle)]"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Appearance</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Move between vault dark and gallery light.</p></div><ThemeToggle/></div><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Account session</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Securely close this ARCA session.</p></div><Button variant="outline" onClick={signOut}><LogoutIcon/>Sign out</Button></div></Panel></section>
  </main>;
}

