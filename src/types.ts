import { App } from 'obsidian';
import type { BaseBlock } from './blocks/BaseBlock';

export const BLOCK_TYPES = [
  'greeting', 'folder-links', 'button-grid',
  'quotes-list', 'image-gallery', 'clock', 'embedded-note',
  'static-text', 'html', 'video-embed',
  'bookmarks', 'recent-files', 'pomodoro', 'spacer', 'random-note',
  'voice-dictation',
] as const;

export type BlockType = typeof BLOCK_TYPES[number];

export type OpenMode = 'replace-all' | 'replace-last' | 'retain';

export type LayoutPriority = 'row' | 'column';

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
  config: Record<string, unknown>;
}

export interface LayoutConfig {
  columns: number;
  layoutPriority: LayoutPriority;
  openOnStartup: boolean;
  openMode: OpenMode;
  manualOpenMode: OpenMode;
  openWhenEmpty: boolean;
  pin: boolean;
  hideScrollbar: boolean;
  blocks: BlockInstance[];
}

export interface BlockFactory {
  type: BlockType;
  displayName: string;
  defaultConfig: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  create(app: App, instance: BlockInstance, plugin: IHomepagePlugin): BaseBlock;
}

export interface IHomepagePlugin {
  app: App;
  layout: LayoutConfig;
  saveLayout(layout: LayoutConfig): Promise<void>;
}
