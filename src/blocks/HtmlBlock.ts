import { App, Modal, Setting, sanitizeHTMLToDom } from 'obsidian';
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
      const hint = contentEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '</>' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No HTML content yet. Add your markup in settings.' });
      return;
    }

    contentEl.appendChild(sanitizeHTMLToDom(html));
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

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Block title').setDesc('Optional header shown above the HTML.').addText(t =>
      t.setValue(draft.title as string ?? '')
       .onChange(v => { draft.title = v; }),
    );

    new Setting(contentEl).setName('HTML').setDesc('HTML is sanitized before rendering.');
    const textarea = contentEl.createEl('textarea', { cls: 'static-text-settings-textarea' });
    textarea.value = draft.html as string ?? '';
    textarea.rows = 12;
    textarea.setAttribute('spellcheck', 'false');
    textarea.addEventListener('input', () => { draft.html = textarea.value; });

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
