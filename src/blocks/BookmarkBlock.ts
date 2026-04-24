import { Setting } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { enableDragReorder } from '../utils/dragReorder';
import { responsiveGridColumns } from '../utils/responsiveGrid';

interface BookmarkItem {
  label: string;
  url: string;
  description?: string;
  emoji?: string;
}

interface BookmarkConfig {
  items?: BookmarkItem[];
  columns?: number;
  showDescriptions?: boolean;
}

export class BookmarkBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('bookmark-block');

    const { items = [], columns = 2, showDescriptions = true } =
      this.instance.config as BookmarkConfig;

    this.renderHeader(el, 'Bookmarks');

    const grid = el.createDiv({ cls: 'bookmark-grid' });
    const safeCols = Math.max(1, Math.min(3, Math.floor(Number(columns) || 2)));
    grid.style.setProperty('--hp-grid-cols', responsiveGridColumns(safeCols));

    if (items.length === 0) {
      const hint = grid.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '🔗' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No bookmarks yet. Add links in settings.' });
      return;
    }

    for (const item of items) {
      const card = grid.createEl('button', { cls: 'bookmark-card' });
      if (item.emoji) {
        card.createSpan({ cls: 'bookmark-emoji', text: item.emoji });
      }
      card.createSpan({ cls: 'bookmark-label', text: item.label });
      if (item.description && showDescriptions) {
        card.createSpan({ cls: 'bookmark-desc', text: item.description });
      }
      card.addEventListener('click', () => {
        try {
          const parsed = new URL(item.url);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            window.open(item.url, '_blank', 'noopener,noreferrer');
            return;
          }
        } catch { /* not a valid absolute URL — treat as vault path */ }
        void this.app.workspace.openLinkText(item.url, '');
      });
    }
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as BookmarkConfig;
    if (!Array.isArray(cfg.items)) cfg.items = [];

    new Setting(body).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(cfg.columns ?? 2))
       .onChange(v => { cfg.columns = Number(v); }),
    );
    new Setting(body).setName('Show descriptions').addToggle(t =>
      t.setValue(cfg.showDescriptions !== false)
       .onChange(v => { cfg.showDescriptions = v; }),
    );

    body.createEl('p', { text: 'Items', cls: 'setting-item-name' });

    const listEl = body.createDiv({ cls: 'bookmark-item-list' });
    const dragState = { dragIdx: -1 };
    const renderList = () => {
      listEl.empty();
      cfg.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'bookmark-item-row' });
        enableDragReorder(row, i, cfg.items!, dragState, renderList);

        const emojiInput = row.createEl('input', { type: 'text', cls: 'bookmark-item-emoji' });
        emojiInput.value = item.emoji ?? '';
        emojiInput.placeholder = '🌐';
        emojiInput.addEventListener('input', () => { item.emoji = emojiInput.value || undefined; });

        const labelInput = row.createEl('input', { type: 'text', cls: 'bookmark-item-label' });
        labelInput.value = item.label;
        labelInput.placeholder = 'Label';
        labelInput.addEventListener('input', () => { item.label = labelInput.value; });

        const urlInput = row.createEl('input', { type: 'text', cls: 'bookmark-item-url' });
        urlInput.value = item.url;
        urlInput.placeholder = 'URL or note path';
        urlInput.addEventListener('input', () => { item.url = urlInput.value; });

        const descInput = row.createEl('input', { type: 'text', cls: 'bookmark-item-desc' });
        descInput.value = item.description ?? '';
        descInput.placeholder = 'Description (optional)';
        descInput.addEventListener('input', () => { item.description = descInput.value || undefined; });

        const delBtn = row.createEl('button', { cls: 'bookmark-item-del', text: '✕' });
        delBtn.addEventListener('click', () => {
          cfg.items!.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();

    new Setting(body).addButton(btn =>
      btn.setButtonText('+ add item').onClick(() => {
        cfg.items!.push({ label: '', url: '' });
        renderList();
      }),
    );
  }
}
