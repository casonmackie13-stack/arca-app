"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CardFields from "@/components/card/CardFields";
import CollectionSelector from "@/components/collection/CollectionSelector";
import QuickCollectionDialog from "@/components/collection/QuickCollectionDialog";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingState, Message, Panel } from "@/components/ui/Surface";
import { cardMutation, cardToForm, emptyCardForm, validateCardForm } from "@/lib/card-form";
import { ensureUnsortedCollection, loadOwnedCollections } from "@/lib/collections";
import { supabase } from "@/lib/supabase";
import { createMobileSafeId } from "@/lib/mobile-id";
import type { CardImage, CardSummary, CollectionSummary } from "@/lib/types";

function storagePath(publicUrl: string) {
  const marker = "/storage/v1/object/public/card_images/";
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length));
}

export default function EditCardPage() {
  const cardId = useParams().id as string;
  const router = useRouter();
  const [form, setForm] = useState(() => ({ ...emptyCardForm }));
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [currentImage, setCurrentImage] = useState<CardImage | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) { router.replace("/auth"); return; }
        const unsortedId = await ensureUnsortedCollection(authData.user.id);
        const [ownedCollections, cardResult] = await Promise.all([
          loadOwnedCollections(authData.user.id),
          supabase.from("cards").select("*, card_images ( id, image_url, image_type )").eq("id", cardId).eq("owner_id", authData.user.id).single(),
        ]);
        if (cardResult.error || !cardResult.data) throw cardResult.error || new Error("Card not found.");
        if (!active) return;
        const card = cardResult.data as CardSummary;
        const images = card.card_images || [];
        setForm(cardToForm(card));
        setCollections(ownedCollections);
        setSelectedCollectionId(ownedCollections.some((collection) => collection.id === card.collection_id) ? card.collection_id || unsortedId : unsortedId);
        setCurrentImage(images.find((image) => image.image_type === "front") || images[0] || null);
      } catch (cause) {
        if (active) { setMessage(cause instanceof Error ? cause.message : "Unable to prepare this card."); setNotFound(true); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [cardId, router]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function chooseImage(file: File | null) {
    setReplacement(file);
    setPreview((current) => { if (current) URL.revokeObjectURL(current); return file ? URL.createObjectURL(file) : null; });
  }

  function handleCreated(collection: CollectionSummary) {
    setCollections((current) => [...current, collection]);
    setSelectedCollectionId(collection.id);
  }

  async function save() {
    const validationError = validateCardForm(form, replacement);
    if (validationError) { setMessage(validationError); return; }
    setSaving(true); setMessage("");
    let uploadedPath: string | null = null;
    let replacementRowId: string | null = null;
    let updatedExistingImage = false;
    let removeNewUploadOnFailure = true;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("Sign in to edit this card.");
      const { data: destination, error: destinationError } = await supabase.from("collections").select("id").eq("id", selectedCollectionId).eq("owner_id", authData.user.id).maybeSingle();
      if (destinationError) throw destinationError;
      if (!destination) throw new Error("Choose one of your collections.");

      if (replacement) {
        const extension = replacement.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedPath = `cards/${authData.user.id}-${Date.now()}-${createMobileSafeId()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("card_images").upload(uploadedPath, replacement, { contentType: replacement.type, upsert: false });
        if (uploadError) throw uploadError;
        const nextUrl = supabase.storage.from("card_images").getPublicUrl(uploadedPath).data.publicUrl;
        if (currentImage?.id) {
          const { error: imageError } = await supabase.from("card_images").update({ image_url: nextUrl, image_type: "front" }).eq("id", currentImage.id).eq("card_id", cardId);
          if (imageError) throw imageError;
          updatedExistingImage = true;
        } else {
          const { data: imageRow, error: imageError } = await supabase.from("card_images").insert({ card_id: cardId, image_url: nextUrl, image_type: "front" }).select("id").single();
          if (imageError || !imageRow) throw imageError || new Error("Unable to save the replacement image.");
          replacementRowId = imageRow.id;
        }
      }

      const { data: updated, error: updateError } = await supabase.from("cards").update({ ...cardMutation(form), collection_id: selectedCollectionId }).eq("id", cardId).eq("owner_id", authData.user.id).select("id").single();
      if (updateError || !updated) {
        if (updatedExistingImage && currentImage?.id) {
          const { error: rollbackError } = await supabase.from("card_images").update({ image_url: currentImage.image_url, image_type: currentImage.image_type || "front" }).eq("id", currentImage.id).eq("card_id", cardId);
          if (rollbackError) removeNewUploadOnFailure = false;
        }
        if (replacementRowId) {
          const { error: rollbackError } = await supabase.from("card_images").delete().eq("id", replacementRowId).eq("card_id", cardId);
          if (rollbackError) removeNewUploadOnFailure = false;
        }
        const reason = updateError?.message || "Unable to update the card.";
        throw new Error(removeNewUploadOnFailure ? reason : `${reason} The replacement image was preserved because its record could not be rolled back.`);
      }

      if (uploadedPath && currentImage?.image_url) {
        const oldPath = storagePath(currentImage.image_url);
        if (oldPath) await supabase.storage.from("card_images").remove([oldPath]);
      }
      router.push(`/cards/${cardId}`);
      router.refresh();
    } catch (cause) {
      if (uploadedPath && removeNewUploadOnFailure) await supabase.storage.from("card_images").remove([uploadedPath]);
      setMessage(cause instanceof Error ? cause.message : "Unable to update the card.");
      setSaving(false);
    }
  }

  if (loading) return <main className="page-container"><LoadingState label="Preparing the card record…"/></main>;
  if (notFound) return <main className="page-container"><EmptyState title="Card unavailable" description={message || "This card could not be found in your archive."}/></main>;
  return <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref={`/cards/${cardId}`} backLabel="Card"/>
    <p className="eyebrow">Card record</p><h1 className="display-l mt-3">Edit the card</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">Refine its catalogue data, placement, and front image.</p>
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(280px,.75fr)_minmax(0,1.25fr)]">
      <div className="lg:sticky lg:top-8"><Panel className="p-5"><p className="eyebrow">Object image</p><p className="mt-2 text-sm text-[var(--text-secondary)]">Keep the current image or choose a replacement.</p><div className="mt-5"><ImageUpload label={preview || currentImage ? "Replace front image" : "Add front image"} previewUrl={preview || currentImage?.image_url} fileName={replacement?.name} onChange={chooseImage} aspect="card" allowRemove={Boolean(replacement)}/></div></Panel></div>
      <div className="space-y-6">
        <Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Collection</p><h2 className="heading-2 mt-2">Place in the vault</h2></div><CollectionSelector collections={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} onCreate={() => setQuickCreateOpen(true)} disabled={saving}/></Panel>
        <CardFields value={form} onChange={setForm} disabled={saving}/>
        {message && <Message>{message}</Message>}
        <div className="sticky bottom-24 z-20 rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-3 backdrop-blur-xl lg:bottom-5"><Button size="lg" className="w-full" disabled={saving} onClick={save}>{saving ? "Preserving…" : "Save card"}</Button></div>
      </div>
    </div>
    <QuickCollectionDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={handleCreated}/>
  </div></main>;
}
