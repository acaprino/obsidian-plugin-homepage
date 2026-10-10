import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { languageMock, type App } from 'obsidian';
import { BlockRegistry } from '../../src/BlockRegistry';
import { registerBlocks } from '../../src/main';
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

describe('GreetingBlock defaults (M94)', () => {
  afterEach(() => { languageMock.value = 'en'; });

  function mountNew(config: Record<string, unknown> = {}) {
    registerBlocks();
    const factory = BlockRegistry.get('greeting')!;
    const instance: BlockInstance = { id: 'g', type: 'greeting', x: 0, y: 0, w: 1, h: 3, config: { ...structuredClone(factory.defaultConfig), ...config } };
    const el = document.body.createDiv();
    const block = new GreetingBlock({} as App, instance, {} as IHomepagePlugin);
    block.load();
    block.render(el);
    return { el, block };
  }

  it('greets in the app language, with no name and no trailing comma', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 9, 0, 0));
    languageMock.value = 'de';
    const { el, block } = mountNew();
    expect(el.querySelector('.greeting-name')?.textContent).toBe('Guten Morgen');
    block.unload();
  });

  it('falls back to English for a language without a preset', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 9, 0, 0));
    languageMock.value = 'xx';
    const { el, block } = mountNew();
    expect(el.querySelector('.greeting-name')?.textContent).toBe('Good morning');
    block.unload();
  });

  it('keeps a preset and a name chosen before', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 9, 0, 0));
    languageMock.value = 'de';
    const { el, block } = mountNew({ salutationPreset: 'it', name: 'Alfio' });
    expect(el.querySelector('.greeting-name')?.textContent).toBe('Buongiorno, Alfio');
    block.unload();
  });
});

describe('GreetingBlock custom salutations (M93)', () => {
  it('shows the selected preset as a hint, not Italian text as the value', () => {
    vi.useRealTimers();
    const instance: BlockInstance = { id: 'g', type: 'greeting', x: 0, y: 0, w: 1, h: 3, config: {} };
    const block = new GreetingBlock({} as App, instance, {} as IHomepagePlugin);
    const body = document.body.createDiv();
    block.renderContentSettings(body, { salutationMode: 'custom', salutationPreset: 'en' });
    const inputs = [...body.querySelectorAll('input[type="text"]')] as HTMLInputElement[];
    const morning = inputs.find(i => i.placeholder === 'Good morning');

    expect(morning).toBeTruthy();
    expect(morning?.value).toBe('');
  });
});
