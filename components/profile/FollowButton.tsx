"use client";

import { useState } from "react";
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

  async function toggleFollow() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }

      if (following) {
        await unfollowUser(data.user.id, targetUserId);
        setFollowing(false);
        onChange?.(false);
      } else {
        await followUser(data.user.id, targetUserId);
        setFollowing(true);
        onChange?.(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return <Button variant={following ? "outline" : "primary"} size="sm" disabled={busy} onClick={() => { void toggleFollow(); }}>
    {busy ? "Updating…" : following ? "Following" : "Follow"}
  </Button>;
}
