import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

export class TagGridBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('tag-grid-block');
    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] TagGridBlock failed to render:', e);
      el.setText('Error loading tag grid. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const { tag = '', title = 'Notes', columns = 2, showEmoji = true } = this.instance.config as {
      tag?: string;
      title?: string;
      columns?: number;
      showEmoji?: boolean;
    };

    this.renderHeader(el, title);

    const grid = el.createDiv({ cls: 'tag-grid' });
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    if (!tag) {
      grid.setText('Configure a tag in settings.');
      return;
    }

    const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch);

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const emoji = showEmoji ? (cache?.frontmatter?.emoji as string ?? '') : '';

      const btn = grid.createEl('button', { cls: 'tag-btn' });
      if (emoji) {
        btn.createSpan({ cls: 'tag-btn-emoji', text: emoji });
      }
      btn.createSpan({ text: file.basename });
      btn.addEventListener('click', () => {
        this.app.workspace.openLinkText(file.path, '');
      });
    }
  }

  openSettings(onSave: () => void): void {
    new TagGridSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
}

class TagGridSettingsModal extends Modal {
  constructor(
    app: App,
    private config: Record<string, unknown>,
    private onSave: (cfg: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Tag Grid Settings' });

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(this.config.title as string ?? 'Notes')
       .onChange(v => { this.config.title = v; }),
    );
    new Setting(contentEl).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(this.config.tag as string ?? '')
       .onChange(v => { this.config.tag = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3')
       .setValue(String(this.config.columns ?? 2))
       .onChange(v => { this.config.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Show emoji').setDesc('Read "emoji" frontmatter field').addToggle(t =>
      t.setValue(this.config.showEmoji as boolean ?? true)
       .onChange(v => { this.config.showEmoji = v; }),
    );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
