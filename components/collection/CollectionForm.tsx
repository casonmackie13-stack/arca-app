"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/ui/Form";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Message, Panel } from "@/components/ui/Surface";

export type CollectionFormValue = { name: string; description: string; category: string; visibility: string };
const categories = ["Basketball", "Football", "Baseball", "Soccer", "TCG", "Hockey", "Other"];

export default function CollectionForm({ value, onChange, coverPreview, coverFileName, onCoverChange, onSubmit, saving, message, submitLabel }: { value: CollectionFormValue; onChange: (next: CollectionFormValue) => void; coverPreview?: string | null; coverFileName?: string | null; onCoverChange: (file: File | null) => void; onSubmit: () => void; saving: boolean; message?: string; submitLabel: string }) {
  const set = (key: keyof CollectionFormValue, next: string) => onChange({ ...value, [key]: next });
  return <div className="space-y-8">
    <Panel className="p-5 md:p-7"><p className="eyebrow">Cover artwork</p><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Choose an image that establishes the collection at a glance.</p><div className="mt-5"><ImageUpload label={coverPreview ? "Replace cover artwork" : "Add cover artwork"} previewUrl={coverPreview} fileName={coverFileName} onChange={onCoverChange}/></div></Panel>
    <Panel className="space-y-6 p-5 md:p-7"><div><p className="eyebrow">Collection record</p><h2 className="heading-2 mt-2">Catalogue details</h2></div>
      <Field label="Collection name"><Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Golden Era Rookies" autoComplete="off"/></Field>
      <Field label="Description" optional helper="A short curatorial note about the collection."><TextArea value={value.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the story behind this collection."/></Field>
      <div className="grid gap-6 sm:grid-cols-2"><Field label="Category"><Select value={value.category} onChange={(e) => set("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="Visibility" helper={value.visibility === "public" ? "Anyone with access to ARCA may discover it." : "Only you can view this collection."}><Select value={value.visibility} onChange={(e) => set("visibility", e.target.value)}><option value="private">Private</option><option value="public">Public</option></Select></Field></div>
    </Panel>
    {message && <Message>{message}</Message>}
    <div className="sticky bottom-24 z-20 rounded-xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] p-3 backdrop-blur-xl lg:bottom-5"><Button size="lg" className="w-full" onClick={onSubmit} disabled={saving}>{saving ? "Preserving…" : submitLabel}</Button></div>
  </div>;
}

