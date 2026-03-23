import { App, ColorComponent, Modal, Setting, setIcon } from 'obsidian';
import { GridStack, GridStackWidget, GridStackNode } from 'gridstack';
import { BlockInstance, LayoutConfig, LayoutPriority, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';
import { createEmojiPicker } from './utils/emojiPicker';
import { applyBlockStyling, HEX_COLOR_RE } from './utils/blockStyling';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

/** Compact grid-row height for edit-mode placeholders (cellHeight = 80px). */
const COMPACT_EDIT_H = 2;

const ACCENT_PRESETS = [
  '#c0392b', '#e67e22', '#f1c40f', '#ffef3a', '#27ae60', '#16a085',
  '#2980b9', '#8e44ad', '#e84393', '#6c5ce7', '#636e72',
];

export class GridLayout {
  private gridEl: HTMLElement;
  private gridStack: GridStack | null = null;
  private blocks = new Map<string, { block: BaseBlock | null; wrapper: HTMLElement }>();
  private animTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private editMode = false;
  private columns = 3;
  private pendingRafs = new Set<number>();
  private resizeObserver: ResizeObserver | null = null;
  private effectiveColumns: number;
  private userColumns = 3;
  private isDestroyed = false;
  /** Callback to trigger the Add Block modal from the empty state CTA. */
  onRequestAddBlock: (() => void) | null = null;
  /** ID of the most recently added block — used for scroll-into-view. */
  private lastAddedBlockId: string | null = null;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid grid-stack' });
    this.effectiveColumns = plugin.layout.columns;
  }

  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement(): HTMLElement {
    return this.gridEl;
  }

  /**
   * Build a LayoutConfig with blocks routed to the correct field (desktop or mobile).
   * On mobile with separate mode, writes go to mobileBlocks/mobileColumns.
   */
  private buildLayoutUpdate(
    blocks: BlockInstance[],
    extra?: { columns?: number },
  ): LayoutConfig {
    const mobile = this.plugin.isMobileActive();
    const base = { ...this.plugin.layout };
    if (mobile) {
      base.mobileBlocks = blocks;
      if (extra?.columns !== undefined) base.mobileColumns = extra.columns;
    } else {
      base.blocks = blocks;
      if (extra?.columns !== undefined) base.columns = extra.columns;
    }
    return base;
  }

  render(blocks: BlockInstance[], columns: number, isInitial = false): void {
    this.destroyAll();
    this.isDestroyed = false;

    this.gridEl.setAttribute('role', 'list');
    this.gridEl.setAttribute('aria-label', 'Homepage blocks');

    if (isInitial) {
      this.gridEl.addClass('homepage-grid--animating');
      if (this.animTimer) clearTimeout(this.animTimer);
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.gridEl.removeClass('homepage-grid--animating');
      }, 500);
    }

    if (this.editMode) {
      this.gridEl.addClass('edit-mode');
    } else {
      this.gridEl.removeClass('edit-mode');
    }

    if (blocks.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.initGridStack(blocks, columns, isInitial);
  }

  private renderEmptyState(): void {
    this.gridEl.empty();
    const empty = this.gridEl.createDiv({ cls: 'homepage-empty-state' });
    empty.createDiv({ cls: 'homepage-empty-icon', text: '\u{1F3E0}' });
    empty.createEl('p', { cls: 'homepage-empty-title', text: 'Your homepage is empty' });
    empty.createEl('p', {
      cls: 'homepage-empty-desc',
      text: this.editMode
        ? 'Click the button below to add your first block.'
        : 'Toggle Edit mode in the toolbar to start adding blocks.',
    });
    if (this.editMode && this.onRequestAddBlock) {
      const cta = empty.createEl('button', { cls: 'homepage-empty-cta', text: 'Add your first block' });
      cta.addEventListener('click', () => { this.onRequestAddBlock?.(); });
    }
  }

  private initGridStack(blocks: BlockInstance[], columns: number, isInitial: boolean): void {
    // Build widget items WITHOUT content — DOM will be built manually using Obsidian API
    // (GridStack sets content via innerHTML which Obsidian blocks)
    const items: GridStackWidget[] = blocks.map((instance) => ({
      id: instance.id,
      x: instance.x,
      y: instance.y,
      w: Math.min(instance.w, columns),
      maxW: columns,
      h: (this.editMode && this.shouldAutoHeight(instance)) ? COMPACT_EDIT_H : instance.h,
      // Do NOT pass sizeToContent here — GridStack calls resizeToContent() during
      // load() before we've added any DOM content, causing "firstElementChild is null".
      // We call resizeToContent() manually after building each block's DOM below.
    }));

    // Repack y values so items are tightly stacked from the start.
    // Edit mode: view-mode y positions leave large gaps between compact-h items.
    // View mode: saved y positions may have gaps — pack to eliminate them.
    // When compactLayout is off, skip packing to preserve intentional gaps.
    if (this.plugin.layout.compactLayout) {
      GridLayout.packRows(items, columns, this.plugin.activeLayoutPriority());
    }

    this.columns = columns;
    this.gridEl.classList.toggle('hp-single-column', columns === 1);

    this.gridStack = GridStack.init({
      column: columns,
      cellHeight: 80,
      margin: 8,
      float: true,
      animate: true,
      staticGrid: !this.editMode,
      removable: false,
      handleClass: 'block-move-handle',
      // Horizontal-only resize in edit mode (vertical managed by sizeToContent / GridStack rows).
      // In view mode, staticGrid disables all interaction so handles are irrelevant.
      resizable: { handles: 'e,s,se' },
    }, this.gridEl);

    this.gridStack.load(items);

    // Wire up block Component lifecycle after DOM is created
    for (const [i, instance] of blocks.entries()) {
      const gsEl = this.gridEl.querySelector(`[gs-id="${CSS.escape(instance.id)}"]`);
      if (!(gsEl instanceof HTMLElement)) continue;

      // ARIA: mark grid items as listitems to match parent role="list"
      gsEl.setAttribute('role', 'listitem');
      if (this.shouldAutoHeight(instance)) {
        gsEl.classList.add('is-auto-height');
      } else {
        gsEl.classList.remove('is-auto-height');
      }

      // Find the GridStack item content container and populate it via Obsidian DOM API
      const gsContent = gsEl.querySelector('.grid-stack-item-content');
      if (!(gsContent instanceof HTMLElement)) continue;

      const animDelayMs = isInitial ? ([0, 50, 100, 140, 170, 195, 215, 230][i] ?? 240) : undefined;
      const wrapper = this.buildBlockWrapper(gsContent, instance, animDelayMs);

      const headerZone = wrapper.querySelector('.block-header-zone');
      const contentEl = wrapper.querySelector('.block-content');
      if (!(contentEl instanceof HTMLElement) || !(headerZone instanceof HTMLElement)) continue;

      const factory = BlockRegistry.get(instance.type);
      if (!factory) continue;

      if (this.editMode) {
        // Symbolic compact card — no content rendering for easy drag & drop
        this.renderCompactPlaceholder(headerZone, contentEl, factory, instance);
        this.blocks.set(instance.id, { block: null, wrapper });
      } else {
        const block = factory.create(this.app, instance, this.plugin);
        block.setHeaderContainer(headerZone);
        block.load();
        const needsResize = this.shouldAutoHeight(instance);
        // Listen for auto-height requests from block re-renders (via scheduleRender)
        if (needsResize) {
          gsEl.addEventListener('request-auto-height', () => {
            this.scheduleResize(gsEl, instance);
          });
        }
        const result = block.render(contentEl);
        if (result instanceof Promise) {
          // After async render, wait one frame for the browser to lay out the new DOM,
          // then measure and resize the block to its natural content height.
          result
            .then(() => { if (needsResize) this.scheduleResize(gsEl, instance); })
            .catch(e => {
              console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
              contentEl.setText('Error rendering block. Check console for details.');
            });
        } else if (needsResize) {
          this.scheduleResize(gsEl, instance);
        }
        this.blocks.set(instance.id, { block, wrapper });
      }

      // Collapse toggle
      this.setupCollapseToggle(gsEl, instance, headerZone);

      // Edit handles
      if (this.editMode) {
        this.attachEditHandles(wrapper, instance);
      }
    }

    // In single-column flex mode, reorder DOM elements by position
    // so blocks appear in the user's chosen priority order.
    if (columns === 1) {
      const priority = this.plugin.activeLayoutPriority();
      const gridItems = [...this.gridEl.querySelectorAll<HTMLElement>(':scope > .grid-stack-item')];
      gridItems.sort((a, b) => {
        const na = (a as HTMLElement & { gridstackNode?: { x?: number; y?: number } }).gridstackNode;
        const nb = (b as HTMLElement & { gridstackNode?: { x?: number; y?: number } }).gridstackNode;
        return priority === 'column'
          ? ((na?.x ?? 0) - (nb?.x ?? 0)) || ((na?.y ?? 0) - (nb?.y ?? 0))
          : ((na?.y ?? 0) - (nb?.y ?? 0)) || ((na?.x ?? 0) - (nb?.x ?? 0));
      });
      for (const el of gridItems) {
        this.gridEl.appendChild(el);
      }
    }

    // GridStack already compensates for CSS transform via getValuesFromTransformedElement
    // (dragTransform.xScale/yScale), so we do NOT need to clear the viewport-fit scale.
    this.gridStack.on('dragstop', () => {
      this.syncLayoutFromGrid();
    });

    this.gridStack.on('resizestop', () => {
      this.syncLayoutFromGrid();
      this.updateCompactSizeLabels();
    });

    const viewEl = this.gridEl.closest('.homepage-view');
    this.setupResponsiveColumns(viewEl instanceof HTMLElement ? viewEl : null, columns);

    // Scroll to newly added block
    if (this.lastAddedBlockId) {
      const targetId = this.lastAddedBlockId;
      this.lastAddedBlockId = null;
      const el = this.gridEl.querySelector(`[gs-id="${CSS.escape(targetId)}"]`);
      if (el instanceof HTMLElement) {
        el.querySelector('.homepage-block-wrapper')?.addClass('block-just-added');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /** Build the block wrapper DOM inside a GridStack item content div using Obsidian's DOM API. */
  private buildBlockWrapper(container: HTMLElement, instance: BlockInstance, animDelayMs?: number): HTMLElement {
    const classes = ['homepage-block-wrapper'];
    // Don't collapse blocks with hidden titles — there's no visible header
    // to click for re-expansion, making them appear completely invisible.
    const effectiveCollapsed = instance.collapsed && instance.config._hideTitle !== true;
    if (effectiveCollapsed) classes.push('block-collapsed');
    const wrapper = container.createDiv({
      cls: classes.join(' '),
      attr: { 'data-block-id': instance.id },
    });
    applyBlockStyling(wrapper, instance.config);
    if (animDelayMs !== undefined) {
      wrapper.style.setProperty('--hp-card-anim-delay', `${animDelayMs}ms`);
    }
    const headerZone = wrapper.createDiv({
      cls: 'block-header-zone',
      attr: { role: 'button', tabindex: '0', 'aria-expanded': String(!effectiveCollapsed) },
    });
    headerZone.createSpan({
      cls: 'block-collapse-chevron' + (effectiveCollapsed ? ' is-collapsed' : ''),
      attr: { 'aria-hidden': 'true' },
    });
    if (instance.config._showDivider === true) {
      wrapper.createDiv({ cls: 'block-header-divider' });
    }
    wrapper.createDiv({ cls: 'block-content' });
    return wrapper;
  }

  /** Render a lightweight symbolic placeholder for edit mode (no real block content). */
  private renderCompactPlaceholder(
    headerZone: HTMLElement,
    contentEl: HTMLElement,
    factory: { displayName: string },
    instance: BlockInstance,
  ): void {
    // Show block type name in header zone
    const titleLabel = typeof instance.config._titleLabel === 'string' && instance.config._titleLabel
      ? instance.config._titleLabel
      : factory.displayName;
    const emoji = typeof instance.config._titleEmoji === 'string' ? instance.config._titleEmoji : '';
    const header = headerZone.createDiv({ cls: 'block-header' });
    if (emoji) header.createEl('em', { cls: 'block-header-emoji', text: emoji });
    header.createSpan({ text: titleLabel });

    // Compact info in content area
    const info = contentEl.createDiv({ cls: 'block-compact-info' });
    info.createSpan({ cls: 'block-compact-type', text: instance.type });
    info.createSpan({ cls: 'block-compact-size', text: `${instance.w}\u00D7${instance.h}` });
  }

  /** Update all compact size labels to reflect current GridStack node dimensions. */
  private updateCompactSizeLabels(): void {
    if (!this.gridStack) return;
    for (const el of this.gridStack.getGridItems()) {
      const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      const label = (el as HTMLElement).querySelector('.block-compact-size');
      if (node && label) {
        label.textContent = `${node.w ?? 1}\u00D7${node.h ?? 1}`;
      }
    }
  }

  /**
   * Resize a block's grid row to fit its natural content height.
   *
   * GridStack's built-in resizeToContent() measures .homepage-block-wrapper which has
   * height:100%, so it always returns the current cell height — never growing.
   * Instead we look for a [data-auto-height-content] element placed by the block,
   * which has height:auto and reports its true rendered height via offsetHeight.
   */
  /**
   * Schedule a resizeBlockToContent call.  All requests within the same frame
   * are coalesced into a single batch to prevent cross-block resize cascading
   * (Block A resize → column reflow → Block B width change → Block B resize → …).
   */
  private pendingResizes = new Map<string, { gsEl: HTMLElement; instance: BlockInstance }>();
  private batchRafId: number | null = null;

  private scheduleResize(gsEl: HTMLElement, instance: BlockInstance): void {
    this.pendingResizes.set(instance.id, { gsEl, instance });
    if (this.batchRafId !== null) return; // already scheduled
    this.batchRafId = requestAnimationFrame(() => {
      const rafId = this.batchRafId!;
      this.pendingRafs.delete(rafId);
      this.batchRafId = null;
      if (this.isDestroyed || !this.gridStack) return;
      const batch = Array.from(this.pendingResizes.values());
      this.pendingResizes.clear();

      // Lift static grid for the entire batch so updates + compaction work.
      const isStatic = !!this.gridStack.opts.staticGrid;
      if (isStatic) this.gridStack.setStatic(false);

      let anyResized = false;
      for (const { gsEl: el, instance: inst } of batch) {
        if (this.resizeBlockToContent(el, inst)) anyResized = true;
      }

      // After auto-height changes, repack ALL blocks so those below shift up
      // to fill gaps left by blocks that shrank.  GridStack's compact() and
      // float toggle are unreliable, so we compute positions ourselves.
      if (anyResized) {
        if (this.plugin.layout.compactLayout) {
          const nodeItems: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
          for (const gsEl2 of this.gridStack.getGridItems()) {
            const node = (gsEl2 as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
            if (!node) continue;
            nodeItems.push({ el: gsEl2 as HTMLElement, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
          }
          GridLayout.packRows(nodeItems, this.effectiveColumns, this.plugin.activeLayoutPriority());
          this.gridStack.batchUpdate();
          for (const item of nodeItems) {
            this.gridStack.update(item.el, { y: item.y });
          }
          this.gridStack.batchUpdate(false);
        }
        this.scheduleSyncLayout();
      }

      if (isStatic) this.gridStack.setStatic(true);
    });
    this.pendingRafs.add(this.batchRafId);
  }

  /** Measure a block's natural content height and update its GridStack row count.
   *  Returns true if the height was changed. */
  private resizeBlockToContent(gsEl: HTMLElement, instance: BlockInstance): boolean {
    if (!this.gridStack || !gsEl.isConnected) return false;

    const contentEl = gsEl.querySelector<HTMLElement>('[data-auto-height-content]');
    const headerZone = gsEl.querySelector<HTMLElement>('.block-header-zone');
    if (!contentEl || !headerZone) return false;

    // grid-template-rows: 1fr constrains the gallery to the available flex space.
    // Temporarily switch to max-content so the gallery reports its natural height.
    // Disable the CSS transition first — otherwise the discrete 1fr→max-content
    // transition keeps the computed value as 1fr at t=0 and offsetHeight returns
    // the constrained height instead of the natural content height.
    const blockContent = gsEl.querySelector<HTMLElement>('.block-content');
    if (blockContent) {
      blockContent.addClass('hp-no-transition');
      blockContent.addClass('hp-auto-rows');
    }

    // Batch all DOM reads before writes to avoid layout thrashing.
    // Read natural content height and header height while hp-auto-rows is active.
    const contentH = contentEl.offsetHeight;
    const headerH = headerZone.offsetHeight;

    // Restore classes (write phase)
    if (blockContent) {
      blockContent.removeClass('hp-auto-rows');
      void blockContent.offsetHeight; // force reflow to prevent transition animation
      blockContent.removeClass('hp-no-transition');
    }

    if (contentH <= 0) return false;

    const wrapper = gsEl.querySelector<HTMLElement>('.homepage-block-wrapper');
    const wrapperStyle = wrapper ? window.getComputedStyle(wrapper) : null;
    const pad = wrapperStyle
      ? parseFloat(wrapperStyle.paddingTop) + parseFloat(wrapperStyle.paddingBottom)
      : 24;
    const gap = wrapperStyle ? parseFloat(wrapperStyle.gap) || 0 : 0;
    // Count gaps: header-zone + optional divider + block-content = 2-3 children
    const divider = wrapper?.querySelector('.block-header-divider');
    const gapCount = divider ? 2 : 1;
    const margin = typeof this.gridStack.opts.margin === 'number' ? this.gridStack.opts.margin : 8;
    const totalH = headerH + pad + contentH + (gap * gapCount) + margin * 2;
    const cell = this.gridStack.getCellHeight();
    const rows = Math.max(1, Math.ceil(totalH / cell));

    const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
    const currentH = node?.h ?? instance.h;
    if (rows !== currentH) {
      // Static grid is already lifted by the caller (scheduleResize batch).
      this.gridStack.update(gsEl, { h: rows });
      return true;
    }
    return false;
  }

  /** Determine if a block should auto-expand beyond its grid cell height. */
  private shouldAutoHeight(instance: BlockInstance): boolean {
    const hm = instance.config.heightMode;
    const heightMode = typeof hm === 'string' ? hm : '';
    if (instance.type === 'image-gallery') return heightMode !== 'fixed';
    if (instance.type === 'quotes-list') return heightMode === 'extend';
    if (instance.type === 'button-grid') return true;
    if (instance.type === 'embedded-note' && heightMode === 'grow') return true;
    if (instance.type === 'static-text') return heightMode !== 'fixed';
    if (instance.type === 'random-note') return true;
    return false;
  }

  private setupCollapseToggle(gsEl: HTMLElement, instance: BlockInstance, headerZone: HTMLElement): void {
    const wrapper = gsEl.querySelector('.homepage-block-wrapper') as HTMLElement;
    const chevron = headerZone.querySelector('.block-collapse-chevron') as HTMLElement;
    if (!wrapper || !chevron) return;

    const toggleCollapse = (e: Event) => {
      e.stopPropagation();
      if (this.editMode) return;
      const isNowCollapsed = !wrapper.hasClass('block-collapsed');
      wrapper.toggleClass('block-collapsed', isNowCollapsed);
      chevron.toggleClass('is-collapsed', isNowCollapsed);
      headerZone.setAttribute('aria-expanded', String(!isNowCollapsed));

      // Tell GridStack to resize the cell so the grid reflows, and persist the height
      const gsNode = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      let newBlocks: BlockInstance[];

      if (isNowCollapsed) {
        // Read live height from GridStack (accounts for user resizes since render)
        const liveH = gsNode?.h ?? instance.h;
        if (this.gridStack) this.gridStack.update(gsEl, { h: 1 });
        newBlocks = this.plugin.activeBlocks().map(b =>
          b.id === instance.id ? { ...b, collapsed: true, _expandedH: liveH } : b,
        );
      } else {
        // Restore the saved expanded height
        const currentBlock = this.plugin.activeBlocks().find(b => b.id === instance.id);
        const origH = currentBlock?._expandedH ?? instance.h;
        if (this.gridStack) this.gridStack.update(gsEl, { h: origH });
        newBlocks = this.plugin.activeBlocks().map(b =>
          b.id === instance.id ? { ...b, collapsed: false, h: origH } : b,
        );
      }

      void this.plugin.saveLayout(this.buildLayoutUpdate(newBlocks));
    };

    headerZone.addEventListener('click', toggleCollapse);
    headerZone.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(e); }
    });
  }

  private attachEditHandles(wrapper: HTMLElement, instance: BlockInstance): void {
    const bar = wrapper.createDiv({ cls: 'block-handle-bar' });

    // Drag handle (left)
    const handle = bar.createDiv({ cls: 'block-move-handle' });
    setIcon(handle, 'grip-vertical');
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.setAttribute('title', 'Drag to reorder');

    // Move up / down (grouped next to drag handle for logical order)
    const moveUpBtn = bar.createEl('button', { cls: 'block-move-up-btn' });
    setIcon(moveUpBtn, 'chevron-up');
    moveUpBtn.setAttribute('aria-label', 'Move block up');
    moveUpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.swapWithNeighbor(instance, 'up');
    });

    const moveDownBtn = bar.createEl('button', { cls: 'block-move-down-btn' });
    setIcon(moveDownBtn, 'chevron-down');
    moveDownBtn.setAttribute('aria-label', 'Move block down');
    moveDownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.swapWithNeighbor(instance, 'down');
    });

    // Duplicate
    const dupBtn = bar.createEl('button', { cls: 'block-duplicate-btn' });
    setIcon(dupBtn, 'copy');
    dupBtn.setAttribute('aria-label', 'Duplicate block');
    dupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Read current state from layout (not stale render-time closure)
      const current = this.plugin.activeBlocks().find(b => b.id === instance.id);
      if (!current) return;
      const clone: BlockInstance = {
        ...structuredClone(current),
        id: crypto.randomUUID(),
        y: current.y + current.h,
      };
      const newBlocks = [...this.plugin.activeBlocks(), clone];
      this.lastAddedBlockId = clone.id;
      this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
      this.rerender();
    });

    // Settings (right group)
    const settingsBtn = bar.createEl('button', { cls: 'block-settings-btn' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.setAttribute('aria-label', 'Block settings');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = this.blocks.get(instance.id);
      if (!entry) return;
      const onSave = (config: Record<string, unknown>) => {
        const newBlocks = this.plugin.activeBlocks().map(b =>
          b.id === instance.id ? { ...b, config } : b,
        );
        this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
        this.rerender();
      };
      // In edit mode blocks aren't instantiated — create a temporary one for settings
      let tempBlock: BaseBlock | null = null;
      const block = entry.block ?? (() => {
        const factory = BlockRegistry.get(instance.type);
        if (!factory) return null;
        tempBlock = factory.create(this.app, instance, this.plugin);
        return tempBlock;
      })();
      if (!block) return;
      const modal = new BlockSettingsModal(this.app, instance, block, (config) => {
        if (tempBlock) tempBlock.unload();
        onSave(config);
      });
      modal.open();
    });

    // Remove (last — destructive action at the end)
    const removeBtn = bar.createEl('button', { cls: 'block-remove-btn' });
    setIcon(removeBtn, 'x');
    removeBtn.setAttribute('aria-label', 'Remove block');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new RemoveBlockConfirmModal(this.app, () => {
        const gsItem = this.gridEl.querySelector(`[gs-id="${CSS.escape(instance.id)}"]`);
        if (gsItem instanceof HTMLElement && this.gridStack) {
          this.gridStack.removeWidget(gsItem);
          this.gridStack.compact();
        }
        const entry = this.blocks.get(instance.id);
        if (entry) {
          entry.block?.unload();
          this.blocks.delete(instance.id);
        }
        const remaining = this.plugin.activeBlocks().filter(b => b.id !== instance.id);
        if (remaining.length === 0) {
          this.onLayoutChange(this.buildLayoutUpdate([]));
          this.rerender();
          return;
        }
        // Read compacted positions from GridStack and persist them
        if (!this.gridStack) {
          this.onLayoutChange(this.buildLayoutUpdate(remaining));
          return;
        }
        const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();
        for (const el of this.gridStack.getGridItems()) {
          const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
          const id = el.getAttribute('gs-id');
          if (id && node) {
            posMap.set(id, { x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
          }
        }
        const newBlocks = remaining.map(b => {
          const pos = posMap.get(b.id);
          if (!pos) return b;
          const isAuto = this.shouldAutoHeight(b);
          const update = isAuto ? { x: pos.x, y: pos.y, w: pos.w } : pos;
          return { ...b, ...update };
        });
        this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
      }).open();
    });

    // Insert handle bar before header zone
    const headerZone = wrapper.querySelector('.block-header-zone');
    if (headerZone) {
      wrapper.insertBefore(bar, headerZone);
    }
  }

  /** Swap a block's position with its nearest spatial neighbor in the given direction. */
  private swapWithNeighbor(instance: BlockInstance, direction: 'up' | 'down'): void {
    const blocks = this.plugin.activeBlocks();
    const current = blocks.find(b => b.id === instance.id);
    if (!current) return;

    const columns = this.plugin.activeColumns();
    const neighbor = blocks
      .filter(b => b.id !== instance.id && (
        direction === 'up'
          ? (b.y < current.y || (b.y === current.y && b.x < current.x))
          : (b.y > current.y || (b.y === current.y && b.x > current.x))
      ))
      .sort((a, b) => direction === 'up'
        ? (b.y - a.y || b.x - a.x)
        : (a.y - b.y || a.x - b.x),
      )[0];
    if (!neighbor) return;

    // Swap positions, clamping x so that x + w <= columns
    const newBlocks = blocks.map(b => {
      if (b.id === current.id) {
        return { ...b, x: Math.min(neighbor.x, Math.max(0, columns - current.w)), y: neighbor.y };
      }
      if (b.id === neighbor.id) {
        return { ...b, x: Math.min(current.x, Math.max(0, columns - neighbor.w)), y: current.y };
      }
      return b;
    });
    this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
    this.rerender();
  }

  /** Read current positions from GridStack nodes and persist to layout. */
  /** Debounced sync — coalesces rapid auto-height resize saves into one write. */
  private scheduleSyncLayout(): void {
    if (this.syncTimer !== null) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (!this.isDestroyed) this.syncLayoutFromGrid();
    }, 50);
  }

  private syncLayoutFromGrid(): void {
    if (!this.gridStack) return;

    // When responsive columns are active (effectiveColumns < userColumns),
    // GridStack nodes hold transient positions adapted for the narrow viewport.
    // Persisting x/y/w from the responsive layout would destroy the canonical
    // (desktop) layout.  Only persist height changes in this case.
    // Note: dragstop/resizestop callers are gated by staticGrid (only active in
    // edit mode), so isResponsive is always false for manual user interactions.
    const isResponsive = this.effectiveColumns !== this.userColumns && !this.editMode;

    // Fast path: when every block is auto-height and we are in responsive mode,
    // there is nothing to persist — skip the GridStack DOM traversal entirely.
    if (isResponsive && this.plugin.activeBlocks().every(b => this.shouldAutoHeight(b))) return;

    const nodes = this.gridStack.getGridItems();
    const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (const el of nodes) {
      const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      const id = el.getAttribute('gs-id');
      if (id && node) {
        const w = Math.min(node.w ?? 1, this.columns);
        posMap.set(id, {
          x: Math.min(node.x ?? 0, Math.max(0, this.columns - w)),
          y: node.y ?? 0,
          w,
          h: node.h ?? 1,
        });
      }
    }

    // Skip save if nothing actually changed.
    // Auto-height blocks only compare x/y/w — h is always derived from content,
    // so persisting it would corrupt y-positions on next open.
    // Fixed-height blocks persist all four fields.
    // In responsive mode, only h changes matter — x/y/w are transient.
    const changed = this.plugin.activeBlocks().some(b => {
      const pos = posMap.get(b.id);
      if (!pos) return false;
      const isAuto = this.shouldAutoHeight(b);
      if (isResponsive) return !isAuto && b.h !== pos.h;
      if (isAuto) return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w;
      return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w || b.h !== pos.h;
    });
    if (!changed) return;

    const newBlocks = this.plugin.activeBlocks().map(b => {
      const pos = posMap.get(b.id);
      if (!pos) return b;
      const isAuto = this.shouldAutoHeight(b);
      if (isResponsive) {
        // Only persist height for non-auto-height blocks; leave x/y/w canonical.
        return isAuto ? b : { ...b, h: pos.h };
      }
      const update = isAuto
        ? { x: pos.x, y: pos.y, w: pos.w }
        : pos;
      return { ...b, ...update };
    });

    this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
  }

  setEditMode(enabled: boolean, skipRepack = false): void {
    if (!enabled && this.editMode && !skipRepack && this.plugin.layout.compactLayout) {
      // Repack y-positions: compact edit heights create y offsets that
      // would overlap blocks at full view-mode heights.
      const repacked = GridLayout.repackEditLayout(
        this.plugin.activeBlocks(),
        this.userColumns,
        this.plugin.activeLayoutPriority(),
      );
      this.onLayoutChange(this.buildLayoutUpdate(repacked));
    }
    // Set editMode before rerender so setupResponsiveColumns skips
    // responsive remapping while in edit mode (canonical layout preserved).
    this.editMode = enabled;
    if (this.gridStack) {
      this.gridStack.setStatic(!enabled);
    }
    this.rerender();
    if (!enabled) {
      // Exiting edit mode — clear any zoom transform
      this.setZoom(1);
    }
  }

  /**
   * Greedy column-height packing: sort items by position, then assign each
   * the lowest available y in its target columns. Mutates items in place.
   * Works on any object with { x, y, w, h } (GridStackWidget or BlockInstance).
   *
   * @param priority 'row' sorts (y, x) — left-to-right across rows.
   *                 'column' sorts (x, y) — top-to-bottom within each column.
   */
  private static packRows<T extends { x?: number; y?: number; w?: number; h?: number }>(
    items: T[], columns: number, priority: LayoutPriority = 'row',
  ): void {
    const safeCols = Math.max(1, columns);
    if (priority === 'column') {
      items.sort((a, b) =>
        (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0),
      );
    } else {
      items.sort((a, b) =>
        (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
      );
    }
    const colHeights = new Array<number>(safeCols).fill(0);
    for (const item of items) {
      const w = Math.min(item.w ?? 1, safeCols);
      const x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
      let maxH = 0;
      for (let c = x; c < x + w; c++) {
        maxH = Math.max(maxH, colHeights[c] ?? 0);
      }
      item.x = x;
      item.y = maxH;
      for (let c = x; c < x + w; c++) {
        colHeights[c] = maxH + (item.h ?? 1);
      }
    }
  }

  /**
   * After exiting compact edit mode, y-positions saved during editing
   * reflect compact heights and may overlap at full view-mode heights.
   * Re-pack into a collision-free layout using real h values.
   */
  private static repackEditLayout(blocks: BlockInstance[], columns: number, priority: LayoutPriority = 'row'): BlockInstance[] {
    const packed = blocks.map(b => ({ ...b }));
    GridLayout.packRows(packed, columns, priority);
    return packed;
  }

  /** Compute zoom scale that fits all grid content in the viewport. */
  computeFitZoom(): number {
    if (!this.gridEl.isConnected) return 1;
    const viewportHeight = this.gridEl.parentElement?.clientHeight ?? 0;
    const contentHeight = this.gridEl.scrollHeight;
    if (viewportHeight <= 0 || contentHeight <= viewportHeight) return 1;
    const scale = viewportHeight / contentHeight;
    // Clamp to 0.75–1 so auto-fit never zooms out too far; snap to nearest 0.05
    return Math.max(0.75, Math.min(1, Math.round(scale * 20) / 20));
  }

  /** Apply a zoom scale (0.1–1) via CSS transform. */
  setZoom(scale: number): void {
    if (!this.gridEl.isConnected) return;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (scale >= 1) {
      this.gridEl.style.removeProperty('--hp-grid-transform');
      this.gridEl.removeClass('hp-zoomed');
      this.gridEl.removeClass('viewport-fit');
      return;
    }
    this.gridEl.style.setProperty('--hp-grid-transform', `scale(${scale})`);
    this.gridEl.addClass('hp-zoomed');
    this.gridEl.addClass('viewport-fit');
  }

  /** Update column count, clamping each block's w to fit. */
  setColumns(n: number): void {
    const newBlocks = this.plugin.activeBlocks().map(b => ({
      ...b,
      w: Math.min(b.w, n),
    }));
    this.onLayoutChange(this.buildLayoutUpdate(newBlocks, { columns: n }));
    this.rerender();
  }

  /**
   * Compute effective columns from container width and user's desired max.
   * Breakpoints: 480 / 768 / 1024 (column reduction).
   * See also styles.css container queries: 380 / 540 / 768 (CSS adaptation).
   */
  private computeEffective(width: number): number {
    const max = this.userColumns;
    if (width < 480) return 1;
    if (width < 768) return Math.min(2, max);
    if (width < 1024) return Math.min(3, max);
    return max;
  }

  /**
   * Apply a column count change: clamp block widths (keep original proportions,
   * don't scale down), then repack so blocks stack vertically at narrower widths
   * instead of sitting side-by-side with huge height mismatches.
   */
  private applyColumnChange(next: number): void {
    if (!this.gridStack) return;
    this.effectiveColumns = next;

    // Cancel any pending auto-height RAF from a previous column state.
    // Without this, a stale resize batch could fire after a rapid
    // narrow→canonical→narrow oscillation and persist mixed positions.
    if (this.batchRafId !== null) {
      cancelAnimationFrame(this.batchRafId);
      this.pendingRafs.delete(this.batchRafId);
      this.batchRafId = null;
      this.pendingResizes.clear();
    }

    // Single-column mode: switch to CSS flex layout so blocks shrink-wrap
    // their content instead of using GridStack's fixed row heights.
    this.gridEl.classList.toggle('hp-single-column', next === 1);

    // Use 'none' so GridStack doesn't auto-scale widths, then manually
    // clamp each block's w to the new column count and repack.
    this.gridStack.column(next, 'none');

    // When returning to the user's canonical column count, restore saved
    // positions exactly.  The responsive repacking is a lossy transform
    // (multiple source positions map to the same packed output), so we
    // cannot invert it — we must read from the persisted layout instead.
    if (next === this.userColumns) {
      const saved = this.plugin.activeBlocks();
      const lookup = new Map(saved.map(b => [b.id, b]));
      const autoHeightItems: Array<{ gsEl: HTMLElement; b: BlockInstance }> = [];
      this.gridStack.batchUpdate();
      for (const gsEl of this.gridStack.getGridItems()) {
        const id = gsEl.getAttribute('gs-id');
        const b = id ? lookup.get(id) : undefined;
        if (!b) continue;
        const isAuto = this.shouldAutoHeight(b);
        this.gridStack.update(gsEl as HTMLElement, {
          x: b.x, y: b.y, w: Math.min(b.w, next),
          ...(isAuto ? {} : { h: b.h }),
          maxW: next,
        });
        if (isAuto) autoHeightItems.push({ gsEl: gsEl as HTMLElement, b });
      }
      this.gridStack.batchUpdate(false);
      for (const { gsEl, b } of autoHeightItems) this.scheduleResize(gsEl, b);
      return;
    }

    // Collect current nodes, clamp widths, and pack rows ourselves
    // (GridStack's compact() is unreliable with float:true / static grids).
    const nodeItems: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const gsEl of this.gridStack.getGridItems()) {
      const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      if (!node) continue;
      const w = Math.min(node.w ?? 1, next);
      const x = Math.min(node.x ?? 0, Math.max(0, next - w));
      nodeItems.push({ el: gsEl as HTMLElement, x, y: node.y ?? 0, w, h: node.h ?? 1 });
    }
    GridLayout.packRows(nodeItems, next, this.plugin.activeLayoutPriority());

    this.gridStack.batchUpdate();
    for (const item of nodeItems) {
      this.gridStack.update(item.el, { w: item.w, x: item.x, y: item.y, maxW: next });
    }
    this.gridStack.batchUpdate(false);

    // In single-column flex mode, DOM order determines visual order.
    // Reorder DOM elements by packed position using the user's priority.
    if (next === 1) {
      const priority = this.plugin.activeLayoutPriority();
      const sorted = nodeItems.slice().sort((a, b) =>
        priority === 'column'
          ? (a.x - b.x || a.y - b.y)
          : (a.y - b.y || a.x - b.x),
      );
      for (const item of sorted) {
        this.gridEl.appendChild(item.el);
      }
    }
  }

  /**
   * Observe container width and dynamically adjust GridStack column count.
   * The user's saved column count (`this.userColumns`) acts as the desired maximum.
   * The observer persists across rerenders — only created once, disconnected in destroy().
   */
  private setupResponsiveColumns(viewEl: HTMLElement | null, userCols: number): void {
    this.userColumns = userCols;

    if (!viewEl) return;

    // Only create the observer once — it survives destroyAll/rerender cycles
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.isDestroyed || !this.gridStack) return;
        if (this.editMode) return; // Don't remap while editing — preserve canonical layout
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        const next = this.computeEffective(width);
        if (next !== this.effectiveColumns) {
          this.applyColumnChange(next);
        }
      });
      this.resizeObserver.observe(viewEl);
    }

    // Set initial value synchronously (also handles userCols changes).
    // Skip remapping while in edit mode — canonical layout must be preserved.
    this.effectiveColumns = this.computeEffective(viewEl.clientWidth);
    if (this.effectiveColumns !== userCols && this.gridStack && !this.editMode) {
      this.applyColumnChange(this.effectiveColumns);
    }
  }

  addBlock(instance: BlockInstance): void {
    const maxY = this.plugin.activeBlocks().reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const positioned = { ...instance, y: maxY };
    const newBlocks = [...this.plugin.activeBlocks(), positioned];
    this.lastAddedBlockId = positioned.id;
    this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
    this.rerender();
  }

  private rerender(): void {
    this.render(this.plugin.activeBlocks(), this.plugin.activeColumns());
  }

  /** Unload all blocks and destroy GridStack instance. */
  destroyAll(): void {
    this.isDestroyed = true;
    if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; }
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    if (this.batchRafId !== null) { cancelAnimationFrame(this.batchRafId); this.batchRafId = null; }
    for (const id of this.pendingRafs) cancelAnimationFrame(id);
    this.pendingRafs.clear();
    this.pendingResizes.clear();
    for (const { block } of this.blocks.values()) {
      block?.unload();
    }
    this.blocks.clear();

    if (this.gridStack) {
      this.gridStack.removeAll(false);
      this.gridStack.destroy(false);
      this.gridStack = null;
    }
    this.gridEl.empty();
    // Clear inline styles GridStack or setZoom may have set.
    this.gridEl.removeClass('viewport-fit');
    this.gridEl.style.removeProperty('--hp-grid-transform');
    this.gridEl.removeClass('hp-zoomed');
  }

  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyAll();
    this.gridEl.remove();
  }
}

// ── Block settings modal (title section + block-specific settings) ────────────

class BlockSettingsModal extends Modal {
  constructor(
    app: App,
    private instance: BlockInstance,
    private block: BaseBlock,
    private onSave: (config: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  /** Create a collapsible section and return its body container. */
  private createSection(parent: HTMLElement, title: string, desc?: string): HTMLElement {
    const header = parent.createDiv({ cls: 'settings-collapsible-header' });
    header.createSpan({ cls: 'settings-collapsible-chevron' });
    header.createSpan({ text: title });
    if (desc) header.createSpan({ cls: 'settings-collapsible-desc', text: ` — ${desc}` });
    const body = parent.createDiv({ cls: 'settings-collapsible-body is-collapsed' });
    header.addEventListener('click', () => {
      const collapsed = body.hasClass('is-collapsed');
      body.toggleClass('is-collapsed', !collapsed);
      header.toggleClass('is-open', collapsed);
    });
    return body;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Block settings').setHeading();

    const draft = structuredClone(this.instance.config);
    const factory = BlockRegistry.get(this.instance.type);
    const defaultTitle = factory?.displayName ?? this.instance.type;

    // ── Live card preview ──────────────────────────────────────────────────
    const previewCard = contentEl.createDiv({ cls: 'settings-preview-card homepage-block-wrapper' });
    const previewHeaderZone = previewCard.createDiv({ cls: 'block-header-zone' });
    const previewHeader = previewHeaderZone.createDiv({ cls: 'block-header' });
    const previewEmoji = previewHeader.createSpan({ cls: 'block-header-emoji' });
    const previewTitle = previewHeader.createSpan();
    const previewDivider = previewCard.createDiv({ cls: 'block-header-divider' });
    const previewBody = previewCard.createDiv({ cls: 'settings-preview-body' });
    previewBody.createSpan({ cls: 'settings-preview-body-text', text: 'Block content area' });

    let accentDirty = !!(typeof draft._accentColor === 'string' && draft._accentColor);
    const hasGradStart = typeof draft._gradientStart === 'string' && HEX_COLOR_RE.test(draft._gradientStart);
    const hasGradEnd = typeof draft._gradientEnd === 'string' && HEX_COLOR_RE.test(draft._gradientEnd);
    let gradDirty = hasGradStart && hasGradEnd;

    const refreshPreview = () => {
      const label = (typeof draft._titleLabel === 'string' && draft._titleLabel) || defaultTitle;
      const emoji = typeof draft._titleEmoji === 'string' ? draft._titleEmoji : '';
      previewEmoji.setText(emoji);
      previewEmoji.toggleClass('hp-hidden', !emoji);
      previewTitle.setText(label);
      previewHeader.className = 'block-header';
      const sz = typeof draft._titleSize === 'string' && /^h[1-6]$/.test(draft._titleSize) ? draft._titleSize : '';
      if (sz) previewHeader.addClass(`block-header-${sz}`);
      previewHeaderZone.toggleClass('hp-hidden', draft._hideTitle === true);
      previewDivider.toggleClass('hp-hidden', draft._showDivider !== true);
      applyBlockStyling(previewCard, draft);
    };
    refreshPreview();

    // ── Configure block CTA ────────────────────────────────────────────────
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText(`Configure ${defaultTitle}...`).setCta().onClick(() => {
          this.close();
          this.block.openSettings((blockConfig) => {
            const shared = Object.fromEntries(
              Object.entries(draft).filter(([k]) => k.startsWith('_')),
            );
            this.onSave({ ...blockConfig, ...shared });
          });
        }),
      );

    // ── Title & Header (collapsible) ───────────────────────────────────────
    const titleBody = this.createSection(contentEl, 'Title & header', 'Label, emoji, size, divider');

    new Setting(titleBody)
      .setName('Title label')
      .setDesc('Leave blank for the default.')
      .addText(t =>
        t.setValue(typeof draft._titleLabel === 'string' ? draft._titleLabel : '')
         .setPlaceholder('Default title')
         .onChange(v => { draft._titleLabel = v; refreshPreview(); }),
      );

    createEmojiPicker({
      container: titleBody,
      label: 'Title emoji',
      value: typeof draft._titleEmoji === 'string' ? draft._titleEmoji : '',
      placeholder: '＋',
      onSelect: (emoji) => { draft._titleEmoji = emoji; refreshPreview(); },
      onClear: () => { draft._titleEmoji = ''; refreshPreview(); },
    });

    new Setting(titleBody)
      .setName('Hide title')
      .addToggle(t =>
        t.setValue(draft._hideTitle === true)
         .onChange(v => { draft._hideTitle = v; refreshPreview(); }),
      );

    new Setting(titleBody)
      .setName('Title size')
      .addDropdown(d =>
        d.addOption('', 'Default')
         .addOption('h1', 'H1').addOption('h2', 'H2').addOption('h3', 'H3')
         .addOption('h4', 'H4').addOption('h5', 'H5').addOption('h6', 'H6')
         .setValue(typeof draft._titleSize === 'string' ? draft._titleSize : '')
         .onChange(v => { draft._titleSize = /^h[1-6]$/.test(v) ? v : ''; refreshPreview(); }),
      );

    new Setting(titleBody)
      .setName('Show divider after title')
      .setDesc('Show a thin line between the title and content.')
      .addToggle(t =>
        t.setValue(draft._showDivider === true)
         .onChange(v => { draft._showDivider = v; refreshPreview(); }),
      );

    new Setting(titleBody)
      .setName('Title gap')
      .setDesc('Gap between title and content in pixels (0 = default).')
      .addSlider(s =>
        s.setLimits(0, 48, 2)
         .setValue(typeof draft._titleGap === 'number' ? draft._titleGap : 0)
         .setDynamicTooltip()
         .onChange(v => { draft._titleGap = v; refreshPreview(); }),
      );

    // ── Card Appearance (collapsible) ──────────────────────────────────────
    const cardBody = this.createSection(contentEl, 'Card appearance', 'Colors, borders, padding');

    let cpRef: ColorComponent | null = null;

    const accentRow = new Setting(cardBody)
      .setName('Accent color')
      .setDesc('Tints the card header, background, and border.');

    const currentColor = typeof draft._accentColor === 'string' ? draft._accentColor : '';

    accentRow.addColorPicker(cp => {
      cpRef = cp;
      cp.setValue(currentColor || '#888888')
        .onChange(v => { draft._accentColor = v; accentDirty = true; refreshPreview(); });
    });

    accentRow.addExtraButton(btn =>
      btn.setIcon('x').setTooltip('Clear accent color').onClick(() => {
        draft._accentColor = '';
        accentDirty = false;
        cpRef?.setValue('#888888');
        refreshPreview();
      }),
    );

    const swatchRow = cardBody.createDiv({ cls: 'accent-preset-row' });
    for (const hex of ACCENT_PRESETS) {
      const swatch = swatchRow.createDiv({ cls: 'accent-preset-swatch' });
      swatch.style.setProperty('--hp-swatch-bg', hex);
      swatch.setAttribute('aria-label', hex);
      swatch.addEventListener('click', () => {
        draft._accentColor = hex;
        accentDirty = true;
        cpRef?.setValue(hex);
        refreshPreview();
      });
    }

    new Setting(cardBody)
      .setName('Accent intensity')
      .setDesc('Strength of the accent tint on the card background (5–100%).')
      .addSlider(s => {
        s.setLimits(5, 100, 5)
         .setValue(typeof draft._accentIntensity === 'number' ? draft._accentIntensity : 15)
         .setDynamicTooltip()
         .onChange(v => { draft._accentIntensity = v; refreshPreview(); });
        // Live preview while dragging — sliderEl is Obsidian's public API
        s.sliderEl.addEventListener('input', () => {
          draft._accentIntensity = s.getValue();
          refreshPreview();
        });
      });

    new Setting(cardBody)
      .setName('Hide border')
      .setDesc('Remove the border and hover highlight.')
      .addToggle(t =>
        t.setValue(draft._hideBorder === true)
         .onChange(v => { draft._hideBorder = v; refreshPreview(); }),
      );

    new Setting(cardBody)
      .setName('Hide background')
      .setDesc('Remove the card background so the block blends into the page.')
      .addToggle(t =>
        t.setValue(draft._hideBackground === true)
         .onChange(v => { draft._hideBackground = v; refreshPreview(); }),
      );

    new Setting(cardBody)
      .setName('Hide header background')
      .setDesc('Remove the colored header bar but keep the border and background tint.')
      .addToggle(t =>
        t.setValue(draft._hideHeaderAccent === true)
         .onChange(v => { draft._hideHeaderAccent = v; refreshPreview(); }),
      );

    new Setting(cardBody)
      .setName('Card padding')
      .setDesc('Inner padding in pixels (0 = default). Negative values allowed.')
      .addSlider(s =>
        s.setLimits(-48, 48, 4)
         .setValue(typeof draft._cardPadding === 'number' ? draft._cardPadding : 0)
         .setDynamicTooltip()
         .onChange(v => { draft._cardPadding = v; refreshPreview(); }),
      );

    // ── Advanced Styling (collapsible) ─────────────────────────────────────
    const advancedBody = this.createSection(contentEl, 'Advanced styling', 'Shadow, blur, gradients');

    new Setting(advancedBody)
      .setName('Shadow / elevation')
      .setDesc('Card shadow depth (0 = none).')
      .addDropdown(d =>
        d.addOption('0', 'None')
         .addOption('1', 'Subtle')
         .addOption('2', 'Medium')
         .addOption('3', 'Elevated')
         .setValue(String(typeof draft._elevation === 'number' ? draft._elevation : 0))
         .onChange(v => { draft._elevation = Number(v); refreshPreview(); }),
      );

    new Setting(advancedBody)
      .setName('Border radius')
      .setDesc('Corner rounding in pixels (0 = theme default).')
      .addSlider(s =>
        s.setLimits(0, 24, 2)
         .setValue(typeof draft._borderRadius === 'number' ? draft._borderRadius : 0)
         .setDynamicTooltip()
         .onChange(v => { draft._borderRadius = v; refreshPreview(); }),
      );

    new Setting(advancedBody)
      .setName('Background opacity')
      .setDesc('Background transparency (100 = fully opaque).')
      .addSlider(s =>
        s.setLimits(0, 100, 5)
         .setValue(typeof draft._bgOpacity === 'number' ? draft._bgOpacity : 100)
         .setDynamicTooltip()
         .onChange(v => { draft._bgOpacity = v; refreshPreview(); }),
      );

    new Setting(advancedBody)
      .setName('Backdrop blur')
      .setDesc('Blur behind the card (only visible when opacity < 100).')
      .addSlider(s =>
        s.setLimits(0, 20, 1)
         .setValue(typeof draft._backdropBlur === 'number' ? draft._backdropBlur : 0)
         .setDynamicTooltip()
         .onChange(v => { draft._backdropBlur = v; refreshPreview(); }),
      );

    new Setting(advancedBody)
      .setName('Border width')
      .setDesc('Border thickness in pixels (0 = default).')
      .addSlider(s =>
        s.setLimits(0, 4, 1)
         .setValue(typeof draft._borderWidth === 'number' ? draft._borderWidth : 0)
         .setDynamicTooltip()
         .onChange(v => { draft._borderWidth = v; refreshPreview(); }),
      );

    new Setting(advancedBody)
      .setName('Border style')
      .addDropdown(d =>
        d.addOption('', 'Default')
         .addOption('solid', 'Solid')
         .addOption('dashed', 'Dashed')
         .addOption('dotted', 'Dotted')
         .setValue(typeof draft._borderStyle === 'string' ? draft._borderStyle : '')
         .onChange(v => { draft._borderStyle = v; refreshPreview(); }),
      );

    const gradientNote = advancedBody.createEl('p', {
      text: 'Background gradient (overrides background color when both colors are set):',
      cls: 'setting-item-name',
    });
    gradientNote.addClass('hp-gradient-note');

    let gradStartRef: ColorComponent | null = null;
    let gradEndRef: ColorComponent | null = null;

    const gradStartRow = new Setting(advancedBody).setName('Gradient start');
    gradStartRow.addColorPicker(cp => {
      gradStartRef = cp;
      cp.setValue(typeof draft._gradientStart === 'string' ? draft._gradientStart : '#667eea')
        .onChange(v => { draft._gradientStart = v; gradDirty = true; refreshPreview(); });
    });

    const gradEndRow = new Setting(advancedBody).setName('Gradient end');
    gradEndRow.addColorPicker(cp => {
      gradEndRef = cp;
      cp.setValue(typeof draft._gradientEnd === 'string' ? draft._gradientEnd : '#764ba2')
        .onChange(v => { draft._gradientEnd = v; gradDirty = true; refreshPreview(); });
    });

    new Setting(advancedBody)
      .setName('Gradient angle')
      .addSlider(s =>
        s.setLimits(0, 360, 15)
         .setValue(typeof draft._gradientAngle === 'number' ? draft._gradientAngle : 135)
         .setDynamicTooltip()
         .onChange(v => { draft._gradientAngle = v; refreshPreview(); }),
      );

    new Setting(advancedBody)
      .addButton(btn =>
        btn.setButtonText('Clear gradient').onClick(() => {
          draft._gradientStart = '';
          draft._gradientEnd = '';
          gradDirty = false;
          gradStartRef?.setValue('#667eea');
          gradEndRef?.setValue('#764ba2');
          refreshPreview();
        }),
      );

    // ── Save / Cancel ──────────────────────────────────────────────────────
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => {
          if (!accentDirty) draft._accentColor = '';
          if (!gradDirty) { draft._gradientStart = ''; draft._gradientEnd = ''; }
          this.onSave(draft);
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}

// ── Remove confirmation modal ────────────────────────────────────────────────

class RemoveBlockConfirmModal extends Modal {
  constructor(app: App, private onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Remove block?').setHeading();
    contentEl.createEl('p', { text: 'This will remove the block from your homepage.' });
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Remove').setWarning().onClick(() => {
          this.onConfirm();
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
