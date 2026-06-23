import { supabase } from "@/lib/supabase";

export type FollowCounts = {
  followers: number;
  following: number;
};

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [{ count: followers, error: followersError }, { count: following, error: followingError }] = await Promise.all([
    supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  if (followersError) throw followersError;
  if (followingError) throw followingError;

  return { followers: followers || 0, following: following || 0 };
}

export async function isFollowing(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) return false;

  const { data, error } = await supabase
    .from("user_follows")
    .select("id")
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
