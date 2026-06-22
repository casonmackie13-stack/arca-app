"use client";

import type { CollectionSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Form";
import { PlusIcon } from "@/components/ui/Icons";

type Props = {
  collections: CollectionSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
};

export default function CollectionSelector({ collections, selectedId, onSelect, onCreate, loading = false, disabled = false, error }: Props) {
  return <div className={`grid gap-3 ${onCreate ? "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" : "grid-cols-1"}`}>
    <Field label="Collection" helper="Unsorted is your private holding area for cards awaiting a permanent collection." error={error}>
      <Select aria-label="Collection" value={selectedId} onChange={(event) => onSelect(event.target.value)} disabled={disabled || loading || collections.length === 0}>
        {loading && <option value="">Loading collections…</option>}
        {!loading && collections.length === 0 && <option value="">No collections available</option>}
        {collections.map((collection) => <option key={collection.id} value={collection.id}>
          {collection.name} · {collection.category || "Other"}
        </option>)}
      </Select>
    </Field>
    {onCreate && <Button type="button" variant="outline" onClick={onCreate} disabled={disabled || loading} className="w-full sm:w-auto">
      <PlusIcon/>New collection
    </Button>}
  </div>;
}
