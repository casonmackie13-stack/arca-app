"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileRankBadge from "@/components/profile/ProfileRankBadge";
import FollowButton from "@/components/profile/FollowButton";
import type { CollectorProfile } from "@/lib/types";
import { profilePath } from "@/lib/username";

export default function FollowListCard({
  profile,
  viewerId,
  initialFollowing,
  onFollowChange,
}: {
  profile: CollectorProfile;
  viewerId: string | null;
  initialFollowing: boolean;
  onFollowChange?: (following: boolean) => void;
}) {
  if (!profile.username) return null;

  const username = profile.username;
  const displayName = profile.display_name || username;
  const isSelf = profile.id === viewerId;

  return (
    <article className="panel interactive-card flex items-center gap-4 p-5">
      <Link href={profilePath(username)} className="flex min-w-0 flex-1 items-center gap-4">
        <ProfileAvatar profile={profile} size="md" />
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none">{displayName}</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">@{username}</p>
          <div className="mt-3"><ProfileRankBadge rank={profile.rank} /></div>
        </div>
      </Link>
      {!isSelf && profile.id ? (
        <FollowButton targetUserId={profile.id} initialFollowing={initialFollowing} onChange={onFollowChange} />
      ) : null}
    </article>
  );
}
