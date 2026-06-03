import { LayoutConfig, OpenMode } from '../types';

/**
 * Pure resolution of the per-platform startup settings, extracted from
 * `HomepagePlugin` so the gate-off backward-compat contract is unit-testable
 * without instantiating the Obsidian `Plugin` subclass.
 *
 * Contract: when `separateStartup` is false (the default — every existing
 * vault), every resolved value MUST equal the desktop field, regardless of the
 * `mobile*` overrides. The plugin accessors delegate here so the wiring is
 * tested once, in one place, instead of being mirrored by hand in five
 * near-identical ternaries.
 */
export interface ResolvedStartup {
  openOnStartup: boolean;
  openMode: OpenMode;
  manualOpenMode: OpenMode;
  openWhenEmpty: boolean;
  pin: boolean;
}

/** True only on a mobile device AND when `separateStartup` is enabled. */
export function mobileStartupActive(layout: LayoutConfig, isMobile: boolean): boolean {
  return isMobile && layout.separateStartup;
}

/** Resolve every startup setting to the mobile override (gate on) or the desktop value (gate off). */
export function resolveStartup(layout: LayoutConfig, isMobile: boolean): ResolvedStartup {
  const mobile = mobileStartupActive(layout, isMobile);
  return {
    openOnStartup: mobile ? layout.mobileOpenOnStartup : layout.openOnStartup,
    openMode: mobile ? layout.mobileOpenMode : layout.openMode,
    manualOpenMode: mobile ? layout.mobileManualOpenMode : layout.manualOpenMode,
    openWhenEmpty: mobile ? layout.mobileOpenWhenEmpty : layout.openWhenEmpty,
    pin: mobile ? layout.mobilePin : layout.pin,
  };
}
