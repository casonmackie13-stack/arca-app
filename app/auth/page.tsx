"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/auth-profile";
import { getAuthCallbackUrl } from "@/lib/auth-url";
import { Field, Input } from "@/components/ui/Form";
import { EyeIcon } from "@/components/ui/Icons";
import { Message } from "@/components/ui/Surface";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AuthMarketingCarousel from "@/components/auth/AuthMarketingCarousel";

type AuthMode = "login" | "signup";
const AUTH_BUILD_MARKER = "MOBILE-AUTH · ARCA · JS READY";

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
          emailRedirectTo: getAuthCallbackUrl(),
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
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#050504] p-3 text-[var(--text-primary)] sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(201,164,93,.11),transparent_30%),radial-gradient(circle_at_88%_85%,rgba(138,103,51,.08),transparent_28%)]" />
      <div className="relative z-10 mx-auto grid max-w-[1500px] gap-3 sm:gap-5 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1.18fr)_minmax(420px,.82fr)]">
        <AuthMarketingCarousel />

        <section className="relative z-20 flex min-h-[42rem] items-start justify-center overflow-y-auto rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-[var(--shadow)] sm:px-10 lg:items-center lg:px-12 lg:py-12">
          <div className="cinematic-enter relative z-20 w-full max-w-md">
            <div className="flex items-center justify-between">
              <div className="relative h-16 w-12"><Image src="/arcalogo/arca.arch.png" alt="ARCA arch emblem" fill sizes="48px" className="object-contain" /></div>
              <ThemeToggle compact />
            </div>

            <div className="mt-9">
            <p className="eyebrow">Private access</p>

            <h2 className="display-l mt-3">
              {mode === "login" ? "Welcome back" : "Create your vault"}
            </h2>

            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              {mode === "login"
                ? "Enter the vault and continue your collection."
                : "Create your account and begin building your digital collection."}
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
                        : "Create Account"}
                  </button>
                </div>
              </div>
            </fieldset>
            <p
              className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
              data-auth-debug
            >
              {AUTH_BUILD_MARKER}
            </p>
          </form>
          </div>
        </section>
      </div>
    </main>
  );
}
