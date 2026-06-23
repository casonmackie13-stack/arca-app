import type { CollectorProfile } from "@/lib/types";

export default function ProfileAvatar({ profile, size = "lg" }: { profile: Pick<CollectorProfile, "username" | "display_name">; size?: "md" | "lg" }) {
  const label = profile.display_name || profile.username || "Collector";
  const initials = label.slice(0, 2).toUpperCase();
  const classes = size === "lg" ? "h-24 w-24 text-4xl md:h-28 md:w-28 md:text-5xl" : "h-16 w-16 text-2xl";
  return <div className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] font-display text-[var(--gold-primary)] ${classes}`} aria-hidden="true">{initials}</div>;
}
