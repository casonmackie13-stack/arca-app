"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ScannerPortal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
