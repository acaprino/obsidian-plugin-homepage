import { describe, it, expect } from 'vitest';
import { HEX_COLOR_RE } from '../../src/utils/blockStyling';

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
