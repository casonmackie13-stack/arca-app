"use client";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function luminance(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Natural listing-quality enhancement tuned for trading cards (not document scan whitening). */
function enhancePixel(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const baseLum = Math.max(0.001, luminance(r, g, b));

  // Black point + shadow lift (~+10 black point, +4 shadows)
  let lum = 0.035 + baseLum * 0.94;

  // Exposure (+12) and brightness (+10)
  lum = lum * 1.12 + 0.04;

  // Highlight compression (protect foil/specular detail)
  if (lum > 0.78) {
    const t = (lum - 0.78) / 0.22;
    lum = 0.78 + 0.22 * (1 - Math.pow(1 - t, 2.4));
  }

  lum = clamp01(lum);

  // Preserve hue by scaling RGB toward target luminance
  const scale = lum / baseLum;
  let nr = clamp01(rn * scale);
  let ng = clamp01(gn * scale);
  let nb = clamp01(bn * scale);

  // Gentle shadow lift without whitening paper
  nr = clamp01(nr + 0.012);
  ng = clamp01(ng + 0.012);
  nb = clamp01(nb + 0.012);

  return [Math.round(nr * 255), Math.round(ng * 255), Math.round(nb * 255)];
}

export function enhanceListingCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;

  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  const outCtx = output.getContext("2d");
  if (!srcCtx || !outCtx) return source;

  const { width, height } = source;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = enhancePixel(data[i], data[i + 1], data[i + 2]);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  outCtx.putImageData(imageData, 0, 0);
  return output;
}

export async function enhanceListingCanvasAsync(source: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  return enhanceListingCanvas(source);
}
