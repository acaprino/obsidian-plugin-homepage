import { App, Modal } from 'obsidian';
import { BlockInstance, BlockType, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GridLayout } from './GridLayout';

export class EditToolbar {
  private toolbarEl: HTMLElement;
  private fabEl: HTMLElement;
  private editMode = false;
  private zoomScale = 1;
  /** Snapshot of blocks array taken when entering edit mode — used by Discard. */
  private blocksSnapshot: BlockInstance[] | null = null;

  constructor(
    private containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private grid: GridLayout,
    private onColumnsChange: (n: number) => void,
  ) {
    // Floating action button — visible in read mode, triggers edit mode
    this.fabEl = containerEl.createDiv({ cls: 'homepage-edit-fab' });
    this.fabEl.setAttribute('role', 'button');
    this.fabEl.setAttribute('tabindex', '0');
    this.fabEl.setAttribute('aria-label', 'Enter edit mode');
    this.fabEl.setText('✏');
    this.fabEl.addEventListener('click', () => this.toggleEditMode());
    this.fabEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggleEditMode(); }
    });

    this.toolbarEl = containerEl.createDiv({ cls: 'homepage-toolbar' });
    this.toolbarEl.setAttribute('role', 'toolbar');
    this.toolbarEl.setAttribute('aria-label', 'Homepage toolbar');
    this.renderToolbar();
  }

  /** Toggle edit mode — called from FAB, Done button, and keyboard shortcut command. */
  toggleEditMode(): void {
    this.editMode = !this.editMode;
    if (this.editMode) {
      // Snapshot blocks so Discard can restore them (not the full layout — settings changes must survive)
      this.blocksSnapshot = structuredClone(this.plugin.layout.blocks);
    } else {
      this.blocksSnapshot = null;
      this.zoomScale = 1;
    }
    this.grid.setEditMode(this.editMode);
    this.syncVisibility();
    this.renderToolbar();
    if (this.editMode) {
      // Defer zoom computation until browser has reflowed the edit-mode placeholders
      requestAnimationFrame(() => {
        this.zoomScale = this.grid.computeFitZoom();
        this.grid.setZoom(this.zoomScale);
        this.renderToolbar();
      });
    }
  }

  /** Exit edit mode and revert all block changes made during this edit session. */
  private discardChanges(): void {
    if (!this.editMode) return; // re-entrancy guard
    if (this.blocksSnapshot) {
      // Build restored layout (only blocks revert; global settings survive)
      const restored = { ...this.plugin.layout, blocks: this.blocksSnapshot };
      // Set synchronously so the rerender triggered by setEditMode(false) reads the correct state
      this.plugin.layout = restored;
      void this.plugin.saveLayout(restored);
      this.blocksSnapshot = null;
    }
    this.editMode = false;
    this.zoomScale = 1;
    this.grid.setEditMode(false); // triggers rerender() which reads plugin.layout (now restored)
    this.syncVisibility();
    this.renderToolbar();
  }

  private syncVisibility(): void {
    this.fabEl.toggleClass('is-hidden', this.editMode);
    this.toolbarEl.toggleClass('is-visible', this.editMode);
  }

  private renderToolbar(): void {
    this.toolbarEl.empty();

    // Edit mode indicator (left-aligned)
    const indicator = this.toolbarEl.createDiv({ cls: 'toolbar-edit-indicator is-visible' });
    indicator.createDiv({ cls: 'toolbar-edit-dot' });
    indicator.createSpan({ text: 'Editing' });

    // Column count selector
    const colGroup = this.toolbarEl.createDiv({ cls: 'toolbar-col-group' });
    const colSelect = colGroup.createEl('select', { cls: 'toolbar-col-select' });
    colSelect.setAttribute('aria-label', 'Number of columns');
    const effective = this.grid.getEffectiveColumns();
    [2, 3, 4, 5].forEach(n => {
      const opt = colSelect.createEl('option', { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener('change', () => {
      this.onColumnsChange(Number(colSelect.value));
    });
    if (effective !== this.plugin.layout.columns) {
      colGroup.createSpan({ cls: 'toolbar-col-auto-hint', text: `(auto: ${effective})` });
    }

    // Zoom slider
    const zoomGroup = this.toolbarEl.createDiv({ cls: 'toolbar-zoom-group' });
    zoomGroup.createSpan({ cls: 'toolbar-zoom-label', text: 'Zoom' });
    const zoomSlider = zoomGroup.createEl('input', {
      cls: 'toolbar-zoom-slider',
      type: 'range',
      attr: { min: '0.1', max: '1', step: '0.05', value: String(this.zoomScale), 'aria-label': 'Zoom level' },
    });
    const zoomValue = zoomGroup.createSpan({ cls: 'toolbar-zoom-value', text: this.formatZoom(this.zoomScale) });
    zoomSlider.addEventListener('input', () => {
      this.zoomScale = parseFloat(zoomSlider.value);
      zoomValue.setText(this.formatZoom(this.zoomScale));
      this.grid.setZoom(this.zoomScale);
    });

    // Add Block button (only in edit mode)
    const addBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-add-btn' });
    addBtn.createSpan({ cls: 'toolbar-add-icon', text: '+' });
    addBtn.createSpan({ cls: 'toolbar-add-text', text: ' Add Block' });
    addBtn.addEventListener('click', () => { this.openAddBlockModal(); });

    // Discard button — exits edit mode and reverts all changes
    const discardBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-discard-btn', text: '✕ Discard' });
    discardBtn.addEventListener('click', () => this.discardChanges());

    // Done button — exits edit mode
    const doneBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-edit-btn toolbar-btn-active', text: '✓ Done' });
    doneBtn.addEventListener('click', () => this.toggleEditMode());

    // Wire up the grid's empty state CTA to open the add block modal
    this.grid.onRequestAddBlock = () => { this.openAddBlockModal(); };
  }

  /** Opens the Add Block modal. Called from toolbar button, empty state CTA, and command palette. */
  openAddBlockModal(): void {
    new AddBlockModal(this.app, (type) => {
      const factory = BlockRegistry.get(type);
      if (!factory) return;

      // Place new block at the bottom (y = high number, GridStack will compact)
      const instance: BlockInstance = {
        id: crypto.randomUUID(),
        type,
        x: 0,
        y: 1000,
        w: Math.min(factory.defaultSize.w, this.plugin.layout.columns),
        h: factory.defaultSize.h,
        config: { ...factory.defaultConfig },
      };

      this.grid.addBlock(instance);
    }).open();
  }

  private formatZoom(scale: number): string {
    return `${Math.round(scale * 100)}%`;
  }

  getElement(): HTMLElement {
    return this.toolbarEl;
  }

  getFabElement(): HTMLElement {
    return this.fabEl;
  }

  destroy(): void {
    this.grid.onRequestAddBlock = null;
    this.fabEl.remove();
    this.toolbarEl.remove();
  }
}

const BLOCK_META: Record<BlockType, { icon: string; desc: string }> = {
  'greeting':      { icon: '\u{1F44B}', desc: 'Personalized greeting with time of day' },
  'clock':         { icon: '\u{1F550}', desc: 'Live clock with date display' },
  'folder-links':  { icon: '\u{1F517}', desc: 'Quick links to notes and folders' },
  'insight':       { icon: '\u{1F4A1}', desc: 'Daily rotating note from a tag' },
  'button-grid':   { icon: '\u{1F532}', desc: 'Grid of emoji-labeled buttons' },
  'quotes-list':   { icon: '\u{1F4AC}', desc: 'Collection of quotes from notes' },
  'image-gallery': { icon: '\u{1F5BC}\uFE0F', desc: 'Photo grid from a vault folder' },
  'embedded-note': { icon: '\u{1F4C4}', desc: 'Render a note inline on the page' },
  'static-text':   { icon: '\u{1F4DD}', desc: 'Markdown text block you write directly' },
  'html':          { icon: '</>', desc: 'Custom HTML content (sanitized)' },
  'video-embed':   { icon: '\u{1F3AC}', desc: 'Embed YouTube, Vimeo, or other videos' },
  'bookmarks':     { icon: '\u{1F516}', desc: 'Web links and vault bookmarks grid' },
  'recent-files':  { icon: '\u{1F4C2}', desc: 'Recently modified notes in your vault' },
  'pomodoro':      { icon: '\u{1F345}', desc: 'Pomodoro timer with work/break cycles' },
  'spacer':        { icon: '\u2B1C', desc: 'Empty space for layout spacing' },
};

class AddBlockModal extends Modal {
  constructor(
    app: App,
    private onSelect: (type: BlockType) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Add Block', cls: 'add-block-modal-title' });

    const grid = contentEl.createDiv({ cls: 'add-block-grid' });

    for (const factory of BlockRegistry.getAll()) {
      const meta = BLOCK_META[factory.type];
      const btn = grid.createEl('button', { cls: 'add-block-option' });
      btn.createSpan({ cls: 'add-block-icon', text: meta?.icon ?? '\u25AA' });
      btn.createSpan({ cls: 'add-block-name', text: factory.displayName });
      if (meta?.desc) {
        btn.createSpan({ cls: 'add-block-desc', text: meta.desc });
      }
      btn.addEventListener('click', () => {
        this.onSelect(factory.type);
        this.close();
      });
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
