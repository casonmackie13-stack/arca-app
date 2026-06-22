"use client";

import { useTheme } from "./ThemeProvider";
import { MoonIcon, SunIcon } from "@/components/ui/Icons";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className={`inline-flex touch-manipulation items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--gold-primary)] ${compact ? "h-11 w-11" : "h-11 gap-3 px-4 text-xs font-semibold uppercase tracking-[0.12em]"}`}>
    {theme === "dark" ? <SunIcon/> : <MoonIcon/>}{!compact && <span>{theme === "dark" ? "Gallery light" : "Vault dark"}</span>}
  </button>;
}
