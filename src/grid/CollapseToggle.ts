import { GridStack, GridStackNode } from 'gridstack';
import { BlockInstance, IHomepagePlugin, LayoutConfig } from '../types';

/**
 * Subset of GridLayout state used by the collapse toggle. Read at every event
 * so the handler sees current edit-mode state (collapse must be a no-op while
 * in edit mode -- click would otherwise race the drag-handle bar).
 */
export interface CollapseToggleHost {
  readonly editMode: boolean;
  readonly gridStack: GridStack | null;
  readonly plugin: IHomepagePlugin;
  buildLayoutUpdate(blocks: BlockInstance[], extra?: { columns?: number }): LayoutConfig;
}

/**
 * Wires the click + Enter/Space handler on a block's header zone to toggle
 * its collapsed state. Mutates the wrapper's CSS class, asks GridStack to
 * resize the cell to either 1 row (collapsed) or _expandedH rows (restored),
 * and persists the new state via plugin.saveLayout.
 *
 * Persists rather than calling onLayoutChange directly because collapse is a
 * user-driven mutation that should land on disk independently of the dragstop
 * persist cycle (a drag at the same time wouldn't include the collapsed
 * field in its position-only update).
 */
export function attachCollapseToggle(
  host: CollapseToggleHost,
  gsEl: HTMLElement,
  instance: BlockInstance,
  headerZone: HTMLElement,
): void {
  const wrapper = gsEl.querySelector('.homepage-block-wrapper') as HTMLElement;
  const chevron = headerZone.querySelector<HTMLElement>('.block-collapse-chevron');
  if (!wrapper) return;

  const toggleCollapse = (e: Event) => {
    e.stopPropagation();
    if (host.editMode) return;
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
      if (host.gridStack) host.gridStack.update(gsEl, { h: 1 });
      newBlocks = host.plugin.activeBlocks().map(b =>
        b.id === instance.id ? { ...b, collapsed: true, _expandedH: liveH } : b,
      );
    } else {
      // Restore the saved expanded height
      const currentBlock = host.plugin.activeBlocks().find(b => b.id === instance.id);
      const origH = currentBlock?._expandedH ?? instance.h;
      if (host.gridStack) host.gridStack.update(gsEl, { h: origH });
      newBlocks = host.plugin.activeBlocks().map(b =>
        b.id === instance.id ? { ...b, collapsed: false, h: origH } : b,
      );
    }

    void host.plugin.saveLayout(host.buildLayoutUpdate(newBlocks));
  };

  headerZone.addEventListener('click', toggleCollapse);
  headerZone.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(e); }
  });
}
