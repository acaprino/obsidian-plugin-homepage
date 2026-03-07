import { App, Modal, Setting, moment } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

function timeOfDayEmoji(hour: number): string {
  if (hour >= 5  && hour < 12) return '☀️';
  if (hour >= 12 && hour < 17) return '🌤️';
  if (hour >= 17 && hour < 21) return '🌆';
  return '🌙';
}

export class GreetingBlock extends BaseBlock {
  private emojiEl: HTMLElement | null = null;
  private nameEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    el.addClass('greeting-block');

    const { showTime = true, showEmoji = true } = this.instance.config as {
      showTime?: boolean;
      showEmoji?: boolean;
    };

    if (showEmoji) {
      this.emojiEl = el.createDiv({ cls: 'greeting-emoji' });
    }
    this.nameEl = el.createDiv({ cls: 'greeting-name' });
    if (showTime) {
      this.timeEl = el.createDiv({ cls: 'greeting-time' });
    }

    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 60_000));
  }

  private tick(): void {
    const now = moment();
    const hour = now.hour();
    const { name = 'bentornato', showTime = true, showEmoji = true } = this.instance.config as {
      name?: string;
      showTime?: boolean;
      showEmoji?: boolean;
    };

    const salutation =
      hour >= 5  && hour < 12 ? 'Buongiorno' :
      hour >= 12 && hour < 18 ? 'Buon pomeriggio' :
      'Buonasera';

    if (this.emojiEl && showEmoji) {
      this.emojiEl.setText(timeOfDayEmoji(hour));
    }
    if (this.nameEl) {
      this.nameEl.setText(`${salutation}, ${name}`);
    }
    if (this.timeEl && showTime) {
      this.timeEl.setText(now.format('HH:mm'));
    }
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new GreetingSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class GreetingSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'Greeting Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Name').addText(t =>
      t.setValue(draft.name as string ?? 'bentornato')
       .onChange(v => { draft.name = v; }),
    );
    new Setting(contentEl).setName('Show emoji').setDesc('Auto-selected based on time of day.').addToggle(t =>
      t.setValue(draft.showEmoji as boolean ?? true)
       .onChange(v => { draft.showEmoji = v; }),
    );
    new Setting(contentEl).setName('Show time').addToggle(t =>
      t.setValue(draft.showTime as boolean ?? true)
       .onChange(v => { draft.showTime = v; }),
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
