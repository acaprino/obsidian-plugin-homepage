import { BLOCK_TYPES, BlockInstance, LayoutConfig, LayoutPriority, OpenMode, PreservedData, ResponsiveMode } from './types';

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
  separateStartup: false,
  mobileOpenOnStartup: false,
  mobileOpenMode: 'retain',
  mobileManualOpenMode: 'retain',
  mobileOpenWhenEmpty: false,
  mobilePin: false,
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
      config: { tag: '', _titleLabel: 'Daily insight', dailySeed: true, maxItems: 1 },
    },
    {
      id: 'default-button-grid',
      type: 'button-grid',
      x: 2, y: 3, w: 1, h: 5,
      config: {
        // Empty, showing its "No items yet" hint: six buttons with no link did
        // nothing when clicked (M95).
        _titleLabel: 'Quick actions', columns: 2, items: [],
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
  // "Only write if target unset" guard, mirroring the safer pattern used by the
  // _hideX/_showX migration below. A corrupted data.json with both `col` and
  // `x` (e.g. from a partial sync merge) would otherwise lose the valid `x`.
  // Clamp to >= 0: a legacy col/row of 0 would map to -1 and then fail
  // isValidBlockInstance (x/y >= 0), silently dropping the block.
  if (typeof m.col === 'number' && typeof m.x !== 'number') { m.x = Math.max(0, m.col - 1); }
  if (typeof m.row === 'number' && typeof m.y !== 'number') { m.y = Math.max(0, m.row - 1); }
  if (typeof m.colSpan === 'number' && typeof m.w !== 'number') { m.w = m.colSpan; }
  if (typeof m.rowSpan === 'number' && typeof m.h !== 'number') { m.h = m.rowSpan; }
  delete m.col;
  delete m.row;
  delete m.colSpan;
  delete m.rowSpan;
  delete m.newRow;
  // Migrate legacy type renames
  if (m.type === 'tag-grid') { m.type = 'button-grid'; }
  // Only an object config is migrated. A truthy primitive (hand edit, merge tool)
  // would make the `in` tests below throw and reject the whole load; skipping it
  // leaves the block for isValidBlockInstance to drop through the per-block path.
  const cfg = typeof m.config === 'object' && m.config !== null
    ? m.config as Record<string, unknown>
    : undefined;
  // Migrate legacy _transparent flag to granular flags.
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

/**
 * A block of a type this version does not know, otherwise in the current shape:
 * written by a newer version, so kept rather than dropped (M58).
 */
function isUnknownTypeBlock(b: unknown): b is Record<string, unknown> {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return false;
  const block = b as Record<string, unknown>;
  return typeof block.type === 'string' && block.type !== '' && !VALID_BLOCK_TYPES.has(block.type)
    && isValidBlockInstance({ ...block, type: BLOCK_TYPES[0] });
}

/**
 * Migrate + validate + clamp a raw blocks array loaded from disk.
 *
 * `onInvalidDropped` fires (with the count) when one or more array entries
 * survive as a real array but fail `isValidBlockInstance` -- i.e. per-block
 * corruption distinct from the top-level "data.json is unusable" case. Callers
 * can surface this so a partially-corrupt blocks array doesn't lose blocks
 * silently. Blocks past MAX_BLOCKS are reported the same way, since they are
 * lost too (M8); the id dedup is not (a duplicate id carries no content of its own).
 */
export function validateBlocks(
  raw: unknown,
  columns: number,
  defaults: BlockInstance[],
  onInvalidDropped?: (count: number) => void,
  onUnknownType?: (block: Record<string, unknown>) => void,
): BlockInstance[] {
  if (!Array.isArray(raw)) return defaults;
  // A block of an unknown type goes to onUnknownType as stored (M58), when the
  // caller keeps such blocks; otherwise it counts as invalid.
  const known = onUnknownType
    ? raw.filter((b: unknown) => {
      if (!isUnknownTypeBlock(b)) return true;
      onUnknownType(b);
      return false;
    })
    : raw;
  const migrated: unknown[] = known.map(b => migrateBlockInstance(b as Record<string, unknown>));
  const validAll = migrated.filter(isValidBlockInstance);
  const invalidCount = migrated.length - validAll.length;
  const overLimit = Math.max(0, validAll.length - MAX_BLOCKS);
  if (invalidCount + overLimit > 0) onInvalidDropped?.(invalidCount + overLimit);
  const valid = validAll.slice(0, MAX_BLOCKS);
  // Dedupe block IDs. A hand-edited or clipboard-imported layout with two blocks
  // sharing the same id breaks every gs-id selector + Array.find lookup downstream
  // (edit handles modify the wrong block, remove deletes one but not the duplicate,
  // PomodoroBlock's id-keyed timerStore double-ticks). First occurrence wins.
  const seen = new Set<string>();
  const dedup = valid.filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
  return dedup.map(b => {
    const w = Math.min(b.w, columns);
    const out: BlockInstance = {
      id: b.id, type: b.type,
      x: Math.min(b.x, Math.max(0, columns - w)), y: b.y, w, h: b.h,
      config: b.config,
    };
    // Optional fields keep only well-formed values: a non-number _expandedH
    // reached GridStack and h on expand (and the block was dropped at the next
    // load), and top-level keys nothing reads have no business in data.json (N19).
    if (b.collapsed === true) out.collapsed = true;
    const expandedH: unknown = b._expandedH;
    if (typeof expandedH === 'number' && Number.isFinite(expandedH) && expandedH >= 1) {
      out._expandedH = Math.round(expandedH);
    }
    return out;
  });
}

/**
 * Validate and sanitize layout data loaded from disk.
 * Invalid fields fall back to the defaults; invalid blocks are dropped.
 *
 * Contract: `validateLayout(validateLayout(x))` must deep-equal `validateLayout(x)`
 * (idempotence) — the plugin re-persists the validated layout on every load, and an
 * accreting implementation would corrupt `data.json` on every reload.
 *
 * `onTopLevelCorruption` fires when raw parsed but isn't a usable object (a JSON
 * array, string or number), or when its `blocks` / `mobileBlocks` field is present
 * but not an array (those blocks are replaced by the defaults, like the rest of an
 * unusable file). An unparseable data.json never reaches here as a
 * value: Obsidian's `loadData()` returns `undefined` for it and `null` for a
 * missing file, and both look like "no layout yet" to this function. Telling them
 * apart needs the file system, which is `loadLayoutWithRecovery`'s job
 * (utils/loadRecovery.ts); it also backs the file up before defaults wipe the slot.
 */
export function validateLayout(
  raw: unknown,
  onTopLevelCorruption?: (raw: unknown) => void,
  onBlocksDropped?: (count: number) => void,
): LayoutConfig {
  const defaults = getDefaultLayout();
  if (raw === null || raw === undefined) return defaults;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    onTopLevelCorruption?.(raw);
    return defaults;
  }

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
  const separateStartup = typeof r.separateStartup === 'boolean'
    ? r.separateStartup
    : defaults.separateStartup;
  // Mobile startup overrides default to the resolved DESKTOP value (not a fixed
  // constant) so a data.json written before this feature existed transparently
  // mirrors the desktop startup behaviour on mobile until the user diverges it.
  const mobileOpenOnStartup = typeof r.mobileOpenOnStartup === 'boolean'
    ? r.mobileOpenOnStartup
    : openOnStartup;
  const mobileOpenMode = isOpenMode(r.mobileOpenMode)
    ? r.mobileOpenMode
    : openMode;
  const mobileManualOpenMode = isOpenMode(r.mobileManualOpenMode)
    ? r.mobileManualOpenMode
    : manualOpenMode;
  const mobileOpenWhenEmpty = typeof r.mobileOpenWhenEmpty === 'boolean'
    ? r.mobileOpenWhenEmpty
    : openWhenEmpty;
  const mobilePin = typeof r.mobilePin === 'boolean'
    ? r.mobilePin
    : pin;
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
  // A blocks field that is present but not an array is corruption as well:
  // without a report, validateBlocks would swap in the defaults silently.
  const notAnArray = (v: unknown) => v !== undefined && v !== null && !Array.isArray(v);
  if (notAnArray(r.blocks) || notAnArray(r.mobileBlocks)) onTopLevelCorruption?.(raw);
  // Aggregate per-block corruption across both platform arrays into one report
  // so the caller can surface a single Notice rather than one per array.
  let droppedBlocks = 0;
  const countDropped = (n: number) => { droppedBlocks += n; };
  const preserved = readPreserved(r);
  const blocks = validateBlocks(r.blocks, columns, defaults.blocks, countDropped, b => preserved.blocks.push(b));
  const mobileBlocks = validateBlocks(r.mobileBlocks, mobileColumns, defaults.mobileBlocks, countDropped, b => preserved.mobileBlocks.push(b));
  if (droppedBlocks > 0) onBlocksDropped?.(droppedBlocks);

  const layout: LayoutConfig = {
    columns, layoutPriority, responsiveMode,
    mobileColumns, mobileLayoutPriority, mobileBlocks,
    openOnStartup, openMode, manualOpenMode, openWhenEmpty, pin,
    separateStartup, mobileOpenOnStartup, mobileOpenMode,
    mobileManualOpenMode, mobileOpenWhenEmpty, mobilePin,
    showScrollbar, compactLayout, hoverHighlight, blocks,
  };
  if (preserved.blocks.length || preserved.mobileBlocks.length || Object.keys(preserved.fields).length) {
    layout.preserved = preserved;
  }
  return layout;
}

/** Top-level keys this version reads (current fields, the legacy hideScrollbar, the in-memory preserved). */
const KNOWN_LAYOUT_KEYS = new Set([...Object.keys(DEFAULT_LAYOUT_DATA), 'hideScrollbar', 'preserved']);

/**
 * What `raw` holds for a newer version: its unknown top-level fields, plus the
 * `preserved` data of an in-memory layout validated again (which keeps
 * validateLayout idempotent). Blocks of unknown types are added by the caller.
 */
function readPreserved(r: Record<string, unknown>): PreservedData {
  const out: PreservedData = { blocks: [], mobileBlocks: [], fields: {} };
  const prior = r.preserved;
  if (prior && typeof prior === 'object' && !Array.isArray(prior)) {
    const p = prior as Record<string, unknown>;
    if (Array.isArray(p.blocks)) out.blocks.push(...p.blocks.filter(isUnknownTypeBlock));
    if (Array.isArray(p.mobileBlocks)) out.mobileBlocks.push(...p.mobileBlocks.filter(isUnknownTypeBlock));
    if (p.fields && typeof p.fields === 'object' && !Array.isArray(p.fields)) {
      for (const [k, v] of Object.entries(p.fields)) if (!KNOWN_LAYOUT_KEYS.has(k)) out.fields[k] = v;
    }
  }
  for (const [k, v] of Object.entries(r)) if (!KNOWN_LAYOUT_KEYS.has(k)) out.fields[k] = v;
  return out;
}

/**
 * The layout as data.json stores it: preserved blocks back at the end of their
 * arrays and preserved fields back at the top level, where the version that
 * wrote them reads them (M58).
 */
export function toStoredLayout(layout: LayoutConfig): Record<string, unknown> {
  const { preserved, ...rest } = layout;
  if (!preserved) return rest;
  return {
    ...preserved.fields,
    ...rest,
    blocks: [...rest.blocks, ...preserved.blocks],
    mobileBlocks: [...rest.mobileBlocks, ...preserved.mobileBlocks],
  };
}
