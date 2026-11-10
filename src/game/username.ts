/** Username rules shared by the menu and the authoritative server. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;

const OFFENSIVE = new Set([
  'asshole', 'bastard', 'bitch', 'cunt', 'dick', 'faggot', 'fuck', 'nigger', 'nigga',
  'piss', 'porn', 'rape', 'retard', 'sex', 'shit', 'slut', 'whore',
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Returns a player-facing reason, or null when the name is valid. */
export function usernameIssue(raw: string): string | null {
  const name = normalizeUsername(raw);
  if (!name) return 'Enter a username.';
  if (name.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!/^[A-Za-z0-9_ ]+$/.test(name)) return 'Use letters, numbers, spaces and underscores only.';
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((word) => OFFENSIVE.has(word))) return 'That username is not allowed.';
  return null;
}

export function nameKey(raw: string): string {
  return normalizeUsername(raw).toLowerCase();
}
