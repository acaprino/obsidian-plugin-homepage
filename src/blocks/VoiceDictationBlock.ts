import { App } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

export class VoiceDictationBlock extends BaseBlock {
  constructor(app: App, instance: BlockInstance, plugin: IHomepagePlugin) {
    super(app, instance, plugin);
  }

  render(el: HTMLElement): void {
    el.setText('Voice dictation — coming soon');
  }
}
