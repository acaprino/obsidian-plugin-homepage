import { describe, it, expect, beforeEach } from 'vitest';
import { TFile, type App } from 'obsidian';
import { RecentFilesBlock } from '../../src/blocks/RecentFilesBlock';
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

beforeEach(() => { document.body.empty(); });

function mount(files: TFile[], config: Record<string, unknown> = {}) {
  const ws = recordingWorkspace();
  const app = { vault: { getFiles: () => files, getMarkdownFiles: () => files, on: () => ({}) }, workspace: ws.workspace } as unknown as App;
  const instance: BlockInstance = { id: 'r', type: 'recent-files', x: 0, y: 0, w: 1, h: 3, config: { showTimestamp: false, ...config } };
  const el = document.body.createDiv();
  const block = new RecentFilesBlock(app, instance, {} as IHomepagePlugin);
  block.load();
  block.render(el);
  return { ...ws, el };
}

describe('RecentFilesBlock opening (M21, M65)', () => {
  it('opens the file itself, even with a # in its name', () => {
    const b = mount([tfile('Issues/#42 Bug.md', 2)]);
    (b.el.querySelector('.recent-file-btn') as HTMLButtonElement).click();

    expect(b.opened).toEqual([{ path: 'Issues/#42 Bug.md', mode: false }]);
    expect(b.linkText).toEqual([]);
  });

  it('opens a new tab on Ctrl-click and on a middle click', () => {
    const b = mount([tfile('a.md', 1)]);
    const btn = b.el.querySelector('.recent-file-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
    btn.dispatchEvent(new MouseEvent('auxclick', { button: 1 }));

    expect(b.opened.map(o => o.mode)).toEqual(['tab', 'tab']);
  });
});

describe('RecentFilesBlock exclude folders (M68)', () => {
  it('excludes a folder written with slashes or another letter case', () => {
    const files = [tfile('Templates/T.md', 3), tfile('templates2/x.md', 2), tfile('Notes/n.md', 1)];
    for (const ex of ['Templates/', '/Templates', ' templates ']) {
      document.body.empty();
      const b = mount(files, { excludeFolders: ex });
      const names = [...b.el.querySelectorAll('.recent-file-name')].map(n => n.textContent);
      expect(names).toEqual(['x', 'n']);
    }
  });
});
