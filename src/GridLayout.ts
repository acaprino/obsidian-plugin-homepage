import { App } from 'obsidian';
import { GridStack, GridStackWidget, GridStackNode } from 'gridstack';
import { BlockInstance, LayoutConfig, LayoutPriority, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';
import { Scheduler } from './utils/Scheduler';
import { Phase } from './grid/phase';
import { AutoHeightManager } from './grid/AutoHeight';
import { ResponsiveColumnsManager } from './grid/ResponsiveColumns';
import { LayoutPersister } from './grid/LayoutPersister';
import { attachCollapseToggle } from './grid/CollapseToggle';
import { attachEditHandleBar } from './grid/EditHandleBar';
import { packRows, repackEditLayout } from './grid/packing';
import { buildBlockWrapper, createSkeleton, removeSkeleton, renderCompactPlaceholder, renderEmptyState } from './grid/BlockWrapper';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

/** Compact grid-row height for edit-mode placeholders (cellHeight = 80px). */
const COMPACT_EDIT_H = 2;

export class GridLayout {
  // NOTE: several fields below are intentionally non-private (package-visible). AutoHeightManager
  // and ResponsiveColumnsManager access them through their narrow Host interfaces (declared in
  // grid/AutoHeight.ts and grid/ResponsiveColumns.ts) which this class structurally satisfies.
  /** The grid DOM element owned by this layout. Used by ResponsiveColumnsManager for flex reordering. */
  gridEl: HTMLElement;
  gridStack: GridStack | null = null;
  // Package-visible to satisfy EditHandleBarHost without leaking ownership;
  // the host interface declares the same Map shape and only the EditHandleBar
  // touches it externally.
  blocks = new Map<string, { block: BaseBlock | null; wrapper: HTMLElement }>();
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
  private persister: LayoutPersister;

  // ── Public API ─────────────────────────────────────────────────────────

  constructor(
    containerEl: HTMLElement,
    readonly app: App,
    readonly plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid grid-stack' });
    // Read via the platform-aware accessor instead of plugin.layout.columns
    // directly. Today the value is overwritten by the first render() call so
    // the wrong-platform desktop value is never observed; using activeColumns
    // makes the constructor's internal state correct on its own.
    this.effectiveColumns = plugin.activeColumns();
    this.autoHeight = new AutoHeightManager(this);
    this.responsiveColumns = new ResponsiveColumnsManager(this);
    // GridLayout itself satisfies LayoutPersisterHost structurally (the host
    // declares only fields/methods this class already exposes). Pass `this`
    // so the persister always reads live state via property accesses.
    this.persister = new LayoutPersister(this);
  }

  /**
   * Conform GridLayout to LayoutPersisterHost / EditHandleBarHost. The
   * interfaces require an `emitLayout(layout)` adapter because `onLayoutChange`
   * is private to GridLayout (callers shouldn't bypass GridLayout to write the
   * layout).
   */
  emitLayout(layout: LayoutConfig): void {
    this.onLayoutChange(layout);
  }

  /**
   * Public wrapper around the private rerender for EditHandleBarHost. Kept
   * separate from the private path so the host method's name is descriptive
   * outside the class.
   */
  triggerRerender(): void {
    this.rerender();
  }

  /** Public setter for the lastAddedBlockId so EditHandleBar can mark a duplicate. */
  setLastAddedBlockId(id: string): void {
    this.lastAddedBlockId = id;
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
    packRows(items, columns, priority, reflow);
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
      renderEmptyState(this.gridEl, { editMode: this.editMode, onRequestAddBlock: this.onRequestAddBlock });
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

  setEditMode(enabled: boolean, skipRepack = false, flushInFlight = true): void {
    if (this.phase === Phase.Destroyed) return;
    // If a drag was in-flight when this fires, dragstop won't get a chance to
    // run (the grid is about to be torn down). Flush its current GridStack
    // positions to the layout NOW so we don't lose the user's in-progress edit.
    //
    // Discard MUST pass flushInFlight=false: it has already written the pre-edit
    // snapshot to plugin.layout, and flushing here would read the still-live
    // edited GridStack DOM and re-persist exactly the positions the user asked
    // to discard — silently turning Discard into Save.
    if (flushInFlight && this.editMode && this.gridStack && this.phase === Phase.Ready) {
      try { this.persistLayout(); } catch { /* non-fatal */ }
    }
    if (!enabled && this.editMode && !skipRepack) {
      // Repack y-positions: compact edit heights create y offsets that
      // would overlap blocks at full view-mode heights.
      const repacked = repackEditLayout(
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
    // Render directly (not via rerender) so this deliberate mode switch always
    // repaints, even if a block reports unsaved inline state. The
    // hasUnsavedInlineState guard in rerender() exists to protect against
    // *external* sibling-save rerenders mid-typing — it must NOT block the
    // user's own enter/exit/discard, which has to reconcile the DOM with
    // plugin.layout (otherwise Discard reverts on disk but the screen keeps
    // the edited layout).
    this.render(this.plugin.activeBlocks(), this.plugin.activeColumns());
    if (!enabled) {
      // Exiting edit mode — clear any zoom transform
      this.setZoom(1);
    }
  }

  /**
   * Cancel any queued debounced layout persist + auto-height measurement.
   * Called by Discard so a late write (a 50ms `sync` debounce or a queued
   * auto-height rAF) can't resurrect the discarded positions after the
   * pre-edit snapshot has been restored.
   */
  cancelPendingPersist(): void {
    this.scheduler.cancelTimeout('sync');
    this.clearPendingResizes();
  }

  /** Update column count, clamping each block's w to fit. */
  setColumns(n: number): void {
    if (this.phase === Phase.Destroyed) return;
    // Flush any in-flight drag before tearing down the grid for the column
    // change. Without this, switching columns while the user is mid-drag
    // silently discards the dragged position (the rerender destroys the
    // GridStack instance before its dragstop event has fired).
    if (this.editMode && this.gridStack && this.phase === Phase.Ready) {
      try { this.persistLayout(); } catch { /* non-fatal */ }
    }
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
    if (this.phase === Phase.Destroyed) return;
    const maxY = this.plugin.activeBlocks().reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const positioned = { ...instance, y: maxY };
    const newBlocks = [...this.plugin.activeBlocks(), positioned];
    this.lastAddedBlockId = positioned.id;
    this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
    this.rerender();
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private rerender(): void {
    // Suppress the rerender if any block has unsaved UI state (e.g.,
    // StaticTextBlock's inline pencil-icon editor is open). Without this guard,
    // a settings save on a sibling block calls rerender() which empties the
    // gridEl mid-typing, destroying the user's textarea content.
    for (const { block } of this.blocks.values()) {
      if (block?.hasUnsavedInlineState()) return;
    }
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
    const items: GridStackWidget[] = blocks.map((instance) => {
      // When _showTitle is false but the block was previously collapsed, the
      // wrapper renders full content (no header to click to re-expand) yet
      // instance.h is still the collapsed `1` row. Use _expandedH so the
      // GridStack widget matches what the wrapper actually displays.
      const effectiveCollapsed = instance.collapsed && instance.config._showTitle !== false;
      let renderH = instance.h;
      if (instance.collapsed && !effectiveCollapsed) {
        const expandedH = instance._expandedH;
        if (typeof expandedH === 'number' && expandedH > 0) renderH = expandedH;
      }
      return {
        id: instance.id,
        x: instance.x,
        y: instance.y,
        w: Math.min(instance.w, columns),
        maxW: columns,
        h: (this.editMode && this.shouldAutoHeight(instance)) ? COMPACT_EDIT_H : renderH,
        // Do NOT pass sizeToContent here — GridStack calls resizeToContent() during
        // load() before we've added any DOM content, causing "firstElementChild is null".
        // We call resizeToContent() manually after building each block's DOM below.
      };
    });

    // Repack y values so items are tightly stacked from the start.
    // Edit mode: ALWAYS pack — compact heights (COMPACT_EDIT_H) make saved
    // view-mode y positions incorrect, leaving large visual gaps.
    // View mode: pack only when compactLayout is on to preserve intentional gaps.
    if (this.editMode || this.plugin.layout.compactLayout) {
      packRows(items, columns, this.plugin.activeLayoutPriority());
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
      const wrapper = buildBlockWrapper(gsContent, instance, animDelayMs);

      const headerZone = wrapper.querySelector('.block-header-zone');
      const contentEl = wrapper.querySelector('.block-content');
      if (!(contentEl instanceof HTMLElement) || !(headerZone instanceof HTMLElement)) continue;

      const factory = BlockRegistry.get(instance.type);
      if (!factory) continue;

      if (this.editMode) {
        // Symbolic compact card — no content rendering for easy drag & drop
        renderCompactPlaceholder(headerZone, contentEl, factory, instance);
        this.blocks.set(instance.id, { block: null, wrapper });
      } else {
        const block = factory.create(this.app, instance, this.plugin);
        block.setHeaderContainer(headerZone);
        block.load();
        const needsResize = this.shouldAutoHeight(instance);
        // Listen for auto-height requests from block re-renders (via scheduleRender).
        // Re-resolve the live block on every fire instead of trusting the
        // render-time `instance` closure -- otherwise a settings change that
        // toggled heightMode without a teardown would still treat the block as
        // auto-height because the listener was wired with the old config.
        if (needsResize) {
          const blockId = instance.id;
          gsEl.addEventListener('request-auto-height', () => {
            const live = this.plugin.activeBlocks().find(b => b.id === blockId);
            if (!live || !this.shouldAutoHeight(live)) return;
            this.requestAutoHeight(gsEl, live);
          });
        }
        // Skeleton overlay: show shimmer placeholder during initial load
        const skeletonEl = isInitial ? createSkeleton(wrapper) : null;
        const result = block.render(contentEl);
        if (result instanceof Promise) {
          // After async render, wait one frame for the browser to lay out the new DOM,
          // then measure and resize the block to its natural content height.
          result
            .then(() => {
              removeSkeleton(skeletonEl, this.scheduler);
              if (needsResize) this.requestAutoHeight(gsEl, instance);
            })
            .catch(e => {
              removeSkeleton(skeletonEl, this.scheduler);
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
      attachCollapseToggle(this, gsEl, instance, headerZone);

      // Edit handles
      if (this.editMode) {
        attachEditHandleBar(this, wrapper, instance);
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
    // editMode guard: AutoHeightManager temporarily lifts staticGrid during its rAF
    // batch (see AutoHeight.ts:67). A pointer twitch latched at mousedown can become
    // a real drag during that lift in view mode -- without this guard, dragstop would
    // persist the phantom drag and silently corrupt the saved layout.
    this.gridStack.on('dragstop', () => {
      if (this.phase !== Phase.Ready || !this.editMode) return;
      this.persistLayout();
    });

    this.gridStack.on('resizestop', () => {
      if (this.phase !== Phase.Ready || !this.editMode) return;
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

  // buildBlockWrapper / createSkeleton / removeSkeleton / renderCompactPlaceholder /
  // renderEmptyState extracted to src/grid/BlockWrapper.ts (covered by render tests).

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
  /**
   * Public for callers that need the same mobile/desktop routing logic but
   * don't go through onLayoutChange (e.g., EditToolbar's discardChanges).
   * Keeping `buildLayoutUpdate` as the single funnel for layout writes that
   * need the platform split prevents drift -- a future field added here
   * propagates to every call site automatically.
   */
  buildLayoutUpdate(
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

  /** Read current positions from GridStack nodes and persist to layout. */
  private persistLayout(): void {
    this.persister.persist();
  }

  /** Debounced persistLayout — coalesces rapid auto-height resize saves into one write. */
  persistLayoutDebounced(): void {
    this.persister.persistDebounced();
  }

  // ── Layout Utilities ───────────────────────────────────────────────────
  // packRows + repackEditLayout extracted to src/grid/packing.ts (pure, tested).

  /** Repack all GridStack nodes so blocks shift up to fill vertical gaps. */
  repackGridNodes(): void {
    this.persister.repackGridNodes((items, columns, priority) =>
      packRows(items, columns, priority),
    );
  }

  // attachCollapseToggle + attachEditHandleBar + swapWithNeighbor live in src/grid/.
}
