"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createMobileSafeId } from "@/lib/mobile-id";
import CollectionForm, { type CollectionFormValue } from "@/components/collection/CollectionForm";
import { EmptyState, LoadingState, Message, Panel } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EditCollectionPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const [value, setValue] = useState<CollectionFormValue>({ name: "", description: "", category: "Other", visibility: "private" });
  const [currentCover, setCurrentCover] = useState<string | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [notFound, setNotFound] = useState(false), [isSystemUnsorted, setIsSystemUnsorted] = useState(false), [cardCount, setCardCount] = useState(0), [confirmOpen, setConfirmOpen] = useState(false), [deleting, setDeleting] = useState(false), [deleteMessage, setDeleteMessage] = useState("");
  useEffect(() => { (async () => { const { data: userData } = await supabase.auth.getUser(); if (!userData.user) { router.push("/auth"); return; } const [collectionResult, countResult] = await Promise.all([supabase.from("collections").select("name,description,category,visibility,cover_image_url").eq("id", id).eq("owner_id", userData.user.id).single(), supabase.from("cards").select("id", { count: "exact", head: true }).eq("collection_id", id).eq("owner_id", userData.user.id)]); const { data, error } = collectionResult; if (error || !data) { setMessage(error?.message || "Collection not found."); setNotFound(true); setLoading(false); return; } setValue({ name: data.name || "", description: data.description || "", category: data.category || "Other", visibility: data.visibility || "private" }); setIsSystemUnsorted((data.name || "").trim().toLowerCase() === "unsorted"); setCurrentCover(data.cover_image_url || null); setCardCount(countResult.count || 0); setLoading(false); })(); }, [id, router]);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  const chooseCover = (file: File | null) => { setCover(file); setPreview(file ? URL.createObjectURL(file) : null); };
  async function save() {
    if (!value.name.trim()) { setMessage("A collection name is required."); return; }
    if (cover && (!cover.type.startsWith("image/") || cover.size > 10 * 1024 * 1024)) { setMessage("Choose an image file no larger than 10 MB."); return; }
    setSaving(true); setMessage(""); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) { router.push("/auth"); return; }
    let nextCover = currentCover, uploadedPath: string | null = null;
    if (cover) { const ext = cover.name.split(".").pop()?.toLowerCase() || "jpg"; uploadedPath = `${userData.user.id}/${Date.now()}-${createMobileSafeId()}.${ext}`; const { error } = await supabase.storage.from("collection_covers").upload(uploadedPath, cover, { contentType: cover.type, upsert: false }); if (error) { setMessage(error.message); setSaving(false); return; } nextCover = supabase.storage.from("collection_covers").getPublicUrl(uploadedPath).data.publicUrl; }
    const { data, error } = await supabase.from("collections").update({ name: value.name.trim(), description: value.description.trim(), category: value.category, visibility: value.visibility, cover_image_url: nextCover }).eq("id", id).eq("owner_id", userData.user.id).select("id").single();
    if (error || !data) { if (uploadedPath) await supabase.storage.from("collection_covers").remove([uploadedPath]); setMessage(error?.message || "Unable to update the collection."); setSaving(false); return; }
    if (uploadedPath && currentCover) { const marker = "/storage/v1/object/public/collection_covers/", index = currentCover.indexOf(marker); if (index !== -1) await supabase.storage.from("collection_covers").remove([decodeURIComponent(currentCover.slice(index + marker.length))]); }
    router.push(`/collections/${id}`); router.refresh();
  }
  async function deleteCollection() {
    if (isSystemUnsorted) return;
    setDeleting(true); setDeleteMessage("");
    const { error } = await supabase.rpc("delete_collection_safely", { target_collection_id: id });
    if (error) { setDeleteMessage(error.message); setDeleting(false); setConfirmOpen(false); return; }
    router.push("/collections"); router.refresh();
  }
  if (loading) return <main className="page-container"><LoadingState label="Preparing the collection record…"/></main>;
  if (notFound) return <main className="page-container"><EmptyState title="Collection unavailable" description={message || "This collection could not be found in your vault."}/></main>;
  return <main className="page-container cinematic-enter"><div className="form-container"><PageHeader backHref={`/collections/${id}`} backLabel="Collection"/><p className="eyebrow">Collection record</p><h1 className="display-l mt-3">Edit the collection</h1><p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">Refine the presentation and provenance of this collection.</p><div className="mt-10"><CollectionForm value={value} onChange={setValue} coverPreview={preview || currentCover} coverFileName={cover?.name} onCoverChange={chooseCover} onSubmit={save} saving={saving} message={message} submitLabel="Save collection"/></div>{!isSystemUnsorted && <Panel className="mt-12 border-[var(--status-error)] p-5 md:p-7"><p className="eyebrow text-[var(--status-error)]">Danger zone</p><h2 className="heading-2 mt-2">Delete collection</h2><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{cardCount ? `${cardCount} card${cardCount === 1 ? "" : "s"} will be moved to Unsorted before this collection is deleted.` : "This empty collection will be permanently deleted."}</p>{deleteMessage && <div className="mt-5"><Message>{deleteMessage}</Message></div>}<Button className="mt-6" variant="destructive" onClick={() => setConfirmOpen(true)}>Delete collection</Button></Panel>}<Dialog open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)} title="Delete this collection?" description={`${cardCount ? `Its ${cardCount} card${cardCount === 1 ? "" : "s"} will be preserved in Unsorted. ` : ""}The collection itself will be permanently removed.`}><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(false)}>Keep collection</Button><Button variant="destructive" disabled={deleting} onClick={deleteCollection}>{deleting ? "Moving cards…" : "Move cards and delete"}</Button></div></Dialog></div></main>;
}
