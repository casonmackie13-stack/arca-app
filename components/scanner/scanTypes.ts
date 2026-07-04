import type { ScanType } from "@/lib/scanner/scannerTypes";

export type { ScanType } from "@/lib/scanner/scannerTypes";

export type ScanOutput = {
  width: number;
  height: number;
};

export const scanTypeConfig: Record<ScanType, {
  title: string;
  label: string;
  description: string;
  guidance: string;
  output: ScanOutput;
  /** Guide frame aspect ratio for live overlay */
  guideAspect: string;
  aspectRatio: number;
}> = {
  raw: {
    title: "Raw Card",
    label: "Raw",
    description: "Standard trading card, not in a slab",
    guidance: "Fit the card inside the frame",
    output: { width: 1000, height: 1400 },
    guideAspect: "5 / 7",
    aspectRatio: 5 / 7,
  },
  graded: {
    title: "Graded Slab",
    label: "Graded",
    description: "PSA, BGS, SGC, or other slab",
    guidance: "Fit the entire slab inside the frame, including label",
    output: { width: 1000, height: 1600 },
    guideAspect: "1000 / 1600",
    aspectRatio: 1000 / 1600,
  },
};
