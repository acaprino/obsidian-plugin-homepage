import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Notice, TFile, type App } from 'obsidian';
import { BookmarkBlock } from '../../src/blocks/BookmarkBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

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

function tfile(path: string, mtime = 0): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  f.extension = 'md';
  f.stat = { mtime, ctime: 0, size: 0 };
  return f;
}

beforeEach(() => { document.body.empty(); Notice.messages = []; vi.restoreAllMocks(); });

function mount(url: string, notes: Record<string, TFile> = {}) {
  const ws = recordingWorkspace();
  const app = { metadataCache: { getFirstLinkpathDest: (l: string) => notes[l] ?? null }, workspace: ws.workspace } as unknown as App;
  const instance: BlockInstance = { id: 'b', type: 'bookmarks', x: 0, y: 0, w: 1, h: 3, config: { items: [{ label: 'x', url }] } };
  const el = document.body.createDiv();
  new BookmarkBlock(app, instance, {} as IHomepagePlugin).render(el);
  (el.querySelector('.bookmark-card') as HTMLButtonElement).click();
  return ws;
}

describe('BookmarkBlock targets (M23)', () => {
  it('opens obsidian:// and mailto: links externally', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    mount('obsidian://open?vault=v');
    mount('mailto:a@b.it');
    expect(win.mock.calls.map(c => c[0])).toEqual(['obsidian://open?vault=v', 'mailto:a@b.it']);
  });

  it('opens a schemeless domain as https, creating no note', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const ws = mount('github.com');
    expect(win.mock.calls[0][0]).toBe('https://github.com');
    expect(ws.linkText).toEqual([]);
  });

  it('opens a vault note, and says so for a missing one', () => {
    const ws = mount('Daily', { Daily: tfile('Daily.md') });
    expect(ws.opened.map(o => o.path)).toEqual(['Daily.md']);
    const missing = mount('Nowhere');
    expect(missing.opened).toEqual([]);
    expect(missing.linkText).toEqual([]);
    expect(Notice.messages.some(m => m.includes('Nowhere'))).toBe(true);
  });
});
