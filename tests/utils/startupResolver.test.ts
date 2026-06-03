import { describe, it, expect } from 'vitest';
import { mobileStartupActive, resolveStartup } from '../../src/utils/startupResolver';
import { getDefaultLayout } from '../../src/validation';
import type { LayoutConfig } from '../../src/types';

function layout(overrides: Partial<LayoutConfig>): LayoutConfig {
  return { ...getDefaultLayout(), ...overrides };
}

// Distinct desktop vs mobile values so a mis-wired ternary (e.g. mobileOpenMode
// resolved into manualOpenMode) is caught by an exact-value assertion.
const DIVERGED = {
  separateStartup: true,
  openOnStartup: true, openMode: 'replace-all' as const, manualOpenMode: 'replace-last' as const,
  openWhenEmpty: true, pin: true,
  mobileOpenOnStartup: false, mobileOpenMode: 'retain' as const, mobileManualOpenMode: 'retain' as const,
  mobileOpenWhenEmpty: false, mobilePin: false,
};

describe('mobileStartupActive gate', () => {
  it('is false on desktop regardless of separateStartup', () => {
    expect(mobileStartupActive(layout({ separateStartup: true }), false)).toBe(false);
    expect(mobileStartupActive(layout({ separateStartup: false }), false)).toBe(false);
  });

  it('is true only on mobile AND separateStartup', () => {
    expect(mobileStartupActive(layout({ separateStartup: true }), true)).toBe(true);
    expect(mobileStartupActive(layout({ separateStartup: false }), true)).toBe(false);
  });
});

describe('resolveStartup — gate-off backward-compat (every existing vault)', () => {
  it('returns the desktop values even on mobile when separateStartup is false', () => {
    // The load-bearing guarantee: a vault that never enabled separate startup
    // must behave identically on every platform.
    const L = layout({ ...DIVERGED, separateStartup: false });
    expect(resolveStartup(L, true)).toStrictEqual({
      openOnStartup: true, openMode: 'replace-all', manualOpenMode: 'replace-last',
      openWhenEmpty: true, pin: true,
    });
  });

  it('returns the desktop values on desktop even when separateStartup is true', () => {
    const L = layout(DIVERGED);
    expect(resolveStartup(L, false)).toStrictEqual({
      openOnStartup: true, openMode: 'replace-all', manualOpenMode: 'replace-last',
      openWhenEmpty: true, pin: true,
    });
  });
});

describe('resolveStartup — gate-on resolves to the mobile* overrides', () => {
  it('returns every mobile* value on mobile when separateStartup is true', () => {
    const L = layout(DIVERGED);
    expect(resolveStartup(L, true)).toStrictEqual({
      openOnStartup: false, openMode: 'retain', manualOpenMode: 'retain',
      openWhenEmpty: false, pin: false,
    });
  });

  it('wires each field to its own counterpart (no cross-wiring)', () => {
    // Every mobile field a distinct value from its desktop sibling.
    const L = layout({
      separateStartup: true,
      openOnStartup: false, openMode: 'retain', manualOpenMode: 'retain', openWhenEmpty: false, pin: false,
      mobileOpenOnStartup: true, mobileOpenMode: 'replace-all', mobileManualOpenMode: 'replace-last',
      mobileOpenWhenEmpty: true, mobilePin: true,
    });
    const r = resolveStartup(L, true);
    expect(r.openOnStartup).toBe(true);
    expect(r.openMode).toBe('replace-all');
    expect(r.manualOpenMode).toBe('replace-last');
    expect(r.openWhenEmpty).toBe(true);
    expect(r.pin).toBe(true);
  });
});
