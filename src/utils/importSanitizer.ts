import { BlockInstance, BlockType, LayoutConfig } from '../types';
import { BlockRegistry } from '../BlockRegistry';
import { HEX_COLOR_RE } from './blockStyling';

/**
 * Keys that may legitimately appear on many block configs but are not always declared
 * in the factory's defaultConfig. Kept in an allowlist so the unknown-key stripper
 * doesn't drop user-customised shared styling from a valid export.
 */
const SHARED_CONFIG_KEYS = new Set([
  // Every `_`-prefixed key is shared styling — handled specially below, but listing
  // the well-known ones here documents the contract.
  '_titleLabel', '_titleEmoji', '_showTitle', '_titleSize', '_titleGap',
  '_showDivider', '_showHeaderAccent', '_showBorder', '_borderWidth', '_borderStyle',
  '_borderRadius', '_showBackground', '_bgOpacity', '_backdropBlur', '_cardPadding',
  '_elevation', '_accentColor', '_accentIntensity', '_gradientStart', '_gradientEnd',
  '_gradientAngle',
]);

const TITLE_SIZE_RE = /^h[1-6]$/;
const BORDER_STYLE_VALUES = new Set(['solid', 'dashed', 'dotted']);

/**
 * Per-key validators that mirror the runtime clamps in blockStyling.ts. The
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
  _titleGap: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(-32, Math.min(32, v)) : undefined,
  _showDivider: (v) => typeof v === 'boolean' ? v : undefined,
  _showHeaderAccent: (v) => typeof v === 'boolean' ? v : undefined,
  _showBorder: (v) => typeof v === 'boolean' ? v : undefined,
  _borderWidth: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(8, v)) : undefined,
  _borderStyle: (v) => typeof v === 'string' && BORDER_STYLE_VALUES.has(v) ? v : undefined,
  _borderRadius: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(48, v)) : undefined,
  _showBackground: (v) => typeof v === 'boolean' ? v : undefined,
  _bgOpacity: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : undefined,
  _backdropBlur: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(48, v)) : undefined,
  _cardPadding: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(-48, Math.min(48, v)) : undefined,
  _elevation: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(8, v)) : undefined,
  _accentColor: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _accentIntensity: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(5, Math.min(100, v)) : undefined,
  _gradientStart: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _gradientEnd: (v) => typeof v === 'string' && (v === '' || HEX_COLOR_RE.test(v)) ? v : undefined,
  _gradientAngle: (v) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(360, v)) : undefined,
};

/**
 * Sanitize a single block's config at import time. Strips:
 *   - `apiKey` unconditionally (never carry credentials across clipboard exports)
 *   - unknown non-underscore keys (fields the current block factory doesn't declare)
 *
 * `_`-prefixed keys are kept because they are shared styling and every block supports
 * them — a new shared field added in a future version shouldn't be silently dropped
 * when an older layout is imported.
 */
export function sanitizeImportedConfig(
  blockType: BlockType,
  config: Record<string, unknown>,
): { config: Record<string, unknown>; stripped: string[] } {
  const factory = BlockRegistry.get(blockType);
  const allowed = new Set<string>(factory ? Object.keys(factory.defaultConfig) : []);
  SHARED_CONFIG_KEYS.forEach(k => allowed.add(k));

  const clean: Record<string, unknown> = {};
  const stripped: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (key === 'apiKey') {
      stripped.push(key);
      continue;
    }
    if (key.startsWith('_')) {
      const validator = SHARED_VALIDATORS[key];
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
    if (allowed.has(key)) {
      clean[key] = value;
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
  return {
    layout: {
      ...layout,
      blocks: layout.blocks.map(sanitizeBlock),
      mobileBlocks: layout.mobileBlocks.map(sanitizeBlock),
    },
    strippedCount,
  };
}
