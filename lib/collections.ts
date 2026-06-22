import { supabase } from "@/lib/supabase";
import type { CollectionSummary } from "@/lib/types";

export const UNSORTED_DESCRIPTION = "Cards awaiting a permanent collection.";

const collectionFields = "id,owner_id,name,category,visibility,description,created_at";

export async function ensureUnsortedCollection(userId: string): Promise<string> {
  const { data: existing, error: lookupError } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", userId)
    .ilike("name", "Unsorted")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("collections")
    .insert({
      owner_id: userId,
      name: "Unsorted",
      category: "Other",
      visibility: "private",
      description: UNSORTED_DESCRIPTION,
    })
    .select("id")
    .single();

  if (createError || !created) {
    if (createError?.code === "23505") {
      const { data: concurrent, error: concurrentError } = await supabase.from("collections").select("id").eq("owner_id", userId).ilike("name", "Unsorted").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (concurrentError) throw concurrentError;
      if (concurrent?.id) return concurrent.id;
    }
    throw createError || new Error("Unable to prepare your Unsorted collection.");
  }

  return created.id;
}

export async function loadOwnedCollections(userId: string): Promise<CollectionSummary[]> {
  const { data, error } = await supabase
    .from("collections")
    .select(collectionFields)
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data || []) as CollectionSummary[]).sort((a, b) => {
    const aUnsorted = a.name.toLowerCase() === "unsorted";
    const bUnsorted = b.name.toLowerCase() === "unsorted";
    if (aUnsorted !== bUnsorted) return aUnsorted ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
