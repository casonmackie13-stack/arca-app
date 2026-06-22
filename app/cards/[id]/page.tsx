"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CollectionSelector from "@/components/collection/CollectionSelector";
import { supabase } from "@/lib/supabase";
import { ensureUnsortedCollection, loadOwnedCollections } from "@/lib/collections";
import type { CardSummary, CollectionSummary } from "@/lib/types";
import { Badge, EmptyState, LoadingState, Message, Panel } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import ArcaImage from "@/components/ui/ArcaImage";

export default function CardDetailPage() {
  const cardId = useParams().id as string;
  const router = useRouter();
  const [card, setCard] = useState<CardSummary | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: cardData }, { data: authData }] = await Promise.all([
        supabase.from("cards").select("*, card_images ( id, image_url, image_type )").eq("id", cardId).single(),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      const nextCard = cardData as CardSummary | null;
      setCard(nextCard);
      const owner = Boolean(nextCard && authData.user && nextCard.owner_id === authData.user.id);
      setIsOwner(owner);
      if (owner && authData.user && nextCard) {
        try {
          const unsortedId = await ensureUnsortedCollection(authData.user.id);
          const owned = await loadOwnedCollections(authData.user.id);
          if (!active) return;
          setCollections(owned);
          setSelectedCollectionId(owned.some((collection) => collection.id === nextCard.collection_id) ? nextCard.collection_id || unsortedId : unsortedId);
        } catch (cause) {
          setMessageTone("error"); setMessage(cause instanceof Error ? cause.message : "Unable to load your collections.");
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [cardId]);

  async function moveCard() {
    if (!card || !selectedCollectionId || selectedCollectionId === card.collection_id) return;
    setMoving(true); setMessage("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("Sign in to move this card.");
      const { data: destination, error: destinationError } = await supabase.from("collections").select("id,name").eq("id", selectedCollectionId).eq("owner_id", authData.user.id).maybeSingle();
      if (destinationError) throw destinationError;
      if (!destination) throw new Error("Choose one of your collections.");
      const { data: moved, error: moveError } = await supabase.from("cards").update({ collection_id: destination.id }).eq("id", card.id).eq("owner_id", authData.user.id).select("id,collection_id").single();
      if (moveError || !moved) throw moveError || new Error("Unable to move the card.");
      setCard((current) => current ? { ...current, collection_id: destination.id, collection: destination } : current);
      setMessageTone("success"); setMessage(`Moved to ${destination.name}.`);
      router.refresh();
    } catch (cause) {
      setMessageTone("error"); setMessage(cause instanceof Error ? cause.message : "Unable to move the card.");
    } finally { setMoving(false); }
  }

  const deleteCard = useCallback(async () => {
    if (!card) return; setDeleting(true); setMessage("");
    const { error: imageError } = await supabase.from("card_images").delete().eq("card_id", card.id);
    if (imageError) { setMessageTone("error"); setMessage(imageError.message); setDeleting(false); setConfirmOpen(false); return; }
    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (error) { setMessageTone("error"); setMessage(error.message); setDeleting(false); setConfirmOpen(false); return; }
    router.push(card.collection_id ? `/collections/${card.collection_id}` : "/collections");
  }, [card, router]);

  if (loading) return <main className="page-container"><LoadingState label="Retrieving the card record…"/></main>;
  if (!card) return <main className="page-container"><EmptyState title="Card unavailable" description="This card could not be found in the archive."/></main>;
  const status = card.status?.replaceAll("_", " ") || "Unclassified";
  return <main className="page-container cinematic-enter"><div className="detail-container">
    <PageHeader backHref={card.collection_id ? `/collections/${card.collection_id}` : "/collections"} backLabel="Collection" action={isOwner ? <ButtonLink href={`/cards/${card.id}/edit`} variant="secondary" size="sm">Edit card</ButtonLink> : undefined}/>
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)] lg:gap-14">
      <section className="panel relative flex min-h-[28rem] items-center justify-center overflow-hidden bg-black p-5 md:min-h-[38rem] md:p-8">{card.card_images?.[0]?.image_url ? <ArcaImage src={card.card_images[0].image_url} alt={card.player_name} className="image-reveal object-contain p-5 md:p-8"/> : <span className="eyebrow text-[var(--text-tertiary)]">Image unavailable</span>}</section>
      <section><p className="eyebrow">Card record</p><h1 className="display-l mt-3">{card.player_name}</h1><p className="mt-4 text-base text-[var(--text-secondary)]">{card.year} {card.brand}</p><p className="mt-1 text-sm text-[var(--text-tertiary)]">{card.set_name} {card.card_number ? `#${card.card_number}` : ""}</p><div className="mt-6"><Badge tone="gold">{status}</Badge></div>
        <Panel variant="featured" className="mt-9 p-6"><p className="eyebrow">Certification</p><div className="mt-5 flex items-end justify-between"><div><p className="text-sm text-[var(--text-secondary)]">{card.grader || "Ungraded"}</p><p className="font-display text-6xl leading-none">{card.grade || "Raw"}</p></div><div className="text-right"><p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Estimated value</p><p className="mt-2 text-xl font-semibold tabular-nums">{card.estimated_value ? `$${Number(card.estimated_value).toLocaleString()}` : "Not set"}</p></div></div></Panel>
        <div className="mt-8 border-t border-[var(--border-subtle)] pt-7"><p className="eyebrow">Curator notes</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">{card.notes || "No notes have been recorded."}</p></div>
        {isOwner && collections.length > 0 && <Panel className="mt-8 space-y-4 p-5"><div><p className="eyebrow">Collection placement</p><h2 className="heading-3 mt-2">Move this card</h2></div><CollectionSelector collections={collections} selectedId={selectedCollectionId} onSelect={setSelectedCollectionId} disabled={moving}/><Button className="w-full" variant="outline" disabled={moving || selectedCollectionId === card.collection_id} onClick={moveCard}>{moving ? "Moving…" : "Move card"}</Button></Panel>}
        {message && <div className="mt-6"><Message tone={messageTone}>{message}</Message></div>}
        {isOwner && <div className="mt-10 border-t border-[var(--border-subtle)] pt-6"><Button variant="destructive" onClick={() => setConfirmOpen(true)}>Delete card</Button></div>}
      </section>
    </div>
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Remove this card?" description="This permanently removes the card record from ARCA. This action cannot be undone."><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Keep card</Button><Button variant="destructive" disabled={deleting} onClick={deleteCard}>{deleting ? "Removing…" : "Remove permanently"}</Button></div></Dialog>
  </div></main>;
}
