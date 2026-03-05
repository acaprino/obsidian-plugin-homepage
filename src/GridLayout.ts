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
  /** Callback to trigger the Add Block modal from the empty state CTA. */
  onRequestAddBlock: (() => void) | null = null;
  /** ID of the most recently added block — used for scroll-into-view. */
  private lastAddedBlockId: string | null = null;

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
    if (w <= 0) return layoutColumns;
    if (w <= 540) return 1;
    if (w <= 840) return Math.min(2, layoutColumns);
    if (w <= 1024) return Math.min(3, layoutColumns);
    return layoutColumns;
  }

  render(blocks: BlockInstance[], columns: number, isInitial = false): void {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.setAttribute('role', 'list');
    this.gridEl.setAttribute('aria-label', 'Homepage blocks');
    this.effectiveColumns = this.computeEffectiveColumns(columns);

    // Stagger animation only on the initial render (not reorder/collapse/column change)
    if (isInitial) {
      this.gridEl.addClass('homepage-grid--animating');
      setTimeout(() => this.gridEl.removeClass('homepage-grid--animating'), 500);
    }

    if (this.editMode) {
      this.gridEl.addClass('edit-mode');
    } else {
      this.gridEl.removeClass('edit-mode');
    }

    if (blocks.length === 0) {
      const empty = this.gridEl.createDiv({ cls: 'homepage-empty-state' });
      empty.createDiv({ cls: 'homepage-empty-icon', text: '\u{1F3E0}' });
      empty.createEl('p', { cls: 'homepage-empty-title', text: 'Your homepage is empty' });
      empty.createEl('p', {
        cls: 'homepage-empty-desc',
        text: this.editMode
          ? 'Click the button below to add your first block.'
          : 'Add blocks to build your personal dashboard. Toggle Edit mode in the toolbar to get started.',
      });
      if (this.editMode && this.onRequestAddBlock) {
        const cta = empty.createEl('button', { cls: 'homepage-empty-cta', text: 'Add Your First Block' });
        cta.addEventListener('click', () => { this.onRequestAddBlock?.(); });
      }
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
    wrapper.setAttribute('role', 'listitem');
    this.applyGridPosition(wrapper, instance);

    if (this.editMode) {
      this.attachEditHandles(wrapper, instance);
    }

    // Header zone — always visible; houses title + collapse chevron
    const headerZone = wrapper.createDiv({ cls: 'block-header-zone' });
    headerZone.setAttribute('role', 'button');
    headerZone.setAttribute('tabindex', '0');
    headerZone.setAttribute('aria-expanded', String(!instance.collapsed));
    const chevron = headerZone.createSpan({ cls: 'block-collapse-chevron' });
    chevron.setAttribute('aria-hidden', 'true');

    const contentEl = wrapper.createDiv({ cls: 'block-content' });
    const block = factory.create(this.app, instance, this.plugin);
    block.setHeaderContainer(headerZone);
    block.load();
    const result = block.render(contentEl);
    if (result instanceof Promise) {
      result.catch(e => {
        console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
        contentEl.setText('Error rendering block. Check console for details.');
      });
    }

    if (instance.collapsed) wrapper.addClass('block-collapsed');

    const toggleCollapse = (e: Event) => {
      e.stopPropagation();
      if (this.editMode) return; // edit mode: handle bar owns interaction
      const isNowCollapsed = !wrapper.hasClass('block-collapsed');
      wrapper.toggleClass('block-collapsed', isNowCollapsed);
      chevron.toggleClass('is-collapsed', isNowCollapsed);
      headerZone.setAttribute('aria-expanded', String(!isNowCollapsed));
      const newBlocks = this.plugin.layout.blocks.map(b =>
        b.id === instance.id ? { ...b, collapsed: isNowCollapsed } : b,
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    };

    headerZone.addEventListener('click', toggleCollapse);
    headerZone.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(e); }
    });

    if (instance.collapsed) chevron.addClass('is-collapsed');

    this.blocks.set(instance.id, { block, wrapper });
  }

  private applyGridPosition(wrapper: HTMLElement, instance: BlockInstance): void {
    const cols = this.effectiveColumns;
    const colSpan = Math.min(instance.colSpan, cols);
    // For N columns there are (N-1) gaps distributed across N slots.
    // A block spanning S columns covers S slots and (S-1) internal gaps,
    // so it must subtract (N-S)/N share of the total gap space.
    // Formula: basis = S/N * 100% - (N-S)/N * gap
    const basisPercent = (colSpan / cols) * 100;
    const gapFraction = (cols - colSpan) / cols;
    wrapper.style.flex = `${colSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
    wrapper.style.minWidth = cols === 1 ? '0' : 'var(--hp-card-min-width, 200px)';
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

    // Move up / down keyboard-accessible reorder buttons
    const moveUpBtn = bar.createEl('button', { cls: 'block-move-up-btn' });
    setIcon(moveUpBtn, 'chevron-up');
    moveUpBtn.setAttribute('aria-label', 'Move block up');
    moveUpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = this.plugin.layout.blocks.findIndex(b => b.id === instance.id);
      if (idx <= 0) return;
      const newBlocks = [...this.plugin.layout.blocks];
      [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
    });

    const moveDownBtn = bar.createEl('button', { cls: 'block-move-down-btn' });
    setIcon(moveDownBtn, 'chevron-down');
    moveDownBtn.setAttribute('aria-label', 'Move block down');
    moveDownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = this.plugin.layout.blocks.findIndex(b => b.id === instance.id);
      if (idx < 0 || idx >= this.plugin.layout.blocks.length - 1) return;
      const newBlocks = [...this.plugin.layout.blocks];
      [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
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

      // Lightweight clone — no deep-copy of heavy block content
      const clone = document.createElement('div');
      clone.addClass('block-drag-clone');
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.left = `${e.clientX - wrapper.offsetWidth / 2}px`;
      clone.style.top = `${e.clientY - 20}px`;
      // Append inside themed container so CSS vars resolve correctly
      const themed = (this.gridEl.closest('.app-container') ?? document.body) as HTMLElement;
      themed.appendChild(clone);
      this.activeClone = clone;

      const sourceId = instance.id;
      wrapper.addClass('block-dragging');

      // Cache rects once at drag start to avoid layout thrash on every mousemove
      const cachedRects = new Map<string, DOMRect>();
      for (const [id, { wrapper: w }] of this.blocks) {
        if (id !== sourceId) cachedRects.set(id, w.getBoundingClientRect());
      }

      const clearIndicators = () => {
        for (const { wrapper: w } of this.blocks.values()) {
          w.removeClass('drop-before', 'drop-after');
        }
      };

      const onMouseMove = (me: MouseEvent) => {
        clone.style.left = `${me.clientX - wrapper.offsetWidth / 2}px`;
        clone.style.top = `${me.clientY - 20}px`;

        clearIndicators();
        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, cachedRects);
        if (pt.targetId) {
          this.blocks.get(pt.targetId)?.wrapper.addClass(
            pt.insertBefore ? 'drop-before' : 'drop-after',
          );
        }
      };

      const onMouseUp = (me: MouseEvent) => {
        ac.abort();
        this.activeAbortController = null;
        clone.remove();
        this.activeClone = null;
        wrapper.removeClass('block-dragging');
        clearIndicators();

        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, cachedRects);
        this.reorderBlock(sourceId, pt.insertBeforeId);
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
        const gapFraction = (columns - currentColSpan) / columns;
        wrapper.style.flex = `${currentColSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
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

  private findInsertionPointCached(
    x: number,
    y: number,
    excludeId: string,
    rects: Map<string, DOMRect>,
  ): { targetId: string | null; insertBefore: boolean; insertBeforeId: string | null } {
    let bestTargetId: string | null = null;
    let bestDist = Infinity;
    let bestInsertBefore = true;

    for (const [id, rect] of rects) {
      if (id === excludeId) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // If cursor is directly over this card, use it immediately
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const insertBefore = x < cx;
        return { targetId: id, insertBefore, insertBeforeId: insertBefore ? id : this.nextBlockId(id) };
      }

      // Beyond 300px from center, don't show indicator — prevents unintuitive highlights
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist && dist < 300) {
        bestDist = dist;
        bestTargetId = id;
        bestInsertBefore = x < cx;
      }
    }

    if (!bestTargetId) return { targetId: null, insertBefore: true, insertBeforeId: null };
    return {
      targetId: bestTargetId,
      insertBefore: bestInsertBefore,
      insertBeforeId: bestInsertBefore ? bestTargetId : this.nextBlockId(bestTargetId),
    };
  }

  private nextBlockId(id: string): string | null {
    const blocks = this.plugin.layout.blocks;
    const idx = blocks.findIndex(b => b.id === id);
    return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1].id : null;
  }

  /** Remove the dragged block from its current position and insert it before insertBeforeId (null = append). */
  private reorderBlock(draggedId: string, insertBeforeId: string | null): void {
    const blocks = this.plugin.layout.blocks;
    const dragged = blocks.find(b => b.id === draggedId);
    if (!dragged) return;

    const withoutDragged = blocks.filter(b => b.id !== draggedId);
    const insertAt = insertBeforeId
      ? withoutDragged.findIndex(b => b.id === insertBeforeId)
      : withoutDragged.length;

    // No-op if effectively same position
    const originalIdx = blocks.findIndex(b => b.id === draggedId);
    const resolvedAt = insertAt === -1 ? withoutDragged.length : insertAt;
    if (resolvedAt === originalIdx || resolvedAt === originalIdx + 1) return;

    const newBlocks = [
      ...withoutDragged.slice(0, resolvedAt),
      dragged,
      ...withoutDragged.slice(resolvedAt),
    ];
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
    this.lastAddedBlockId = instance.id;
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }

  private rerender(): void {
    const focused = document.activeElement;
    const focusedBlockId = (focused?.closest('[data-block-id]') as HTMLElement | null)?.dataset.blockId;
    const scrollTargetId = this.lastAddedBlockId;
    this.lastAddedBlockId = null;

    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);

    if (scrollTargetId) {
      const entry = this.blocks.get(scrollTargetId);
      if (entry) {
        entry.wrapper.addClass('block-just-added');
        entry.wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else if (focusedBlockId) {
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
