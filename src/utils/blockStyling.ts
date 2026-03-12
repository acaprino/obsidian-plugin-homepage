/**
 * Apply visual styling properties from block config to an element.
 * Shared between buildBlockWrapper (live cards) and refreshPreview (settings modal).
 */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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

export function applyBlockStyling(el: HTMLElement, config: Record<string, unknown>): void {
  // ── Accent color ───────────────────────────────────────────────────
  const accentColor = typeof config._accentColor === 'string'
    && HEX_COLOR_RE.test(config._accentColor) ? config._accentColor : '';
  el.toggleClass('block-accented', !!accentColor);
  el.toggleClass('block-no-header-accent', config._hideHeaderAccent === true);
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
    // Uses accent luminance × effective intensity to approximate background
    // brightness — avoids reading computed CSS vars at runtime.
    const effectiveIntensity = intensity || 15; // match CSS default (15%)
    // Threshold 0.15 catches near-white accents at the CSS default 15% intensity
    // (e.g. #ffffff × 0.15 = 0.15 ≥ 0.15) and yellow at ≥17% intensity.
    const needsDarkText = getRelativeLuminance(accentColor) * (effectiveIntensity / 100) >= 0.15;
    el.toggleClass('block-bright-accent', needsDarkText);
  } else {
    el.style.removeProperty('--block-accent');
    el.style.removeProperty('--block-accent-pct');
    el.toggleClass('block-bright-accent', false);
  }

  // ── Visibility flags ───────────────────────────────────────────────
  el.toggleClass('block-no-border', config._hideBorder === true);
  el.toggleClass('block-no-background', config._hideBackground === true);

  // ── Padding ────────────────────────────────────────────────────────
  const pad = typeof config._cardPadding === 'number'
    ? Math.max(0, Math.min(48, config._cardPadding)) : 0;
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
  if (gradStart && gradEnd && config._hideBackground !== true) {
    el.style.setProperty('--hp-bg-gradient', `linear-gradient(${gradAngle}deg, ${gradStart}, ${gradEnd})`);
    el.toggleClass('block-has-gradient', true);
  } else if (config._hideBackground !== true) {
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
