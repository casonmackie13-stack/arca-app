export const BIO_MAX_LENGTH = 280;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!username) return "Username is required.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > USERNAME_MAX_LENGTH) return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  if (!USERNAME_PATTERN.test(username)) return "Username may only use lowercase letters, numbers, and underscores.";
  return "";
}

export function validateBio(value: string) {
  if (value.length > BIO_MAX_LENGTH) return `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  return "";
}

export function validateDisplayName(value: string) {
  const name = value.trim();
  if (!name) return "Display name is required.";
  if (name.length > 60) return "Display name must be 60 characters or fewer.";
  return "";
}

export function profilePath(username: string) {
  return `/users/${encodeURIComponent(normalizeUsername(username))}`;
}
