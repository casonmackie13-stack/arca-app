"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CollectionSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, TextArea } from "@/components/ui/Form";
import { Message } from "@/components/ui/Surface";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (collection: CollectionSummary) => void;
};

const initialForm = { name: "", category: "Sports", visibility: "private", description: "" };

export default function QuickCollectionDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function createCollection() {
    if (!form.name.trim()) { setError("Collection name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) throw authError || new Error("Sign in to create a collection.");
      const { data, error: createError } = await supabase.from("collections").insert({
        owner_id: userData.user.id,
        name: form.name.trim(),
        category: form.category,
        visibility: form.visibility,
        description: form.description.trim() || null,
      }).select("id,owner_id,name,category,visibility,description,created_at").single();
      if (createError || !data) throw createError || new Error("Unable to create the collection.");
      onCreated(data as CollectionSummary);
      setForm(initialForm);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the collection.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onClose={() => !saving && onClose()} title="Create a collection" description="Create a place for this card without leaving the catalogue workflow. Cover artwork can be added later.">
    <div className="space-y-5">
      <Field label="Collection name"><Input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Modern Icons" disabled={saving}/></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category"><Select value={form.category} onChange={(event) => update("category", event.target.value)} disabled={saving}>{["Sports","Basketball","Football","Baseball","Soccer","Hockey","TCG","Other"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="Visibility"><Select value={form.visibility} onChange={(event) => update("visibility", event.target.value)} disabled={saving}><option value="private">Private</option><option value="public">Public</option></Select></Field>
      </div>
      <Field label="Description" optional><TextArea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="A brief curatorial note." disabled={saving}/></Field>
      {error && <Message>{error}</Message>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" onClick={createCollection} disabled={saving}>{saving ? "Creating…" : "Create collection"}</Button>
      </div>
    </div>
  </Dialog>;
}
