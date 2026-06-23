import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/username";

function collectorName(user: User, preferredName = "") {
  const metadataName =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : "";

  return preferredName.trim() || metadataName.trim() || user.email?.split("@")[0] || "collector";
}

export async function ensureProfile(user: User, preferredName = "") {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return;

  const name = collectorName(user, preferredName);
  const username = normalizeUsername(name).replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || `collector_${user.id.slice(0, 6)}`;
  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name: name,
    rank: "I",
  });

  if (!insertError) return;
  if (insertError.code !== "23505") throw insertError;

  const { error: retryError } = await supabase.from("profiles").insert({
    id: user.id,
    username: `${username}_${user.id.slice(0, 6)}`,
    display_name: name,
    rank: "I",
  });

  if (retryError) throw retryError;
}
