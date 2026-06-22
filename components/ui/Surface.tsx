import type { BadgeTone, PanelVariant } from "@/lib/types";

const panels: Record<PanelVariant, string> = {
  default: "panel",
  elevated: "panel-elevated",
  featured: "panel border-[var(--border-strong)]",
  interactive: "panel interactive-card",
};

export function Panel({ variant = "default", className = "", children }: { variant?: PanelVariant; className?: string; children: React.ReactNode }) {
  return <div className={`${panels[variant]} ${className}`}>{children}</div>;
}

const tones: Record<BadgeTone, string> = {
  neutral: "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)]",
  gold: "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--gold-primary)_10%,transparent)] text-[var(--gold-primary)]",
  success: "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)]",
  info: "border-[var(--status-info)] bg-[var(--status-info-bg)] text-[var(--status-info)]",
  warning: "border-[var(--status-warning)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  error: "border-[var(--status-error)] bg-[var(--status-error-bg)] text-[var(--status-error)]",
  trade: "border-[var(--status-trade)] bg-[var(--status-trade-bg)] text-[var(--status-trade)]",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize leading-none ${tones[tone]}`}>{children}</span>;
}

export function Stat({ value, label, note }: { value: React.ReactNode; label: string; note?: string }) {
  return <Panel className="p-5 md:p-6">
    <p className="font-display text-4xl leading-none text-[var(--text-primary)] tabular-nums md:text-5xl">{value}</p>
    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">{label}</p>
    {note && <p className="mt-2 text-xs text-[var(--text-tertiary)]">{note}</p>}
  </Panel>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="panel flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
    <p className="heading-2">{title}</p>
    <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>;
}

export function LoadingState({ label = "Opening the vault…" }: { label?: string }) {
  return <div className="flex min-h-56 items-center justify-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border border-[var(--border-strong)] border-t-[var(--gold-primary)]"/><p className="mt-4 text-sm text-[var(--text-secondary)]">{label}</p></div></div>;
}

export function Message({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${tone === "error" ? "border-[var(--status-error)] bg-[var(--status-error-bg)] text-[var(--status-error)]" : "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)]"}`}>{children}</p>;
}

