import { App, AbstractInputSuggest, Modal, Setting, TFile, MarkdownRenderer } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

const DEBOUNCE_MS = 300;

export class EmbeddedNoteBlock extends BaseBlock {
  render(el: HTMLElement): Promise<void> {
    this.containerEl = el;
    el.addClass('embedded-note-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => this.renderContent(e));

    // Re-render when the embedded file is modified
    this.registerEvent(
      this.app.vault.on('modify', (modFile) => {
        const { filePath = '' } = this.instance.config as { filePath?: string };
        if (modFile.path === filePath) trigger();
      }),
    );

    // Re-render if the embedded file is deleted
    this.registerEvent(this.app.vault.on('delete', (file) => {
      const { filePath = '' } = this.instance.config as { filePath?: string };
      if (file.path === filePath) trigger();
    }));

    // Update the config and re-render if the embedded file is renamed
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      const { filePath = '' } = this.instance.config as { filePath?: string };
      if (oldPath === filePath) {
        // Update config through immutable layout mutation
        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === this.instance.id ? { ...b, config: { ...b.config, filePath: file.path } } : b,
        );
        void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      }
      if (oldPath === filePath || file.path === filePath) trigger();
    }));

    return this.renderContent(el).catch(e => {
      console.error('[Homepage Blocks] EmbeddedNoteBlock failed to render:', e);
      el.setText('Error rendering file. Check console for details.');
    });
  }

  private async renderContent(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const { filePath = '', showTitle = true, heightMode = 'scroll' } = this.instance.config as {
      filePath?: string;
      showTitle?: boolean;
      heightMode?: 'scroll' | 'grow';
    };

    el.empty();
    el.toggleClass('embedded-note-block--grow', heightMode === 'grow');

    if (!filePath) {
      const hint = el.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4C4}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No note selected. Choose a file path in settings to embed it here.' });
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      el.setText(`File not found: ${filePath}`);
      return;
    }

    if (showTitle) {
      this.renderHeader(el, file.basename);
    }

    const contentEl = el.createDiv({ cls: 'embedded-note-content' });
    if (heightMode === 'scroll') {
      contentEl.setAttribute('tabindex', '0');
      contentEl.setAttribute('role', 'region');
      contentEl.setAttribute('aria-label', file.basename);
    }

    try {
      const content = await this.app.vault.read(file);
      if (this.isStale(gen)) return;
      await MarkdownRenderer.render(this.app, content, contentEl, file.path, this);
    } catch (e) {
      console.error('[Homepage Blocks] EmbeddedNoteBlock MarkdownRenderer failed:', e);
      contentEl.setText('Error rendering file.');
    }
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new EmbeddedNoteSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, private inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFile[] {
    const q = query.toLowerCase();
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 30);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('span', { text: file.path });
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    // setValue doesn't dispatch a DOM event, so the TextComponent's onChange
    // won't fire. Dispatch manually so onChange updates the draft.
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}

class EmbeddedNoteSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'Embedded Note Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('File path').setDesc('Vault path to the note (e.g. Notes/MyNote.md)').addText(t => {
      t.setValue(draft.filePath as string ?? '')
       .setPlaceholder('Start typing to search…')
       .onChange(v => { draft.filePath = v; });
      new FileSuggest(this.app, t.inputEl);
    });
    new Setting(contentEl).setName('Show title').addToggle(t =>
      t.setValue(draft.showTitle as boolean ?? true)
       .onChange(v => { draft.showTitle = v; }),
    );
    new Setting(contentEl)
      .setName('Height mode')
      .setDesc('Scroll keeps the block compact. Grow to fit all expands the card to show the full note.')
      .addDropdown(d =>
        d.addOption('scroll', 'Scroll (fixed height)')
         .addOption('grow', 'Grow to fit all')
         .setValue(draft.heightMode as string ?? 'scroll')
         .onChange(v => { draft.heightMode = v; }),
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
