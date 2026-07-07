"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { followUser, unfollowUser } from "@/lib/social/follows";
import { supabase } from "@/lib/supabase";

export default function FollowButton({
  targetUserId,
  initialFollowing,
  onChange,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing, targetUserId]);

  async function toggleFollow() {
    setBusy(true);
    setError("");
    const previous = following;
    const next = !following;
    setFollowing(next);
    onChange?.(next);

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setFollowing(previous);
        onChange?.(previous);
        router.push("/auth");
        return;
      }

      if (next) {
        await followUser(data.user.id, targetUserId);
      } else {
        await unfollowUser(data.user.id, targetUserId);
      }
    } catch (cause) {
      setFollowing(previous);
      onChange?.(previous);
      setError(cause instanceof Error ? cause.message : "Unable to update follow.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={following ? "outline" : "primary"} size="sm" disabled={busy} onClick={() => { void toggleFollow(); }}>
        {busy ? "Updating…" : following ? "Following" : "Follow"}
      </Button>
      {error && <span className="max-w-[12rem] text-right text-[10px] text-[var(--status-error)]">{error}</span>}
    </div>
  );
}
