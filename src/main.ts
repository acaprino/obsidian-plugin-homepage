import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VIEW_TYPE, HomepageView } from './HomepageView';
import { BlockInstance, BlockType, LayoutConfig, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GreetingBlock } from './blocks/GreetingBlock';
import { ClockBlock } from './blocks/ClockBlock';
import { FolderLinksBlock } from './blocks/FolderLinksBlock';
import { InsightBlock } from './blocks/InsightBlock';
import { TagGridBlock } from './blocks/TagGridBlock';
import { QuotesListBlock } from './blocks/QuotesListBlock';
import { ImageGalleryBlock } from './blocks/ImageGalleryBlock';
import { EmbeddedNoteBlock } from './blocks/EmbeddedNoteBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import { HtmlBlock } from './blocks/HtmlBlock';

// ── Default layout ──────────────────────────────────────────────────────────

/** Immutable template. Always clone via getDefaultLayout(). */
const DEFAULT_LAYOUT_DATA: LayoutConfig = {
  columns: 3,
  openOnStartup: false,
  blocks: [
    // Row 1
    {
      id: 'default-static-text',
      type: 'static-text',
      col: 1, row: 1, colSpan: 1, rowSpan: 1,
      config: { title: '', content: '' },
    },
    {
      id: 'default-clock',
      type: 'clock',
      col: 2, row: 1, colSpan: 1, rowSpan: 1,
      config: { showSeconds: false, showDate: true },
    },
    {
      id: 'default-folder-links',
      type: 'folder-links',
      col: 3, row: 1, colSpan: 1, rowSpan: 1,
      config: { title: 'Quick Links', links: [] },
    },
    // Row 2
    {
      id: 'default-insight',
      type: 'insight',
      col: 1, row: 2, colSpan: 2, rowSpan: 1,
      config: { tag: '', title: 'Daily Insight', dailySeed: true },
    },
    {
      id: 'default-tag-grid',
      type: 'tag-grid',
      col: 3, row: 2, colSpan: 1, rowSpan: 2,
      config: { tag: '', title: 'Values', columns: 2, showEmoji: true },
    },
    // Row 3
    {
      id: 'default-quotes',
      type: 'quotes-list',
      col: 1, row: 3, colSpan: 2, rowSpan: 1,
      config: { tag: '', title: 'Quotes', columns: 2, maxItems: 20 },
    },
    // Row 4
    {
      id: 'default-gallery',
      type: 'image-gallery',
      col: 1, row: 4, colSpan: 3, rowSpan: 1,
      config: { folder: '', title: 'Gallery', columns: 3, maxItems: 20 },
    },
  ],
};

/** Returns a deep clone of the default layout, safe to mutate. */
function getDefaultLayout(): LayoutConfig {
  return structuredClone(DEFAULT_LAYOUT_DATA);
}

// ── Layout validation / migration ───────────────────────────────────────────

const VALID_BLOCK_TYPES = new Set<string>([
  'greeting', 'folder-links', 'insight', 'tag-grid',
  'quotes-list', 'image-gallery', 'clock', 'embedded-note',
  'static-text', 'html',
]);

function isValidBlockInstance(b: unknown): b is BlockInstance {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' &&
    typeof block.type === 'string' && VALID_BLOCK_TYPES.has(block.type) &&
    typeof block.col === 'number' && block.col >= 1 &&
    typeof block.row === 'number' && block.row >= 1 &&
    typeof block.colSpan === 'number' && block.colSpan >= 1 &&
    typeof block.rowSpan === 'number' && block.rowSpan >= 1 &&
    block.config !== null && typeof block.config === 'object' && !Array.isArray(block.config)
  );
}

/**
 * Validate and sanitize data loaded from disk.
 * Invalid fields are replaced with defaults.
 * Invalid block entries are dropped.
 */
function validateLayout(raw: unknown): LayoutConfig {
  const defaults = getDefaultLayout();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;

  const r = raw as Record<string, unknown>;
  const columns = typeof r.columns === 'number' && [2, 3, 4].includes(r.columns)
    ? r.columns
    : defaults.columns;
  const openOnStartup = typeof r.openOnStartup === 'boolean'
    ? r.openOnStartup
    : defaults.openOnStartup;
  const blocks = Array.isArray(r.blocks)
    ? r.blocks.filter(isValidBlockInstance)
    : defaults.blocks;

  return { columns, openOnStartup, blocks };
}

// ── Block registration ───────────────────────────────────────────────────────

function registerBlocks(): void {
  BlockRegistry.clear();

  BlockRegistry.register({
    type: 'greeting',
    displayName: 'Greeting',
    defaultConfig: { name: 'World', showTime: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'clock',
    displayName: 'Clock / Date',
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'folder-links',
    displayName: 'Folder Links',
    defaultConfig: { title: 'Quick Links', folder: '', links: [] },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'insight',
    displayName: 'Daily Insight',
    defaultConfig: { tag: '', title: 'Daily Insight', dailySeed: true },
    defaultSize: { colSpan: 2, rowSpan: 1 },
    create: (app, instance, plugin) => new InsightBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'tag-grid',
    displayName: 'Tag Grid',
    defaultConfig: { tag: '', title: 'Notes', columns: 2, showEmoji: true },
    defaultSize: { colSpan: 1, rowSpan: 2 },
    create: (app, instance, plugin) => new TagGridBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'quotes-list',
    displayName: 'Quotes List',
    defaultConfig: { tag: '', title: 'Quotes', columns: 2, maxItems: 20 },
    defaultSize: { colSpan: 2, rowSpan: 1 },
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'image-gallery',
    displayName: 'Image Gallery',
    defaultConfig: { folder: '', title: 'Gallery', columns: 3, maxItems: 20 },
    defaultSize: { colSpan: 3, rowSpan: 1 },
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'embedded-note',
    displayName: 'Embedded Note',
    defaultConfig: { filePath: '', showTitle: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'static-text',
    displayName: 'Static Text',
    defaultConfig: { title: '', content: '' },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'html',
    displayName: 'HTML Block',
    defaultConfig: { title: '', html: '' },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin),
  });
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export default class HomepagePlugin extends Plugin implements IHomepagePlugin {
  layout: LayoutConfig = getDefaultLayout();

  async onload(): Promise<void> {
    registerBlocks();

    const raw = await this.loadData() as unknown;
    this.layout = validateLayout(raw);

    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: 'open-homepage',
      name: 'Open Homepage',
      callback: () => { void this.openHomepage(); },
    });

    this.addRibbonIcon('home', 'Open Homepage', () => { void this.openHomepage(); });

    this.addSettingTab(new HomepageSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (this.layout.openOnStartup) {
        void this.openHomepage();
      }
    });
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async saveLayout(layout: LayoutConfig): Promise<void> {
    this.layout = layout;
    await this.saveData(layout);
  }

  async openHomepage(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
}

// ── Settings tab ─────────────────────────────────────────────────────────────

class HomepageSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HomepagePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Homepage Blocks' });

    new Setting(containerEl)
      .setName('Open on startup')
      .setDesc('Automatically open the homepage when Obsidian starts.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.openOnStartup)
          .onChange(async (value) => {
            this.plugin.layout.openOnStartup = value;
            await this.plugin.saveLayout(this.plugin.layout);
          }),
      );

    new Setting(containerEl)
      .setName('Default columns')
      .setDesc('Number of columns in the grid layout.')
      .addDropdown(drop =>
        drop
          .addOption('2', '2 columns')
          .addOption('3', '3 columns')
          .addOption('4', '4 columns')
          .setValue(String(this.plugin.layout.columns))
          .onChange(async (value) => {
            this.plugin.layout.columns = Number(value);
            await this.plugin.saveLayout(this.plugin.layout);
          }),
      );

    new Setting(containerEl)
      .setName('Reset to default layout')
      .setDesc('Restore all blocks to the original default layout. Cannot be undone.')
      .addButton(btn =>
        btn.setButtonText('Reset layout').setWarning().onClick(async () => {
          await this.plugin.saveLayout(getDefaultLayout());
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            if (leaf.view instanceof HomepageView) {
              await leaf.view.reload();
            }
          }
        }),
      );
  }
}
