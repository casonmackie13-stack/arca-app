export type ScanType = "raw-card" | "graded-slab";

export type ScanOutput = {
  width: number;
  height: number;
};

export const scanTypeConfig: Record<ScanType, {
  title: string;
  description: string;
  guidance: string;
  output: ScanOutput;
}> = {
  "raw-card": {
    title: "Raw Card",
    description: "Standard trading card, not in a slab",
    guidance: "Fit the card inside the frame",
    output: { width: 1000, height: 1400 },
  },
  "graded-slab": {
    title: "Graded Slab",
    description: "PSA, BGS, SGC, or other slab",
    guidance: "Fit the entire slab inside the frame, including label",
    output: { width: 1000, height: 1600 },
  },
};
