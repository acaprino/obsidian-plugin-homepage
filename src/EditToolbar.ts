import { App, Modal } from 'obsidian';
import { BlockInstance, BlockType, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GridLayout } from './GridLayout';

export class EditToolbar {
  private toolbarEl: HTMLElement;
  private fabEl: HTMLElement;
  private editMode = false;

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
    this.grid.setEditMode(this.editMode);
    this.syncVisibility();
    this.renderToolbar();
  }

  private syncVisibility(): void {
    // Read mode: show FAB, hide toolbar
    // Edit mode: show toolbar, hide FAB
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
    const colSelect = this.toolbarEl.createEl('select', { cls: 'toolbar-col-select' });
    colSelect.setAttribute('aria-label', 'Number of columns');
    [2, 3, 4].forEach(n => {
      const opt = colSelect.createEl('option', { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener('change', () => {
      this.onColumnsChange(Number(colSelect.value));
    });

    // Add Block button (only in edit mode)
    const addBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-add-btn', text: '+ Add Block' });
    addBtn.addEventListener('click', () => { this.openAddBlockModal(); });

    // Done button — exits edit mode
    const doneBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-edit-btn toolbar-btn-active', text: '✓ Done' });
    doneBtn.addEventListener('click', () => this.toggleEditMode());

    // Wire up the grid's empty state CTA to open the add block modal
    this.grid.onRequestAddBlock = () => { this.openAddBlockModal(); };
  }

  /** Opens the Add Block modal. Called from toolbar button and empty state CTA. */
  private openAddBlockModal(): void {
    new AddBlockModal(this.app, (type) => {
      const factory = BlockRegistry.get(type);
      if (!factory) return;

      const maxRow = this.plugin.layout.blocks.reduce(
        (max, b) => Math.max(max, b.row + b.rowSpan - 1), 0,
      );

      const instance: BlockInstance = {
        id: crypto.randomUUID(),
        type,
        col: 1,
        row: maxRow + 1,
        colSpan: Math.min(factory.defaultSize.colSpan, this.plugin.layout.columns),
        rowSpan: factory.defaultSize.rowSpan,
        config: { ...factory.defaultConfig },
      };

      this.grid.addBlock(instance);
    }).open();
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
  'tag-grid':      { icon: '\u{1F3F7}\uFE0F', desc: 'Grid of labeled value buttons' },
  'quotes-list':   { icon: '\u{1F4AC}', desc: 'Collection of quotes from notes' },
  'image-gallery': { icon: '\u{1F5BC}\uFE0F', desc: 'Photo grid from a vault folder' },
  'embedded-note': { icon: '\u{1F4C4}', desc: 'Render a note inline on the page' },
  'static-text':   { icon: '\u{1F4DD}', desc: 'Markdown text block you write directly' },
  'html':          { icon: '</>', desc: 'Custom HTML content (sanitized)' },
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
