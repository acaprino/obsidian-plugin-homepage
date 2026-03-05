import { App, Component } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';

export abstract class BaseBlock extends Component {
  private _headerContainer: HTMLElement | null = null;

  constructor(
    protected app: App,
    protected instance: BlockInstance,
    protected plugin: IHomepagePlugin,
  ) {
    super();
  }

  abstract render(el: HTMLElement): void | Promise<void>;

  // Override to open a per-block settings modal
  openSettings(_onSave: () => void): void {}

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
    const header = container.createDiv({ cls: 'block-header' });
    if (typeof cfg._titleEmoji === 'string' && cfg._titleEmoji) {
      header.createSpan({ cls: 'block-header-emoji', text: cfg._titleEmoji });
    }
    header.createSpan({ text: label });
  }
}
