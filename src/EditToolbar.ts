import { App, Modal } from 'obsidian';
import { BlockInstance, BlockType, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { GridLayout } from './GridLayout';

export class EditToolbar {
  private toolbarEl: HTMLElement;
  private editMode = false;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private grid: GridLayout,
    private onColumnsChange: (n: number) => void,
  ) {
    this.toolbarEl = containerEl.createDiv({ cls: 'homepage-toolbar' });
    this.renderToolbar();
  }

  private renderToolbar(): void {
    this.toolbarEl.empty();

    // Column count selector
    const colSelect = this.toolbarEl.createEl('select', { cls: 'toolbar-col-select' });
    [2, 3, 4].forEach(n => {
      const opt = colSelect.createEl('option', { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener('change', () => {
      this.onColumnsChange(Number(colSelect.value));
    });

    // Edit toggle
    const editBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-edit-btn' });
    this.updateEditBtn(editBtn);
    editBtn.addEventListener('click', () => {
      this.editMode = !this.editMode;
      this.grid.setEditMode(this.editMode);
      this.updateEditBtn(editBtn);
      this.syncAddButton();
    });

    if (this.editMode) {
      this.appendAddButton();
    }
  }

  private updateEditBtn(btn: HTMLButtonElement): void {
    btn.textContent = this.editMode ? '✓ Done' : '✏ Edit';
    btn.toggleClass('toolbar-btn-active', this.editMode);
  }

  private syncAddButton(): void {
    const existing = this.toolbarEl.querySelector('.toolbar-add-btn');
    if (this.editMode && !existing) {
      this.appendAddButton();
    } else if (!this.editMode && existing) {
      existing.remove();
    }
  }

  private appendAddButton(): void {
    const addBtn = this.toolbarEl.createEl('button', { cls: 'toolbar-add-btn', text: '+ Add Block' });
    addBtn.addEventListener('click', () => {
      new AddBlockModal(this.app, (type) => {
        const factory = BlockRegistry.get(type);
        if (!factory) return;

        const maxRow = this.plugin.layout.blocks.reduce(
          (max, b) => Math.max(max, b.row + b.rowSpan - 1), 0,
        );

        const instance: BlockInstance = {
          id: crypto.randomUUID(),
          type,
          col: 1,
          row: maxRow + 1,
          colSpan: Math.min(factory.defaultSize.colSpan, this.plugin.layout.columns),
          rowSpan: factory.defaultSize.rowSpan,
          config: { ...factory.defaultConfig },
        };

        this.grid.addBlock(instance);
      }).open();
    });
  }

  destroy(): void {
    this.toolbarEl.remove();
  }
}

class AddBlockModal extends Modal {
  constructor(
    app: App,
    private onSelect: (type: BlockType) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Add Block' });

    for (const factory of BlockRegistry.getAll()) {
      const btn = contentEl.createEl('button', {
        cls: 'add-block-option',
        text: factory.displayName,
      });
      btn.addEventListener('click', () => {
        this.onSelect(factory.type);
        this.close();
      });
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
