import { Setting, TFile, setIcon } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { onOpenClick, openFile } from '../utils/openTarget';
import { blockTitle } from '../blockMeta';

interface VaultSearchConfig {
  placeholder?: string;
}

const DEBOUNCE_MS = 150;
const MAX_RESULTS = 10;
const BLUR_DELAY_MS = 50;

export class VaultSearchBlock extends BaseBlock {
  private dropdownEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private wrapperEl: HTMLElement | null = null;
  private selectedIndex = -1;
  private debounceTimer: number | null = null;
  private blurTimer: number | null = null;
  private results: { name: string; path: string; file: TFile }[] = [];
  private repositionRaf = 0;
  private viewportTracking = false;
  /** The window the dropdown's listeners live on: the block's own, also in a popout (W1). */
  private trackedWin: Window | null = null;
  /** rAF-throttled reposition so the fixed dropdown follows the input on scroll/resize. */
  private readonly onViewportChange = (): void => {
    const win = this.trackedWin ?? window;
    win.cancelAnimationFrame(this.repositionRaf);
    this.repositionRaf = win.requestAnimationFrame(() => this.positionDropdown());
  };

  /**
   * The typed query lives only in the DOM <input> (never persisted), so a full
   * rerender would wipe it mid-search. Opt into the rerender-suppression guard
   * (BaseBlock contract) whenever the field has a non-empty query.
   */
  hasUnsavedInlineState(): boolean {
    return !!this.inputEl && this.inputEl.value.trim().length > 0;
  }

  render(el: HTMLElement): void {
    const cfg = this.instance.config as VaultSearchConfig;
    el.addClass('vault-search-block');

    this.renderHeader(el, blockTitle('vault-search'));

    const wrapper = el.createDiv({ cls: 'vault-search-input-wrapper' });
    this.wrapperEl = wrapper;
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

    // Dropdown appended to the owning document's body (popout-safe) with
    // position:fixed to escape all overflow:hidden/auto ancestors in the
    // GridStack layout.
    const dropdown = el.doc.body.createDiv({ cls: 'vault-search-dropdown vault-search-dropdown--hidden' });
    this.dropdownEl = dropdown;

    this.register(() => { dropdown.remove(); });
    // Safety net: if the block is torn down while the dropdown is open, drop the
    // viewport listeners too.
    this.register(() => this.stopViewportTracking());

    input.addEventListener('input', () => {
      if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
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
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
          this.search(input.value.trim());
        }
        this.openSelected(e);
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
      if (this.blurTimer) window.clearTimeout(this.blurTimer);
      this.blurTimer = window.setTimeout(() => { this.blurTimer = null; this.closeDropdown(); }, BLUR_DELAY_MS);
    });

    this.register(() => {
      if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
      if (this.blurTimer) window.clearTimeout(this.blurTimer);
    });
  }

  private search(query: string): void {
    if (!query) {
      this.closeDropdown();
      return;
    }

    const lower = query.toLowerCase();
    const files = this.app.vault.getMarkdownFiles();
    const matches: { name: string; path: string; file: TFile; score: number }[] = [];

    for (const file of files) {
      const idx = file.basename.toLowerCase().indexOf(lower);
      if (idx >= 0) {
        matches.push({ name: file.basename, path: file.path, file, score: idx });
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

      const openResult = (e: MouseEvent) => {
        e.preventDefault(); // prevent blur before click registers
        this.openResult(result.file, e);
      };
      // mousedown only keeps the focus in the field, so its blur doesn't close
      // the list first; the pick is the click. A touch that starts a scroll of
      // the list is not a pick (N11).
      item.addEventListener('mousedown', (e) => { e.preventDefault(); });
      onOpenClick(item, openResult);

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

  private openSelected(evt?: KeyboardEvent): void {
    const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
    const result = this.results[index];
    if (result) this.openResult(result.file, evt);
  }

  /** Open a picked result: Ctrl/Cmd or a middle click opens a new tab (M21, M65). */
  private openResult(file: TFile, evt?: MouseEvent | KeyboardEvent): void {
    openFile(this.app, file, evt);
    this.closeDropdown();
    if (this.inputEl) this.inputEl.value = '';
  }

  private positionDropdown(): void {
    if (!this.dropdownEl || !this.wrapperEl) return;
    const rect = this.wrapperEl.getBoundingClientRect();
    // Routed through CSS custom properties (consumed by .vault-search-dropdown
    // in styles.css) so this matches the rest of the codebase's dynamic-style
    // pattern -- ObsidianReviewBot's static-style heuristic ignores literal
    // string assignments to .style.<prop>, which is fragile to refactor.
    this.dropdownEl.style.setProperty('--hp-search-dropdown-top', `${rect.bottom + 4}px`);
    this.dropdownEl.style.setProperty('--hp-search-dropdown-left', `${rect.left}px`);
    this.dropdownEl.style.setProperty('--hp-search-dropdown-width', `${rect.width}px`);
  }

  private showDropdown(): void {
    if (this.dropdownEl) {
      this.positionDropdown();
      this.dropdownEl.removeClass('vault-search-dropdown--hidden');
      this.startViewportTracking();
    }
  }

  private closeDropdown(): void {
    if (this.dropdownEl) {
      this.dropdownEl.addClass('vault-search-dropdown--hidden');
    }
    this.stopViewportTracking();
    this.selectedIndex = -1;
    this.results = [];
  }

  /**
   * Track scroll/resize while the dropdown is open so the position:fixed
   * dropdown stays glued to the input. Capture-phase scroll catches scrolling
   * on any ancestor container, not just the window. Listeners are added only
   * while open and removed on close (and on teardown via this.register).
   */
  private startViewportTracking(): void {
    if (this.viewportTracking) return;
    this.viewportTracking = true;
    const win = this.inputEl?.win ?? window;
    this.trackedWin = win;
    win.addEventListener('scroll', this.onViewportChange, true);
    win.addEventListener('resize', this.onViewportChange);
  }

  private stopViewportTracking(): void {
    if (!this.viewportTracking) return;
    this.viewportTracking = false;
    const win = this.trackedWin ?? window;
    win.removeEventListener('scroll', this.onViewportChange, true);
    win.removeEventListener('resize', this.onViewportChange);
    win.cancelAnimationFrame(this.repositionRaf);
    this.trackedWin = null;
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as VaultSearchConfig;
    new Setting(body)
      .setName('Placeholder text')
      .setDesc('Text shown when the search field is empty.')
      .addText(t =>
        t.setPlaceholder('Search vault...')
         .setValue(cfg.placeholder ?? '')
         .onChange(v => { cfg.placeholder = v; }),
      );
  }
}
