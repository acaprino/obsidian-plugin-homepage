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
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
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
  defaultSize: { colSpan: number; rowSpan: number };
  create(app: App, instance: BlockInstance, plugin: IHomepagePlugin): BaseBlock;
}

export interface IHomepagePlugin {
  app: App;
  layout: LayoutConfig;
  saveLayout(layout: LayoutConfig): Promise<void>;
}
