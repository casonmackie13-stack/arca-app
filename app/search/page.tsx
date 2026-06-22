"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary } from "@/lib/types";
import CardTile from "@/components/card/CardTile";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { SearchIcon } from "@/components/ui/Icons";
import { EmptyState, LoadingState, Message, Panel } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";

type SortMode = "recent" | "value" | "year" | "player";
type GradeMode = "all" | "raw" | "graded";

const cardFields = `
  id, collection_id, player_name, sport, year, brand, set_name, card_number,
  team, parallel, rookie_card, serial_number, condition,
  grader, grade, estimated_value, status, notes, created_at,
  card_images ( image_url, image_type ),
  collection:collections ( id, name )
`;

const labelStatus = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const isRawCard = (card: CardSummary) => !card.grader || card.grader.toLowerCase() === "raw" || card.grade?.toLowerCase() === "raw";

export default function SearchPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("all");
  const [status, setStatus] = useState("all");
  const [grader, setGrader] = useState("all");
  const [gradeMode, setGradeMode] = useState<GradeMode>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadCards() {
      setLoading(true);
      setError("");
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) { router.replace("/auth"); return; }

        const [cardResult, collectionResult] = await Promise.all([
          supabase.from("cards").select(cardFields).eq("owner_id", authData.user.id).order("created_at", { ascending: false }),
          supabase.from("collections").select("id,name,category").eq("owner_id", authData.user.id).order("name"),
        ]);
        if (cardResult.error) throw cardResult.error;
        if (collectionResult.error) throw collectionResult.error;
        if (!active) return;
        const normalizedCards: CardSummary[] = (cardResult.data || []).map((card) => ({
          ...card,
          player_name: card.player_name || "Untitled card",
          collection: Array.isArray(card.collection) ? card.collection[0] || null : card.collection || null,
        }));
        setCards(normalizedCards);
        setCollections((collectionResult.data || []) as CollectionSummary[]);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to search the archive.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCards();
    return () => { active = false; };
  }, [reloadKey, router]);

  const statuses = useMemo(() => Array.from(new Set(cards.map((card) => card.status).filter((value): value is string => Boolean(value)))).sort(), [cards]);
  const graders = useMemo(() => Array.from(new Set(cards.map((card) => card.grader).filter((value): value is string => Boolean(value)))).sort(), [cards]);
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => cards.filter((card) => {
    const searchable = [card.player_name, card.brand, card.set_name, card.year, card.team, card.parallel, card.serial_number, card.condition, card.grader, card.grade, card.status, card.status?.replaceAll("_", " "), card.collection?.name]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
    const raw = isRawCard(card);
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (collectionId === "all" || card.collection_id === collectionId)
      && (status === "all" || card.status === status)
      && (grader === "all" || card.grader === grader)
      && (gradeMode === "all" || (gradeMode === "raw" ? raw : !raw));
  }).sort((a, b) => {
    if (sort === "value") return (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0);
    if (sort === "year") return (Number(b.year) || 0) - (Number(a.year) || 0);
    if (sort === "player") return a.player_name.localeCompare(b.player_name, undefined, { sensitivity: "base" });
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  }), [cards, collectionId, gradeMode, grader, normalizedQuery, sort, status]);

  const hasActiveFilters = Boolean(normalizedQuery) || collectionId !== "all" || status !== "all" || grader !== "all" || gradeMode !== "all";
  function clearFilters() {
    setQuery("");
    setCollectionId("all");
    setStatus("all");
    setGrader("all");
    setGradeMode("all");
  }

  return <main className="page-container cinematic-enter">
    <PageHeader/>
    <SectionHeader eyebrow="Discover" title="Search the archive" description="Browse every card in your private vault by identity, certification, collection, or status."/>

    <Panel className="mt-10 space-y-5 p-4 md:p-6">
      <Field label="Search cards" helper="Search player, brand, set, year, grader, grade, status, or collection name.">
        <div className="relative"><SearchIcon className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-[var(--text-tertiary)]"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Michael Jordan, PSA 10, or Modern Icons" className="pl-12"/></div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Collection"><Select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="all">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{labelStatus(value)}</option>)}</Select></Field>
        <Field label="Grader"><Select value={grader} onChange={(event) => setGrader(event.target.value)}><option value="all">All graders</option>{graders.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
        <Field label="Format"><Select value={gradeMode} onChange={(event) => setGradeMode(event.target.value as GradeMode)}><option value="all">Raw and graded</option><option value="raw">Raw only</option><option value="graded">Graded only</option></Select></Field>
        <Field label="Sort by"><Select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="recent">Recently added</option><option value="value">Value: high to low</option><option value="year">Year: newest first</option><option value="player">Player: A–Z</option></Select></Field>
      </div>
      {hasActiveFilters && <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4"><Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
    </Panel>

    {loading ? <LoadingState label="Indexing your card archive…"/> : error ? <div className="mt-8 space-y-4"><Message>{error}</Message><Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button></div> : cards.length === 0 ? <div className="mt-8"><EmptyState title="No cards in the archive" description="Catalogue your first card to make it searchable here." action={<ButtonLink href="/cards/new">Add a card</ButtonLink>}/></div> : <section className="mt-10">
      <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Card catalogue</p><h2 className="heading-2 mt-2">{results.length} {results.length === 1 ? "card" : "cards"}</h2></div><p className="text-sm text-[var(--text-tertiary)]">{hasActiveFilters ? `Filtered from ${cards.length} total` : "Your complete private archive"}</p></div>
      {results.length ? <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.map((card, index) => <CardTile key={card.id} card={card} index={index}/>)}</div> : <div className="mt-7"><EmptyState title="No cards match" description="Try a broader search or clear one of the filters." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}/></div>}
    </section>}
  </main>;
}
