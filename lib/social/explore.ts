import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";

const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections(id,name,visibility)";

export type ExploreCollector = CollectorProfile & {
  publicCollectionCount: number;
};

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
  const { data: publicCollections, error: collectionsError } = await supabase
    .from("collections")
    .select("id")
    .eq("visibility", "public");

  if (collectionsError) throw collectionsError;

  const publicCollectionIds = (publicCollections || []).map((collection) => collection.id);
  if (!publicCollectionIds.length) return [];

  const { data, error } = await supabase
    .from("cards")
    .select(`${cardFields}, card_images ( image_url, image_type )`)
    .in("collection_id", publicCollectionIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const cards = ((data || []) as unknown as CardSummary[]).filter((card) =>
    Boolean(card.display_image_url || card.front_image_url || card.card_images?.length),
  );

  return cards.slice(0, limit);
}

export async function getExploreCollectors(limit = 8) {
  const { data: collections, error } = await supabase
    .from("collections")
    .select("owner_id, created_at")
    .eq("visibility", "public")
    .neq("name", "Unsorted")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const counts = new Map<string, number>();
  const orderedOwnerIds: string[] = [];
  for (const collection of collections || []) {
    if (!collection.owner_id) continue;
    counts.set(collection.owner_id, (counts.get(collection.owner_id) || 0) + 1);
    if (!orderedOwnerIds.includes(collection.owner_id)) orderedOwnerIds.push(collection.owner_id);
    if (orderedOwnerIds.length >= limit) break;
  }

  if (!orderedOwnerIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,rank")
    .in("id", orderedOwnerIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile as CollectorProfile]));
  return orderedOwnerIds
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
