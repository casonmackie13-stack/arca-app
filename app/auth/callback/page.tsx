"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureProfile } from "@/lib/auth-profile";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function completeConfirmation() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const authError =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");
        if (authError) throw new Error(authError.replace(/\+/g, " "));

        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) throw new Error("The confirmation link is invalid or has expired. Please request a new confirmation email.");

        await ensureProfile(data.session.user);
        if (!active) return;
        router.replace("/");
        router.refresh();
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : "ARCA could not confirm this account.");
      }
    }

    void completeConfirmation();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-5 py-12 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,var(--auth-glow-one)_0,transparent_42%)] opacity-70" />
      <section className="panel-elevated relative z-10 w-full max-w-md p-7 text-center md:p-10" aria-live="polite">
        <p className="wordmark">ARCA</p>
        <p className="eyebrow mt-10">Account confirmation</p>
        <h1 className="heading-1 mt-3">{errorMessage ? "Confirmation interrupted" : "Opening your vault"}</h1>
        <p className={`mt-4 text-sm leading-6 ${errorMessage ? "text-[var(--status-error)]" : "text-[var(--text-secondary)]"}`}>
          {errorMessage || "Confirming your email and preparing your collector profile…"}
        </p>
        {errorMessage && <Link href="/auth" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--gold-primary)] px-6 text-sm font-semibold text-[var(--on-gold)]">Return to account access</Link>}
      </section>
    </main>
  );
}
