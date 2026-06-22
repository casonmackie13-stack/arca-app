"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createMobileSafeId } from "@/lib/mobile-id";
import CollectionForm, { type CollectionFormValue } from "@/components/collection/CollectionForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewCollectionPage() {
  const router = useRouter();
  const [value, setValue] = useState<CollectionFormValue>({ name: "", description: "", category: "Basketball", visibility: "private" });
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  const chooseCover = (file: File | null) => { setCover(file); setPreview(file ? URL.createObjectURL(file) : null); };
  async function createCollection() {
    if (!value.name.trim()) { setMessage("A collection name is required."); return; }
    if (cover && (!cover.type.startsWith("image/") || cover.size > 10 * 1024 * 1024)) { setMessage("Choose an image file no larger than 10 MB."); return; }
    setSaving(true); setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.push("/auth"); return; }
    let coverUrl: string | null = null, coverPath: string | null = null;
    if (cover) {
      const ext = cover.name.split(".").pop()?.toLowerCase() || "jpg";
      coverPath = `${userData.user.id}/${Date.now()}-${createMobileSafeId()}.${ext}`;
      const { error } = await supabase.storage.from("collection_covers").upload(coverPath, cover, { contentType: cover.type, upsert: false });
      if (error) { setMessage(error.message); setSaving(false); return; }
      coverUrl = supabase.storage.from("collection_covers").getPublicUrl(coverPath).data.publicUrl;
    }
    const { data, error } = await supabase.from("collections").insert({ owner_id: userData.user.id, name: value.name.trim(), description: value.description.trim(), category: value.category, visibility: value.visibility, cover_image_url: coverUrl }).select("id").single();
    if (error || !data) { if (coverPath) await supabase.storage.from("collection_covers").remove([coverPath]); setMessage(error?.message || "Unable to create the collection."); setSaving(false); return; }
    router.push(`/collections/${data.id}`);
  }
  return <main className="page-container cinematic-enter"><div className="form-container"><PageHeader backHref="/collections" backLabel="Vault"/><p className="eyebrow">New exhibition</p><h1 className="display-l mt-3">Create a collection</h1><p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">Name the archive, establish its character, and choose how it will be seen.</p><div className="mt-10"><CollectionForm value={value} onChange={setValue} coverPreview={preview} coverFileName={cover?.name} onCoverChange={chooseCover} onSubmit={createCollection} saving={saving} message={message} submitLabel="Create collection"/></div></div></main>;
}
