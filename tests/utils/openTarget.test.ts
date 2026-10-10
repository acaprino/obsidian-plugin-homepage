import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Notice, TFile, type App } from 'obsidian';
import { cleanLinkText, openFile, openLinkTarget, openNoteLink } from '../../src/utils/openTarget';

function file(path: string): TFile {
  const f = new TFile();
  f.path = path;
  return f;
}

/** An app double: notes resolve by link path; every open is recorded with the leaf mode asked for. */
function makeApp(notes: Record<string, TFile> = {}) {
  const opened: { path: string; mode: unknown; state: unknown }[] = [];
  const linkTextCalls: string[] = [];
  const app = {
    metadataCache: { getFirstLinkpathDest: (link: string) => notes[link] ?? null },
    workspace: {
      getLeaf: (mode: unknown) => ({ openFile: async (f: TFile, state?: unknown) => { opened.push({ path: f.path, mode, state }); } }),
      openLinkText: async (t: string) => { linkTextCalls.push(t); },
    },
  } as unknown as App;
  return { app, opened, linkTextCalls };
}

const click = (init: MouseEventInit = {}) => new MouseEvent('click', init);

beforeEach(() => { Notice.messages = []; vi.restoreAllMocks(); });

describe('openFile (M21, M65)', () => {
  it('opens the file itself, whatever its name holds', () => {
    const { app, opened, linkTextCalls } = makeApp();
    openFile(app, file('Issues/#42 Bug.md'), click());

    expect(opened).toEqual([{ path: 'Issues/#42 Bug.md', mode: false, state: undefined }]);
    expect(linkTextCalls).toEqual([]);
  });

  it('opens in a new tab on Ctrl-click or a middle click, in a split with Ctrl+Alt', () => {
    const { app, opened } = makeApp();
    openFile(app, file('a.md'), click({ ctrlKey: true }));
    openFile(app, file('a.md'), click({ button: 1 }));
    openFile(app, file('a.md'), click({ ctrlKey: true, altKey: true }));

    expect(opened.map(o => o.mode)).toEqual(['tab', 'tab', 'split']);
  });
});

describe('cleanLinkText (M66)', () => {
  it('trims and strips wikilink brackets and an alias', () => {
    expect(cleanLinkText('  Projects/Plan  ')).toBe('Projects/Plan');
    expect(cleanLinkText('[[Projects/Plan|the plan]]')).toBe('Projects/Plan');
    expect(cleanLinkText('[[Plan#Goals]]')).toBe('Plan#Goals');
    expect(cleanLinkText('   ')).toBe('');
    expect(cleanLinkText('[[ ]]')).toBe('');
  });
});

describe('openNoteLink (M22, M66)', () => {
  it('opens the note a typed link resolves to, with its heading', () => {
    const { app, opened } = makeApp({ Plan: file('Projects/Plan.md') });
    openNoteLink(app, '[[Plan#Goals|g]]', click());

    expect(opened).toEqual([{ path: 'Projects/Plan.md', mode: false, state: { eState: { subpath: '#Goals' } } }]);
  });

  it('creates nothing for a link that resolves to no note, and says so', () => {
    const { app, opened, linkTextCalls } = makeApp();
    openNoteLink(app, 'Old name', click());

    expect(opened).toEqual([]);
    expect(linkTextCalls).toEqual([]);
    expect(Notice.messages.some(m => m.includes('Old name'))).toBe(true);
  });

  it('does nothing for an empty link', () => {
    const { app, opened } = makeApp();
    openNoteLink(app, '  ', click());
    expect(opened).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });
});

describe('openLinkTarget (M23)', () => {
  it('opens any non-dangerous absolute URL externally', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const { app } = makeApp();
    for (const url of ['https://example.com', 'obsidian://open?vault=x', 'mailto:a@b.it', 'zotero://select/items/1']) {
      openLinkTarget(app, url, click());
    }
    expect(win.mock.calls.map(c => c[0])).toEqual(['https://example.com', 'obsidian://open?vault=x', 'mailto:a@b.it', 'zotero://select/items/1']);
  });

  it('blocks a dangerous scheme', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const { app } = makeApp();
    openLinkTarget(app, 'javascript:alert(1)', click());
    expect(win).not.toHaveBeenCalled();
    expect(Notice.messages.some(m => /unsafe/.test(m))).toBe(true);
  });

  it('treats a domain without a scheme as https', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const { app } = makeApp();
    openLinkTarget(app, 'github.com/owner/repo', click());
    expect(win.mock.calls[0][0]).toBe('https://github.com/owner/repo');
  });

  it('opens a vault note, and a missing one is a notice, not a new note', () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const { app, opened } = makeApp({ 'Daily.md': file('Daily.md') });
    openLinkTarget(app, 'Daily.md', click());
    openLinkTarget(app, 'Missing.md', click());

    expect(opened.map(o => o.path)).toEqual(['Daily.md']);
    expect(win).not.toHaveBeenCalled();
    expect(Notice.messages.some(m => m.includes('Missing.md'))).toBe(true);
  });
});
