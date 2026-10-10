import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarkdownRenderer } from 'obsidian';
import type { App } from 'obsidian';
import { StaticTextBlock } from '../../src/blocks/StaticTextBlock';
import type { BlockInstance, IHomepagePlugin, LayoutConfig } from '../../src/types';
import { getDefaultLayout } from '../../src/validation';

/**
 * A plugin double with the production contract of updateBlockConfig: it waits
 * for the save queue, then replaces the block's objects in the layout. The
 * block instance a view was rendered from is never mutated.
 */
function makePlugin(blocks: BlockInstance[]): IHomepagePlugin & { layout: LayoutConfig } {
  const plugin = {
    layout: { ...getDefaultLayout(), blocks },
    activeBlocks: () => plugin.layout.blocks,
    // Production contract: the in-memory layout changes before the returned promise.
    saveActiveBlocks: async (next: BlockInstance[]) => {
      plugin.layout = { ...plugin.layout, blocks: next };
    },
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

const settle = () => new Promise(resolve => setTimeout(resolve, 5));

function mount(content: string, app: App = {} as App): { el: HTMLElement; plugin: IHomepagePlugin & { layout: LayoutConfig }; block: StaticTextBlock } {
  const instance: BlockInstance = { id: 't1', type: 'static-text', x: 0, y: 0, w: 1, h: 3, config: { content } };
  const plugin = makePlugin([instance]);
  const el = document.body.createDiv();
  const block = new StaticTextBlock(app, instance, plugin);
  block.load(); // as GridLayout.mountBlock does before render
  block.render(el);
  return { el, plugin, block };
}

function openDraft(el: HTMLElement, text: string): void {
  (el.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
  (el.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).value = text;
}

/** An app whose workspace records every openLinkText call: the host API a link click must reach. */
function appRecordingLinks(): { app: App; opened: unknown[][] } {
  const opened: unknown[][] = [];
  const app = { workspace: { openLinkText: async (...args: unknown[]) => { opened.push(args); } } };
  return { app: app as unknown as App, opened };
}

function clickLink(el: HTMLElement, init: MouseEventInit = {}, type = 'click'): MouseEvent {
  const evt = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  (el.querySelector('a.internal-link') as HTMLElement).dispatchEvent(evt);
  return evt;
}

function editAndSave(el: HTMLElement, text: string): void {
  (el.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
  const textarea = el.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement;
  textarea.value = text;
  (el.querySelector('.inline-edit-save') as HTMLButtonElement).click();
}

beforeEach(() => { document.body.empty(); });

describe('StaticTextBlock inline edit', () => {
  it('shows the saved text after Save (RF-R3)', async () => {
    const { el } = mount('old text');
    await settle();

    editAndSave(el, 'new text');
    await settle();

    expect(el.querySelector('.static-text-content')?.textContent).toBe('new text');
  });

  it('asks the grid to re-measure its height once the saved text is shown', async () => {
    const { el } = mount('short');
    await settle();
    let requests = 0;
    document.body.addEventListener('request-auto-height', () => { requests++; });

    editAndSave(el, 'a much longer text\n\nwith several paragraphs\n\nthat needs a taller card');
    await settle();

    expect(requests).toBeGreaterThan(0);
  });

  it('locks the editor while the save is pending, so nothing typed afterwards is lost', async () => {
    const { el } = mount('old text');
    await settle();

    editAndSave(el, 'new text');

    expect((el.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).disabled).toBe(true);
    expect((el.querySelector('.inline-edit-save') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('.inline-edit-cancel') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reopens the editor on the saved text, so a second edit keeps the first (RF-R3)', async () => {
    const { el, plugin } = mount('old text');
    await settle();
    editAndSave(el, 'first edit');
    await settle();

    (el.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
    const textarea = el.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('first edit');

    textarea.value += ', then more';
    (el.querySelector('.inline-edit-save') as HTMLButtonElement).click();
    await settle();
    expect(plugin.layout.blocks[0].config.content).toBe('first edit, then more');
  });
});

describe('StaticTextBlock draft when the block is unloaded', () => {
  it('keeps an open draft, e.g. when edit mode starts or the tab closes (M4)', async () => {
    const { el, plugin, block } = mount('old text');
    await settle();
    openDraft(el, 'typed but not saved');

    block.unload();

    // Already in the layout when unload returns: a Discard snapshot taken right
    // after entering edit mode must contain it.
    expect(plugin.layout.blocks[0].config.content).toBe('typed but not saved');
  });

  it('leaves the text alone when it was replaced meanwhile, e.g. by Reset or Import', async () => {
    const { el, plugin, block } = mount('old text');
    await settle();
    openDraft(el, 'typed but not saved');
    plugin.layout = {
      ...plugin.layout,
      blocks: plugin.layout.blocks.map(b => ({ ...b, config: { content: 'imported text' } })),
    };

    block.unload();

    expect(plugin.layout.blocks[0].config.content).toBe('imported text');
  });

  it('does not save a draft the user cancelled', async () => {
    const { el, plugin, block } = mount('old text');
    await settle();
    openDraft(el, 'thrown away');
    (el.querySelector('.inline-edit-cancel') as HTMLButtonElement).click();

    block.unload();

    expect(plugin.layout.blocks[0].config.content).toBe('old text');
  });
});

describe('StaticTextBlock links', () => {
  it('opens a clicked [[wikilink]] in the current tab, instead of a blocked new window (M1)', async () => {
    const { app, opened } = appRecordingLinks();
    const { el } = mount('Go to [[Projects]]', app);
    await settle();

    const evt = clickLink(el);

    expect(opened).toEqual([['Projects', '', false]]);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('opens a Ctrl-clicked or middle-clicked link in a new tab, as reading view does', async () => {
    const { app, opened } = appRecordingLinks();
    const { el } = mount('[[Projects|my projects]]', app);
    await settle();

    clickLink(el, { ctrlKey: true });
    clickLink(el, { button: 1 }, 'auxclick');

    expect(opened).toEqual([['Projects', '', 'tab'], ['Projects', '', 'tab']]);
  });

  it('still opens links after an inline save has rendered the text again', async () => {
    const { app, opened } = appRecordingLinks();
    const { el } = mount('old text', app);
    await settle();
    editAndSave(el, 'now see [[Reading list]]');
    await settle();

    clickLink(el);

    expect(opened).toEqual([['Reading list', '', false]]);
  });
});

describe('StaticTextBlock render failures (R5)', () => {
  it('shows an error hint when the saved text cannot be rendered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { el } = mount('old text');
    await settle();
    vi.spyOn(MarkdownRenderer, 'render').mockRejectedValueOnce(new Error('render failed'));

    editAndSave(el, 'new text');
    await settle();

    expect(el.querySelector('.block-error-hint')).toBeTruthy();
    vi.restoreAllMocks();
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

describe('StaticTextBlock auto-height after the first render (M34)', () => {
  it('asks to be measured again when its content changes size', async () => {
    const ro = stubResizeObserver();
    try {
      const { el } = mount('Some **text**');
      await new Promise(resolve => setTimeout(resolve, 5));
      const content = el.querySelector('.static-text-content') as HTMLElement;
      let requests = 0;
      el.addEventListener('request-auto-height', () => { requests++; });

      ro.resize(content, 300, 120);
      ro.resize(content, 300, 480); // an image loaded, a callout opened
      await frame();

      expect(requests).toBeGreaterThan(0);
    } finally { ro.restore(); }
  });

  it('lets the grid wait for its Markdown before measuring', () => {
    const instance: BlockInstance = { id: 't1', type: 'static-text', x: 0, y: 0, w: 1, h: 3, config: { content: 'x' } };
    const block = new StaticTextBlock({} as App, instance, makePlugin([instance]));
    block.load();
    expect(block.render(document.body.createDiv())).toBeInstanceOf(Promise);
  });
});
