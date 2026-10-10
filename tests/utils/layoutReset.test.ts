import { describe, it, expect } from 'vitest';
import { buildResetLayout, fitBlocksToColumns, DESKTOP_LAYOUT_FIELDS, MOBILE_LAYOUT_FIELDS } from '../../src/utils/layoutReset';
import { getDefaultLayout } from '../../src/validation';
import type { BlockInstance, LayoutConfig } from '../../src/types';

const STARTUP_FIELDS = [
  'openOnStartup', 'openMode', 'manualOpenMode', 'openWhenEmpty', 'pin', 'separateStartup',
  'mobileOpenOnStartup', 'mobileOpenMode', 'mobileManualOpenMode', 'mobileOpenWhenEmpty', 'mobilePin',
] as const;
const DISPLAY_FIELDS = ['showScrollbar', 'compactLayout', 'hoverHighlight'] as const;

function block(id: string, over: Partial<BlockInstance> = {}): BlockInstance {
  return { id, type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {}, ...over };
}

// A layout the user has customised: custom desktop + mobile blocks/columns, a
// fully diverged startup config and non-default display settings.
function customLayout(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
  return {
    ...getDefaultLayout(),
    columns: 5, blocks: [block('desk-1')],
    mobileColumns: 3, mobileBlocks: [block('mob-1')],
    openOnStartup: true, openMode: 'replace-all', manualOpenMode: 'replace-last', openWhenEmpty: true, pin: true,
    separateStartup: true, mobileOpenOnStartup: false, mobileOpenMode: 'retain', mobileManualOpenMode: 'retain',
    mobileOpenWhenEmpty: false, mobilePin: false,
    showScrollbar: false, compactLayout: false, hoverHighlight: false,
    ...overrides,
  };
}

function expectKept(result: LayoutConfig, source: LayoutConfig, fields: readonly (keyof LayoutConfig)[]): void {
  for (const f of fields) expect(result[f], `${f} must be kept`).toStrictEqual(source[f]);
}

function overlaps(blocks: BlockInstance[]): boolean {
  return blocks.some((a, i) => blocks.some((b, j) => i < j
    && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
}

describe('buildResetLayout resets only the active half (R4)', () => {
  it('unified: resets the layout and keeps startup, display and the dormant mobile layout', () => {
    const current = customLayout({ responsiveMode: 'unified' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, false);

    expect(next.blocks).toStrictEqual(fresh.blocks);
    expect(next.columns).toBe(fresh.columns);
    expectKept(next, current, [...STARTUP_FIELDS, ...DISPLAY_FIELDS, ...MOBILE_LAYOUT_FIELDS, 'responsiveMode']);
  });

  it('desktop in Separate mode: stays Separate and keeps the mobile layout, startup and display', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, false);

    expect(next.responsiveMode).toBe('separate');
    expect(next.blocks).toStrictEqual(fresh.blocks);
    expectKept(next, current, [...STARTUP_FIELDS, ...DISPLAY_FIELDS, ...MOBILE_LAYOUT_FIELDS]);
  });

  it('phone in Separate mode: restores the default blocks on the phone, fitted to its columns (N7)', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const next = buildResetLayout(current, fresh, true);

    expect(next.mobileBlocks.map(b => b.type).sort()).toStrictEqual(fresh.blocks.map(b => b.type).sort());
    expect(next.mobileColumns).toBe(fresh.mobileColumns);
    expect(next.mobileBlocks.every(b => b.x + b.w <= fresh.mobileColumns)).toBe(true);
    expect(overlaps(next.mobileBlocks)).toBe(false);
    expectKept(next, current, [...STARTUP_FIELDS, ...DISPLAY_FIELDS, ...DESKTOP_LAYOUT_FIELDS, 'responsiveMode']);
  });

  it('does not mutate the inputs', () => {
    const current = customLayout({ responsiveMode: 'separate' });
    const fresh = getDefaultLayout();
    const currentSnapshot = structuredClone(current);
    const freshSnapshot = structuredClone(fresh);
    buildResetLayout(current, fresh, true);
    buildResetLayout(current, fresh, false);
    expect(current).toStrictEqual(currentSnapshot);
    expect(fresh).toStrictEqual(freshSnapshot);
  });

  it('produces a complete LayoutConfig in every branch', () => {
    const fresh = getDefaultLayout();
    const expectedKeys = Object.keys(fresh).sort();
    for (const [mode, isMobile] of [['unified', false], ['separate', false], ['separate', true]] as const) {
      expect(Object.keys(buildResetLayout(customLayout({ responsiveMode: mode }), fresh, isMobile)).sort()).toStrictEqual(expectedKeys);
    }
  });
});

describe('fitBlocksToColumns (M9)', () => {
  it('packs blocks that shared a desktop row so none share a cell in one column', () => {
    const desktop = [block('a', { x: 0, w: 2 }), block('b', { x: 2 }), block('c', { y: 3, w: 3 })];
    const fitted = fitBlocksToColumns(desktop, 1);

    expect(fitted.every(b => b.x === 0 && b.w === 1)).toBe(true);
    expect(overlaps(fitted)).toBe(false);
  });

  it('copies the blocks, with fresh ids when asked', () => {
    const desktop = [block('a', { config: { items: [1] } })];
    let n = 0;
    const [copy] = fitBlocksToColumns(desktop, 2, () => `new-${++n}`);

    expect(copy.id).toBe('new-1');
    expect(copy.config.items).not.toBe(desktop[0].config.items);
    expect(desktop[0].id).toBe('a');
  });
});

describe('field-partition constants', () => {
  it('name real LayoutConfig keys and do not overlap', () => {
    const L = getDefaultLayout();
    for (const f of [...DESKTOP_LAYOUT_FIELDS, ...MOBILE_LAYOUT_FIELDS]) expect(f in L).toBe(true);
    expect(DESKTOP_LAYOUT_FIELDS.filter(f => (MOBILE_LAYOUT_FIELDS as readonly string[]).includes(f))).toStrictEqual([]);
  });
});
