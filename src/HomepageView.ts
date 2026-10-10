import { ItemView, WorkspaceLeaf } from 'obsidian';
import { BlockInstance, IHomepagePlugin, LayoutConfig } from './types';
import { GridLayout } from './GridLayout';
import { EditToolbar } from './EditToolbar';

export const VIEW_TYPE = 'homepage-blocks';

export class HomepageView extends ItemView {
  private grid: GridLayout | null = null;
  private toolbar: EditToolbar | null = null;
  /** Set by reload(true): the next grid redraws a layout synced from another device. */
  private syncReload = false;

  constructor(leaf: WorkspaceLeaf, private plugin: IHomepagePlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'Homepage'; }
  getIcon(): string { return 'home'; }

  // Returns Promise<void> to match ItemView.onOpen and keep `reload()`'s await
  // meaningful. If future work needs awaiting (per-leaf state, editor-ready
  // signal), switch this back to `async` and await inside the body.
  onOpen(): Promise<void> {
    // Full teardown: unloads blocks AND removes the grid DOM element
    this.grid?.destroy();
    this.toolbar?.destroy();

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('homepage-view');
    contentEl.toggleClass('homepage-no-scrollbar', this.plugin.layout.showScrollbar === false);
    contentEl.toggleClass('homepage-hover-highlight', !!this.plugin.layout.hoverHighlight);

    const onLayoutChange = (newLayout: LayoutConfig) => {
      this.plugin.layout = newLayout;
      void this.plugin.saveLayout(newLayout);
    };

    this.grid = new GridLayout(contentEl, this.app, this.plugin, onLayoutChange);
    if (this.syncReload) {
      this.syncReload = false;
      this.grid.holdDerivedPersist();
    }

    this.toolbar = new EditToolbar(
      contentEl,
      this.app,
      this.plugin,
      this.grid,
      (columns) => { this.grid?.setColumns(columns); },
      {
        canStart: () => !this.otherHomepages().some(v => v.isEditing()),
        ended: () => { for (const v of this.otherHomepages()) void v.reload(); },
      },
    );

    // Toolbar above grid; FAB floats independently (already in contentEl via EditToolbar)
    contentEl.insertBefore(this.toolbar.getElement(), this.grid.getElement());
    contentEl.insertBefore(this.toolbar.getFabElement(), this.toolbar.getElement());

    this.grid.render(this.plugin.activeBlocks(), this.plugin.activeColumns(), true);
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.grid?.destroy();
    this.toolbar?.destroy();
    return Promise.resolve();
  }

  /** Toggle edit mode — called from keyboard shortcut command. */
  toggleEditMode(): void {
    this.toolbar?.toggleEditMode();
  }

  /** Open the Add Block modal — called from command palette. */
  openAddBlockModal(): void {
    this.toolbar?.openAddBlockModal();
  }

  /** The other homepage views open in this workspace. */
  private otherHomepages(): HomepageView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE)
      .map(leaf => leaf.view)
      .filter((v): v is HomepageView => v instanceof HomepageView && v !== this);
  }

  /** True while this homepage is in edit mode. */
  isEditing(): boolean {
    return this.toolbar?.isEditing() ?? false;
  }

  /** Leave edit mode as Done does; nothing when not editing. */
  finishEditing(): void {
    this.toolbar?.finishEditing();
  }

  /**
   * Re-render the view from scratch (e.g. after settings reset). An edit session
   * ends as Done first. `fromSync`: the layout came from another device, so the
   * redraw must not write back the positions it measures (GridLayout.holdDerivedPersist).
   */
  async reload(fromSync = false): Promise<void> {
    this.finishEditing();
    this.syncReload = fromSync;
    await this.onOpen();
  }

  /** Rewrite the Discard snapshot of an open edit session (a note renamed meanwhile). */
  mapEditSnapshot(fn: (blocks: BlockInstance[]) => BlockInstance[]): void {
    this.toolbar?.mapSnapshot(fn);
  }
}
