import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { App } from 'obsidian';
import { ButtonGridBlock } from '../../src/blocks/ButtonGridBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;

// happy-dom never lays anything out, so its ResizeObserver never reports a width.
// Capture the block's callback and report a width change by hand.
let observed: ResizeCallback[] = [];
const OriginalResizeObserver = globalThis.ResizeObserver;
beforeEach(() => {
  document.body.empty();
  observed = [];
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeCallback) { observed.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => { globalThis.ResizeObserver = OriginalResizeObserver; });

const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

describe('ButtonGridBlock', () => {
  it('asks the grid to re-measure its height when its width changes', async () => {
    const instance: BlockInstance = {
      id: 'b1', type: 'button-grid', x: 0, y: 0, w: 1, h: 5,
      config: { columns: 2, items: [{ emoji: '📝', label: 'New note' }] },
    };
    const el = document.body.createDiv();
    new ButtonGridBlock({} as App, instance, {} as IHomepagePlugin).render(el);
    let requests = 0;
    document.body.addEventListener('request-auto-height', () => { requests++; });

    for (const cb of observed) cb([{ contentRect: { width: 320 } }]);
    await nextFrame();

    expect(requests).toBeGreaterThan(0);
  });
});
