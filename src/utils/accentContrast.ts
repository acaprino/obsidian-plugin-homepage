/**
 * The colours an accented card shows, computed the way the stylesheet mixes
 * them (`color-mix(in srgb, ...)`, which blends the gamma-encoded channels), so
 * the text colours can be chosen by their real contrast in each theme (M50, M51,
 * M107, M108). The theme colours are Obsidian's default theme; a theme that
 * moves its backgrounds far from them gets the nearest choice, not a perfect one.
 */

export type ThemeName = 'light' | 'dark';

/** Obsidian's default --background-secondary and --text-normal per theme. */
const THEMES: Record<ThemeName, { bg: string; text: string }> = {
  light: { bg: '#f6f6f6', text: '#222222' },
  dark: { bg: '#262626', text: '#dadada' },
};
const DARK_TEXT = '#1a1a1a';
const LIGHT_TEXT = '#f5f5f5';
/** WCAG AA for body text. */
const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function hex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** `color-mix(in srgb, a pct%, b)`. */
function mix(a: string, pct: number, b: string): string {
  const p = pct / 100;
  const ca = rgb(a);
  const cb = rgb(b);
  return hex([0, 1, 2].map(i => ca[i] * p + cb[i] * (1 - p)) as Rgb);
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of the two texts reads better on `bg`. */
function better(bg: string, a: string, b: string): string {
  return contrastRatio(a, bg) >= contrastRatio(b, bg) ? a : b;
}

export interface AccentColors {
  /** The card background. */
  bg: string;
  /** Card text; `flipText` when it is not the theme's own. */
  text: string;
  flipText: boolean;
  /** Accent-coloured text (links, titles, hashtags); `plainAccentText` when it falls back to `text`. */
  accentText: string;
  plainAccentText: boolean;
  /** Header title, on `headerBg`; `plainHeader` when it falls back to `text`. */
  header: string;
  /** What the title sits on: the header zone, tinted with the accent, or the card. */
  headerBg: string;
  plainHeader: boolean;
  /** Text on controls filled with the raw accent (the mic, Pomodoro's Start). */
  onAccent: string;
}

/**
 * `pct` is the accent's share of the card background; `opaque` is false when the
 * background is off, translucent or a gradient, where the card shows the theme
 * background (approximately) and the theme's text is kept.
 */
export function accentColors(accent: string, pct: number, opaque: boolean, theme: ThemeName, headerAccent = true): AccentColors {
  const t = THEMES[theme];
  const bg = opaque ? mix(accent, pct, t.bg) : t.bg;
  const other = theme === 'dark' ? DARK_TEXT : LIGHT_TEXT;
  const flipText = opaque && contrastRatio(t.text, bg) < MIN_CONTRAST && contrastRatio(other, bg) > contrastRatio(t.text, bg);
  const text = flipText ? other : t.text;
  // Accent-coloured text mixes toward white on a dark card and toward black on a
  // light one, as the stylesheet does (--_ctrl).
  const darkCard = contrastRatio(LIGHT_TEXT, bg) >= contrastRatio(DARK_TEXT, bg);
  const ctrl = darkCard ? mix(accent, 60, '#ffffff') : mix(accent, theme === 'dark' ? 50 : 60, '#000000');
  const plainAccentText = contrastRatio(ctrl, bg) < MIN_CONTRAST;
  // The title sits on the header zone: the accent at 22% over the card (--_accent-header-bg).
  const headerBg = headerAccent ? mix(accent, 22, bg) : bg;
  const headerMix = mix(accent, 85, text);
  const plainHeader = contrastRatio(headerMix, headerBg) < MIN_CONTRAST;
  return {
    bg,
    text,
    flipText,
    accentText: plainAccentText ? text : ctrl,
    plainAccentText,
    header: plainHeader ? text : headerMix,
    headerBg,
    plainHeader,
    onAccent: better(accent, '#ffffff', DARK_TEXT),
  };
}
