import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { App } from 'obsidian';
import { GreetingBlock } from '../../src/blocks/GreetingBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

beforeEach(() => { document.body.empty(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('GreetingBlock ticks (M46)', () => {
  it('shows the new minute when it starts', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 30));
    const instance: BlockInstance = { id: 'g', type: 'greeting', x: 0, y: 0, w: 1, h: 3, config: { showTime: true } };
    const block = new GreetingBlock({} as App, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    block.render(el);

    vi.advanceTimersByTime(31_000);

    expect(el.querySelector('.greeting-time')?.textContent).toContain('12:01');
    block.unload();
  });
});
