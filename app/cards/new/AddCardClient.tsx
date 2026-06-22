"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddCardProgress from "@/components/card/AddCardProgress";
import CardFields from "@/components/card/CardFields";
import DisplayImagePanel from "@/components/card/DisplayImagePanel";
import RecentSalesPanel from "@/components/card/RecentSalesPanel";
import CollectionSelector from "@/components/collection/CollectionSelector";
import QuickCollectionDialog from "@/components/collection/QuickCollectionDialog";
import ArcaImage from "@/components/ui/ArcaImage";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { Message, Panel } from "@/components/ui/Surface";
import { archiveOriginalImage, autofillCardInfo, fetchRecentSales, lookupDisplayImage } from "@/lib/card-autofill";
import {
  cardMutation,
  emptyCardForm,
  validateCardForm,
  validateCardGrading,
  validateCardIdentity,
  validateCardValue,
  validateRequiredCardImage,
} from "@/lib/card-form";
import { ensureUnsortedCollection, loadOwnedCollections } from "@/lib/collections";
import { createMobileSafeId } from "@/lib/mobile-id";
import { supabase } from "@/lib/supabase";
import type { CollectionSummary } from "@/lib/types";
import type { CardAutofillResponse, CardImageLookupResponse, CardSalesResponse, ImageSuggestion } from "@/lib/card-intelligence";

const steps = ["Capture image", "Card details", "Condition", "Collection", "Value", "Review & save"] as const;

export default function AddCardClient({ initialCollectionId }: { initialCollectionId?: string }) {
  const router = useRouter();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(() => ({ ...emptyCardForm }));
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionError, setCollectionError] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");
  const [autofillResult, setAutofillResult] = useState<CardAutofillResponse | null>(null);
  const [sales, setSales] = useState<CardSalesResponse | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [imageLookup, setImageLookup] = useState<CardImageLookupResponse | null>(null);
  const [selectedDisplayImage, setSelectedDisplayImage] = useState<ImageSuggestion | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCollections() {
      setCollectionsLoading(true);
      setCollectionError("");
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) { router.replace("/auth"); return; }
        const unsortedId = await ensureUnsortedCollection(data.user.id);
        const owned = await loadOwnedCollections(data.user.id);
        if (!active) return;
        setCollections(owned);
        const requestedIsOwned = initialCollectionId && owned.some((collection) => collection.id === initialCollectionId);
        setSelectedCollectionId(requestedIsOwned ? initialCollectionId : unsortedId);
      } catch (cause) {
        if (active) setCollectionError(cause instanceof Error ? cause.message : "Unable to load your collections.");
      } finally {
        if (active) setCollectionsLoading(false);
      }
    }
    loadCollections();
    return () => { active = false; };
  }, [initialCollectionId, router]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const chooseImage = (file: File | null) => {
    setImageFile(file);
    setMessage("");
    setAutofillMessage("");
    setAutofillResult(null); setSales(null); setSalesError(""); setImageLookup(null); setSelectedDisplayImage(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  function handleCollectionCreated(collection: CollectionSummary) {
    setCollections((current) => [...current, collection]);
    setSelectedCollectionId(collection.id);
    setCollectionError("");
  }

  function stepError(step: number) {
    if (step === 0) return validateRequiredCardImage(imageFile);
    if (step === 1) return validateCardIdentity(form);
    if (step === 2) return validateCardGrading(form);
    if (step === 3) {
      if (collectionsLoading) return "Your collections are still loading.";
      if (collectionError) return collectionError;
      if (!selectedCollectionId) return "Choose a collection before continuing.";
    }
    if (step === 4) return validateCardValue(form);
    return "";
  }

  function moveToStep(nextStep: number) {
    setCurrentStep(nextStep);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => stepHeadingRef.current?.focus(), 250);
  }

  function continueFlow() {
    const error = stepError(currentStep);
    if (error) { setMessage(error); return; }
    moveToStep(Math.min(currentStep + 1, steps.length - 1));
  }

  async function runAutofill() {
    if (!imageFile || autofilling) return;
    setAutofilling(true);
    setAutofillMessage("");
    try {
      const result = await autofillCardInfo(imageFile);
      setAutofillResult(result);
      const ai = result.card;
      setForm((current) => ({
        ...current,
        playerName: current.playerName || ai.player_name,
        sport: current.sport === "Basketball" ? (ai.sport || current.sport) : current.sport,
        year: current.year || ai.year,
        brand: current.brand || ai.brand,
        setName: current.setName || ai.set_name,
        cardNumber: current.cardNumber || ai.card_number,
        team: current.team || ai.team,
        parallel: current.parallel || ai.parallel,
        rookieCard: current.rookieCard === "unknown" && ai.rookie_card != null ? (ai.rookie_card ? "yes" : "no") : current.rookieCard,
        serialNumber: current.serialNumber || ai.serial_number,
        grader: current.grader === "Raw" && ai.grade_company ? ai.grade_company : current.grader,
        grade: current.grade || ai.grade,
        condition: current.condition || ai.condition,
        estimatedValue: current.estimatedValue || ai.estimated_value,
        notes: current.notes || ai.notes,
      }));
      setAutofillMessage(`Card details extracted with ${Math.round(ai.confidence * 100)}% overall confidence. Review every field before saving.`);
      setSalesLoading(true); setSalesError("");
      const [salesResult, imageResult] = await Promise.allSettled([fetchRecentSales(ai as unknown as Record<string, unknown>, result.sales_query), lookupDisplayImage(ai as unknown as Record<string, unknown>)]);
      if (salesResult.status === "fulfilled") setSales(salesResult.value); else setSalesError(salesResult.reason instanceof Error ? salesResult.reason.message : "Recent sales are unavailable.");
      if (imageResult.status === "fulfilled") setImageLookup(imageResult.value);
      setSalesLoading(false);
    } catch (cause) {
      setAutofillMessage(cause instanceof Error ? cause.message : "Couldn’t autofill this card. Enter details manually.");
    } finally {
      setAutofilling(false);
    }
  }

  async function removeUploadedObject(path: string | null) {
    if (path) await supabase.storage.from("card_images").remove([path]);
  }

  async function addCard() {
    const imageToUpload = imageFile;
    const imageError = validateRequiredCardImage(imageToUpload);
    if (imageError) { moveToStep(0); setMessage(imageError); return; }
    const validationError = validateCardForm(form, imageToUpload);
    if (validationError) {
      const invalidStep = validateCardIdentity(form) ? 1 : validateCardGrading(form) ? 2 : 4;
      moveToStep(invalidStep);
      setMessage(validationError);
      return;
    }
    const collectionValidationError = stepError(3);
    if (collectionValidationError) { moveToStep(3); setMessage(collectionValidationError); return; }
    if (!imageToUpload) { moveToStep(0); setMessage("A card image is required."); return; }

    setSaving(true);
    setMessage("");
    let uploadedPath: string | null = null;
    let createdCardId: string | null = null;
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) { router.push("/auth"); return; }

      let collectionId = selectedCollectionId;
      const { data: ownedCollection, error: ownershipError } = await supabase.from("collections").select("id").eq("id", collectionId).eq("owner_id", userData.user.id).maybeSingle();
      if (ownershipError) throw ownershipError;
      if (!ownedCollection) collectionId = await ensureUnsortedCollection(userData.user.id);

      const ext = imageToUpload.name.split(".").pop()?.toLowerCase() || "jpg";
      uploadedPath = `cards/${userData.user.id}-${Date.now()}-${createMobileSafeId()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("card_images").upload(uploadedPath, imageToUpload, { contentType: imageToUpload.type, upsert: false });
      if (uploadError) throw uploadError;
      const imageUrl = supabase.storage.from("card_images").getPublicUrl(uploadedPath).data.publicUrl;
      const displayImageUrl = selectedDisplayImage?.image_url || imageUrl;

      const { data: card, error: cardError } = await supabase.from("cards").insert({
        owner_id: userData.user.id,
        collection_id: collectionId,
        ...cardMutation(form),
        original_image_url: imageUrl,
        display_image_url: displayImageUrl,
        image_source: selectedDisplayImage?.source || "user_upload",
        image_source_url: selectedDisplayImage?.source_url || null,
        image_replacement_status: selectedDisplayImage ? "accepted_suggestion" : "original",
      }).select("id").single();
      if (cardError || !card) {
        await removeUploadedObject(uploadedPath);
        uploadedPath = null;
        throw cardError || new Error("Unable to create the card record.");
      }
      createdCardId = card.id;

      const { error: imageRowError } = await supabase.from("card_images").insert({ card_id: card.id, image_url: displayImageUrl, image_type: "front" });
      if (imageRowError) {
        await supabase.from("cards").delete().eq("id", card.id).eq("owner_id", userData.user.id);
        await removeUploadedObject(uploadedPath);
        createdCardId = null;
        uploadedPath = null;
        throw imageRowError;
      }

      // Intelligence archiving is deliberately fail-open: a training-log problem must never undo a saved card.
      try {
        const archivePath = autofillResult?.archive_path || await archiveOriginalImage(imageToUpload, userData.user.id);
        const corrected = cardMutation(form);
        const extracted = autofillResult?.card || {};
        const correctedRecord = corrected as Record<string, unknown>;
        const feedback = Object.fromEntries(Object.entries(extracted).filter(([key]) => key !== "confidence").map(([key, original]) => {
          const correctedKey = key === "grade_company" ? "grader" : key;
          const finalValue = correctedRecord[correctedKey] ?? null;
          return [key, { accepted: String(finalValue ?? "") === String(original ?? ""), original, final: finalValue }];
        }));
        const archiveRecord = { card_id: card.id, original_image_path: archivePath, original_image_url: imageUrl, display_image_url: displayImageUrl, ai_extracted_json: extracted, user_corrected_json: corrected, field_feedback_json: feedback, sales_query: autofillResult?.sales_query || null, sales_results_json: sales?.sales || [], confidence: autofillResult?.card.confidence ?? null, source: autofillResult ? "openai_vision" : "manual", archive_status: "saved", training_eligible: false, updated_at: new Date().toISOString() };
        if (autofillResult?.training_event_id) await supabase.from("card_training_events").update(archiveRecord).eq("id", autofillResult.training_event_id).eq("user_id", userData.user.id);
        else await supabase.from("card_training_events").insert({ user_id: userData.user.id, ...archiveRecord });
      } catch { /* Card save remains successful. */ }

      router.push(`/cards/${card.id}`);
    } catch (cause) {
      if (uploadedPath && !createdCardId) await removeUploadedObject(uploadedPath);
      setMessage(cause instanceof Error ? cause.message : "Something went wrong while cataloguing the card.");
      setSaving(false);
    }
  }

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const displayValue = form.estimatedValue.replace(/[$,]/g, "").trim();

  return <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref="/collections" backLabel="Vault"/>
    <p className="eyebrow">New acquisition</p>
    <h1 className="display-l mt-3">Catalogue a card</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">A guided record for the object, its certification, and its place in your collection.</p>

    <div className="mt-8"><AddCardProgress steps={steps} currentStep={currentStep}/></div>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(280px,.75fr)_minmax(0,1.25fr)]">
      <div className="hidden lg:sticky lg:top-8 lg:block">
        <Panel className="p-5">
          <p className="eyebrow">Object preview</p>
          {preview ? <div className="image-reveal relative mt-5 aspect-[2.5/3.5] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black"><ArcaImage src={preview} alt="Selected card preview" className="object-contain"/></div> : <div className="mt-5 flex aspect-[2.5/3.5] items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] px-6 text-center text-sm leading-6 text-[var(--text-tertiary)]">Your card image will remain here as you catalogue it.</div>}
        </Panel>
      </div>

      <section aria-labelledby="add-card-step-title" className="min-w-0 space-y-6">
        <h2 id="add-card-step-title" ref={stepHeadingRef} tabIndex={-1} className="sr-only">{steps[currentStep]}</h2>

        {currentStep === 0 && <Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Capture image</p><h3 className="heading-2 mt-2">Photograph the card</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Use the rear camera or select a clear image from your library.</p></div><ImageUpload label="Upload card image" previewUrl={preview} fileName={imageFile?.name} onChange={chooseImage} aspect="card" cameraCapture hidePreviewOnDesktop/></Panel>}

        {currentStep === 1 && <><Panel variant="featured" className="space-y-4 p-5 md:p-6"><div><p className="eyebrow">Optional assistant</p><h3 className="heading-3 mt-2">Autofill card information</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">ARCA can inspect the image and suggest catalogue details. Nothing is locked—review and correct every field.</p></div><Button variant="outline" onClick={runAutofill} disabled={!imageFile || autofilling}>{autofilling ? "Scanning card…" : "Autofill Card Info"}</Button>{autofillMessage && <Message tone={autofillResult ? "success" : undefined}>{autofillMessage}</Message>}</Panel><CardFields value={form} onChange={setForm} disabled={saving} sections={["identity"]}/></>}

        {currentStep === 2 && <CardFields value={form} onChange={setForm} disabled={saving} sections={["grading"]}/>} 

        {currentStep === 3 && <Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Collection</p><h3 className="heading-2 mt-2">Place in the vault</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Choose its exhibition, or create a new collection without leaving this record.</p></div><CollectionSelector collections={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} onCreate={() => setQuickCreateOpen(true)} loading={collectionsLoading} disabled={saving} error={collectionError}/></Panel>}

        {currentStep === 4 && <><CardFields value={form} onChange={setForm} disabled={saving} sections={["value"]}/><div className="grid gap-4 sm:grid-cols-2"><Panel className="p-5"><p className="eyebrow">Market estimate</p><h3 className="heading-3 mt-2">Manual for now</h3><p className="mt-2 text-sm leading-6 text-[var(--text-tertiary)]">Use your judgement until a licensed market-data source is connected.</p></Panel><RecentSalesPanel data={sales} loading={salesLoading} error={salesError}/></div></>}

        {currentStep === 5 && <><Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Review & save</p><h3 className="heading-2 mt-2">Ready for the vault</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Review the catalogue record before saving this card.</p></div><dl className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] px-4">{[["Card", form.playerName || "Not entered"], ["Identity", [form.year, form.brand, form.setName, form.cardNumber && `#${form.cardNumber}`, form.parallel].filter(Boolean).join(" · ") || "No additional details"], ["Condition", form.grader === "Raw" ? (form.condition || "Raw") : `${form.grader} ${form.grade}`], ["Collection", selectedCollection?.name || "Unsorted"], ["Estimated value", displayValue ? `$${Number(displayValue).toLocaleString()}` : "Not entered"], ["Status", form.status.replaceAll("_", " ")]].map(([label, value]) => <div key={label} className="grid grid-cols-[7rem_1fr] gap-4 py-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</dt><dd className="text-sm font-medium capitalize text-[var(--text-primary)]">{value}</dd></div>)}</dl></Panel>{preview && <DisplayImagePanel originalUrl={preview} lookup={imageLookup} selected={selectedDisplayImage} onSelect={setSelectedDisplayImage}/>}</>}

        {message && <Message>{message}</Message>}
        <div className="sticky bottom-24 z-20 flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:bottom-5">
          {currentStep > 0 && <Button variant="secondary" size="lg" className="min-w-24" disabled={saving} onClick={() => moveToStep(currentStep - 1)}>Back</Button>}
          {currentStep < steps.length - 1 ? <Button size="lg" className="flex-1" disabled={saving} onClick={continueFlow}>Continue</Button> : <Button size="lg" className="flex-1" disabled={saving || collectionsLoading || Boolean(collectionError)} onClick={addCard}>{saving ? "Cataloguing…" : "Save card"}</Button>}
        </div>
      </section>
    </div>
    <QuickCollectionDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={handleCollectionCreated}/>
  </div></main>;
}
