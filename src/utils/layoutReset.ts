import { LayoutConfig } from '../types';

/**
 * Single source of truth for how `LayoutConfig` is partitioned into platform /
 * concern slices. "Reset to default layout" must reset ONLY the layout slice;
 * every other slice listed here is preserved. Keeping these as `as const`
 * tuples means a future field addition is wired in one place instead of being
 * re-enumerated across the three reset branches (the omission that let a desktop
 * reset silently wipe the mobile startup config).
 */

/** Mobile *layout* fields — the inactive platform's slice, preserved when resetting the other platform. */
export const MOBILE_LAYOUT_FIELDS = [
  'mobileBlocks',
  'mobileColumns',
  'mobileLayoutPriority',
] as const satisfies readonly (keyof LayoutConfig)[];

/**
 * The whole startup-config family (desktop + the master toggle + mobile
 * overrides). Startup behaviour is independent of `responsiveMode`, so a layout
 * reset must never touch it — on either platform, in either responsive mode.
 * Preserving only the `mobile*` half would just invert the asymmetry (mobile
 * startup survives, desktop startup wiped).
 */
export const STARTUP_FIELDS = [
  'openOnStartup',
  'openMode',
  'manualOpenMode',
  'openWhenEmpty',
  'pin',
  'separateStartup',
  'mobileOpenOnStartup',
  'mobileOpenMode',
  'mobileManualOpenMode',
  'mobileOpenWhenEmpty',
  'mobilePin',
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
 * Build the layout produced by "Reset to default layout".
 *
 * Resets only the layout slice (blocks / columns / priority) for the platform
 * that issued the reset, preserving the inactive platform's layout AND the
 * entire startup config in every branch.
 *
 * @param current        the live layout
 * @param fresh          a default-layout template (`getDefaultLayout()`)
 * @param isMobileActive `plugin.isMobileActive()` — true when the reset was
 *                       issued from a mobile device in `separate` responsive mode
 */
export function buildResetLayout(
  current: LayoutConfig,
  fresh: LayoutConfig,
  isMobileActive: boolean,
): LayoutConfig {
  const keepStartup = pickFields(current, STARTUP_FIELDS);

  if (current.responsiveMode !== 'separate') {
    // Unified: reset the (single) active layout. Preserve the full startup config
    // AND the dormant mobile layout slice -- a user who built a separate mobile
    // layout, switched to unified, then reset should not lose it (the same class
    // of asymmetry the startup-fields preservation fixed).
    return { ...fresh, ...pickFields(current, MOBILE_LAYOUT_FIELDS), ...keepStartup };
  }
  if (isMobileActive) {
    // Mobile-issued reset: reset the mobile layout slice; `...current` already
    // preserves desktop layout + the full startup config.
    return { ...current, ...pickFields(fresh, MOBILE_LAYOUT_FIELDS) };
  }
  // Desktop-issued reset: reset the desktop layout, keep the mobile layout slice
  // and the full startup config.
  return { ...fresh, ...pickFields(current, MOBILE_LAYOUT_FIELDS), ...keepStartup };
}
