"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import ProfileRankBadge from "@/components/profile/ProfileRankBadge";
import FollowButton from "@/components/profile/FollowButton";
import type { ExploreCollector } from "@/lib/social/explore";
import { profilePath } from "@/lib/username";

export default function ProfilePreviewCard({
  profile,
  isSelf,
  initialFollowing,
  followerCount,
  onFollowChange,
}: {
  profile: ExploreCollector;
  isSelf: boolean;
  initialFollowing: boolean;
  followerCount?: number;
  onFollowChange?: (following: boolean) => void;
}) {
  const username = profile.username || "collector";
  const displayName = profile.display_name || username;

  return (
    <article className="panel interactive-card flex flex-col gap-4 p-5">
      <Link href={profilePath(username)} className="flex min-w-0 items-center gap-4">
        <ProfileAvatar profile={profile} size="md" />
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none">{displayName}</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">@{username}</p>
          <div className="mt-2"><ProfileRankBadge rank={profile.rank} /></div>
        </div>
      </Link>
      {profile.bio && <p className="line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{profile.bio}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-tertiary)]">
          <span><strong className="tabular-nums text-[var(--text-primary)]">{followerCount ?? 0}</strong> followers</span>
          <span><strong className="tabular-nums text-[var(--text-primary)]">{profile.publicCollectionCount}</strong> public vault{profile.publicCollectionCount === 1 ? "" : "s"}</span>
        </div>
        {!isSelf && profile.id ? (
          <FollowButton targetUserId={profile.id} initialFollowing={initialFollowing} onChange={onFollowChange} />
        ) : null}
      </div>
    </article>
  );
}
