import { describe, it, expect, beforeEach } from 'vitest';
import { Notice, TFile, TFolder, type App } from 'obsidian';
import { FolderLinksBlock } from '../../src/blocks/FolderLinksBlock';
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

beforeEach(() => { document.body.empty(); Notice.messages = []; });

function folderWith(path: string, files: TFile[]): TFolder {
  const f = new TFolder();
  f.path = path;
  (f as unknown as { name: string }).name = path.split('/').pop() ?? path;
  f.children = files;
  return f;
}

function mount(config: Record<string, unknown>, opts: { folders?: TFolder[]; notes?: Record<string, TFile> } = {}) {
  const ws = recordingWorkspace();
  const folders = opts.folders ?? [];
  const root = folderWith('', folders as unknown as TFile[]);
  const app = {
    vault: {
      getRoot: () => root,
      getAbstractFileByPath: (p: string) => (p === '/' || p === '' ? root : folders.find(f => f.path === p) ?? null),
      on: () => ({}),
    },
    metadataCache: { getFirstLinkpathDest: (l: string) => opts.notes?.[l] ?? null },
    workspace: ws.workspace,
  } as unknown as App;
  const instance: BlockInstance = { id: 'f', type: 'folder-links', x: 0, y: 0, w: 1, h: 3, config: { folder: '', links: [], ...config } };
  const el = document.body.createDiv();
  const block = new FolderLinksBlock(app, instance, {} as IHomepagePlugin);
  block.load();
  block.render(el);
  return { ...ws, el };
}

describe('FolderLinksBlock opening (M21, M65)', () => {
  it('opens a listed note itself, with a modifier opening a tab', () => {
    const b = mount({ folder: 'Issues' }, { folders: [folderWith('Issues', [tfile('Issues/#7 Crash.md')])] });
    const btn = b.el.querySelector('.folder-link-btn') as HTMLButtonElement;
    btn.click();
    btn.dispatchEvent(new MouseEvent('auxclick', { button: 1 }));

    expect(b.opened).toEqual([{ path: 'Issues/#7 Crash.md', mode: false }, { path: 'Issues/#7 Crash.md', mode: 'tab' }]);
    expect(b.linkText).toEqual([]);
  });
});

describe('FolderLinksBlock manual links (M22, M66)', () => {
  it('opens a typed link that resolves, after trimming and stripping [[ ]]', () => {
    const b = mount({ links: [{ label: 'Plan', path: ' [[Plan|the plan]] ' }] }, { notes: { Plan: tfile('Projects/Plan.md') } });
    (b.el.querySelector('.folder-link-btn') as HTMLButtonElement).click();
    expect(b.opened.map(o => o.path)).toEqual(['Projects/Plan.md']);
  });

  it('creates no note for a link that resolves to none', () => {
    const b = mount({ links: [{ label: 'Gone', path: 'Old name' }] });
    (b.el.querySelector('.folder-link-btn') as HTMLButtonElement).click();

    expect(b.opened).toEqual([]);
    expect(b.linkText).toEqual([]);
    expect(Notice.messages.some(m => m.includes('Old name'))).toBe(true);
  });
});

describe('FolderLinksBlock folder input (M67)', () => {
  it('finds a folder typed with a leading slash', () => {
    const b = mount({ folder: '/Issues/' }, { folders: [folderWith('Issues', [tfile('Issues/a.md')])] });
    expect(b.el.querySelectorAll('.folder-link-btn')).toHaveLength(1);
  });
});
