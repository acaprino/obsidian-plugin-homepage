import { Setting } from 'obsidian';
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
    grid.setAttribute('data-auto-height-content', '');
    this.observeWidthForAutoHeight(grid);

    if (items.length === 0) {
      const hint = grid.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '🔲' });
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

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as {
      columns?: number;
      items?: ButtonItem[];
      customCss?: string;
    };
    if (!Array.isArray(cfg.items)) cfg.items = [];

    new Setting(body).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(cfg.columns ?? 2))
       .onChange(v => { cfg.columns = Number(v); }),
    );

    // Only --hp-btn-* declarations survive the allowlist in blockStyling.ts;
    // any other property or url()/image() value is ignored. Not using
    // `new Setting().addTextArea()` here because Obsidian's Setting flex
    // row forces controls into a narrow right column, which squeezes the
    // textarea into a few unusable pixels. A manual block layout lets the
    // textarea span full width.
    const cssSection = body.createDiv({ cls: 'hp-custom-css-section' });
    cssSection.createDiv({ cls: 'setting-item-name', text: 'Custom CSS' });
    const cssTextarea = cssSection.createEl('textarea', { cls: 'hp-custom-css-textarea' });
    cssTextarea.placeholder =
      '--hp-btn-bg: transparent;\n' +
      '--hp-btn-border: none;\n' +
      '--hp-btn-shadow: none;\n' +
      '--hp-btn-hover-bg: var(--background-modifier-hover);\n' +
      '--hp-btn-hover-border-color: transparent;\n' +
      '--hp-btn-hover-transform: none;\n' +
      '--hp-btn-hover-shadow: none;';
    cssTextarea.maxLength = 4096;
    cssTextarea.value = typeof cfg.customCss === 'string' ? cfg.customCss : '';
    cssTextarea.addEventListener('input', () => { cfg.customCss = cssTextarea.value; });

    body.createEl('p', { text: 'Items', cls: 'setting-item-name' });

    const listEl = body.createDiv({ cls: 'btn-grid-item-list' });
    const dragState = { dragIdx: -1 };
    let pickers: EmojiPickerInstance[] = [];
    const renderList = () => {
      pickers.forEach(p => p.destroy());
      pickers = [];
      listEl.empty();
      cfg.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'btn-grid-item-row' });
        enableDragReorder(row, i, cfg.items!, dragState, renderList);

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
          cfg.items!.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();

    new Setting(body).addButton(btn =>
      btn.setButtonText('+ add item').onClick(() => {
        cfg.items!.push({ emoji: '', label: '' });
        renderList();
      }),
    );
  }
}
