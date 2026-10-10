import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { BlockSettingsModal } from '../../src/modals/BlockSettingsModal';
import { SpacerBlock } from '../../src/blocks/SpacerBlock';
import { registerBlocks } from '../../src/main';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

/** Open the settings of a block with `config`; returns helpers and the saved config. */
function openSettings(config: Record<string, unknown>) {
  const instance: BlockInstance = { id: 's', type: 'spacer', x: 0, y: 0, w: 1, h: 2, config };
  let saved: Record<string, unknown> | null = null;
  const modal = new BlockSettingsModal({} as App, instance, new SpacerBlock({} as App, instance, {} as IHomepagePlugin), (c) => { saved = c; });
  modal.onOpen();
  const root = modal.contentEl;
  const tab = (label: string) => ([...root.querySelectorAll('.hp-settings-tab')].find(t => t.textContent === label) as HTMLElement).click();
  const setting = (name: string) => [...root.querySelectorAll('.setting-item')].find(el => el.querySelector('.setting-item-name')?.textContent === name) as HTMLElement;
  const button = (text: string) => ([...root.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement).click();
  const save = () => { button('Save'); return saved; };
  return { root, tab, setting, button, save };
}

function pick(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

beforeEach(() => { document.body.empty(); registerBlocks(); });

describe('BlockSettingsModal colour pickers', () => {
  it('saves no accent after Clear accent color (M10)', () => {
    const s = openSettings({ _accentColor: '#c0392b' });
    s.tab('Card');
    (s.root.querySelector('[aria-label="Clear accent color"]') as HTMLElement).click();

    expect(s.save()?._accentColor).toBe('');
  });

  it('saves no gradient after Clear gradient (M10)', () => {
    const s = openSettings({ _gradientStart: '#111111', _gradientEnd: '#222222' });
    s.tab('Body');
    s.button('Clear gradient');

    const saved = s.save();
    expect(saved?._gradientStart).toBe('');
    expect(saved?._gradientEnd).toBe('');
  });

  it('saves the gradient shown when only one of its colours is changed (M105)', () => {
    const s = openSettings({});
    s.tab('Body');
    pick(s.setting('Start color').querySelector('input') as HTMLInputElement, '#ff0000');

    const saved = s.save();
    expect(saved?._gradientStart).toBe('#ff0000');
    expect(saved?._gradientEnd).toBe('#764ba2');
  });
});

describe('BlockSettingsModal Header tab of a block that draws no title (M104)', () => {
  it('offers no title controls that would do nothing', () => {
    const instance: BlockInstance = { id: 'c', type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {} };
    const modal = new BlockSettingsModal({} as App, instance, new SpacerBlock({} as App, instance, {} as IHomepagePlugin), () => {});
    modal.onOpen();
    const root = modal.contentEl;
    ([...root.querySelectorAll('.hp-settings-tab')].find(t => t.textContent === 'Header') as HTMLElement).click();
    const names = [...root.querySelectorAll('.setting-item-name')].map(n => n.textContent);

    expect(names).not.toContain('Title label');
    expect(names).not.toContain('Show title');
  });

  it('previews the title the block draws by default', () => {
    const instance: BlockInstance = { id: 't', type: 'static-text', x: 0, y: 0, w: 1, h: 3, config: {} };
    const modal = new BlockSettingsModal({} as App, instance, new SpacerBlock({} as App, instance, {} as IHomepagePlugin), () => {});
    modal.onOpen();
    expect(modal.contentEl.querySelector('.settings-preview-card .block-header')?.textContent).toBe('Text');
  });
});
