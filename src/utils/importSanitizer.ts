import { BlockInstance, BlockType, LayoutConfig } from '../types';
import { BlockRegistry } from '../BlockRegistry';

/**
 * Keys that may legitimately appear on many block configs but are not always declared
 * in the factory's defaultConfig. Kept in an allowlist so the unknown-key stripper
 * doesn't drop user-customised shared styling from a valid export.
 */
const SHARED_CONFIG_KEYS = new Set([
  // Every `_`-prefixed key is shared styling — handled specially below, but listing
  // the well-known ones here documents the contract.
  '_titleLabel', '_titleEmoji', '_hideTitle', '_titleSize', '_titleGap',
  '_showDivider', '_hideHeaderAccent', '_hideBorder', '_borderWidth', '_borderStyle',
  '_borderRadius', '_hideBackground', '_bgOpacity', '_backdropBlur', '_cardPadding',
  '_elevation', '_accentColor', '_accentIntensity', '_gradientStart', '_gradientEnd',
  '_gradientAngle',
]);

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
    if (key.startsWith('_') || allowed.has(key)) {
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
