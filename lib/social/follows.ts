import { supabase } from "@/lib/supabase";

export type FollowCounts = {
  followers: number;
  following: number;
};

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [{ count: followers, error: followersError }, { count: following, error: followingError }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  if (followersError) throw followersError;
  if (followingError) throw followingError;

  return { followers: followers || 0, following: following || 0 };
}

export async function getFollowerCounts(userIds: string[]) {
  const counts = new Map<string, number>();
  if (!userIds.length) return counts;

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .in("following_id", userIds);

  if (error) throw error;

  for (const row of data || []) {
    counts.set(row.following_id, (counts.get(row.following_id) || 0) + 1);
  }

  return counts;
}

export async function getFollowingState(viewerId: string, targetUserIds: string[]) {
  const following = new Set<string>();
  if (!viewerId || !targetUserIds.length) return following;

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", targetUserIds);

  if (error) throw error;

  for (const row of data || []) following.add(row.following_id);
  return following;
}

export async function isFollowing(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) return false;

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function followUser(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) throw new Error("You cannot follow yourself.");

  const { error } = await supabase.from("user_follows").insert({
    follower_id: viewerId,
    following_id: targetUserId,
  });

  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

export async function unfollowUser(viewerId: string, targetUserId: string) {
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", viewerId)
    .eq("following_id", targetUserId);

  if (error) throw error;
}

const profileListFields = "id,username,display_name,bio,rank,avatar_url";

export async function getUserFollowers(profileId: string) {
  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id, created_at")
    .eq("following_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const ids = (data || []).map((row) => row.follower_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(profileListFields)
    .in("id", ids);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return ids
    .map((id) => profileMap.get(id))
    .filter(Boolean) as Array<{ id: string; username: string | null; display_name: string | null; bio: string | null; rank: string | null; avatar_url: string | null }>;
}

export async function getUserFollowing(profileId: string) {
  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id, created_at")
    .eq("follower_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const ids = (data || []).map((row) => row.following_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(profileListFields)
    .in("id", ids);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return ids
    .map((id) => profileMap.get(id))
    .filter(Boolean) as Array<{ id: string; username: string | null; display_name: string | null; bio: string | null; rank: string | null; avatar_url: string | null }>;
}
