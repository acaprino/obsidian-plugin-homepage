/**
 * Apply visual styling properties from block config to an element.
 * Shared between buildBlockWrapper (live cards) and refreshPreview (settings modal).
 */

import { accentColors } from './accentContrast';

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * The one range table for the numeric shared styling keys: the block settings
 * controls offer exactly these bounds (BlockSettingsModal), rendering clamps to
 * them (below), and a clipboard import clamps to them (importSanitizer.ts).
 */
export const STYLE_RANGES = {
  _titleGap: { min: 0, max: 48 },
  _cardPadding: { min: 0, max: 48 }, // negative values rendered as zero and pushed some content out (M106)
  _bgOpacity: { min: 0, max: 100 },
  _backdropBlur: { min: 0, max: 20 },
  _borderWidth: { min: 0, max: 4 },
  _borderRadius: { min: 0, max: 24 },
  _elevation: { min: 0, max: 3 },
  _accentIntensity: { min: 5, max: 100 },
  _gradientAngle: { min: 0, max: 360 },
} as const;

export type RangedStyleKey = keyof typeof STYLE_RANGES;

/** Clamp `value` to the range of the styling key `key`. */
export function clampStyle(key: RangedStyleKey, value: number): number {
  const { min, max } = STYLE_RANGES[key];
  return Math.max(min, Math.min(max, value));
}

export const VALID_BORDER_STYLES: readonly string[] = ['solid', 'dashed', 'dotted'];

// ── Custom CSS allowlist ──────────────────────────────────────────────
// Only custom properties matching this pattern are accepted from user input.
// Keeping the scope to --hp-btn-* means a poisoned customCss (e.g. from an
// imported layout) cannot escape the block bounds via `position: fixed`,
// overlay the UI via `z-index`, or affect anything outside .grid-btn.
const HP_BTN_KEY_RE = /^--hp-btn-[a-z0-9-]+$/;

// Reject any value that can fetch or reference external resources. These
// functions can leak the user's IP and vault-open telemetry to a remote
// attacker through inline styles on render. `var()` and `calc()` are safe
// and not listed here.
const UNSAFE_VALUE_RE = /\b(?:url|image|image-set|cross-fade|element|paint)\s*\(/i;

// Parse a user-supplied declaration string into an allowlisted [key, value]
// array. Strips CSS comments, splits on `;`, keeps only --hp-btn-* keys with
// values free of external-resource functions and control characters.
function parseAllowlistedCustomCss(input: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const stripped = input.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const raw of stripped.split(';')) {
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (!key || !value) continue;
    if (!HP_BTN_KEY_RE.test(key)) continue;
    if (UNSAFE_VALUE_RE.test(value)) continue;
    // Reject any Unicode "Control" category character (C0 + C1). Uses
    // \p{Cc} instead of a literal character range so the regex doesn't
    // trip ESLint's no-control-regex rule.
    if (/\p{Cc}/u.test(value)) continue;
    out.push([key, value]);
  }
  return out;
}

export function applyBlockStyling(el: HTMLElement, config: Record<string, unknown>): void {
  // ── Custom CSS ─────────────────────────────────────────────────────
  // `customCss` is a block-specific field owned by ButtonGridBlock
  // (not a shared `_`-prefixed key). Only --hp-btn-* custom properties are
  // applied; anything else is rejected by parseAllowlistedCustomCss.
  // Declarations go through setProperty (not cssText) so caller-set inline
  // styles on the wrapper (e.g. --hp-card-anim-delay, set by buildBlockWrapper)
  // survive. Previous keys are tracked via data-hp-custom-css-keys and
  // removed before the new set is applied, so edits fully replace the
  // prior style.
  const prevKeys = el.getAttribute('data-hp-custom-css-keys');
  if (prevKeys) {
    for (const k of prevKeys.split(',')) {
      if (k) el.style.removeProperty(k);
    }
  }
  const rawCustomCss = typeof config.customCss === 'string' ? config.customCss : '';
  const safeDecls = parseAllowlistedCustomCss(rawCustomCss);
  for (const [k, v] of safeDecls) el.style.setProperty(k, v);
  if (safeDecls.length > 0) {
    el.setAttribute('data-hp-custom-css-keys', safeDecls.map(([k]) => k).join(','));
  } else {
    el.removeAttribute('data-hp-custom-css-keys');
  }

  // ── Accent color ───────────────────────────────────────────────────
  const accentColor = typeof config._accentColor === 'string'
    && HEX_COLOR_RE.test(config._accentColor) ? config._accentColor : '';
  el.toggleClass('block-accented', !!accentColor);
  el.toggleClass('block-no-header-accent', config._showHeaderAccent === false);
  if (accentColor) {
    el.style.setProperty('--block-accent', accentColor);
    // Only set --block-accent-pct when it differs from the CSS default (15%)
    // so the CSS fallback governs unless explicitly overridden.
    const intensity = typeof config._accentIntensity === 'number'
      ? clampStyle('_accentIntensity', config._accentIntensity) : 0;
    if (intensity && intensity !== 15) {
      el.style.setProperty('--block-accent-pct', `${intensity}%`);
    } else {
      el.style.removeProperty('--block-accent-pct');
    }
  } else {
    el.style.removeProperty('--block-accent');
    el.style.removeProperty('--block-accent-pct');
  }

  // ── Visibility flags ───────────────────────────────────────────────
  el.toggleClass('block-no-border', config._showBorder === false);
  el.toggleClass('block-no-background', config._showBackground === false);

  // ── Padding ────────────────────────────────────────────────────────
  const pad = typeof config._cardPadding === 'number'
    ? clampStyle('_cardPadding', config._cardPadding) : 0;
  if (pad) el.style.setProperty('--hp-card-padding', `${pad}px`);
  else el.style.removeProperty('--hp-card-padding');

  // ── Title gap ──────────────────────────────────────────────────────
  const gap = typeof config._titleGap === 'number'
    ? clampStyle('_titleGap', config._titleGap) : 0;
  if (gap) el.style.setProperty('--hp-title-gap', `${gap}px`);
  else el.style.removeProperty('--hp-title-gap');

  // ── Elevation ──────────────────────────────────────────────────────
  for (let i = 1; i <= 3; i++) el.removeClass(`block-elevation-${i}`);
  const elevation = typeof config._elevation === 'number'
    ? clampStyle('_elevation', config._elevation) : 0;
  if (elevation) el.addClass(`block-elevation-${elevation}`);

  // ── Border radius ──────────────────────────────────────────────────
  const borderRadius = typeof config._borderRadius === 'number'
    ? clampStyle('_borderRadius', config._borderRadius) : 0;
  if (borderRadius) el.style.setProperty('--hp-border-radius', `${borderRadius}px`);
  else el.style.removeProperty('--hp-border-radius');

  // ── Background opacity ─────────────────────────────────────────────
  const bgOpacity = typeof config._bgOpacity === 'number'
    ? clampStyle('_bgOpacity', config._bgOpacity) : 100;
  // With the background off there is no background to make translucent: the
  // opacity rule brought it back, and hovering toggled it (M110).
  const translucent = bgOpacity < 100 && config._showBackground !== false;
  el.toggleClass('block-custom-opacity', translucent);
  if (translucent) el.style.setProperty('--hp-bg-opacity', `${bgOpacity}%`);
  else el.style.removeProperty('--hp-bg-opacity');

  // ── Backdrop blur (only when opacity < 100) ────────────────────────
  const backdropBlur = typeof config._backdropBlur === 'number'
    ? clampStyle('_backdropBlur', config._backdropBlur) : 0;
  if (backdropBlur > 0 && bgOpacity < 100) {
    el.style.setProperty('--hp-backdrop-blur', `blur(${backdropBlur}px)`);
  } else {
    el.style.removeProperty('--hp-backdrop-blur');
  }

  // ── Background gradient ────────────────────────────────────────────
  const gradStart = typeof config._gradientStart === 'string'
    && HEX_COLOR_RE.test(config._gradientStart) ? config._gradientStart : '';
  const gradEnd = typeof config._gradientEnd === 'string'
    && HEX_COLOR_RE.test(config._gradientEnd) ? config._gradientEnd : '';
  const gradAngle = typeof config._gradientAngle === 'number'
    ? clampStyle('_gradientAngle', config._gradientAngle) : 135;
  if (gradStart && gradEnd && config._showBackground !== false) {
    el.style.setProperty('--hp-bg-gradient', `linear-gradient(${gradAngle}deg, ${gradStart}, ${gradEnd})`);
    el.toggleClass('block-has-gradient', true);
  } else {
    el.style.removeProperty('--hp-bg-gradient');
    el.toggleClass('block-has-gradient', false);
  }

  // ── Text colours on the accent (M50, M51, M107, M108) ───────────────
  // Chosen by their real contrast in each theme, with the card mixed as the
  // stylesheet mixes it. Only an opaque accent background changes the card's
  // text; a hidden, translucent or gradient background keeps the theme's.
  const accentIntensity = typeof config._accentIntensity === 'number'
    ? clampStyle('_accentIntensity', config._accentIntensity) : 15;
  const opaque = config._showBackground !== false && bgOpacity >= 100 && !(gradStart && gradEnd);
  const light = accentColor ? accentColors(accentColor, accentIntensity, opaque, 'light') : null;
  const dark = accentColor ? accentColors(accentColor, accentIntensity, opaque, 'dark') : null;
  el.toggleClass('block-bright-accent', !!dark?.flipText);
  el.toggleClass('block-dark-accent', !!light?.flipText);
  el.toggleClass('hp-plain-header-light', !!light?.plainHeader);
  el.toggleClass('hp-plain-header-dark', !!dark?.plainHeader);
  el.toggleClass('hp-plain-accent-light', !!light?.plainAccentText);
  el.toggleClass('hp-plain-accent-dark', !!dark?.plainAccentText);
  el.toggleClass('hp-dark-on-accent', light?.onAccent === '#1a1a1a');

  // ── Border width ───────────────────────────────────────────────────
  const borderWidth = typeof config._borderWidth === 'number'
    ? clampStyle('_borderWidth', config._borderWidth) : 0;
  if (borderWidth) el.style.setProperty('--hp-border-width', `${borderWidth}px`);
  else el.style.removeProperty('--hp-border-width');

  // ── Border style ───────────────────────────────────────────────────
  const borderStyle = typeof config._borderStyle === 'string'
    && VALID_BORDER_STYLES.includes(config._borderStyle)
    ? config._borderStyle : '';
  if (borderStyle) el.style.setProperty('--hp-border-style', borderStyle);
  else el.style.removeProperty('--hp-border-style');
}
