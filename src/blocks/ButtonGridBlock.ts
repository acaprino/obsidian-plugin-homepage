import { App, Modal, Setting } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { enableDragReorder } from '../utils/dragReorder';
import { createEmojiPicker, EmojiPickerInstance } from '../utils/emojiPicker';

interface ButtonItem {
  emoji: string;
  label: string;
  link?: string;
}

export class ButtonGridBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('button-grid-block');

    const { columns = 2, items = [] } = this.instance.config as {
      columns?: number;
      items?: ButtonItem[];
    };

    this.renderHeader(el, 'Buttons');

    const grid = el.createDiv({ cls: 'button-grid' });
    const safeCols = Math.max(1, Math.min(3, Math.floor(Number(columns) || 2)));
    grid.style.setProperty('--hp-grid-cols', `repeat(${safeCols}, 1fr)`);

    if (items.length === 0) {
      const hint = grid.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F532}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No items yet. Add buttons with emojis and labels in settings.' });
      return;
    }

    for (const item of items) {
      const btn = grid.createEl('button', { cls: 'grid-btn' });
      if (item.emoji) {
        btn.createSpan({ cls: 'grid-btn-emoji', text: item.emoji });
      }
      btn.createSpan({ text: item.label });
      if (item.link) {
        btn.addEventListener('click', () => {
          void this.app.workspace.openLinkText(item.link!, '');
        });
      } else {
        btn.addClass('hp-cursor-default');
      }
    }
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new ButtonGridSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class ButtonGridSettingsModal extends Modal {
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
    new Setting(contentEl).setName('Button grid settings').setHeading();

    const draft = structuredClone(this.config) as {
      columns?: number;
      items?: ButtonItem[];
    };
    if (!Array.isArray(draft.items)) draft.items = [];

    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(draft.columns ?? 2))
       .onChange(v => { draft.columns = Number(v); }),
    );

    contentEl.createEl('p', { text: 'Items', cls: 'setting-item-name' });

    const listEl = contentEl.createDiv({ cls: 'btn-grid-item-list' });
    const dragState = { dragIdx: -1 };
    let pickers: EmojiPickerInstance[] = [];
    const renderList = () => {
      pickers.forEach(p => p.destroy());
      pickers = [];
      listEl.empty();
      draft.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'btn-grid-item-row' });
        enableDragReorder(row, i, draft.items!, dragState, renderList);

        const picker = createEmojiPicker({
          container: row,
          panelContainer: listEl,
          value: item.emoji,
          placeholder: '😀',
          rowClass: 'btn-grid-emoji-picker-row',
          onBeforeOpen: () => pickers.forEach(p => p !== picker && p.close()),
          onSelect: (emoji) => { item.emoji = emoji; },
          onClear: () => { item.emoji = ''; },
        });
        pickers.push(picker);

        const labelInput = row.createEl('input', { type: 'text', cls: 'btn-grid-item-label' });
        labelInput.value = item.label;
        labelInput.placeholder = 'Label';
        labelInput.addEventListener('input', () => { item.label = labelInput.value; });

        const linkInput = row.createEl('input', { type: 'text', cls: 'btn-grid-item-link' });
        linkInput.value = item.link ?? '';
        linkInput.placeholder = 'Note path (optional)';
        linkInput.addEventListener('input', () => { item.link = linkInput.value || undefined; });

        const delBtn = row.createEl('button', { cls: 'btn-grid-item-del', text: '✕' });
        delBtn.addEventListener('click', () => {
          draft.items!.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('+ add item').onClick(() => {
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
