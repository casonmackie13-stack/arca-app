import { orderCorners } from "@/lib/scanner/cardVision";

/** Lightweight sanity checks for scanner geometry helpers. */
function assertOrderCorners() {
  const ordered = orderCorners([
    { x: 10, y: 100 },
    { x: 90, y: 100 },
    { x: 90, y: 10 },
    { x: 10, y: 10 },
  ]);
  if (ordered[0].x !== 10 || ordered[0].y !== 10) throw new Error("orderCorners failed top-left");
  if (ordered[2].x !== 90 || ordered[2].y !== 100) throw new Error("orderCorners failed bottom-right");
}

if (process.env.NODE_ENV === "test") {
  assertOrderCorners();
}

export { assertOrderCorners };
