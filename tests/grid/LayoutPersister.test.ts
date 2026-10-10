import { describe, it, expect } from 'vitest';
import type { GridStack } from 'gridstack';
import { LayoutPersister, type LayoutPersisterHost } from '../../src/grid/LayoutPersister';
import { Phase } from '../../src/grid/phase';
import { Scheduler } from '../../src/utils/Scheduler';
import { getDefaultLayout } from '../../src/validation';
import type { BlockInstance, IHomepagePlugin, LayoutConfig } from '../../src/types';

type Pos = { x: number; y: number; w: number; h: number };

function gsItem(id: string, node: Pos): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('gs-id', id);
  (el as HTMLElement & { gridstackNode?: Pos }).gridstackNode = node;
  return el;
}

function persistWith(blocks: BlockInstance[], nodes: Record<string, Pos>, editMode = false): BlockInstance[] | null {
  const emitted: LayoutConfig[] = [];
  const items = Object.entries(nodes).map(([id, n]) => gsItem(id, n));
  const host: LayoutPersisterHost = {
    gridStack: { getGridItems: () => items } as unknown as GridStack,
    phase: Phase.Ready,
    plugin: { activeBlocks: () => blocks, activeLayoutPriority: () => 'row' } as unknown as IHomepagePlugin,
    effectiveColumns: 3,
    canonicalColumns: 3,
    editMode,
    scheduler: new Scheduler(),
    shouldAutoHeight: () => false,
    buildLayoutUpdate: (b) => ({ ...getDefaultLayout(), blocks: b }),
    emitLayout: (l) => { emitted.push(l); },
  };
  new LayoutPersister(host).persist();
  return emitted[0]?.blocks ?? null;
}

const block = (id: string, over: Partial<BlockInstance> = {}): BlockInstance =>
  ({ id, type: 'clock', x: 0, y: 0, w: 1, h: 4, config: {}, ...over });

describe('LayoutPersister and collapsed blocks (R2)', () => {
  it('keeps the stored height of a collapsed block that view mode draws one row high', () => {
    const blocks = [block('a', { collapsed: true, _expandedH: 4 }), block('b', { x: 1 })];
    const saved = persistWith(blocks, { a: { x: 0, y: 0, w: 1, h: 1 }, b: { x: 1, y: 2, w: 1, h: 4 } });

    expect(saved?.find(b => b.id === 'a')?.h).toBe(4);
    expect(saved?.find(b => b.id === 'b')?.y).toBe(2);
  });

  it('saves a resize of a collapsed block made in edit mode, where it is drawn at its stored height', () => {
    const blocks = [block('a', { collapsed: true, _expandedH: 4 })];
    const saved = persistWith(blocks, { a: { x: 0, y: 0, w: 1, h: 6 } }, true);

    expect(saved?.[0].h).toBe(6);
  });

  it('still saves the height of an expanded fixed-height block', () => {
    const saved = persistWith([block('a')], { a: { x: 0, y: 0, w: 1, h: 2 } });

    expect(saved?.[0].h).toBe(2);
  });
});
