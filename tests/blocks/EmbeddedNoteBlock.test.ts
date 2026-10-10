import { describe, it, expect, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { EmbeddedNoteBlock } from '../../src/blocks/EmbeddedNoteBlock';
import type { BlockInstance, IHomepagePlugin, LayoutConfig } from '../../src/types';
import { getDefaultLayout } from '../../src/validation';

type VaultHandler = (...args: unknown[]) => void;

function note(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.replace(/\.md$/, '');
  f.extension = 'md';
  return f;
}

/** A vault double that serves note text by path and records the handlers blocks register. */
function makeVault(texts: Record<string, string>) {
  const handlers: Record<string, VaultHandler[]> = {};
  return {
    texts,
    fire: (event: string, ...args: unknown[]) => { for (const h of handlers[event] ?? []) h(...args); },
    vault: {
      on: (event: string, handler: VaultHandler) => { (handlers[event] ??= []).push(handler); return {}; },
      getAbstractFileByPath: (path: string) => (path in texts ? note(path) : null),
      read: async (file: TFile) => texts[file.path],
    },
  };
}

/** Plugin double with updateBlockConfig's production contract: new objects, never the rendered instance. */
function makePlugin(blocks: BlockInstance[]): IHomepagePlugin & { layout: LayoutConfig } {
  const plugin = {
    layout: { ...getDefaultLayout(), blocks },
    activeBlocks: () => plugin.layout.blocks,
    updateBlockConfig: async (id: string, patch: Record<string, unknown>) => {
      await new Promise(resolve => setTimeout(resolve, 0));
      plugin.layout = {
        ...plugin.layout,
        blocks: plugin.layout.blocks.map(b => (b.id === id ? { ...b, config: { ...b.config, ...patch } } : b)),
      };
    },
  };
  return plugin as unknown as IHomepagePlugin & { layout: LayoutConfig };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => { document.body.empty(); });

describe('EmbeddedNoteBlock after its note is renamed', () => {
  it('re-renders when the renamed note is edited (AP-2)', async () => {
    const v = makeVault({ 'Old.md': 'first version' });
    const instance: BlockInstance = { id: 'e1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 3, config: { filePath: 'Old.md' } };
    const plugin = makePlugin([instance]);
    const el = document.body.createDiv();
    await new EmbeddedNoteBlock({ vault: v.vault } as unknown as App, instance, plugin).render(el);
    expect(el.querySelector('.embedded-note-content')?.textContent).toBe('first version');

    // Obsidian renames the file, then the user edits it.
    v.texts['New.md'] = v.texts['Old.md'];
    delete v.texts['Old.md'];
    v.fire('rename', note('New.md'), 'Old.md');
    await wait(400); // config patch lands, then the 300 ms debounced re-render runs
    v.texts['New.md'] = 'edited after the rename';
    v.fire('modify', note('New.md'));
    await wait(400);

    expect(el.querySelector('.embedded-note-content')?.textContent).toBe('edited after the rename');
  });
});

describe('EmbeddedNoteBlock links', () => {
  async function mountHub(opened: unknown[][]): Promise<HTMLElement> {
    const v = makeVault({ 'Maps/Hub.md': 'See [[Projects]]' });
    const app = { vault: v.vault, workspace: { openLinkText: async (...args: unknown[]) => { opened.push(args); } } };
    const instance: BlockInstance = { id: 'e1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 3, config: { filePath: 'Maps/Hub.md' } };
    const el = document.body.createDiv();
    await new EmbeddedNoteBlock(app as unknown as App, instance, makePlugin([instance])).render(el);
    return el;
  }

  it('opens a clicked link, resolved from the embedded note the way reading view resolves it (M1)', async () => {
    const opened: unknown[][] = [];
    const el = await mountHub(opened);

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    (el.querySelector('a.internal-link') as HTMLElement).dispatchEvent(evt);

    expect(opened).toEqual([['Projects', 'Maps/Hub.md', false]]);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('leaves a link that a nested embed already opened alone, so the note does not open twice', async () => {
    const opened: unknown[][] = [];
    const el = await mountHub(opened);
    // Obsidian wires links inside a ![[embed]] itself: its handler sits on the
    // embed's container and marks the click handled before it bubbles further.
    const link = el.querySelector('a.internal-link') as HTMLElement;
    link.parentElement?.addEventListener('click', e => e.preventDefault());

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(opened).toEqual([]);
  });
});

describe('EmbeddedNoteBlock header (N17)', () => {
  it('drops the title of a note that was deleted', async () => {
    const v = makeVault({ 'Old.md': 'text' });
    const instance: BlockInstance = { id: 'e1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 3, config: { filePath: 'Old.md' } };
    const header = document.body.createDiv();
    const el = document.body.createDiv();
    const block = new EmbeddedNoteBlock({ vault: v.vault } as unknown as App, instance, makePlugin([instance]));
    block.setHeaderContainer(header);
    await block.render(el);
    expect(header.textContent).toContain('Old');

    delete v.texts['Old.md'];
    v.fire('delete', note('Old.md'));
    await wait(400);

    expect(header.textContent).not.toContain('Old');
  });
});
