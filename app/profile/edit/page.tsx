"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Field, Input, TextArea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Message, Panel } from "@/components/ui/Surface";
import { PageHeader } from "@/components/ui/PageHeader";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { supabase } from "@/lib/supabase";
import type { CollectorProfile } from "@/lib/types";
import { updateProfile, type ProfileFormValue } from "@/lib/social/profiles";
import { BIO_MAX_LENGTH, profilePath, validateBio, validateDisplayName, validateUsername } from "@/lib/username";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<ProfileFormValue>({ username: "", display_name: "", bio: "", avatar_url: null });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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
      const { data, error } = await supabase.from("profiles").select("username,display_name,bio,avatar_url").eq("id", authData.user.id).single();
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
        avatar_url: profile.avatar_url || null,
      });
      setAvatarPreview(profile.avatar_url || null);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!AVATAR_TYPES.has(file.type)) {
      setMessage("Profile picture must be a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage("Profile picture must be 5MB or smaller.");
      return;
    }

    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function uploadAvatar(userId: string, file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

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

      let avatarUrl = value.avatar_url || null;
      if (avatarFile) avatarUrl = await uploadAvatar(authData.user.id, avatarFile);

      const profile = await updateProfile(authData.user.id, {
        ...value,
        avatar_url: avatarUrl,
      });
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
      <Field label="Profile picture" optional helper="JPG, PNG, or WebP up to 5MB.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            {avatarPreview ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[var(--border-strong)]">
                <Image src={avatarPreview} alt="Profile preview" fill sizes="96px" unoptimized className="object-cover" />
              </div>
            ) : (
              <ProfileAvatar profile={{ username: value.username, display_name: value.display_name }} size="lg" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
              Choose image
            </Button>
            {(avatarPreview || value.avatar_url) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => {
                  if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
                  setAvatarFile(null);
                  setAvatarPreview(null);
                  setValue((current) => ({ ...current, avatar_url: null }));
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>
      </Field>
      <Field label="Display name"><Input value={value.display_name} onChange={(event) => setValue((current) => ({ ...current, display_name: event.target.value }))} autoComplete="name"/></Field>
      <Field label="Username" helper="Lowercase letters, numbers, and underscores only."><Input value={value.username} onChange={(event) => setValue((current) => ({ ...current, username: event.target.value }))} autoComplete="username"/></Field>
      <Field label="Bio" optional helper={`${value.bio.length}/${BIO_MAX_LENGTH} characters`}><TextArea value={value.bio} onChange={(event) => setValue((current) => ({ ...current, bio: event.target.value.slice(0, BIO_MAX_LENGTH) }))} placeholder="Tell collectors what you collect."/></Field>
    </Panel>

    {message && <div className="mt-6"><Message>{message}</Message></div>}

    <div className="mt-8"><Button size="lg" disabled={saving} onClick={() => { void saveProfile(); }}>{saving ? "Saving…" : "Save profile"}</Button></div>
  </div></main>;
}
