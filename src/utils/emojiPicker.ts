import { EMOJI_PICKER_SET } from './emojis';

export interface EmojiPickerOptions {
  /** Container to append the trigger row into. */
  container: HTMLElement;
  /** Container to append the dropdown panel into (defaults to container). */
  panelContainer?: HTMLElement;
  /** Optional label text shown before the trigger button. */
  label?: string;
  /** Current emoji value ('' = none). */
  value: string;
  /** Text shown when no emoji is selected (e.g. '＋', 'None', 'Emoji'). */
  placeholder: string;
  /** CSS class for the trigger row (default: 'emoji-picker-row'). */
  rowClass?: string;
  /** Extra CSS class appended to the panel (e.g. 'link-emoji-panel'). */
  panelClass?: string;
  /** Called when an emoji is selected. */
  onSelect: (emoji: string) => void;
  /** Called when the emoji is cleared. */
  onClear: () => void;
  /** Called just before this picker opens — use to close sibling pickers. */
  onBeforeOpen?: () => void;
}

export interface EmojiPickerInstance {
  /** Close the panel if open. */
  close(): void;
  /** Remove all DOM elements. */
  destroy(): void;
}

/**
 * Creates an emoji picker widget with trigger button, clear button,
 * searchable dropdown panel, and emoji grid.
 *
 * Grid is rendered lazily — only when the panel is opened.
 */
export function createEmojiPicker(opts: EmojiPickerOptions): EmojiPickerInstance {
  const {
    container, panelContainer, label, value, placeholder,
    rowClass, panelClass, onSelect, onClear, onBeforeOpen,
  } = opts;

  let currentValue = value;

  // ── Trigger row ────────────────────────────────────────────────────────────
  const row = container.createDiv({ cls: rowClass ?? 'emoji-picker-row' });
  if (label) {
    row.createSpan({ cls: 'setting-item-name', text: label });
  }

  const triggerBtn = row.createEl('button', { cls: 'emoji-picker-trigger' });
  const clearBtn = row.createEl('button', { cls: 'emoji-picker-clear', text: '✕' });
  clearBtn.setAttribute('aria-label', 'Clear emoji');

  const updateTrigger = () => {
    triggerBtn.empty();
    triggerBtn.createSpan({ text: currentValue || placeholder });
    triggerBtn.createSpan({ cls: 'emoji-picker-chevron', text: '▾' });
    triggerBtn.toggleClass('is-placeholder', !currentValue);
    clearBtn.toggleClass('hp-hidden', !currentValue);
  };
  updateTrigger();

  // ── Dropdown panel ─────────────────────────────────────────────────────────
  const panelParent = panelContainer ?? container;
  const panelCls = panelClass ? `emoji-picker-panel ${panelClass}` : 'emoji-picker-panel';
  const panel = panelParent.createDiv({ cls: panelCls });
  panel.addClass('hp-hidden');

  const searchInput = panel.createEl('input', {
    cls: 'emoji-picker-search',
    attr: { type: 'text', placeholder: 'Search emojis…' },
  });
  const gridEl = panel.createDiv({ cls: 'emoji-picker-grid' });

  const renderGrid = (query: string) => {
    gridEl.empty();
    const q = query.toLowerCase().trim();
    const filtered = q
      ? EMOJI_PICKER_SET.filter(([e, kw]) => kw.includes(q) || e === q)
      : EMOJI_PICKER_SET;
    for (const [emoji] of filtered) {
      const btn = gridEl.createEl('button', { cls: 'emoji-btn', text: emoji });
      if (currentValue === emoji) btn.addClass('is-selected');
      btn.addEventListener('click', () => {
        currentValue = emoji;
        updateTrigger();
        onSelect(emoji);
        close();
      });
    }
    if (filtered.length === 0) {
      gridEl.createSpan({ cls: 'emoji-picker-empty', text: 'No results' });
    }
  };

  // ── Outside-click handler ─────────────────────────────────────────────────
  let outsideClickAc: AbortController | null = null;

  // ── Event handlers ─────────────────────────────────────────────────────────
  triggerBtn.addEventListener('click', () => {
    if (!panel.hasClass('hp-hidden')) {
      close();
    } else {
      onBeforeOpen?.();
      panel.removeClass('hp-hidden');
      searchInput.value = '';
      renderGrid('');
      searchInput.focus();
      // Close on outside click
      outsideClickAc?.abort();
      outsideClickAc = new AbortController();
      document.addEventListener('mousedown', (e) => {
        const target = e.target as Node;
        if (!panel.contains(target) && !triggerBtn.contains(target) && !clearBtn.contains(target)) {
          close();
        }
      }, { signal: outsideClickAc.signal });
    }
  });

  clearBtn.addEventListener('click', () => {
    currentValue = '';
    updateTrigger();
    onClear();
    close();
  });

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderGrid(searchInput.value), 100);
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  const close = () => {
    panel.addClass('hp-hidden');
    outsideClickAc?.abort();
    outsideClickAc = null;
  };

  const destroy = () => {
    row.remove();
    panel.remove();
  };

  return { close, destroy };
}
