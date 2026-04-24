import { App, Modal, Setting } from 'obsidian';

/**
 * Confirmation dialog for "load preset" and "import from clipboard" flows.
 * Accepts a sync or async onConfirm — rejections are logged, not thrown, because the
 * modal has already closed and there is no UI left to surface them through.
 */
export class ConfirmPresetModal extends Modal {
  constructor(
    app: App,
    private presetName: string,
    private onConfirm: () => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Load preset?').setHeading();
    contentEl.createEl('p', {
      text: `This will replace your current layout with the "${this.presetName}" preset. This cannot be undone.`,
    });
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Load preset').setWarning().onClick(() => {
          void Promise.resolve(this.onConfirm()).catch(e =>
            console.error('[Homepage Blocks] Preset apply failed:', e),
          );
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
