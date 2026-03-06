import { App, Modal, Setting, setIcon } from 'obsidian';
import { GridStack, GridStackWidget, GridStackNode } from 'gridstack';
import { BlockInstance, LayoutConfig, IHomepagePlugin } from './types';
import { BlockRegistry } from './BlockRegistry';
import { BaseBlock } from './blocks/BaseBlock';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

export class GridLayout {
  private gridEl: HTMLElement;
  private gridStack: GridStack | null = null;
  private blocks = new Map<string, { block: BaseBlock; wrapper: HTMLElement }>();
  private editMode = false;
  /** Callback to trigger the Add Block modal from the empty state CTA. */
  onRequestAddBlock: (() => void) | null = null;
  /** ID of the most recently added block — used for scroll-into-view. */
  private lastAddedBlockId: string | null = null;
  /** Suppress change events during programmatic updates. */
  private suppressChange = false;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private plugin: IHomepagePlugin,
    private onLayoutChange: LayoutChangeCallback,
  ) {
    this.gridEl = containerEl.createDiv({ cls: 'homepage-grid grid-stack' });
  }

  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement(): HTMLElement {
    return this.gridEl;
  }

  render(blocks: BlockInstance[], columns: number, isInitial = false): void {
    this.destroyAll();

    this.gridEl.setAttribute('role', 'list');
    this.gridEl.setAttribute('aria-label', 'Homepage blocks');

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
      this.renderEmptyState();
      return;
    }

    this.initGridStack(blocks, columns, isInitial);
  }

  private renderEmptyState(): void {
    this.gridEl.empty();
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
  }

  private initGridStack(blocks: BlockInstance[], columns: number, isInitial: boolean): void {
    // Build widget items for GridStack
    const items: GridStackWidget[] = blocks.map((instance, i) => {
      const content = this.buildBlockContent(instance, isInitial ? i : undefined);
      return {
        id: instance.id,
        x: instance.x,
        y: instance.y,
        w: Math.min(instance.w, columns),
        h: instance.h,
        content,
      };
    });

    this.gridStack = GridStack.init({
      column: columns,
      cellHeight: 200,
      margin: 0,
      float: false,
      columnOpts: { breakpoints: [{ w: 0, c: columns }] },
      animate: true,
      staticGrid: !this.editMode,
      removable: false,
      resizable: { handles: 'se' },
    }, this.gridEl);

    // Load items
    this.suppressChange = true;
    this.gridStack.load(items);
    this.suppressChange = false;

    // Wire up block Component lifecycle after DOM is created
    for (const instance of blocks) {
      const gsEl = this.gridEl.querySelector(`[gs-id="${instance.id}"]`) as HTMLElement | null;
      if (!gsEl) continue;

      const contentEl = gsEl.querySelector('.block-content') as HTMLElement | null;
      const headerZone = gsEl.querySelector('.block-header-zone') as HTMLElement | null;
      if (!contentEl || !headerZone) continue;

      const factory = BlockRegistry.get(instance.type);
      if (!factory) continue;

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

      const wrapper = gsEl.querySelector('.homepage-block-wrapper') as HTMLElement;
      this.blocks.set(instance.id, { block, wrapper: wrapper ?? gsEl });

      // Collapse toggle
      this.setupCollapseToggle(gsEl, instance, headerZone);

      // Edit handles
      if (this.editMode) {
        this.attachEditHandles(wrapper ?? gsEl, instance);
      }
    }

    // Listen for GridStack changes (drag/resize) to persist layout
    this.gridStack.on('change', (_event: Event, nodes: GridStackNode[]) => {
      if (this.suppressChange) return;
      this.syncLayoutFromGrid();
    });

    // Scroll to newly added block
    if (this.lastAddedBlockId) {
      const targetId = this.lastAddedBlockId;
      this.lastAddedBlockId = null;
      const el = this.gridEl.querySelector(`[gs-id="${targetId}"]`) as HTMLElement | null;
      if (el) {
        el.querySelector('.homepage-block-wrapper')?.addClass('block-just-added');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /** Build the inner HTML string for a GridStack widget. */
  private buildBlockContent(instance: BlockInstance, blockIndex?: number): string {
    const collapsed = instance.collapsed ? ' block-collapsed' : '';
    const chevronCollapsed = instance.collapsed ? ' is-collapsed' : '';
    const animDelay = blockIndex !== undefined
      ? ` style="animation-delay: ${[0, 50, 100, 140, 170, 195, 215, 230][blockIndex] ?? 240}ms"`
      : '';

    return `<div class="homepage-block-wrapper${collapsed}" data-block-id="${instance.id}"${animDelay}>
      <div class="block-header-zone" role="button" tabindex="0" aria-expanded="${!instance.collapsed}">
        <span class="block-collapse-chevron${chevronCollapsed}" aria-hidden="true"></span>
      </div>
      <div class="block-content"></div>
    </div>`;
  }

  private setupCollapseToggle(gsEl: HTMLElement, instance: BlockInstance, headerZone: HTMLElement): void {
    const wrapper = gsEl.querySelector('.homepage-block-wrapper') as HTMLElement;
    const chevron = headerZone.querySelector('.block-collapse-chevron') as HTMLElement;
    if (!wrapper || !chevron) return;

    const toggleCollapse = (e: Event) => {
      e.stopPropagation();
      if (this.editMode) return;
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
      const onSave = (config: Record<string, unknown>) => {
        const newBlocks = this.plugin.layout.blocks.map(b =>
          b.id === instance.id ? { ...b, config } : b,
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
        // Remove from GridStack
        const gsItem = this.gridEl.querySelector(`[gs-id="${instance.id}"]`) as HTMLElement | null;
        if (gsItem && this.gridStack) {
          this.suppressChange = true;
          this.gridStack.removeWidget(gsItem);
          this.suppressChange = false;
        }
        // Unload block component
        const entry = this.blocks.get(instance.id);
        if (entry) {
          entry.block.unload();
          this.blocks.delete(instance.id);
        }
        // Update persisted layout
        const newBlocks = this.plugin.layout.blocks.filter(b => b.id !== instance.id);
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        // If no blocks left, show empty state
        if (newBlocks.length === 0) {
          this.rerender();
        }
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

    // Insert handle bar before header zone
    const headerZone = wrapper.querySelector('.block-header-zone');
    if (headerZone) {
      wrapper.insertBefore(bar, headerZone);
    }
  }

  /** Read current positions from GridStack nodes and persist to layout. */
  private syncLayoutFromGrid(): void {
    if (!this.gridStack) return;
    const nodes = this.gridStack.getGridItems();
    const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (const el of nodes) {
      const node = (el as GridStackWidget & { gridstackNode?: GridStackNode }).gridstackNode;
      const id = el.getAttribute('gs-id');
      if (id && node) {
        posMap.set(id, {
          x: node.x ?? 0,
          y: node.y ?? 0,
          w: node.w ?? 1,
          h: node.h ?? 1,
        });
      }
    }

    const newBlocks = this.plugin.layout.blocks.map(b => {
      const pos = posMap.get(b.id);
      if (pos) {
        return { ...b, ...pos };
      }
      return b;
    });

    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
  }

  setEditMode(enabled: boolean): void {
    this.editMode = enabled;
    if (this.gridStack) {
      this.gridStack.setStatic(!enabled);
    }
    this.rerender();
  }

  /** Update column count, clamping each block's w to fit. */
  setColumns(n: number): void {
    const newBlocks = this.plugin.layout.blocks.map(b => ({
      ...b,
      w: Math.min(b.w, n),
    }));
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
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
  }

  /** Unload all blocks and destroy GridStack instance. */
  destroyAll(): void {
    for (const { block } of this.blocks.values()) {
      block.unload();
    }
    this.blocks.clear();

    if (this.gridStack) {
      this.gridStack.removeAll(false);
      this.gridStack.destroy(false);
      this.gridStack = null;
    }
    this.gridEl.empty();
  }

  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy(): void {
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
    private onSave: (config: Record<string, unknown>) => void,
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
          this.onSave(draft);
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
          this.block.openSettings(() => this.onSave(this.instance.config));
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
