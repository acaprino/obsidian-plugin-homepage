import { App, CachedMetadata, Modal, Setting, moment } from 'obsidian';
import { cacheHasTag, clearTagCache, getFilesWithTag } from '../utils/tags';
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

// Inline formatting tokenizer: matches **bold** (non-greedy, non-empty)
// or a #hashtag at start-of-string or after whitespace. Group 3 captures the
// leading whitespace so we can re-emit it as plain text before the chip.
const INLINE_FMT_RE = /\*\*([^*\n]+?)\*\*|(^|\s)(#[\p{L}0-9_\-/]+)/gu;

/**
 * Render text into `el` with inline `**bold**` and `#hashtag` formatting.
 * Uses Obsidian DOM API (no innerHTML). Unmatched text is appended verbatim.
 */
function renderFormatted(el: HTMLElement, text: string): void {
  INLINE_FMT_RE.lastIndex = 0;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_FMT_RE.exec(text)) !== null) {
    if (m.index > lastIndex) el.appendText(text.slice(lastIndex, m.index));
    if (m[1] !== undefined) {
      el.createEl('strong', { text: m[1] });
    } else {
      if (m[2]) el.appendText(m[2]);
      el.createSpan({ cls: 'quote-hashtag', text: m[3] });
    }
    lastIndex = INLINE_FMT_RE.lastIndex;
  }
  if (lastIndex < text.length) el.appendText(text.slice(lastIndex));
}

type QuotesConfig = {
  source?: 'tag' | 'text';
  tag?: string;
  quotes?: string;
  columns?: number;
  maxItems?: number;
  heightMode?: 'wrap' | 'extend';
  quoteStyle?: 'classic' | 'centered' | 'card';
  fontStyle?: 'default' | 'serif' | 'handwriting';
  customFont?: string;
  dailySeed?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  showNoteTitle?: boolean;
  hideAccentBar?: boolean;
};

export class QuotesListBlock extends BaseBlock {
  /** Column ResizeObserver — disconnected before each re-render. */
  private colsRo: ResizeObserver | null = null;

  render(el: HTMLElement): Promise<void> {
    this.containerEl = el;
    el.addClass('quotes-list-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    // Only watch vault events when using tag source (text source is static config)
    this.registerEvent(this.app.metadataCache.on('changed', (_file, _data, cache) => {
      const cfg = this.instance.config as QuotesConfig;
      if (cfg.source === 'text' || !cfg.tag) return;
      const tagSearch = cfg.tag.startsWith('#') ? cfg.tag : `#${cfg.tag}`;
      if (cacheHasTag(cache, tagSearch)) { clearTagCache(); trigger(); }
    }));

    this.registerEvent(this.app.vault.on('delete', (file) => {
      const cfg = this.instance.config as QuotesConfig;
      if (cfg.source === 'text' || !cfg.tag) return;
      if (file.path.endsWith('.md')) { clearTagCache(); trigger(); }
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
      customFont = '', dailySeed = true,
      textAlign = 'left', verticalAlign = 'top',
    } = this.instance.config as QuotesConfig;

    el.style.setProperty('--hp-quote-valign', verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start');
    el.style.setProperty('--hp-quote-align', textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'start');

    this.renderHeader(el, 'Quotes');

    // maxItems === 1 triggers single-quote mode (daily rotation);
    // 0 or undefined means show all; otherwise show that many.
    const effectiveMax = typeof maxItems === 'number' && maxItems > 0 ? maxItems : 0;
    const safeMode = effectiveMax === 1 ? 'single' : 'list';

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
    el.toggleClass('quote-no-accent', (this.instance.config as QuotesConfig).hideAccentBar === true);

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
        const showTitle = (this.instance.config as QuotesConfig).showNoteTitle !== false;
        if (showTitle) card.createDiv({ cls: 'insight-title', text: heading || file.basename });
        const bodyEl = card.createDiv({ cls: 'insight-body' });
        renderFormatted(bodyEl, body);
      } catch (e) {
        console.error('[Homepage Blocks] QuotesListBlock single mode failed to read file:', e);
        el.createDiv({ cls: 'insight-card' }).setText('Error reading file.');
      }
      
      const card = el.querySelector('.insight-card') as HTMLElement;
      if (card && heightMode === 'extend') {
        el.toggleClass('quotes-list-block--extend', true);
        card.setAttribute('data-auto-height-content', '');
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
      this.colsRo?.disconnect();
      this.colsRo = new ResizeObserver(updateCols);
      this.colsRo.observe(colsEl);
      this.register(() => { this.colsRo?.disconnect(); this.colsRo = null; });
    }

    // Watch width changes for auto-height recalculation
    if (heightMode !== 'wrap') {
      this.observeWidthForAutoHeight(colsEl);
    }

    if (source === 'text') {
      this.renderTextQuotes(colsEl, quotes, effectiveMax);
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
    const allFiles = getFilesWithTag(this.app, tagSearch);
    const files = effectiveMax > 0 ? allFiles.slice(0, effectiveMax) : allFiles;

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
      const quote = item.createEl('blockquote', { cls: 'quote-content' });
      renderFormatted(quote, body);

      // Validate color before applying to prevent CSS injection
      if (color && COLOR_RE.test(color)) {
        quote.style.setProperty('--hp-quote-color', color);
        quote.addClass('quote-colored');
      }

      const showTitle = (this.instance.config as QuotesConfig).showNoteTitle !== false;
      if (showTitle) item.createDiv({ cls: 'quote-source', text: file.basename });
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
    const bodyEl = card.createDiv({ cls: 'insight-body' });
    renderFormatted(bodyEl, body);
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

    const allBlocks = raw.split(/\n---\n/).map(b => b.trim()).filter(Boolean);
    const blocks = maxItems > 0 ? allBlocks.slice(0, maxItems) : allBlocks;

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1];
      const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
      const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, '') : '';
      const bodyLines = hasSource ? lines.slice(0, -1) : lines;
      const body = bodyLines.join(' ');
      if (!body) continue;

      const item = colsEl.createDiv({ cls: 'quote-item' });
      const quote = item.createEl('blockquote', { cls: 'quote-content' });
      renderFormatted(quote, body);
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
    new Setting(contentEl).setName('Quotes settings').setHeading();

    const draft = structuredClone(this.config) as QuotesConfig;
    draft.source ??= 'tag';

    // Source toggle — shows/hides the relevant section
    let tagSection: HTMLElement;
    let textSection: HTMLElement;

    new Setting(contentEl)
      .setName('Source')
      .setDesc('From tagged notes, or entered manually.')
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
    new Setting(tagSection)
      .setName('Show note title')
      .setDesc('Display the note filename as the quote attribution.')
      .addToggle(t =>
        t.setValue(draft.showNoteTitle !== false)
         .onChange(v => { draft.showNoteTitle = v; }),
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

    // ── Display settings (always visible) ──────────────────
    new Setting(contentEl)
      .setName('Max quotes')
      .setDesc('Leave empty for all. Set to 1 for a daily rotating quote.')
      .addText(t =>
        t.setPlaceholder('All')
         .setValue(typeof draft.maxItems === 'number' && draft.maxItems > 0 ? String(draft.maxItems) : '')
         .onChange(v => {
           const n = parseInt(v);
           draft.maxItems = isNaN(n) || n <= 0 ? 0 : Math.min(n, 500);
           dailySeedSetting.toggleClass('hp-hidden', draft.maxItems !== 1);
         }),
      );

    const dailySeedSetting = contentEl.createDiv();
    dailySeedSetting.toggleClass('hp-hidden', (draft.maxItems ?? 0) !== 1);
    new Setting(dailySeedSetting)
      .setName('Daily seed')
      .setDesc('Same quote all day, changes at midnight.')
      .addToggle(t =>
        t.setValue(draft.dailySeed !== false)
         .onChange(v => { draft.dailySeed = v; }),
      );

    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(typeof draft.columns === 'number' ? draft.columns : 2))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl)
      .setName('Height mode')
      .setDesc('Scroll keeps the block compact. Grow to fit expands to show all quotes.')
      .addDropdown(d =>
        d.addOption('wrap', 'Scroll (fixed height)')
         .addOption('extend', 'Grow to fit all')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'extend')
         .onChange(v => { draft.heightMode = v === 'wrap' ? 'wrap' : 'extend'; }),
      );
    new Setting(contentEl)
      .setName('Quote style')
      .setDesc('Classic: left accent bar. Centered: single column. Card: each quote in its own box.')
      .addDropdown(d =>
        d.addOption('classic', 'Classic')
         .addOption('centered', 'Centered')
         .addOption('card', 'Card')
         .setValue(typeof draft.quoteStyle === 'string' ? draft.quoteStyle : 'classic')
         .onChange(v => { draft.quoteStyle = v === 'centered' || v === 'card' ? v : 'classic'; }),
      );
    new Setting(contentEl)
      .setName('Hide accent bar')
      .setDesc('Remove the vertical line next to each quote.')
      .addToggle(t =>
        t.setValue(draft.hideAccentBar === true)
         .onChange(v => { draft.hideAccentBar = v; }),
      );

    new Setting(contentEl)
      .setName('Text alignment')
      .setDesc('Left, center, or right.')
      .addDropdown(d =>
        d.addOption('left', 'Left')
         .addOption('center', 'Center')
         .addOption('right', 'Right')
         .setValue(typeof draft.textAlign === 'string' ? draft.textAlign : 'left')
         .onChange(v => { draft.textAlign = v as 'left' | 'center' | 'right'; }),
      );

    new Setting(contentEl)
      .setName('Vertical alignment')
      .setDesc('Vertical alignment within the block.')
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
      .setDesc('Font preset. A custom font below will override this (line-height still applies).')
      .addDropdown(d =>
        d.addOption('default', 'Default')
         .addOption('serif', 'Serif')
         .addOption('handwriting', 'Handwriting')
         .setValue(typeof draft.fontStyle === 'string' ? draft.fontStyle : 'default')
         .onChange(v => { draft.fontStyle = v === 'serif' || v === 'handwriting' ? v : 'default'; }),
      );
    new Setting(contentEl)
      .setName('Custom font')
      .setDesc('Any installed font. Overrides the preset above.')
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
