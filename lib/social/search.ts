import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";

const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,team,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections!inner(id,name,visibility)";
const profileFields = "id,username,display_name,bio,rank";

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function normalizeCardRow(card: Record<string, unknown>): CardSummary {
  const collection = Array.isArray(card.collection) ? card.collection[0] : card.collection;
  return {
    ...(card as CardSummary),
    player_name: (card.player_name as string) || "Untitled card",
    collection: collection as CardSummary["collection"],
  };
}

export type ExploreSearchResults = {
  cards: CardSummary[];
  collections: CollectionSummary[];
  users: CollectorProfile[];
};

export async function searchExplore(query: string, limit = 12): Promise<ExploreSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { cards: [], collections: [], users: [] };

  const pattern = `%${escapeIlike(trimmed)}%`;

  const [cardsResult, collectionsResult, usersResult] = await Promise.all([
    supabase
      .from("cards")
      .select(`${cardFields}, card_images ( image_url, image_type )`)
      .eq("collection.visibility", "public")
      .neq("collection.name", "Unsorted")
      .or(
        [
          `player_name.ilike.${pattern}`,
          `year.ilike.${pattern}`,
          `brand.ilike.${pattern}`,
          `set_name.ilike.${pattern}`,
          `card_number.ilike.${pattern}`,
          `team.ilike.${pattern}`,
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("collections")
      .select(`${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`)
      .eq("visibility", "public")
      .neq("name", "Unsorted")
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("profiles")
      .select(profileFields)
      .not("username", "is", null)
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .order("username", { ascending: true })
      .limit(limit),
  ]);

  if (cardsResult.error) throw cardsResult.error;
  if (collectionsResult.error) throw collectionsResult.error;
  if (usersResult.error) throw usersResult.error;

  return {
    cards: ((cardsResult.data || []) as unknown as Record<string, unknown>[]).map(normalizeCardRow),
    collections: (collectionsResult.data || []) as CollectionSummary[],
    users: (usersResult.data || []) as CollectorProfile[],
  };
}
