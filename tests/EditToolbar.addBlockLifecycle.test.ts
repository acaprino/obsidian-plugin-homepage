import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, SuggestModal } from 'obsidian';
import { openedSuggestModals } from 'obsidian';
import { EditToolbar } from '../src/EditToolbar';
import { BlockRegistry } from '../src/BlockRegistry';
import { Phase } from '../src/grid/phase';
import { getDefaultLayout } from '../src/validation';
import type { BlockFactory, IHomepagePlugin } from '../src/types';
import type { GridLayout } from '../src/GridLayout';

const factory: BlockFactory = {
  type: 'clock',
  displayName: 'Clock',
  defaultConfig: {},
  defaultSize: { w: 1, h: 3 },
  create: vi.fn(),
};

interface GridStub {
  phase: Phase;
  onRequestAddBlock: (() => void) | null;
  addBlock: ReturnType<typeof vi.fn>;
  setEditMode: ReturnType<typeof vi.fn>;
  computeFitZoom: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  cancelPendingPersist: ReturnType<typeof vi.fn>;
  buildLayoutUpdate: ReturnType<typeof vi.fn>;
}

function makePlugin(): IHomepagePlugin {
  const layout = { ...getDefaultLayout(), blocks: [] };
  return {
    app: {} as App,
    layout,
    saveLayout: async () => {},
    saveActiveBlocks: async () => {},
    updateBlockConfig: async () => {},
    isMobileActive: () => false,
    activeBlocks: () => layout.blocks,
    activeColumns: () => layout.columns,
    activeLayoutPriority: () => layout.layoutPriority,
  };
}

function makeGrid(): GridStub {
  return {
    phase: Phase.Ready,
    onRequestAddBlock: null,
    addBlock: vi.fn(),
    setEditMode: vi.fn(),
    computeFitZoom: vi.fn(() => 1),
    setZoom: vi.fn(),
    cancelPendingPersist: vi.fn(),
    buildLayoutUpdate: vi.fn(),
  };
}

function latestModal(): SuggestModal<BlockFactory> {
  const modal = openedSuggestModals.at(-1);
  if (!modal) throw new Error('Expected an open SuggestModal');
  return modal as SuggestModal<BlockFactory>;
}

function setup(): { toolbar: EditToolbar; grid: GridStub } {
  const grid = makeGrid();
  const toolbar = new EditToolbar(
    document.body.createDiv(),
    {} as App,
    makePlugin(),
    grid as unknown as GridLayout,
    vi.fn(),
  );
  return { toolbar, grid };
}

beforeEach(() => {
  BlockRegistry.clear();
  BlockRegistry.register(factory);
  openedSuggestModals.length = 0;
  document.body.empty();
});

describe('EditToolbar add-block picker lifecycle', () => {
  it('adds once when selection happens before close', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    const modal = latestModal();

    modal.onChooseSuggestion(factory, new Event('click'));
    modal.close();

    expect(grid.addBlock).toHaveBeenCalledOnce();
  });

  it('adds once when close happens before selection', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    const modal = latestModal();

    modal.close();
    modal.onChooseSuggestion(factory, new Event('click'));

    expect(grid.addBlock).toHaveBeenCalledOnce();
  });

  it('does not add when the picker is cancelled', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    latestModal().close();

    expect(grid.addBlock).not.toHaveBeenCalled();
  });

  it('processes duplicate selection dispatch only once', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    const modal = latestModal();

    modal.onChooseSuggestion(factory, new Event('click'));
    modal.onChooseSuggestion(factory, new Event('keydown'));

    expect(grid.addBlock).toHaveBeenCalledOnce();
  });

  it('rejects a selection from a replaced picker', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    const oldModal = latestModal();
    toolbar.openAddBlockModal();

    oldModal.onChooseSuggestion(factory, new Event('click'));
    expect(grid.addBlock).not.toHaveBeenCalled();

    latestModal().onChooseSuggestion(factory, new Event('click'));
    expect(grid.addBlock).toHaveBeenCalledOnce();
  });

  it('rejects selection after the grid is destroyed', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    grid.phase = Phase.Destroyed;

    latestModal().onChooseSuggestion(factory, new Event('click'));

    expect(grid.addBlock).not.toHaveBeenCalled();
  });

  it('rejects selection after the toolbar is destroyed', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    const modal = latestModal();
    toolbar.destroy();

    modal.onChooseSuggestion(factory, new Event('click'));

    expect(grid.addBlock).not.toHaveBeenCalled();
  });

  it('does not add when the selected factory is no longer registered', () => {
    const { toolbar, grid } = setup();
    toolbar.openAddBlockModal();
    BlockRegistry.clear();

    latestModal().onChooseSuggestion(factory, new Event('click'));

    expect(grid.addBlock).not.toHaveBeenCalled();
  });
});
