const PRODUCTION_ORIGIN = "https://arcaxii.com";

export function getAuthCallbackUrl() {
  const origin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : PRODUCTION_ORIGIN;

  return `${origin.replace(/\/$/, "")}/auth/callback`;
}
