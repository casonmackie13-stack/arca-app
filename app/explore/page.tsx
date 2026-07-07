"use client";

import { useEffect, useMemo, useState } from "react";
import CardTile from "@/components/card/CardTile";
import CollectionTile from "@/components/collection/CollectionTile";
import ProfilePreviewCard from "@/components/profile/ProfilePreviewCard";
import { getFollowerCounts, getFollowingState } from "@/lib/social/follows";
import { getExploreCards, getExploreCollections, getSuggestedProfiles, type ExploreCollector } from "@/lib/social/explore";
import { searchExplore } from "@/lib/social/search";
import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import { EmptyState, LoadingState, Message } from "@/components/ui/Surface";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { Field, Input } from "@/components/ui/Form";
import { SearchIcon } from "@/components/ui/Icons";
import { profilePath } from "@/lib/username";
import Link from "next/link";

type SearchTab = "all" | "cards" | "collections" | "users";

const tabs: { id: SearchTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cards", label: "Cards" },
  { id: "collections", label: "Collections" },
  { id: "users", label: "Users" },
];

export default function ExplorePage() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [collectors, setCollectors] = useState<ExploreCollector[]>([]);
  const [searchResults, setSearchResults] = useState<{ cards: CardSummary[]; collections: CollectionSummary[]; users: CollectorProfile[] } | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerCounts, setFollowerCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;

    async function loadDefault() {
      setLoading(true);
      setError("");
      try {
        const { data: authData } = await supabase.auth.getUser();
        const viewer = authData.user?.id || null;
        const [nextCollections, nextCards, nextCollectors] = await Promise.all([
          getExploreCollections(),
          getExploreCards(),
          getSuggestedProfiles(),
        ]);
        if (!active) return;

        const visibleCollectors = nextCollectors.filter((collector) => collector.id && collector.id !== viewer);
        const collectorIds = visibleCollectors.map((collector) => collector.id!).filter(Boolean);

        const [nextFollowing, nextFollowerCounts] = viewer && collectorIds.length
          ? await Promise.all([
              getFollowingState(viewer, collectorIds),
              getFollowerCounts(collectorIds),
            ])
          : [new Set<string>(), await getFollowerCounts(collectorIds)];

        if (!active) return;
        setViewerId(viewer);
        setCollections(nextCollections);
        setCards(nextCards);
        setCollectors(visibleCollectors);
        setFollowingIds(nextFollowing);
        setFollowerCounts(nextFollowerCounts);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load Explore.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDefault();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (!debouncedQuery) {
        setSearchResults(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      setError("");
      try {
        const results = await searchExplore(debouncedQuery);
        if (!active) return;

        const visibleUsers = results.users.filter((user) => user.id && user.id !== viewerId && user.username);
        const userIds = visibleUsers.map((user) => user.id!).filter(Boolean);

        const [nextFollowing, nextFollowerCounts] = viewerId && userIds.length
          ? await Promise.all([
              getFollowingState(viewerId, userIds),
              getFollowerCounts(userIds),
            ])
          : [new Set<string>(), await getFollowerCounts(userIds)];

        if (!active) return;
        setSearchResults({
          ...results,
          users: visibleUsers,
        });
        setFollowingIds((current) => new Set([...current, ...nextFollowing]));
        setFollowerCounts((current) => {
          const next = new Map(current);
          for (const [userId, count] of nextFollowerCounts) next.set(userId, count);
          return next;
        });
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Search failed.");
        setSearchResults({ cards: [], collections: [], users: [] });
      } finally {
        if (active) setSearching(false);
      }
    }

    void runSearch();
    return () => { active = false; };
  }, [debouncedQuery, viewerId]);

  const isSearching = Boolean(debouncedQuery);
  const activeCards = isSearching ? (searchResults?.cards || []) : cards;
  const activeCollections = isSearching ? (searchResults?.collections || []) : collections;
  const activeUsers = isSearching
    ? (searchResults?.users || []).map((user) => ({
        ...user,
        publicCollectionCount: 0,
      })) as ExploreCollector[]
    : collectors;

  const visibleCards = tab === "all" || tab === "cards" ? activeCards : [];
  const visibleCollections = tab === "all" || tab === "collections" ? activeCollections : [];
  const visibleUsers = tab === "all" || tab === "users" ? activeUsers : [];

  const searchEmpty = isSearching && !searching && !visibleCards.length && !visibleCollections.length && !visibleUsers.length;
  const defaultEmpty = !isSearching && !loading && !collections.length && !cards.length && !collectors.length;

  const sectionTitle = useMemo(() => {
    if (isSearching) return `Results for “${debouncedQuery}”`;
    return "Discover";
  }, [debouncedQuery, isSearching]);

  function handleFollowChange(userId: string, following: boolean) {
    setFollowingIds((current) => {
      const next = new Set(current);
      if (following) next.add(userId);
      else next.delete(userId);
      return next;
    });
    setFollowerCounts((current) => {
      const next = new Map(current);
      next.set(userId, Math.max(0, (next.get(userId) || 0) + (following ? 1 : -1)));
      return next;
    });
  }

  if (loading) return <main className="page-container"><LoadingState label="Curating the explore feed…" /></main>;

  return <main className="page-container cinematic-enter">
    <PageHeader />
    <section className="border-b border-[var(--border-subtle)] pb-8">
      <p className="eyebrow">Community</p>
      <h1 className="display-l mt-3">Explore</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
        Discover public collections, featured cards, and collectors sharing their vaults across ARCA.
      </p>

      <div className="mt-8 max-w-2xl">
        <Field label="Search ARCA">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards, collections, or collectors"
              className="pl-11 pr-11"
              aria-label="Search cards, collections, and users"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </Field>
      </div>

      {isSearching && (
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${tab === item.id ? "border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]" : "border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </section>

    {error && <div className="mt-6"><Message tone="error">{error}</Message></div>}
    {searching && <div className="mt-8"><LoadingState label="Searching the catalogue…" /></div>}

    {defaultEmpty && !isSearching ? (
      <div className="mt-12">
        <EmptyState
          title="The gallery is still quiet"
          description="Public collections and cards will appear here as collectors share their vaults. Set a collection to Public to make it discoverable."
        />
      </div>
    ) : null}

    {searchEmpty ? (
      <div className="mt-12">
        <EmptyState title="No results found" description={`Nothing matched “${debouncedQuery}”. Try another player, collection name, or username.`} />
      </div>
    ) : null}

    {!searchEmpty && (!isSearching || tab === "all" || tab === "collections") && visibleCollections.length > 0 && (
      <section className="mt-12">
        <SectionHeader eyebrow="Vaults" title={isSearching ? "Collections" : "Featured collections"} />
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleCollections.map((collection, index) => <CollectionTile key={collection.id} collection={collection} index={index} />)}
        </div>
      </section>
    )}

    {!searchEmpty && (!isSearching || tab === "all" || tab === "cards") && visibleCards.length > 0 && (
      <section className="mt-16">
        <SectionHeader eyebrow="Catalogue" title={isSearching ? "Cards" : "Featured cards"} />
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCards.map((card, index) => <CardTile key={card.id} card={card} index={index} />)}
        </div>
      </section>
    )}

    {!searchEmpty && (!isSearching || tab === "all" || tab === "users") && visibleUsers.length > 0 && (
      <section className="mt-16 pb-8">
        <SectionHeader eyebrow="Collectors" title={isSearching ? "Users" : "Collectors to watch"} />
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleUsers.map((collector) => (
            <ProfilePreviewCard
              key={collector.id}
              profile={collector}
              isSelf={collector.id === viewerId}
              initialFollowing={collector.id ? followingIds.has(collector.id) : false}
              followerCount={collector.id ? followerCounts.get(collector.id) || 0 : 0}
              onFollowChange={(following) => collector.id && handleFollowChange(collector.id, following)}
            />
          ))}
        </div>
      </section>
    )}

    {!searchEmpty && isSearching && tab === "collections" && !visibleCollections.length && !searching && (
      <div className="mt-12"><EmptyState title="No collections found" description="Try searching by collection name." /></div>
    )}
    {!searchEmpty && isSearching && tab === "cards" && !visibleCards.length && !searching && (
      <div className="mt-12"><EmptyState title="No cards found" description="Try a player name, year, brand, or set." /></div>
    )}
    {!searchEmpty && isSearching && tab === "users" && !visibleUsers.length && !searching && (
      <div className="mt-12"><EmptyState title="No users found" description="Try a username or display name." /></div>
    )}

    {!isSearching && !defaultEmpty && (
      <p className="mt-10 pb-8 text-xs text-[var(--text-tertiary)]">
        {sectionTitle}: only cards in public collections are discoverable.{" "}
        <Link href="/collections/new" className="text-[var(--gold-primary)] hover:underline">Create a public collection</Link> to share your vault.
      </p>
    )}
  </main>;
}
