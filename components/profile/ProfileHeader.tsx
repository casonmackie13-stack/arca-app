import Link from "next/link";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import FollowButton from "@/components/profile/FollowButton";
import { ButtonLink } from "@/components/ui/Button";
import type { CollectorProfile } from "@/lib/types";
import type { FollowCounts } from "@/lib/social/follows";
import { profilePath } from "@/lib/username";

export default function ProfileHeader({
  profile,
  counts,
  publicCardCount,
  publicCollectionCount,
  isSelf,
  isFollowing,
  onFollowChange,
}: {
  profile: CollectorProfile;
  counts: FollowCounts;
  publicCardCount: number;
  publicCollectionCount: number;
  isSelf: boolean;
  isFollowing: boolean;
  onFollowChange?: (following: boolean) => void;
}) {
  const username = profile.username || "collector";
  const displayName = profile.display_name || username;

  return <section className="border-b border-[var(--border-subtle)] pb-10 md:pb-12">
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none md:text-5xl">{displayName}</h1>
            <p className="mt-2 text-sm font-semibold text-[var(--text-tertiary)]">@{username}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSelf ? <ButtonLink href="/profile/edit" variant="secondary" size="sm">Edit profile</ButtonLink> : profile.id ? <FollowButton targetUserId={profile.id} initialFollowing={isFollowing} onChange={onFollowChange} /> : null}
          </div>
        </div>
        {profile.bio && <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">{profile.bio}</p>}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span><strong className="tabular-nums text-[var(--text-primary)]">{counts.followers}</strong> <span className="text-[var(--text-tertiary)]">followers</span></span>
          <span><strong className="tabular-nums text-[var(--text-primary)]">{counts.following}</strong> <span className="text-[var(--text-tertiary)]">following</span></span>
          <span><strong className="tabular-nums text-[var(--text-primary)]">{publicCardCount}</strong> <span className="text-[var(--text-tertiary)]">public cards</span></span>
          <span><strong className="tabular-nums text-[var(--text-primary)]">{publicCollectionCount}</strong> <span className="text-[var(--text-tertiary)]">public collections</span></span>
        </div>
        {isSelf && profile.username && <p className="mt-4 text-xs text-[var(--text-tertiary)]">Your public profile: <Link href={profilePath(profile.username)} className="text-[var(--gold-primary)] hover:underline">@{profile.username}</Link></p>}
      </div>
    </div>
  </section>;
}
