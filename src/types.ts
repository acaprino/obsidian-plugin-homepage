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
  showScrollbar: boolean;
  compactLayout: boolean;
  /** Show a subtle hover lift on blocks and reveal the collapse chevron on hover. */
  hoverHighlight: boolean;
  blocks: BlockInstance[];
}

export interface BlockFactory {
  type: BlockType;
  displayName: string;
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
  /** True when running on a mobile device AND responsiveMode is 'separate'. */
  isMobileActive(): boolean;
  /** Resolved blocks for the current platform (desktop blocks or mobile blocks). */
  activeBlocks(): BlockInstance[];
  /** Resolved column count for the current platform. */
  activeColumns(): number;
  /** Resolved layout priority for the current platform. */
  activeLayoutPriority(): LayoutPriority;
}
