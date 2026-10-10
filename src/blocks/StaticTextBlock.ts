import { MarkdownRenderer, Setting, setIcon } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { AUTO_HEIGHT_ATTR } from '../grid/AutoHeight';

export class StaticTextBlock extends BaseBlock {
  /** True while the inline pencil-icon editor is mounted; suppresses GridLayout.rerender. */
  private inlineEditActive = false;
  /** The open inline editor and the text it started from; null once saved or cancelled. */
  private draft: { textarea: HTMLTextAreaElement; original: string } | null = null;

  hasUnsavedInlineState(): boolean {
    return this.inlineEditActive;
  }

  /**
   * A grid teardown (entering edit mode, a reload from settings, closing the
   * tab) destroys an open editor without Save: keep its text, unless the stored
   * text changed meanwhile (Reset, Import), which it must not overwrite. The
   * layout changes synchronously, so the Discard snapshot taken right after
   * edit mode starts already holds it.
   */
  onunload(): void {
    const draft = this.draft;
    this.draft = null;
    const live = this.plugin.activeBlocks().find(b => b.id === this.instance.id);
    const stored = typeof live?.config.content === 'string' ? live.config.content : '';
    if (draft && live && draft.textarea.value !== draft.original && stored === draft.original) {
      const content = draft.textarea.value;
      void this.plugin.saveActiveBlocks(this.plugin.activeBlocks().map(b =>
        b.id === this.instance.id ? { ...b, config: { ...b.config, content } } : b,
      ));
    }
    super.onunload();
  }

  render(el: HTMLElement): Promise<void> {
    el.addClass('static-text-block');
    // requestAutoHeight() dispatches from here once an inline save re-renders.
    this.containerEl = el;
    // Returned, so the grid measures the rendered Markdown rather than an empty box (M34).
    return this.renderContent(el).catch(e => this.showRenderFailure(el, e));
  }

  private showRenderFailure(el: HTMLElement, e: unknown): void {
    console.error('[Homepage Blocks] StaticTextBlock failed to render:', e);
    this.renderErrorHint(el, 'Couldn’t render this content.');
  }

  private async renderContent(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const { content = '', heightMode = 'auto' } = this.liveConfig() as {
      content?: string;
      heightMode?: 'auto' | 'fixed';
    };

    el.empty();

    this.renderHeader(el, 'Text');

    // Edit button — always visible in view mode
    const editBtn = el.createEl('button', {
      cls: 'static-text-edit-btn',
      attr: { 'aria-label': 'Edit content' },
    });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => {
      this.enterInlineEdit(el);
    });

    const contentEl = el.createDiv({ cls: 'static-text-content' });
    if (heightMode !== 'fixed') {
      contentEl.setAttribute(AUTO_HEIGHT_ATTR, '');
      this.observeSizeForAutoHeight(contentEl);
    }

    if (!content) {
      const hint = contentEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4DD}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No content yet. Click the pencil icon to add text.' });
      return;
    }

    this.openLinksOnClick(contentEl, '');
    await MarkdownRenderer.render(this.app, content, contentEl, '', this);
    if (this.isStale(gen)) return;
  }

  private enterInlineEdit(el: HTMLElement): void {
    const config = this.liveConfig();
    const currentContent = (config.content as string) ?? '';
    this.inlineEditActive = true;

    // Hide rendered content and pencil button
    const contentEl = el.querySelector('.static-text-content');
    const editBtn = el.querySelector('.static-text-edit-btn');
    if (contentEl) contentEl.addClass('hp-hidden');
    if (editBtn) editBtn.addClass('hp-hidden');

    // Create inline editor
    const editor = el.createDiv({ cls: 'static-text-inline-editor' });
    if ((config.heightMode ?? 'auto') !== 'fixed') {
      editor.setAttribute(AUTO_HEIGHT_ATTR, '');
    }

    const textarea = editor.createEl('textarea');
    textarea.value = currentContent;
    this.draft = { textarea, original: currentContent };

    const toolbar = editor.createDiv({ cls: 'inline-edit-toolbar' });

    const saveBtn = toolbar.createEl('button', {
      cls: 'inline-edit-btn inline-edit-save',
      attr: { 'aria-label': 'Save' },
    });
    setIcon(saveBtn, 'check');

    const cancelBtn = toolbar.createEl('button', {
      cls: 'inline-edit-btn inline-edit-cancel',
      attr: { 'aria-label': 'Cancel' },
    });
    setIcon(cancelBtn, 'x');

    const save = (): void => {
      // Lock the editor until the save lands, so text typed meanwhile can't be
      // silently dropped and Cancel can't claim to undo a save already under way.
      textarea.disabled = true;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      this.draft = null;
      // updateBlockConfig waits for in-flight saves so a rapid drag+pencil-save
      // doesn't lose either change. Re-render only once it has landed, and from
      // the live layout: this.instance still holds the pre-save text. Until then
      // the editor counts as unsaved state, which holds off external rerenders.
      void this.plugin.updateBlockConfig(this.instance.id, { content: textarea.value })
        .finally(() => { this.inlineEditActive = false; })
        .then(() => this.renderContent(el))
        .then(() => this.requestAutoHeight())
        .catch(e => this.showRenderFailure(el, e));
    };

    const cancel = (): void => {
      this.inlineEditActive = false;
      this.draft = null;
      this.renderContent(el).catch(e => this.showRenderFailure(el, e));
    };

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    textarea.focus();
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    new Setting(body)
      .setName('Height')
      .setDesc('Auto: expands to fit content. Fixed: uses grid cell height with scrollbar.')
      .addDropdown(d =>
        d.addOption('auto', 'Auto (fit content)')
         .addOption('fixed', 'Fixed (scroll)')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'auto')
         .onChange(v => { draft.heightMode = v; }),
      );

    new Setting(body).setName('Content').setDesc('Supports Markdown.');
    const textarea = body.createEl('textarea', { cls: 'static-text-settings-textarea' });
    textarea.value = draft.content as string ?? '';
    textarea.rows = 10;
    textarea.addEventListener('input', () => { draft.content = textarea.value; });
  }
}
