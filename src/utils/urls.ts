/**
 * Absolute-URL schemes that must never be handed to a navigation API
 * (window.open / openLinkText): they can execute code or read local resources.
 */
const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

/**
 * True when `value` parses as an absolute URL whose scheme is dangerous
 * (javascript:, data:, vbscript:, file:, blob:). Vault paths and relative links
 * don't parse as absolute URLs, so they return false and are safe to forward to
 * Obsidian's openLinkText. Use this to gate user-supplied bookmark/button links
 * (which can arrive via an imported layout) before navigating.
 */
export function isDangerousUrl(value: string): boolean {
  if (typeof value !== 'string' || !value) return false;
  try {
    return DANGEROUS_SCHEMES.has(new URL(value).protocol);
  } catch {
    // Not an absolute URL — a vault path or relative link.
    return false;
  }
}
