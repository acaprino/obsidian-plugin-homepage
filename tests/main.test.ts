import { describe, it, expect } from 'vitest';
import type { App, PluginManifest } from 'obsidian';
import HomepagePlugin from '../src/main';
import { HomepageView, VIEW_TYPE } from '../src/HomepageView';
import { getDefaultLayout } from '../src/validation';

type Root = 'root' | 'floating';

/**
 * A workspace double that mirrors the Obsidian 1.13.7 behaviour openHomepage
 * depends on (app.js, Workspace.prototype):
 * - getLeaf('tab' | true) -> createLeafInTabGroup(): opens next to
 *   getMostRecentLeaf(), which searches the main area AND popout windows, and
 *   throws "No tab group found." when there is no leaf at all;
 * - an emptied main area is refilled with an empty tab only later
 *   (requestUpdateLayout is deferred), never inside the detach call.
 */
function makeWorkspace(initial: { type: string; root?: Root }[]) {
  let clock = 0;
  const rootSplit = { name: 'rootSplit' };
  const floatingSplit = { name: 'floatingSplit' };
  const leaves: FakeLeaf[] = [];

  class FakeLeaf {
    activeTime = ++clock;
    pinned = false;
    constructor(public type: string, public root: Root) {}
    get view() { return { getViewType: () => this.type }; }
    getRoot() { return this.root === 'root' ? rootSplit : floatingSplit; }
    async setViewState(state: { type: string }) { this.type = state.type; this.activeTime = ++clock; }
    setPinned(p: boolean) { this.pinned = p; }
    detach() {
      leaves.splice(leaves.indexOf(this), 1);
      if (!leaves.some(l => l.root === 'root')) {
        queueMicrotask(() => { if (!leaves.some(l => l.root === 'root')) leaves.push(new FakeLeaf('empty', 'root')); });
      }
    }
  }
  for (const l of initial) leaves.push(new FakeLeaf(l.type, l.root ?? 'root'));

  const mostRecent = (only?: Root) => leaves
    .filter(l => !only || l.root === only)
    .reduce<FakeLeaf | null>((best, l) => (!best || l.activeTime > best.activeTime ? l : best), null);

  const workspace = {
    rootSplit,
    floatingSplit,
    iterateAllLeaves: (cb: (l: FakeLeaf) => void) => { [...leaves].forEach(cb); },
    getLeavesOfType: (type: string) => leaves.filter(l => l.type === type),
    getMostRecentLeaf: (root?: unknown) => mostRecent(root === rootSplit ? 'root' : root === floatingSplit ? 'floating' : undefined),
    getLeaf: (newLeaf?: boolean | string) => {
      if (newLeaf === true || newLeaf === 'tab') {
        const anchor = mostRecent();
        if (!anchor) throw new Error('No tab group found.');
        const leaf = new FakeLeaf('empty', anchor.root);
        leaves.push(leaf);
        return leaf;
      }
      return mostRecent() ?? new FakeLeaf('empty', 'root');
    },
    revealLeaf: async (_leaf: FakeLeaf) => {},
  };
  const tabs = (root: Root = 'root') => leaves.filter(l => l.root === root).map(l => l.type);
  return { workspace, tabs, leaves };
}

function pluginWith(workspace: unknown): HomepagePlugin {
  const plugin = new HomepagePlugin({} as App, {} as PluginManifest);
  plugin.app = { workspace } as unknown as App;
  return plugin;
}

describe('openHomepage: Close all tabs', () => {
  it('leaves the homepage as the only tab when it was not open (M2)', async () => {
    const ws = makeWorkspace([{ type: 'markdown' }, { type: 'markdown' }, { type: 'markdown' }]);

    await pluginWith(ws.workspace).openHomepage('replace-all');
    await Promise.resolve();

    expect(ws.tabs()).toEqual([VIEW_TYPE]);
  });

  it('opens the homepage in the main window, not in the popout window used last', async () => {
    const ws = makeWorkspace([{ type: 'markdown' }, { type: 'markdown' }, { type: 'markdown', root: 'floating' }]);

    await pluginWith(ws.workspace).openHomepage('replace-all');
    await Promise.resolve();

    expect(ws.tabs('root')).toEqual([VIEW_TYPE]);
    expect(ws.tabs('floating')).toEqual(['markdown']);
  });

  it('closes the other tabs when the homepage is already open, e.g. restored at startup (M20)', async () => {
    const ws = makeWorkspace([{ type: 'markdown' }, { type: VIEW_TYPE }, { type: 'markdown' }]);

    await pluginWith(ws.workspace).openHomepage('replace-all');
    await Promise.resolve();

    expect(ws.tabs()).toEqual([VIEW_TYPE]);
  });
});

describe('openHomepage: other modes', () => {
  it('Keep existing tabs only shows an already open homepage, closing nothing', async () => {
    const ws = makeWorkspace([{ type: 'markdown' }, { type: VIEW_TYPE }, { type: 'markdown' }]);

    await pluginWith(ws.workspace).openHomepage('retain');

    expect(ws.tabs()).toEqual(['markdown', VIEW_TYPE, 'markdown']);
  });
});

function fakeView(editing = false): HomepageView & { reloads: number } {
  const view = Object.create(HomepageView.prototype) as HomepageView & { reloads: number };
  view.reloads = 0;
  view.isEditing = () => editing;
  view.reload = async () => { view.reloads++; };
  return view;
}

/** A plugin whose data.json lives in `disk`, with the given homepage views open. */
function pluginWithDisk(initial: unknown, views: HomepageView[] = []) {
  let disk: unknown = structuredClone(initial);
  const writes: Record<string, string> = {};
  const plugin = new HomepagePlugin({} as App, {} as PluginManifest);
  plugin.app = {
    workspace: { getLeavesOfType: () => views.map(view => ({ view })) },
    vault: {
      configDir: '.obsidian',
      adapter: {
        exists: async () => true,
        read: async () => JSON.stringify(disk),
        write: async (path: string, data: string) => { writes[path] = data; },
      },
    },
  } as unknown as App;
  plugin.manifest = { id: 'homepage-blocks', dir: '.obsidian/plugins/homepage-blocks' } as PluginManifest;
  Object.assign(plugin, {
    loadData: async () => structuredClone(disk),
    saveData: async (data: unknown) => { disk = structuredClone(data); },
  });
  return { plugin, setDisk: (d: unknown) => { disk = structuredClone(d); }, writes };
}

describe('data.json changed on disk by another device (R3)', () => {
  it('loads the new layout and redraws the open homepages', async () => {
    const view = fakeView();
    const { plugin, setDisk } = pluginWithDisk(getDefaultLayout(), [view]);
    setDisk({ ...getDefaultLayout(), columns: 5 });

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.columns).toBe(5);
    expect(view.reloads).toBe(1);
  });

  it('ignores the change event of its own last save', async () => {
    const view = fakeView();
    const { plugin } = pluginWithDisk(getDefaultLayout(), [view]);
    await plugin.saveLayout({ ...getDefaultLayout(), columns: 4 });
    const before = plugin.layout;

    await plugin.onExternalSettingsChange();

    expect(plugin.layout).toBe(before);
    expect(view.reloads).toBe(0);
  });

  it('keeps the layout of an open edit session', async () => {
    const view = fakeView(true);
    const { plugin, setDisk } = pluginWithDisk(getDefaultLayout(), [view]);
    setDisk({ ...getDefaultLayout(), columns: 5 });

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.columns).toBe(3);
    expect(view.reloads).toBe(0);
  });

  it('keeps the loaded layout when the new file is not a layout, and backs the file up', async () => {
    const { plugin, setDisk, writes } = pluginWithDisk(getDefaultLayout());
    setDisk([1, 2, 3]);

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.columns).toBe(3);
    expect(Object.keys(writes).some(p => p.includes('data.json.invalid'))).toBe(true);
  });

  it('keeps the loaded layout when data.json was deleted', async () => {
    const { plugin, setDisk } = pluginWithDisk(getDefaultLayout());
    plugin.layout = { ...getDefaultLayout(), columns: 4 };
    setDisk(null);

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.columns).toBe(4);
  });
});

describe('embedded notes follow a rename while no block is mounted (R8)', () => {
  const embed = (id: string, filePath: string) => ({ id, type: 'embedded-note' as const, x: 0, y: 0, w: 1, h: 3, config: { filePath } });

  it('rewrites the path in desktop and mobile blocks and saves', async () => {
    const { plugin } = pluginWithDisk(getDefaultLayout());
    plugin.layout = { ...getDefaultLayout(), blocks: [embed('a', 'Old.md')], mobileBlocks: [embed('m', 'Old.md'), embed('n', 'Other.md')] };

    await plugin.followRename('Old.md', 'New.md');

    expect(plugin.layout.blocks[0].config.filePath).toBe('New.md');
    expect(plugin.layout.mobileBlocks.map(b => b.config.filePath)).toEqual(['New.md', 'Other.md']);
  });
});
