import { GridStack, GridStackNode } from 'gridstack';
import { BlockInstance, IHomepagePlugin, LayoutPriority } from '../types';
import { Scheduler } from '../utils/Scheduler';
import { Phase } from './phase';
import { viewModeHeight } from './CollapseToggle';

/**
 * Width breakpoints (px) where the grid drops a column. The container queries in
 * styles.css adapt the UI inside the grid at their own breakpoints (380 / 540 / 768).
 */
const COLUMN_BREAKPOINTS = { single: 480, double: 768, triple: 1024 };

/** Narrow view of GridLayout state / methods needed by the responsive-columns manager. */
export interface ResponsiveColumnsHost {
  readonly scheduler: Scheduler;
  readonly plugin: IHomepagePlugin;
  readonly gridEl: HTMLElement;
  readonly phase: Phase;
  readonly gridStack: GridStack | null;
  readonly editMode: boolean;
  effectiveColumns: number;
  canonicalColumns: number;
  shouldAutoHeight(i: BlockInstance): boolean;
  requestAutoHeight(gsEl: HTMLElement, i: BlockInstance): void;
  clearPendingResizes(): void;
  packRows(
    items: { el?: HTMLElement; x?: number; y?: number; w?: number; h?: number }[],
    columns: number,
    priority: LayoutPriority,
    reflow: boolean,
  ): void;
}

/**
 * Map a container-pixel width to an effective column count, clamped by the user's
 * canonical (saved) column count. The canonical value is the maximum — we never
 * exceed it.
 */
function computeEffectiveColumns(width: number, canonical: number): number {
  if (width < COLUMN_BREAKPOINTS.single) return 1;
  if (width < COLUMN_BREAKPOINTS.double) return Math.min(2, canonical);
  if (width < COLUMN_BREAKPOINTS.triple) return Math.min(3, canonical);
  return canonical;
}

/**
 * Observes container width and tells GridStack to collapse / expand column count so
 * the layout stays usable on narrow panes. The observer is long-lived (survives
 * rerenders); only destroy() disconnects it.
 */
export class ResponsiveColumnsManager {
  private resizeObserver: ResizeObserver | null = null;

  constructor(private host: ResponsiveColumnsHost) {}

  /** Observe `viewEl` and set `canonicalColumns` to the user's saved value. */
  setup(viewEl: HTMLElement | null, userCols: number): void {
    this.host.canonicalColumns = userCols;
    if (!viewEl) return;

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.host.phase === Phase.Destroyed || !this.host.gridStack) return;
        if (this.host.editMode) return; // Preserve canonical layout while editing
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        // 0 is a hidden view (a background tab gets display:none), not a narrow
        // one: re-laying the grid out would reload iframes and jump the scroll.
        if (width <= 0) return;
        const next = computeEffectiveColumns(width, this.host.canonicalColumns);
        if (next !== this.host.effectiveColumns) {
          this.apply(next);
        }
      });
      this.resizeObserver.observe(viewEl);
    }

    // Set initial value synchronously (also handles userCols changes). Edit mode
    // shows the canonical layout whatever the pane width, and LayoutPersister
    // reads effective !== canonical as "transient positions, persist h only":
    // narrowing here while editing would silently drop every drag and resize.
    if (this.host.editMode) {
      this.host.effectiveColumns = userCols;
      return;
    }
    // A view rendered while hidden measures 0: keep the columns it was built with
    // until the observer reports a real width.
    if (viewEl.clientWidth <= 0) return;
    this.host.effectiveColumns = computeEffectiveColumns(viewEl.clientWidth, userCols);
    if (this.host.effectiveColumns !== userCols && this.host.gridStack) {
      this.apply(this.host.effectiveColumns);
    }
  }

  /** Disconnect the ResizeObserver. Called from GridLayout.destroy. */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /**
   * Apply a new effective column count: clamp block widths, then either restore the
   * canonical layout (when widening back) or repack for the narrow width (when shrinking).
   */
  apply(next: number): void {
    const { gridStack } = this.host;
    if (!gridStack) return;
    this.host.effectiveColumns = next;

    // Cancel any pending work from the previous column state. A stale auto-height
    // batch or 'sync' persist against the old effective columns would corrupt the
    // layout after a rapid narrow↔canonical oscillation.
    this.host.scheduler.cancelRaf('autoHeight');
    this.host.scheduler.cancelTimeout('sync');
    this.host.clearPendingResizes();

    // No transition for a column change: restoreCanonicalLayout requests auto-height,
    // measured on the next frame, and a width still inside GridStack's 0.3 s
    // transition measures text at its old width (wider out of single column, so a
    // too-short card is saved).
    const animate = gridStack.opts.animate ?? true;
    gridStack.setAnimation(false);
    try {
      // Single-column mode: switch to CSS flex layout so blocks shrink-wrap their
      // content instead of using GridStack's fixed row heights.
      this.host.gridEl.classList.toggle('hp-single-column', next === 1);

      // Use 'none' so GridStack doesn't auto-scale widths, then manually clamp each
      // block's w to the new column count and repack.
      gridStack.column(next, 'none');

      if (next === this.host.canonicalColumns) {
        this.restoreCanonicalLayout(gridStack, next);
      } else {
        this.packForNarrowLayout(gridStack, next);
      }
    } finally {
      // Commit the new geometry while no transition applies, then animate again.
      // GridStack 12 happens to read computed style in _updateContainerHeight
      // (unless minRow is set), which already commits it; this read keeps the fix
      // independent of that internal detail.
      void this.host.gridEl.offsetWidth;
      gridStack.setAnimation(animate);
    }
  }

  /**
   * Returning to the user's canonical column count: restore saved x/y/w exactly.
   * The responsive-narrowing transform is lossy (multiple source positions map to the
   * same packed output), so we read from the persisted layout instead of inverting it.
   */
  private restoreCanonicalLayout(gridStack: GridStack, next: number): void {
    const saved = this.host.plugin.activeBlocks();
    const lookup = new Map(saved.map(b => [b.id, b]));
    const autoHeightItems: Array<{ gsEl: HTMLElement; b: BlockInstance }> = [];
    gridStack.batchUpdate();
    for (const gsEl of gridStack.getGridItems()) {
      const id = gsEl.getAttribute('gs-id');
      const b = id ? lookup.get(id) : undefined;
      if (!b) continue;
      const isAuto = this.host.shouldAutoHeight(b);
      gridStack.update(gsEl as HTMLElement, {
        x: b.x, y: b.y, w: Math.min(b.w, next),
        ...(isAuto ? {} : { h: viewModeHeight(b) }),
        maxW: next,
      });
      if (isAuto) autoHeightItems.push({ gsEl: gsEl as HTMLElement, b });
    }
    gridStack.batchUpdate(false);
    for (const { gsEl, b } of autoHeightItems) this.host.requestAutoHeight(gsEl, b);
  }

  /** Narrowing: clamp widths, greedy-pack into the new column count, reorder DOM for flex mode. */
  private packForNarrowLayout(gridStack: GridStack, next: number): void {
    const nodeItems: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const gsEl of gridStack.getGridItems()) {
      const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      if (!node) continue;
      const w = Math.min(node.w ?? 1, next);
      const x = Math.min(node.x ?? 0, Math.max(0, next - w));
      nodeItems.push({ el: gsEl as HTMLElement, x, y: node.y ?? 0, w, h: node.h ?? 1 });
    }
    this.host.packRows(nodeItems, next, this.host.plugin.activeLayoutPriority(), true);

    gridStack.batchUpdate();
    for (const item of nodeItems) {
      gridStack.update(item.el, { w: item.w, x: item.x, y: item.y, maxW: next });
    }
    gridStack.batchUpdate(false);

    // apply() cancelled the measurements queued before the column change (render
    // queues one per auto-height block). Ask again at the new width; one column
    // is sized by CSS and needs none (N23).
    if (next > 1) {
      const saved = new Map(this.host.plugin.activeBlocks().map(b => [b.id, b]));
      for (const item of nodeItems) {
        const b = saved.get(item.el.getAttribute('gs-id') ?? '');
        if (b && this.host.shouldAutoHeight(b)) this.host.requestAutoHeight(item.el, b);
      }
    }

    // In single-column flex mode, DOM order determines visual order. Reorder DOM
    // elements by packed position using the user's priority.
    if (next === 1) {
      const sorted = nodeItems.slice().sort((a, b) => (a.y - b.y || a.x - b.x));
      for (const item of sorted) {
        this.host.gridEl.appendChild(item.el);
      }
    }
  }
}
