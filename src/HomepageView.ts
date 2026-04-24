import { ItemView, WorkspaceLeaf } from 'obsidian';
import { IHomepagePlugin, LayoutConfig } from './types';
import { GridLayout } from './GridLayout';
import { EditToolbar } from './EditToolbar';

export const VIEW_TYPE = 'homepage-blocks';

export class HomepageView extends ItemView {
  private grid: GridLayout | null = null;
  private toolbar: EditToolbar | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: IHomepagePlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'Homepage'; }
  getIcon(): string { return 'home'; }

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

    this.toolbar = new EditToolbar(
      contentEl,
      this.app,
      this.plugin,
      this.grid,
      (columns) => { this.grid?.setColumns(columns); },
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

  /** Re-render the view from scratch (e.g. after settings reset). */
  async reload(): Promise<void> {
    await this.onOpen();
  }
}
