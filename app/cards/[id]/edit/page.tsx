"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CardFields from "@/components/card/CardFields";
import FlippableCard from "@/components/card/FlippableCard";
import CollectionSelector from "@/components/collection/CollectionSelector";
import QuickCollectionDialog from "@/components/collection/QuickCollectionDialog";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingState, Message, Panel } from "@/components/ui/Surface";
import { archiveOriginalImage } from "@/lib/card-autofill";
import { cardBackImage, cardFrontImage, cardImageStoragePath, imageByType } from "@/lib/card-images";
import { cardMutation, cardToForm, emptyCardForm, validateCardForm, validateOptionalCardImage } from "@/lib/card-form";
import { ensureUnsortedCollection, loadOwnedCollections } from "@/lib/collections";
import { supabase } from "@/lib/supabase";
import { createMobileSafeId } from "@/lib/mobile-id";
import type { CardImage, CardSummary, CollectionSummary } from "@/lib/types";

export default function EditCardPage() {
  const cardId = useParams().id as string;
  const router = useRouter();
  const [card, setCard] = useState<CardSummary | null>(null);
  const [form, setForm] = useState(() => ({ ...emptyCardForm }));
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [frontReplacement, setFrontReplacement] = useState<File | null>(null);
  const [backReplacement, setBackReplacement] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [removeBack, setRemoveBack] = useState(false);
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
        const loadedCard = cardResult.data as CardSummary;
        setCard(loadedCard);
        setForm(cardToForm(loadedCard));
        setCollections(ownedCollections);
        setSelectedCollectionId(ownedCollections.some((collection) => collection.id === loadedCard.collection_id) ? loadedCard.collection_id || unsortedId : unsortedId);
      } catch (cause) {
        if (active) { setMessage(cause instanceof Error ? cause.message : "Unable to prepare this card."); setNotFound(true); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [cardId, router]);

  useEffect(() => () => { if (frontPreview) URL.revokeObjectURL(frontPreview); if (backPreview) URL.revokeObjectURL(backPreview); }, [frontPreview, backPreview]);

  function chooseReplacement(side: "front" | "back", file: File | null) {
    const setFile = side === "front" ? setFrontReplacement : setBackReplacement;
    const setPreview = side === "front" ? setFrontPreview : setBackPreview;
    setFile(file); setMessage("");
    if (side === "back" && file) setRemoveBack(false);
    setPreview((current) => { if (current) URL.revokeObjectURL(current); return file ? URL.createObjectURL(file) : null; });
  }

  function handleCreated(collection: CollectionSummary) {
    setCollections((current) => [...current, collection]);
    setSelectedCollectionId(collection.id);
  }

  async function save() {
    if (!card) return;
    const validationError = validateCardForm(form, frontReplacement) || validateOptionalCardImage(backReplacement);
    if (validationError) { setMessage(validationError); return; }
    const existingFrontUrl = cardFrontImage(card);
    if (!frontReplacement && !existingFrontUrl) { setMessage("A front card image is required."); return; }

    setSaving(true); setMessage("");
    const uploadedPaths: string[] = [];
    const insertedRows: string[] = [];
    const changedRows: { row: CardImage; action: "updated" | "deleted" }[] = [];
    let rollbackComplete = true;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("Sign in to edit this card.");
      const userId = authData.user.id;
      const { data: destination, error: destinationError } = await supabase.from("collections").select("id").eq("id", selectedCollectionId).eq("owner_id", authData.user.id).maybeSingle();
      if (destinationError) throw destinationError;
      if (!destination) throw new Error("Choose one of your collections.");

      async function upload(file: File, side: "front" | "back") {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/cards/${Date.now()}-${side}-${createMobileSafeId()}.${extension}`;
        const { error } = await supabase.storage.from("card_images").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
        return supabase.storage.from("card_images").getPublicUrl(path).data.publicUrl;
      }

      const currentFrontRow = imageByType(card.card_images, "front");
      const currentBackRow = imageByType(card.card_images, "back");
      const nextFrontUrl = frontReplacement ? await upload(frontReplacement, "front") : existingFrontUrl;
      const nextBackUrl = removeBack ? null : backReplacement ? await upload(backReplacement, "back") : cardBackImage(card);

      async function replaceRow(type: "front" | "back", current: CardImage | null, nextUrl: string) {
        if (current?.id) {
          const { error } = await supabase.from("card_images").update({ image_url: nextUrl, image_type: type }).eq("id", current.id).eq("card_id", cardId);
          if (error) throw error;
          changedRows.push({ row: current, action: "updated" });
        } else {
          const { data, error } = await supabase.from("card_images").insert({ card_id: cardId, image_url: nextUrl, image_type: type }).select("id").single();
          if (error || !data) throw error || new Error(`Unable to save the ${type} image.`);
          insertedRows.push(data.id);
        }
      }

      if (frontReplacement && nextFrontUrl) await replaceRow("front", currentFrontRow, nextFrontUrl);
      if (backReplacement && nextBackUrl) await replaceRow("back", currentBackRow, nextBackUrl);
      if (removeBack && currentBackRow?.id) {
        const { error } = await supabase.from("card_images").delete().eq("id", currentBackRow.id).eq("card_id", cardId);
        if (error) throw error;
        changedRows.push({ row: currentBackRow, action: "deleted" });
      }

      const frontMetadata = frontReplacement && nextFrontUrl ? { original_image_url: nextFrontUrl, original_front_image_url: nextFrontUrl, front_image_url: nextFrontUrl, display_image_url: nextFrontUrl, image_source: "user_upload", image_source_url: null, image_replacement_status: "original" } : {};
      const backMetadata = backReplacement ? { original_back_image_url: nextBackUrl, back_image_url: nextBackUrl } : removeBack ? { original_back_image_url: null, back_image_url: null } : {};
      const { data: updated, error: updateError } = await supabase.from("cards").update({ ...cardMutation(form), collection_id: selectedCollectionId, ...frontMetadata, ...backMetadata }).eq("id", cardId).eq("owner_id", authData.user.id).select("id").single();
      if (updateError || !updated) throw updateError || new Error("Unable to update the card.");

      const obsoleteUrls = [frontReplacement ? currentFrontRow?.image_url : null, frontReplacement ? card.original_front_image_url : null, backReplacement || removeBack ? currentBackRow?.image_url : null, backReplacement || removeBack ? card.original_back_image_url : null];
      const obsoletePaths = obsoleteUrls.map(cardImageStoragePath).filter((path): path is string => Boolean(path));
      if (obsoletePaths.length) await supabase.storage.from("card_images").remove(obsoletePaths);

      try {
        const [frontArchivePath, backArchivePath] = await Promise.all([
          frontReplacement ? archiveOriginalImage(frontReplacement, authData.user.id) : Promise.resolve(null),
          backReplacement ? archiveOriginalImage(backReplacement, authData.user.id) : Promise.resolve(null),
        ]);
        await supabase.from("card_training_events").insert({ user_id: authData.user.id, card_id: cardId, original_front_image_path: frontArchivePath, original_back_image_path: backArchivePath, original_front_image_url: frontReplacement ? nextFrontUrl : card.original_front_image_url, original_back_image_url: nextBackUrl, display_image_url: frontReplacement ? nextFrontUrl : card.display_image_url, user_corrected_json: cardMutation(form), source: "manual_edit", archive_status: "saved", training_eligible: false });
      } catch { /* Editing the card remains successful. */ }

      router.push(`/cards/${cardId}`); router.refresh();
    } catch (cause) {
      for (const id of insertedRows) { const { error } = await supabase.from("card_images").delete().eq("id", id).eq("card_id", cardId); if (error) rollbackComplete = false; }
      for (const change of changedRows.reverse()) {
        if (change.action === "updated" && change.row.id) { const { error } = await supabase.from("card_images").update({ image_url: change.row.image_url, image_type: change.row.image_type }).eq("id", change.row.id).eq("card_id", cardId); if (error) rollbackComplete = false; }
        if (change.action === "deleted") { const { error } = await supabase.from("card_images").insert({ id: change.row.id, card_id: cardId, image_url: change.row.image_url, image_type: change.row.image_type }); if (error) rollbackComplete = false; }
      }
      if (rollbackComplete && uploadedPaths.length) await supabase.storage.from("card_images").remove(uploadedPaths);
      const reason = cause instanceof Error ? cause.message : "Unable to update the card.";
      setMessage(rollbackComplete ? reason : `${reason} A replacement image was preserved because its record could not be rolled back.`);
      setSaving(false);
    }
  }

  if (loading) return <main className="page-container"><LoadingState label="Preparing the card record…"/></main>;
  if (notFound || !card) return <main className="page-container"><EmptyState title="Card unavailable" description={message || "This card could not be found in your archive."}/></main>;
  const currentFrontUrl = frontPreview || cardFrontImage(card);
  const currentBackUrl = removeBack ? null : backPreview || cardBackImage(card);

  return <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref={`/cards/${cardId}`} backLabel="Card"/>
    <p className="eyebrow">Card record</p><h1 className="display-l mt-3">Edit the card</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">Refine its catalogue data, placement, and front/back images.</p>
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(280px,.75fr)_minmax(0,1.25fr)]">
      <div className="space-y-5 lg:sticky lg:top-8"><Panel className="p-5"><p className="eyebrow">Object preview</p>{currentFrontUrl && <div className="mt-5"><FlippableCard frontImageUrl={currentFrontUrl} backImageUrl={currentBackUrl} alt={form.playerName || "Card"}/></div>}</Panel><Panel className="space-y-7 p-5"><div><h2 className="heading-3">Front Image</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Keep the current front or choose a replacement.</p><div className="mt-4"><ImageUpload label="Replace front image" previewUrl={frontPreview} fileName={frontReplacement?.name} onChange={(file) => chooseReplacement("front", file)} aspect="card" cameraCapture allowRemove={Boolean(frontReplacement)}/></div></div><div className="border-t border-[var(--border-subtle)] pt-6"><h2 className="heading-3">Back Image</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Add back image for better autofill accuracy and full card view.</p><div className="mt-4"><ImageUpload label="Replace back image" previewUrl={backPreview} fileName={backReplacement?.name} onChange={(file) => chooseReplacement("back", file)} aspect="card" cameraCapture allowRemove={Boolean(backReplacement)}/></div>{cardBackImage(card) && !backReplacement && !removeBack && <Button className="mt-3 w-full" variant="ghost" onClick={() => setRemoveBack(true)}>Remove back image</Button>}{removeBack && <Button className="mt-3 w-full" variant="ghost" onClick={() => setRemoveBack(false)}>Keep existing back image</Button>}</div></Panel></div>
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
