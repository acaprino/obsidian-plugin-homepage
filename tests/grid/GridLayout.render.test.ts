import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App } from 'obsidian';
import { GridLayout } from '../../src/GridLayout';
import { BaseBlock } from '../../src/blocks/BaseBlock';
import { Phase } from '../../src/grid/phase';
import { getDefaultLayout } from '../../src/validation';
import { BlockRegistry } from '../../src/BlockRegistry';
import { ClockBlock } from '../../src/blocks/ClockBlock';
import { SpacerBlock } from '../../src/blocks/SpacerBlock';
import type { IHomepagePlugin, LayoutConfig, BlockInstance } from '../../src/types';

/**
 * Render-level tests for GridLayout. They exercise the real GridStack-driven
 * DOM build (which works under happy-dom), so they form the regression net that
 * lets the wrapper/placeholder DOM be refactored out of GridLayout safely.
 */

function registerTestBlocks(): void {
  BlockRegistry.clear();
  BlockRegistry.register({
    type: 'clock', displayName: 'Clock', defaultConfig: {}, defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'spacer', displayName: 'Spacer', defaultConfig: {}, defaultSize: { w: 1, h: 2 },
    create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin),
  });
}

function makePlugin(over: Partial<LayoutConfig> = {}, mobileActive = false): IHomepagePlugin {
  const layout: LayoutConfig = { ...getDefaultLayout(), blocks: [], ...over };
  const plugin: IHomepagePlugin = {
    app: {} as App,
    layout,
    saveLayout: async (l) => { plugin.layout = l; },
    saveActiveBlocks: async (b) => { plugin.layout = { ...plugin.layout, blocks: b }; },
    updateBlockConfig: async () => {},
    isMobileActive: () => mobileActive,
    activeBlocks: () => (mobileActive ? plugin.layout.mobileBlocks : plugin.layout.blocks),
    activeColumns: () => (mobileActive ? plugin.layout.mobileColumns : plugin.layout.columns),
    activeLayoutPriority: () => 'row',
  };
  return plugin;
}

/**
 * happy-dom lays nothing out, so every pane measures 0px, which ResponsiveColumns
 * reads as "hidden, width unknown". Give the view a real narrow width instead.
 */
function narrowPane(el: HTMLElement, width = 300): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width });
}

function clock(id: string, over: Partial<BlockInstance> = {}): BlockInstance {
  return { id, type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {}, ...over };
}

let host: HTMLElement;

beforeEach(() => {
  registerTestBlocks();
  document.body.empty();
  host = document.body.createDiv({ cls: 'homepage-view' });
});

describe('GridLayout — empty state', () => {
  it('renders the empty-state hint in view mode (no CTA)', () => {
    const plugin = makePlugin({ blocks: [] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render([], 3);

    const empty = host.querySelector('.homepage-empty-state');
    expect(empty).toBeTruthy();
    expect(host.querySelector('.homepage-empty-title')?.textContent).toBe('Your homepage is empty');
    expect(host.querySelector('.homepage-empty-cta')).toBeNull();
  });

  it('shows an "Add your first block" CTA in edit mode that calls onRequestAddBlock', () => {
    const plugin = makePlugin({ blocks: [] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    let ctaClicked = 0;
    grid.onRequestAddBlock = () => { ctaClicked++; };
    grid.render([], 3); // initialise (phase Ready) before toggling edit mode
    grid.setEditMode(true); // renders empty state in edit mode

    const cta = host.querySelector('.homepage-empty-cta') as HTMLButtonElement | null;
    expect(cta).toBeTruthy();
    cta!.click();
    expect(ctaClicked).toBe(1);
  });
});

describe('GridLayout — block wrapper DOM (extraction safety net)', () => {
  it('builds the canonical wrapper structure for one block', () => {
    const plugin = makePlugin({ blocks: [clock('c1')] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render([clock('c1')], 3);

    const item = host.querySelector('.grid-stack-item[gs-id="c1"]');
    expect(item).toBeTruthy();
    const wrapper = item!.querySelector('.grid-stack-item-content > .homepage-block-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper!.getAttribute('data-block-id')).toBe('c1');
    // header zone is a keyboard-operable button
    const headerZone = wrapper!.querySelector('.block-header-zone');
    expect(headerZone?.getAttribute('role')).toBe('button');
    expect(headerZone?.getAttribute('tabindex')).toBe('0');
    expect(headerZone?.querySelector('.block-collapse-chevron')).toBeTruthy();
    // content zone exists and holds the rendered block
    expect(wrapper!.querySelector('.block-content')).toBeTruthy();
    expect(wrapper!.querySelector('.clock-block')).toBeTruthy();
  });

  it('renders one grid item per block', () => {
    const blocks = [clock('a'), clock('b', { x: 1 }), clock('c', { x: 2 })];
    const plugin = makePlugin({ blocks });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render(blocks, 3);

    expect(host.querySelectorAll('.grid-stack-item').length).toBe(3);
    expect(host.querySelector('[gs-id="a"]')).toBeTruthy();
    expect(host.querySelector('[gs-id="b"]')).toBeTruthy();
    expect(host.querySelector('[gs-id="c"]')).toBeTruthy();
  });

  it('adds .block-collapsed when a block is collapsed (and has a visible title)', () => {
    const block = clock('c1', { collapsed: true, _expandedH: 3, h: 1, config: { _titleLabel: 'Clock' } });
    const plugin = makePlugin({ blocks: [block] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render([block], 3);

    const wrapper = host.querySelector('.homepage-block-wrapper');
    expect(wrapper?.classList.contains('block-collapsed')).toBe(true);
  });
});

describe('GridLayout — collapsed blocks after a reload (M5)', () => {
  const renderedH = (grid: GridLayout): number =>
    (grid.gridStack!.getGridItems()[0] as HTMLElement & { gridstackNode?: { h: number } }).gridstackNode!.h;

  it('draws a collapsed block one row high, although the stored h is the expanded height', () => {
    // What collapsing saves: collapsed + _expandedH, while h keeps the expanded value.
    const block = clock('c1', { collapsed: true, _expandedH: 4, h: 4, config: { _titleLabel: 'Clock' } });
    const plugin = makePlugin({ blocks: [block] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});

    grid.render([block], 3);

    expect(renderedH(grid)).toBe(1);
  });

  it('draws a collapsed block whose title is hidden at its expanded height (no header to reopen it)', () => {
    const block = clock('c1', { collapsed: true, _expandedH: 4, h: 1, config: { _showTitle: false } });
    const plugin = makePlugin({ blocks: [block] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});

    grid.render([block], 3);

    expect(renderedH(grid)).toBe(4);
  });
});

describe('GridLayout — edit-mode placeholders', () => {
  it('renders compact symbolic placeholders instead of full content', () => {
    const block = clock('c1', { config: { _titleLabel: 'My clock' } });
    const plugin = makePlugin({ blocks: [block] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render([block], 3); // initialise before toggling edit mode
    grid.setEditMode(true);

    const info = host.querySelector('.block-compact-info');
    expect(info).toBeTruthy();
    expect(info!.querySelector('.block-compact-type')?.textContent).toBe('clock');
    expect(info!.querySelector('.block-compact-size')?.textContent).toBe('1×3');
    // header shows the configured label, not the live clock face
    expect(host.querySelector('.block-content .clock-time')).toBeNull();
  });
});

describe('GridLayout — teardown', () => {
  it('destroy() removes the grid element and clears items', () => {
    const plugin = makePlugin({ blocks: [clock('c1')] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    grid.render([clock('c1')], 3);
    expect(host.querySelector('.grid-stack-item')).toBeTruthy();

    grid.destroy();
    expect(host.querySelector('.homepage-grid')).toBeNull();
    expect(grid.gridStack).toBeNull();
    expect(grid.phase).toBe(Phase.Destroyed);
  });
});

describe('GridLayout — buildLayoutUpdate routing', () => {
  it('routes to blocks/columns on desktop', () => {
    const plugin = makePlugin({ blocks: [clock('c1')] });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    const next = grid.buildLayoutUpdate([clock('c2')], { columns: 4 });
    expect(next.blocks.map(b => b.id)).toEqual(['c2']);
    expect(next.columns).toBe(4);
  });

  it('routes to mobileBlocks/mobileColumns when mobile-active', () => {
    const plugin = makePlugin({ blocks: [clock('c1')] }, /* mobileActive */ true);
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    const next = grid.buildLayoutUpdate([clock('m1')], { columns: 2 });
    expect(next.mobileBlocks.map(b => b.id)).toEqual(['m1']);
    expect(next.mobileColumns).toBe(2);
    // desktop blocks untouched
    expect(next.blocks.map(b => b.id)).toEqual(['c1']);
  });
});

describe('GridLayout — a block whose render throws (RF-R6)', () => {
  it('still mounts the blocks after it and lets the grid settle', async () => {
    class ThrowingBlock extends BaseBlock {
      render(): void { throw new TypeError('items is not iterable'); }
    }
    BlockRegistry.register({
      type: 'spacer', displayName: 'Spacer', defaultConfig: {}, defaultSize: { w: 1, h: 2 },
      create: (app, instance, plugin) => new ThrowingBlock(app, instance, plugin),
    });
    const blocks: BlockInstance[] = [
      { id: 'bad', type: 'spacer', x: 0, y: 0, w: 1, h: 2, config: {} },
      clock('ok', { x: 1 }),
    ];
    const plugin = makePlugin({ blocks });
    const grid = new GridLayout(host, plugin.app, plugin, () => {});
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => grid.render(blocks, 3)).not.toThrow();
      await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));
    } finally {
      errorLog.mockRestore();
    }

    expect(host.querySelector('[gs-id="ok"] .clock-block')).toBeTruthy();
    expect(host.querySelector('[gs-id="bad"] .block-content')?.textContent).toContain('Error rendering block');
    expect(grid.phase).toBe(Phase.Ready);
  });
});

describe('GridLayout — a view-mode persist still pending when edit mode starts (AP-1)', () => {
  it('does not save the narrow pane\'s packed positions as the canonical layout', () => {
    const blocks = [clock('a'), clock('b', { x: 1 }), clock('c', { x: 2 })];
    const plugin = makePlugin({ blocks });
    narrowPane(host);
    const grid = new GridLayout(host, plugin.app, plugin, (l) => { plugin.layout = l; });
    grid.render(blocks, 3);
    grid.phase = Phase.Ready; // simulate the post-init "settled" state
    // On a 300px pane view mode shows the responsive single column, and the live
    // GridStack nodes hold its packed positions.
    expect(grid.effectiveColumns).toBe(1);
    grid.gridStack!.getGridItems().forEach((el, i) => {
      const node = (el as HTMLElement & { gridstackNode?: { x: number; y: number } }).gridstackNode!;
      node.x = 0;
      node.y = i * 3;
    });
    grid.persistLayoutDebounced(); // queued by an auto-height resize, say

    grid.setEditMode(true);

    expect(plugin.layout.blocks.map(b => b.x)).toEqual([0, 1, 2]);
  });
});

describe('GridLayout — REG-1: Discard must not re-persist edited positions', () => {
  function setupEditingWithDrag(): { grid: GridLayout; emits: LayoutConfig[] } {
    const block = clock('c1');
    const plugin = makePlugin({ blocks: [block] });
    const emits: LayoutConfig[] = [];
    // A 300px pane, narrower than every column breakpoint, so these tests also
    // cover edit mode on a narrow pane (RF-R2): the grid must keep its canonical
    // 3 columns there, or persist() drops x/y/w changes.
    narrowPane(host);
    const grid = new GridLayout(host, plugin.app, plugin, (l) => emits.push(l));
    grid.render([block], 3);
    grid.setEditMode(true);
    grid.phase = Phase.Ready; // simulate the post-init "settled" state
    // Simulate an in-flight drag: move the live GridStack node away from x=0.
    // (gridStack.update() is a no-op without a real layout engine, so write the
    // node position directly — persist() reads node.x off gridstackNode.)
    const el = grid.gridStack!.getGridItems()[0] as HTMLElement & { gridstackNode?: { x: number } };
    expect(el.gridstackNode).toBeTruthy();
    el.gridstackNode!.x = 2;
    emits.length = 0; // ignore anything emitted up to here
    return { grid, emits };
  }

  it('flushInFlight=false (Discard path) does NOT emit the edited position', () => {
    const { grid, emits } = setupEditingWithDrag();
    grid.setEditMode(false, /* skipRepack */ true, /* flushInFlight */ false);
    expect(emits.length).toBe(0);
  });

  it('flushInFlight=true (normal exit) DOES persist the edited position', () => {
    const { grid, emits } = setupEditingWithDrag();
    grid.setEditMode(false, /* skipRepack */ true, /* flushInFlight */ true);
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1].blocks[0].x).toBe(2);
  });
});
