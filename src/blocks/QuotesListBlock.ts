import { App, CachedMetadata, Modal, Setting, TFile } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

// Only assign safe CSS color values; reject potentially malicious strings
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([^)]+\)|hsla?\([^)]+\))$/;

export class QuotesListBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('quotes-list-block');
    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] QuotesListBlock failed to render:', e);
      el.setText('Error loading quotes. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const { tag = '', title = 'Quotes', columns = 2, maxItems = 20 } = this.instance.config as {
      tag?: string;
      title?: string;
      columns?: number;
      maxItems?: number;
    };

    this.renderHeader(el, title);

    const colsEl = el.createDiv({ cls: 'quotes-columns' });
    colsEl.style.columnCount = String(columns);

    if (!tag) {
      colsEl.setText('Configure a tag in settings.');
      return;
    }

    const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch).slice(0, maxItems);

    // Read all files in parallel for better performance
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        return { file, content, cache };
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[Homepage Blocks] QuotesListBlock failed to read file:', result.reason);
        continue;
      }

      const { file, content, cache } = result.value;
      const color = cache?.frontmatter?.color as string ?? '';
      const body = this.extractBody(content, cache);
      if (!body) continue;

      const item = colsEl.createDiv({ cls: 'quote-item' });
      const quote = item.createEl('blockquote', { cls: 'quote-content', text: body });

      // Validate color before applying to prevent CSS injection
      if (color && COLOR_RE.test(color)) {
        quote.style.borderLeftColor = color;
        quote.style.color = color;
      }

      item.createDiv({ cls: 'quote-source', text: file.basename });
    }
  }

  /** Extract the first few lines of body content using metadataCache frontmatter offset. */
  private extractBody(content: string, cache: CachedMetadata | null): string {
    const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
    const afterFm = content.slice(fmEnd);
    const lines = afterFm
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
    return lines.slice(0, 3).join(' ');
  }

  openSettings(onSave: () => void): void {
    new QuotesSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
}

class QuotesSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'Quotes List Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(draft.title as string ?? 'Quotes')
       .onChange(v => { draft.title = v; }),
    );
    new Setting(contentEl).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(draft.tag as string ?? '')
       .onChange(v => { draft.tag = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3')
       .setValue(String(draft.columns ?? 2))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Max items').addText(t =>
      t.setValue(String(draft.maxItems ?? 20))
       .onChange(v => { draft.maxItems = parseInt(v) || 20; }),
    );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
