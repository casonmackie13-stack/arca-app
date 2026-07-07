import { supabase } from "@/lib/supabase";
import type { CardSummary, CollectionSummary, CollectorProfile } from "@/lib/types";
import { normalizeUsername, validateBio, validateDisplayName, validateUsername } from "@/lib/username";

const profileFields = "id,username,display_name,bio,rank";
const collectionFields = "id,owner_id,name,category,visibility,description,cover_image_url,created_at";
const cardFields = "id,owner_id,collection_id,created_at,player_name,sport,year,brand,set_name,card_number,grader,grade,estimated_value,status,display_image_url,front_image_url,back_image_url,collection:collections(id,name)";

export type ProfileFormValue = {
  username: string;
  display_name: string;
  bio: string;
};

export function validateProfileForm(value: ProfileFormValue) {
  return validateUsername(value.username) || validateDisplayName(value.display_name) || validateBio(value.bio);
}

export async function getPublicProfileByUsername(username: string) {
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase
    .from("profiles")
    .select(profileFields)
    .ilike("username", normalized)
    .maybeSingle();

  if (error) throw error;
  return data as CollectorProfile | null;
}

export async function updateProfile(userId: string, value: ProfileFormValue) {
  const validationError = validateProfileForm(value);
  if (validationError) throw new Error(validationError);

  const payload = {
    username: normalizeUsername(value.username),
    display_name: value.display_name.trim(),
    bio: value.bio.trim() || null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select(profileFields)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw error;
  }

  return data as CollectorProfile;
}

export async function getPublicUserCollections(userId: string) {
  const { data, error } = await supabase
    .from("collections")
    .select(`${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`)
    .eq("owner_id", userId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CollectionSummary[];
}

export async function getOwnUserCollections(userId: string) {
  const { data, error } = await supabase
    .from("collections")
    .select(`${collectionFields}, cards ( id, display_image_url, front_image_url, back_image_url, card_images ( image_url, image_type ) )`)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as CollectionSummary[];
}

export async function getPublicUserCards(userId: string) {
  const { data: publicCollections, error: collectionsError } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", userId)
    .eq("visibility", "public");

  if (collectionsError) throw collectionsError;

  const publicCollectionIds = (publicCollections || []).map((collection) => collection.id);
  if (!publicCollectionIds.length) return [];

  const { data, error } = await supabase
    .from("cards")
    .select(`${cardFields}, card_images ( image_url, image_type )`)
    .eq("owner_id", userId)
    .in("collection_id", publicCollectionIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CardSummary[];
}

export async function getOwnUserCards(userId: string) {
  const { data, error } = await supabase
    .from("cards")
    .select(`${cardFields}, card_images ( image_url, image_type )`)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CardSummary[];
}

export async function countPublicUserCards(userId: string) {
  const { data: publicCollections, error: collectionsError } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", userId)
    .eq("visibility", "public");

  if (collectionsError) throw collectionsError;

  const publicCollectionIds = (publicCollections || []).map((collection) => collection.id);
  if (!publicCollectionIds.length) return 0;

  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .in("collection_id", publicCollectionIds);

  if (error) throw error;
  return count || 0;
}

export async function countPublicUserCollections(userId: string) {
  const { count, error } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("visibility", "public");

  if (error) throw error;
  return count || 0;
}
