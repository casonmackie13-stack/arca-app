"use client";

import type { OcrResult } from "@/lib/scanner/scanMetadata";

type WorkerBundle = typeof import("tesseract.js");

let workerPromise: Promise<import("tesseract.js").Worker | null> | null = null;

async function getWorker() {
  if (typeof window === "undefined") return null;
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    try {
      const tesseract: WorkerBundle = await import("tesseract.js");
      const worker = await tesseract.createWorker("eng", 1, {
        logger: () => undefined,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
      });
      return worker;
    } catch {
      return null;
    }
  })();

  return workerPromise;
}

export async function terminateOcrWorker() {
  const worker = await workerPromise;
  if (worker) {
    await worker.terminate();
  }
  workerPromise = null;
}

export async function runLocalOCR(source: Blob | string): Promise<OcrResult> {
  const worker = await getWorker();
  if (!worker) {
    return { text: "", confidence: 0 };
  }

  try {
    const { data } = await worker.recognize(source);
    const rawWords = "words" in data && Array.isArray((data as { words?: unknown[] }).words)
      ? (data as { words: Array<{ text?: string; confidence?: number }> }).words
      : [];
    const words = rawWords
      .map((word) => ({
        text: (word.text || "").trim(),
        confidence: typeof word.confidence === "number" ? word.confidence / 100 : 0,
      }))
      .filter((word) => word.text.length > 0);

    return {
      text: data.text.trim(),
      confidence: typeof data.confidence === "number" ? data.confidence / 100 : undefined,
      words,
    };
  } catch {
    return { text: "", confidence: 0 };
  }
}
