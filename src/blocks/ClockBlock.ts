import { Setting, moment } from 'obsidian';
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

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    new Setting(body)
      .setName('Style')
      .setDesc('How the clock looks.')
      .addDropdown(d =>
        d.addOptions(CLOCK_STYLES)
         .setValue(draft.clockStyle as string ?? 'minimal')
         .onChange(v => { draft.clockStyle = v; }),
      );
    new Setting(body).setName('Show seconds').addToggle(t =>
      t.setValue(draft.showSeconds as boolean ?? false)
       .onChange(v => { draft.showSeconds = v; }),
    );
    new Setting(body).setName('Show date').addToggle(t =>
      t.setValue(draft.showDate as boolean ?? true)
       .onChange(v => { draft.showDate = v; }),
    );
    new Setting(body)
      .setName('Custom format')
      .setDesc('Moment.js format string. Leave blank for default.')
      .addText(t =>
        t.setValue(draft.format as string ?? '')
         .onChange(v => { draft.format = v; }),
      );
  }
}
