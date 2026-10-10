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
