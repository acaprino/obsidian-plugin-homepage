import { App, Component } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';

/** Regex for the shared `_titleSize` config key — h1 through h6. */
export const TITLE_SIZE_RE = /^h[1-6]$/;

export abstract class BaseBlock extends Component {
  private _headerContainer: HTMLElement | null = null;
  private _scheduleTimer: number | null = null;
  private _renderGen = 0;
  private _widthObserver: ResizeObserver | null = null;
  private _widthRafId = 0;

  /** Set by subclasses in render() to enable scheduleRender(). */
  protected containerEl: HTMLElement | null = null;

  constructor(
    protected app: App,
    protected instance: BlockInstance,
    protected plugin: IHomepagePlugin,
  ) {
    super();
  }

  abstract render(el: HTMLElement): void | Promise<void>;

  // Override to open a per-block settings modal.
  // onSave receives the new config; do NOT mutate this.instance.config directly.
  openSettings(_onSave: (config: Record<string, unknown>) => void): void {}

  // Called by GridLayout to redirect renderHeader output outside block-content.
  setHeaderContainer(el: HTMLElement): void {
    this._headerContainer = el;
  }

  // Render the muted uppercase block header label.
  // Respects _hideTitle, _titleLabel, and _titleEmoji from instance.config.
  // Renders into the header container set by GridLayout (if any), else falls back to el.
  protected renderHeader(el: HTMLElement, title: string): void {
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = (typeof cfg._titleLabel === 'string' && cfg._titleLabel.trim())
      ? cfg._titleLabel.trim()
      : title;
    if (!label) return;
    const container = this._headerContainer ?? el;
    // Remove stale header from a previous render cycle (header zone is NOT
    // emptied when block-content is cleared via el.empty()).
    container.querySelector('.block-header')?.remove();
    const sizeClass = typeof cfg._titleSize === 'string' && TITLE_SIZE_RE.test(cfg._titleSize)
      ? `block-header-${cfg._titleSize}` : '';
    const header = container.createDiv({ cls: `block-header${sizeClass ? ' ' + sizeClass : ''}` });
    if (typeof cfg._titleEmoji === 'string' && cfg._titleEmoji) {
      header.createSpan({ cls: 'block-header-emoji', text: cfg._titleEmoji });
    }
    header.createSpan({ text: label });
  }

  // ── Shared debounced re-render infrastructure ──────────────────────────────

  /**
   * Schedule a debounced re-render. Guards against detached DOM nodes
   * (checks `isConnected`) and catches async errors.
   * After a successful re-render, dispatches a `request-auto-height` event
   * so GridLayout can recalculate the block's row height.
   */
  protected scheduleRender(delayMs: number, fn: (el: HTMLElement) => void | Promise<void>): void {
    if (this._scheduleTimer !== null) window.clearTimeout(this._scheduleTimer);
    this._scheduleTimer = window.setTimeout(() => {
      this._scheduleTimer = null;
      if (!this.containerEl?.isConnected) return;
      const result = fn(this.containerEl);
      if (result instanceof Promise) {
        result
          .then(() => this.requestAutoHeight())
          .catch(e => {
            console.error(`[Homepage Blocks] ${this.constructor.name} re-render failed:`, e);
          });
      } else {
        this.requestAutoHeight();
      }
    }, delayMs);
  }

  /** Dispatch an event so GridLayout recalculates auto-height for this block. */
  protected requestAutoHeight(): void {
    this.containerEl?.dispatchEvent(new CustomEvent('request-auto-height', { bubbles: true }));
  }

  /**
   * Watch an element for width changes and dispatch request-auto-height when
   * the width changes.  Useful for blocks whose content reflows (e.g. grid
   * galleries, multi-column lists) when the container narrows/widens.
   * Cleanup is registered automatically via `this.register()`.
   */
  protected observeWidthForAutoHeight(el: HTMLElement): void {
    // Disconnect previous observer to prevent accumulation across re-renders
    if (this._widthObserver) {
      this._widthObserver.disconnect();
      cancelAnimationFrame(this._widthRafId);
    }
    let prevWidth = 0; // 0 skips the initial observe() callback
    this._widthObserver = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0 && w !== prevWidth) {
        prevWidth = w;
        // Throttle to one dispatch per animation frame to avoid hammering
        // GridStack with layout recalculations during continuous resize.
        cancelAnimationFrame(this._widthRafId);
        this._widthRafId = requestAnimationFrame(() => this.requestAutoHeight());
      }
    });
    this._widthObserver.observe(el);
  }

  /** Increment and return a new render generation. Call at the start of async renders. */
  protected nextGeneration(): number {
    return ++this._renderGen;
  }

  /** Returns true if a newer render was started after the given generation. */
  protected isStale(generation: number): boolean {
    return generation !== this._renderGen;
  }

  onunload(): void {
    if (this._scheduleTimer !== null) {
      window.clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }
    if (this._widthObserver) {
      this._widthObserver.disconnect();
      this._widthObserver = null;
      cancelAnimationFrame(this._widthRafId);
    }
  }
}
