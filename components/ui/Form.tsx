import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ label, helper, error, optional, children }: { label: string; helper?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block space-y-2">
    <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.13em] text-[var(--text-secondary)]">
      {label}{optional && <span className="font-normal normal-case tracking-normal text-[var(--text-tertiary)]">Optional</span>}
    </span>
    {children}
    {(helper || error) && <span className={`block text-xs leading-5 ${error ? "text-[var(--status-error)]" : "text-[var(--text-tertiary)]"}`}>{error || helper}</span>}
  </label>;
}

export const Input = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) => <input className={`field-control ${className}`} {...props} />;
export const Select = ({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={`field-control appearance-none ${className}`} {...props} />;
export const TextArea = ({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={`field-control min-h-32 resize-y ${className}`} {...props} />;

