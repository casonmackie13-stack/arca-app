"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FollowListCard from "@/components/profile/FollowListCard";
import { getFollowingState, getUserFollowers, getUserFollowing } from "@/lib/social/follows";
import { getPublicProfileByUsername } from "@/lib/social/profiles";
import { supabase } from "@/lib/supabase";
import type { CollectorProfile } from "@/lib/types";
import { EmptyState, LoadingState } from "@/components/ui/Surface";
import { PageHeader } from "@/components/ui/PageHeader";
import { profilePath } from "@/lib/username";

type FollowDirectoryMode = "followers" | "following";

export default function FollowDirectoryPage({ mode }: { mode: FollowDirectoryMode }) {
  const params = useParams();
  const username = decodeURIComponent(String(params.username || ""));
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [profiles, setProfiles] = useState<CollectorProfile[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const [{ data: authData }, profileData] = await Promise.all([
          supabase.auth.getUser(),
          getPublicProfileByUsername(username),
        ]);
        if (!active) return;
        if (!profileData?.id) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const viewer = authData.user?.id || null;
        const directory = mode === "followers"
          ? await getUserFollowers(profileData.id)
          : await getUserFollowing(profileData.id);
        const targetIds = directory.map((item) => item.id).filter(Boolean) as string[];
        const nextFollowing = viewer && targetIds.length ? await getFollowingState(viewer, targetIds) : new Set<string>();

        if (!active) return;
        setProfile(profileData);
        setProfiles(directory as CollectorProfile[]);
        setViewerId(viewer);
        setFollowingIds(nextFollowing);
      } catch (cause) {
        if (!active) return;
        console.error(cause);
        setProfile(null);
        setProfiles([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [mode, username]);

  if (loading) {
    return <main className="page-container"><LoadingState label={mode === "followers" ? "Loading followers…" : "Loading following…"} /></main>;
  }

  if (!profile?.username) {
    return <main className="page-container cinematic-enter"><PageHeader backHref="/explore" backLabel="Explore" /><EmptyState title="Collector not found" description="This profile may have been renamed or is no longer available." /></main>;
  }

  const title = mode === "followers" ? "Followers" : "Following";
  const displayName = profile.display_name || profile.username;

  function handleFollowChange(userId: string, following: boolean) {
    setFollowingIds((current) => {
      const next = new Set(current);
      if (following) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  return <main className="page-container cinematic-enter">
    <PageHeader backHref={profilePath(profile.username)} backLabel={displayName} />
    <section className="border-b border-[var(--border-subtle)] pb-8">
      <p className="eyebrow">@{profile.username}</p>
      <h1 className="display-l mt-3">{title}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
        {mode === "followers"
          ? `Collectors following ${displayName}.`
          : `Collectors ${displayName} follows.`}
      </p>
    </section>

    {profiles.length ? (
      <div className="mt-8 grid grid-cols-1 gap-4 pb-8 lg:grid-cols-2">
        {profiles.map((item) => (
          <FollowListCard
            key={item.id}
            profile={item}
            viewerId={viewerId}
            initialFollowing={item.id ? followingIds.has(item.id) : false}
            onFollowChange={(following) => item.id && handleFollowChange(item.id, following)}
          />
        ))}
      </div>
    ) : (
      <div className="mt-12 pb-8">
        <EmptyState
          title={mode === "followers" ? "No followers yet" : "Not following anyone yet"}
          description={mode === "followers" ? "When collectors follow this profile, they will appear here." : "When this collector follows others, they will appear here."}
        />
      </div>
    )}
  </main>;
}
