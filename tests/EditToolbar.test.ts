import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal, Platform, SuggestModal } from 'obsidian';
import type { App } from 'obsidian';
import { EditToolbar, type EditSessionHooks } from '../src/EditToolbar';
import { BlockRegistry } from '../src/BlockRegistry';
import { GridLayout } from '../src/GridLayout';
import { StaticTextBlock } from '../src/blocks/StaticTextBlock';
import { SpacerBlock } from '../src/blocks/SpacerBlock';
import { getDefaultLayout } from '../src/validation';
import type { BlockFactory, BlockInstance, IHomepagePlugin } from '../src/types';

const clockFactory: BlockFactory = {
  type: 'clock',
  displayName: 'Clock',
  defaultConfig: { showSeconds: false, showDate: true },
  defaultSize: { w: 1, h: 3 },
  create: () => { throw new Error('blocks are not rendered in these tests'); },
};

function makeToolbar(): { toolbar: EditToolbar; added: BlockInstance[] } {
  const added: BlockInstance[] = [];
  const grid = {
    addBlock: (instance: BlockInstance) => { added.push(instance); },
    onRequestAddBlock: null,
  } as unknown as GridLayout;
  const plugin = {
    isMobileActive: () => false,
    activeColumns: () => 3,
    activeBlocks: () => [],
  } as unknown as IHomepagePlugin;
  const toolbar = new EditToolbar(document.body.createDiv(), {} as App, plugin, grid, () => {});
  return { toolbar, added };
}

/** Opens the Add Block picker and returns the modal the toolbar created. */
function openPicker(toolbar: EditToolbar): SuggestModal<BlockFactory> {
  let opened: SuggestModal<BlockFactory> | null = null;
  const spy = vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) {
    opened = this as unknown as SuggestModal<BlockFactory>;
  });
  toolbar.openAddBlockModal();
  spy.mockRestore();
  if (!opened) throw new Error('the toolbar did not open a picker');
  return opened;
}

beforeEach(() => {
  document.body.empty();
  BlockRegistry.clear();
  BlockRegistry.register(clockFactory);
});

afterEach(() => {
  BlockRegistry.clear();
  Platform.isPhone = false;
});

describe('EditToolbar Add Block picker', () => {
  it('adds the picked block on desktop, where the host closes the picker before reporting the pick (RF-R1)', () => {
    const { toolbar, added } = makeToolbar();
    const picker = openPicker(toolbar);

    picker.selectSuggestion(clockFactory, new MouseEvent('click'));

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'clock', w: 1, h: 3, config: { showSeconds: false, showDate: true } });
  });

  it('adds the picked block on phones, where the close waits for its animation', () => {
    Platform.isPhone = true;
    const { toolbar, added } = makeToolbar();
    const picker = openPicker(toolbar);

    picker.selectSuggestion(clockFactory, new MouseEvent('click'));

    expect(added.map(b => b.type)).toEqual(['clock']);
  });

  it('gives the new block its own copy of nested default settings (N24)', () => {
    const listFactory: BlockFactory = { ...clockFactory, type: 'bookmarks', defaultConfig: { items: [] } };
    BlockRegistry.register(listFactory);
    const { toolbar, added } = makeToolbar();
    const picker = openPicker(toolbar);

    picker.selectSuggestion(listFactory, new MouseEvent('click'));

    expect(added[0].config.items).toEqual([]);
    expect(added[0].config.items).not.toBe(listFactory.defaultConfig.items);
  });

  it('adds nothing when the pick arrives after the toolbar was destroyed', () => {
    const { toolbar, added } = makeToolbar();
    const picker = openPicker(toolbar);

    toolbar.destroy();
    picker.selectSuggestion(clockFactory, new MouseEvent('click'));

    expect(added).toEqual([]);
  });
});

describe('EditToolbar Discard', () => {
  /** A plugin double with the production save contract: the in-memory layout changes synchronously. */
  function makeLivePlugin(blocks: BlockInstance[]): IHomepagePlugin {
    const plugin: IHomepagePlugin = {
      app: {} as App,
      layout: { ...getDefaultLayout(), blocks },
      saveLayout: async (l) => { plugin.layout = l; },
      saveActiveBlocks: async (b) => { plugin.layout = { ...plugin.layout, blocks: b }; },
      updateBlockConfig: async () => {},
      isMobileActive: () => false,
      activeBlocks: () => plugin.layout.blocks,
      activeColumns: () => plugin.layout.columns,
      activeLayoutPriority: () => 'row',
    } as IHomepagePlugin;
    return plugin;
  }

  it('keeps a Static Text draft that was open when edit mode started (M4)', async () => {
    BlockRegistry.register({
      type: 'static-text', displayName: 'Static text', defaultConfig: { content: '' }, defaultSize: { w: 1, h: 3 },
      create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
    });
    const note: BlockInstance = { id: 's1', type: 'static-text', x: 0, y: 0, w: 1, h: 3, config: { content: 'old text' } };
    const plugin = makeLivePlugin([note]);
    const view = document.body.createDiv({ cls: 'homepage-view' });
    const grid = new GridLayout(view, {} as App, plugin, (l) => { plugin.layout = l; void plugin.saveLayout(l); });
    const toolbar = new EditToolbar(view, {} as App, plugin, grid, () => {});
    grid.render(plugin.activeBlocks(), 3, true);
    await new Promise(resolve => setTimeout(resolve, 5));
    (view.querySelector('.static-text-edit-btn') as HTMLButtonElement).click();
    (view.querySelector('.static-text-inline-editor textarea') as HTMLTextAreaElement).value = 'typed but not saved';

    toolbar.toggleEditMode();
    (view.querySelector('.toolbar-discard-btn') as HTMLButtonElement).click();

    expect(plugin.layout.blocks[0].config.content).toBe('typed but not saved');
  });

  it('restores the column count and the widths changed during the session (N4)', () => {
    BlockRegistry.register({
      type: 'spacer', displayName: 'Spacer', defaultConfig: {}, defaultSize: { w: 1, h: 2 },
      create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin),
    });
    const plugin = makeLivePlugin([{ id: 'wide', type: 'spacer', x: 0, y: 0, w: 3, h: 3, config: {} }]);
    const view = document.body.createDiv({ cls: 'homepage-view' });
    const grid = new GridLayout(view, {} as App, plugin, (l) => { plugin.layout = l; });
    const toolbar = new EditToolbar(view, {} as App, plugin, grid, (n) => grid.setColumns(n));
    grid.render(plugin.activeBlocks(), 3, true);

    toolbar.toggleEditMode();
    grid.setColumns(2); // clamps the wide block to two columns
    (view.querySelector('.toolbar-discard-btn') as HTMLButtonElement).click();

    expect(plugin.layout.columns).toBe(3);
    expect(plugin.layout.blocks[0].w).toBe(3);
  });
});

describe('EditToolbar edit sessions across homepage views (N22)', () => {
  function makeSessionToolbar(session: EditSessionHooks): { toolbar: EditToolbar; switches: boolean[] } {
    const switches: boolean[] = [];
    const grid = {
      setEditMode: (on: boolean) => { switches.push(on); },
      computeFitZoom: () => 1,
      setZoom: () => {},
      cancelPendingPersist: () => {},
      buildLayoutUpdate: (b: BlockInstance[]) => ({ ...getDefaultLayout(), blocks: b }),
      onRequestAddBlock: null,
    } as unknown as GridLayout;
    const plugin = {
      layout: getDefaultLayout(),
      saveLayout: async () => {},
      isMobileActive: () => false,
      activeColumns: () => 3,
      activeBlocks: () => [],
    } as unknown as IHomepagePlugin;
    const toolbar = new EditToolbar(document.body.createDiv(), {} as App, plugin, grid, () => {}, session);
    return { toolbar, switches };
  }

  it('does not start editing while another homepage view is being edited', () => {
    const { toolbar, switches } = makeSessionToolbar({ canStart: () => false, ended: () => {} });

    toolbar.toggleEditMode();

    expect(switches).toEqual([]);
    expect(toolbar.isEditing()).toBe(false);
  });

  it('tells the other views when a session ends, with Done or with Discard', () => {
    let ended = 0;
    const { toolbar } = makeSessionToolbar({ canStart: () => true, ended: () => { ended++; } });

    toolbar.toggleEditMode();
    toolbar.toggleEditMode(); // Done
    toolbar.toggleEditMode();
    (document.querySelector('.toolbar-discard-btn') as HTMLButtonElement).click();

    expect(ended).toBe(2);
  });

  it('tells the other views when a tab is closed while it is being edited', () => {
    let ended = 0;
    const { toolbar } = makeSessionToolbar({ canStart: () => true, ended: () => { ended++; } });

    toolbar.toggleEditMode();
    toolbar.destroy();

    expect(ended).toBe(1);
  });
});

describe('EditToolbar hidden in view mode (M30)', () => {
  it('is out of the Tab order, and its column picker cannot change the layout', () => {
    const changes: number[] = [];
    const grid = { onRequestAddBlock: null, setEditMode: () => {}, computeFitZoom: () => 1, setZoom: () => {} } as unknown as GridLayout;
    const plugin = { isMobileActive: () => false, activeColumns: () => 3, activeBlocks: () => [] } as unknown as IHomepagePlugin;
    const toolbar = new EditToolbar(document.body.createDiv(), {} as App, plugin, grid, (n) => changes.push(n));
    const el = toolbar.getElement();
    expect(el.hasAttribute('inert')).toBe(true);

    const select = el.querySelector('.toolbar-col-select') as HTMLSelectElement;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    expect(changes).toEqual([]);

    toolbar.toggleEditMode();
    expect(el.hasAttribute('inert')).toBe(false);
    const live = el.querySelector('.toolbar-col-select') as HTMLSelectElement;
    live.value = '4';
    live.dispatchEvent(new Event('change'));
    expect(changes).toEqual([4]);
  });
});

describe('EditToolbar focus (M73)', () => {
  it('keeps the focused control focused when the toolbar redraws', async () => {
    const grid = { onRequestAddBlock: null, setEditMode: () => {}, computeFitZoom: () => 0.8, setZoom: () => {} } as unknown as GridLayout;
    const plugin = { isMobileActive: () => false, activeColumns: () => 3, activeBlocks: () => [] } as unknown as IHomepagePlugin;
    const toolbar = new EditToolbar(document.body.createDiv(), {} as App, plugin, grid, () => {});
    toolbar.toggleEditMode();
    (toolbar.getElement().querySelector('.toolbar-add-btn') as HTMLButtonElement).focus();

    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined))); // the fit-zoom redraw

    expect((document.activeElement as HTMLElement | null)?.classList.contains('toolbar-add-btn')).toBe(true);
  });
});
