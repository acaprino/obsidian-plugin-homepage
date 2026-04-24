import { App, setIcon } from 'obsidian';
import { GridStack, GridStackWidget, GridStackNode } from 'gridstack';
import { BlockInstance, LayoutConfig, LayoutPriority, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';
import { applyBlockStyling } from './utils/blockStyling';
import { newId } from './utils/ids';
import { Scheduler } from './utils/Scheduler';
import { Phase } from './grid/phase';
import { AutoHeightManager } from './grid/AutoHeight';
import { ResponsiveColumnsManager } from './grid/ResponsiveColumns';
import { BlockSettingsModal } from './modals/BlockSettingsModal';
import { RemoveBlockConfirmModal } from './modals/RemoveBlockConfirmModal';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

/** Compact grid-row height for edit-mode placeholders (cellHeight = 80px). */
const COMPACT_EDIT_H = 2;

/** Sentinel y-coordinate passed to GridLayout.addBlock to mean "place below every existing block". */
export const APPEND_AT_BOTTOM = 1000;

export class GridLayout {
  // NOTE: several fields below are intentionally non-private (package-visible). AutoHeightManager
  // and ResponsiveColumnsManager access them through their narrow Host interfaces (declared in
  // grid/AutoHeight.ts and grid/ResponsiveColumns.ts) which this class structurally satisfies.
  /** The grid DOM element owned by this layout. Used by ResponsiveColumnsManager for flex reordering. */
  gridEl: HTMLElement;
  gridStack: GridStack | null = null;
  private blocks = new Map<string, { block: BaseBlock | null; wrapper: HTMLElement }>();
  readonly scheduler = new Scheduler();
  editMode = false;
  effectiveColumns: number;
  canonicalColumns = 3;
  phase: Phase = Phase.Destroyed;
  /** Callback to trigger the Add Block modal from the empty state CTA. */
  onRequestAddBlock: (() => void) | null = null;
  /** ID of the most recently added block — used for scroll-into-view. */
  private lastAddedBlockId: string | null = null;

  private autoHeight: AutoHeightManager;
  private responsiveColumns: ResponsiveColumnsManager;

  // ── Public API ─────────────────────────────────────────────────────────

  constructor(
    containerEl: HTMLElement,
    private app: App,
    readonly plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid grid-stack' });
    this.effectiveColumns = plugin.layout.columns;
    this.autoHeight = new AutoHeightManager(this);
    this.responsiveColumns = new ResponsiveColumnsManager(this);
  }

  /**
   * Clear any queued auto-height measurements. Called by ResponsiveColumnsManager
   * before a column change so stale measurements against the old column count are discarded.
   */
  clearPendingResizes(): void {
    this.autoHeight.clearPending();
  }

  /** Enqueue a block for auto-height measurement in the next animation frame. */
  requestAutoHeight(gsEl: HTMLElement, instance: BlockInstance): void {
    this.autoHeight.request(gsEl, instance);
  }

  /** Expose packRows as an instance method so ResponsiveColumnsManager can call it. */
  packRows(
    items: { el?: HTMLElement; x?: number; y?: number; w?: number; h?: number }[],
    columns: number,
    priority: LayoutPriority,
    reflow: boolean,
  ): void {
    GridLayout.packRows(items, columns, priority, reflow);
  }

  /** Determine if a block should auto-expand beyond its grid cell height. */
  shouldAutoHeight(instance: BlockInstance): boolean {
    const factory = BlockRegistry.get(instance.type);
    if (!factory?.autoHeight) return false;
    const hm = instance.config.heightMode;
    const heightMode = typeof hm === 'string' ? hm : '';
    // Per-type opt-out: some auto-height blocks have a 'fixed'/'wrap'/'scroll' mode that disables it.
    if (instance.type === 'image-gallery') return heightMode !== 'fixed';
    if (instance.type === 'quotes-list') return heightMode !== 'wrap';
    if (instance.type === 'static-text') return heightMode !== 'fixed';
    if (instance.type === 'embedded-note') return heightMode === 'grow';
    return true;
  }

  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement(): HTMLElement {
    return this.gridEl;
  }

  render(blocks: BlockInstance[], columns: number, isInitial = false): void {
    this.teardown();
    this.phase = Phase.Ready;

    this.gridEl.setAttribute('role', 'list');
    this.gridEl.setAttribute('aria-label', 'Homepage blocks');

    if (isInitial) {
      this.gridEl.addClass('homepage-grid--animating');
      this.scheduler.timeout('anim', 500, () => {
        this.gridEl.removeClass('homepage-grid--animating');
      });
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

  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy(): void {
    this.responsiveColumns.destroy();
    this.teardown();
    this.gridEl.remove();
  }

  setEditMode(enabled: boolean, skipRepack = false): void {
    if (!enabled && this.editMode && !skipRepack) {
      // Repack y-positions: compact edit heights create y offsets that
      // would overlap blocks at full view-mode heights.
      const repacked = GridLayout.repackEditLayout(
        this.plugin.activeBlocks(),
        this.canonicalColumns,
        this.plugin.activeLayoutPriority(),
      );
      this.onLayoutChange(this.buildLayoutUpdate(repacked));
    }
    // Set editMode before rerender so setupResponsiveColumns skips
    // responsive remapping while in edit mode (canonical layout preserved).
    this.editMode = enabled;
    if (enabled) {
      // Force canonical columns so isResponsive is false and drag/resize
      // changes in edit mode are fully persisted (not treated as responsive).
      this.effectiveColumns = this.canonicalColumns;
    }
    if (this.gridStack) {
      this.gridStack.setStatic(!enabled);
    }
    this.rerender();
    if (!enabled) {
      // Exiting edit mode — clear any zoom transform
      this.setZoom(1);
    }
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

  addBlock(instance: BlockInstance): void {
    const maxY = this.plugin.activeBlocks().reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const positioned = { ...instance, y: maxY };
    const newBlocks = [...this.plugin.activeBlocks(), positioned];
    this.lastAddedBlockId = positioned.id;
    this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
    this.rerender();
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private rerender(): void {
    this.render(this.plugin.activeBlocks(), this.plugin.activeColumns());
  }

  /** Unload all blocks and destroy GridStack instance. */
  private teardown(): void {
    // Flush any pending debounced persist before we cancel timers, so a drag
    // followed immediately by a tab close doesn't silently drop the write.
    if (this.scheduler.hasTimeout('sync')) {
      this.scheduler.cancelTimeout('sync');
      try { this.persistLayout(); } catch { /* non-fatal */ }
    }
    this.phase = Phase.Destroyed;
    this.scheduler.cancelAll();
    this.autoHeight.clearPending();
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

  private initGridStack(blocks: BlockInstance[], columns: number, isInitial: boolean): void {
    // Suppress dragstop/resizestop sync until init settles.
    // GridStack may auto-adjust blocks during load() when the viewport
    // is narrower than the logical column count, firing spurious events
    // that would corrupt the persisted canonical layout.
    this.phase = Phase.Initializing;

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
    // Edit mode: ALWAYS pack — compact heights (COMPACT_EDIT_H) make saved
    // view-mode y positions incorrect, leaving large visual gaps.
    // View mode: pack only when compactLayout is on to preserve intentional gaps.
    if (this.editMode || this.plugin.layout.compactLayout) {
      GridLayout.packRows(items, columns, this.plugin.activeLayoutPriority());
    }

    this.effectiveColumns = columns;
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
            this.requestAutoHeight(gsEl, instance);
          });
        }
        // Skeleton overlay: show shimmer placeholder during initial load
        const skeletonEl = isInitial ? this.createSkeleton(wrapper) : null;
        const result = block.render(contentEl);
        if (result instanceof Promise) {
          // After async render, wait one frame for the browser to lay out the new DOM,
          // then measure and resize the block to its natural content height.
          result
            .then(() => {
              this.removeSkeleton(skeletonEl);
              if (needsResize) this.requestAutoHeight(gsEl, instance);
            })
            .catch(e => {
              this.removeSkeleton(skeletonEl);
              console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
              contentEl.setText('Error rendering block. Check console for details.');
            });
        } else {
          // Sync render completed — skeleton was never painted, just remove it
          skeletonEl?.remove();
          if (needsResize) this.requestAutoHeight(gsEl, instance);
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
      const gridItems = [...this.gridEl.querySelectorAll<HTMLElement>(':scope > .grid-stack-item')];
      gridItems.sort((a, b) => {
        const na = (a as HTMLElement & { gridstackNode?: { x?: number; y?: number } }).gridstackNode;
        const nb = (b as HTMLElement & { gridstackNode?: { x?: number; y?: number } }).gridstackNode;
        return ((na?.y ?? 0) - (nb?.y ?? 0)) || ((na?.x ?? 0) - (nb?.x ?? 0));
      });
      for (const el of gridItems) {
        this.gridEl.appendChild(el);
      }
    }

    // GridStack already compensates for CSS transform via getValuesFromTransformedElement
    // (dragTransform.xScale/yScale), so we do NOT need to clear the viewport-fit scale.
    this.gridStack.on('dragstop', () => {
      if (this.phase !== Phase.Ready) return;
      this.persistLayout();
    });

    this.gridStack.on('resizestop', () => {
      if (this.phase !== Phase.Ready) return;
      this.persistLayout();
      this.updateCompactSizeLabels();
    });

    const viewEl = this.gridEl.closest('.homepage-view');
    this.responsiveColumns.setup(viewEl instanceof HTMLElement ? viewEl : null, columns);

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

    // Allow GridStack auto-adjustment events to settle before enabling
    // sync.  Events fire asynchronously after load(), so a rAF is enough.
    // Tracked via scheduler so teardown cancels it — prevents a stale
    // rAF from a prior init setting Phase.Ready on a newly created grid.
    this.scheduler.raf('initSettle', () => {
      if (this.phase === Phase.Destroyed) return;
      this.phase = Phase.Ready;
    });
  }

  /** Build the block wrapper DOM inside a GridStack item content div using Obsidian's DOM API. */
  private buildBlockWrapper(container: HTMLElement, instance: BlockInstance, animDelayMs?: number): HTMLElement {
    const classes = ['homepage-block-wrapper'];
    // Don't collapse blocks with hidden titles — there's no visible header
    // to click for re-expansion, making them appear completely invisible.
    const effectiveCollapsed = instance.collapsed && instance.config._showTitle !== false;
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

  /** Create a shimmer skeleton overlay inside the block wrapper for perceived loading speed. */
  private createSkeleton(wrapper: HTMLElement): HTMLElement {
    const overlay = wrapper.createDiv({ cls: 'hp-skeleton-overlay' });
    overlay.createDiv({ cls: 'hp-skeleton-line' });
    overlay.createDiv({ cls: 'hp-skeleton-line' });
    overlay.createDiv({ cls: 'hp-skeleton-line' });
    return overlay;
  }

  /** Fade out and remove a skeleton overlay. */
  private removeSkeleton(el: HTMLElement | null): void {
    if (!el?.isConnected) return;
    el.classList.add('hp-skeleton-overlay--out');
    // Short-lived timer; cleanup binds to GridLayout's scheduler so a teardown
    // mid-fade doesn't leak a pending el.remove() on a detached node.
    const token = `skeleton-${Math.random()}`;
    this.scheduler.timeout(token, 200, () => el.remove());
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

  // ── Layout Persistence ─────────────────────────────────────────────────

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

  private persistLayout(): void {
    if (!this.gridStack || this.phase !== Phase.Ready) return;

    // When responsive columns are active (effectiveColumns < canonicalColumns),
    // GridStack nodes hold transient positions adapted for the narrow viewport.
    // Persisting x/y/w from the responsive layout would destroy the canonical
    // (desktop) layout.  Only persist height changes in this case.
    // Note: dragstop/resizestop callers are gated by staticGrid (only active in
    // edit mode), so isResponsive is always false for manual user interactions.
    // Responsive guard: when effective columns differ from canonical,
    // only persist h (not x/y/w) to avoid overwriting the canonical layout.
    // This applies in view mode AND edit mode — in edit mode at a narrow
    // viewport, the 5-column grid is squeezed and positions are distorted.

    // Fast path: when every block is auto-height and we are in responsive mode,
    // there is nothing to persist — skip the GridStack DOM traversal entirely.
    if (this.isResponsive && this.plugin.activeBlocks().every(b => this.shouldAutoHeight(b))) {
      return;
    }

    const nodes = this.gridStack.getGridItems();
    const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (const el of nodes) {
      const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      const id = el.getAttribute('gs-id');
      if (id && node) {
        const w = Math.min(node.w ?? 1, this.effectiveColumns);
        posMap.set(id, {
          x: Math.min(node.x ?? 0, Math.max(0, this.effectiveColumns - w)),
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
      if (this.isResponsive) return !isAuto && b.h !== pos.h;
      if (isAuto) return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w;
      return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w || b.h !== pos.h;
    });
    if (!changed) {
      return;
    }

    const newBlocks = this.plugin.activeBlocks().map(b => {
      const pos = posMap.get(b.id);
      if (!pos) return b;
      const isAuto = this.shouldAutoHeight(b);
      if (this.isResponsive) {
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

  /** Read current positions from GridStack nodes and persist to layout. */
  /** Debounced persistLayout — coalesces rapid auto-height resize saves into one write. */
  persistLayoutDebounced(): void {
    this.scheduler.timeout('sync', 50, () => {
      if (this.phase !== Phase.Destroyed) this.persistLayout();
    });
  }

  /** True when the grid is showing a responsive (narrowed) layout — persistence should be restricted. */
  private get isResponsive(): boolean {
    return this.effectiveColumns !== this.canonicalColumns;
  }

  // ── Layout Utilities ───────────────────────────────────────────────────

  /**
   * Row-group-aware packing: items sharing the same y form a "row group" and
   * stay on the same row in the output, preserving visual row grouping.
   * Mutates items in place.  Works on any object with { x, y, w, h }.
   *
   * When `reflow=true` (responsive column change), falls back to greedy
   * column-height packing: each item is assigned the x with the lowest max
   * height.  Row groups don't apply because old x positions are meaningless
   * after a column count change.
   *
   * @param priority Reserved for future use; grouping is always by y.
   */
  private static packRows<T extends { x?: number; y?: number; w?: number; h?: number }>(
    items: T[], columns: number, _priority: LayoutPriority = 'row', reflow = false,
  ): void {
    const safeCols = Math.max(1, columns);
    const colHeights = new Array<number>(safeCols).fill(0);

    if (reflow) {
      // Greedy best-fit placement for responsive column changes
      items.sort((a, b) =>
        (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
      );
      for (const item of items) {
        const w = Math.min(item.w ?? 1, safeCols);
        let x = 0;
        let bestY = Infinity;
        for (let cx = 0; cx <= safeCols - w; cx++) {
          let maxH = 0;
          for (let c = cx; c < cx + w; c++) {
            maxH = Math.max(maxH, colHeights[c] ?? 0);
          }
          if (maxH < bestY) { bestY = maxH; x = cx; }
        }
        item.x = x;
        item.w = w;
        item.y = bestY;
        for (let c = x; c < x + w; c++) {
          colHeights[c] = bestY + (item.h ?? 1);
        }
      }
      return;
    }

    // Row-group-aware packing: group items by their input y, preserving
    // the visual row layout.  Blocks that shared a row in the input stay
    // together in the output, preventing greedy reordering.
    const groupMap = new Map<number, T[]>();
    for (const item of items) {
      const y = item.y ?? 0;
      let g = groupMap.get(y);
      if (!g) { g = []; groupMap.set(y, g); }
      g.push(item);
    }

    // Process groups by ascending input y; sort within group by x for
    // left-to-right placement.
    const groups = [...groupMap.values()];
    groups.sort((a, b) => (a[0].y ?? 0) - (b[0].y ?? 0));
    for (const g of groups) g.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

    for (const group of groups) {
      // Find the earliest y where all blocks in this group fit (no overlap)
      let rowY = 0;
      for (const item of group) {
        const w = Math.min(item.w ?? 1, safeCols);
        const x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
        for (let c = x; c < x + w; c++) {
          rowY = Math.max(rowY, colHeights[c] ?? 0);
        }
      }

      // Place all items in the group at rowY, clamp x and w
      for (const item of group) {
        const w = Math.min(item.w ?? 1, safeCols);
        item.w = w;
        item.x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
        item.y = rowY;
      }

      // Advance column heights (Math.max handles overlapping spans safely)
      for (const item of group) {
        const x = item.x ?? 0;
        const w = item.w ?? 1;
        const h = item.h ?? 1;
        for (let c = x; c < x + w; c++) {
          colHeights[c] = Math.max(colHeights[c] ?? 0, rowY + h);
        }
      }
    }
  }

  /**
   * After exiting edit mode, y-positions saved during editing reflect
   * compact heights (COMPACT_EDIT_H) and may overlap at full view-mode
   * heights.  Re-pack into a collision-free layout using real h values.
   * Delegates to the row-group-aware packRows, which preserves visual
   * row grouping from edit mode.
   */
  private static repackEditLayout(blocks: BlockInstance[], columns: number, priority: LayoutPriority = 'row'): BlockInstance[] {
    const packed = blocks.map(b => ({ ...b }));
    GridLayout.packRows(packed, columns, priority);
    return packed;
  }

  /** Repack all GridStack nodes so blocks shift up to fill vertical gaps. */
  repackGridNodes(): void {
    if (!this.gridStack) return;
    const nodeItems: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const gsEl of this.gridStack.getGridItems()) {
      const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      if (!node) continue;
      nodeItems.push({ el: gsEl as HTMLElement, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
    }
    GridLayout.packRows(nodeItems, this.effectiveColumns, this.plugin.activeLayoutPriority());
    this.gridStack.batchUpdate();
    for (const item of nodeItems) {
      this.gridStack.update(item.el, { y: item.y });
    }
    this.gridStack.batchUpdate(false);
  }

  // ── Block Interactions ─────────────────────────────────────────────────

  private setupCollapseToggle(gsEl: HTMLElement, instance: BlockInstance, headerZone: HTMLElement): void {
    const wrapper = gsEl.querySelector('.homepage-block-wrapper') as HTMLElement;
    const chevron = headerZone.querySelector<HTMLElement>('.block-collapse-chevron');
    if (!wrapper) return;

    const toggleCollapse = (e: Event) => {
      e.stopPropagation();
      if (this.editMode) return;
      const isNowCollapsed = !wrapper.hasClass('block-collapsed');
      wrapper.toggleClass('block-collapsed', isNowCollapsed);
      chevron?.toggleClass('is-collapsed', isNowCollapsed);
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
        id: newId(),
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
}
