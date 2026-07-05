"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PlusIcon, SparkIcon, UserIcon, VaultIcon } from "@/components/ui/Icons";
import ThemeToggle from "@/components/theme/ThemeToggle";

const items = [
  { href: "/", label: "Home", icon: HomeIcon, match: (path: string) => path === "/" },
  { href: "/collections", label: "Vault", icon: VaultIcon, match: (path: string) => path.startsWith("/collections") || path.startsWith("/cards") },
  { href: "/explore", label: "Explore", icon: SparkIcon, match: (path: string) => path.startsWith("/explore") || path.startsWith("/users") },
  { href: "/profile", label: "Profile", icon: UserIcon, match: (path: string) => path.startsWith("/profile") },
];

export function MobileNav() {
  const pathname = usePathname();
  const before = items.slice(0, 2), after = items.slice(2);
  return <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-5 items-end">{before.map((item) => <NavItem key={item.href} item={item} pathname={pathname}/>) }<Link href="/cards/new?scan=1" aria-label="Add card" className="mx-auto -mt-6 flex flex-col items-center gap-1 text-[10px] font-semibold text-[var(--gold-primary)]"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--gold-primary)] text-[var(--on-gold)] shadow-xl"><PlusIcon className="h-6 w-6"/></span><span>Add</span></Link>{after.map((item) => <NavItem key={item.href} item={item} pathname={pathname}/>)}</div></nav>;
}

function NavItem({ item, pathname }: { item: typeof items[number]; pathname: string }) {
  const active = item.match(pathname), Icon = item.icon;
  return <Link href={item.href} className={`relative flex min-h-12 flex-col items-center justify-end gap-1 text-[10px] font-semibold ${active ? "text-[var(--gold-primary)]" : "text-[var(--text-tertiary)]"}`}>{active && <span className="absolute top-0 h-0.5 w-5 rounded-full bg-[var(--gold-primary)]"/>}<Icon className="h-5 w-5"/><span>{item.label}</span></Link>;
}

export function DesktopNav() {
  const pathname = usePathname();
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-8 lg:flex"><Link href="/" className="wordmark">ARCA</Link><p className="mt-3 font-display text-xl text-[var(--text-secondary)]">Private Collection</p><nav className="mt-14 space-y-2">{items.slice(0,2).map((item) => <DesktopItem key={item.href} item={item} pathname={pathname}/>)}<Link href="/cards/new?scan=1" className="flex w-full items-center gap-3 rounded-lg bg-[var(--gold-primary)] px-4 py-3 text-sm font-semibold text-[var(--on-gold)]"><PlusIcon/>Add card</Link>{items.slice(2).map((item) => <DesktopItem key={item.href} item={item} pathname={pathname}/>)}</nav><div className="mt-auto"><ThemeToggle/><p className="mt-6 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Curate what matters.</p></div></aside>;
}

function DesktopItem({ item, pathname }: { item: typeof items[number]; pathname: string }) {
  const active = item.match(pathname), Icon = item.icon;
  return <Link href={item.href} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${active ? "bg-[var(--surface-hover)] text-[var(--gold-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`}><Icon/>{item.label}</Link>;
}
