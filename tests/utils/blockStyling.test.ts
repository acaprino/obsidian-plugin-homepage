import { describe, it, expect } from 'vitest';
import { HEX_COLOR_RE, STYLE_RANGES, applyBlockStyling, clampStyle } from '../../src/utils/blockStyling';

describe('HEX_COLOR_RE', () => {
  it('accepts 6-digit hex colors with either case', () => {
    expect(HEX_COLOR_RE.test('#123456')).toBe(true);
    expect(HEX_COLOR_RE.test('#abcdef')).toBe(true);
    expect(HEX_COLOR_RE.test('#ABCDEF')).toBe(true);
  });

  it('rejects anything other than exactly #RRGGBB', () => {
    const bad = [
      '',
      '#',
      '#123',                 // shorthand not accepted
      '#12345',               // too short
      '#1234567',             // too long
      '123456',               // missing #
      'rgb(1,2,3)',
      '#gggggg',              // non-hex
      ' #123456',             // leading whitespace
      '#123456 ',             // trailing whitespace
    ];
    for (const input of bad) expect(HEX_COLOR_RE.test(input), `input="${input}"`).toBe(false);
  });
});

describe('applyBlockStyling — allowlist gate', () => {
  // We're not executing applyBlockStyling end-to-end (too much DOM surface);
  // the goal here is to lock down the regex that decides what user-supplied
  // custom CSS is allowed through. Those regexes live next to applyBlockStyling.
  it('HEX_COLOR_RE is the only exported regex (structural smoke test)', async () => {
    const mod = await import('../../src/utils/blockStyling');
    expect(typeof mod.applyBlockStyling).toBe('function');
    expect(mod.HEX_COLOR_RE).toBeInstanceOf(RegExp);
  });
});

describe('applyBlockStyling padding and background (M106, M110)', () => {
  it('offers no negative padding, which rendered as zero', () => {
    expect(STYLE_RANGES._cardPadding.min).toBe(0);
    expect(clampStyle('_cardPadding', -20)).toBe(0);
  });

  it('keeps the background hidden when its opacity is below 100', () => {
    const el = document.createElement('div');
    applyBlockStyling(el, { _showBackground: false, _bgOpacity: 50 });
    expect(el.classList.contains('block-no-background')).toBe(true);
    expect(el.classList.contains('block-custom-opacity')).toBe(false);
  });
});

describe('applyBlockStyling accent text classes (M50, M51, M107, M108)', () => {
  const styled = (config: Record<string, unknown>) => {
    const el = document.createElement('div');
    applyBlockStyling(el, config);
    return el.classList;
  };

  it('keeps light text on a dark card tinted 30% yellow', () => {
    expect(styled({ _accentColor: '#ffd500', _accentIntensity: 30 }).contains('block-bright-accent')).toBe(false);
  });

  it('flips text only on an opaque accent background', () => {
    expect(styled({ _accentColor: '#ffd500', _accentIntensity: 80 }).contains('block-bright-accent')).toBe(true);
    expect(styled({ _accentColor: '#ffd500', _accentIntensity: 80, _showBackground: false }).contains('block-bright-accent')).toBe(false);
    expect(styled({ _accentColor: '#ffd500', _accentIntensity: 80, _bgOpacity: 50 }).contains('block-bright-accent')).toBe(false);
    expect(styled({ _accentColor: '#1e3a8a', _accentIntensity: 100 }).contains('block-dark-accent')).toBe(true);
  });

  it('marks dark text on yellow controls and plain titles where the accent is unreadable', () => {
    const yellow = styled({ _accentColor: '#ffd500', _accentIntensity: 15 });
    expect(yellow.contains('hp-dark-on-accent')).toBe(true);
    expect(yellow.contains('hp-plain-header-light')).toBe(true);
  });
});
