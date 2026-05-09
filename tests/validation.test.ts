import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT_DATA,
  MAX_BLOCKS,
  getDefaultLayout,
  isLayoutPriority,
  isOpenMode,
  isResponsiveMode,
  isValidBlockInstance,
  migrateBlockInstance,
  validateBlocks,
  validateLayout,
} from '../src/validation';
import type { BlockInstance } from '../src/types';

// Tiny factory — the defaults cover every block-shape requirement so tests can
// assert on a single dimension at a time.
function block(overrides: Partial<BlockInstance> = {}): BlockInstance {
  return {
    id: 'b1',
    type: 'clock',
    x: 0,
    y: 0,
    w: 1,
    h: 3,
    config: {},
    ...overrides,
  };
}

describe('type guards', () => {
  it('accepts valid open-mode strings only', () => {
    for (const m of ['replace-all', 'replace-last', 'retain']) expect(isOpenMode(m)).toBe(true);
    for (const bad of ['', 'replace', 'RETAIN', 42, null, undefined]) expect(isOpenMode(bad)).toBe(false);
  });

  it('accepts only "row" as a layout priority', () => {
    expect(isLayoutPriority('row')).toBe(true);
    for (const bad of ['column', '', 'ROW', null]) expect(isLayoutPriority(bad)).toBe(false);
  });

  it('accepts only "unified" and "separate" responsive modes', () => {
    expect(isResponsiveMode('unified')).toBe(true);
    expect(isResponsiveMode('separate')).toBe(true);
    for (const bad of ['', 'both', 42]) expect(isResponsiveMode(bad)).toBe(false);
  });
});

describe('isValidBlockInstance', () => {
  it('accepts a minimal well-formed block', () => {
    expect(isValidBlockInstance(block())).toBe(true);
  });

  it('rejects a block with a non-URL-safe id', () => {
    expect(isValidBlockInstance(block({ id: 'has spaces' }))).toBe(false);
    expect(isValidBlockInstance(block({ id: '../escape' }))).toBe(false);
    expect(isValidBlockInstance(block({ id: 'emoji\u{1F600}' }))).toBe(false);
  });

  it('rejects a block with an unknown type', () => {
    expect(isValidBlockInstance(block({ type: 'not-a-real-type' as never }))).toBe(false);
  });

  it.each([
    ['negative x', { x: -1 }],
    ['negative y', { y: -1 }],
    ['zero width', { w: 0 }],
    ['zero height', { h: 0 }],
    ['NaN width', { w: Number.NaN }],
    ['Infinity height', { h: Number.POSITIVE_INFINITY }],
  ])('rejects %s', (_label, overrides) => {
    expect(isValidBlockInstance(block(overrides as Partial<BlockInstance>))).toBe(false);
  });

  it('rejects a block whose config is null, an array, or a primitive', () => {
    expect(isValidBlockInstance(block({ config: null as unknown as Record<string, unknown> }))).toBe(false);
    expect(isValidBlockInstance(block({ config: [] as unknown as Record<string, unknown> }))).toBe(false);
    expect(isValidBlockInstance(block({ config: 'config' as unknown as Record<string, unknown> }))).toBe(false);
  });

  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 42, 'block', []]) expect(isValidBlockInstance(bad)).toBe(false);
  });
});

describe('migrateBlockInstance', () => {
  it('migrates legacy col/row/colSpan/rowSpan to x/y/w/h', () => {
    const migrated = migrateBlockInstance({
      id: 'b', type: 'clock', col: 2, row: 3, colSpan: 2, rowSpan: 4, config: {},
    });
    expect(migrated).toMatchObject({ x: 1, y: 2, w: 2, h: 4 });
    expect('col' in migrated).toBe(false);
    expect('row' in migrated).toBe(false);
    expect('colSpan' in migrated).toBe(false);
    expect('rowSpan' in migrated).toBe(false);
  });

  it('renames the legacy tag-grid type to button-grid', () => {
    expect(migrateBlockInstance({ type: 'tag-grid', config: {} }).type).toBe('button-grid');
  });

  it('splits the legacy _transparent flag into _showBorder + _showBackground (inverted)', () => {
    const migrated = migrateBlockInstance({
      type: 'clock', config: { _transparent: true },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg._showBorder).toBe(false);
    expect(cfg._showBackground).toBe(false);
    expect(cfg._transparent).toBeUndefined();
  });

  it.each([
    ['_hideTitle', '_showTitle'],
    ['_hideBorder', '_showBorder'],
    ['_hideBackground', '_showBackground'],
    ['_hideHeaderAccent', '_showHeaderAccent'],
  ])('migrates legacy %s: true to %s: false', (hideKey, showKey) => {
    const migrated = migrateBlockInstance({
      type: 'clock', config: { [hideKey]: true },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg[showKey]).toBe(false);
    expect(hideKey in cfg).toBe(false);
  });

  it('drops legacy _hideX: false without setting _showX (absent = shown)', () => {
    const migrated = migrateBlockInstance({
      type: 'clock', config: { _hideTitle: false, _hideBorder: false },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect('_hideTitle' in cfg).toBe(false);
    expect('_hideBorder' in cfg).toBe(false);
    expect('_showTitle' in cfg).toBe(false);
    expect('_showBorder' in cfg).toBe(false);
  });

  it('does not overwrite an explicit _showX when migrating _hideX', () => {
    const migrated = migrateBlockInstance({
      type: 'clock', config: { _hideTitle: true, _showTitle: true },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg._showTitle).toBe(true);
    expect('_hideTitle' in cfg).toBe(false);
  });

  it('migrates quotes-list hideAccentBar: true to showAccentBar: false', () => {
    const migrated = migrateBlockInstance({
      type: 'quotes-list', config: { hideAccentBar: true },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg.showAccentBar).toBe(false);
    expect('hideAccentBar' in cfg).toBe(false);
  });

  it('migrates voice-dictation whisperApiKey/whisperLanguage to apiKey/language', () => {
    const migrated = migrateBlockInstance({
      type: 'voice-dictation',
      config: { whisperApiKey: 'sk-secret', whisperLanguage: 'en' },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg.apiKey).toBe('sk-secret');
    expect(cfg.language).toBe('en');
    expect(cfg.whisperApiKey).toBeUndefined();
    expect(cfg.whisperLanguage).toBeUndefined();
  });

  it('does not overwrite an existing apiKey when migrating whisperApiKey', () => {
    const migrated = migrateBlockInstance({
      type: 'voice-dictation',
      config: { whisperApiKey: 'old', apiKey: 'new' },
    });
    expect((migrated.config as Record<string, unknown>).apiKey).toBe('new');
  });

  it('clamps out-of-range button-grid columns', () => {
    const migrated = migrateBlockInstance({
      type: 'button-grid',
      config: { columns: 7 },
    });
    expect((migrated.config as Record<string, unknown>).columns).toBe(3);
  });

  it('drops customCss from any block type other than button-grid', () => {
    const migrated = migrateBlockInstance({
      type: 'clock',
      config: { customCss: 'body{display:none}' },
    });
    expect('customCss' in (migrated.config as Record<string, unknown>)).toBe(false);
  });

  it('keeps customCss on button-grid blocks', () => {
    const migrated = migrateBlockInstance({
      type: 'button-grid',
      config: { customCss: '--hp-btn-color: red' },
    });
    expect((migrated.config as Record<string, unknown>).customCss).toBe('--hp-btn-color: red');
  });

  it('migrates legacy title to _titleLabel (non-empty case)', () => {
    const migrated = migrateBlockInstance({
      type: 'clock',
      config: { title: 'My Clock' },
    });
    const cfg = migrated.config as Record<string, unknown>;
    expect(cfg._titleLabel).toBe('My Clock');
    expect(cfg.title).toBeUndefined();
  });

  it('sets _showTitle: false when migrating html/static-text with an empty title', () => {
    const html = migrateBlockInstance({ type: 'html', config: { title: '' } });
    expect((html.config as Record<string, unknown>)._showTitle).toBe(false);
    const text = migrateBlockInstance({ type: 'static-text', config: { title: '' } });
    expect((text.config as Record<string, unknown>)._showTitle).toBe(false);
  });

  it('is idempotent — migrate(migrate(x)) deep-equals migrate(x)', () => {
    const inputs = [
      { id: 'b', type: 'tag-grid', col: 1, row: 2, colSpan: 3, rowSpan: 4, config: { _transparent: true } },
      { id: 'b', type: 'voice-dictation', config: { whisperApiKey: 'k', whisperLanguage: 'en' } },
      { id: 'b', type: 'button-grid', x: 0, y: 0, w: 1, h: 1, config: { columns: 5, customCss: 'x' } },
      { id: 'b', type: 'html', x: 0, y: 0, w: 1, h: 1, config: { title: '' } },
    ];
    for (const raw of inputs) {
      const once = migrateBlockInstance({ ...raw } as Record<string, unknown>);
      const twice = migrateBlockInstance({ ...once });
      expect(twice).toStrictEqual(once);
    }
  });
});

describe('validateBlocks', () => {
  it('returns defaults when given a non-array', () => {
    const defaults: BlockInstance[] = [block()];
    expect(validateBlocks(null, 3, defaults)).toBe(defaults);
    expect(validateBlocks({}, 3, defaults)).toBe(defaults);
    expect(validateBlocks('blocks', 3, defaults)).toBe(defaults);
  });

  it('filters out invalid blocks', () => {
    const result = validateBlocks(
      [block({ id: 'a' }), { id: 'bad spaces' }, block({ id: 'c' })],
      3,
      [],
    );
    expect(result.map(b => b.id)).toEqual(['a', 'c']);
  });

  it(`caps the array at MAX_BLOCKS=${MAX_BLOCKS}`, () => {
    const many = Array.from({ length: MAX_BLOCKS + 50 }, (_, i) => block({ id: 'b' + i }));
    expect(validateBlocks(many, 3, []).length).toBe(MAX_BLOCKS);
  });

  it('clamps width + x so the block fits inside the column count', () => {
    const [out] = validateBlocks(
      [block({ w: 10, x: 20 })],
      3,
      [],
    );
    expect(out.w).toBeLessThanOrEqual(3);
    expect(out.x).toBeGreaterThanOrEqual(0);
    expect(out.x + out.w).toBeLessThanOrEqual(3);
  });
});

describe('validateLayout', () => {
  it('returns a fresh defaults clone for non-objects', () => {
    for (const bad of [null, undefined, 42, '', []]) {
      const result = validateLayout(bad);
      expect(result).toStrictEqual(DEFAULT_LAYOUT_DATA);
      // Must be a fresh clone — mutating the result must not poison the template.
      expect(result).not.toBe(DEFAULT_LAYOUT_DATA);
    }
  });

  it('drops fields of the wrong type back to defaults', () => {
    const result = validateLayout({
      columns: 'three',
      layoutPriority: 'invalid',
      responsiveMode: 42,
      openMode: 'nope',
      manualOpenMode: null,
      pin: 'true',
      showScrollbar: 0,
      blocks: 'not an array',
    });
    expect(result.columns).toBe(DEFAULT_LAYOUT_DATA.columns);
    expect(result.layoutPriority).toBe('row');
    expect(result.responsiveMode).toBe(DEFAULT_LAYOUT_DATA.responsiveMode);
    expect(result.openMode).toBe(DEFAULT_LAYOUT_DATA.openMode);
    expect(result.manualOpenMode).toBe(DEFAULT_LAYOUT_DATA.manualOpenMode);
    expect(result.pin).toBe(DEFAULT_LAYOUT_DATA.pin);
    expect(result.showScrollbar).toBe(DEFAULT_LAYOUT_DATA.showScrollbar);
  });

  it('migrates legacy hideScrollbar: true to showScrollbar: false', () => {
    expect(validateLayout({ hideScrollbar: true }).showScrollbar).toBe(false);
    expect(validateLayout({ hideScrollbar: false }).showScrollbar).toBe(true);
  });

  it('prefers new showScrollbar over legacy hideScrollbar when both are present', () => {
    expect(validateLayout({ showScrollbar: true, hideScrollbar: true }).showScrollbar).toBe(true);
  });

  it('only accepts columns in {2,3,4,5}', () => {
    expect(validateLayout({ columns: 1 }).columns).toBe(DEFAULT_LAYOUT_DATA.columns);
    expect(validateLayout({ columns: 6 }).columns).toBe(DEFAULT_LAYOUT_DATA.columns);
    expect(validateLayout({ columns: 4 }).columns).toBe(4);
  });

  it('only accepts mobileColumns in {1,2,3}', () => {
    expect(validateLayout({ mobileColumns: 0 }).mobileColumns).toBe(DEFAULT_LAYOUT_DATA.mobileColumns);
    expect(validateLayout({ mobileColumns: 5 }).mobileColumns).toBe(DEFAULT_LAYOUT_DATA.mobileColumns);
    expect(validateLayout({ mobileColumns: 2 }).mobileColumns).toBe(2);
  });

  it('accepts a round-trip default layout unchanged', () => {
    const defaults = getDefaultLayout();
    expect(validateLayout(defaults)).toStrictEqual(defaults);
  });

  it('is a fixed point (validateLayout ∘ validateLayout = validateLayout)', () => {
    // This is the contract the plugin relies on: on every load we validate and
    // immediately re-save, so a non-idempotent validator would corrupt data.json.
    const inputs: unknown[] = [
      null,
      {},
      { columns: 4, blocks: [] },
      getDefaultLayout(),
      {
        columns: 3,
        blocks: [
          { id: 'ok', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} },
          { id: 'bad spaces', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} },
          { id: 'legacy', type: 'tag-grid', col: 2, row: 2, colSpan: 1, rowSpan: 1, config: { _transparent: true } },
        ],
      },
    ];
    for (const raw of inputs) {
      const once = validateLayout(raw);
      const twice = validateLayout(once);
      expect(twice).toStrictEqual(once);
    }
  });

  it('migrates legacy blocks via validateBlocks', () => {
    const result = validateLayout({
      columns: 3,
      blocks: [{
        id: 'legacy',
        type: 'tag-grid',
        col: 2, row: 1, colSpan: 2, rowSpan: 2,
        config: { _transparent: true },
      }],
    });
    expect(result.blocks).toHaveLength(1);
    const b = result.blocks[0];
    expect(b.type).toBe('button-grid');
    expect(b.x).toBe(1);
    expect(b.y).toBe(0);
    expect(b.config._showBorder).toBe(false);
  });
});
