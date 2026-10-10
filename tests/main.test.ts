import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notice } from 'obsidian';
import type { App, PluginManifest, WorkspaceLeaf } from 'obsidian';
import { _resetDeviceKeyCache } from '../src/utils/apiKeyCrypto';
import HomepagePlugin, { commandTarget, homepageCommand, registerBlocks } from '../src/main';
import { HomepageView, VIEW_TYPE } from '../src/HomepageView';
import { BlockRegistry } from '../src/BlockRegistry';
import { BaseBlock } from '../src/blocks/BaseBlock';
import { AUTO_HEIGHT_ATTR } from '../src/grid/AutoHeight';
import { getDefaultLayout } from '../src/validation';
import type { BlockInstance, LayoutConfig } from '../src/types';

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
    active: null as { leaf: FakeLeaf; focus: boolean } | null,
    setActiveLeaf(leaf: FakeLeaf, opts?: { focus?: boolean }) { this.active = { leaf, focus: opts?.focus ?? false }; },
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

describe('openHomepage: an already open homepage (M64)', () => {
  it('becomes the active, focused tab', async () => {
    const ws = makeWorkspace([{ type: VIEW_TYPE }, { type: 'markdown' }]);

    await pluginWith(ws.workspace).openHomepage('retain');

    expect(ws.workspace.active?.leaf.type).toBe(VIEW_TYPE);
    expect(ws.workspace.active?.focus).toBe(true);
  });
});

describe('homepage commands (M69)', () => {
  it('are offered only while a homepage is open, and run on it', () => {
    const ran: string[] = [];
    let open: { id: string } | null = null;
    const check = homepageCommand(() => open, v => { ran.push(v.id); });

    expect(check(true)).toBe(false);
    expect(check(false)).toBe(false);
    open = { id: 'home' };
    expect(check(true)).toBe(true);
    expect(ran).toEqual([]);
    expect(check(false)).toBe(true);
    expect(ran).toEqual(['home']);
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
      on: () => ({}),
      getAbstractFileByPath: () => null,
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
  return { plugin, setDisk: (d: unknown) => { disk = structuredClone(d); }, disk: () => disk as LayoutConfig, writes };
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

  it('follows a renamed folder in folder settings (M55)', async () => {
    const { plugin } = pluginWithDisk(getDefaultLayout());
    plugin.layout = { ...getDefaultLayout(), blocks: [{ id: 'g', type: 'image-gallery', x: 0, y: 0, w: 3, h: 3, config: { folder: 'Pics' } }], mobileBlocks: [] };

    await plugin.followRename('Pics', 'Photos');

    expect(plugin.layout.blocks[0].config.folder).toBe('Photos');
  });
});

/** A real homepage view on `plugin`, opened in the document, as Obsidian opens one. */
function openRealView(plugin: HomepagePlugin): HomepageView {
  const view = new HomepageView({} as WorkspaceLeaf, plugin);
  (view as unknown as { app: App }).app = plugin.app;
  document.body.appendChild(view.contentEl);
  void view.onOpen();
  return view;
}

/** An auto-height block whose content measures 600 px: 9 rows instead of the stored 3. */
class TallBlock extends BaseBlock {
  render(el: HTMLElement): void {
    const body = el.createDiv();
    body.setAttribute(AUTO_HEIGHT_ATTR, '');
    Object.defineProperty(body, 'offsetHeight', { configurable: true, get: () => 600 });
  }
}

const block = (id: string, type: BlockInstance['type'], over: Partial<BlockInstance> = {}): BlockInstance =>
  ({ id, type, x: 0, y: 0, w: 1, h: 3, config: {}, ...over });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('homepage views and a layout synced from another device', () => {
  beforeEach(() => { document.body.empty(); registerBlocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the synced layout without writing back the positions it measures, so two running devices cannot rewrite each other forever', async () => {
    BlockRegistry.register({
      type: 'static-text', displayName: 'Text', defaultConfig: {}, defaultSize: { w: 1, h: 3 }, autoHeight: true,
      create: (app, instance, plugin) => new TallBlock(app, instance, plugin),
    });
    // happy-dom computes no padding: report the card's 12 px top and bottom.
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingTop: '12px', paddingBottom: '12px', gap: '0px' } as CSSStyleDeclaration);
    const local = { ...getDefaultLayout(), blocks: [block('c', 'clock')], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin, setDisk, disk } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));
    const remote = { ...getDefaultLayout(), blocks: [block('t', 'static-text'), block('below', 'clock', { y: 3 })], mobileBlocks: [] };
    setDisk(remote);

    await plugin.onExternalSettingsChange();
    await wait(150);

    const shown = views[0].contentEl.querySelector('[gs-id="t"]') as HTMLElement & { gridstackNode?: { h: number } };
    expect(shown.gridstackNode?.h).toBe(9); // measured and drawn here...
    expect(disk().blocks.map(b => b.y)).toEqual([0, 3]); // ...but not written back
  });

  it('keeps a Static Text draft that was open when the synced layout arrived (review focus 1)', async () => {
    const local = { ...getDefaultLayout(), blocks: [block('s', 'static-text', { config: { content: 'old' } })], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin, setDisk } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));
    await wait(5);
    (views[0].contentEl.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
    (views[0].contentEl.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).value = 'typed here';
    setDisk({ ...local, columns: 5 });

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.columns).toBe(5);
    expect(plugin.layout.blocks[0].config.content).toBe('typed here');
  });

  it('drops that draft when the other device changed the same text', async () => {
    const local = { ...getDefaultLayout(), blocks: [block('s', 'static-text', { config: { content: 'old' } })], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin, setDisk } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));
    await wait(5);
    (views[0].contentEl.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
    (views[0].contentEl.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).value = 'typed here';
    setDisk({ ...local, blocks: [block('s', 'static-text', { config: { content: 'changed elsewhere' } })] });

    await plugin.onExternalSettingsChange();

    expect(plugin.layout.blocks[0].config.content).toBe('changed elsewhere');
  });

  it('keeps a rename that was followed during an edit session the user then discards (R8)', async () => {
    const local = { ...getDefaultLayout(), blocks: [block('e', 'embedded-note', { config: { filePath: 'Old.md' } })], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));

    views[0].toggleEditMode();
    await plugin.followRename('Old.md', 'New.md');
    (views[0].contentEl.querySelector('.toolbar-discard-btn') as HTMLButtonElement).click();

    expect(plugin.layout.blocks[0].config.filePath).toBe('New.md');
  });
});

describe('commandTarget (N22)', () => {
  const view = (editing: boolean) => ({ isEditing: () => editing });

  it('acts on the active homepage', () => {
    const a = view(false);
    const b = view(false);
    expect(commandTarget([a, b], b, false)).toBe(b);
  });

  it('adds a block to the homepage being edited, even when another one is active', () => {
    const editing = view(true);
    const active = view(false);
    expect(commandTarget([editing, active], active, true)).toBe(editing);
  });

  it('falls back to the edited homepage, then the first one', () => {
    const a = view(false);
    const b = view(true);
    expect(commandTarget([a, b], null, false)).toBe(b);
    expect(commandTarget([a], null, false)).toBe(a);
    expect(commandTarget([], null, false)).toBeNull();
  });
});

describe('data.json changed on disk: races and key-store failures', () => {
  beforeEach(() => { document.body.empty(); registerBlocks(); Notice.messages = []; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('keeps a layout saved here while the synced file was being read, so memory and disk agree', async () => {
    const local = { ...getDefaultLayout(), blocks: [block('c', 'clock')], mobileBlocks: [] };
    const { plugin, setDisk, disk } = pluginWithDisk(local);
    plugin.layout = structuredClone(local);
    setDisk({ ...local, columns: 5 });
    const read = plugin.loadData.bind(plugin);
    let first = true;
    plugin.loadData = async () => {
      const remote: unknown = await read();
      if (first) {
        first = false;
        void plugin.saveLayout({ ...local, columns: 4 }); // a drag or a setting lands meanwhile
      }
      return remote;
    };

    await plugin.onExternalSettingsChange();
    await wait(5);

    expect(plugin.layout.columns).toBe(4);
    expect(disk().columns).toBe(4);
  });

  it('does not write the old grid positions over the synced layout as the view reloads', async () => {
    BlockRegistry.register({
      type: 'static-text', displayName: 'Text', defaultConfig: {}, defaultSize: { w: 1, h: 3 }, autoHeight: true,
      create: (app, instance, plugin) => new TallBlock(app, instance, plugin),
    });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingTop: '12px', paddingBottom: '12px', gap: '0px' } as CSSStyleDeclaration);
    // This device's grid measures the text block and queues a save of the moved clock.
    const local = { ...getDefaultLayout(), blocks: [block('t', 'static-text'), block('below', 'clock', { y: 3 })], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin, setDisk, disk } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));
    await wait(30); // measured, the 50 ms save still pending
    const remote = { ...local, columns: 4 };
    setDisk(remote);

    await plugin.onExternalSettingsChange();
    await wait(150);

    expect(disk().columns).toBe(4);
    expect(disk().blocks.map(b => b.y)).toEqual([0, 3]);
  });

  it('says so when a synced voice API key cannot be read right now', async () => {
    const previous = globalThis.indexedDB;
    globalThis.indexedDB = { open: () => { throw new Error('locked'); } } as unknown as IDBFactory;
    _resetDeviceKeyCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const local = { ...getDefaultLayout(), blocks: [block('c', 'clock')], mobileBlocks: [] };
    const { plugin, setDisk } = pluginWithDisk(local);
    plugin.layout = structuredClone(local);
    setDisk({ ...local, blocks: [block('v', 'voice-dictation', { config: { apiKey: 'enc:v1:AAAA:BBBB' } })] });

    await plugin.onExternalSettingsChange();

    globalThis.indexedDB = previous;
    _resetDeviceKeyCache();
    expect(Notice.messages.some(m => /API key could not be loaded/.test(m))).toBe(true);
  });
});

describe('data from a newer plugin version (M58)', () => {
  it('is written back to data.json where that version reads it', async () => {
    const future = { id: 'f', type: 'weather', x: 1, y: 0, w: 1, h: 3, config: {} };
    const { plugin, disk } = pluginWithDisk(getDefaultLayout());
    const layout = { ...getDefaultLayout(), blocks: [block('c', 'clock')], mobileBlocks: [], preserved: { blocks: [future], mobileBlocks: [], fields: { themeSync: 1 } } };

    await plugin.saveLayout(layout);

    const stored = disk() as unknown as Record<string, unknown>;
    expect((stored.blocks as { id: string }[]).map(b => b.id)).toEqual(['c', 'f']);
    expect(stored.themeSync).toBe(1);
    expect('preserved' in stored).toBe(false);
  });
});

describe('a Static Text save still queued when an edit session starts (M52)', () => {
  beforeEach(() => { document.body.empty(); registerBlocks(); });

  it('survives Discard', async () => {
    const local = { ...getDefaultLayout(), blocks: [block('s', 'static-text', { config: { content: 'old' } })], mobileBlocks: [] };
    const views: HomepageView[] = [];
    const { plugin } = pluginWithDisk(local, views);
    plugin.layout = structuredClone(local);
    views.push(openRealView(plugin));
    await wait(5);
    // A write still in flight (a drag, say) holds the save chain.
    const write = plugin.saveData.bind(plugin);
    let release: () => void = () => {};
    plugin.saveData = async (data: unknown) => { await new Promise<void>(r => { release = r; }); await write(data); };
    void plugin.saveLayout({ ...plugin.layout });
    const view = views[0];
    (view.contentEl.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
    (view.contentEl.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).value = 'new';
    (view.contentEl.querySelector('.inline-edit-save') as HTMLButtonElement).click(); // queued behind the write

    view.toggleEditMode();
    plugin.saveData = write;
    release();
    await wait(10);
    (view.contentEl.querySelector('.toolbar-discard-btn') as HTMLButtonElement).click();

    expect(plugin.layout.blocks[0].config.content).toBe('new');
  });
});

describe('block names (M101)', () => {
  it('uses sentence case for Vault search', () => {
    registerBlocks();
    expect(BlockRegistry.get('vault-search')?.displayName).toBe('Vault search');
  });
});

describe('the save path (M121)', () => {
  it('writes nothing while a broken data.json could not be backed up, and resumes once it is', async () => {
    Notice.messages = [];
    const { plugin, disk } = pluginWithDisk({ ...getDefaultLayout(), columns: 3 });
    let allowed = false;
    (plugin as unknown as { dataGuard: unknown }).dataGuard = {
      allowWrite: async () => (allowed ? { allowed: true, backupPath: '.obsidian/plugins/homepage-blocks/data.json.invalid' } : { allowed: false, backupPath: null }),
    };

    await plugin.saveLayout({ ...getDefaultLayout(), columns: 5 });
    expect(disk().columns).toBe(3);

    allowed = true;
    await plugin.saveLayout({ ...getDefaultLayout(), columns: 4 });
    expect(disk().columns).toBe(4);
    expect(Notice.messages.some(m => /data\.json\.invalid/.test(m))).toBe(true);
  });

  it('writes saves in the order they were made, a slow write included', async () => {
    const { plugin, disk } = pluginWithDisk(getDefaultLayout());
    const write = plugin.saveData.bind(plugin);
    let calls = 0;
    plugin.saveData = async (data: unknown) => {
      const delay = calls++ === 0 ? 30 : 0; // the first write is slow
      await new Promise(resolve => setTimeout(resolve, delay));
      await write(data);
    };

    void plugin.saveLayout({ ...getDefaultLayout(), columns: 4 });
    await plugin.saveLayout({ ...getDefaultLayout(), columns: 5 });
    await new Promise(resolve => setTimeout(resolve, 60)); // and the slow one, wherever it lands

    expect(disk().columns).toBe(5);
  });
});

describe('a rename while a homepage is open (after docs pass)', () => {
  it('redraws the views not being edited, so mounted blocks read the new paths', async () => {
    const shown = fakeView();
    const editing = fakeView(true);
    const local = { ...getDefaultLayout(), blocks: [block('g', 'image-gallery', { config: { folder: 'Photos' } })], mobileBlocks: [] };
    const { plugin } = pluginWithDisk(local, [shown, editing]);
    plugin.layout = structuredClone(local);
    editing.mapEditSnapshot = () => {};

    await plugin.followRename('Photos', 'Pictures');

    expect(plugin.layout.blocks[0].config.folder).toBe('Pictures');
    expect(shown.reloads).toBe(1);
    expect(editing.reloads).toBe(0);
  });
});
