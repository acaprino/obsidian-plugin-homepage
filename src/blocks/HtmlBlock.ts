import { App, Modal, Setting, sanitizeHTMLToDom } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

export class HtmlBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('html-block');

    const { html = '' } = this.instance.config as {
      html?: string;
    };

    this.renderHeader(el, 'HTML');

    const contentEl = el.createDiv({ cls: 'html-block-content' });

    if (!html) {
      const hint = contentEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '</>' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No HTML content yet. Add your markup in settings.' });
      return;
    }

    // Defense-in-depth: strip dangerous tags that could bypass sanitizeHTMLToDom
    // in the Electron context (iframe, object, embed, form, meta, link, base).
    const DANGEROUS_TAGS_RE = /<\s*(iframe|object|embed|form|meta|link|base)\b[^>]*>/gi;
    contentEl.appendChild(sanitizeHTMLToDom(html.replace(DANGEROUS_TAGS_RE, '')));
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new HtmlBlockSettingsModal(this.app, this.instance.config, onSave).open();
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

    new Setting(contentEl).setName('HTML').setDesc('HTML is sanitized before rendering.');
    const textarea = contentEl.createEl('textarea', { cls: 'html-settings-textarea' });
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
