import { App, Modal, Setting } from 'obsidian';

/** Confirmation dialog shown before removing a block from the homepage layout. */
export class RemoveBlockConfirmModal extends Modal {
  constructor(app: App, private onConfirm: () => void, private blockLabel?: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Remove block?').setHeading();
    const what = this.blockLabel ? `the “${this.blockLabel}” block` : 'this block';
    contentEl.createEl('p', { text: `This will remove ${what} from your homepage.` });
    // Cancel FIRST and focused: a stray Enter/Space must dismiss the dialog,
    // never fire the destructive action. (Prior order auto-focused Remove.)
    new Setting(contentEl)
      .addButton(btn => {
        btn.setButtonText('Cancel').setCta().onClick(() => this.close());
        // Focus after the modal has mounted so Obsidian's own focus handling
        // doesn't override it.
        window.setTimeout(() => btn.buttonEl.focus(), 0);
      })
      .addButton(btn =>
        btn.setButtonText('Remove').setWarning().onClick(() => {
          this.onConfirm();
          this.close();
        }),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
