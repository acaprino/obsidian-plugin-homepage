import { App } from 'obsidian';
import type { BaseBlock } from './blocks/BaseBlock';

export type BlockType =
  | 'greeting'
  | 'folder-links'
  | 'insight'
  | 'tag-grid'
  | 'quotes-list'
  | 'image-gallery'
  | 'clock'
  | 'embedded-note'
  | 'static-text'
  | 'html';

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
  config: Record<string, unknown>;
}

export interface LayoutConfig {
  columns: number;
  openOnStartup: boolean;
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
