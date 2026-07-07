import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary } from "@/lib/types";

const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections(id,name,visibility)";

function normalizeCardRow(card: Record<string, unknown>): CardSummary {
  const collection = Array.isArray(card.collection) ? card.collection[0] : card.collection;
  return {
    ...(card as CardSummary),
    player_name: (card.player_name as string) || "Untitled card",
    collection: collection as CardSummary["collection"],
  };
}

export async function getFollowingUserIds(userId: string) {
  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) throw error;
  return (data || []).map((row) => row.following_id).filter(Boolean);
}

export async function getFollowingRecentCards(userId: string, limit = 24) {
  const followingIds = await getFollowingUserIds(userId);
  if (!followingIds.length) return [];

  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("id")
    .in("owner_id", followingIds)
    .eq("visibility", "public")
    .neq("name", "Unsorted");

  if (collectionsError) throw collectionsError;

  const collectionIds = (collections || []).map((collection) => collection.id);
  if (!collectionIds.length) return [];

  const { data, error } = await supabase
    .from("cards")
    .select(`${cardFields}, card_images ( image_url, image_type )`)
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeCardRow);
}

export async function getFollowingCollections(userId: string, limit = 12) {
  const followingIds = await getFollowingUserIds(userId);
  if (!followingIds.length) return [];

  const { data, error } = await supabase
    .from("collections")
    .select(`${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`)
    .in("owner_id", followingIds)
    .eq("visibility", "public")
    .neq("name", "Unsorted")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CollectionSummary[];
}
