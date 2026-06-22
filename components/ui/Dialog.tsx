"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "./Icons";

export function Dialog({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="panel-elevated cinematic-enter w-full max-w-lg p-6 md:p-8">
      <div className="flex items-start justify-between gap-6"><div><p className="eyebrow">ARCA</p><h2 id="dialog-title" className="heading-2 mt-2">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}</div><button ref={closeRef} onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"><XIcon/></button></div>
      <div className="mt-6">{children}</div>
    </div>
  </div>;
}
