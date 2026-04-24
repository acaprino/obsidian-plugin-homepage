/**
 * URL-safe block id generator. Falls back to Math.random + timestamp when
 * crypto.randomUUID is unavailable (non-secure contexts, older WebViews).
 */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'hp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
