import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";

const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,team,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections(id,name,visibility)";
const profileFields = "id,username,display_name,bio,rank,avatar_url";

const CARD_SEARCH_FIELDS = ["player_name", "year", "brand", "set_name", "card_number", "team"] as const;

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function logSearchError(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[searchExplore:${scope}]`, error);
  }
}

function normalizeCardRow(card: Record<string, unknown>): CardSummary {
  const collection = Array.isArray(card.collection) ? card.collection[0] : card.collection;
  return {
    ...(card as CardSummary),
    player_name: (card.player_name as string) || "Untitled card",
    collection: collection as CardSummary["collection"],
  };
}

function isDiscoverableCard(card: CardSummary) {
  return (card.collection?.name || "").trim().toLowerCase() !== "unsorted";
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

async function getPublicCollectionIds() {
  const { data, error } = await supabase
    .from("collections")
    .select("id")
    .eq("visibility", "public")
    .neq("name", "Unsorted");

  if (error) {
    logSearchError("publicCollections", error);
    return [];
  }

  return (data || []).map((collection) => collection.id);
}

async function searchPublicCards(query: string, limit: number) {
  const collectionIds = await getPublicCollectionIds();
  if (!collectionIds.length) return [];

  const pattern = `%${escapeIlike(query)}%`;
  const cardSelect = `${cardFields}, card_images ( image_url, image_type )`;

  const results = await Promise.all(
    CARD_SEARCH_FIELDS.map(async (field) => {
      const { data, error } = await supabase
        .from("cards")
        .select(cardSelect)
        .in("collection_id", collectionIds)
        .ilike(field, pattern)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logSearchError(`cards:${field}`, error);
        return [] as Record<string, unknown>[];
      }

      return (data || []) as Record<string, unknown>[];
    }),
  );

  return dedupeById(
    results
      .flat()
      .map(normalizeCardRow)
      .filter(isDiscoverableCard),
  ).slice(0, limit);
}

async function searchPublicCollections(query: string, limit: number) {
  const pattern = `%${escapeIlike(query)}%`;
  const select = `${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`;

  const [byName, byDescription] = await Promise.all([
    supabase
      .from("collections")
      .select(select)
      .eq("visibility", "public")
      .neq("name", "Unsorted")
      .ilike("name", pattern)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("collections")
      .select(select)
      .eq("visibility", "public")
      .neq("name", "Unsorted")
      .ilike("description", pattern)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (byName.error) logSearchError("collections:name", byName.error);
  if (byDescription.error) logSearchError("collections:description", byDescription.error);

  return dedupeById([
    ...((byName.data || []) as CollectionSummary[]),
    ...((byDescription.data || []) as CollectionSummary[]),
  ]).slice(0, limit);
}

async function searchProfiles(query: string, limit: number) {
  const pattern = `%${escapeIlike(query)}%`;

  const [byUsername, byDisplayName] = await Promise.all([
    supabase
      .from("profiles")
      .select(profileFields)
      .not("username", "is", null)
      .ilike("username", pattern)
      .order("username", { ascending: true })
      .limit(limit),
    supabase
      .from("profiles")
      .select(profileFields)
      .not("username", "is", null)
      .ilike("display_name", pattern)
      .order("username", { ascending: true })
      .limit(limit),
  ]);

  if (byUsername.error) logSearchError("profiles:username", byUsername.error);
  if (byDisplayName.error) logSearchError("profiles:display_name", byDisplayName.error);

  return dedupeById(
    [
      ...((byUsername.data || []) as CollectorProfile[]),
      ...((byDisplayName.data || []) as CollectorProfile[]),
    ].filter((profile): profile is CollectorProfile & { id: string } => Boolean(profile.id)),
  ).slice(0, limit);
}

export type ExploreSearchResults = {
  cards: CardSummary[];
  collections: CollectionSummary[];
  users: CollectorProfile[];
};

export async function searchExplore(query: string, limit = 12): Promise<ExploreSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { cards: [], collections: [], users: [] };

  const [cards, collections, users] = await Promise.all([
    searchPublicCards(trimmed, limit),
    searchPublicCollections(trimmed, limit),
    searchProfiles(trimmed, limit),
  ]);

  return { cards, collections, users };
}
