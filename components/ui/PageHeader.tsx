import Link from "next/link";
import { ArrowLeftIcon } from "./Icons";

export function PageHeader({ backHref, backLabel = "Back", action }: { backHref?: string; backLabel?: string; action?: React.ReactNode }) {
  return <header className="mb-12 flex min-h-10 items-center justify-between gap-4">
    {backHref ? <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--gold-primary)]"><ArrowLeftIcon className="h-4 w-4"/>{backLabel}</Link> : <span className="wordmark lg:hidden">ARCA</span>}
    {action}
  </header>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">{eyebrow}</p><h2 className="heading-2 mt-2">{title}</h2>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">{description}</p>}</div>{action}</div>;
}
