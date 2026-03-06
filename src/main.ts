import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VIEW_TYPE, HomepageView } from './HomepageView';
import { BLOCK_TYPES, BlockInstance, BlockType, LayoutConfig, IHomepagePlugin } from './types';
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
    // Row 0 (y: 0–2)
    {
      id: 'default-static-text',
      type: 'static-text',
      x: 0, y: 0, w: 1, h: 3,
      config: { title: '', content: '' },
    },
    {
      id: 'default-clock',
      type: 'clock',
      x: 1, y: 0, w: 1, h: 3,
      config: { showSeconds: false, showDate: true },
    },
    {
      id: 'default-folder-links',
      type: 'folder-links',
      x: 2, y: 0, w: 1, h: 3,
      config: { title: 'Quick Links', links: [] },
    },
    // Row 1 (y: 3–5)
    {
      id: 'default-insight',
      type: 'insight',
      x: 0, y: 3, w: 2, h: 3,
      config: { tag: '', title: 'Daily Insight', dailySeed: true },
    },
    {
      id: 'default-tag-grid',
      type: 'tag-grid',
      x: 2, y: 3, w: 1, h: 5,
      config: { title: 'Values', columns: 2, items: [] },
    },
    // Row 2 (y: 6–8)
    {
      id: 'default-quotes',
      type: 'quotes-list',
      x: 0, y: 6, w: 2, h: 3,
      config: { tag: '', title: 'Quotes', columns: 2, maxItems: 20 },
    },
    // Row 3 (y: 9–11)
    {
      id: 'default-gallery',
      type: 'image-gallery',
      x: 0, y: 9, w: 3, h: 3,
      config: { folder: '', title: 'Gallery', columns: 3, maxItems: 20 },
    },
  ],
};

/** Returns a deep clone of the default layout, safe to mutate. */
function getDefaultLayout(): LayoutConfig {
  return structuredClone(DEFAULT_LAYOUT_DATA);
}

// ── Layout validation / migration ───────────────────────────────────────────

const VALID_BLOCK_TYPES = new Set<string>(BLOCK_TYPES);

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_BLOCKS = 100;

function migrateBlockInstance(b: Record<string, unknown>): Record<string, unknown> {
  const m = { ...b };
  if (typeof m.col === 'number') { m.x = m.col - 1; }
  if (typeof m.row === 'number') { m.y = m.row - 1; }
  if (typeof m.colSpan === 'number') { m.w = m.colSpan; }
  if (typeof m.rowSpan === 'number') { m.h = m.rowSpan; }
  delete m.col;
  delete m.row;
  delete m.colSpan;
  delete m.rowSpan;
  delete m.newRow;
  return m;
}

function isValidBlockInstance(b: unknown): b is BlockInstance {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' && SAFE_ID_RE.test(block.id) &&
    typeof block.type === 'string' && VALID_BLOCK_TYPES.has(block.type) &&
    typeof block.x === 'number' && block.x >= 0 &&
    typeof block.y === 'number' && block.y >= 0 &&
    typeof block.w === 'number' && block.w >= 1 &&
    typeof block.h === 'number' && block.h >= 1 && Number.isFinite(block.h) &&
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
  const rawBlocks: BlockInstance[] = Array.isArray(r.blocks)
    ? (r.blocks.map(b => migrateBlockInstance(b as Record<string, unknown>)) as unknown[]).filter(isValidBlockInstance).slice(0, MAX_BLOCKS)
    : defaults.blocks;
  // Clamp x/w to fit within the column count (fixes stale 12-column GridStack data)
  const blocks: BlockInstance[] = rawBlocks.map(b => ({
    ...b,
    w: Math.min(b.w, columns),
    x: Math.min(b.x, Math.max(0, columns - Math.min(b.w, columns))),
  }));

  return { columns, openOnStartup, blocks };
}

// ── Block registration ───────────────────────────────────────────────────────

function registerBlocks(): void {
  BlockRegistry.clear();

  BlockRegistry.register({
    type: 'greeting',
    displayName: 'Greeting',
    defaultConfig: { name: 'World', showTime: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'clock',
    displayName: 'Clock / Date',
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'folder-links',
    displayName: 'Quick Links',
    defaultConfig: { title: 'Quick Links', folder: '', links: [] },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'insight',
    displayName: 'Daily Insight',
    defaultConfig: { tag: '', title: 'Daily Insight', dailySeed: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new InsightBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'tag-grid',
    displayName: 'Values',
    defaultConfig: { title: 'Values', columns: 2, items: [] },
    defaultSize: { w: 1, h: 5 },
    create: (app, instance, plugin) => new TagGridBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'quotes-list',
    displayName: 'Quotes List',
    defaultConfig: { tag: '', title: 'Quotes', columns: 2, maxItems: 20 },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'image-gallery',
    displayName: 'Image Gallery',
    defaultConfig: { folder: '', title: 'Gallery', columns: 3, maxItems: 20 },
    defaultSize: { w: 3, h: 3 },
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'embedded-note',
    displayName: 'Embedded Note',
    defaultConfig: { filePath: '', showTitle: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'static-text',
    displayName: 'Static Text',
    defaultConfig: { title: '', content: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'html',
    displayName: 'HTML Block',
    defaultConfig: { title: '', html: '' },
    defaultSize: { w: 1, h: 3 },
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
    // Persist cleaned layout to remove old-format properties and fix corruption
    await this.saveData(this.layout);

    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: 'open-homepage',
      name: 'Open Homepage',
      callback: () => { void this.openHomepage(); },
    });

    this.addCommand({
      id: 'toggle-edit-mode',
      name: 'Toggle edit mode',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.toggleEditMode();
          }
        }
      },
    });

    this.addRibbonIcon('home', 'Open Homepage', () => { void this.openHomepage(); });

    this.addSettingTab(new HomepageSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (this.layout.openOnStartup) {
        void this.openHomepage();
      }
    });
  }

  onunload(): void {
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
            await this.plugin.saveLayout({ ...this.plugin.layout, openOnStartup: value });
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
            await this.plugin.saveLayout({ ...this.plugin.layout, columns: Number(value) });
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
