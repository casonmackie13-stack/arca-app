import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    username: name,
    display_name: name,
    rank: "I",
  });

  if (!insertError) return;
  if (insertError.code !== "23505") throw insertError;

  const { error: retryError } = await supabase.from("profiles").insert({
    id: user.id,
    username: `${name}-${user.id.slice(0, 6)}`,
    display_name: name,
    rank: "I",
  });

  if (retryError) throw retryError;
}
