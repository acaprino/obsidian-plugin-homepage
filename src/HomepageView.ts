import { ItemView, WorkspaceLeaf } from 'obsidian';
import { IHomepagePlugin, LayoutConfig } from './types';
import { GridLayout } from './GridLayout';
import { EditToolbar } from './EditToolbar';

export const VIEW_TYPE = 'homepage-blocks';

export class HomepageView extends ItemView {
  private grid: GridLayout | null = null;
  private toolbar: EditToolbar | null = null;
  private previousThemeColor: string | null = null;
  private themeColorObserver: MutationObserver | null = null;

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
   * Read the current accent color from CSS custom properties.
   * Falls back through several Obsidian variables to maximise compatibility.
   */
  private getAccentColor(): string {
    const style = getComputedStyle(document.body);
    return (
      style.getPropertyValue('--color-accent').trim() ||
      style.getPropertyValue('--interactive-accent').trim()
    );
  }

  /**
   * Set the PWA theme-color meta tag to match the current accent color.
   * This controls the status bar / navigation bar color on mobile PWAs.
   *
   * Uses requestAnimationFrame to ensure CSS variables are resolved,
   * and a MutationObserver to re-apply if Obsidian resets the tag.
   */
  private applyThemeColor(): void {
    // Defer to next frame so CSS custom properties are fully resolved.
    requestAnimationFrame(() => this.setThemeColorMeta());

    // Watch for external mutations (Obsidian may reset the tag).
    this.themeColorObserver?.disconnect();
    this.themeColorObserver = new MutationObserver(() => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const accent = this.getAccentColor();
      if (meta && accent && meta.getAttribute('content') !== accent) {
        meta.setAttribute('content', accent);
      }
    });
    this.themeColorObserver.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content'],
    });
  }

  /** Actually write the meta tag value. */
  private setThemeColorMeta(): void {
    const accent = this.getAccentColor();
    if (!accent) return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      this.previousThemeColor ??= meta.getAttribute('content');
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
    this.themeColorObserver?.disconnect();
    this.themeColorObserver = null;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;

    if (this.previousThemeColor !== null) {
      meta.setAttribute('content', this.previousThemeColor);
    } else {
      meta.remove();
    }
  }
}
