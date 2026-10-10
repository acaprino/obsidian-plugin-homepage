import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TFile, type App } from 'obsidian';
import { ButtonGridBlock } from '../../src/blocks/ButtonGridBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;

// happy-dom never lays anything out, so its ResizeObserver never reports a width.
// Capture the block's callback and report a width change by hand.
let observed: ResizeCallback[] = [];
const OriginalResizeObserver = globalThis.ResizeObserver;
beforeEach(() => {
  document.body.empty();
  observed = [];
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeCallback) { observed.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => { globalThis.ResizeObserver = OriginalResizeObserver; });

const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

describe('ButtonGridBlock', () => {
  it('asks the grid to re-measure its height when its width changes', async () => {
    const instance: BlockInstance = {
      id: 'b1', type: 'button-grid', x: 0, y: 0, w: 1, h: 5,
      config: { columns: 2, items: [{ emoji: '📝', label: 'New note' }] },
    };
    const el = document.body.createDiv();
    new ButtonGridBlock({} as App, instance, {} as IHomepagePlugin).render(el);
    let requests = 0;
    document.body.addEventListener('request-auto-height', () => { requests++; });

    for (const cb of observed) cb([{ contentRect: { width: 320 } }]);
    await nextFrame();

    expect(requests).toBeGreaterThan(0);
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

function tfile(path: string, mtime = 0): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  f.extension = 'md';
  f.stat = { mtime, ctime: 0, size: 0 };
  return f;
}

describe('ButtonGridBlock links (M22, M23, M66)', () => {
  function mount(link: string, notes: Record<string, TFile> = {}) {
    const ws = recordingWorkspace();
    const app = { metadataCache: { getFirstLinkpathDest: (l: string) => notes[l] ?? null }, workspace: ws.workspace } as unknown as App;
    const instance: BlockInstance = { id: 'b', type: 'button-grid', x: 0, y: 0, w: 1, h: 3, config: { items: [{ label: 'x', link }] } };
    const el = document.body.createDiv();
    new ButtonGridBlock(app, instance, {} as IHomepagePlugin).render(el);
    (el.querySelector('.grid-btn') as HTMLButtonElement).click();
    return ws;
  }

  it('opens a resolvable note and creates none for a stale link', () => {
    expect(mount('[[Plan]]', { Plan: tfile('Plan.md') }).opened.map(o => o.path)).toEqual(['Plan.md']);
    const stale = mount('Renamed away');
    expect(stale.opened).toEqual([]);
    expect(stale.linkText).toEqual([]);
  });

  it('opens a URL externally', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    mount('https://example.com');
    expect(win.mock.calls[0][0]).toBe('https://example.com');
    win.mockRestore();
  });
});
