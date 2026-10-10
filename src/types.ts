import { App } from 'obsidian';
import type { BaseBlock } from './blocks/BaseBlock';

export const BLOCK_TYPES = [
  'greeting', 'folder-links', 'button-grid',
  'quotes-list', 'image-gallery', 'clock', 'embedded-note',
  'static-text', 'html', 'video-embed',
  'bookmarks', 'recent-files', 'pomodoro', 'spacer', 'random-note',
  'voice-dictation', 'vault-search',
] as const;

export type BlockType = typeof BLOCK_TYPES[number];

export type OpenMode = 'replace-all' | 'replace-last' | 'retain';

/**
 * Fill direction for packing. Currently a single value: packing is always
 * row-group-aware. `'column'` was removed (commit 32db977) but the union is
 * kept as a reserved extension point — the `priority`/`_priority` params
 * threaded through packing.ts / GridLayout / LayoutPersister exist for this
 * forward-compat and are intentionally ignored today (old `'column'` layouts
 * migrate silently to `'row'`). Do not delete the param plumbing without a plan
 * to drop the reserved value.
 */
export type LayoutPriority = 'row';

export type ResponsiveMode = 'unified' | 'separate';

export interface BlockInstance {
  id: string;
  type: BlockType;
  /** GridStack x position (0-indexed column) */
  x: number;
  /** GridStack y position (0-indexed row) */
  y: number;
  /** GridStack width in columns */
  w: number;
  /** GridStack height in rows */
  h: number;
  collapsed?: boolean;
  /** Stored expanded height when block is collapsed, so it can be restored */
  _expandedH?: number;
  /**
   * Per-block config. Any key that starts with `_` is reserved for shared card/header/body styling
   * (e.g. `_titleLabel`, `_titleEmoji`, `_showBorder`, `_accentColor`, ...) and is merged into the
   * block's config by the shared settings modal -- block-specific keys MUST NOT start with `_`.
   */
  config: Record<string, unknown>;
}

/**
 * Data a newer plugin version wrote that this one does not know: blocks of an
 * unknown type and unknown top-level fields. Kept out of rendering and written
 * back unchanged, so an older version on a synced device does not delete them (M58).
 */
export interface PreservedData {
  blocks: Record<string, unknown>[];
  mobileBlocks: Record<string, unknown>[];
  fields: Record<string, unknown>;
}

export interface LayoutConfig {
  columns: number;
  layoutPriority: LayoutPriority;
  responsiveMode: ResponsiveMode;
  /** Column count used on mobile when responsiveMode is 'separate'. */
  mobileColumns: number;
  /** Layout priority used on mobile when responsiveMode is 'separate'. */
  mobileLayoutPriority: LayoutPriority;
  /** Blocks used on mobile when responsiveMode is 'separate'. */
  mobileBlocks: BlockInstance[];
  openOnStartup: boolean;
  openMode: OpenMode;
  manualOpenMode: OpenMode;
  openWhenEmpty: boolean;
  pin: boolean;
  /**
   * When true, mobile devices use the `mobile*` startup overrides below instead
   * of the desktop startup settings (e.g. open the homepage on startup only on
   * desktop). Independent of `responsiveMode` — you can keep a unified layout
   * but still diverge the startup behaviour per platform.
   */
  separateStartup: boolean;
  /** Open-on-startup used on mobile when `separateStartup` is true. */
  mobileOpenOnStartup: boolean;
  /** Startup open mode used on mobile when `separateStartup` is true. */
  mobileOpenMode: OpenMode;
  /** Manual open mode used on mobile when `separateStartup` is true. */
  mobileManualOpenMode: OpenMode;
  /** Open-when-empty used on mobile when `separateStartup` is true. */
  mobileOpenWhenEmpty: boolean;
  /** Pin homepage tab used on mobile when `separateStartup` is true. */
  mobilePin: boolean;
  showScrollbar: boolean;
  compactLayout: boolean;
  /** Show a subtle hover lift on blocks and reveal the collapse chevron on hover. */
  hoverHighlight: boolean;
  blocks: BlockInstance[];
  /** See PreservedData; absent when there is nothing to keep. */
  preserved?: PreservedData;
}

export interface BlockFactory {
  type: BlockType;
  displayName: string;
  /**
   * Every config key the block reads, with its default. Seeds new blocks and is
   * the clipboard-import allowlist, which also type-checks imported values
   * against these defaults. A key with no default of its own is `undefined`.
   */
  defaultConfig: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  /** Block reports content height dynamically. GridLayout persists height specially for these. */
  autoHeight?: boolean;
  create(app: App, instance: BlockInstance, plugin: IHomepagePlugin): BaseBlock;
}

export interface IHomepagePlugin {
  app: App;
  layout: LayoutConfig;
  saveLayout(layout: LayoutConfig): Promise<void>;
  /** Save a new blocks array into the active field (mobileBlocks on mobile+separate, blocks otherwise). */
  saveActiveBlocks(blocks: BlockInstance[]): Promise<void>;
  /**
   * Patch one block's config and save. Waits for the saves already queued,
   * then reads the in-memory layout (every saveLayout call updates it
   * synchronously, so a finished drag is already there), replaces that block's
   * objects, and resolves once the write completes. A block whose id is gone by
   * then is left alone, with a console warning. The rendered instance is never
   * updated: a block that shows its own config must read it back with
   * BaseBlock.liveConfig() after this resolves.
   */
  updateBlockConfig(id: string, patch: Record<string, unknown>): Promise<void>;
  /** True when running on a mobile device AND responsiveMode is 'separate'. */
  isMobileActive(): boolean;
  /** Resolved blocks for the current platform (desktop blocks or mobile blocks). */
  activeBlocks(): BlockInstance[];
  /** Resolved column count for the current platform. */
  activeColumns(): number;
  /** Resolved layout priority for the current platform. */
  activeLayoutPriority(): LayoutPriority;
  /** True when running on a mobile device AND separateStartup is true. */
  isMobileStartupActive(): boolean;
  /** Resolved open-on-startup flag for the current platform. */
  activeOpenOnStartup(): boolean;
  /** Resolved startup open mode for the current platform. */
  activeOpenMode(): OpenMode;
  /** Resolved manual open mode for the current platform. */
  activeManualOpenMode(): OpenMode;
  /** Resolved open-when-empty flag for the current platform. */
  activeOpenWhenEmpty(): boolean;
  /** Resolved pin-tab flag for the current platform. */
  activePin(): boolean;
}
