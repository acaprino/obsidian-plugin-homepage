import { App, CachedMetadata, Modal, Setting, TFile } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

// Only assign safe CSS color values; reject potentially malicious strings
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([^)]+\)|hsla?\([^)]+\))$/;

type QuotesConfig = {
  source?: 'tag' | 'text';
  tag?: string;
  quotes?: string;
  title?: string;
  columns?: number;
  maxItems?: number;
  heightMode?: 'wrap' | 'extend';
};

export class QuotesListBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('quotes-list-block');
    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] QuotesListBlock failed to render:', e);
      el.setText('Error loading quotes. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const { source = 'tag', tag = '', quotes = '', title = 'Quotes', columns = 2, maxItems = 20, heightMode = 'wrap' } =
      this.instance.config as QuotesConfig;

    this.renderHeader(el, title);

    el.toggleClass('quotes-list-block--extend', heightMode === 'extend');

    const colsEl = el.createDiv({ cls: 'quotes-columns' });
    if (heightMode === 'wrap') {
      colsEl.setAttribute('tabindex', '0');
      colsEl.setAttribute('role', 'region');
      colsEl.setAttribute('aria-label', 'Quotes');
    }

    const MIN_COL_WIDTH = 200;
    const updateCols = () => {
      const w = colsEl.offsetWidth;
      const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / MIN_COL_WIDTH))) : columns;
      colsEl.style.gridTemplateColumns = `repeat(${effective}, 1fr)`;
    };
    updateCols();
    const ro = new ResizeObserver(updateCols);
    ro.observe(colsEl);
    this.register(() => ro.disconnect());

    if (source === 'text') {
      this.renderTextQuotes(colsEl, quotes, maxItems);
      return;
    }

    // source === 'tag'
    if (!tag) {
      const hint = colsEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4AC}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No tag configured. Add a tag in settings to pull quotes from your notes.' });
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

  /**
   * Render quotes from plain text. Each quote is separated by `---` on its own line.
   * Optionally a source line can follow the quote text, prefixed with `—`, `–`, or `--`.
   *
   * Example:
   *   The only way to do great work is to love what you do.
   *   — Steve Jobs
   *   ---
   *   In the middle of difficulty lies opportunity.
   *   — Albert Einstein
   */
  private renderTextQuotes(colsEl: HTMLElement, raw: string, maxItems: number): void {
    if (!raw.trim()) {
      const hint = colsEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4AC}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No quotes yet. Add them in settings, separated by ---.' });
      return;
    }

    const blocks = raw.split(/\n---\n/).map(b => b.trim()).filter(Boolean).slice(0, maxItems);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1];
      const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
      const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, '') : '';
      const bodyLines = hasSource ? lines.slice(0, -1) : lines;
      const body = bodyLines.join(' ');
      if (!body) continue;

      const item = colsEl.createDiv({ cls: 'quote-item' });
      item.createEl('blockquote', { cls: 'quote-content', text: body });
      if (sourceText) item.createDiv({ cls: 'quote-source', text: sourceText });
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

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new QuotesSettingsModal(this.app, this.instance.config, onSave).open();
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

    const draft = structuredClone(this.config) as QuotesConfig;
    draft.source ??= 'tag';

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(draft.title ?? 'Quotes')
       .onChange(v => { draft.title = v; }),
    );

    // Source toggle — shows/hides the relevant section
    let tagSection: HTMLElement;
    let textSection: HTMLElement;

    new Setting(contentEl)
      .setName('Source')
      .setDesc('Pull quotes from tagged notes, or enter them manually.')
      .addDropdown(d =>
        d.addOption('tag', 'Notes with tag')
         .addOption('text', 'Manual text')
         .setValue(draft.source ?? 'tag')
         .onChange(v => {
           draft.source = v as 'tag' | 'text';
           tagSection.style.display = v === 'tag' ? '' : 'none';
           textSection.style.display = v === 'text' ? '' : 'none';
         }),
      );

    // Tag section
    tagSection = contentEl.createDiv();
    tagSection.style.display = draft.source === 'tag' ? '' : 'none';
    new Setting(tagSection).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(draft.tag ?? '')
       .onChange(v => { draft.tag = v; }),
    );

    // Text section
    textSection = contentEl.createDiv();
    textSection.style.display = draft.source === 'text' ? '' : 'none';
    const textSetting = new Setting(textSection)
      .setName('Quotes')
      .setDesc('Separate quotes with --- on its own line. Add a source line starting with — (e.g. — Author).');
    textSetting.settingEl.style.flexDirection = 'column';
    textSetting.settingEl.style.alignItems = 'stretch';
    const textarea = textSetting.settingEl.createEl('textarea');
    textarea.rows = 8;
    textarea.style.width = '100%';
    textarea.style.marginTop = '8px';
    textarea.style.fontFamily = 'var(--font-monospace)';
    textarea.style.fontSize = '12px';
    textarea.value = draft.quotes ?? '';
    textarea.addEventListener('input', () => { draft.quotes = textarea.value; });

    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3')
       .setValue(String(draft.columns ?? 2))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl)
      .setName('Height mode')
      .setDesc('Scroll keeps the block compact. Grow to fit all works best at full width.')
      .addDropdown(d =>
        d.addOption('wrap', 'Scroll (fixed height)')
         .addOption('extend', 'Grow to fit all')
         .setValue(draft.heightMode ?? 'wrap')
         .onChange(v => { draft.heightMode = v as 'wrap' | 'extend'; }),
      );
    new Setting(contentEl).setName('Max items').addText(t =>
      t.setValue(String(draft.maxItems ?? 20))
       .onChange(v => { draft.maxItems = Math.min(Math.max(1, parseInt(v) || 20), 200); }),
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
