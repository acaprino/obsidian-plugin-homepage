import { App, Modal, Setting, moment } from 'obsidian';
import { BaseBlock } from './BaseBlock';

type ClockStyle = 'minimal' | 'centered' | 'large' | 'accent';

const CLOCK_STYLES: Record<ClockStyle, string> = {
  minimal:  'Minimal',
  centered: 'Centered',
  large:    'Large',
  accent:   'Accent',
};

export class ClockBlock extends BaseBlock {
  private timeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    const { showDate = true, showSeconds = false, clockStyle = 'minimal' } = this.instance.config as {
      showDate?: boolean;
      showSeconds?: boolean;
      clockStyle?: ClockStyle;
    };

    el.addClass('clock-block');
    const safeStyle = (clockStyle in CLOCK_STYLES) ? clockStyle : 'minimal';
    el.addClass(`clock-style-${safeStyle}`);

    this.timeEl = el.createDiv({ cls: 'clock-time' });
    if (showDate) {
      this.dateEl = el.createDiv({ cls: 'clock-date' });
    }

    this.tick();
    const interval = showSeconds ? 1000 : 60_000;
    this.registerInterval(window.setInterval(() => this.tick(), interval));
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

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new ClockSettingsModal(this.app, this.instance.config, onSave).open();
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
    new Setting(contentEl).setName('Clock settings').setHeading();

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Style')
      .setDesc('Visual style of the clock.')
      .addDropdown(d =>
        d.addOptions(CLOCK_STYLES)
         .setValue(draft.clockStyle as string ?? 'minimal')
         .onChange(v => { draft.clockStyle = v; }),
      );
    new Setting(contentEl).setName('Show seconds').addToggle(t =>
      t.setValue(draft.showSeconds as boolean ?? false)
       .onChange(v => { draft.showSeconds = v; }),
    );
    new Setting(contentEl).setName('Show date').addToggle(t =>
      t.setValue(draft.showDate as boolean ?? true)
       .onChange(v => { draft.showDate = v; }),
    );
    new Setting(contentEl)
      .setName('Custom format')
      .setDesc('Optional moment.js format string (leave empty for default).')
      .addText(t =>
        t.setValue(draft.format as string ?? '')
         .onChange(v => { draft.format = v; }),
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
