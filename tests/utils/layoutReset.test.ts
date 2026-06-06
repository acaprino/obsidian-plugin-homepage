import { describe, it, expect } from 'vitest';
import { buildResetLayout, STARTUP_FIELDS, MOBILE_LAYOUT_FIELDS } from '../../src/utils/layoutReset';
import { getDefaultLayout } from '../../src/validation';
import type { BlockInstance, LayoutConfig } from '../../src/types';

function block(id: string): BlockInstance {
  return { id, type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {} };
}

// A layout the user has customised: custom desktop + mobile blocks/columns AND a
// fully diverged startup config (the thing a layout reset must NOT touch).
function customLayout(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return {
    ...getDefaultLayout(),
    columns: 5,
    blocks: [block('desk-1')],
    mobileColumns: 3,
    mobileBlocks: [block('mob-1')],
    openOnStartup: true,
    openMode: 'replace-all',
    manualOpenMode: 'replace-last',
    openWhenEmpty: true,
    pin: true,
    separateStartup: true,
    mobileOpenOnStartup: false,
    mobileOpenMode: 'retain',
    mobileManualOpenMode: 'retain',
    mobileOpenWhenEmpty: false,
    mobilePin: false,
    ...overrides,
  };
}

/** Assert every startup-family field on `result` equals the one on `source`. */
function expectStartupPreserved(result: LayoutConfig, source: LayoutConfig): void {
  for (const f of STARTUP_FIELDS) {
    expect(result[f], `startup field ${f} must be preserved`).toStrictEqual(source[f]);
  }
}

describe('buildResetLayout — startup config is never wiped (F1 regression)', () => {
  it('unified: resets layout but preserves the whole startup config', () => {
    const current = customLayout({ responsiveMode: 'unified' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, false);

    // Startup survives — the regression that motivated this test.
    expectStartupPreserved(next, current);
    expect(next.separateStartup).toBe(true);
    expect(next.mobileOpenOnStartup).toBe(false);
    expect(next.pin).toBe(true);
    // Layout is reset to defaults.
    expect(next.blocks).toStrictEqual(fresh.blocks);
    expect(next.columns).toBe(fresh.columns);
  });

  it('unified: preserves the dormant mobile layout slice (L6)', () => {
    // A user built a separate mobile layout, switched to unified, then reset.
    // The dormant mobile layout must survive (same class of asymmetry as F1).
    const current = customLayout({ responsiveMode: 'unified' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, false);

    expect(next.mobileBlocks).toStrictEqual(current.mobileBlocks);
    expect(next.mobileColumns).toBe(current.mobileColumns);
    expect(next.mobileLayoutPriority).toBe(current.mobileLayoutPriority);
    // …while the active (desktop) layout is still reset.
    expect(next.blocks).toStrictEqual(fresh.blocks);
    expect(next.columns).toBe(fresh.columns);
  });

  it('desktop-issued (separate): resets desktop layout, keeps mobile layout slice + startup', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, /* isMobileActive */ false);

    expectStartupPreserved(next, current);
    // Desktop layout reset…
    expect(next.blocks).toStrictEqual(fresh.blocks);
    expect(next.columns).toBe(fresh.columns);
    // …mobile layout slice preserved.
    expect(next.mobileBlocks).toStrictEqual(current.mobileBlocks);
    expect(next.mobileColumns).toBe(current.mobileColumns);
  });

  it('mobile-issued (separate): resets mobile layout slice, keeps desktop layout + startup', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, /* isMobileActive */ true);

    expectStartupPreserved(next, current);
    // Desktop layout preserved…
    expect(next.blocks).toStrictEqual(current.blocks);
    expect(next.columns).toBe(current.columns);
    // …mobile layout slice reset.
    expect(next.mobileBlocks).toStrictEqual(fresh.mobileBlocks);
    expect(next.mobileColumns).toBe(fresh.mobileColumns);
  });

  it('does not mutate the inputs', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const currentSnapshot = structuredClone(current);
    const freshSnapshot = structuredClone(fresh);
    buildResetLayout(current, fresh, false);
    expect(current).toStrictEqual(currentSnapshot);
    expect(fresh).toStrictEqual(freshSnapshot);
  });

  it('produces a complete LayoutConfig in every branch (no dropped keys)', () => {
    const fresh = getDefaultLayout();
    const expectedKeys = Object.keys(fresh).sort();
    for (const [mode, isMobile] of [['unified', false], ['separate', false], ['separate', true]] as const) {
      const next = buildResetLayout(customLayout({ responsiveMode: mode }), fresh, isMobile);
      expect(Object.keys(next).sort()).toStrictEqual(expectedKeys);
    }
  });
});

describe('field-partition constants (F3 single source of truth)', () => {
  it('STARTUP_FIELDS and MOBILE_LAYOUT_FIELDS are disjoint', () => {
    const overlap = STARTUP_FIELDS.filter(f => (MOBILE_LAYOUT_FIELDS as readonly string[]).includes(f));
    expect(overlap).toStrictEqual([]);
  });

  it('every named field exists on a real LayoutConfig', () => {
    const L = getDefaultLayout();
    for (const f of [...STARTUP_FIELDS, ...MOBILE_LAYOUT_FIELDS]) {
      expect(f in L, `${f} must be a LayoutConfig key`).toBe(true);
    }
  });
});
