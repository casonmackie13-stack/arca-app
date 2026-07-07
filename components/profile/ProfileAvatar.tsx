import Image from "next/image";
import type { CollectorProfile } from "@/lib/types";

export default function ProfileAvatar({
  profile,
  size = "lg",
}: {
  profile: Pick<CollectorProfile, "username" | "display_name" | "avatar_url">;
  size?: "md" | "lg";
}) {
  const label = profile.display_name || profile.username || "Collector";
  const initials = label.slice(0, 2).toUpperCase();
  const classes = size === "lg" ? "h-24 w-24 text-4xl md:h-28 md:w-28 md:text-5xl" : "h-16 w-16 text-2xl";

  if (profile.avatar_url) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface)] ${classes}`}>
        <Image src={profile.avatar_url} alt={`${label} avatar`} fill sizes={size === "lg" ? "112px" : "64px"} unoptimized className="object-cover" />
      </div>
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] font-display text-[var(--gold-primary)] ${classes}`} aria-hidden="true">
      {initials}
    </div>
  );
}
