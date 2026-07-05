"use client";

import { createPortal } from "react-dom";

export default function ScannerPortal({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
