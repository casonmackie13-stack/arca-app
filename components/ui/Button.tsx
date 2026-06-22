import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ButtonVariant } from "@/lib/types";

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-[var(--gold-primary)] text-[var(--on-gold)] hover:bg-[var(--gold-highlight)]",
  secondary: "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
  outline: "border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]",
  ghost: "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
  destructive: "border-[var(--status-error)] bg-transparent text-[var(--status-error)] hover:bg-[var(--status-error-bg)]",
};

const sizes = { sm: "h-10 px-4 text-sm", md: "h-12 px-5 text-sm", lg: "h-14 px-6 text-base" };

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", type = "button", className = "", children, ...props }: Props) {
  return <button type={type} className={`inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border font-semibold tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
}

export function ButtonLink({ href, variant = "primary", size = "md", className = "", children }: { href: string; variant?: ButtonVariant; size?: keyof typeof sizes; className?: string; children: ReactNode }) {
  return <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold tracking-[-0.01em] ${variants[variant]} ${sizes[size]} ${className}`}>{children}</Link>;
}
