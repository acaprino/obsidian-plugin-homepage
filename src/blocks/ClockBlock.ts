import { App, Modal, Setting, moment } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

export class ClockBlock extends BaseBlock {
  private timeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    el.addClass('clock-block');

    const { showDate = true } = this.instance.config as { showDate?: boolean };

    this.timeEl = el.createDiv({ cls: 'clock-time' });
    if (showDate) {
      this.dateEl = el.createDiv({ cls: 'clock-date' });
    }

    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
  }

  private tick(): void {
    const now = moment();
    const { showSeconds = false, showDate = true, format = '' } = this.instance.config as {
      showSeconds?: boolean;
      showDate?: boolean;
      format?: string;
    };

    if (this.timeEl) {
      if (format) {
        this.timeEl.setText(now.format(format));
      } else {
        this.timeEl.setText(now.format(showSeconds ? 'HH:mm:ss' : 'HH:mm'));
      }
    }
    if (this.dateEl && showDate) {
      this.dateEl.setText(now.format('dddd, D MMMM YYYY'));
    }
  }

  openSettings(onSave: () => void): void {
    new ClockSettingsModal(this.app, this.instance.config, (newConfig) => {
      this.instance.config = newConfig;
      onSave();
    }).open();
  }
}

class ClockSettingsModal extends Modal {
  constructor(
    app: App,
    private config: Record<string, unknown>,
    private onSave: (config: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Clock Settings' });

    new Setting(contentEl).setName('Show seconds').addToggle(t =>
      t.setValue(this.config.showSeconds as boolean ?? false)
       .onChange(v => { this.config.showSeconds = v; }),
    );
    new Setting(contentEl).setName('Show date').addToggle(t =>
      t.setValue(this.config.showDate as boolean ?? true)
       .onChange(v => { this.config.showDate = v; }),
    );
    new Setting(contentEl)
      .setName('Custom format')
      .setDesc('Optional moment.js format string, e.g. "HH:mm". Leave empty for default.')
      .addText(t =>
        t.setValue(this.config.format as string ?? '')
         .onChange(v => { this.config.format = v; }),
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
