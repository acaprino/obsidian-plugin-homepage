import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { VaultSearchBlock } from '../../src/blocks/VaultSearchBlock';
import type { IHomepagePlugin, BlockInstance } from '../../src/types';

/**
 * Regression test for CONTRACT-1: VaultSearchBlock must opt into the
 * rerender-suppression guard whenever it holds a non-empty typed query, so an
 * external rerender can't wipe an in-progress search.
 */

function makeBlock(): VaultSearchBlock {
  const app = {
    vault: { getMarkdownFiles: () => [] },
    workspace: { openLinkText: () => {} },
  } as unknown as App;
  const instance: BlockInstance = { id: 's1', type: 'vault-search', x: 0, y: 0, w: 2, h: 2, config: {} };
  const plugin = { app } as unknown as IHomepagePlugin;
  return new VaultSearchBlock(app, instance, plugin);
}

describe('VaultSearchBlock.hasUnsavedInlineState (CONTRACT-1)', () => {
  let block: VaultSearchBlock;
  let input: HTMLInputElement;

  beforeEach(() => {
    document.body.empty();
    block = makeBlock();
    const el = document.body.createDiv();
    block.render(el);
    input = el.querySelector('.vault-search-input') as HTMLInputElement;
  });

  it('is false when the field is empty', () => {
    expect(input).toBeTruthy();
    expect(block.hasUnsavedInlineState()).toBe(false);
  });

  it('is true when a non-empty query is typed', () => {
    input.value = 'meeting notes';
    expect(block.hasUnsavedInlineState()).toBe(true);
  });

  it('treats a whitespace-only query as empty', () => {
    input.value = '   ';
    expect(block.hasUnsavedInlineState()).toBe(false);
  });
});

describe('VaultSearchBlock result picking (N11)', () => {
  it('opens a result on click, not when a touch starts, which may begin a scroll', async () => {
    const opened: string[] = [];
    const app = {
      vault: { getMarkdownFiles: () => [{ basename: 'Meeting', path: 'Meeting.md' }] },
      workspace: { getLeaf: () => ({ openFile: async (f: { path: string }) => { opened.push(f.path); } }) },
    } as unknown as App;
    const instance: BlockInstance = { id: 's1', type: 'vault-search', x: 0, y: 0, w: 2, h: 2, config: {} };
    const block = new VaultSearchBlock(app, instance, { app } as unknown as IHomepagePlugin);
    const el = document.body.createDiv();
    block.render(el);
    const input = el.querySelector('.vault-search-input') as HTMLInputElement;
    input.value = 'meet';
    input.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 200));
    const item = document.querySelector('.vault-search-result') as HTMLElement;

    item.dispatchEvent(new Event('touchstart', { cancelable: true }));
    expect(opened).toEqual([]);

    item.click();
    expect(opened).toEqual(['Meeting.md']);
  });
});

describe('VaultSearchBlock opening (M21, M65)', () => {
  beforeEach(() => { document.body.empty(); });
  async function searchFor(name: string, path: string) {
    const opened: { path: string; mode: unknown }[] = [];
    const linkText: string[] = [];
    const app = {
      vault: { getMarkdownFiles: () => [{ basename: name, path }] },
      workspace: {
        getLeaf: (mode: unknown) => ({ openFile: async (f: { path: string }) => { opened.push({ path: f.path, mode }); } }),
        openLinkText: async (t: string) => { linkText.push(t); },
      },
    } as unknown as App;
    const instance: BlockInstance = { id: 's1', type: 'vault-search', x: 0, y: 0, w: 2, h: 2, config: {} };
    const el = document.body.createDiv();
    new VaultSearchBlock(app, instance, { app } as unknown as IHomepagePlugin).render(el);
    const input = el.querySelector('.vault-search-input') as HTMLInputElement;
    input.value = name.slice(0, 3);
    input.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 200));
    return { opened, linkText, input };
  }

  it('opens the file itself, in a new tab on Ctrl-click or middle click', async () => {
    const s = await searchFor('#5 Bug', 'Issues/#5 Bug.md');
    const item = () => document.querySelector('.vault-search-result') as HTMLElement;
    item().dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
    expect(s.opened).toEqual([{ path: 'Issues/#5 Bug.md', mode: 'tab' }]);
    expect(s.linkText).toEqual([]);
  });

  it('opens on a middle click, and Ctrl+Enter opens a tab', async () => {
    const s = await searchFor('Meeting', 'Meeting.md');
    (document.querySelector('.vault-search-result') as HTMLElement).dispatchEvent(new MouseEvent('auxclick', { button: 1 }));
    const s2 = await searchFor('Meeting', 'Meeting.md');
    s2.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    expect(s.opened.map(o => o.mode)).toEqual(['tab']);
    expect(s2.opened.map(o => o.mode)).toEqual(['tab']);
  });

  it('does not open on a right-click', async () => {
    const s = await searchFor('Meeting', 'Meeting.md');
    (document.querySelector('.vault-search-result') as HTMLElement).dispatchEvent(new MouseEvent('auxclick', { button: 2 }));
    expect(s.opened).toEqual([]);
  });
});
