import { describe, it, expect, vi } from 'vitest';
import { GridStack } from 'gridstack';
import { AUTO_HEIGHT_ATTR, AutoHeightManager, type AutoHeightHost } from '../../src/grid/AutoHeight';
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

  it('resizes and repacks the blocks of a static grid without lifting it', () => {
    const gridStack = new GridStack(document.body.createDiv(), { staticGrid: true, column: 3, cellHeight: 80, margin: 8 });
    const el = gridStack.addWidget({ id: 'a', x: 0, y: 0, w: 1, h: 1 });
    const below = gridStack.addWidget({ id: 'b', x: 0, y: 1, w: 1, h: 1 });
    // happy-dom lays nothing out: give the measured elements their heights.
    const wrapper = el.querySelector<HTMLElement>('.grid-stack-item-content')!.createDiv({ cls: 'homepage-block-wrapper' });
    wrapper.style.paddingTop = '12px';
    wrapper.style.paddingBottom = '12px';
    const header = wrapper.createDiv({ cls: 'block-header-zone' });
    const content = wrapper.createDiv({ cls: 'block-content' }).createDiv();
    content.setAttribute(AUTO_HEIGHT_ATTR, '');
    Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 24 });
    Object.defineProperty(content, 'offsetHeight', { configurable: true, value: 200 });
    const setStatic = vi.spyOn(gridStack, 'setStatic');
    const host: AutoHeightHost = {
      scheduler: { raf: (_key: string, fn: () => void) => fn() } as unknown as Scheduler,
      phase: Phase.Ready,
      gridStack,
      effectiveColumns: 3,
      // What GridLayout's repack does: move every block through one batch.
      repackGridNodes: () => {
        gridStack.batchUpdate();
        gridStack.update(below, { y: 4 });
        gridStack.batchUpdate(false);
      },
      persistLayoutDebounced: () => {},
    };

    new AutoHeightManager(host).request(el, { id: 'a', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} });

    expect(el.gridstackNode?.h).toBe(4); // (24 + 12 + 12 + 200 + 2 * 8 + 4) / 80, rounded up
    expect(below.gridstackNode?.y).toBe(4);
    expect(gridStack.opts.staticGrid).toBe(true);
    expect(setStatic).not.toHaveBeenCalled();
  });
});
