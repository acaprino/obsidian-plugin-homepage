import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { App } from 'obsidian';
import { ClockBlock } from '../../src/blocks/ClockBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

beforeEach(() => { document.body.empty(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function mountClock(config: Record<string, unknown>) {
  const instance: BlockInstance = { id: 'c', type: 'clock', x: 0, y: 0, w: 1, h: 3, config };
  const block = new ClockBlock({} as App, instance, {} as IHomepagePlugin);
  const el = document.body.createDiv();
  block.load();
  block.render(el);
  return { el, block };
}

describe('ClockBlock ticks (M46)', () => {
  it('shows the new minute when it starts, not up to 59 s later', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 30));
    const { el, block } = mountClock({ showSeconds: false, showDate: false });
    expect(el.querySelector('.clock-time')?.textContent).toBe('12:00');

    vi.advanceTimersByTime(31_000); // 12:01:01

    expect(el.querySelector('.clock-time')?.textContent).toBe('12:01');
    block.unload();
  });

  it('updates a custom format with seconds every second', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
    const { el, block } = mountClock({ showSeconds: false, showDate: false, format: 'HH:mm:ss' });
    vi.advanceTimersByTime(2_000);
    expect(el.querySelector('.clock-time')?.textContent).toBe('12:00:02');
    block.unload();
  });
});
