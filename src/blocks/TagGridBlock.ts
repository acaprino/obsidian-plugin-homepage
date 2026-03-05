import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

interface ValueItem {
  emoji: string;
  label: string;
  link?: string;
}

export class TagGridBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('tag-grid-block');

    const { title = 'Values', columns = 2, items = [] } = this.instance.config as {
      title?: string;
      columns?: number;
      items?: ValueItem[];
    };

    this.renderHeader(el, title);

    const grid = el.createDiv({ cls: 'tag-grid' });
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    if (items.length === 0) {
      const hint = grid.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F3F7}\uFE0F' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No items yet. Add values with emojis and labels in settings.' });
      return;
    }

    for (const item of items) {
      const btn = grid.createEl('button', { cls: 'tag-btn' });
      if (item.emoji) {
        btn.createSpan({ cls: 'tag-btn-emoji', text: item.emoji });
      }
      btn.createSpan({ text: item.label });
      if (item.link) {
        btn.addEventListener('click', () => {
          this.app.workspace.openLinkText(item.link!, '');
        });
      } else {
        btn.style.cursor = 'default';
      }
    }
  }

  openSettings(onSave: () => void): void {
    new ValuesSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
}

class ValuesSettingsModal extends Modal {
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
    contentEl.createEl('h2', { text: 'Values Settings' });

    const draft = structuredClone(this.config) as {
      title?: string;
      columns?: number;
      items?: ValueItem[];
    };
    if (!Array.isArray(draft.items)) draft.items = [];

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(draft.title ?? 'Values')
       .onChange(v => { draft.title = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(draft.columns ?? 2))
       .onChange(v => { draft.columns = Number(v); }),
    );

    contentEl.createEl('p', { text: 'Items', cls: 'setting-item-name' });

    const listEl = contentEl.createDiv({ cls: 'values-item-list' });
    const renderList = () => {
      listEl.empty();
      draft.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'values-item-row' });

        const emojiInput = row.createEl('input', { type: 'text', cls: 'values-item-emoji' });
        emojiInput.value = item.emoji;
        emojiInput.placeholder = '😀';
        emojiInput.addEventListener('input', () => { item.emoji = emojiInput.value; });

        const labelInput = row.createEl('input', { type: 'text', cls: 'values-item-label' });
        labelInput.value = item.label;
        labelInput.placeholder = 'Label';
        labelInput.addEventListener('input', () => { item.label = labelInput.value; });

        const linkInput = row.createEl('input', { type: 'text', cls: 'values-item-link' });
        linkInput.value = item.link ?? '';
        linkInput.placeholder = 'Note path (optional)';
        linkInput.addEventListener('input', () => { item.link = linkInput.value || undefined; });

        const delBtn = row.createEl('button', { cls: 'values-item-del', text: '✕' });
        delBtn.addEventListener('click', () => {
          draft.items!.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('+ Add item').onClick(() => {
        draft.items!.push({ emoji: '', label: '' });
        renderList();
      }),
    );

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => {
          this.onSave(draft as Record<string, unknown>);
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
