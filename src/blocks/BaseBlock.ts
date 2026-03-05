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

  // Render the muted uppercase block header label if title is non-empty
  protected renderHeader(el: HTMLElement, title: string): void {
    if (title) {
      el.createDiv({ cls: 'block-header', text: title });
    }
  }
}
