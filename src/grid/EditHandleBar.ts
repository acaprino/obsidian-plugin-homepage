import { App, setIcon } from 'obsidian';
import { GridStack, GridStackNode } from 'gridstack';
import { BlockInstance, IHomepagePlugin, LayoutConfig } from '../types';
import { BaseBlock } from '../blocks/BaseBlock';
import { BlockRegistry } from '../BlockRegistry';
import { newId } from '../utils/ids';
import { BlockSettingsModal } from '../modals/BlockSettingsModal';
import { RemoveBlockConfirmModal } from '../modals/RemoveBlockConfirmModal';

/**
 * Subset of GridLayout state and capabilities the edit-mode handle bar needs.
 * Mirrors the AutoHeightHost / LayoutPersisterHost pattern. Read at every
 * call so the handlers see live state, not values at construction.
 */
export interface EditHandleBarHost {
  readonly app: App;
  readonly plugin: IHomepagePlugin;
  readonly gridStack: GridStack | null;
  readonly gridEl: HTMLElement;
  /** Per-block render bookkeeping; consulted before opening settings to find the live block instance. */
  readonly blocks: Map<string, { block: BaseBlock | null; wrapper: HTMLElement }>;
  buildLayoutUpdate(blocks: BlockInstance[], extra?: { columns?: number }): LayoutConfig;
  emitLayout(layout: LayoutConfig): void;
  /** Re-render the whole grid (used after duplicate, settings save, swap, remove-empty). */
  triggerRerender(): void;
  /** Hint to scroll-into-view the just-added duplicate when the next render lands. */
  setLastAddedBlockId(id: string): void;
  shouldAutoHeight(instance: BlockInstance): boolean;
}

/**
 * Build the per-block edit-mode handle bar (drag handle, move up/down, duplicate,
 * settings, remove). Inserted before the block's header zone so the bar floats
 * above the block content and never participates in normal block layout.
 *
 * Each button reads `plugin.activeBlocks()` at click time rather than trusting
 * the render-time `instance` closure, so a block whose position/config changed
 * between render and click stays consistent on disk.
 */
export function attachEditHandleBar(
  host: EditHandleBarHost,
  wrapper: HTMLElement,
  instance: BlockInstance,
): void {
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
    swapWithNeighbor(host, instance, 'up');
  });

  const moveDownBtn = bar.createEl('button', { cls: 'block-move-down-btn' });
  setIcon(moveDownBtn, 'chevron-down');
  moveDownBtn.setAttribute('aria-label', 'Move block down');
  moveDownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    swapWithNeighbor(host, instance, 'down');
  });

  // Duplicate
  const dupBtn = bar.createEl('button', { cls: 'block-duplicate-btn' });
  setIcon(dupBtn, 'copy');
  dupBtn.setAttribute('aria-label', 'Duplicate block');
  dupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Read current state from layout (not stale render-time closure)
    const current = host.plugin.activeBlocks().find(b => b.id === instance.id);
    if (!current) return;
    const clone: BlockInstance = {
      ...structuredClone(current),
      id: newId(),
      y: current.y + current.h,
    };
    const newBlocks = [...host.plugin.activeBlocks(), clone];
    host.setLastAddedBlockId(clone.id);
    host.emitLayout(host.buildLayoutUpdate(newBlocks));
    host.triggerRerender();
  });

  // Settings (right group)
  const settingsBtn = bar.createEl('button', { cls: 'block-settings-btn' });
  setIcon(settingsBtn, 'settings');
  settingsBtn.setAttribute('aria-label', 'Block settings');
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const entry = host.blocks.get(instance.id);
    if (!entry) return;
    const onSave = (config: Record<string, unknown>) => {
      const newBlocks = host.plugin.activeBlocks().map(b =>
        b.id === instance.id ? { ...b, config } : b,
      );
      host.emitLayout(host.buildLayoutUpdate(newBlocks));
      host.triggerRerender();
    };
    // In edit mode blocks aren't instantiated — create a temporary one for settings
    let tempBlock: BaseBlock | null = null;
    const block = entry.block ?? (() => {
      const factory = BlockRegistry.get(instance.type);
      if (!factory) return null;
      tempBlock = factory.create(host.app, instance, host.plugin);
      return tempBlock;
    })();
    if (!block) return;
    // Teardown runs on both Save AND Cancel/Esc/X. Without the onClose hook the
    // tempBlock would leak its registered intervals/events on every cancel.
    const teardownTempBlock = () => {
      if (tempBlock) {
        tempBlock.unload();
        tempBlock = null;
      }
    };
    const modal = new BlockSettingsModal(host.app, instance, block, (config) => {
      teardownTempBlock();
      onSave(config);
    });
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      teardownTempBlock();
      originalOnClose();
    };
    modal.open();
  });

  // Remove (last — destructive action at the end)
  const removeBtn = bar.createEl('button', { cls: 'block-remove-btn' });
  setIcon(removeBtn, 'x');
  removeBtn.setAttribute('aria-label', 'Remove block');
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Coalesce rapid clicks: while the confirm modal is up, ignore extra
    // clicks. Without this guard, double-clicking the X button could open
    // two confirm modals racing the same removeWidget+compact pair.
    if (removeBtn.hasAttribute('data-remove-pending')) return;
    removeBtn.setAttribute('data-remove-pending', '1');
    const label = (typeof instance.config._titleLabel === 'string' && instance.config._titleLabel.trim())
      ? instance.config._titleLabel.trim()
      : instance.type;
    const modal = new RemoveBlockConfirmModal(host.app, () => {
      removeBtn.removeAttribute('data-remove-pending');
      // Wrap the removeWidget + compact pair in batchUpdate so GridStack
      // commits both operations atomically. Without this, a second remove
      // arriving before the compact's reflow settled would read mid-state
      // positions for posMap.
      const gsItem = host.gridEl.querySelector(`[gs-id="${CSS.escape(instance.id)}"]`);
      if (gsItem instanceof HTMLElement && host.gridStack) {
        host.gridStack.batchUpdate();
        try {
          host.gridStack.removeWidget(gsItem);
          host.gridStack.compact();
        } finally {
          host.gridStack.batchUpdate(false);
        }
      }
      const entry = host.blocks.get(instance.id);
      if (entry) {
        entry.block?.unload();
        host.blocks.delete(instance.id);
      }
      const remaining = host.plugin.activeBlocks().filter(b => b.id !== instance.id);
      if (remaining.length === 0) {
        host.emitLayout(host.buildLayoutUpdate([]));
        host.triggerRerender();
        return;
      }
      // Read compacted positions from GridStack and persist them
      if (!host.gridStack) {
        host.emitLayout(host.buildLayoutUpdate(remaining));
        return;
      }
      const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (const el of host.gridStack.getGridItems()) {
        const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
        const id = el.getAttribute('gs-id');
        if (id && node) {
          posMap.set(id, { x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
        }
      }
      const newBlocks = remaining.map(b => {
        const pos = posMap.get(b.id);
        if (!pos) return b;
        const isAuto = host.shouldAutoHeight(b);
        const update = isAuto ? { x: pos.x, y: pos.y, w: pos.w } : pos;
        return { ...b, ...update };
      });
      host.emitLayout(host.buildLayoutUpdate(newBlocks));
    }, label);
    // Clear the pending flag on cancel/close as well, otherwise a user who
    // clicks X then dismisses can never click X again.
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      removeBtn.removeAttribute('data-remove-pending');
      originalOnClose();
    };
    modal.open();
  });

  // Insert handle bar before header zone
  const headerZone = wrapper.querySelector('.block-header-zone');
  if (headerZone) {
    wrapper.insertBefore(bar, headerZone);
  }
}

/**
 * Swap a block's position with its nearest spatial neighbor in the given
 * direction. "Nearest" is by reading order: prior block (up) or next block
 * (down) in the y-then-x scan over activeBlocks. Clamps x so that x + w stays
 * within columns -- otherwise a wide block being moved next to a narrow one
 * would land outside the grid.
 */
function swapWithNeighbor(host: EditHandleBarHost, instance: BlockInstance, direction: 'up' | 'down'): void {
  const blocks = host.plugin.activeBlocks();
  const current = blocks.find(b => b.id === instance.id);
  if (!current) return;

  const columns = host.plugin.activeColumns();
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
  host.emitLayout(host.buildLayoutUpdate(newBlocks));
  host.triggerRerender();
}
