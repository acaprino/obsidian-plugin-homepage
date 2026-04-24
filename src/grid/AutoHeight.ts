import { GridStack, GridStackNode } from 'gridstack';
import { BlockInstance } from '../types';
import { Scheduler } from '../utils/Scheduler';
import { Phase } from './phase';

/**
 * The subset of GridLayout state that AutoHeightManager needs. GridLayout holds the
 * real state and the helper borrows it via this narrow view — this keeps the helper
 * testable in isolation and prevents it from reaching into unrelated grid internals.
 */
export interface AutoHeightHost {
  readonly scheduler: Scheduler;
  readonly phase: Phase;
  readonly gridStack: GridStack | null;
  readonly effectiveColumns: number;
  repackGridNodes(): void;
  persistLayoutDebounced(): void;
}

/**
 * Coalesces simultaneous "block X needs to grow to fit its content" requests into a
 * single rAF-scheduled batch, then measures the natural content height of every
 * requested block and updates the GridStack row count.
 *
 * GridStack's built-in resizeToContent() measures the `.homepage-block-wrapper` which
 * stretches to 100% of the cell — so it never grows. We look for a block-provided
 * `[data-auto-height-content]` child (height:auto) and use its offsetHeight instead.
 */
export class AutoHeightManager {
  private pending = new Map<string, { gsEl: HTMLElement; instance: BlockInstance }>();

  /**
   * `host` is kept as a live reference — AutoHeightManager re-reads `phase`, `gridStack`
   * and `effectiveColumns` every time the rAF fires so it sees current state, not the
   * values at construction time.
   */
  constructor(private host: AutoHeightHost) {}

  /** Clear any queued measurements without scheduling a run. Called from teardown. */
  clearPending(): void {
    this.pending.clear();
  }

  /** Queue a block for measurement in the next animation frame. */
  request(gsEl: HTMLElement, instance: BlockInstance): void {
    this.pending.set(instance.id, { gsEl, instance });
    this.host.scheduler.raf('autoHeight', () => this.runBatch());
  }

  private runBatch(): void {
    const { phase, gridStack, effectiveColumns } = this.host;
    if (phase === Phase.Destroyed || !gridStack) return;

    // Single-column flex mode: CSS height:auto handles all sizing. GridStack row
    // calculations (80px cells) are meaningless here and cause infinite resize
    // oscillation as content reflows.
    if (effectiveColumns === 1) {
      this.pending.clear();
      return;
    }

    const batch = Array.from(this.pending.values());
    this.pending.clear();

    // Lift static grid for the entire batch so updates + compaction work.
    const isStatic = !!gridStack.opts.staticGrid;
    if (isStatic) gridStack.setStatic(false);

    try {
      let anyResized = false;
      for (const { gsEl, instance } of batch) {
        if (this.measureAndResize(gsEl, instance)) anyResized = true;
      }

      // Repack ALL blocks after any auto-height change so those below shift up to
      // fill gaps left by shrinking blocks. Always repack (regardless of compactLayout)
      // because auto-height blocks don't persist their height — initial placement
      // uses the stale saved h until the first repack with measured values.
      if (anyResized) {
        this.host.repackGridNodes();
        this.host.persistLayoutDebounced();
      }
    } finally {
      // Always restore staticGrid even if a measurement threw — otherwise view mode
      // silently becomes draggable and the dragstop handler would persist positions.
      if (isStatic) gridStack.setStatic(true);
    }
  }

  /**
   * Measure a block's natural content height and update its GridStack row count.
   * Returns true when the height actually changed.
   */
  private measureAndResize(gsEl: HTMLElement, instance: BlockInstance): boolean {
    const { gridStack } = this.host;
    if (!gridStack || !gsEl.isConnected) return false;

    const contentEl = gsEl.querySelector<HTMLElement>('[data-auto-height-content]');
    const headerZone = gsEl.querySelector<HTMLElement>('.block-header-zone');
    if (!contentEl || !headerZone) return false;

    // grid-template-rows: 1fr constrains the content to the available flex space.
    // Temporarily switch to max-content so the block reports its natural height.
    // Disable the CSS transition first — otherwise the discrete 1fr→max-content
    // transition keeps the computed value as 1fr at t=0 and offsetHeight returns
    // the constrained height instead of the natural content height.
    const blockContent = gsEl.querySelector<HTMLElement>('.block-content');
    if (blockContent) {
      blockContent.addClass('hp-no-transition');
      blockContent.addClass('hp-auto-rows');
    }

    // Batch all DOM reads before writes to avoid layout thrashing.
    const contentH = contentEl.offsetHeight;
    const headerH = headerZone.offsetHeight;

    if (blockContent) {
      blockContent.removeClass('hp-auto-rows');
      void blockContent.offsetHeight; // force reflow so the transition doesn't animate
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
    const margin = typeof gridStack.opts.margin === 'number' ? gridStack.opts.margin : 8;
    const totalH = headerH + pad + contentH + (gap * gapCount) + margin * 2;
    const cell = gridStack.getCellHeight();
    const rows = Math.max(1, Math.ceil(totalH / cell));

    const node = (gsEl as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
    const currentH = node?.h ?? instance.h;
    if (rows !== currentH) {
      // Static grid is already lifted by runBatch().
      gridStack.update(gsEl, { h: rows });
      return true;
    }
    return false;
  }
}
