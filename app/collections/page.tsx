"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CollectionSummary } from "@/lib/types";
import CollectionTile from "@/components/collection/CollectionTile";
import { ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Form";
import { EmptyState, LoadingState } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { PlusIcon, SearchIcon } from "@/components/ui/Icons";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { window.location.href = "/auth"; return; }
    const { data } = await supabase.from("collections").select("*, cards ( id, player_name, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )").eq("owner_id", userData.user.id).order("created_at", { ascending: false });
    setCollections((data || []) as CollectionSummary[]); setLoading(false);
  })(); }, []);

  const categories = useMemo(() => Array.from(new Set(collections.map((item) => item.category).filter(Boolean))), [collections]);
  const filtered = useMemo(() => collections.filter((item) => {
    const matchesQuery = `${item.name} ${item.description || ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "all" || item.category === category) && (visibility === "all" || item.visibility === visibility);
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "oldest" ? String(a.created_at).localeCompare(String(b.created_at)) : String(b.created_at).localeCompare(String(a.created_at))), [collections, query, category, visibility, sort]);

  if (loading) return <main className="page-container"><LoadingState label="Cataloguing your collections…"/></main>;
  return <main className="page-container cinematic-enter">
    <PageHeader/>
    <SectionHeader eyebrow="Private archive" title="The Vault" description={`${collections.length} curated collection${collections.length === 1 ? "" : "s"}, preserved in one place.`} action={<ButtonLink href="/collections/new"><PlusIcon/>New collection</ButtonLink>}/>
    <section aria-label="Collection filters" className="panel mt-10 grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_160px_150px]">
      <div className="relative"><SearchIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[var(--text-tertiary)]"/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the vault" aria-label="Search collections" className="pl-11"/></div>
      <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.map((item) => <option key={item || ""} value={item || ""}>{item}</option>)}</Select>
      <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Filter by visibility"><option value="all">All visibility</option><option value="private">Private</option><option value="public">Public</option></Select>
      <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort collections"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">A–Z</option></Select>
    </section>
    {filtered.length ? <section className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((collection, index) => <CollectionTile key={collection.id} collection={collection} index={index}/>)}</section> : <section className="mt-7"><EmptyState title="No collections found" description="Adjust the filters or create a new collection for the archive." action={<ButtonLink href="/collections/new">Create collection</ButtonLink>}/></section>}
  </main>;
}
