import { describe, it, expect } from 'vitest';
import { accentColors, contrastRatio } from '../../src/utils/accentContrast';

const YELLOW = '#ffd500';
const NAVY = '#1e3a8a';

describe('accentColors: card text (M50)', () => {
  it('keeps light text on a dark-theme card a low share of yellow tints', () => {
    // A linear blend over an assumed base picked near-black text here (down to 1.04:1).
    const c = accentColors(YELLOW, 30, true, 'dark');
    expect(c.flipText).toBe(false);
    expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('turns to dark text on a dark-theme card that is mostly yellow', () => {
    const c = accentColors(YELLOW, 80, true, 'dark');
    expect(c.flipText).toBe(true);
    expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('turns to light text on a light-theme card that is mostly a dark accent', () => {
    const c = accentColors(NAVY, 100, true, 'light');
    expect(c.flipText).toBe(true);
    expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('changes nothing when the card shows no opaque accent background', () => {
    expect(accentColors(YELLOW, 80, false, 'dark').flipText).toBe(false);
    expect(accentColors(NAVY, 100, false, 'light').flipText).toBe(false);
  });
});

describe('accentColors: accent-coloured text (M51, M107)', () => {
  const accents = ['#ffd500', '#f1c40f', '#1e3a8a', '#8e44ad', '#c0392b', '#27ae60', '#000000', '#ffffff'];
  for (const theme of ['light', 'dark'] as const) {
    for (const pct of [15, 40, 100]) {
      // Below 4.5:1 the remedy is the card's own text (M107); on a mid-tone card
      // even that may fall short, so: never less readable than the card text.
      it(`is never less readable than the card text in the ${theme} theme at ${pct}%`, () => {
        for (const a of accents) {
          const c = accentColors(a, pct, true, theme);
          const floor = Math.min(4.5, contrastRatio(c.text, c.bg));
          expect.soft(contrastRatio(c.accentText, c.bg), `${a} accent text`).toBeGreaterThanOrEqual(floor);
          expect.soft(contrastRatio(c.header, c.bg), `${a} header`).toBeGreaterThanOrEqual(floor);
        }
      });

      it(`picks the more readable card text in the ${theme} theme at ${pct}%`, () => {
        for (const a of accents) {
          const c = accentColors(a, pct, true, theme);
          const alternative = theme === 'dark' ? '#1a1a1a' : '#f5f5f5';
          const own = theme === 'dark' ? '#dadada' : '#222222';
          const best = Math.max(contrastRatio(own, c.bg), contrastRatio(alternative, c.bg));
          expect.soft(contrastRatio(c.text, c.bg), a).toBeGreaterThanOrEqual(Math.min(best, 4.5));
        }
      });
    }
  }
});

describe('accentColors: text on accent-filled controls (M108)', () => {
  it('is dark on a yellow mic or Start button, white on a dark one', () => {
    expect(accentColors(YELLOW, 15, true, 'light').onAccent).toBe('#1a1a1a');
    expect(accentColors(YELLOW, 15, true, 'dark').onAccent).toBe('#1a1a1a');
    expect(accentColors(NAVY, 15, true, 'dark').onAccent).toBe('#ffffff');
  });
});

describe('accentColors: the title sits on the tinted header zone (M107, after review)', () => {
  it('measures the title against the header zone when the header accent is on', () => {
    const c = accentColors('#000044', 50, true, 'light', true);
    expect(c.plainHeader).toBe(true);
    expect(contrastRatio(c.header, c.headerBg)).toBeGreaterThanOrEqual(Math.min(4.5, contrastRatio(c.text, c.headerBg)));
  });

  it('measures it against the card without the header accent', () => {
    const c = accentColors('#000044', 50, true, 'light', false);
    expect(c.headerBg).toBe(c.bg);
  });
});

describe('accentColors: the same accent-text mix as the stylesheet (minor)', () => {
  // styles.css: dark theme -> 60% white, dark theme on a flipped (bright) card -> 50% black,
  // light theme -> 60% black, light theme on a flipped (dark) card -> 60% white.
  const mixHex = (a: string, pct: number, b: string): string => {
    const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
    return '#' + [1, 3, 5].map(i => Math.round(ch(a, i) * pct / 100 + ch(b, i) * (1 - pct / 100)).toString(16).padStart(2, '0')).join('');
  };
  it('matches it for every sampled accent and intensity', () => {
    const mismatches: string[] = [];
    for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
      const accent = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
      for (let pct = 10; pct <= 100; pct += 10) {
        for (const theme of ['light', 'dark'] as const) {
          const c = accentColors(accent, pct, true, theme);
          if (c.plainAccentText) continue;
          const css = theme === 'dark'
            ? (c.flipText ? mixHex(accent, 50, '#000000') : mixHex(accent, 60, '#ffffff'))
            : (c.flipText ? mixHex(accent, 60, '#ffffff') : mixHex(accent, 60, '#000000'));
          if (c.accentText !== css) mismatches.push(`${accent} ${pct}% ${theme}`);
        }
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});
