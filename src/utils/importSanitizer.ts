import { BlockInstance, BlockType, LayoutConfig } from '../types';
import { BlockRegistry } from '../BlockRegistry';
import { HEX_COLOR_RE, RangedStyleKey, VALID_BORDER_STYLES, clampStyle } from './blockStyling';
import { TITLE_SIZE_RE } from '../blocks/BaseBlock';
import { clampConfigNumber } from './configRanges';

/** Own-property check: an imported key such as `__proto__` must not match an inherited member. */
const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** Never carried by a clipboard layout: export removes both (HomepageSettingTab). */
const ALWAYS_STRIPPED = new Set(['apiKey', 'customCss']);

/**
 * True when an imported `value` has the JSON type of the factory's declared
 * default: a malformed value (say `items: null` where the block iterates an
 * array) would otherwise reach render. A key declared with no default of its
 * own (`undefined`) accepts a string, number or boolean.
 */
function matchesDeclaredType(value: unknown, declared: unknown): boolean {
  if (declared === undefined || declared === null) {
    const t = typeof value;
    return t === 'string' || t === 'number' || t === 'boolean';
  }
  if (Array.isArray(declared)) return Array.isArray(value);
  if (typeof declared === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (typeof declared === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === typeof declared;
}

/** A validator that clamps a finite number to the key's range in STYLE_RANGES. */
const ranged = (key: RangedStyleKey) => (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? clampStyle(key, v) : undefined;

/**
 * Per-key validators, clamping to the same ranges rendering uses. The
 * runtime defenses already prevent a malformed value from being rendered, but
 * without these import-time clamps a hostile payload (e.g. 50 MB string in
 * `_titleLabel`, prototype-polluting object in `_titleSize`) is silently kept
 * in data.json -- bloating the user's vault and propagating through every
 * subsequent export. Returning `undefined` here drops the key entirely.
 */
const SHARED_VALIDATORS: Record<string, (v: unknown) => unknown> = {
  _titleLabel: (v) => typeof v === 'string' ? v.slice(0, 200) : undefined,
  _titleEmoji: (v) => typeof v === 'string' ? v.slice(0, 16) : undefined,
  _showTitle: (v) => typeof v === 'boolean' ? v : undefined,
  _titleSize: (v) => typeof v === 'string' && TITLE_SIZE_RE.test(v) ? v : undefined,
  _titleGap: ranged('_titleGap'),
  _showDivider: (v) => typeof v === 'boolean' ? v : undefined,
  _showHeaderAccent: (v) => typeof v === 'boolean' ? v : undefined,
  _showBorder: (v) => typeof v === 'boolean' ? v : undefined,
  _borderWidth: ranged('_borderWidth'),
  _borderStyle: (v) => typeof v === 'string' && VALID_BORDER_STYLES.includes(v) ? v : undefined,
  _borderRadius: ranged('_borderRadius'),
  _showBackground: (v) => typeof v === 'boolean' ? v : undefined,
  _bgOpacity: ranged('_bgOpacity'),
  _backdropBlur: ranged('_backdropBlur'),
  _cardPadding: ranged('_cardPadding'),
  _elevation: ranged('_elevation'),
  _accentColor: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _accentIntensity: ranged('_accentIntensity'),
  _gradientStart: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _gradientEnd: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _gradientAngle: ranged('_gradientAngle'),
};

/**
 * Sanitize a single block's config at import time. Strips:
 *   - `apiKey` and `customCss` unconditionally (export removes both: a clipboard
 *     layout never carries credentials or raw CSS)
 *   - non-underscore keys the block factory doesn't declare in defaultConfig
 *   - declared keys whose value doesn't have the declared default's type
 * and clamps declared numbers to the settings ranges (configRanges.ts, M13).
 *
 * `_`-prefixed keys are kept because they are shared styling and every block supports
 * them — a new shared field added in a future version shouldn't be silently dropped
 * when an older layout is imported.
 */
export function sanitizeImportedConfig(
  blockType: BlockType,
  config: Record<string, unknown>,
): { config: Record<string, unknown>; stripped: string[] } {
  const declared = BlockRegistry.get(blockType)?.defaultConfig ?? {};

  const clean: Record<string, unknown> = {};
  const stripped: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (ALWAYS_STRIPPED.has(key)) {
      stripped.push(key);
      continue;
    }
    if (key.startsWith('_')) {
      const validator = hasOwn(SHARED_VALIDATORS, key) ? SHARED_VALIDATORS[key] : undefined;
      if (validator) {
        const validated = validator(value);
        if (validated === undefined) {
          stripped.push(key);
          continue;
        }
        clean[key] = validated;
      } else {
        // Unknown _-prefixed key: keep so a future shared field added in a later
        // version isn't silently dropped, but only for primitive values -- a
        // structured payload here is a red flag and shouldn't reach disk.
        const t = typeof value;
        if (t === 'string' || t === 'number' || t === 'boolean') {
          clean[key] = value;
        } else {
          stripped.push(key);
        }
      }
      continue;
    }
    if (hasOwn(declared, key) && matchesDeclaredType(value, declared[key])) {
      clean[key] = typeof value === 'number' ? clampConfigNumber(blockType, key, value) : value;
    } else {
      stripped.push(key);
    }
  }
  return { config: clean, stripped };
}

/** Apply sanitizeImportedConfig to every block in a validated layout. */
export function sanitizeImportedLayout(layout: LayoutConfig): { layout: LayoutConfig; strippedCount: number } {
  let strippedCount = 0;
  const sanitizeBlock = (b: BlockInstance): BlockInstance => {
    const { config, stripped } = sanitizeImportedConfig(b.type, b.config);
    strippedCount += stripped.length;
    return { ...b, config };
  };
  // Blocks of unknown types and unknown fields cannot be checked here: an
  // import is untrusted, so they are not carried in (M58).
  const sanitized: LayoutConfig = {
    ...layout,
    blocks: layout.blocks.map(sanitizeBlock),
    mobileBlocks: layout.mobileBlocks.map(sanitizeBlock),
  };
  delete sanitized.preserved;
  return { layout: sanitized, strippedCount };
}

/**
 * Config keys whose text the plugin renders as Markdown/HTML or writes into new
 * notes. Imported, they are content from whoever made the layout: a live page
 * over the homepage, DataviewJS, a template that leaks transcripts (M11, M12).
 */
const ACTIVE_CONTENT_KEYS: Partial<Record<BlockType, readonly string[]>> = {
  'static-text': ['content'],
  'html': ['html'],
  'voice-dictation': ['noteTemplate', 'folder'],
};

/** One active-content value of an imported layout, as the confirmation shows it. */
export interface ActiveContent { blockType: BlockType; title: string; key: string; excerpt: string; }

const EXCERPT_LENGTH = 80;

/** Every non-empty active-content value in `layout` (desktop, then mobile blocks). */
export function findActiveContent(layout: LayoutConfig): ActiveContent[] {
  const found: ActiveContent[] = [];
  for (const b of [...layout.blocks, ...layout.mobileBlocks]) {
    for (const key of ACTIVE_CONTENT_KEYS[b.type] ?? []) {
      const value = b.config[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const label = b.config._titleLabel;
      const title = typeof label === 'string' && label.trim() ? label.trim() : BlockRegistry.get(b.type)?.displayName ?? b.type;
      const flat = value.replace(/\s+/g, ' ').trim();
      found.push({ blockType: b.type, title, key, excerpt: flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat });
    }
  }
  return found;
}

/** `layout` with every active-content value reset to its factory default. */
export function withoutActiveContent(layout: LayoutConfig): LayoutConfig {
  const strip = (b: BlockInstance): BlockInstance => {
    const keys = ACTIVE_CONTENT_KEYS[b.type];
    if (!keys) return b;
    const defaults = BlockRegistry.get(b.type)?.defaultConfig ?? {};
    const config = { ...b.config };
    for (const key of keys) config[key] = typeof defaults[key] === 'string' ? defaults[key] : '';
    return { ...b, config };
  };
  return { ...layout, blocks: layout.blocks.map(strip), mobileBlocks: layout.mobileBlocks.map(strip) };
}
