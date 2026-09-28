import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { App } from 'obsidian';
import { GridLayout } from '../../src/GridLayout';
import { BlockRegistry } from '../../src/BlockRegistry';
import { ClockBlock } from '../../src/blocks/ClockBlock';
import { getDefaultLayout } from '../../src/validation';
import type { BlockInstance, IHomepagePlugin, LayoutConfig } from '../../src/types';

type Entry = { contentBoxSize: { inlineSize: number }[]; contentRect: { width: number } };
type Observer = { cb: (entries: Entry[]) => void; targets: Element[] };

// happy-dom never lays anything out: capture every ResizeObserver so a test can
// report the widths Obsidian would report (0 while a tab is hidden with display:none).
let observers: Observer[] = [];
const OriginalResizeObserver = globalThis.ResizeObserver;

function makePlugin(blocks: BlockInstance[]): IHomepagePlugin {
  const plugin: IHomepagePlugin = {
    app: {} as App,
    layout: { ...getDefaultLayout(), blocks, columns: 3 } as LayoutConfig,
    saveLayout: async (l) => { plugin.layout = l; },
    saveActiveBlocks: async (b) => { plugin.layout = { ...plugin.layout, blocks: b }; },
    updateBlockConfig: async () => {},
    isMobileActive: () => false,
    activeBlocks: () => plugin.layout.blocks,
    activeColumns: () => plugin.layout.columns,
    activeLayoutPriority: () => 'row',
  } as IHomepagePlugin;
  return plugin;
}

const clock = (id: string, x: number, over: Partial<BlockInstance> = {}): BlockInstance =>
  ({ id, type: 'clock', x, y: 0, w: 1, h: 3, config: {}, ...over });

/** A homepage view whose pane is `width` px wide, with a 3-column grid rendered in view mode. */
function renderView(
  width: number,
  blocks: BlockInstance[] = [clock('a', 0), clock('b', 1), clock('c', 2)],
): { grid: GridLayout; view: HTMLElement; resize: (w: number) => void } {
  const view = document.body.createDiv({ cls: 'homepage-view' });
  Object.defineProperty(view, 'clientWidth', { configurable: true, get: () => width });
  const plugin = makePlugin(blocks);
  const grid = new GridLayout(view, plugin.app, plugin, (l) => { plugin.layout = l; });
  grid.render(plugin.activeBlocks(), 3);
  const resize = (w: number) => {
    width = w;
    const entry = { contentBoxSize: [{ inlineSize: w }], contentRect: { width: w } };
    for (const o of observers) if (o.targets.includes(view)) o.cb([entry]);
  };
  return { grid, view, resize };
}

beforeEach(() => {
  document.body.empty();
  observers = [];
  globalThis.ResizeObserver = class {
    private o: Observer;
    constructor(cb: Observer['cb']) { this.o = { cb, targets: [] }; observers.push(this.o); }
    observe(el: Element): void { this.o.targets.push(el); }
    unobserve(): void {}
    disconnect(): void { this.o.targets = []; }
  } as unknown as typeof ResizeObserver;
  BlockRegistry.clear();
  BlockRegistry.register({
    type: 'clock', displayName: 'Clock', defaultConfig: {}, defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });
});

afterEach(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
  BlockRegistry.clear();
});

describe('Responsive columns while the homepage tab is hidden', () => {
  it('keeps the columns when a hidden tab reports a width of 0 (M31)', () => {
    const { grid, view, resize } = renderView(1200);
    expect(grid.effectiveColumns).toBe(3);

    resize(0); // the user switches to another tab: Obsidian hides this one with display:none

    expect(grid.effectiveColumns).toBe(3);
    expect(view.querySelector('.homepage-grid')?.classList.contains('hp-single-column')).toBe(false);
  });

  it('renders a view that is hidden at render time at its saved columns (M31)', () => {
    const { grid } = renderView(0);

    expect(grid.effectiveColumns).toBe(3);
  });

  it('still drops to one column on a pane that is really narrow', () => {
    const { grid, resize } = renderView(1200);

    resize(300);

    expect(grid.effectiveColumns).toBe(1);
  });
});

describe('Responsive columns and collapsed blocks', () => {
  it('keeps a collapsed block one row high after the pane narrows and widens again (M5)', () => {
    // What collapsing saves: collapsed + _expandedH, while h keeps the expanded value.
    const collapsed = clock('a', 0, { collapsed: true, _expandedH: 4, h: 4, config: { _titleLabel: 'Clock' } });
    const { grid, resize } = renderView(1200, [collapsed, clock('b', 1), clock('c', 2)]);

    resize(300);
    resize(1200);

    const node = (grid.gridStack!.getGridItems().find(el => el.getAttribute('gs-id') === 'a') as HTMLElement & { gridstackNode?: { h: number } }).gridstackNode!;
    expect(node.h).toBe(1);
  });
});

describe('Responsive columns and GridStack animation', () => {
  it('leaves GridStack animating after a column change, so drags still animate', async () => {
    const { grid, resize } = renderView(1200);
    // Loading an empty grid turns animation off and GridStack re-enables it on a timeout.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(grid.getElement().classList.contains('grid-stack-animate')).toBe(true);

    resize(300);
    resize(1200);

    expect(grid.getElement().classList.contains('grid-stack-animate')).toBe(true);
  });
});
