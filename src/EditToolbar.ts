import { App, SuggestModal, setIcon } from 'obsidian';
import { BlockInstance, BlockType, BlockFactory, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GridLayout } from './GridLayout';
import { BLOCK_META } from './blockMeta';
import { newId } from './utils/ids';

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
    setIcon(this.fabEl, 'pencil');
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
      this.blocksSnapshot = structuredClone(this.plugin.activeBlocks());
    } else {
      this.blocksSnapshot = null;
      this.zoomScale = 1;
    }
    this.grid.setEditMode(this.editMode);
    this.syncVisibility();
    this.renderToolbar();
    if (this.editMode) {
      // Defer zoom computation until browser has reflowed the edit-mode placeholders
      window.requestAnimationFrame(() => {
        this.zoomScale = this.grid.computeFitZoom();
        this.grid.setZoom(this.zoomScale);
        this.renderToolbar();
      });
    }
  }

  /** Exit edit mode and revert all block changes made during this edit session. */
  private discardChanges(): void {
    if (!this.editMode) return; // re-entrancy guard
    // Cancel any in-flight debounced/raf persist FIRST so a late auto-height
    // write can't land after we restore the snapshot and resurrect the very
    // positions we're discarding.
    this.grid.cancelPendingPersist();
    if (this.blocksSnapshot) {
      // Route restored blocks through GridLayout.buildLayoutUpdate so the
      // mobile/desktop split (and any future per-platform fields) is owned by
      // a single function rather than duplicated here. Without this routing,
      // a new field added to buildLayoutUpdate would silently fail to revert
      // on Discard.
      const restored = this.grid.buildLayoutUpdate(this.blocksSnapshot);
      // Set synchronously so the rerender triggered by setEditMode(false) reads the correct state
      this.plugin.layout = restored;
      void this.plugin.saveLayout(restored);
      this.blocksSnapshot = null;
    }
    this.editMode = false;
    this.zoomScale = 1;
    // skipRepack — snapshot is already at correct view-mode positions.
    // flushInFlight=false — CRITICAL: do NOT re-persist the live edited grid;
    // we just restored the snapshot above and a flush would overwrite it with
    // the edited positions (turning Discard into Save).
    this.grid.setEditMode(false, true, false);
    this.syncVisibility();
    this.renderToolbar();
  }

  private syncVisibility(): void {
    this.fabEl.toggleClass('is-hidden', this.editMode);
    this.toolbarEl.toggleClass('is-visible', this.editMode);
    // Mirror the toolbar state on the view so CSS can flip scroll ownership
    // (sticky toolbar) without a .homepage-view:has(...) selector.
    const view = this.toolbarEl.closest('.homepage-view');
    if (view instanceof HTMLElement) view.toggleClass('hp-toolbar-open', this.editMode);
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
    const colChoices = this.plugin.isMobileActive() ? [1, 2, 3] : [2, 3, 4, 5];
    colChoices.forEach(n => {
      const opt = colSelect.createEl('option', { value: String(n), text: `${n} col` });
      if (n === this.plugin.activeColumns()) opt.selected = true;
    });
    colSelect.addEventListener('change', () => {
      this.onColumnsChange(Number(colSelect.value));
    });

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
    addBtn.createSpan({ cls: 'toolbar-add-text', text: ' Add block' });
    addBtn.addEventListener('click', () => { this.openAddBlockModal(); });

    // Discard button — exits edit mode and reverts all changes
    const discardBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-discard-btn', text: '✕ discard' });
    discardBtn.addEventListener('click', () => this.discardChanges());

    // Done button — exits edit mode
    const doneBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-edit-btn toolbar-btn-active', text: '✓ done' });
    doneBtn.addEventListener('click', () => this.toggleEditMode());

    // Wire up the grid's empty state CTA to open the add block modal
    this.grid.onRequestAddBlock = () => { this.openAddBlockModal(); };
  }

  /**
   * Tracked so EditToolbar.destroy() can close it. A leftover modal would
   * otherwise hold a closure over `this.grid` -- when the homepage view
   * gets reloaded mid-pick (e.g., user changes a setting in another tab),
   * the user's selection lands on a destroyed grid instance. Silent failure.
   */
  private openModal: AddBlockModal | null = null;

  private addModalGeneration = 0;
  /** Opens the Add Block modal. Called from toolbar button, empty state CTA, and command palette. */
  openAddBlockModal(): void {
    // Replace any previously-open modal so the closure always points at the
    // current grid.
    this.openModal?.close();
    
    const generation = ++this.addModalGeneration;
    
    const modal = new AddBlockModal(this.app, (type) => {
      // Defensive: don't add to a grid that's been destroyed since the modal
      // opened (e.g., the user changed showScrollbar in another tab while the
      // picker was up, triggering a full view reload).
      if (generation !== this.addModalGeneration) return;
      const factory = BlockRegistry.get(type);
      if (!factory) return;

      const instance: BlockInstance = {
        id: newId(),
        type,
        x: 0,
        // GridLayout.addBlock recomputes y from the current maxY, so the value
        // here is unused -- kept at 0 for clarity rather than the prior fake
        // sentinel that pretended to mean something.
        y: 0,
        w: Math.min(factory.defaultSize.w, this.plugin.activeColumns()),
        h: factory.defaultSize.h,
        config: { ...factory.defaultConfig },
      };

      this.grid.addBlock(instance);
    });
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      if (this.openModal === modal) this.openModal = null;
      originalOnClose();
    };
    this.openModal = modal;
    modal.open();
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
    // Close any open Add Block modal so its callback can't fire against this
    // toolbar's about-to-be-destroyed grid reference.
    this.addModalGeneration++;
    this.openModal?.close();
    this.openModal = null;
    this.grid.onRequestAddBlock = null;
    this.fabEl.remove();
    this.toolbarEl.remove();
  }
}


/**
 * Command-palette-style block picker: a searchable, arrow-navigable list
 * (extends Obsidian's SuggestModal for free fuzzy filtering + keyboard nav)
 * instead of a flat 17-item grid. Matches against display name, type, and
 * description.
 */
class AddBlockModal extends SuggestModal<BlockFactory> {
  constructor(
    app: App,
    private onSelect: (type: BlockType) => void,
  ) {
    super(app);
    this.setPlaceholder('Search blocks\u2026');
    this.modalEl.addClass('add-block-suggest');
  }

  getSuggestions(query: string): BlockFactory[] {
    const q = query.trim().toLowerCase();
    const all = BlockRegistry.getAll();
    if (!q) return all;
    return all.filter((f) => {
      const meta = BLOCK_META[f.type];
      return `${f.displayName} ${f.type} ${meta?.desc ?? ''}`.toLowerCase().includes(q);
    });
  }

  renderSuggestion(factory: BlockFactory, el: HTMLElement): void {
    el.addClass('add-block-suggestion');
    const meta = BLOCK_META[factory.type];
    el.createSpan({ cls: 'add-block-suggestion-icon', text: meta?.icon ?? '\u25AA' });
    const text = el.createDiv({ cls: 'add-block-suggestion-text' });
    text.createDiv({ cls: 'add-block-suggestion-name', text: factory.displayName });
    if (meta?.desc) {
      text.createDiv({ cls: 'add-block-suggestion-desc', text: meta.desc });
    }
  }

  onChooseSuggestion(factory: BlockFactory): void {
    this.onSelect(factory.type);
  }
}
