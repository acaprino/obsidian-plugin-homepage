import { App, Modal, Setting } from 'obsidian';

/**
 * Confirmation before an action that replaces something the user built (Reset
 * layout, Copy to mobile). Cancel comes first and takes the focus, so a stray
 * Enter or Space dismisses the dialog instead of running the action.
 */
export class ConfirmActionModal extends Modal {
  constructor(
    app: App,
    private texts: { title: string; message: string; confirm: string },
    private onConfirm: () => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName(this.texts.title).setHeading();
    contentEl.createEl('p', { text: this.texts.message });
    new Setting(contentEl)
      .addButton(btn => {
        btn.setButtonText('Cancel').setCta().onClick(() => this.close());
        window.setTimeout(() => btn.buttonEl.focus(), 0);
      })
      .addButton(btn =>
        btn.setButtonText(this.texts.confirm).setWarning().onClick(() => {
          void Promise.resolve(this.onConfirm()).catch(e =>
            console.error('[Homepage Blocks] Action failed:', e instanceof Error ? e.message : 'unknown error'),
          );
          this.close();
        }),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
