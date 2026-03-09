/**
 * Apply visual styling properties from block config to an element.
 * Shared between buildBlockWrapper (live cards) and refreshPreview (settings modal).
 */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const VALID_BORDER_STYLES = ['solid', 'dashed', 'dotted'];

export function applyBlockStyling(el: HTMLElement, config: Record<string, unknown>): void {
  // ── Accent color ───────────────────────────────────────────────────
  const accentColor = typeof config._accentColor === 'string'
    && HEX_COLOR_RE.test(config._accentColor) ? config._accentColor : '';
  el.toggleClass('block-accented', !!accentColor);
  el.toggleClass('block-no-header-accent', config._hideHeaderAccent === true);
  if (accentColor) el.style.setProperty('--block-accent', accentColor);
  else el.style.removeProperty('--block-accent');

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
  if (borderRadius) el.style.borderRadius = `${borderRadius}px`;
  else el.style.borderRadius = '';

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
    el.style.backdropFilter = `blur(${backdropBlur}px)`;
    el.style.setProperty('-webkit-backdrop-filter', `blur(${backdropBlur}px)`);
  } else {
    el.style.backdropFilter = '';
    el.style.removeProperty('-webkit-backdrop-filter');
  }

  // ── Background gradient ────────────────────────────────────────────
  const gradStart = typeof config._gradientStart === 'string'
    && HEX_COLOR_RE.test(config._gradientStart) ? config._gradientStart : '';
  const gradEnd = typeof config._gradientEnd === 'string'
    && HEX_COLOR_RE.test(config._gradientEnd) ? config._gradientEnd : '';
  const gradAngle = typeof config._gradientAngle === 'number'
    ? Math.max(0, Math.min(360, config._gradientAngle)) : 135;
  if (gradStart && gradEnd && config._hideBackground !== true) {
    el.style.background = `linear-gradient(${gradAngle}deg, ${gradStart}, ${gradEnd})`;
  } else if (config._hideBackground !== true) {
    el.style.background = '';
  }

  // ── Border width ───────────────────────────────────────────────────
  const borderWidth = typeof config._borderWidth === 'number'
    ? Math.max(0, Math.min(4, config._borderWidth)) : 0;
  if (borderWidth) el.style.borderWidth = `${borderWidth}px`;
  else el.style.borderWidth = '';

  // ── Border style ───────────────────────────────────────────────────
  const borderStyle = typeof config._borderStyle === 'string'
    && VALID_BORDER_STYLES.includes(config._borderStyle)
    ? config._borderStyle : '';
  if (borderStyle) el.style.borderStyle = borderStyle;
  else el.style.borderStyle = '';
}
