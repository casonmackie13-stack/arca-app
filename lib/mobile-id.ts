/**
 * Generates a collision-resistant identifier for upload object paths.
 * Older mobile Safari versions and non-secure LAN origins may not expose
 * crypto.randomUUID(), so keep a timestamp/random fallback for compatibility.
 */
export function createMobileSafeId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Continue to the non-cryptographic fallback used only for unique filenames.
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
