"use client";

import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Field, Input } from "@/components/ui/Form";
import { EyeIcon, SparkIcon } from "@/components/ui/Icons";
import { Message } from "@/components/ui/Surface";
import ThemeToggle from "@/components/theme/ThemeToggle";

type AuthMode = "login" | "signup";
const AUTH_BUILD_MARKER = "mobile-auth-2026-06-21.4";

function collectorName(user: User, preferredName = "") {
  const metadataName =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : "";

  return (
    preferredName.trim() ||
    metadataName.trim() ||
    user.email?.split("@")[0] ||
    "collector"
  );
}

async function ensureProfile(user: User, preferredName = "") {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return;

  const name = collectorName(user, preferredName);

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    username: name,
    display_name: name,
    rank: "I",
  });

  if (!insertError) return;
  if (insertError.code !== "23505") throw insertError;

  const uniqueName = `${name}-${user.id.slice(0, 6)}`;

  const { error: retryError } = await supabase.from("profiles").insert({
    id: user.id,
    username: uniqueName,
    display_name: name,
    rank: "I",
  });

  if (retryError) throw retryError;
}

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;
        if (!active) return;

        if (data.session?.user) {
          setLoading(true);
          await ensureProfile(data.session.user);
          if (!active) return;
          router.replace("/");
          router.refresh();
        }
      } catch (error) {
        if (active) {
          setLoading(false);
          setSuccess(false);
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to restore your session."
          );
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [router]);

  function changeMode(nextMode: AuthMode) {
    if (loading) return;

    setMode(nextMode);
    setMessage("");
    setSuccess(false);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    setMessage("");
    setSuccess(false);

    if (!normalizedEmail || !password || (mode === "signup" && !normalizedUsername)) {
      setMessage("Complete all required fields.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) throw error;

        if (!data.session || !data.user) {
          throw new Error("ARCA could not establish a session. Please try again.");
        }

        await ensureProfile(data.user);
        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
            display_name: normalizedUsername,
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      if (data.session && data.user) {
        await ensureProfile(data.user, normalizedUsername);
        router.replace("/");
        router.refresh();
        return;
      }

      setSuccess(true);
      setMessage(
        "Account created. Check your email to confirm your address, then return to ARCA."
      );
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--background)] text-[var(--text-primary)] lg:grid lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden min-h-[100dvh] overflow-hidden border-r border-[var(--border-subtle)] bg-black p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,var(--auth-glow-one)_0,transparent_35%),radial-gradient(circle_at_80%_75%,var(--auth-glow-two)_0,transparent_40%)] opacity-80" />

        <div className="relative z-10">
          <p className="wordmark">ARCA</p>
        </div>

        <div className="relative z-10 max-w-2xl">
          <SparkIcon className="h-8 w-8 text-[var(--gold-highlight)]" />

          <h1 className="display-xl mt-7 text-white">
            Every collection
            <br />
            has a story.
          </h1>

          <p className="mt-7 max-w-lg text-base leading-8 text-white/60">
            A private digital archive for the cards, memories, and provenance
            worth preserving.
          </p>
        </div>

        <p className="relative z-10 text-[10px] uppercase tracking-[0.18em] text-white/40">
          Private collection platform
        </p>
      </section>

      <section className="relative z-10 flex min-h-[100dvh] items-start justify-center overflow-y-auto px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] md:px-10 lg:items-center">
        <div className="cinematic-enter relative z-10 w-full max-w-md">
          <div className="flex items-center justify-between lg:justify-end">
            <span className="wordmark lg:hidden">ARCA</span>
            <ThemeToggle compact />
          </div>

          <div className="mt-12 sm:mt-16 lg:mt-0">
            <p className="eyebrow">Private access</p>

            <h2 className="display-l mt-3">
              {mode === "login" ? "Welcome back" : "Begin your archive"}
            </h2>

            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              {mode === "login"
                ? "Enter the vault and continue your collection."
                : "Create your collector profile and preserve your first story."}
            </p>
          </div>

          <form
            className="mt-9"
            method="post"
            onSubmit={handleAuth}
            aria-busy={loading}
            data-auth-build={AUTH_BUILD_MARKER}
            noValidate
          >
            <fieldset disabled={loading} className="min-w-0 disabled:cursor-wait">
              <legend className="sr-only">ARCA account access</legend>

              <div className="grid grid-cols-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
                <button
                  type="button"
                  onClick={() => changeMode("login")}
                  className={`min-h-11 touch-manipulation rounded-md px-3 text-sm font-semibold ${
                    mode === "login"
                      ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-tertiary)]"
                  }`}
                  aria-pressed={mode === "login"}
                >
                  Log in
                </button>

                <button
                  type="button"
                  onClick={() => changeMode("signup")}
                  className={`min-h-11 touch-manipulation rounded-md px-3 text-sm font-semibold ${
                    mode === "signup"
                      ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-tertiary)]"
                  }`}
                  aria-pressed={mode === "signup"}
                >
                  Create account
                </button>
              </div>

              <div className="mt-7 space-y-5">
                {mode === "signup" && (
                  <Field label="Collector name">
                    <Input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      placeholder="Your public collector name"
                      required
                    />
                  </Field>
                )}

                <Field label="Email address">
                  <Input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="collector@example.com"
                    required
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      placeholder="••••••••"
                      className="pr-14"
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--gold-primary)]"
                    >
                      <EyeIcon />
                    </button>
                  </div>
                </Field>

                <div aria-live={success ? "polite" : "assertive"} aria-atomic="true">
                  {message && (
                    <Message tone={success ? "success" : "error"}>
                      {message}
                    </Message>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    data-auth-submit
                    className="min-h-14 w-full touch-manipulation rounded-lg bg-[var(--gold-primary)] px-6 text-base font-semibold text-[var(--on-gold)] disabled:cursor-wait disabled:opacity-50"
                  >
                    {loading
                      ? "Opening the vault…"
                      : mode === "login"
                        ? "Enter ARCA"
                        : "Create collector account"}
                  </button>
                </div>
              </div>
            </fieldset>
            <p
              className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
              data-auth-debug
            >
              {AUTH_BUILD_MARKER} · {hydrated ? "JS ready" : "HTML loaded"}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
