import { describe, it, expect } from 'vitest';
import type { GridStack } from 'gridstack';
import { AutoHeightManager, type AutoHeightHost } from '../../src/grid/AutoHeight';
import { Phase } from '../../src/grid/phase';
import type { Scheduler } from '../../src/utils/Scheduler';
import type { BlockInstance } from '../../src/types';

describe('AutoHeightManager keeps view mode static (M120)', () => {
  it('restores staticGrid even when a measurement throws', () => {
    const grid = { opts: { staticGrid: true }, setStatic(v: boolean) { this.opts.staticGrid = v; } };
    let thrown: unknown = null;
    // Runs the batch at once; the throw is what a real frame would report.
    const scheduler = { raf: (_key: string, fn: () => void) => { try { fn(); } catch (e) { thrown = e; } } } as unknown as Scheduler;
    const host: AutoHeightHost = {
      scheduler,
      phase: Phase.Ready,
      gridStack: grid as unknown as GridStack,
      effectiveColumns: 3,
      repackGridNodes: () => {},
      persistLayoutDebounced: () => {},
    };
    const el = document.body.createDiv();
    el.querySelector = () => { throw new Error('measurement failed'); };
    const instance: BlockInstance = { id: 'a', type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {} };

    new AutoHeightManager(host).request(el, instance);

    expect(thrown).toBeInstanceOf(Error);
    expect(grid.opts.staticGrid).toBe(true);
  });
});
