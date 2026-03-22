import { App, Modal, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE, HomepageView } from './HomepageView';
import { BLOCK_TYPES, BlockInstance, LayoutConfig, LayoutPriority, OpenMode, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GreetingBlock } from './blocks/GreetingBlock';
import { ClockBlock } from './blocks/ClockBlock';
import { FolderLinksBlock } from './blocks/FolderLinksBlock';
import { ButtonGridBlock } from './blocks/ButtonGridBlock';
import { QuotesListBlock } from './blocks/QuotesListBlock';
import { ImageGalleryBlock } from './blocks/ImageGalleryBlock';
import { EmbeddedNoteBlock } from './blocks/EmbeddedNoteBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import { HtmlBlock } from './blocks/HtmlBlock';
import { VideoEmbedBlock } from './blocks/VideoEmbedBlock';
import { BookmarkBlock } from './blocks/BookmarkBlock';
import { RecentFilesBlock } from './blocks/RecentFilesBlock';
import { PomodoroBlock } from './blocks/PomodoroBlock';
import { SpacerBlock } from './blocks/SpacerBlock';
import { RandomNoteBlock } from './blocks/RandomNoteBlock';
import { VoiceDictationBlock } from './blocks/VoiceDictationBlock';

// ── Default layout ──────────────────────────────────────────────────────────

/** Immutable template. Always clone via getDefaultLayout(). */
/** Must stay in sync with OpenMode in types.ts */
const VALID_OPEN_MODES = new Set<OpenMode>(['replace-all', 'replace-last', 'retain']);
const VALID_LAYOUT_PRIORITIES = new Set<LayoutPriority>(['row', 'column']);

function isOpenMode(v: unknown): v is OpenMode {
  return typeof v === 'string' && (VALID_OPEN_MODES as Set<string>).has(v);
}

function isLayoutPriority(v: unknown): v is LayoutPriority {
  return typeof v === 'string' && (VALID_LAYOUT_PRIORITIES as Set<string>).has(v);
}

const DEFAULT_LAYOUT_DATA: LayoutConfig = {
  columns: 3,
  layoutPriority: 'row',
  openOnStartup: false,
  openMode: 'retain',
  manualOpenMode: 'retain',
  openWhenEmpty: false,
  pin: false,
  hideScrollbar: false,
  blocks: [
    // Row 0 (y: 0–2)
    {
      id: 'default-static-text',
      type: 'static-text',
      x: 0, y: 0, w: 1, h: 3,
      config: { content: '' },
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
      config: { _titleLabel: 'Quick links', links: [] },
    },
    // Row 1 (y: 3–5)
    {
      id: 'default-insight',
      type: 'quotes-list',
      x: 0, y: 3, w: 2, h: 3,
      config: { tag: '', _titleLabel: 'Daily insight', dailySeed: true },
    },
    {
      id: 'default-button-grid',
      type: 'button-grid',
      x: 2, y: 3, w: 1, h: 5,
      config: {
        _titleLabel: 'Quick actions', columns: 2, items: [
          { emoji: '\u{1F4DD}', label: 'New note' },
          { emoji: '\u{1F4C5}', label: 'Today' },
          { emoji: '\u{2B50}', label: 'Favorites' },
          { emoji: '\u{1F50D}', label: 'Search' },
          { emoji: '\u{1F4DA}', label: 'Library' },
          { emoji: '\u{2699}\uFE0F', label: 'Settings' },
        ],
      },
    },
    // Row 2 (y: 6–8)
    {
      id: 'default-quotes',
      type: 'quotes-list',
      x: 0, y: 6, w: 2, h: 3,
      config: { tag: '', _titleLabel: 'Quotes', columns: 2, maxItems: 20 },
    },
    // Row 3 (y: 8)
    {
      id: 'default-voice-dictation',
      type: 'voice-dictation',
      x: 0, y: 8, w: 2, h: 3,
      config: { folder: '', triggerMode: 'tap', _titleLabel: 'Voice notes' },
    },
    // Row 4 (y: 11–13)
    {
      id: 'default-gallery',
      type: 'image-gallery',
      x: 0, y: 11, w: 3, h: 3,
      config: { folder: '', _titleLabel: 'Gallery', columns: 3, maxItems: 20 },
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
  // Migrate legacy type renames
  if (m.type === 'tag-grid') { m.type = 'button-grid'; }
  // Migrate legacy _transparent flag to granular flags.
  const cfg = m.config as Record<string, unknown> | undefined;
  if (cfg && cfg._transparent === true) {
    cfg._hideBorder = true;
    cfg._hideBackground = true;
    delete cfg._transparent;
  }
  // Migrate voice-dictation config field renames.
  if (m.type === 'voice-dictation' && cfg) {
    if (typeof cfg.whisperApiKey === 'string' && !cfg.apiKey) {
      cfg.apiKey = cfg.whisperApiKey;
    }
    if (typeof cfg.whisperLanguage === 'string' && !cfg.language) {
      cfg.language = cfg.whisperLanguage;
    }
    delete cfg.whisperApiKey;
    delete cfg.whisperLanguage;
  }
  // Clamp button-grid columns to the supported range [1, 3].
  if (m.type === 'button-grid' && cfg && typeof cfg.columns === 'number' && cfg.columns > 3) {
    cfg.columns = 3;
  }
  // Migrate per-block title to shared _titleLabel system.
  if (cfg && typeof cfg.title === 'string') {
    if (cfg.title && !cfg._titleLabel) {
      cfg._titleLabel = cfg.title;
    }
    // Blocks that previously used an empty title to hide the header
    // (html, static-text) should set _hideTitle so they stay headerless.
    if (!cfg.title && (m.type === 'html' || m.type === 'static-text')) {
      if (cfg._hideTitle === undefined) cfg._hideTitle = true;
    }
    delete cfg.title;
  }
  return m;
}

function isValidBlockInstance(b: unknown): b is BlockInstance {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' && SAFE_ID_RE.test(block.id) &&
    typeof block.type === 'string' && VALID_BLOCK_TYPES.has(block.type) &&
    typeof block.x === 'number' && Number.isFinite(block.x) && block.x >= 0 &&
    typeof block.y === 'number' && Number.isFinite(block.y) && block.y >= 0 &&
    typeof block.w === 'number' && Number.isFinite(block.w) && block.w >= 1 &&
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
  const columns = typeof r.columns === 'number' && [2, 3, 4, 5].includes(r.columns)
    ? r.columns
    : defaults.columns;
  const layoutPriority = isLayoutPriority(r.layoutPriority)
    ? r.layoutPriority
    : defaults.layoutPriority;
  const openOnStartup = typeof r.openOnStartup === 'boolean'
    ? r.openOnStartup
    : defaults.openOnStartup;
  const openMode = isOpenMode(r.openMode)
    ? r.openMode
    : defaults.openMode;
  const manualOpenMode = isOpenMode(r.manualOpenMode)
    ? r.manualOpenMode
    : defaults.manualOpenMode;
  const openWhenEmpty = typeof r.openWhenEmpty === 'boolean'
    ? r.openWhenEmpty
    : defaults.openWhenEmpty;
  const pin = typeof r.pin === 'boolean'
    ? r.pin
    : defaults.pin;
  const hideScrollbar = typeof r.hideScrollbar === 'boolean'
    ? r.hideScrollbar
    : defaults.hideScrollbar;
  let rawBlocks: BlockInstance[];
  if (Array.isArray(r.blocks)) {
    const migrated: unknown[] = r.blocks.map(b => migrateBlockInstance(b as Record<string, unknown>));
    rawBlocks = migrated.filter(isValidBlockInstance).slice(0, MAX_BLOCKS);
  } else {
    rawBlocks = defaults.blocks;
  }
  // Clamp x/w to fit within the column count (fixes stale 12-column GridStack data)
  const blocks: BlockInstance[] = rawBlocks.map(b => ({
    ...b,
    w: Math.min(b.w, columns),
    x: Math.min(b.x, Math.max(0, columns - Math.min(b.w, columns))),
  }));

  return { columns, layoutPriority, openOnStartup, openMode, manualOpenMode, openWhenEmpty, pin, hideScrollbar, blocks };
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
    displayName: 'Clock / date',
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'folder-links',
    displayName: 'Quick links',
    defaultConfig: { _titleLabel: 'Quick links', folder: '', links: [] },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin),
  });


  BlockRegistry.register({
    type: 'button-grid',
    displayName: 'Button grid',
    defaultConfig: { _titleLabel: 'Button grid', columns: 2, items: [] },
    defaultSize: { w: 1, h: 5 },
    create: (app, instance, plugin) => new ButtonGridBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'quotes-list',
    displayName: 'Quotes list',
    defaultConfig: { tag: '', _titleLabel: 'Quotes', columns: 2, maxItems: 20, quoteStyle: 'classic', fontStyle: 'default', customFont: '', mode: 'list', dailySeed: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'image-gallery',
    displayName: 'Image gallery',
    defaultConfig: { folder: '', _titleLabel: 'Gallery', columns: 3, maxItems: 20 },
    defaultSize: { w: 3, h: 3 },
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'embedded-note',
    displayName: 'Embedded note',
    defaultConfig: { filePath: '', showTitle: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'static-text',
    displayName: 'Static text',
    defaultConfig: { content: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'html',
    displayName: 'HTML block',
    defaultConfig: { html: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'video-embed',
    displayName: 'Video embed',
    defaultConfig: { url: '' },
    defaultSize: { w: 2, h: 4 },
    create: (app, instance, plugin) => new VideoEmbedBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'bookmarks',
    displayName: 'Bookmarks',
    defaultConfig: { _titleLabel: 'Bookmarks', items: [], columns: 2, showDescriptions: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new BookmarkBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'recent-files',
    displayName: 'Recent files',
    defaultConfig: { _titleLabel: 'Recent files', maxItems: 10, showTimestamp: true, excludeFolders: '' },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RecentFilesBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'pomodoro',
    displayName: 'Pomodoro timer',
    defaultConfig: { _titleLabel: 'Pomodoro', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLong: 4 },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new PomodoroBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'spacer',
    displayName: 'Spacer',
    defaultConfig: { _hideTitle: true, _hideBorder: true, _hideBackground: true, _hideHeaderAccent: true },
    defaultSize: { w: 1, h: 2 },
    create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'random-note',
    displayName: 'Random note',
    defaultConfig: { _titleLabel: 'Random note', tag: '', dailySeed: false, imageProperty: 'cover', titleProperty: 'title', showImage: true, showPreview: true },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RandomNoteBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'voice-dictation',
    displayName: 'Voice notes',
    defaultConfig: {
      folder: '',
      triggerMode: 'tap',
      provider: 'whisper',
      apiKey: '',
      model: '',
      language: '',
      noteTemplate: '',
    },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
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
      name: 'Open homepage',
      callback: () => { void this.openHomepage(this.layout.manualOpenMode); },
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

    this.addCommand({
      id: 'add-block',
      name: 'Add block',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.openAddBlockModal();
          }
        }
      },
    });

    this.addRibbonIcon('home', 'Open homepage', () => { void this.openHomepage(this.layout.manualOpenMode); });

    this.addSettingTab(new HomepageSettingTab(this.app, this));

    let layoutReady = false;
    this.app.workspace.onLayoutReady(() => {
      layoutReady = true;
      if (this.layout.openOnStartup) {
        void this.openHomepage(this.layout.openMode);
      }
    });

    let emptyCheckTimer: ReturnType<typeof setTimeout> | null = null;
    this.register(() => { if (emptyCheckTimer) clearTimeout(emptyCheckTimer); });
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        if (!layoutReady || !this.layout.openWhenEmpty) return;
        if (emptyCheckTimer) clearTimeout(emptyCheckTimer);
        emptyCheckTimer = setTimeout(() => {
          emptyCheckTimer = null;
          if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
          let hasContent = false;
          this.app.workspace.iterateRootLeaves(leaf => {
            if (leaf.view.getViewType() !== 'empty') hasContent = true;
          });
          if (!hasContent) {
            void this.openHomepage('retain');
          }
        }, 150);
      }),
    );
  }

  onunload(): void { /* Obsidian detaches views automatically */ }

  private savePromise = Promise.resolve();

  async saveLayout(layout: LayoutConfig): Promise<void> {
    this.layout = layout;
    this.savePromise = this.savePromise.then(() => this.saveData(layout)).catch(() => { /* disk error — in-memory state is authoritative */ });
    await this.savePromise;
  }

  async openHomepage(mode: OpenMode = 'retain'): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      if (this.layout.pin) existing[0].setPinned(true);
      return;
    }

    let leaf: WorkspaceLeaf;
    if (mode === 'replace-all') {
      const toClose: WorkspaceLeaf[] = [];
      workspace.iterateAllLeaves(l => {
        if (l.getRoot() === workspace.rootSplit) toClose.push(l);
      });
      toClose.forEach(l => l.detach());
      leaf = workspace.getLeaf(true);
    } else if (mode === 'replace-last') {
      leaf = workspace.getLeaf(false);
    } else {
      leaf = workspace.getLeaf('tab');
    }

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);

    if (this.layout.pin) leaf.setPinned(true);
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
    const openModeOptions: Record<string, string> = {
      'retain': 'Keep existing tabs (new tab)',
      'replace-last': 'Replace active tab',
      'replace-all': 'Close all tabs',
    };

    // ── Opening behavior ──────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Open on startup')
      .setDesc('Automatically open the homepage when Obsidian starts.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.openOnStartup)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, openOnStartup: value }).then(() => this.display());
          }),
      );

    if (this.plugin.layout.openOnStartup) {
      new Setting(containerEl)
        .setName('Startup open mode')
        .setDesc('How to handle existing tabs when opening homepage on startup.')
        .addDropdown(drop => {
          for (const [value, label] of Object.entries(openModeOptions)) {
            drop.addOption(value, label);
          }
          drop
            .setValue(this.plugin.layout.openMode)
            .onChange((value) => {
              if (!isOpenMode(value)) return;
              void this.plugin.saveLayout({ ...this.plugin.layout, openMode: value });
            });
        });
    }

    new Setting(containerEl)
      .setName('Open when empty')
      .setDesc('Automatically open the homepage when all tabs are closed.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.openWhenEmpty)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, openWhenEmpty: value });
          }),
      );

    new Setting(containerEl)
      .setName('Manual open mode')
      .setDesc('How to handle existing tabs when opening homepage via command or ribbon.')
      .addDropdown(drop => {
        for (const [value, label] of Object.entries(openModeOptions)) {
          drop.addOption(value, label);
        }
        drop
          .setValue(this.plugin.layout.manualOpenMode)
          .onChange((value) => {
            if (!isOpenMode(value)) return;
            void this.plugin.saveLayout({ ...this.plugin.layout, manualOpenMode: value });
          });
      });

    new Setting(containerEl)
      .setName('Pin homepage tab')
      .setDesc('Pin the homepage tab so it cannot be accidentally closed.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.pin)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, pin: value });
            // Apply pin state to any existing homepage leaves immediately
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              leaf.setPinned(value);
            }
          }),
      );

    // ── Layout ────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Default columns')
      .setDesc('Number of columns in the grid layout.')
      .addDropdown(drop =>
        drop
          .addOption('2', '2 columns')
          .addOption('3', '3 columns')
          .addOption('4', '4 columns')
          .addOption('5', '5 columns')
          .setValue(String(this.plugin.layout.columns))
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, columns: Number(value) });
          }),
      );

    new Setting(containerEl)
      .setName('Layout priority')
      .setDesc('Row-first fills blocks left-to-right across each row. Column-first fills blocks top-to-bottom in each column.')
      .addDropdown(drop =>
        drop
          .addOption('row', 'Row-first')
          .addOption('column', 'Column-first')
          .setValue(this.plugin.layout.layoutPriority)
          .onChange((value) => {
            if (!isLayoutPriority(value)) return;
            void this.plugin.saveLayout({ ...this.plugin.layout, layoutPriority: value });
          }),
      );

    new Setting(containerEl)
      .setName('Hide scrollbar')
      .setDesc('Hide the scrollbar on the homepage \u2014 content is still scrollable.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.hideScrollbar)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, hideScrollbar: value });
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              leaf.view.containerEl.toggleClass('homepage-no-scrollbar', value);
            }
          }),
      );

    new Setting(containerEl)
      .setName('Reset to default layout')
      .setDesc('Restore all blocks to the original default layout \u2014 cannot be undone.')
      .addButton(btn =>
        btn.setButtonText('Reset layout').setWarning().onClick(() => void (async () => {
          await this.plugin.saveLayout(getDefaultLayout());
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            if (leaf.view instanceof HomepageView) {
              await leaf.view.reload();
            }
          }
        })()),
      );

    // ── Export / Import ──────────────────────────────────────────────
    new Setting(containerEl).setName('Export / import').setHeading();

    new Setting(containerEl)
      .setName('Export layout')
      .setDesc('Copy the current layout to clipboard as JSON.')
      .addButton(btn =>
        btn.setButtonText('Copy to clipboard').onClick(() => void (async () => {
          try {
            const exportLayout = structuredClone(this.plugin.layout);
            for (const block of exportLayout.blocks) {
              delete block.config.apiKey;
            }
            const json = JSON.stringify(exportLayout, null, 2);
            await navigator.clipboard.writeText(json);
            btn.setButtonText('Copied!');
          } catch {
            btn.setButtonText('Copy failed');
          }
          setTimeout(() => { btn.setButtonText('Copy to clipboard'); }, 2000);
        })()),
      );

    new Setting(containerEl)
      .setName('Import layout')
      .setDesc('Paste a previously exported layout JSON to restore it.')
      .addButton(btn =>
        btn.setButtonText('Import from clipboard').onClick(() => void (async () => {
          try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text) as unknown;
            const validated = validateLayout(parsed);
            const blockTypes = validated.blocks.map(b => b.type);
            const summary = `${validated.blocks.length} block(s): ${[...new Set(blockTypes)].join(', ')}`;
            new ConfirmPresetModal(this.app, `Import (${summary})`, async () => {
              await this.plugin.saveLayout(validated);
              for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
                if (leaf.view instanceof HomepageView) {
                  await leaf.view.reload();
                }
              }
              btn.setButtonText('Imported!');
              setTimeout(() => { btn.setButtonText('Import from clipboard'); }, 2000);
            }).open();
          } catch {
            btn.setButtonText('Invalid JSON');
            setTimeout(() => { btn.setButtonText('Import from clipboard'); }, 2000);
          }
        })()),
      );

    // ── Layout Presets ───────────────────────────────────────────────
    new Setting(containerEl).setName('Layout presets').setHeading();
    containerEl.createEl('p', {
      text: 'Load a preset layout. This will replace your current layout.',
      cls: 'setting-item-description',
    });

    const presetGrid = containerEl.createDiv({ cls: 'preset-grid' });

    const presets: { name: string; desc: string; icon: string; layout: LayoutConfig }[] = [
      {
        name: 'Minimal',
        desc: 'Greeting + clock + static text',
        icon: '\u{2728}',
        layout: {
          ...getDefaultLayout(),
          columns: 2,
          blocks: [
            { id: 'p1', type: 'greeting', x: 0, y: 0, w: 2, h: 2, config: { name: '', showTime: true } },
            { id: 'p2', type: 'clock', x: 0, y: 2, w: 1, h: 3, config: { showSeconds: false, showDate: true } },
            { id: 'p3', type: 'static-text', x: 1, y: 2, w: 1, h: 3, config: { _titleLabel: 'Notes', content: '' } },
          ],
        },
      },
      {
        name: 'Dashboard',
        desc: 'Greeting + clock + links + insight + quotes',
        icon: '\u{1F4CA}',
        layout: {
          ...getDefaultLayout(),
          columns: 3,
          blocks: [
            { id: 'p1', type: 'greeting', x: 0, y: 0, w: 2, h: 2, config: { name: '', showTime: true } },
            { id: 'p2', type: 'clock', x: 2, y: 0, w: 1, h: 2, config: { showSeconds: false, showDate: true } },
            { id: 'p3', type: 'folder-links', x: 0, y: 2, w: 1, h: 3, config: { _titleLabel: 'Quick links', links: [] } },
            { id: 'p4', type: 'quotes-list', x: 1, y: 2, w: 2, h: 3, config: { tag: '', _titleLabel: 'Daily insight', dailySeed: true } },
            { id: 'p5', type: 'quotes-list', x: 0, y: 5, w: 3, h: 3, config: { tag: '', _titleLabel: 'Quotes', columns: 2, maxItems: 20 } },
          ],
        },
      },
      {
        name: 'Focus',
        desc: 'Greeting + embedded note + recent files',
        icon: '\u{1F3AF}',
        layout: {
          ...getDefaultLayout(),
          columns: 2,
          blocks: [
            { id: 'p1', type: 'greeting', x: 0, y: 0, w: 2, h: 2, config: { name: '', showTime: true } },
            { id: 'p2', type: 'embedded-note', x: 0, y: 2, w: 1, h: 5, config: { filePath: '', showTitle: true } },
            { id: 'p3', type: 'recent-files', x: 1, y: 2, w: 1, h: 5, config: { _titleLabel: 'Recent files', maxItems: 10, showTimestamp: true, excludeFolders: '' } },
          ],
        },
      },
    ];

    for (const preset of presets) {
      const card = presetGrid.createEl('button', { cls: 'preset-card' });
      card.createSpan({ cls: 'preset-icon', text: preset.icon });
      card.createSpan({ cls: 'preset-name', text: preset.name });
      card.createSpan({ cls: 'preset-desc', text: preset.desc });
      card.addEventListener('click', () => {
        new ConfirmPresetModal(this.app, preset.name, async () => {
          // Generate fresh IDs for the preset
          const freshLayout = structuredClone(preset.layout);
          freshLayout.blocks = freshLayout.blocks.map(b => ({ ...b, id: crypto.randomUUID() }));
          await this.plugin.saveLayout(freshLayout);
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            if (leaf.view instanceof HomepageView) {
              await leaf.view.reload();
            }
          }
        }).open();
      });
    }
  }
}

class ConfirmPresetModal extends Modal {
  constructor(app: App, private presetName: string, private onConfirm: () => void | Promise<void>) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Load preset?').setHeading();
    contentEl.createEl('p', { text: `This will replace your current layout with the "${this.presetName}" preset. This cannot be undone.` });
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Load preset').setWarning().onClick(() => {
          void Promise.resolve(this.onConfirm()).catch(e => console.error('[Homepage Blocks] Preset apply failed:', e));
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
