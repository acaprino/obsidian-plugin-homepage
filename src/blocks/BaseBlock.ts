import { App, Component } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';

export abstract class BaseBlock extends Component {
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

  // Render the muted uppercase block header label.
  // Respects _hideTitle and _titleLabel from instance.config.
  protected renderHeader(el: HTMLElement, title: string): void {
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = (typeof cfg._titleLabel === 'string' && cfg._titleLabel.trim())
      ? cfg._titleLabel.trim()
      : title;
    if (label) {
      el.createDiv({ cls: 'block-header', text: label });
    }
  }
}
