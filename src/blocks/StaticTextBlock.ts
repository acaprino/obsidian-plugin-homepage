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
  }

  private enterInlineEdit(el: HTMLElement): void {
    const currentContent = (this.instance.config.content as string) ?? '';

    // Hide rendered content and pencil button
    const contentEl = el.querySelector('.static-text-content') as HTMLElement | null;
    const editBtn = el.querySelector('.static-text-edit-btn') as HTMLElement | null;
    if (contentEl) contentEl.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';

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
      const newConfig = { ...this.instance.config, content: textarea.value };
      const newBlocks = this.plugin.layout.blocks.map(b =>
        b.id === this.instance.id ? { ...b, config: newConfig } : b,
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      // Re-render from the updated layout — do NOT reassign this.instance directly
      this.renderContent(el).catch(() => { /* handled in render */ });
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
    contentEl.createEl('h2', { text: 'Static Text Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Height')
      .setDesc('Auto: expands to fit all content. Fixed: uses grid cell height with scrollbar.')
      .addDropdown(d =>
        d.addOption('auto', 'Auto (fit content)')
         .addOption('fixed', 'Fixed (scroll)')
         .setValue(String(draft.heightMode ?? 'auto'))
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
