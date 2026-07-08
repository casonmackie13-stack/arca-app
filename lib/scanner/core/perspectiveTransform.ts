"use client";

/**
 * Pure-JS perspective correction — no OpenCV, works on mobile Safari.
 * Computes a homography from four user-confirmed corners and warps the
 * source image into a clean rectangle via inverse mapping + bilinear sampling.
 */

export type Point = { x: number; y: number };

/** Solve an n×n linear system (Gaussian elimination with partial pivoting). */
function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) {
        pivot = row;
      }
    }
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];

    const pivotValue = augmented[col][col];
    if (Math.abs(pivotValue) < 1e-12) {
      throw new Error("Cannot compute perspective transform (degenerate corners).");
    }

    for (let j = col; j <= n; j += 1) augmented[col][j] /= pivotValue;

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

/** 3×3 homography (as 9 numbers) mapping src[i] → dst[i]. */
function computeHomography(src: Point[], dst: Point[]): number[] {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = solveLinearSystem(a, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Order arbitrary four corners as top-left, top-right, bottom-right, bottom-left. */
export function orderCorners(points: Point[]): Point[] {
  if (points.length !== 4) return points;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

/**
 * Default centered card rectangle expressed as normalized fractions (0..1)
 * of the image, fitted to the given aspect ratio (width / height).
 */
export function defaultCornerFractions(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number,
  fill = 0.8,
): Point[] {
  const imageAspect = imageWidth / imageHeight;
  let widthFraction: number;
  let heightFraction: number;

  if (imageAspect > aspectRatio) {
    heightFraction = fill;
    const cardPxHeight = fill * imageHeight;
    const cardPxWidth = cardPxHeight * aspectRatio;
    widthFraction = Math.min(fill, cardPxWidth / imageWidth);
  } else {
    widthFraction = fill;
    const cardPxWidth = fill * imageWidth;
    const cardPxHeight = cardPxWidth / aspectRatio;
    heightFraction = Math.min(fill, cardPxHeight / imageHeight);
  }

  const x0 = (1 - widthFraction) / 2;
  const y0 = (1 - heightFraction) / 2;
  const x1 = x0 + widthFraction;
  const y1 = y0 + heightFraction;

  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Perspective-correct the source canvas using four corners (in source pixels)
 * into a rectangle of outWidth × outHeight.
 */
export function warpPerspective(
  source: HTMLCanvasElement,
  corners: Point[],
  outWidth: number,
  outHeight: number,
): HTMLCanvasElement {
  const ordered = orderCorners(corners);
  const destRect: Point[] = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ];

  // Homography mapping OUTPUT coordinates → SOURCE coordinates (inverse map).
  const h = computeHomography(destRect, ordered);

  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Canvas is unavailable.");
  const srcImage = srcCtx.getImageData(0, 0, source.width, source.height);
  const srcData = srcImage.data;
  const srcWidth = source.width;
  const srcHeight = source.height;

  const output = document.createElement("canvas");
  output.width = outWidth;
  output.height = outHeight;
  const outCtx = output.getContext("2d");
  if (!outCtx) throw new Error("Canvas is unavailable.");
  const outImage = outCtx.createImageData(outWidth, outHeight);
  const outData = outImage.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = h;

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const denom = h6 * x + h7 * y + h8;
      const sx = (h0 * x + h1 * y + h2) / denom;
      const sy = (h3 * x + h4 * y + h5) / denom;

      const outIndex = (y * outWidth + x) * 4;

      if (sx < 0 || sy < 0 || sx >= srcWidth - 1 || sy >= srcHeight - 1) {
        outData[outIndex] = 0;
        outData[outIndex + 1] = 0;
        outData[outIndex + 2] = 0;
        outData[outIndex + 3] = 255;
        continue;
      }

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const dx = sx - x0;
      const dy = sy - y0;
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const i00 = (y0 * srcWidth + x0) * 4;
      const i10 = (y0 * srcWidth + x1) * 4;
      const i01 = (y1 * srcWidth + x0) * 4;
      const i11 = (y1 * srcWidth + x1) * 4;

      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      for (let c = 0; c < 3; c += 1) {
        outData[outIndex + c] =
          srcData[i00 + c] * w00 +
          srcData[i10 + c] * w10 +
          srcData[i01 + c] * w01 +
          srcData[i11 + c] * w11;
      }
      outData[outIndex + 3] = 255;
    }
  }

  outCtx.putImageData(outImage, 0, 0);
  return output;
}
