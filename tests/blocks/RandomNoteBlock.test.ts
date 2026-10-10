import { describe, it, expect, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { RandomNoteBlock } from '../../src/blocks/RandomNoteBlock';
import { AUTO_HEIGHT_ATTR } from '../../src/grid/AutoHeight';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

type Handler = (...args: unknown[]) => void;

function note(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.replace(/\.md$/, '');
  f.extension = 'md';
  return f;
}

/** Each test uses its own tag: the module-level tag cache in utils/tags.ts outlives a test. */
function mount(tag: string, files: TFile[]) {
  const handlers: Record<string, Handler[]> = {};
  let reads = 0;
  const on = (event: string, h: Handler) => { (handlers[event] ??= []).push(h); return {}; };
  const app = {
    vault: { on, getMarkdownFiles: () => files, read: async () => { reads++; return 'First line'; }, getAbstractFileByPath: () => null, getResourcePath: () => '' },
    metadataCache: { on, getFileCache: () => ({ tags: [{ tag }] }), getFirstLinkpathDest: () => null },
    workspace: { openLinkText: async () => {} },
  } as unknown as App;
  const instance: BlockInstance = { id: 'r1', type: 'random-note', x: 0, y: 0, w: 1, h: 4, config: { tag } };
  const plugin = { activeBlocks: () => [instance] } as unknown as IHomepagePlugin;
  const block = new RandomNoteBlock(app, instance, plugin);
  const el = document.body.createDiv({ cls: 'block-content' });
  block.load();
  block.render(el);
  const fire = (event: string, ...args: unknown[]) => { for (const h of handlers[event] ?? []) h(...args); };
  return { el, fire, reads: () => reads };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 5));

beforeEach(() => { document.body.empty(); });

describe('RandomNoteBlock auto-height (M33)', () => {
  it('marks its card for measurement, not the content element that fills the cell', async () => {
    const { el } = mount('#m33', [note('Alpha.md')]);
    await settle();

    expect(el.hasAttribute(AUTO_HEIGHT_ATTR)).toBe(false);
    const body = el.querySelector('.random-note-body');
    expect(body?.hasAttribute(AUTO_HEIGHT_ATTR)).toBe(true);
    expect(body?.querySelector('.random-note-title')?.textContent).toBe('Alpha');
  });
});

describe('RandomNoteBlock live updates (R9)', () => {
  it('re-renders when the note it shows loses the tag', async () => {
    const alpha = note('Alpha.md');
    const { fire, reads } = mount('#r9', [alpha]);
    await settle();
    expect(reads()).toBe(1);

    fire('changed', alpha, '', { tags: [] });
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(reads()).toBe(2);
  });
});

/** A workspace double that records each open: the file and the leaf mode asked for. */
function recordingWorkspace() {
  const opened: { path: string; mode: unknown }[] = [];
  const linkText: string[] = [];
  return {
    opened, linkText,
    workspace: {
      getLeaf: (mode: unknown) => ({ openFile: async (f: { path: string }) => { opened.push({ path: f.path, mode }); } }),
      openLinkText: async (t: string) => { linkText.push(t); },
      onLayoutReady: (cb: () => void) => { cb(); },
    },
  };
}


describe('RandomNoteBlock opening (M21, M65)', () => {
  it('opens the picked file itself, in a new tab on Ctrl-click', async () => {
    const ws = recordingWorkspace();
    const tag = '#idea';
    const f = Object.assign(new TFile(), { path: 'Ideas/#1 Idea.md', basename: '#1 Idea', extension: 'md' });
    const on = () => ({});
    const app = {
      vault: { on, getMarkdownFiles: () => [f], read: async () => 'Body', getAbstractFileByPath: () => null, getResourcePath: () => '' },
      metadataCache: { on, getFileCache: () => ({ tags: [{ tag }] }), getFirstLinkpathDest: () => null },
      workspace: ws.workspace,
    } as unknown as App;
    const instance: BlockInstance = { id: 'r1', type: 'random-note', x: 0, y: 0, w: 1, h: 4, config: { tag } };
    const block = new RandomNoteBlock(app, instance, { activeBlocks: () => [instance] } as unknown as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    block.render(el);
    await new Promise(resolve => setTimeout(resolve, 20));

    (el.querySelector('.random-note-title') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
    (el.querySelector('.random-note-open-btn') as HTMLButtonElement).dispatchEvent(new MouseEvent('auxclick', { button: 1 }));

    expect(ws.opened).toEqual([{ path: 'Ideas/#1 Idea.md', mode: 'tab' }, { path: 'Ideas/#1 Idea.md', mode: 'tab' }]);
    expect(ws.linkText).toEqual([]);
  });
});
