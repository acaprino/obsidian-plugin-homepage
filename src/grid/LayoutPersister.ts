import { GridStack, GridStackNode } from 'gridstack';
import { BlockInstance, IHomepagePlugin, LayoutConfig, LayoutPriority } from '../types';
import { Scheduler } from '../utils/Scheduler';
import { Phase } from './phase';

/**
 * Subset of GridLayout state that LayoutPersister borrows. Mirrors the
 * AutoHeightHost / ResponsiveColumnsHost pattern: the manager re-reads these
 * fields at call time so it sees current state, not values at construction.
 */
export interface LayoutPersisterHost {
  readonly gridStack: GridStack | null;
  readonly phase: Phase;
  readonly plugin: IHomepagePlugin;
  readonly effectiveColumns: number;
  readonly canonicalColumns: number;
  readonly scheduler: Scheduler;
  shouldAutoHeight(instance: BlockInstance): boolean;
  buildLayoutUpdate(blocks: BlockInstance[], extra?: { columns?: number }): LayoutConfig;
  emitLayout(layout: LayoutConfig): void;
}

/**
 * Pure layout-write logic extracted from GridLayout. Reads positions from the
 * live GridStack DOM, compares them to the persisted blocks, builds a new
 * layout via the host's buildLayoutUpdate, and emits it through onLayoutChange.
 *
 * Three responsibilities:
 *   - persist(): one-shot write, called from dragstop/resizestop/teardown
 *   - persistDebounced(): coalesces rapid auto-height resize saves into one write
 *   - repackGridNodes(): collision-free reflow after auto-height changes shrink
 *     a block, so blocks below shift up to fill gaps
 *
 * Skips the disk write under two conditions, matching the prior in-class
 * behaviour:
 *   - "Responsive + every block is auto-height" (no canonical positions to
 *     persist, no h to persist either since auto-height blocks derive h)
 *   - "Nothing changed" (compares posMap to current blocks before writing)
 */
export class LayoutPersister {
  constructor(private host: LayoutPersisterHost) {}

  /** Read positions from GridStack, diff against the persisted layout, write if changed. */
  persist(): void {
    const { gridStack, phase, plugin, effectiveColumns, canonicalColumns } = this.host;
    if (!gridStack || phase !== Phase.Ready) return;

    // When responsive columns are active (effectiveColumns < canonicalColumns),
    // GridStack nodes hold transient positions adapted for the narrow viewport.
    // Persisting x/y/w from the responsive layout would destroy the canonical
    // (desktop) layout. Only persist height changes in this case.
    // Note: dragstop/resizestop callers are gated by editMode in GridLayout, so
    // isResponsive is always false for manual user interactions; this guard
    // protects auto-height-driven persists in view mode.
    const isResponsive = effectiveColumns !== canonicalColumns;

    // Fast path: when every block is auto-height and we are in responsive mode,
    // there is nothing to persist — skip the GridStack DOM traversal entirely.
    if (isResponsive && plugin.activeBlocks().every(b => this.host.shouldAutoHeight(b))) {
      return;
    }

    const nodes = gridStack.getGridItems();
    const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (const el of nodes) {
      const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      const id = el.getAttribute('gs-id');
      if (id && node) {
        const w = Math.min(node.w ?? 1, effectiveColumns);
        posMap.set(id, {
          x: Math.min(node.x ?? 0, Math.max(0, effectiveColumns - w)),
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
    const changed = plugin.activeBlocks().some(b => {
      const pos = posMap.get(b.id);
      if (!pos) return false;
      const isAuto = this.host.shouldAutoHeight(b);
      if (isResponsive) return !isAuto && b.h !== pos.h;
      if (isAuto) return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w;
      return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w || b.h !== pos.h;
    });
    if (!changed) return;

    const newBlocks = plugin.activeBlocks().map(b => {
      const pos = posMap.get(b.id);
      if (!pos) return b;
      const isAuto = this.host.shouldAutoHeight(b);
      if (isResponsive) {
        // Only persist height for non-auto-height blocks; leave x/y/w canonical.
        return isAuto ? b : { ...b, h: pos.h };
      }
      const update = isAuto ? { x: pos.x, y: pos.y, w: pos.w } : pos;
      return { ...b, ...update };
    });

    this.host.emitLayout(this.host.buildLayoutUpdate(newBlocks));
  }

  /**
   * Debounced persist — coalesces rapid auto-height resize saves into one
   * write. The 50ms window is short enough not to feel laggy on Save buttons,
   * long enough to coalesce a 60fps ResizeObserver storm into a single save.
   */
  persistDebounced(): void {
    this.host.scheduler.timeout('sync', 50, () => {
      if (this.host.phase !== Phase.Destroyed) this.persist();
    });
  }

  /** True when the grid is showing a responsive (narrowed) layout. */
  isResponsive(): boolean {
    return this.host.effectiveColumns !== this.host.canonicalColumns;
  }

  /**
   * Repack all GridStack nodes so blocks shift up to fill vertical gaps left
   * by auto-height shrinks. Called from AutoHeightManager.runBatch after any
   * measurement changes a row count.
   */
  repackGridNodes(packRows: <T extends { x?: number; y?: number; w?: number; h?: number }>(items: T[], columns: number, priority: LayoutPriority) => void): void {
    const { gridStack, plugin, effectiveColumns } = this.host;
    if (!gridStack) return;
    const nodeItems: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const gsEl of gridStack.getGridItems()) {
      const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
      if (!node) continue;
      nodeItems.push({ el: gsEl as HTMLElement, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
    }
    packRows(nodeItems, effectiveColumns, plugin.activeLayoutPriority());
    gridStack.batchUpdate();
    for (const item of nodeItems) {
      gridStack.update(item.el, { y: item.y });
    }
    gridStack.batchUpdate(false);
  }
}
