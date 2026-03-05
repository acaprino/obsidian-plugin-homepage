import { App } from 'obsidian';
import { BlockInstance, LayoutConfig, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

export class GridLayout {
  private gridEl: HTMLElement;
  private blocks = new Map<string, { block: BaseBlock; wrapper: HTMLElement }>();
  private editMode = false;
  /** AbortController for the currently active drag or resize operation. */
  private activeAbortController: AbortController | null = null;
  /** Drag clone appended to document.body; tracked so we can remove it on early teardown. */
  private activeClone: HTMLElement | null = null;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid' });
  }

  render(blocks: BlockInstance[], columns: number): void {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    if (this.editMode) this.gridEl.addClass('edit-mode');

    for (const instance of blocks) {
      this.renderBlock(instance);
    }
  }

  private renderBlock(instance: BlockInstance): void {
    const factory = BlockRegistry.get(instance.type);
    if (!factory) return;

    const wrapper = this.gridEl.createDiv({ cls: 'homepage-block-wrapper' });
    wrapper.dataset.blockId = instance.id;
    this.applyGridPosition(wrapper, instance);

    if (this.editMode) {
      this.attachEditHandles(wrapper, instance);
    }

    const contentEl = wrapper.createDiv({ cls: 'block-content' });
    const block = factory.create(this.app, instance, this.plugin);
    block.load();
    const result = block.render(contentEl);
    if (result instanceof Promise) {
      result.catch(e => {
        console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
        contentEl.setText('Error rendering block. Check console for details.');
      });
    }

    this.blocks.set(instance.id, { block, wrapper });
  }

  private applyGridPosition(wrapper: HTMLElement, instance: BlockInstance): void {
    wrapper.style.gridColumn = `${instance.col} / span ${instance.colSpan}`;
    wrapper.style.gridRow = `${instance.row} / span ${instance.rowSpan}`;
  }

  private attachEditHandles(wrapper: HTMLElement, instance: BlockInstance): void {
    const bar = wrapper.createDiv({ cls: 'block-handle-bar' });

    const handle = bar.createDiv({ cls: 'block-move-handle' });
    handle.setText('⠿');

    const settingsBtn = bar.createEl('button', { cls: 'block-settings-btn', text: '⚙' });
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = this.blocks.get(instance.id);
      if (!entry) return;
      entry.block.openSettings(() => {
        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === instance.id ? instance : b,
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      });
    });

    const removeBtn = bar.createEl('button', { cls: 'block-remove-btn', text: '×' });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newBlocks = this.plugin.layout.blocks.filter(b => b.id !== instance.id);
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
    });

    // Resize grip (absolute positioned via CSS, bottom-right)
    const grip = wrapper.createDiv({ cls: 'block-resize-grip', text: '⊿' });
    this.attachResizeHandler(grip, wrapper, instance);

    // Drag handler on the braille handle
    this.attachDragHandler(handle, wrapper, instance);
  }

  private attachDragHandler(handle: HTMLElement, wrapper: HTMLElement, instance: BlockInstance): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();

      // Cancel any previous operation
      this.activeAbortController?.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;

      const clone = wrapper.cloneNode(true) as HTMLElement;
      clone.addClass('block-drag-clone');
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.left = `${e.clientX - 20}px`;
      clone.style.top = `${e.clientY - 20}px`;
      document.body.appendChild(clone);
      this.activeClone = clone;

      const sourceId = instance.id;
      wrapper.addClass('block-dragging');

      const onMouseMove = (me: MouseEvent) => {
        clone.style.left = `${me.clientX - 20}px`;
        clone.style.top = `${me.clientY - 20}px`;

        this.gridEl.querySelectorAll('.homepage-block-wrapper').forEach(el => {
          (el as HTMLElement).removeClass('block-drop-target');
        });
        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          this.blocks.get(targetId)?.wrapper.addClass('block-drop-target');
        }
      };

      const onMouseUp = (me: MouseEvent) => {
        // Aborting the controller removes both listeners automatically
        ac.abort();
        this.activeAbortController = null;

        clone.remove();
        this.activeClone = null;
        wrapper.removeClass('block-dragging');

        this.gridEl.querySelectorAll('.homepage-block-wrapper').forEach(el => {
          (el as HTMLElement).removeClass('block-drop-target');
        });

        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          this.swapBlocks(sourceId, targetId);
        }
      };

      document.addEventListener('mousemove', onMouseMove, { signal: ac.signal });
      document.addEventListener('mouseup', onMouseUp, { signal: ac.signal });
    });
  }

  private attachResizeHandler(grip: HTMLElement, wrapper: HTMLElement, instance: BlockInstance): void {
    grip.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel any previous operation
      this.activeAbortController?.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;

      const startX = e.clientX;
      const startColSpan = instance.colSpan;
      const columns = this.plugin.layout.columns;
      const colWidth = this.gridEl.offsetWidth / columns;
      let currentColSpan = startColSpan;

      const onMouseMove = (me: MouseEvent) => {
        const deltaX = me.clientX - startX;
        const deltaCols = Math.round(deltaX / colWidth);
        const max = columns - instance.col + 1;
        currentColSpan = Math.max(1, Math.min(max, startColSpan + deltaCols));
        // Visual feedback only — instance is not mutated until mouseup
        wrapper.style.gridColumn = `${instance.col} / span ${currentColSpan}`;
      };

      const onMouseUp = () => {
        ac.abort();
        this.activeAbortController = null;

        // Commit via immutable update
        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === instance.id ? { ...b, colSpan: currentColSpan } : b,
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };

      document.addEventListener('mousemove', onMouseMove, { signal: ac.signal });
      document.addEventListener('mouseup', onMouseUp, { signal: ac.signal });
    });
  }

  private findBlockUnderCursor(x: number, y: number, excludeId: string): string | null {
    for (const [id, { wrapper }] of this.blocks) {
      if (id === excludeId) continue;
      const rect = wrapper.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return id;
      }
    }
    return null;
  }

  /** Swap positions of two blocks using immutable updates. */
  private swapBlocks(idA: string, idB: string): void {
    const bA = this.plugin.layout.blocks.find(b => b.id === idA);
    const bB = this.plugin.layout.blocks.find(b => b.id === idB);
    if (!bA || !bB) return;

    const newBlocks = this.plugin.layout.blocks.map(b => {
      if (b.id === idA) return { ...b, col: bB.col, row: bB.row, colSpan: bB.colSpan, rowSpan: bB.rowSpan };
      if (b.id === idB) return { ...b, col: bA.col, row: bA.row, colSpan: bA.colSpan, rowSpan: bA.rowSpan };
      return b;
    });

    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }

  setEditMode(enabled: boolean): void {
    this.editMode = enabled;
    this.rerender();
  }

  setColumns(n: number): void {
    this.onLayoutChange({ ...this.plugin.layout, columns: n });
    this.rerender();
  }

  addBlock(instance: BlockInstance): void {
    const newBlocks = [...this.plugin.layout.blocks, instance];
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }

  private rerender(): void {
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
  }

  /** Unload all blocks and cancel any in-progress drag/resize. */
  destroyAll(): void {
    // Abort any in-progress drag/resize and clean up orphaned clone
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.activeClone?.remove();
    this.activeClone = null;

    for (const { block } of this.blocks.values()) {
      block.unload();
    }
    this.blocks.clear();
  }

  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy(): void {
    this.destroyAll();
    this.gridEl.remove();
  }
}
