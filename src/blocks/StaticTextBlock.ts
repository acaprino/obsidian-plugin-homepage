import { App, MarkdownRenderer, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

export class StaticTextBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('static-text-block');
    this.renderContent(el).catch(e => {
      console.error('[Homepage Blocks] StaticTextBlock failed to render:', e);
      el.setText('Error rendering content.');
    });
  }

  private async renderContent(el: HTMLElement): Promise<void> {
    const { title = '', content = '' } = this.instance.config as {
      title?: string;
      content?: string;
    };

    el.empty();

    if (title) {
      this.renderHeader(el, title);
    }

    const contentEl = el.createDiv({ cls: 'static-text-content' });

    if (!content) {
      contentEl.setText('Configure text in settings.');
      return;
    }

    await MarkdownRenderer.render(this.app, content, contentEl, '', this);
  }

  openSettings(onSave: () => void): void {
    new StaticTextSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
}

class StaticTextSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'Static Text Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Block title').setDesc('Optional header shown above the text.').addText(t =>
      t.setValue(draft.title as string ?? '')
       .onChange(v => { draft.title = v; }),
    );

    new Setting(contentEl).setName('Content').setDesc('Supports Markdown.');
    const textarea = contentEl.createEl('textarea', { cls: 'static-text-settings-textarea' });
    textarea.value = draft.content as string ?? '';
    textarea.rows = 10;
    textarea.addEventListener('input', () => { draft.content = textarea.value; });

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
