import { ItemView, WorkspaceLeaf } from 'obsidian';
import { IHomepagePlugin, LayoutConfig } from './types';
import { GridLayout } from './GridLayout';
import { EditToolbar } from './EditToolbar';

export const VIEW_TYPE = 'homepage-blocks';

export class HomepageView extends ItemView {
  private grid: GridLayout | null = null;
  private toolbar: EditToolbar | null = null;
  private previousThemeColor: string | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: IHomepagePlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'Homepage'; }
  getIcon(): string { return 'home'; }

  async onOpen(): Promise<void> {
    // Full teardown: unloads blocks AND removes the grid DOM element
    this.grid?.destroy();
    this.toolbar?.destroy();

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('homepage-view');

    this.applyThemeColor();

    const layout: LayoutConfig = this.plugin.layout;

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

    this.grid.render(layout.blocks, layout.columns, true);
  }

  async onClose(): Promise<void> {
    this.grid?.destroy();
    this.toolbar?.destroy();
    this.restoreThemeColor();
  }

  /** Toggle edit mode — called from keyboard shortcut command. */
  toggleEditMode(): void {
    this.toolbar?.toggleEditMode();
  }

  /** Re-render the view from scratch (e.g. after settings reset). */
  async reload(): Promise<void> {
    await this.onOpen();
  }

  /**
   * Set the PWA theme-color meta tag to match the current accent color.
   * This controls the status bar / navigation bar color on mobile PWAs.
   */
  private applyThemeColor(): void {
    const accent = getComputedStyle(document.body).getPropertyValue('--color-accent').trim();
    if (!accent) return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      this.previousThemeColor = meta.getAttribute('content');
      meta.setAttribute('content', accent);
    } else {
      this.previousThemeColor = null;
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = accent;
      document.head.appendChild(meta);
    }
  }

  /** Restore the previous theme-color value (or remove the tag we created). */
  private restoreThemeColor(): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;

    if (this.previousThemeColor !== null) {
      meta.setAttribute('content', this.previousThemeColor);
    } else {
      meta.remove();
    }
  }
}
