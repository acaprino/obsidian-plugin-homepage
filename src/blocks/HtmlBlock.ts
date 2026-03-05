import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

export class HtmlBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('html-block');

    const { title = '', html = '' } = this.instance.config as {
      title?: string;
      html?: string;
    };

    if (title) {
      this.renderHeader(el, title);
    }

    const contentEl = el.createDiv({ cls: 'html-block-content' });

    if (!html) {
      contentEl.setText('Configure HTML in settings.');
      return;
    }

    contentEl.innerHTML = html;
  }

  openSettings(onSave: () => void): void {
    new HtmlBlockSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
}

class HtmlBlockSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'HTML Block Settings' });

    new Setting(contentEl).setName('Block title').setDesc('Optional header shown above the HTML.').addText(t =>
      t.setValue(this.config.title as string ?? '')
       .onChange(v => { this.config.title = v; }),
    );

    new Setting(contentEl).setName('HTML').setDesc('Raw HTML rendered directly in the block.');
    const textarea = contentEl.createEl('textarea', { cls: 'static-text-settings-textarea' });
    textarea.value = this.config.html as string ?? '';
    textarea.rows = 12;
    textarea.setAttribute('spellcheck', 'false');
    textarea.addEventListener('input', () => { this.config.html = textarea.value; });

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
