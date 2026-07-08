"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddCardProgress from "@/components/card/AddCardProgress";
import CardFields from "@/components/card/CardFields";
import FlippableCard from "@/components/card/FlippableCard";
import DisplayImagePanel from "@/components/card/DisplayImagePanel";
import RecentSalesPanel from "@/components/card/RecentSalesPanel";
import CollectionSelector from "@/components/collection/CollectionSelector";
import QuickCollectionDialog from "@/components/collection/QuickCollectionDialog";
import Scanner from "@/components/scanner/Scanner";
import CardCapturePanel from "@/components/scanner/CardCapturePanel";
import { Button } from "@/components/ui/Button";
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
  validateOptionalCardImage,
  validateRequiredCardImage,
} from "@/lib/card-form";
import { ensureUnsortedCollection, loadOwnedCollections } from "@/lib/collections";
import { createMobileSafeId } from "@/lib/mobile-id";
import { supabase } from "@/lib/supabase";
import type { CollectionSummary } from "@/lib/types";
import type { CardAutofillResponse, CardImageLookupResponse, CardSalesResponse, ImageSuggestion } from "@/lib/card-intelligence";
import { salePrice } from "@/lib/card-sales";
import { analyzeCardImage, type CardDetectionAnalysis } from "@/lib/image-processing/cardDetection";
import { formatCardImage } from "@/lib/image-processing/cardFormatting";
import { normalizeCardYear } from "@/lib/card-year";
import { scanFlowLog } from "@/lib/scanner/scanFlowLog";
import type { GuidedCaptureResult, ScannerSession, ScanType } from "@/lib/scanner/scannerTypes";

const steps = ["Capture image", "Card details", "Condition", "Collection", "Value", "Review & save"] as const;

export default function AddCardClient({ initialCollectionId }: { initialCollectionId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanAutostart = searchParams.get("scan") === "1";
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const imageProcessingId = useRef({ front: 0, back: 0 });
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(() => ({ ...emptyCardForm }));
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionError, setCollectionError] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontAnalysis, setFrontAnalysis] = useState<CardDetectionAnalysis | null>(null);
  const [backAnalysis, setBackAnalysis] = useState<CardDetectionAnalysis | null>(null);
  const [frontProcessing, setFrontProcessing] = useState(false);
  const [backProcessing, setBackProcessing] = useState(false);
  const [scannerSession, setScannerSession] = useState<ScannerSession | null>(() => (
    scanAutostart
      ? { activeSide: "front", sequence: "front-back", resetKey: Date.now() }
      : null
  ));
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");
  const [autofillResult, setAutofillResult] = useState<CardAutofillResponse | null>(null);
  const [sales, setSales] = useState<CardSalesResponse | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [imageLookup, setImageLookup] = useState<CardImageLookupResponse | null>(null);
  const [selectedDisplayImage, setSelectedDisplayImage] = useState<ImageSuggestion | null>(null);
  const [estimateSource, setEstimateSource] = useState("");
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

  useEffect(() => {
    if (scanAutostart) {
      scanFlowLog("Add flow reached /cards/new?scan=1 (AddCardClient)");
    }
  }, [scanAutostart]);

  useEffect(() => {
    if (scannerSession) {
      scanFlowLog("Scanner session opened from AddCardClient", scannerSession);
    }
  }, [scannerSession]);

  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
  }, [frontPreview, backPreview]);

  function startScanner(request: { side: "front" | "back"; sequence: ScannerSession["sequence"] }) {
    setScannerSession({
      activeSide: request.side,
      sequence: request.sequence,
      resetKey: Date.now(),
    });
  }

  function closeScanner() {
    setScannerSession(null);
  }

  function advanceScannerAfterCapture(result: GuidedCaptureResult, side: "front" | "back") {
    void chooseImage(side, result.file, { guidedScanType: result.scanType });
    setScannerSession((current) => {
      if (!current) return null;
      if (side === "front" && current.sequence === "front-back") {
        return {
          activeSide: "back",
          sequence: "front-back",
          resetKey: Date.now(),
        };
      }
      return null;
    });
  }

  function handleScannerFileFallback(file: File | null, side: "front" | "back") {
    void chooseImage(side, file);
    setScannerSession((current) => {
      if (!current) return null;
      if (side === "front" && current.sequence === "front-back" && file) {
        return {
          activeSide: "back",
          sequence: "front-back",
          resetKey: Date.now(),
        };
      }
      return null;
    });
  }

  function scanTypeMismatch(scanType: ScanType, analysis: CardDetectionAnalysis) {
    if (analysis.source === "fallback" || analysis.multipleCards) return "";
    const detectedSlab = analysis.boundary?.type === "graded-slab";
    if (scanType === "raw" && detectedSlab) return "This looks like a slab. Switch to Graded and retake if the holder or label is being cut off.";
    if (scanType === "graded" && !detectedSlab && analysis.confidence >= 0.5) return "This looks like a raw card. Switch to Raw and retake if no slab is present.";
    return "";
  }

  const chooseImage = async (side: "front" | "back", file: File | null, options?: { guidedScanType?: ScanType }) => {
    const requestId = ++imageProcessingId.current[side];
    const setFile = side === "front" ? setFrontFile : setBackFile;
    const setPreview = side === "front" ? setFrontPreview : setBackPreview;
    const setAnalysis = side === "front" ? setFrontAnalysis : setBackAnalysis;
    const setProcessing = side === "front" ? setFrontProcessing : setBackProcessing;
    setFile(null);
    setAnalysis(null);
    setMessage("");
    setAutofillMessage("");
    setAutofillResult(null); setSales(null); setSalesError(""); setImageLookup(null); setSelectedDisplayImage(null); setEstimateSource("");
    if (!file) {
      setProcessing(false);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }
    setProcessing(true);
    const rawPreview = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return rawPreview;
    });
    const analysis = await analyzeCardImage(file);
    const mismatch = options?.guidedScanType ? scanTypeMismatch(options.guidedScanType, analysis) : "";
    const nextAnalysis = mismatch
      ? { ...analysis, feedback: [...analysis.feedback, mismatch] }
      : analysis;
    const formatted = options?.guidedScanType ? { file, previewUrl: rawPreview } : await formatCardImage(file, analysis);
    if (imageProcessingId.current[side] !== requestId) {
      if (formatted.previewUrl !== rawPreview) URL.revokeObjectURL(formatted.previewUrl);
      return;
    }
    setAnalysis(nextAnalysis);
    setFile(formatted.file);
    setPreview((current) => {
      if (current && current !== formatted.previewUrl) URL.revokeObjectURL(current);
      return formatted.previewUrl;
    });
    setProcessing(false);
  };

  function handleCollectionCreated(collection: CollectionSummary) {
    setCollections((current) => [...current, collection]);
    setSelectedCollectionId(collection.id);
    setCollectionError("");
  }

  function stepError(step: number) {
    if (step === 0) {
      if (frontProcessing || backProcessing) return "ARCA is preparing your image. Please wait a moment.";
      if (frontAnalysis?.multipleCards || backAnalysis?.multipleCards) return "We detected more than one card. Please photograph one card at a time.";
      return validateRequiredCardImage(frontFile) || validateOptionalCardImage(backFile);
    }
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
    if (!frontFile || autofilling) return;
    setAutofilling(true);
    setAutofillMessage("");
    try {
      const result = await autofillCardInfo(frontFile, backFile);
      setAutofillResult(result);
      const ai = result.card;
      setForm((current) => ({
        ...current,
        playerName: current.playerName || ai.player_name,
        sport: current.sport === "Basketball" ? (ai.sport || current.sport) : current.sport,
        year: current.year || (ai.year ? normalizeCardYear(ai.year) : ""),
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
        notes: current.notes || ai.notes,
      }));
      setAutofillMessage(`Autofill complete. Please review before saving. AI autofill may be inaccurate. Review before saving. Overall confidence: ${Math.round(ai.confidence * 100)}%.`);
      setSalesLoading(true); setSalesError("");
      const [salesResult, imageResult] = await Promise.allSettled([fetchRecentSales(ai as unknown as Record<string, unknown>, result.sales_query), lookupDisplayImage(ai as unknown as Record<string, unknown>)]);
      if (salesResult.status === "fulfilled") {
        setSales(salesResult.value);
        const closest = salesResult.value.closest_sale;
        const closestPrice = closest ? salePrice(closest) : null;
        if (closest && closestPrice !== null) {
          setForm((current) => current.estimatedValue ? current : { ...current, estimatedValue: String(closestPrice) });
          setEstimateSource(`Estimated from closest recent sale: ${closest.source} ${closest.sale_type.replaceAll("_", " ")} · ${[closest.grade_company, closest.grade].filter(Boolean).join(" ") || "Raw"} · sold ${closest.sale_date}`);
        } else setEstimateSource("");
      } else setSalesError(salesResult.reason instanceof Error ? salesResult.reason.message : "Recent sales are unavailable.");
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
    const frontToUpload = frontFile;
    const backToUpload = backFile;
    const imageError = validateRequiredCardImage(frontToUpload) || validateOptionalCardImage(backToUpload);
    if (imageError) { moveToStep(0); setMessage(imageError); return; }
    const validationError = validateCardForm(form, frontToUpload);
    if (validationError) {
      const invalidStep = validateCardIdentity(form) ? 1 : validateCardGrading(form) ? 2 : 4;
      moveToStep(invalidStep);
      setMessage(validationError);
      return;
    }
    const collectionValidationError = stepError(3);
    if (collectionValidationError) { moveToStep(3); setMessage(collectionValidationError); return; }
    if (!frontToUpload) { moveToStep(0); setMessage("A front card image is required."); return; }

    setSaving(true);
    setMessage("");
    const uploadedPaths: string[] = [];
    let createdCardId: string | null = null;
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) { router.push("/auth"); return; }
      const userId = userData.user.id;

      let collectionId = selectedCollectionId;
      const { data: ownedCollection, error: ownershipError } = await supabase.from("collections").select("id").eq("id", collectionId).eq("owner_id", userData.user.id).maybeSingle();
      if (ownershipError) throw ownershipError;
      if (!ownedCollection) collectionId = await ensureUnsortedCollection(userData.user.id);

      async function uploadCardSide(file: File, side: "front" | "back") {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/cards/${Date.now()}-${side}-${createMobileSafeId()}.${ext}`;
        const { error } = await supabase.storage.from("card_images").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
        return supabase.storage.from("card_images").getPublicUrl(path).data.publicUrl;
      }

      const frontImageUrl = await uploadCardSide(frontToUpload, "front");
      const backImageUrl = backToUpload ? await uploadCardSide(backToUpload, "back") : null;
      const displayImageUrl = selectedDisplayImage?.image_url || frontImageUrl;

      const { data: card, error: cardError } = await supabase.from("cards").insert({
        owner_id: userData.user.id,
        collection_id: collectionId,
        ...cardMutation(form),
        original_image_url: frontImageUrl,
        front_image_url: displayImageUrl,
        back_image_url: backImageUrl,
        original_front_image_url: frontImageUrl,
        original_back_image_url: backImageUrl,
        display_image_url: displayImageUrl,
        image_source: selectedDisplayImage?.source || "user_upload",
        image_source_url: selectedDisplayImage?.source_url || null,
        image_replacement_status: selectedDisplayImage ? "accepted_suggestion" : "original",
      }).select("id").single();
      if (cardError || !card) {
        await Promise.all(uploadedPaths.map(removeUploadedObject));
        uploadedPaths.length = 0;
        throw cardError || new Error("Unable to create the card record.");
      }
      createdCardId = card.id;

      const imageRows = [{ card_id: card.id, image_url: displayImageUrl, image_type: "front" }];
      if (backImageUrl) imageRows.push({ card_id: card.id, image_url: backImageUrl, image_type: "back" });
      const { error: imageRowError } = await supabase.from("card_images").insert(imageRows);
      if (imageRowError) {
        const { error: cardRollbackError } = await supabase.from("cards").delete().eq("id", card.id).eq("owner_id", userData.user.id);
        if (cardRollbackError) throw new Error(`${imageRowError.message} The uploaded images were preserved because the card record could not be rolled back.`);
        await Promise.all(uploadedPaths.map(removeUploadedObject));
        createdCardId = null; uploadedPaths.length = 0;
        throw imageRowError;
      }

      // Intelligence archiving is deliberately fail-open: a training-log problem must never undo a saved card.
      try {
        const [frontArchivePath, backArchivePath] = await Promise.all([
          autofillResult?.front_archive_path || archiveOriginalImage(frontToUpload, userData.user.id),
          backToUpload ? (autofillResult?.back_archive_path || archiveOriginalImage(backToUpload, userData.user.id)) : Promise.resolve(null),
        ]);
        const corrected = cardMutation(form);
        const extracted = autofillResult?.card || {};
        const correctedRecord = corrected as Record<string, unknown>;
        const feedback = Object.fromEntries(Object.entries(extracted).filter(([key]) => key !== "confidence").map(([key, original]) => {
          const correctedKey = key === "grade_company" ? "grader" : key;
          const finalValue = correctedRecord[correctedKey] ?? null;
          return [key, { accepted: String(finalValue ?? "") === String(original ?? ""), original, final: finalValue }];
        }));
        const archiveRecord = { card_id: card.id, original_image_path: frontArchivePath, original_image_url: frontImageUrl, original_front_image_path: frontArchivePath, original_back_image_path: backArchivePath, original_front_image_url: frontImageUrl, original_back_image_url: backImageUrl, display_image_url: displayImageUrl, ai_extracted_json: extracted, user_corrected_json: corrected, field_feedback_json: feedback, sales_query: autofillResult?.sales_query || null, sales_results_json: sales?.sales || [], confidence: autofillResult?.card.confidence ?? null, source: autofillResult ? (backToUpload ? "openai_vision_front_back" : "openai_vision_front") : "manual", archive_status: "saved", training_eligible: false, updated_at: new Date().toISOString() };
        if (autofillResult?.training_event_id) await supabase.from("card_training_events").update(archiveRecord).eq("id", autofillResult.training_event_id).eq("user_id", userData.user.id);
        else await supabase.from("card_training_events").insert({ user_id: userData.user.id, ...archiveRecord });
      } catch { /* Card save remains successful. */ }

      router.push(`/cards/${card.id}`);
    } catch (cause) {
      if (!createdCardId && uploadedPaths.length) await Promise.all(uploadedPaths.map(removeUploadedObject));
      setMessage(cause instanceof Error ? cause.message : "Something went wrong while cataloguing the card.");
      setSaving(false);
    }
  }

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const displayValue = form.estimatedValue.replace(/[$,]/g, "").trim();
  const imageProcessing = frontProcessing || backProcessing;
  const scannerOpen = scannerSession !== null;

  function analysisNotice(label: string, analysis: CardDetectionAnalysis | null, processing: boolean) {
    if (processing) return <p className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">Preparing {label.toLowerCase()} for 3D preview…</p>;
    if (!analysis) return null;
    const hasWarning = analysis.multipleCards || analysis.quality.issues.length > 0 || analysis.source === "fallback";
    const detectedLabel = analysis.multipleCards ? "Multiple cards" : analysis.boundary?.type === "graded-slab" ? "Graded slab" : "Raw card";
    return <div className={`mt-3 rounded-lg border px-4 py-3 text-sm leading-6 ${hasWarning ? "border-[var(--status-warning)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]" : "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)]"}`}>
      <p className="font-semibold">{label}: {detectedLabel} · {Math.round(analysis.confidence * 100)}% confidence</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{analysis.feedback.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>;
  }

  return <>
    {!scannerOpen && <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref="/collections" backLabel="Vault"/>
    <p className="eyebrow">New acquisition</p>
    <h1 className="display-l mt-3">Catalogue a card</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">A guided record for the object, its certification, and its place in your collection.</p>

    <div className="mt-8"><AddCardProgress steps={steps} currentStep={currentStep}/></div>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(280px,.75fr)_minmax(0,1.25fr)]">
      <div className="hidden lg:sticky lg:top-8 lg:block">
        <Panel className="p-5">
          <p className="eyebrow">Object preview</p>
          {frontPreview ? <div className="mt-5"><FlippableCard frontImageUrl={frontPreview} backImageUrl={backPreview} alt={form.playerName || "Selected card"}/></div> : <div className="mt-5 flex aspect-[2.5/3.5] items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] px-6 text-center text-sm leading-6 text-[var(--text-tertiary)]">Your card images will remain here as you catalogue it.</div>}
        </Panel>
      </div>

      <section aria-labelledby="add-card-step-title" className="min-w-0 space-y-6">
        <h2 id="add-card-step-title" ref={stepHeadingRef} tabIndex={-1} className="sr-only">{steps[currentStep]}</h2>

        {currentStep === 0 && <Panel className="space-y-8 p-5 md:p-7">
          <div>
            <p className="eyebrow">Capture images</p>
            <h3 className="heading-2 mt-2">Photograph the card</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Choose front or back, then tap the frame to open the camera instantly.</p>
          </div>
          <CardCapturePanel
            frontPreview={frontPreview}
            backPreview={backPreview}
            frontProcessing={frontProcessing}
            backProcessing={backProcessing}
            onScan={startScanner}
            onRemove={(side) => { void chooseImage(side, null); }}
          />
          {analysisNotice("Front image", frontAnalysis, frontProcessing)}
          {backPreview && analysisNotice("Back image", backAnalysis, backProcessing)}
        </Panel>}

        {currentStep === 1 && <><Panel variant="featured" className="space-y-4 p-5 md:p-6"><div><p className="eyebrow">Optional assistant</p><h3 className="heading-3 mt-2">Autofill card information</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">ARCA can inspect the front{backFile ? " and back" : ""} and suggest catalogue details. Nothing is locked—review and correct every field.</p></div><Button variant="outline" onClick={runAutofill} disabled={!frontFile || autofilling}>{autofilling ? "Scanning card…" : "Autofill Card Info"}</Button>{autofillMessage && <Message tone={autofillResult ? "success" : undefined}>{autofillMessage}</Message>}</Panel><CardFields value={form} onChange={setForm} disabled={saving} sections={["identity"]}/></>}

        {currentStep === 2 && <CardFields value={form} onChange={setForm} disabled={saving} sections={["grading"]}/>} 

        {currentStep === 3 && <Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Collection</p><h3 className="heading-2 mt-2">Place in the vault</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Choose its exhibition, or create a new collection without leaving this record.</p></div><CollectionSelector collections={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} onCreate={() => setQuickCreateOpen(true)} loading={collectionsLoading} disabled={saving} error={collectionError}/></Panel>}

        {currentStep === 4 && <><CardFields value={form} onChange={setForm} disabled={saving} sections={["value"]}/>{estimateSource && <Message tone="success">{estimateSource}. Closest sale estimate, not appraisal.</Message>}<div className="grid gap-4 sm:grid-cols-2"><Panel className="p-5"><p className="eyebrow">Market estimate</p><h3 className="heading-3 mt-2">Editable indicator</h3><p className="mt-2 text-sm leading-6 text-[var(--text-tertiary)]">A verified closest sale may suggest a value. You remain in control of the saved estimate.</p></Panel><RecentSalesPanel data={sales} loading={salesLoading} error={salesError}/></div></>}

        {currentStep === 5 && <><Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Review & save</p><h3 className="heading-2 mt-2">Ready for the vault</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Review the catalogue record before saving this card.</p></div>{frontPreview && <div className="mx-auto w-full max-w-xs lg:hidden"><FlippableCard frontImageUrl={frontPreview} backImageUrl={backPreview} alt={form.playerName || "Card review"}/></div>}<dl className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] px-4">{[["Card", form.playerName || "Not entered"], ["Identity", [form.year, form.brand, form.setName, form.cardNumber && `#${form.cardNumber}`, form.parallel].filter(Boolean).join(" · ") || "No additional details"], ["Condition", form.grader === "Raw" ? (form.condition || "Raw") : `${form.grader} ${form.grade}`], ["Collection", selectedCollection?.name || "Unsorted"], ["Estimated value", displayValue ? `$${Number(displayValue).toLocaleString()}` : "Not entered"], ["Status", form.status.replaceAll("_", " ")]].map(([label, value]) => <div key={label} className="grid grid-cols-[7rem_1fr] gap-4 py-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</dt><dd className="text-sm font-medium capitalize text-[var(--text-primary)]">{value}</dd></div>)}</dl></Panel>{frontPreview && <DisplayImagePanel originalUrl={frontPreview} lookup={imageLookup} selected={selectedDisplayImage} onSelect={setSelectedDisplayImage}/>}</>}

        {message && <Message>{message}</Message>}
        <div className="sticky bottom-24 z-20 flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:bottom-5">
          {currentStep > 0 && <Button variant="secondary" size="lg" className="min-w-24" disabled={saving} onClick={() => moveToStep(currentStep - 1)}>Back</Button>}
          {currentStep < steps.length - 1 ? <Button size="lg" className="flex-1" disabled={saving || imageProcessing} onClick={continueFlow}>Continue</Button> : <Button size="lg" className="flex-1" disabled={saving || collectionsLoading || Boolean(collectionError)} onClick={addCard}>{saving ? "Cataloguing…" : "Save card"}</Button>}
        </div>
      </section>
    </div>
    </div></main>}

    <QuickCollectionDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={handleCollectionCreated}/>
    <Scanner
      key={scannerSession ? `${scannerSession.activeSide}-${scannerSession.resetKey}` : "idle"}
      open={scannerOpen}
      activeSide={scannerSession?.activeSide ?? "front"}
      sequence={scannerSession?.sequence ?? "front-back"}
      resetKey={scannerSession?.resetKey ?? 0}
      onClose={closeScanner}
      onUseCapture={advanceScannerAfterCapture}
      onSkipBack={scannerSession?.sequence === "front-back" ? closeScanner : undefined}
      onFileFallback={handleScannerFileFallback}
    />
  </>;
}
