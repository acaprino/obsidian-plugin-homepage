import { App, Modal, Setting } from 'obsidian';
import type { ActiveContent } from '../utils/importSanitizer';

export type ImportChoice = 'all' | 'without-content';

/**
 * Confirms a clipboard import, which replaces the layout. Blocks that bring
 * active content (utils/importSanitizer.ts findActiveContent) are listed with an
 * excerpt, and the import can leave that content out (M11, M12). Rejections of
 * an async onChoice are logged: the modal has closed and has no UI left.
 */
export class ConfirmImportModal extends Modal {
  constructor(
    app: App,
    private summary: string,
    private active: ActiveContent[],
    private onChoice: (choice: ImportChoice) => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Import layout?').setHeading();
    contentEl.createEl('p', { text: `This replaces your current layout with the imported one (${this.summary}). This can’t be undone.` });
    if (this.active.length > 0) {
      contentEl.createEl('p', {
        text: 'These blocks bring text that is rendered on the homepage or written into new notes. Import it only if you trust where this layout came from:',
      });
      const list = contentEl.createEl('ul', { cls: 'hp-import-active-list' });
      for (const item of this.active) {
        const li = list.createEl('li');
        li.createEl('strong', { text: `${item.title} (${item.key})` });
        li.appendText(': ');
        li.createEl('code', { text: item.excerpt });
      }
    }
    const buttons = new Setting(contentEl);
    buttons.addButton(btn => btn.setButtonText(this.active.length > 0 ? 'Import all' : 'Import').setWarning().onClick(() => this.choose('all')));
    if (this.active.length > 0) {
      buttons.addButton(btn => btn.setButtonText('Import without content').onClick(() => this.choose('without-content')));
    }
    buttons.addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));
  }

  private choose(choice: ImportChoice): void {
    void Promise.resolve(this.onChoice(choice)).catch(e =>
      console.error('[Homepage Blocks] Import failed:', e instanceof Error ? e.message : 'unknown error'),
    );
    this.close();
  }

  onClose(): void { this.contentEl.empty(); }
}
