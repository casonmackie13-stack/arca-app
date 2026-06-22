import { ButtonLink } from "@/components/ui/Button";
import { SparkIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Surface";

export default function ScanPage() {
  return <main className="page-container cinematic-enter"><div className="detail-container"><PageHeader backHref="/" backLabel="Home"/><Panel variant="elevated" className="relative overflow-hidden p-8 text-center md:p-16"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_srgb,var(--gold-primary)_20%,transparent),transparent_45%)]"/><div className="relative"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--gold-primary)]"><SparkIcon className="h-7 w-7"/></span><p className="eyebrow mt-8">In development</p><h1 className="display-l mt-4">Card scanning,<br/>refined.</h1><p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[var(--text-secondary)]">ARCA Scan will identify card details and prepare a catalogue record from a photograph. Until then, cards can be added manually from any collection.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><ButtonLink href="/collections">Choose a collection</ButtonLink><ButtonLink href="/" variant="ghost">Return home</ButtonLink></div></div></Panel></div></main>;
}
