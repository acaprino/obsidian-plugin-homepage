import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';
import { enableDragReorder } from '../utils/dragReorder';
import { responsiveGridColumns } from '../utils/responsiveGrid';

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
    const safeCols = Math.max(1, Math.min(6, Math.floor(Number(columns) || 2)));
    grid.style.gridTemplateColumns = responsiveGridColumns(safeCols);

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
          this.app.workspace.openLinkText(item.link!, '');
        });
      } else {
        btn.style.cursor = 'default';
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
    contentEl.createEl('h2', { text: 'Button Grid Settings' });

    const draft = structuredClone(this.config) as {
      title?: string;
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
    const renderList = () => {
      listEl.empty();
      draft.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'btn-grid-item-row' });
        enableDragReorder(row, i, draft.items!, dragState, renderList);

        const emojiInput = row.createEl('input', { type: 'text', cls: 'btn-grid-item-emoji' });
        emojiInput.value = item.emoji;
        emojiInput.placeholder = '😀';
        emojiInput.addEventListener('input', () => { item.emoji = emojiInput.value; });

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
