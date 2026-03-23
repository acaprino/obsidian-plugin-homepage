import { App, Modal, Setting, setIcon } from 'obsidian';
import { BaseBlock } from './BaseBlock';

interface VaultSearchConfig {
  placeholder?: string;
}

const DEBOUNCE_MS = 150;
const MAX_RESULTS = 10;
const BLUR_DELAY_MS = 50;

export class VaultSearchBlock extends BaseBlock {
  private dropdownEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private selectedIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private results: { name: string; path: string }[] = [];

  render(el: HTMLElement): void {
    const cfg = this.instance.config as VaultSearchConfig;
    el.addClass('vault-search-block');

    this.renderHeader(el, 'Vault Search');

    const wrapper = el.createDiv({ cls: 'vault-search-input-wrapper' });
    const iconEl = wrapper.createSpan({ cls: 'vault-search-icon' });
    setIcon(iconEl, 'search');

    const input = wrapper.createEl('input', {
      cls: 'vault-search-input',
      attr: {
        type: 'text',
        placeholder: cfg.placeholder || 'Search vault...',
        spellcheck: 'false',
        autocomplete: 'off',
      },
    });
    this.inputEl = input;

    const dropdown = el.createDiv({ cls: 'vault-search-dropdown' });
    dropdown.style.display = 'none';
    this.dropdownEl = dropdown;

    input.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.search(input.value.trim());
      }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
          this.search(input.value.trim());
        }
        this.openSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeDropdown();
        input.value = '';
        input.blur();
      }
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) this.showDropdown();
    });

    input.addEventListener('blur', () => {
      if (this.blurTimer) clearTimeout(this.blurTimer);
      this.blurTimer = setTimeout(() => { this.blurTimer = null; this.closeDropdown(); }, BLUR_DELAY_MS);
    });

    this.register(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      if (this.blurTimer) clearTimeout(this.blurTimer);
    });
  }

  private search(query: string): void {
    if (!query) {
      this.closeDropdown();
      return;
    }

    const lower = query.toLowerCase();
    const files = this.app.vault.getMarkdownFiles();
    const matches: { name: string; path: string; score: number }[] = [];

    for (const file of files) {
      const idx = file.basename.toLowerCase().indexOf(lower);
      if (idx >= 0) {
        matches.push({ name: file.basename, path: file.path, score: idx });
      }
    }
    matches.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    this.results = matches.slice(0, MAX_RESULTS);

    this.selectedIndex = -1;
    this.renderResults();
    if (this.results.length > 0) {
      this.showDropdown();
    } else {
      this.closeDropdown();
    }
  }

  private renderResults(): void {
    if (!this.dropdownEl) return;
    this.dropdownEl.empty();

    for (const [i, result] of this.results.entries()) {
      const item = this.dropdownEl.createDiv({
        cls: 'vault-search-result' + (i === this.selectedIndex ? ' is-selected' : ''),
      });

      const iconEl = item.createSpan({ cls: 'vault-search-result-icon' });
      setIcon(iconEl, 'file-text');

      const textEl = item.createDiv({ cls: 'vault-search-result-text' });
      textEl.createDiv({ cls: 'vault-search-result-name', text: result.name });

      const folder = result.path.substring(0, result.path.lastIndexOf('/'));
      if (folder) {
        textEl.createDiv({ cls: 'vault-search-result-path', text: folder });
      }

      const openResult = (e: Event) => {
        e.preventDefault(); // prevent blur before click registers
        void this.app.workspace.openLinkText(result.path, '');
        this.closeDropdown();
        if (this.inputEl) this.inputEl.value = '';
      };
      item.addEventListener('mousedown', openResult);
      item.addEventListener('touchstart', openResult, { passive: false });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
    }
  }

  private moveSelection(delta: number): void {
    if (this.results.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.results.length) % this.results.length;
    this.updateSelection();
  }

  private updateSelection(): void {
    if (!this.dropdownEl) return;
    const items = this.dropdownEl.querySelectorAll('.vault-search-result');
    items.forEach((el, i) => {
      el.toggleClass('is-selected', i === this.selectedIndex);
    });
  }

  private openSelected(): void {
    const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
    const result = this.results[index];
    if (result) {
      this.app.workspace.openLinkText(result.path, '');
      this.closeDropdown();
      if (this.inputEl) this.inputEl.value = '';
    }
  }

  private showDropdown(): void {
    if (this.dropdownEl) this.dropdownEl.style.display = '';
  }

  private closeDropdown(): void {
    if (this.dropdownEl) this.dropdownEl.style.display = 'none';
    this.selectedIndex = -1;
    this.results = [];
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new VaultSearchSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class VaultSearchSettingsModal extends Modal {
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
    new Setting(contentEl).setName('Vault Search settings').setHeading();

    const draft = { ...this.config } as VaultSearchConfig;

    new Setting(contentEl)
      .setName('Placeholder text')
      .setDesc('Text shown when the search field is empty.')
      .addText(t =>
        t.setPlaceholder('Search vault...')
         .setValue(draft.placeholder ?? '')
         .onChange(v => { draft.placeholder = v; }),
      );

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft as Record<string, unknown>);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
