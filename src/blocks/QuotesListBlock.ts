import { App, CachedMetadata, Modal, Setting, moment } from 'obsidian';
import { cacheHasTag, getFilesWithTag } from '../utils/tags';
import { parseNoteInsight } from '../utils/noteContent';
import { BaseBlock } from './BaseBlock';

// Only assign safe CSS color values; reject potentially malicious strings.
// Hex, rgb/rgba, hsl/hsla with strict numeric internals. Bare-word colors
// (e.g. "red") are allowed only if they contain no digits (blocks "expression").
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*[\d.]+\s*)?\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*[\d.]+\s*)?\))$/;

const DEBOUNCE_MS = 500;
const MS_PER_DAY = 86_400_000;

// Allow letters, numbers, spaces, commas, single-quotes, hyphens — blocks CSS injection.
// Double-quotes excluded: single quotes suffice for multi-word font names in CSS.
const SAFE_FONT_RE = /^[a-zA-Z0-9\s,'\-_]+$/;

type QuotesConfig = {
  source?: 'tag' | 'text';
  tag?: string;
  quotes?: string;
  title?: string;
  columns?: number;
  maxItems?: number;
  heightMode?: 'wrap' | 'extend';
  quoteStyle?: 'classic' | 'centered' | 'card';
  fontStyle?: 'default' | 'serif' | 'handwriting';
  customFont?: string;
  mode?: 'list' | 'single';
  dailySeed?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
};

export class QuotesListBlock extends BaseBlock {
  render(el: HTMLElement): Promise<void> {
    this.containerEl = el;
    el.addClass('quotes-list-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    // Only watch vault events when using tag source (text source is static config)
    this.registerEvent(this.app.metadataCache.on('changed', (_file, _data, cache) => {
      const cfg = this.instance.config as QuotesConfig;
      if (cfg.source === 'text' || !cfg.tag) return;
      const tagSearch = cfg.tag.startsWith('#') ? cfg.tag : `#${cfg.tag}`;
      if (cacheHasTag(cache, tagSearch)) trigger();
    }));

    this.registerEvent(this.app.vault.on('delete', (file) => {
      const cfg = this.instance.config as QuotesConfig;
      if (cfg.source === 'text' || !cfg.tag) return;
      // Only markdown files can have tags
      if (file.path.endsWith('.md')) trigger();
    }));

    return this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] QuotesListBlock failed to render:', e);
      el.setText('Error loading quotes. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const {
      source = 'tag', tag = '', quotes = '', columns = 2, maxItems = 20,
      heightMode = 'extend', quoteStyle = 'classic', fontStyle = 'default',
      customFont = '', mode = 'list', dailySeed = true,
      textAlign = 'left', verticalAlign = 'top',
    } = this.instance.config as QuotesConfig;

    el.style.setProperty('--hp-quote-valign', verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start');
    el.style.setProperty('--hp-quote-align', textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'start');

    this.renderHeader(el, 'Quotes');

    const safeMode = mode === 'single' ? 'single' : 'list';

    // Runtime enum validation — guards against tampered data.json values.
    const safeFontStyle = fontStyle === 'serif' || fontStyle === 'handwriting' ? fontStyle : 'default';

    // Font style applies in both modes
    el.toggleClass('quote-font-serif', safeFontStyle === 'serif');
    el.toggleClass('quote-font-handwriting', safeFontStyle === 'handwriting');

    // Custom font overrides the preset via a CSS variable on the block element.
    const safeFont = typeof customFont === 'string' && customFont.trim() && SAFE_FONT_RE.test(customFont.trim())
      ? customFont.trim() : '';
    if (safeFont) el.style.setProperty('--hp-quote-font', safeFont);
    else el.style.removeProperty('--hp-quote-font');

    // Reset style classes before branching — prevents stale classes when switching modes
    el.toggleClass('quote-style-centered', false);
    el.toggleClass('quote-style-card', false);
    el.toggleClass('quotes-list-block--extend', false);

    // ── Single mode ──────────────────────────────────────────────────────────
    if (safeMode === 'single') {
      if (source === 'text') {
        this.renderSingleTextQuote(el, quotes, dailySeed);
        return;
      }

      // source === 'tag'
      if (!tag) {
        const hint = el.createDiv({ cls: 'block-empty-hint' });
        hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4A1}' });
        hint.createDiv({ cls: 'block-empty-hint-text', text: 'No tag configured. Add a tag in settings to show a daily rotating note.' });
        return;
      }

      const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
      const files = getFilesWithTag(this.app, tagSearch);

      if (files.length === 0) {
        el.createDiv({ cls: 'insight-card' }).setText(`No files found with tag ${tagSearch}`);
        return;
      }

      // Use local midnight as the day index so it changes at local midnight, not UTC
      const dayIndex = Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
      const index = dailySeed
        ? dayIndex % files.length
        : Math.floor(Math.random() * files.length);

      const file = files[index];
      try {
        const content = await this.app.vault.read(file);
        if (this.isStale(gen)) return;
        const cache = this.app.metadataCache.getFileCache(file);
        const { heading, body } = parseNoteInsight(content, cache);
        const card = el.createDiv({ cls: 'insight-card' });
        card.createDiv({ cls: 'insight-title', text: heading || file.basename });
        card.createDiv({ cls: 'insight-body', text: body });
      } catch (e) {
        console.error('[Homepage Blocks] QuotesListBlock single mode failed to read file:', e);
        el.createDiv({ cls: 'insight-card' }).setText('Error reading file.');
      }
      
      const card = el.querySelector('.insight-card') as HTMLElement;
      if (card && heightMode === 'extend') {
        el.toggleClass('quotes-list-block--extend', true);
        card.setAttribute('data-auto-height-content', '');
        setTimeout(() => {
          if (this.app.workspace.layoutReady) {
            window.dispatchEvent(new CustomEvent('hp-block-height-changed', { detail: { blockId: this.instance.id } }));
          }
        }, 50);
      }
      return;
    }

    // ── List mode ────────────────────────────────────────────────────────────
    const safeQuoteStyle = quoteStyle === 'centered' || quoteStyle === 'card' ? quoteStyle : 'classic';

    // CSS classes for style variants (follows codebase pattern — no data-attributes).
    el.toggleClass('quote-style-centered', safeQuoteStyle === 'centered');
    el.toggleClass('quote-style-card', safeQuoteStyle === 'card');

    el.toggleClass('quotes-list-block--extend', heightMode === 'extend');

    const colsEl = el.createDiv({ cls: 'quotes-columns' });
    if (heightMode !== 'wrap') colsEl.setAttribute('data-auto-height-content', '');
    if (heightMode === 'wrap') {
      colsEl.setAttribute('tabindex', '0');
      colsEl.setAttribute('role', 'region');
      colsEl.setAttribute('aria-label', 'Quotes');
    }

    // In centered style, CSS forces column-count: 1 so the responsive column
    // observer would only waste layout reads. Skip it entirely.
    if (safeQuoteStyle !== 'centered') {
      const MIN_COL_WIDTH = 200;
      const updateCols = () => {
        const w = colsEl.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / MIN_COL_WIDTH))) : columns;
        colsEl.style.setProperty('--hp-column-count', String(effective));
      };
      updateCols();
      const ro = new ResizeObserver(updateCols);
      ro.observe(colsEl);
      this.register(() => ro.disconnect());
    }

    // Watch width changes for auto-height recalculation
    if (heightMode !== 'wrap') {
      this.observeWidthForAutoHeight(colsEl);
    }

    if (source === 'text') {
      this.renderTextQuotes(colsEl, quotes, maxItems);
      return;
    }

    // source === 'tag', list mode
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

    if (this.isStale(gen)) return;

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
        quote.style.setProperty('--hp-quote-color', color);
        quote.addClass('quote-colored');
      }

      item.createDiv({ cls: 'quote-source', text: file.basename });
    }
  }

  /** Render a single quote picked from the text list (daily or random). */
  private renderSingleTextQuote(el: HTMLElement, raw: string, dailySeed: boolean): void {
    if (!raw.trim()) {
      const hint = el.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4AC}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No quotes yet. Add them in settings, separated by ---.' });
      return;
    }

    const blocks = raw.split(/\n---\n/).map(b => b.trim()).filter(Boolean);
    const dayIndex = Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
    const index = dailySeed
      ? dayIndex % blocks.length
      : Math.floor(Math.random() * blocks.length);

    const block = blocks[index];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const lastLine = lines[lines.length - 1];
    const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
    const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, '') : '';
    const bodyLines = hasSource ? lines.slice(0, -1) : lines;
    const body = bodyLines.join(' ');

    const card = el.createDiv({ cls: 'insight-card' });
    if (sourceText) card.createDiv({ cls: 'insight-title', text: sourceText });
    card.createDiv({ cls: 'insight-body', text: body });
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
    new Setting(contentEl).setName('Quotes list settings').setHeading();

    const draft = structuredClone(this.config) as QuotesConfig;
    draft.source ??= 'tag';
    draft.mode ??= 'list';

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
           draft.source = v === 'text' ? 'text' : 'tag';
           tagSection.toggleClass('hp-hidden', v !== 'tag');
           textSection.toggleClass('hp-hidden', v !== 'text');
         }),
      );

    // Tag section
    tagSection = contentEl.createDiv();
    tagSection.toggleClass('hp-hidden', draft.source !== 'tag');
    new Setting(tagSection).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(draft.tag ?? '')
       .onChange(v => { draft.tag = v; }),
    );

    // Text section
    textSection = contentEl.createDiv();
    textSection.toggleClass('hp-hidden', draft.source !== 'text');
    const textSetting = new Setting(textSection)
      .setName('Quotes')
      .setDesc('Separate quotes with --- on its own line, then add a source with \u2014 (e.g. \u2014 author).');
    textSetting.settingEl.addClass('hp-setting-column');
    const textarea = textSetting.settingEl.createEl('textarea');
    textarea.rows = 8;
    textarea.addClass('hp-textarea-full');
    textarea.value = draft.quotes ?? '';
    textarea.addEventListener('input', () => { draft.quotes = textarea.value; });

    // Display mode
    let singleSection: HTMLElement;
    let listSection: HTMLElement;

    new Setting(contentEl)
      .setName('Display')
      .setDesc('Show all items as a grid, or rotate through one at a time.')
      .addDropdown(d =>
        d.addOption('list', 'All items')
         .addOption('single', 'One at a time')
         .setValue(draft.mode ?? 'list')
         .onChange(v => {
           draft.mode = v === 'single' ? 'single' : 'list';
           singleSection.toggleClass('hp-hidden', v !== 'single');
           listSection.toggleClass('hp-hidden', v !== 'list');
         }),
      );

    // Single-mode options
    singleSection = contentEl.createDiv();
    singleSection.toggleClass('hp-hidden', draft.mode !== 'single');
    new Setting(singleSection)
      .setName('Daily seed')
      .setDesc('Show the same item all day; changes at midnight.')
      .addToggle(t =>
        t.setValue(draft.dailySeed !== false)
         .onChange(v => { draft.dailySeed = v; }),
      );

    // List-mode options
    listSection = contentEl.createDiv();
    listSection.toggleClass('hp-hidden', draft.mode !== 'list');
    new Setting(listSection).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3')
       .setValue(String(typeof draft.columns === 'number' ? draft.columns : 2))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(listSection)
      .setName('Height mode')
      .setDesc('Scroll keeps the block compact \u2014 grow to fit all works best at full width.')
      .addDropdown(d =>
        d.addOption('wrap', 'Scroll (fixed height)')
         .addOption('extend', 'Grow to fit all')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'extend')
         .onChange(v => { draft.heightMode = v === 'wrap' ? 'wrap' : 'extend'; }),
      );
    new Setting(listSection).setName('Max items').addText(t =>
      t.setValue(String(typeof draft.maxItems === 'number' ? draft.maxItems : 20))
       .onChange(v => { draft.maxItems = Math.min(Math.max(1, parseInt(v) || 20), 200); }),
    );
    new Setting(listSection)
      .setName('Quote style')
      .setDesc('Classic shows a left accent bar. Centered stacks quotes in one column. Card wraps each quote in its own box.')
      .addDropdown(d =>
        d.addOption('classic', 'Classic')
         .addOption('centered', 'Centered')
         .addOption('card', 'Card')
         .setValue(typeof draft.quoteStyle === 'string' ? draft.quoteStyle : 'classic')
         .onChange(v => { draft.quoteStyle = v === 'centered' || v === 'card' ? v : 'classic'; }),
      );

    new Setting(contentEl)
      .setName('Text alignment')
      .setDesc('Align text to the left, center, or right.')
      .addDropdown(d =>
        d.addOption('left', 'Left')
         .addOption('center', 'Center')
         .addOption('right', 'Right')
         .setValue(typeof draft.textAlign === 'string' ? draft.textAlign : 'left')
         .onChange(v => { draft.textAlign = v as 'left' | 'center' | 'right'; }),
      );

    new Setting(contentEl)
      .setName('Vertical alignment')
      .setDesc('Align the quotes list or card vertically within the block.')
      .addDropdown(d =>
        d.addOption('top', 'Top')
         .addOption('middle', 'Middle')
         .addOption('bottom', 'Bottom')
         .setValue(typeof draft.verticalAlign === 'string' ? draft.verticalAlign : 'top')
         .onChange(v => { draft.verticalAlign = v as 'top' | 'middle' | 'bottom'; }),
      );

    // Font settings apply in both modes
    new Setting(contentEl)
      .setName('Font style')
      .setDesc('Preset font family. Overridden by a custom font below (line-height preset still applies).')
      .addDropdown(d =>
        d.addOption('default', 'Default')
         .addOption('serif', 'Serif')
         .addOption('handwriting', 'Handwriting')
         .setValue(typeof draft.fontStyle === 'string' ? draft.fontStyle : 'default')
         .onChange(v => { draft.fontStyle = v === 'serif' || v === 'handwriting' ? v : 'default'; }),
      );
    new Setting(contentEl)
      .setName('Custom font')
      .setDesc('Any installed font family. Overrides the font style preset above.')
      .addText(t =>
        t.setPlaceholder('Georgia')
         .setValue(typeof draft.customFont === 'string' ? draft.customFont : '')
         .onChange(v => { draft.customFont = v; }),
      );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft as Record<string, unknown>);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
