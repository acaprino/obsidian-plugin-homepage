import { BlockInstance, LayoutConfig } from '../types';
import { packRows } from '../grid/packing';

/**
 * "Reset to default layout" replaces one platform's layout half with the
 * default one and keeps every other field: startup settings, display settings,
 * responsiveMode and the other half (R4). A new LayoutConfig field therefore
 * survives a reset unless it is added to one of these lists.
 */
export const DESKTOP_LAYOUT_FIELDS = [
  'blocks',
  'columns',
  'layoutPriority',
] as const satisfies readonly (keyof LayoutConfig)[];

export const MOBILE_LAYOUT_FIELDS = [
  'mobileBlocks',
  'mobileColumns',
  'mobileLayoutPriority',
] as const satisfies readonly (keyof LayoutConfig)[];

function pickFields<K extends keyof LayoutConfig>(
  src: LayoutConfig,
  keys: readonly K[],
): Pick<LayoutConfig, K> {
  const out = {} as Pick<LayoutConfig, K>;
  for (const k of keys) out[k] = src[k];
  return out;
}

/**
 * Copies of `blocks` fitted to `columns`: widths and x clamped, then packed in
 * reading order so no two blocks share a cell (a desktop row becomes a stack on
 * one column, M9). `mintId` gives each copy a new id.
 */
export function fitBlocksToColumns(blocks: BlockInstance[], columns: number, mintId?: () => string): BlockInstance[] {
  const fitted = structuredClone(blocks).map(b => (mintId ? { ...b, id: mintId() } : b));
  packRows(fitted, columns, 'row', true);
  return fitted;
}

/**
 * Build the layout produced by "Reset to default layout".
 *
 * @param current        the live layout
 * @param fresh          a default-layout template (`getDefaultLayout()`)
 * @param isMobileActive `plugin.isMobileActive()`: a phone in Separate mode
 *                       resets the mobile half, with the default blocks fitted
 *                       to the default mobile columns (the default mobileBlocks
 *                       is empty, which left the phone with an empty homepage,
 *                       N7); otherwise the desktop half is reset.
 */
export function buildResetLayout(
  current: LayoutConfig,
  fresh: LayoutConfig,
  isMobileActive: boolean,
): LayoutConfig {
  if (isMobileActive) {
    return {
      ...dropPreserved(current, 'mobileBlocks'),
      mobileBlocks: fitBlocksToColumns(fresh.blocks, fresh.mobileColumns),
      mobileColumns: fresh.mobileColumns,
      mobileLayoutPriority: fresh.mobileLayoutPriority,
    };
  }
  return { ...dropPreserved(current, 'blocks'), ...pickFields(structuredClone(fresh), DESKTOP_LAYOUT_FIELDS) };
}

/**
 * `layout` without the blocks of a newer version kept for one half (M58): a
 * reset or Copy to mobile replaces that half "with all its blocks", and kept
 * blocks would come back at their old cells on the newer device.
 */
export function dropPreserved(layout: LayoutConfig, half: 'blocks' | 'mobileBlocks'): LayoutConfig {
  if (!layout.preserved || layout.preserved[half].length === 0) return layout;
  return { ...layout, preserved: { ...layout.preserved, [half]: [] } };
}
