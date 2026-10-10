import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { App } from 'obsidian';
import { PomodoroBlock, clearPomodoroState } from '../../src/blocks/PomodoroBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

function mount() {
  const instance: BlockInstance = { id: 'p1', type: 'pomodoro', x: 0, y: 0, w: 1, h: 4, config: { soundType: 'none' } };
  const block = new PomodoroBlock({} as App, instance, {} as IHomepagePlugin);
  const el = document.body.createDiv();
  block.load();
  block.render(el);
  return {
    block,
    el,
    time: () => el.querySelector('.pomodoro-time')?.textContent,
    label: () => el.querySelector('.pomodoro-btn.is-primary .pomodoro-btn-label')?.textContent,
  };
}
const press = (el: HTMLElement) => (el.querySelector('.pomodoro-btn.is-primary') as HTMLButtonElement).click();

beforeEach(() => { document.body.empty(); vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { clearPomodoroState(); vi.useRealTimers(); });

describe('PomodoroBlock timer state', () => {
  it('keeps a paused timer when the block is mounted again (R7)', () => {
    const first = mount();
    press(first.el);
    vi.advanceTimersByTime(60_000);
    press(first.el);
    first.block.unload();

    const second = mount();
    expect(second.time()).toBe('24:00');
    expect(second.label()).toBe('Resume');
  });

  it('keeps counting while no block is mounted (N12)', () => {
    const first = mount();
    press(first.el);
    first.block.unload();
    vi.advanceTimersByTime(5 * 60_000);

    expect(mount().time()).toBe('20:00');
  });
});
