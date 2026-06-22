"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function ScanTypeSelector({ onSelect }: { onSelect: (type: ScanType) => void }) {
  return <div className="space-y-5">
    <div>
      <p className="eyebrow">Guided scan</p>
      <h3 className="heading-2 mt-2">What are you scanning?</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Choose the object type so ARCA can show the right capture frame.</p>
    </div>
    <div className="grid gap-3">
      {(Object.keys(scanTypeConfig) as ScanType[]).map((type) => {
        const item = scanTypeConfig[type];
        return <button key={type} type="button" onClick={() => onSelect(type)} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--gold-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)]">
          <span className="block text-base font-semibold text-[var(--text-primary)]">{item.title}</span>
          <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">{item.description}</span>
          <span className="mt-3 inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold-primary)]">{item.output.width}x{item.output.height}</span>
        </button>;
      })}
    </div>
  </div>;
}
