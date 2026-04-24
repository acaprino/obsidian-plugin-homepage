import { BLOCK_TYPES, BlockInstance, LayoutConfig, LayoutPriority, OpenMode, ResponsiveMode } from './types';

// ── Type guards for union-typed fields ──────────────────────────────────────

const VALID_OPEN_MODES = new Set<OpenMode>(['replace-all', 'replace-last', 'retain']);
const VALID_LAYOUT_PRIORITIES = new Set<LayoutPriority>(['row']);
const VALID_RESPONSIVE_MODES = new Set<ResponsiveMode>(['unified', 'separate']);

export function isOpenMode(v: unknown): v is OpenMode {
  return typeof v === 'string' && (VALID_OPEN_MODES as Set<string>).has(v);
}

export function isLayoutPriority(v: unknown): v is LayoutPriority {
  return typeof v === 'string' && (VALID_LAYOUT_PRIORITIES as Set<string>).has(v);
}

export function isResponsiveMode(v: unknown): v is ResponsiveMode {
  return typeof v === 'string' && (VALID_RESPONSIVE_MODES as Set<string>).has(v);
}

// ── Default layout template ─────────────────────────────────────────────────

/** Immutable template. Always clone via getDefaultLayout(). */
export const DEFAULT_LAYOUT_DATA: LayoutConfig = {
  columns: 3,
  layoutPriority: 'row',
  responsiveMode: 'unified',
  mobileColumns: 1,
  mobileLayoutPriority: 'row',
  mobileBlocks: [],
  openOnStartup: false,
  openMode: 'retain',
  manualOpenMode: 'retain',
  openWhenEmpty: false,
  pin: false,
  showScrollbar: true,
  compactLayout: true,
  hoverHighlight: true,
  blocks: [
    // Row 0 (y: 0–2)
    {
      id: 'default-static-text',
      type: 'static-text',
      x: 0, y: 0, w: 1, h: 3,
      config: { content: '' },
    },
    {
      id: 'default-clock',
      type: 'clock',
      x: 1, y: 0, w: 1, h: 3,
      config: { showSeconds: false, showDate: true },
    },
    {
      id: 'default-folder-links',
      type: 'folder-links',
      x: 2, y: 0, w: 1, h: 3,
      config: { _titleLabel: 'Quick links', links: [] },
    },
    // Row 1 (y: 3–5)
    {
      id: 'default-insight',
      type: 'quotes-list',
      x: 0, y: 3, w: 2, h: 3,
      config: { tag: '', _titleLabel: 'Daily insight', dailySeed: true },
    },
    {
      id: 'default-button-grid',
      type: 'button-grid',
      x: 2, y: 3, w: 1, h: 5,
      config: {
        _titleLabel: 'Quick actions', columns: 2, items: [
          { emoji: '\u{1F4DD}', label: 'New note' },
          { emoji: '\u{1F4C5}', label: 'Today' },
          { emoji: '\u{2B50}', label: 'Favorites' },
          { emoji: '\u{1F50D}', label: 'Search' },
          { emoji: '\u{1F4DA}', label: 'Library' },
          { emoji: '\u{2699}️', label: 'Settings' },
        ],
      },
    },
    // Row 2 (y: 6–8)
    {
      id: 'default-quotes',
      type: 'quotes-list',
      x: 0, y: 6, w: 2, h: 3,
      config: { tag: '', _titleLabel: 'Quotes', columns: 2, maxItems: 0 },
    },
    // Row 3 (y: 8)
    {
      id: 'default-voice-dictation',
      type: 'voice-dictation',
      x: 0, y: 8, w: 2, h: 3,
      config: { folder: '', triggerMode: 'tap', _titleLabel: 'Voice notes' },
    },
    // Row 4 (y: 11–13)
    {
      id: 'default-gallery',
      type: 'image-gallery',
      x: 0, y: 11, w: 3, h: 3,
      config: { folder: '', _titleLabel: 'Gallery', columns: 3, maxItems: 0 },
    },
  ],
};

/** Returns a deep clone of the default layout, safe to mutate. */
export function getDefaultLayout(): LayoutConfig {
  return structuredClone(DEFAULT_LAYOUT_DATA);
}

// ── Validation / migration primitives ───────────────────────────────────────

const VALID_BLOCK_TYPES = new Set<string>(BLOCK_TYPES);
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
export const MAX_BLOCKS = 100;

/**
 * Rewrite a block instance loaded from disk to the current schema. Handles several
 * legacy shapes (pre-GridStack col/row/colSpan/rowSpan, tag-grid type rename,
 * `_transparent` split, voice-dictation config renames, inline title migration).
 *
 * Must be idempotent: `migrateBlockInstance(migrateBlockInstance(x))` should deep-equal
 * `migrateBlockInstance(x)`. Every branch either deletes the legacy key after reading
 * it, or checks that the target key is unset before writing — so re-running is safe.
 */
export function migrateBlockInstance(b: Record<string, unknown>): Record<string, unknown> {
  const m = { ...b };
  if (typeof m.col === 'number') { m.x = m.col - 1; }
  if (typeof m.row === 'number') { m.y = m.row - 1; }
  if (typeof m.colSpan === 'number') { m.w = m.colSpan; }
  if (typeof m.rowSpan === 'number') { m.h = m.rowSpan; }
  delete m.col;
  delete m.row;
  delete m.colSpan;
  delete m.rowSpan;
  delete m.newRow;
  // Migrate legacy type renames
  if (m.type === 'tag-grid') { m.type = 'button-grid'; }
  // Migrate legacy _transparent flag to granular flags.
  const cfg = m.config as Record<string, unknown> | undefined;
  if (cfg && cfg._transparent === true) {
    if (cfg._showBorder === undefined) cfg._showBorder = false;
    if (cfg._showBackground === undefined) cfg._showBackground = false;
    delete cfg._transparent;
  }
  // Migrate legacy `_hideX: true` flags to their `_showX: false` inverse.
  // Only writes the new key when it is undefined, so an explicit user-set
  // `_showX` overrides the legacy value without being silently overwritten.
  if (cfg) {
    const HIDE_TO_SHOW: Array<[string, string]> = [
      ['_hideTitle', '_showTitle'],
      ['_hideBorder', '_showBorder'],
      ['_hideBackground', '_showBackground'],
      ['_hideHeaderAccent', '_showHeaderAccent'],
    ];
    for (const [hideKey, showKey] of HIDE_TO_SHOW) {
      if (hideKey in cfg) {
        if (cfg[hideKey] === true && cfg[showKey] === undefined) {
          cfg[showKey] = false;
        }
        delete cfg[hideKey];
      }
    }
    // quotes-list specific: hideAccentBar -> showAccentBar
    if (m.type === 'quotes-list' && 'hideAccentBar' in cfg) {
      if (cfg.hideAccentBar === true && cfg.showAccentBar === undefined) {
        cfg.showAccentBar = false;
      }
      delete cfg.hideAccentBar;
    }
  }
  // Migrate voice-dictation config field renames.
  if (m.type === 'voice-dictation' && cfg) {
    if (typeof cfg.whisperApiKey === 'string' && !cfg.apiKey) {
      cfg.apiKey = cfg.whisperApiKey;
    }
    if (typeof cfg.whisperLanguage === 'string' && !cfg.language) {
      cfg.language = cfg.whisperLanguage;
    }
    delete cfg.whisperApiKey;
    delete cfg.whisperLanguage;
  }
  // Clamp button-grid columns to the supported range [1, 3].
  if (m.type === 'button-grid' && cfg && typeof cfg.columns === 'number' && cfg.columns > 3) {
    cfg.columns = 3;
  }
  // customCss is only meaningful for button-grid (the block's UI is gated to
  // that type and the exposed --hp-btn-* vars only affect .grid-btn). Drop it
  // from any other block type so an imported/hand-edited layout cannot carry
  // hidden styles on blocks whose settings UI no longer exposes the field.
  if (cfg && m.type !== 'button-grid' && 'customCss' in cfg) {
    delete cfg.customCss;
  }
  // Migrate per-block title to shared _titleLabel system.
  if (cfg && typeof cfg.title === 'string') {
    if (cfg.title && !cfg._titleLabel) {
      cfg._titleLabel = cfg.title;
    }
    // Blocks that previously used an empty title to hide the header
    // (html, static-text) should set _showTitle: false so they stay headerless.
    if (!cfg.title && (m.type === 'html' || m.type === 'static-text')) {
      if (cfg._showTitle === undefined) cfg._showTitle = false;
    }
    delete cfg.title;
  }
  return m;
}

/** True when `b` matches the current BlockInstance shape. Logs nothing — designed for use with Array.filter. */
export function isValidBlockInstance(b: unknown): b is BlockInstance {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' && SAFE_ID_RE.test(block.id) &&
    typeof block.type === 'string' && VALID_BLOCK_TYPES.has(block.type) &&
    typeof block.x === 'number' && Number.isFinite(block.x) && block.x >= 0 &&
    typeof block.y === 'number' && Number.isFinite(block.y) && block.y >= 0 &&
    typeof block.w === 'number' && Number.isFinite(block.w) && block.w >= 1 &&
    typeof block.h === 'number' && block.h >= 1 && Number.isFinite(block.h) &&
    block.config !== null && typeof block.config === 'object' && !Array.isArray(block.config)
  );
}

/** Migrate + validate + clamp a raw blocks array loaded from disk. */
export function validateBlocks(raw: unknown, columns: number, defaults: BlockInstance[]): BlockInstance[] {
  if (!Array.isArray(raw)) return defaults;
  const migrated: unknown[] = raw.map(b => migrateBlockInstance(b as Record<string, unknown>));
  const valid = migrated.filter(isValidBlockInstance).slice(0, MAX_BLOCKS);
  return valid.map(b => ({
    ...b,
    w: Math.min(b.w, columns),
    x: Math.min(b.x, Math.max(0, columns - Math.min(b.w, columns))),
  }));
}

/**
 * Validate and sanitize layout data loaded from disk.
 * Invalid fields fall back to the defaults; invalid blocks are dropped.
 *
 * Contract: `validateLayout(validateLayout(x))` must deep-equal `validateLayout(x)`
 * (idempotence) — the plugin re-persists the validated layout on every load, and an
 * accreting implementation would corrupt `data.json` on every reload.
 */
export function validateLayout(raw: unknown): LayoutConfig {
  const defaults = getDefaultLayout();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;

  const r = raw as Record<string, unknown>;
  const columns = typeof r.columns === 'number' && [2, 3, 4, 5].includes(r.columns)
    ? r.columns
    : defaults.columns;
  const layoutPriority = isLayoutPriority(r.layoutPriority)
    ? r.layoutPriority
    : defaults.layoutPriority;
  const responsiveMode = isResponsiveMode(r.responsiveMode)
    ? r.responsiveMode
    : defaults.responsiveMode;
  const mobileColumns = typeof r.mobileColumns === 'number' && [1, 2, 3].includes(r.mobileColumns)
    ? r.mobileColumns
    : defaults.mobileColumns;
  const mobileLayoutPriority = isLayoutPriority(r.mobileLayoutPriority)
    ? r.mobileLayoutPriority
    : defaults.mobileLayoutPriority;
  const openOnStartup = typeof r.openOnStartup === 'boolean'
    ? r.openOnStartup
    : defaults.openOnStartup;
  const openMode = isOpenMode(r.openMode)
    ? r.openMode
    : defaults.openMode;
  const manualOpenMode = isOpenMode(r.manualOpenMode)
    ? r.manualOpenMode
    : defaults.manualOpenMode;
  const openWhenEmpty = typeof r.openWhenEmpty === 'boolean'
    ? r.openWhenEmpty
    : defaults.openWhenEmpty;
  const pin = typeof r.pin === 'boolean'
    ? r.pin
    : defaults.pin;
  // Migrate legacy `hideScrollbar` to its `showScrollbar` inverse. A
  // new `showScrollbar` value on disk always wins; otherwise fall back to
  // the inverted legacy key, otherwise the default.
  const showScrollbar = typeof r.showScrollbar === 'boolean'
    ? r.showScrollbar
    : typeof r.hideScrollbar === 'boolean'
      ? !r.hideScrollbar
      : defaults.showScrollbar;
  const compactLayout = typeof r.compactLayout === 'boolean'
    ? r.compactLayout
    : defaults.compactLayout;
  const hoverHighlight = typeof r.hoverHighlight === 'boolean'
    ? r.hoverHighlight
    : defaults.hoverHighlight;
  const blocks = validateBlocks(r.blocks, columns, defaults.blocks);
  const mobileBlocks = validateBlocks(r.mobileBlocks, mobileColumns, defaults.mobileBlocks);

  return {
    columns, layoutPriority, responsiveMode,
    mobileColumns, mobileLayoutPriority, mobileBlocks,
    openOnStartup, openMode, manualOpenMode, openWhenEmpty,
    pin, showScrollbar, compactLayout, hoverHighlight, blocks,
  };
}
