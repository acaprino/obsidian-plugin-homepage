import { App, Modal, Setting } from 'obsidian';
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
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\uD83D\uDD17' });
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

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new BookmarkSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class BookmarkSettingsModal extends Modal {
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
    new Setting(contentEl).setName('Bookmark settings').setHeading();

    const draft = structuredClone(this.config) as BookmarkConfig;
    if (!Array.isArray(draft.items)) draft.items = [];

    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('1', '1').addOption('2', '2').addOption('3', '3')
       .setValue(String(draft.columns ?? 2))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Show descriptions').addToggle(t =>
      t.setValue(draft.showDescriptions !== false)
       .onChange(v => { draft.showDescriptions = v; }),
    );

    contentEl.createEl('p', { text: 'Items', cls: 'setting-item-name' });

    const listEl = contentEl.createDiv({ cls: 'bookmark-item-list' });
    const dragState = { dragIdx: -1 };
    const renderList = () => {
      listEl.empty();
      draft.items!.forEach((item, i) => {
        const row = listEl.createDiv({ cls: 'bookmark-item-row' });
        enableDragReorder(row, i, draft.items!, dragState, renderList);

        const emojiInput = row.createEl('input', { type: 'text', cls: 'bookmark-item-emoji' });
        emojiInput.value = item.emoji ?? '';
        emojiInput.placeholder = '\uD83C\uDF10';
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

        const delBtn = row.createEl('button', { cls: 'bookmark-item-del', text: '\u2715' });
        delBtn.addEventListener('click', () => {
          draft.items!.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('+ add item').onClick(() => {
        draft.items!.push({ label: '', url: '' });
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
