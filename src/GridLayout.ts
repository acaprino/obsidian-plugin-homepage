import { App, Modal, Setting, setIcon } from 'obsidian';
import { BlockInstance, LayoutConfig, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

export class GridLayout {
  private gridEl: HTMLElement;
  private blocks = new Map<string, { block: BaseBlock; wrapper: HTMLElement }>();
  private editMode = false;
  /** AbortController for the currently active drag or resize operation. */
  private activeAbortController: AbortController | null = null;
  /** Drag clone appended to document.body; tracked so we can remove it on early teardown. */
  private activeClone: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private effectiveColumns = 3;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid' });
    this.resizeObserver = new ResizeObserver(() => {
      const newEffective = this.computeEffectiveColumns(this.plugin.layout.columns);
      if (newEffective !== this.effectiveColumns) {
        this.rerender();
      }
    });
    this.resizeObserver.observe(this.gridEl);
  }

  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement(): HTMLElement {
    return this.gridEl;
  }

  private computeEffectiveColumns(layoutColumns: number): number {
    const w = this.gridEl.offsetWidth;
    if (w > 0 && w <= 540) return 1;
    if (w > 0 && w <= 840) return Math.min(2, layoutColumns);
    return layoutColumns;
  }

  render(blocks: BlockInstance[], columns: number): void {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.setAttribute('role', 'grid');
    this.gridEl.setAttribute('aria-label', 'Homepage blocks');
    this.effectiveColumns = this.computeEffectiveColumns(columns);

    if (this.editMode) {
      this.gridEl.addClass('edit-mode');
    } else {
      this.gridEl.removeClass('edit-mode');
    }

    if (blocks.length === 0) {
      const empty = this.gridEl.createDiv({ cls: 'homepage-empty-state' });
      empty.createEl('p', { text: 'No blocks yet. Click Edit to add your first block.' });
      return;
    }

    for (const instance of blocks) {
      this.renderBlock(instance);
    }
  }

  private renderBlock(instance: BlockInstance): void {
    const factory = BlockRegistry.get(instance.type);
    if (!factory) return;

    const wrapper = this.gridEl.createDiv({ cls: 'homepage-block-wrapper' });
    wrapper.dataset.blockId = instance.id;
    wrapper.setAttribute('role', 'gridcell');
    wrapper.setAttribute('aria-label', factory.displayName);
    this.applyGridPosition(wrapper, instance);

    if (this.editMode) {
      this.attachEditHandles(wrapper, instance);
    }

    const contentEl = wrapper.createDiv({ cls: 'block-content' });
    const block = factory.create(this.app, instance, this.plugin);
    block.load();
    const result = block.render(contentEl);
    if (result instanceof Promise) {
      result.catch(e => {
        console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
        contentEl.setText('Error rendering block. Check console for details.');
      });
    }

    // Collapse toggle (absolutely positioned, hidden in edit mode)
    if (instance.collapsed) wrapper.addClass('block-collapsed');
    const collapseBtn = wrapper.createEl('button', { cls: 'block-collapse-btn' });
    setIcon(collapseBtn, instance.collapsed ? 'chevron-right' : 'chevron-down');
    collapseBtn.setAttribute('aria-label', instance.collapsed ? 'Expand' : 'Collapse');
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isNowCollapsed = !wrapper.hasClass('block-collapsed');
      wrapper.toggleClass('block-collapsed', isNowCollapsed);
      setIcon(collapseBtn, isNowCollapsed ? 'chevron-right' : 'chevron-down');
      collapseBtn.setAttribute('aria-label', isNowCollapsed ? 'Expand' : 'Collapse');
      const newBlocks = this.plugin.layout.blocks.map(b =>
        b.id === instance.id ? { ...b, collapsed: isNowCollapsed } : b,
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    });

    this.blocks.set(instance.id, { block, wrapper });
  }

  private applyGridPosition(wrapper: HTMLElement, instance: BlockInstance): void {
    const cols = this.effectiveColumns;
    const colSpan = Math.min(instance.colSpan, cols);
    // flex-grow proportional to colSpan so wrapped items stretch to fill the row
    const basisPercent = (colSpan / cols) * 100;
    wrapper.style.flex = `${colSpan} 0 calc(${basisPercent}% - var(--hp-gap, 16px))`;
    wrapper.style.minWidth = '0';
  }

  private attachEditHandles(wrapper: HTMLElement, instance: BlockInstance): void {
    const bar = wrapper.createDiv({ cls: 'block-handle-bar' });

    const handle = bar.createDiv({ cls: 'block-move-handle' });
    setIcon(handle, 'grip-vertical');
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.setAttribute('title', 'Drag to reorder');

    const settingsBtn = bar.createEl('button', { cls: 'block-settings-btn' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.setAttribute('aria-label', 'Block settings');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = this.blocks.get(instance.id);
      if (!entry) return;
      const onSave = () => {
        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === instance.id ? instance : b,
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };
      new BlockSettingsModal(this.app, instance, entry.block, onSave).open();
    });

    const removeBtn = bar.createEl('button', { cls: 'block-remove-btn' });
    setIcon(removeBtn, 'x');
    removeBtn.setAttribute('aria-label', 'Remove block');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new RemoveBlockConfirmModal(this.app, () => {
        const newBlocks = this.plugin.layout.blocks.filter(b => b.id !== instance.id);
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      }).open();
    });

    const grip = wrapper.createDiv({ cls: 'block-resize-grip' });
    setIcon(grip, 'maximize-2');
    grip.setAttribute('aria-label', 'Drag to resize');
    grip.setAttribute('title', 'Drag to resize');
    this.attachResizeHandler(grip, wrapper, instance);

    this.attachDragHandler(handle, wrapper, instance);
  }

  private attachDragHandler(handle: HTMLElement, wrapper: HTMLElement, instance: BlockInstance): void {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();

      this.activeAbortController?.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;

      const clone = wrapper.cloneNode(true) as HTMLElement;
      clone.addClass('block-drag-clone');
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.left = `${e.clientX - 20}px`;
      clone.style.top = `${e.clientY - 20}px`;
      document.body.appendChild(clone);
      this.activeClone = clone;

      const sourceId = instance.id;
      wrapper.addClass('block-dragging');

      const onMouseMove = (me: MouseEvent) => {
        clone.style.left = `${me.clientX - 20}px`;
        clone.style.top = `${me.clientY - 20}px`;

        this.gridEl.querySelectorAll('.homepage-block-wrapper').forEach(el => {
          (el as HTMLElement).removeClass('block-drop-target');
        });
        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          this.blocks.get(targetId)?.wrapper.addClass('block-drop-target');
        }
      };

      const onMouseUp = (me: MouseEvent) => {
        ac.abort();
        this.activeAbortController = null;

        clone.remove();
        this.activeClone = null;
        wrapper.removeClass('block-dragging');

        this.gridEl.querySelectorAll('.homepage-block-wrapper').forEach(el => {
          (el as HTMLElement).removeClass('block-drop-target');
        });

        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          this.swapBlocks(sourceId, targetId);
        }
      };

      document.addEventListener('mousemove', onMouseMove, { signal: ac.signal });
      document.addEventListener('mouseup', onMouseUp, { signal: ac.signal });
    });
  }

  private attachResizeHandler(grip: HTMLElement, wrapper: HTMLElement, instance: BlockInstance): void {
    grip.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      this.activeAbortController?.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;

      const startX = e.clientX;
      const startColSpan = instance.colSpan;
      const columns = this.effectiveColumns;
      const colWidth = this.gridEl.offsetWidth / columns;
      let currentColSpan = startColSpan;

      const onMouseMove = (me: MouseEvent) => {
        const deltaX = me.clientX - startX;
        const deltaCols = Math.round(deltaX / colWidth);
        currentColSpan = Math.max(1, Math.min(columns, startColSpan + deltaCols));
        const basisPercent = (currentColSpan / columns) * 100;
        wrapper.style.flex = `${currentColSpan} 0 calc(${basisPercent}% - var(--hp-gap, 16px))`;
      };

      const onMouseUp = () => {
        ac.abort();
        this.activeAbortController = null;

        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === instance.id ? { ...b, colSpan: currentColSpan } : b,
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };

      document.addEventListener('mousemove', onMouseMove, { signal: ac.signal });
      document.addEventListener('mouseup', onMouseUp, { signal: ac.signal });
    });
  }

  private findBlockUnderCursor(x: number, y: number, excludeId: string): string | null {
    for (const [id, { wrapper }] of this.blocks) {
      if (id === excludeId) continue;
      const rect = wrapper.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return id;
      }
    }
    return null;
  }

  /** Swap positions of two blocks using immutable updates. */
  private swapBlocks(idA: string, idB: string): void {
    const bA = this.plugin.layout.blocks.find(b => b.id === idA);
    const bB = this.plugin.layout.blocks.find(b => b.id === idB);
    if (!bA || !bB) return;

    const newBlocks = this.plugin.layout.blocks.map(b => {
      if (b.id === idA) return { ...b, col: bB.col, row: bB.row, colSpan: bB.colSpan, rowSpan: bB.rowSpan };
      if (b.id === idB) return { ...b, col: bA.col, row: bA.row, colSpan: bA.colSpan, rowSpan: bA.rowSpan };
      return b;
    });

    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }

  setEditMode(enabled: boolean): void {
    this.editMode = enabled;
    this.rerender();
  }

  /** Update column count, clamping each block's col and colSpan to fit. */
  setColumns(n: number): void {
    const newBlocks = this.plugin.layout.blocks.map(b => {
      const col = Math.min(b.col, n);
      const colSpan = Math.min(b.colSpan, n - col + 1);
      return { ...b, col, colSpan };
    });
    this.onLayoutChange({ ...this.plugin.layout, columns: n, blocks: newBlocks });
    this.rerender();
  }

  addBlock(instance: BlockInstance): void {
    const newBlocks = [...this.plugin.layout.blocks, instance];
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }

  private rerender(): void {
    const focused = document.activeElement;
    const focusedBlockId = (focused?.closest('[data-block-id]') as HTMLElement | null)?.dataset.blockId;
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
    if (focusedBlockId) {
      const el = this.gridEl.querySelector<HTMLElement>(`[data-block-id="${focusedBlockId}"]`);
      el?.focus();
    }
  }

  /** Unload all blocks and cancel any in-progress drag/resize. */
  destroyAll(): void {
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.activeClone?.remove();
    this.activeClone = null;

    for (const { block } of this.blocks.values()) {
      block.unload();
    }
    this.blocks.clear();
  }

  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyAll();
    this.gridEl.remove();
  }
}

// ── Block settings modal (title section + block-specific settings) ────────────

// [emoji, search keywords] — 170 most common/useful
const EMOJI_PICKER_SET: [string, string][] = [
  // Smileys & emotion
  ['😀','happy smile grin'],['😊','smile blush happy'],['😂','laugh cry funny joy'],
  ['🥲','tear smile grateful'],['😍','heart eyes love'],['🤩','star eyes excited'],
  ['😎','cool sunglasses'],['🤔','thinking hmm'],['😅','sweat nervous laugh'],
  ['😢','cry sad tear'],['😤','angry huff frustrated'],['🥳','party celebrate'],
  ['😴','sleep tired zzz'],['🤯','mind blown explode'],['🫡','salute respect'],
  // People & gestures
  ['👋','wave hello bye'],['👍','thumbs up good ok'],['👎','thumbs down bad'],
  ['✌','victory peace'],['🤝','handshake deal'],['🙏','pray thanks please'],
  ['💪','muscle strong flex'],['👁','eye watch see'],['🧠','brain mind think'],
  ['❤','heart love red'],['🧡','orange heart'],['💛','yellow heart'],
  ['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],
  // Nature
  ['🌱','seedling sprout grow'],['🌿','herb leaf green nature'],['🍀','clover luck'],
  ['🌸','blossom flower pink'],['🌺','flower hibiscus'],['🌻','sunflower'],
  ['🍂','autumn fall leaf'],['🌊','wave ocean water sea'],['🔥','fire flame hot'],
  ['❄','snowflake cold ice winter'],['⚡','lightning bolt energy'],['🌈','rainbow'],
  ['☀','sun sunny bright'],['🌙','moon night crescent'],['⭐','star favorite'],
  ['🌟','glowing star shine'],['✨','sparkles shine magic'],['🏔','mountain peak'],
  ['🌍','earth globe world'],['🌐','globe internet web'],
  // Food & objects
  ['☕','coffee tea hot drink'],['🍵','tea cup hot'],['🍺','beer drink'],
  ['🍎','apple fruit red'],['🍋','lemon yellow sour'],['🎂','cake birthday'],
  // Activities & sports
  ['🎯','target bullseye goal'],['🏆','trophy award win'],['🥇','medal gold first'],
  ['🎮','game controller play'],['🎨','art palette creative paint'],['🎵','music note song'],
  ['🎬','clapper film movie'],['📷','camera photo'],['🎁','gift present'],
  ['🎲','dice game random'],['🧩','puzzle piece'],['🎭','theater masks'],
  // Travel & places
  ['🚀','rocket launch space'],['✈','airplane travel fly'],['🚂','train travel'],
  ['🏠','house home'],['🏙','city building'],['🌆','city sunset'],
  // Objects & tools
  ['📁','folder directory'],['📂','open folder'],['📄','document page file'],
  ['📝','memo write note edit'],['📋','clipboard copy'],['📌','pushpin pin'],
  ['📍','location pin map'],['🔖','bookmark save'],['🗂','index dividers'],
  ['📅','calendar date schedule'],['🗓','calendar spiral'],['⏰','alarm clock time wake'],
  ['🕐','clock time hour'],['⏱','stopwatch timer'],['📊','chart bar data'],
  ['📈','chart up growth trend'],['📉','chart down decline'],
  ['💡','idea light bulb insight'],['🔍','search magnify zoom'],['🔗','link chain url'],
  ['📢','loudspeaker announce'],['🔔','bell notification alert'],
  ['💬','speech bubble chat message'],['💭','thought think bubble'],
  ['📚','books study library'],['📖','open book read'],['📜','scroll document'],
  ['✉','envelope email letter'],['📧','email message'],['📥','inbox download'],
  ['📤','outbox upload send'],['🗑','trash delete remove'],
  // Tech
  ['💻','laptop computer code'],['🖥','desktop monitor screen'],['📱','phone mobile'],
  ['⌨','keyboard type'],['🖱','mouse cursor click'],['📡','satellite antenna signal'],
  ['🔌','plug power electric'],['🔋','battery power charge'],['💾','floppy disk save'],
  ['💿','disc cd dvd'],['🖨','printer print'],
  // Symbols & status
  ['✅','check done complete yes'],['❌','cross error wrong no delete'],
  ['⚠','warning caution alert'],['❓','question mark'],['❗','exclamation important'],
  ['🔒','lock secure private'],['🔓','unlock open public'],['🔑','key password access'],
  ['🛡','shield protect security'],['⚙','gear settings config'],['🔧','wrench tool fix'],
  ['🔨','hammer build'],['⚗','flask chemistry lab'],['🔬','microscope science research'],
  ['🔭','telescope space astronomy'],['🧪','test tube experiment'],
  ['💎','gem diamond precious'],['💰','money bag rich'],['💳','credit card payment'],
  ['🏷','label tag price'],['🎀','ribbon bow gift'],
  // Misc useful
  ['🧭','compass navigate direction'],['🗺','map world navigate'],
  ['📦','box package shipping'],['🗄','filing cabinet archive'],
  ['🔐','lock key secure'],['📎','paperclip attach'],['✂','scissors cut'],
  ['🖊','pen write edit'],['📏','ruler measure'],['🔅','dim brightness'],
  ['🔆','bright sun light'],['♻','recycle sustainability'],['✔','checkmark done'],
  ['➕','plus add'],['➖','minus remove'],['🔄','refresh sync loop'],
  ['⏩','fast forward skip'],['⏪','rewind back'],['⏸','pause stop'],
  ['▶','play start'],['🔀','shuffle random mix'],
];

class BlockSettingsModal extends Modal {
  constructor(
    app: App,
    private instance: BlockInstance,
    private block: BaseBlock,
    private onSave: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Block Settings' });

    const draft = structuredClone(this.instance.config);

    new Setting(contentEl)
      .setName('Title label')
      .setDesc('Leave empty to use the default title.')
      .addText(t =>
        t.setValue(typeof draft._titleLabel === 'string' ? draft._titleLabel : '')
         .setPlaceholder('Default title')
         .onChange(v => { draft._titleLabel = v; }),
      );

    // ── Emoji picker ──────────────────────────────────────────────────────────
    const emojiRow = contentEl.createDiv({ cls: 'emoji-picker-row' });
    emojiRow.createSpan({ cls: 'setting-item-name', text: 'Title emoji' });

    const controls = emojiRow.createDiv({ cls: 'emoji-picker-controls' });

    const triggerBtn = controls.createEl('button', { cls: 'emoji-picker-trigger' });
    const updateTrigger = () => {
      const val = typeof draft._titleEmoji === 'string' ? draft._titleEmoji : '';
      triggerBtn.empty();
      triggerBtn.createSpan({ text: val || '＋' });
      triggerBtn.createSpan({ cls: 'emoji-picker-chevron', text: '▾' });
    };
    updateTrigger();

    const clearBtn = controls.createEl('button', { cls: 'emoji-picker-clear', text: '✕' });
    clearBtn.setAttribute('aria-label', 'Clear emoji');

    const panel = contentEl.createDiv({ cls: 'emoji-picker-panel' });
    panel.style.display = 'none';

    const searchInput = panel.createEl('input', {
      type: 'text',
      cls: 'emoji-picker-search',
      placeholder: 'Search…',
    });

    const gridEl = panel.createDiv({ cls: 'emoji-picker-grid' });

    const renderGrid = (query: string) => {
      gridEl.empty();
      const q = query.toLowerCase().trim();
      const filtered = q
        ? EMOJI_PICKER_SET.filter(([e, k]) => k.includes(q) || e === q)
        : EMOJI_PICKER_SET;
      for (const [emoji] of filtered) {
        const btn = gridEl.createEl('button', { cls: 'emoji-btn', text: emoji });
        if (draft._titleEmoji === emoji) btn.addClass('is-selected');
        btn.addEventListener('click', () => {
          draft._titleEmoji = emoji;
          updateTrigger();
          panel.style.display = 'none';
          searchInput.value = '';
          renderGrid('');
        });
      }
      if (filtered.length === 0) {
        gridEl.createSpan({ cls: 'emoji-picker-empty', text: 'No results' });
      }
    };
    renderGrid('');

    searchInput.addEventListener('input', () => renderGrid(searchInput.value));

    triggerBtn.addEventListener('click', () => {
      const open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      if (!open) setTimeout(() => searchInput.focus(), 0);
    });

    clearBtn.addEventListener('click', () => {
      draft._titleEmoji = '';
      updateTrigger();
      panel.style.display = 'none';
      searchInput.value = '';
      renderGrid('');
    });
    // ─────────────────────────────────────────────────────────────────────────

    new Setting(contentEl)
      .setName('Hide title')
      .addToggle(t =>
        t.setValue(draft._hideTitle === true)
         .onChange(v => { draft._hideTitle = v; }),
      );

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => {
          this.instance.config = draft;
          this.onSave();
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );

    const hr = contentEl.createEl('hr');
    hr.style.margin = '16px 0';

    contentEl.createEl('p', {
      text: 'Block-specific settings:',
      cls: 'setting-item-name',
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Configure block...').onClick(() => {
          this.close();
          this.block.openSettings(this.onSave);
        }),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}

// ── Remove confirmation modal ────────────────────────────────────────────────

class RemoveBlockConfirmModal extends Modal {
  constructor(app: App, private onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Remove block?' });
    contentEl.createEl('p', { text: 'This block will be removed from the homepage.' });
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Remove').setWarning().onClick(() => {
          this.onConfirm();
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
