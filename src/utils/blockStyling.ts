/**
 * Apply visual styling properties from block config to an element.
 * Shared between buildBlockWrapper (live cards) and refreshPreview (settings modal).
 */

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function hexChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(hex: string): number {
  const r = hexChannelToLinear(parseInt(hex.slice(1, 3), 16));
  const g = hexChannelToLinear(parseInt(hex.slice(3, 5), 16));
  const b = hexChannelToLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const VALID_BORDER_STYLES = ['solid', 'dashed', 'dotted'];

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
  // styles on the wrapper (e.g. --hp-card-anim-delay at GridLayout.ts:415)
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
      ? Math.max(5, Math.min(100, config._accentIntensity)) : 0;
    if (intensity && intensity !== 15) {
      el.style.setProperty('--block-accent-pct', `${intensity}%`);
    } else {
      el.style.removeProperty('--block-accent-pct');
    }
    // Detect bright accent backgrounds that need dark text.
    // Approximates the color-mix() blended background by interpolating between
    // the dark-theme base luminance (~0.05) and the accent luminance at the
    // configured intensity. Threshold 0.18 triggers for yellow at ~25% and
    // white at ~15%, avoiding false positives on mid-range intensities.
    const DARK_BASE_LUM = 0.05;
    const BRIGHT_ACCENT_THRESHOLD = 0.18;
    const effectiveIntensity = intensity || 15; // match CSS default (15%)
    const ratio = effectiveIntensity / 100;
    const blendedLum = DARK_BASE_LUM * (1 - ratio) + getRelativeLuminance(accentColor) * ratio;
    const needsDarkText = blendedLum >= BRIGHT_ACCENT_THRESHOLD;
    el.toggleClass('block-bright-accent', needsDarkText);
  } else {
    el.style.removeProperty('--block-accent');
    el.style.removeProperty('--block-accent-pct');
    el.toggleClass('block-bright-accent', false);
  }

  // ── Visibility flags ───────────────────────────────────────────────
  el.toggleClass('block-no-border', config._showBorder === false);
  el.toggleClass('block-no-background', config._showBackground === false);

  // ── Padding ────────────────────────────────────────────────────────
  const pad = typeof config._cardPadding === 'number'
    ? Math.max(-48, Math.min(48, config._cardPadding)) : 0;
  if (pad) el.style.setProperty('--hp-card-padding', `${pad}px`);
  else el.style.removeProperty('--hp-card-padding');

  // ── Title gap ──────────────────────────────────────────────────────
  const gap = typeof config._titleGap === 'number'
    ? Math.max(0, Math.min(48, config._titleGap)) : 0;
  if (gap) el.style.setProperty('--hp-title-gap', `${gap}px`);
  else el.style.removeProperty('--hp-title-gap');

  // ── Elevation ──────────────────────────────────────────────────────
  for (let i = 1; i <= 3; i++) el.removeClass(`block-elevation-${i}`);
  const elevation = typeof config._elevation === 'number'
    ? Math.max(0, Math.min(3, config._elevation)) : 0;
  if (elevation) el.addClass(`block-elevation-${elevation}`);

  // ── Border radius ──────────────────────────────────────────────────
  const borderRadius = typeof config._borderRadius === 'number'
    ? Math.max(0, Math.min(24, config._borderRadius)) : 0;
  if (borderRadius) el.style.setProperty('--hp-border-radius', `${borderRadius}px`);
  else el.style.removeProperty('--hp-border-radius');

  // ── Background opacity ─────────────────────────────────────────────
  const bgOpacity = typeof config._bgOpacity === 'number'
    ? Math.max(0, Math.min(100, config._bgOpacity)) : 100;
  el.toggleClass('block-custom-opacity', bgOpacity < 100);
  if (bgOpacity < 100) el.style.setProperty('--hp-bg-opacity', `${bgOpacity}%`);
  else el.style.removeProperty('--hp-bg-opacity');

  // ── Backdrop blur (only when opacity < 100) ────────────────────────
  const backdropBlur = typeof config._backdropBlur === 'number'
    ? Math.max(0, Math.min(20, config._backdropBlur)) : 0;
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
    ? Math.max(0, Math.min(360, config._gradientAngle)) : 135;
  if (gradStart && gradEnd && config._showBackground !== false) {
    el.style.setProperty('--hp-bg-gradient', `linear-gradient(${gradAngle}deg, ${gradStart}, ${gradEnd})`);
    el.toggleClass('block-has-gradient', true);
  } else {
    el.style.removeProperty('--hp-bg-gradient');
    el.toggleClass('block-has-gradient', false);
  }

  // ── Border width ───────────────────────────────────────────────────
  const borderWidth = typeof config._borderWidth === 'number'
    ? Math.max(0, Math.min(4, config._borderWidth)) : 0;
  if (borderWidth) el.style.setProperty('--hp-border-width', `${borderWidth}px`);
  else el.style.removeProperty('--hp-border-width');

  // ── Border style ───────────────────────────────────────────────────
  const borderStyle = typeof config._borderStyle === 'string'
    && VALID_BORDER_STYLES.includes(config._borderStyle)
    ? config._borderStyle : '';
  if (borderStyle) el.style.setProperty('--hp-border-style', borderStyle);
  else el.style.removeProperty('--hp-border-style');
}
