import { Setting, moment } from 'obsidian';
import { BaseBlock } from './BaseBlock';

type ClockStyle = 'minimal' | 'centered' | 'large' | 'accent';

const CLOCK_STYLES: Record<ClockStyle, string> = {
  minimal:  'Minimal',
  centered: 'Centered',
  large:    'Large',
  accent:   'Accent',
};

/** Write `text` only when it differs, so a 1 s tick does not touch the DOM every second. */
function setIfChanged(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.setText(text);
}

export class ClockBlock extends BaseBlock {
  private timeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    const { showDate = true, clockStyle = 'minimal' } = this.instance.config as {
      showDate?: boolean;
      clockStyle?: ClockStyle;
    };

    el.addClass('clock-block');
    const safeStyle = (clockStyle in CLOCK_STYLES) ? clockStyle : 'minimal';
    el.addClass(`clock-style-${safeStyle}`);

    this.timeEl = el.createDiv({ cls: 'clock-time' });
    if (showDate) {
      this.dateEl = el.createDiv({ cls: 'clock-date' });
    }

    // Every second, writing only what changed: a 60 s interval counted from mount
    // showed the new minute up to 59 s late, and a custom format with seconds
    // changed once a minute (M46).
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

    if (this.timeEl) setIfChanged(this.timeEl, now.format(format || (showSeconds ? 'HH:mm:ss' : 'HH:mm')));
    if (this.dateEl && showDate) setIfChanged(this.dateEl, now.format('dddd, D MMMM YYYY'));
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
