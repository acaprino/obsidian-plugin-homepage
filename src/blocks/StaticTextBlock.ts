import { App, MarkdownRenderer, Modal, Setting, setIcon } from 'obsidian';
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
    const gen = this.nextGeneration();
    const { content = '', heightMode = 'auto' } = this.instance.config as {
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
      contentEl.setAttribute('data-auto-height-content', '');
    }

    if (!content) {
      const hint = contentEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4DD}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No content yet. Click the pencil icon to add text.' });
      return;
    }

    await MarkdownRenderer.render(this.app, content, contentEl, '', this);
    if (this.isStale(gen)) return;
  }

  private enterInlineEdit(el: HTMLElement): void {
    const currentContent = (this.instance.config.content as string) ?? '';

    // Hide rendered content and pencil button
    const contentEl = el.querySelector('.static-text-content');
    const editBtn = el.querySelector('.static-text-edit-btn');
    if (contentEl) contentEl.addClass('hp-hidden');
    if (editBtn) editBtn.addClass('hp-hidden');

    // Create inline editor
    const editor = el.createDiv({ cls: 'static-text-inline-editor' });
    if ((this.instance.config.heightMode ?? 'auto') !== 'fixed') {
      editor.setAttribute('data-auto-height-content', '');
    }

    const textarea = editor.createEl('textarea');
    textarea.value = currentContent;

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
      const currentConfig = this.plugin.layout.blocks.find(b => b.id === this.instance.id)?.config ?? this.instance.config;
      const newConfig = { ...currentConfig, content: textarea.value };
      const newBlocks = this.plugin.layout.blocks.map(b =>
        b.id === this.instance.id ? { ...b, config: newConfig } : b,
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      // Re-render from the updated layout — do NOT reassign this.instance directly
      this.renderContent(el)
        .then(() => this.requestAutoHeight())
        .catch(() => { /* handled in render */ });
    };

    const cancel = (): void => {
      this.renderContent(el).catch(() => { /* handled in render */ });
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

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new StaticTextSettingsModal(this.app, this.instance.config, onSave).open();
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
    new Setting(contentEl).setName('Static text settings').setHeading();

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Height')
      .setDesc('Auto: expands to fit content. Fixed: uses grid cell height with scrollbar.')
      .addDropdown(d =>
        d.addOption('auto', 'Auto (fit content)')
         .addOption('fixed', 'Fixed (scroll)')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'auto')
         .onChange(v => { draft.heightMode = v; }),
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
