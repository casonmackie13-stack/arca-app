"use client";

import type { ScanType } from "@/components/scanner/scanTypes";
import { scanTypeConfig } from "@/components/scanner/scanTypes";

export default function ScanTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: ScanType;
  onChange: (type: ScanType) => void;
  disabled?: boolean;
}) {
  const options: ScanType[] = ["raw", "graded"];

  return <div className="inline-flex rounded-full border border-white/20 bg-black/55 p-1 backdrop-blur" role="tablist" aria-label="Scan type">
    {options.map((type) => {
      const active = value === type;
      return <button
        key={type}
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={() => onChange(type)}
        className={`min-w-[4.5rem] rounded-full px-4 py-2 text-xs font-semibold transition ${active ? "bg-[var(--gold-primary)] text-black shadow-sm" : "text-white/75 hover:text-white"} disabled:opacity-50`}
      >
        {scanTypeConfig[type].label}
      </button>;
    })}
  </div>;
}
