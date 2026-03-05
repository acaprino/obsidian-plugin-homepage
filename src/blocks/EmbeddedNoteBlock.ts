import { App, Modal, Setting, TFile, MarkdownRenderer } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

const DEBOUNCE_MS = 300;

export class EmbeddedNoteBlock extends BaseBlock {
  private containerEl: HTMLElement | null = null;
  private debounceTimer: number | null = null;

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('embedded-note-block');

    this.renderContent(el).catch(e => {
      console.error('[Homepage Blocks] EmbeddedNoteBlock failed to render:', e);
      el.setText('Error rendering file. Check console for details.');
    });

    // Register vault listener once; debounce rapid saves
    this.registerEvent(
      this.app.vault.on('modify', (modFile) => {
        const { filePath = '' } = this.instance.config as { filePath?: string };
        if (modFile.path === filePath && this.containerEl) {
          if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
          }
          const target = this.containerEl;
          this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            this.renderContent(target).catch(e => {
              console.error('[Homepage Blocks] EmbeddedNoteBlock failed to re-render after modify:', e);
            });
          }, DEBOUNCE_MS);
        }
      }),
    );
  }

  onunload(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async renderContent(el: HTMLElement): Promise<void> {
    const { filePath = '', showTitle = true } = this.instance.config as {
      filePath?: string;
      showTitle?: boolean;
    };

    el.empty();

    if (!filePath) {
      el.setText('Configure a file path in settings.');
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

    try {
      const content = await this.app.vault.read(file);
      await MarkdownRenderer.render(this.app, content, contentEl, file.path, this);
    } catch (e) {
      console.error('[Homepage Blocks] EmbeddedNoteBlock MarkdownRenderer failed:', e);
      contentEl.setText('Error rendering file.');
    }
  }

  openSettings(onSave: () => void): void {
    new EmbeddedNoteSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
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

    new Setting(contentEl).setName('File path').setDesc('Vault path to the note (e.g. Notes/MyNote.md)').addText(t =>
      t.setValue(this.config.filePath as string ?? '')
       .onChange(v => { this.config.filePath = v; }),
    );
    new Setting(contentEl).setName('Show title').addToggle(t =>
      t.setValue(this.config.showTitle as boolean ?? true)
       .onChange(v => { this.config.showTitle = v; }),
    );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
