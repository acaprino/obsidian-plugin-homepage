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

/** happy-dom lays nothing out: a ResizeObserver stub that lets the test report sizes by hand. */
function stubResizeObserver() {
  const observers: { cb: (entries: { target: Element; contentRect: { width: number; height: number } }[]) => void; targets: Element[] }[] = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    private rec: (typeof observers)[number];
    constructor(cb: (typeof observers)[number]['cb']) { this.rec = { cb, targets: [] }; observers.push(this.rec); }
    observe(t: Element): void { this.rec.targets.push(t); }
    unobserve(): void {}
    disconnect(): void { this.rec.targets = []; }
  } as unknown as typeof ResizeObserver;
  return {
    /** Report a size for `el` to every observer watching it. */
    resize(el: Element, width: number, height: number): void {
      for (const o of observers) if (o.targets.includes(el)) o.cb([{ target: el, contentRect: { width, height } }]);
    },
    restore(): void { globalThis.ResizeObserver = original; },
  };
}

const frame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

describe('EmbeddedNoteBlock grow mode after the first render (M34)', () => {
  it('asks to be measured again when the note changes size', async () => {
    const ro = stubResizeObserver();
    try {
      const v = makeVault({ 'N.md': 'Body' });
      const instance: BlockInstance = { id: 'e1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 3, config: { filePath: 'N.md', heightMode: 'grow' } };
      const el = document.body.createDiv();
      const block = new EmbeddedNoteBlock({ vault: v.vault } as unknown as App, instance, makePlugin([instance]));
      block.load();
      await block.render(el);
      let requests = 0;
      el.addEventListener('request-auto-height', () => { requests++; });
      const content = el.querySelector('.embedded-note-content') as HTMLElement;

      ro.resize(content, 300, 100);
      ro.resize(content, 300, 400);
      await frame();

      expect(requests).toBeGreaterThan(0);
    } finally { ro.restore(); }
  });
});

describe('EmbeddedNoteBlock Markdown styling (M92)', () => {
  it('renders into a markdown-rendered container', async () => {
    const v = makeVault({ 'N.md': 'Body' });
    const instance: BlockInstance = { id: 'e1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 3, config: { filePath: 'N.md' } };
    const el = document.body.createDiv();
    await new EmbeddedNoteBlock({ vault: v.vault } as unknown as App, instance, makePlugin([instance])).render(el);
    expect(el.querySelector('.embedded-note-content')?.classList.contains('markdown-rendered')).toBe(true);
  });
});
