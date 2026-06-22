"use client";

import type { ChangeEvent } from "react";
import { ImageIcon } from "./Icons";
import ArcaImage from "./ArcaImage";

type ImageUploadProps = {
  label: string;
  previewUrl?: string | null;
  fileName?: string | null;
  onChange: (file: File | null) => void;
  aspect?: "cover" | "card";
  helper?: string;
  cameraCapture?: boolean;
  hidePreviewOnDesktop?: boolean;
  allowRemove?: boolean;
};

export function ImageUpload({
  label,
  previewUrl,
  fileName,
  onChange,
  aspect = "cover",
  helper = "JPG, PNG or WebP · 10 MB maximum",
  cameraCapture = false,
  hidePreviewOnDesktop = false,
  allowRemove = true,
}: ImageUploadProps) {
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] || null);
    event.target.value = "";
  }

  const actionClass =
    "group flex min-h-32 cursor-pointer touch-manipulation flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-6 text-center hover:border-[var(--gold-primary)] hover:bg-[var(--surface-hover)] focus-within:border-[var(--gold-primary)]";

  return (
    <div className="space-y-4">
      {previewUrl && (
        <div className={`space-y-3 ${hidePreviewOnDesktop ? "lg:hidden" : ""}`}>
        <div
          className={`image-reveal relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black ${
            aspect === "card"
              ? "mx-auto aspect-[2.5/3.5] w-full max-w-sm"
              : "aspect-[16/10] w-full"
          }`}
        >
          <ArcaImage
            src={previewUrl}
            alt="Selected artwork preview"
            className={aspect === "card" ? "object-contain" : "object-cover"}
          />
        </div>
        {allowRemove && <button type="button" onClick={() => onChange(null)} className="mx-auto block min-h-11 touch-manipulation px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--status-error)]">Remove image</button>}
        </div>
      )}

      {cameraCapture ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`${actionClass} sm:min-h-36 md:hidden`}>
            <span className="rounded-full border border-[var(--border-subtle)] p-3 text-[var(--gold-primary)]">
              <ImageIcon />
            </span>
            <span className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Take a photo</span>
            <span className="mt-1 text-xs text-[var(--text-tertiary)]">Use the rear camera</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={chooseFile}
            />
          </label>

          <label className={`${actionClass} sm:min-h-36 md:col-span-2`}>
            <span className="rounded-full border border-[var(--border-subtle)] p-3 text-[var(--gold-primary)]">
              <ImageIcon />
            </span>
            <span className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              {previewUrl ? "Choose a different image" : "Choose from photo library"}
            </span>
            <span className="mt-1 text-xs text-[var(--text-tertiary)]">{fileName || helper}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={chooseFile} />
          </label>
        </div>
      ) : (
        <label className={actionClass}>
          <span className="rounded-full border border-[var(--border-subtle)] p-3 text-[var(--gold-primary)]">
            <ImageIcon />
          </span>
          <span className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span className="mt-1 text-xs text-[var(--text-tertiary)]">{fileName || helper}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={chooseFile} />
        </label>
      )}
    </div>
  );
}
