"use client";

import { Component, type ErrorInfo, type ReactNode, useRef } from "react";

type ScannerErrorBoundaryProps = {
  children: ReactNode;
  activeSide: "front" | "back";
  onClose: () => void;
  onFileFallback: (file: File | null, side: "front" | "back") => void;
};

type ScannerErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

/** Prevents scanner runtime errors from crashing the rest of the app. */
export default class ScannerErrorBoundary extends Component<
  ScannerErrorBoundaryProps,
  ScannerErrorBoundaryState
> {
  state: ScannerErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ScannerErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Scanner failed to load.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ARCA Scanner] Error boundary caught:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScannerErrorFallback
          message={this.state.message}
          activeSide={this.props.activeSide}
          onClose={this.props.onClose}
          onFileFallback={this.props.onFileFallback}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ScannerErrorFallback({
  message,
  activeSide,
  onClose,
  onFileFallback,
  onRetry,
}: {
  message: string;
  activeSide: "front" | "back";
  onClose: () => void;
  onFileFallback: (file: File | null, side: "front" | "back") => void;
  onRetry: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black px-6 text-center text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">ARCA Scan</p>
      <h2 className="mt-4 text-2xl font-semibold">Scanner failed to load</h2>
      <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
        Scanner failed to load. You can upload from library instead.
      </p>
      {message && message !== "Scanner failed to load." && (
        <p className="mt-2 max-w-sm text-xs text-white/45">{message}</p>
      )}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-black"
        >
          Upload from Library
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white"
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white/80"
        >
          Close
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          onFileFallback(file, activeSide);
        }}
      />
    </div>
  );
}
