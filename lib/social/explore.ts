import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";

const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections!inner(id,name,visibility)";

export type ExploreCollector = CollectorProfile & {
  publicCollectionCount: number;
  followerCount?: number;
};

function isUnsorted(name?: string | null) {
  return (name || "").trim().toLowerCase() === "unsorted";
}

function normalizeCardRow(card: Record<string, unknown>): CardSummary {
  const collection = Array.isArray(card.collection) ? card.collection[0] : card.collection;
  return {
    ...(card as CardSummary),
    player_name: (card.player_name as string) || "Untitled card",
    collection: collection as CardSummary["collection"],
  };
}

export async function getExploreCollections(limit = 12) {
  const { data, error } = await supabase
    .from("collections")
    .select(`${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`)
    .eq("visibility", "public")
    .neq("name", "Unsorted")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CollectionSummary[];
}

export async function getExploreCards(limit = 12) {
  const { data, error } = await supabase
    .from("cards")
    .select(`${cardFields}, card_images ( image_url, image_type )`)
    .eq("collection.visibility", "public")
    .neq("collection.name", "Unsorted")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeCardRow);
}

export async function getExploreCollectors(limit = 8) {
  const [{ data: collections, error: collectionsError }, { data: cards, error: cardsError }] = await Promise.all([
    supabase
      .from("collections")
      .select("owner_id, created_at")
      .eq("visibility", "public")
      .neq("name", "Unsorted")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("cards")
      .select("owner_id, created_at, collection:collections!inner(name, visibility)")
      .eq("collection.visibility", "public")
      .neq("collection.name", "Unsorted")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (collectionsError) throw collectionsError;
  if (cardsError) throw cardsError;

  const counts = new Map<string, number>();
  const orderedOwnerIds: string[] = [];

  const registerOwner = (ownerId?: string | null) => {
    if (!ownerId) return;
    counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
    if (!orderedOwnerIds.includes(ownerId)) orderedOwnerIds.push(ownerId);
  };

  for (const collection of collections || []) registerOwner(collection.owner_id);
  for (const card of cards || []) registerOwner(card.owner_id);

  if (!orderedOwnerIds.length) return [];

  const ownerIds = orderedOwnerIds.slice(0, limit);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,rank,avatar_url")
    .in("id", ownerIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile as CollectorProfile]));
  return ownerIds
    .map((ownerId) => {
      const profile = profileMap.get(ownerId);
      if (!profile?.username) return null;
      return {
        ...profile,
        publicCollectionCount: counts.get(ownerId) || 0,
      };
    })
    .filter(Boolean) as ExploreCollector[];
}

export async function getSuggestedProfiles(limit = 8) {
  const collectors = await getExploreCollectors(limit);
  if (collectors.length) return collectors;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,rank,avatar_url")
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data || [])
    .filter((profile) => profile.username)
    .map((profile) => ({
      ...(profile as CollectorProfile),
      publicCollectionCount: 0,
    })) as ExploreCollector[];
}

export { isUnsorted };
