"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, TextArea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Message, Panel } from "@/components/ui/Surface";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import type { CollectorProfile } from "@/lib/types";
import { updateProfile, type ProfileFormValue } from "@/lib/social/profiles";
import { BIO_MAX_LENGTH, profilePath, validateBio, validateDisplayName, validateUsername } from "@/lib/username";

export default function EditProfilePage() {
  const router = useRouter();
  const [value, setValue] = useState<ProfileFormValue>({ username: "", display_name: "", bio: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/auth");
        return;
      }
      const { data, error } = await supabase.from("profiles").select("username,display_name,bio").eq("id", authData.user.id).single();
      if (!active) return;
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      const profile = data as CollectorProfile;
      setValue({
        username: profile.username || "",
        display_name: profile.display_name || "",
        bio: profile.bio || "",
      });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function saveProfile() {
    const validationError = validateUsername(value.username) || validateDisplayName(value.display_name) || validateBio(value.bio);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/auth");
        return;
      }
      const profile = await updateProfile(authData.user.id, value);
      router.push(profilePath(profile.username || value.username));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to update profile.");
      setSaving(false);
    }
  }

  if (loading) return <main className="page-container"><PageHeader backHref="/profile" backLabel="Profile"/><p className="text-sm text-[var(--text-secondary)]">Loading profile…</p></main>;

  return <main className="page-container cinematic-enter"><div className="form-container">
    <PageHeader backHref="/profile" backLabel="Profile" />
    <p className="eyebrow">Public profile</p>
    <h1 className="display-l mt-3">Edit profile</h1>
    <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">Update how other collectors see you across ARCA.</p>

    <Panel className="mt-10 space-y-6 p-5 md:p-7">
      <Field label="Display name"><Input value={value.display_name} onChange={(event) => setValue((current) => ({ ...current, display_name: event.target.value }))} autoComplete="name"/></Field>
      <Field label="Username" helper="Lowercase letters, numbers, and underscores only."><Input value={value.username} onChange={(event) => setValue((current) => ({ ...current, username: event.target.value }))} autoComplete="username"/></Field>
      <Field label="Bio" optional helper={`${value.bio.length}/${BIO_MAX_LENGTH} characters`}><TextArea value={value.bio} onChange={(event) => setValue((current) => ({ ...current, bio: event.target.value.slice(0, BIO_MAX_LENGTH) }))} placeholder="Tell collectors what you collect."/></Field>
    </Panel>

    {message && <div className="mt-6"><Message>{message}</Message></div>}

    <div className="mt-8"><Button size="lg" disabled={saving} onClick={() => { void saveProfile(); }}>{saving ? "Saving…" : "Save profile"}</Button></div>
  </div></main>;
}
