"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HomepagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian15 = require("obsidian");

// src/HomepageView.ts
var import_obsidian3 = require("obsidian");

// src/GridLayout.ts
var import_obsidian = require("obsidian");

// src/BlockRegistry.ts
var BlockRegistryClass = class {
  constructor() {
    this.factories = /* @__PURE__ */ new Map();
  }
  register(factory) {
    this.factories.set(factory.type, factory);
  }
  get(type) {
    return this.factories.get(type);
  }
  getAll() {
    return Array.from(this.factories.values());
  }
  clear() {
    this.factories.clear();
  }
};
var BlockRegistry = new BlockRegistryClass();

// src/GridLayout.ts
var GridLayout = class {
  constructor(containerEl, app, plugin, onLayoutChange) {
    this.app = app;
    this.plugin = plugin;
    this.onLayoutChange = onLayoutChange;
    this.blocks = /* @__PURE__ */ new Map();
    this.editMode = false;
    /** AbortController for the currently active drag or resize operation. */
    this.activeAbortController = null;
    /** Drag clone appended to document.body; tracked so we can remove it on early teardown. */
    this.activeClone = null;
    this.resizeObserver = null;
    this.effectiveColumns = 3;
    /** Callback to trigger the Add Block modal from the empty state CTA. */
    this.onRequestAddBlock = null;
    /** ID of the most recently added block — used for scroll-into-view. */
    this.lastAddedBlockId = null;
    this.gridEl = containerEl.createDiv({ cls: "homepage-grid" });
    this.resizeObserver = new ResizeObserver(() => {
      const newEffective = this.computeEffectiveColumns(this.plugin.layout.columns);
      if (newEffective !== this.effectiveColumns) {
        this.rerender();
      }
    });
    this.resizeObserver.observe(this.gridEl);
  }
  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement() {
    return this.gridEl;
  }
  computeEffectiveColumns(layoutColumns) {
    const w = this.gridEl.offsetWidth;
    if (w <= 0) return layoutColumns;
    if (w <= 540) return 1;
    if (w <= 840) return Math.min(2, layoutColumns);
    if (w <= 1024) return Math.min(3, layoutColumns);
    return layoutColumns;
  }
  render(blocks, columns) {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.setAttribute("role", "grid");
    this.gridEl.setAttribute("aria-label", "Homepage blocks");
    this.effectiveColumns = this.computeEffectiveColumns(columns);
    if (this.editMode) {
      this.gridEl.addClass("edit-mode");
    } else {
      this.gridEl.removeClass("edit-mode");
    }
    if (blocks.length === 0) {
      const empty = this.gridEl.createDiv({ cls: "homepage-empty-state" });
      empty.createDiv({ cls: "homepage-empty-icon", text: "\u{1F3E0}" });
      empty.createEl("p", { cls: "homepage-empty-title", text: "Your homepage is empty" });
      empty.createEl("p", {
        cls: "homepage-empty-desc",
        text: "Add blocks to build your personal dashboard. Toggle Edit mode in the toolbar to get started."
      });
      if (this.editMode && this.onRequestAddBlock) {
        const cta = empty.createEl("button", { cls: "homepage-empty-cta", text: "Add Your First Block" });
        cta.addEventListener("click", () => {
          var _a;
          (_a = this.onRequestAddBlock) == null ? void 0 : _a.call(this);
        });
      }
      return;
    }
    for (const instance of blocks) {
      this.renderBlock(instance);
    }
  }
  renderBlock(instance) {
    const factory = BlockRegistry.get(instance.type);
    if (!factory) return;
    const wrapper = this.gridEl.createDiv({ cls: "homepage-block-wrapper" });
    wrapper.dataset.blockId = instance.id;
    wrapper.setAttribute("role", "gridcell");
    wrapper.setAttribute("aria-label", factory.displayName);
    this.applyGridPosition(wrapper, instance);
    if (this.editMode) {
      this.attachEditHandles(wrapper, instance);
    }
    const headerZone = wrapper.createDiv({ cls: "block-header-zone" });
    const chevron = headerZone.createSpan({ cls: "block-collapse-chevron" });
    const contentEl = wrapper.createDiv({ cls: "block-content" });
    const block = factory.create(this.app, instance, this.plugin);
    block.setHeaderContainer(headerZone);
    block.load();
    const result = block.render(contentEl);
    if (result instanceof Promise) {
      result.catch((e) => {
        console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
        contentEl.setText("Error rendering block. Check console for details.");
      });
    }
    if (instance.collapsed) wrapper.addClass("block-collapsed");
    headerZone.addEventListener("click", (e) => {
      e.stopPropagation();
      const isNowCollapsed = !wrapper.hasClass("block-collapsed");
      wrapper.toggleClass("block-collapsed", isNowCollapsed);
      chevron.toggleClass("is-collapsed", isNowCollapsed);
      const newBlocks = this.plugin.layout.blocks.map(
        (b) => b.id === instance.id ? { ...b, collapsed: isNowCollapsed } : b
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    });
    if (instance.collapsed) chevron.addClass("is-collapsed");
    this.blocks.set(instance.id, { block, wrapper });
  }
  applyGridPosition(wrapper, instance) {
    const cols = this.effectiveColumns;
    const colSpan = Math.min(instance.colSpan, cols);
    const basisPercent = colSpan / cols * 100;
    const gapFraction = (cols - colSpan) / cols;
    wrapper.style.flex = `${colSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
    wrapper.style.minWidth = cols === 1 ? "0" : "var(--hp-card-min-width, 200px)";
  }
  attachEditHandles(wrapper, instance) {
    const bar = wrapper.createDiv({ cls: "block-handle-bar" });
    const handle = bar.createDiv({ cls: "block-move-handle" });
    (0, import_obsidian.setIcon)(handle, "grip-vertical");
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.setAttribute("title", "Drag to reorder");
    const settingsBtn = bar.createEl("button", { cls: "block-settings-btn" });
    (0, import_obsidian.setIcon)(settingsBtn, "settings");
    settingsBtn.setAttribute("aria-label", "Block settings");
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = this.blocks.get(instance.id);
      if (!entry) return;
      const onSave = () => {
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? instance : b
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };
      new BlockSettingsModal(this.app, instance, entry.block, onSave).open();
    });
    const removeBtn = bar.createEl("button", { cls: "block-remove-btn" });
    (0, import_obsidian.setIcon)(removeBtn, "x");
    removeBtn.setAttribute("aria-label", "Remove block");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new RemoveBlockConfirmModal(this.app, () => {
        const newBlocks = this.plugin.layout.blocks.filter((b) => b.id !== instance.id);
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      }).open();
    });
    const grip = wrapper.createDiv({ cls: "block-resize-grip" });
    (0, import_obsidian.setIcon)(grip, "maximize-2");
    grip.setAttribute("aria-label", "Drag to resize");
    grip.setAttribute("title", "Drag to resize");
    this.attachResizeHandler(grip, wrapper, instance);
    this.attachDragHandler(handle, wrapper, instance);
  }
  attachDragHandler(handle, wrapper, instance) {
    handle.addEventListener("mousedown", (e) => {
      var _a;
      e.preventDefault();
      (_a = this.activeAbortController) == null ? void 0 : _a.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;
      const clone = wrapper.cloneNode(true);
      clone.addClass("block-drag-clone");
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.left = `${e.clientX - wrapper.offsetWidth / 2}px`;
      clone.style.top = `${e.clientY - 20}px`;
      document.body.appendChild(clone);
      this.activeClone = clone;
      const sourceId = instance.id;
      wrapper.addClass("block-dragging");
      const clearIndicators = () => {
        for (const { wrapper: w } of this.blocks.values()) {
          w.removeClass("drop-before", "drop-after");
        }
      };
      const onMouseMove = (me) => {
        var _a2;
        clone.style.left = `${me.clientX - wrapper.offsetWidth / 2}px`;
        clone.style.top = `${me.clientY - 20}px`;
        clearIndicators();
        const pt = this.findInsertionPoint(me.clientX, me.clientY, sourceId);
        if (pt.targetId) {
          (_a2 = this.blocks.get(pt.targetId)) == null ? void 0 : _a2.wrapper.addClass(
            pt.insertBefore ? "drop-before" : "drop-after"
          );
        }
      };
      const onMouseUp = (me) => {
        ac.abort();
        this.activeAbortController = null;
        clone.remove();
        this.activeClone = null;
        wrapper.removeClass("block-dragging");
        clearIndicators();
        const pt = this.findInsertionPoint(me.clientX, me.clientY, sourceId);
        this.reorderBlock(sourceId, pt.insertBeforeId);
      };
      document.addEventListener("mousemove", onMouseMove, { signal: ac.signal });
      document.addEventListener("mouseup", onMouseUp, { signal: ac.signal });
    });
  }
  attachResizeHandler(grip, wrapper, instance) {
    grip.addEventListener("mousedown", (e) => {
      var _a;
      e.preventDefault();
      e.stopPropagation();
      (_a = this.activeAbortController) == null ? void 0 : _a.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;
      const startX = e.clientX;
      const startColSpan = instance.colSpan;
      const columns = this.effectiveColumns;
      const colWidth = this.gridEl.offsetWidth / columns;
      let currentColSpan = startColSpan;
      const onMouseMove = (me) => {
        const deltaX = me.clientX - startX;
        const deltaCols = Math.round(deltaX / colWidth);
        currentColSpan = Math.max(1, Math.min(columns, startColSpan + deltaCols));
        const basisPercent = currentColSpan / columns * 100;
        const gapFraction = (columns - currentColSpan) / columns;
        wrapper.style.flex = `${currentColSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
      };
      const onMouseUp = () => {
        ac.abort();
        this.activeAbortController = null;
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? { ...b, colSpan: currentColSpan } : b
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };
      document.addEventListener("mousemove", onMouseMove, { signal: ac.signal });
      document.addEventListener("mouseup", onMouseUp, { signal: ac.signal });
    });
  }
  findInsertionPoint(x, y, excludeId) {
    let bestTargetId = null;
    let bestDist = Infinity;
    let bestInsertBefore = true;
    for (const [id, { wrapper }] of this.blocks) {
      if (id === excludeId) continue;
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const insertBefore = x < cx;
        return { targetId: id, insertBefore, insertBeforeId: insertBefore ? id : this.nextBlockId(id) };
      }
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTargetId = id;
        bestInsertBefore = x < cx;
      }
    }
    if (!bestTargetId) return { targetId: null, insertBefore: true, insertBeforeId: null };
    return {
      targetId: bestTargetId,
      insertBefore: bestInsertBefore,
      insertBeforeId: bestInsertBefore ? bestTargetId : this.nextBlockId(bestTargetId)
    };
  }
  nextBlockId(id) {
    const blocks = this.plugin.layout.blocks;
    const idx = blocks.findIndex((b) => b.id === id);
    return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1].id : null;
  }
  /** Remove the dragged block from its current position and insert it before insertBeforeId (null = append). */
  reorderBlock(draggedId, insertBeforeId) {
    const blocks = this.plugin.layout.blocks;
    const dragged = blocks.find((b) => b.id === draggedId);
    if (!dragged) return;
    const withoutDragged = blocks.filter((b) => b.id !== draggedId);
    const insertAt = insertBeforeId ? withoutDragged.findIndex((b) => b.id === insertBeforeId) : withoutDragged.length;
    const originalIdx = blocks.findIndex((b) => b.id === draggedId);
    const resolvedAt = insertAt === -1 ? withoutDragged.length : insertAt;
    if (resolvedAt === originalIdx || resolvedAt === originalIdx + 1) return;
    const newBlocks = [
      ...withoutDragged.slice(0, resolvedAt),
      dragged,
      ...withoutDragged.slice(resolvedAt)
    ];
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  setEditMode(enabled) {
    this.editMode = enabled;
    this.rerender();
  }
  /** Update column count, clamping each block's col and colSpan to fit. */
  setColumns(n) {
    const newBlocks = this.plugin.layout.blocks.map((b) => {
      const col = Math.min(b.col, n);
      const colSpan = Math.min(b.colSpan, n - col + 1);
      return { ...b, col, colSpan };
    });
    this.onLayoutChange({ ...this.plugin.layout, columns: n, blocks: newBlocks });
    this.rerender();
  }
  addBlock(instance) {
    const newBlocks = [...this.plugin.layout.blocks, instance];
    this.lastAddedBlockId = instance.id;
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  rerender() {
    var _a;
    const focused = document.activeElement;
    const focusedBlockId = (_a = focused == null ? void 0 : focused.closest("[data-block-id]")) == null ? void 0 : _a.dataset.blockId;
    const scrollTargetId = this.lastAddedBlockId;
    this.lastAddedBlockId = null;
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
    if (scrollTargetId) {
      const newEl = this.gridEl.querySelector(`[data-block-id="${scrollTargetId}"]`);
      if (newEl) {
        newEl.addClass("block-just-added");
        newEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else if (focusedBlockId) {
      const el = this.gridEl.querySelector(`[data-block-id="${focusedBlockId}"]`);
      el == null ? void 0 : el.focus();
    }
  }
  /** Unload all blocks and cancel any in-progress drag/resize. */
  destroyAll() {
    var _a, _b;
    (_a = this.activeAbortController) == null ? void 0 : _a.abort();
    this.activeAbortController = null;
    (_b = this.activeClone) == null ? void 0 : _b.remove();
    this.activeClone = null;
    for (const { block } of this.blocks.values()) {
      block.unload();
    }
    this.blocks.clear();
  }
  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy() {
    var _a;
    (_a = this.resizeObserver) == null ? void 0 : _a.disconnect();
    this.resizeObserver = null;
    this.destroyAll();
    this.gridEl.remove();
  }
};
var EMOJI_PICKER_SET = [
  // Smileys & emotion
  ["\u{1F600}", "happy smile grin"],
  ["\u{1F60A}", "smile blush happy"],
  ["\u{1F602}", "laugh cry funny joy"],
  ["\u{1F972}", "tear smile grateful"],
  ["\u{1F60D}", "heart eyes love"],
  ["\u{1F929}", "star eyes excited"],
  ["\u{1F60E}", "cool sunglasses"],
  ["\u{1F914}", "thinking hmm"],
  ["\u{1F605}", "sweat nervous laugh"],
  ["\u{1F622}", "cry sad tear"],
  ["\u{1F624}", "angry huff frustrated"],
  ["\u{1F973}", "party celebrate"],
  ["\u{1F634}", "sleep tired zzz"],
  ["\u{1F92F}", "mind blown explode"],
  ["\u{1FAE1}", "salute respect"],
  // People & gestures
  ["\u{1F44B}", "wave hello bye"],
  ["\u{1F44D}", "thumbs up good ok"],
  ["\u{1F44E}", "thumbs down bad"],
  ["\u270C", "victory peace"],
  ["\u{1F91D}", "handshake deal"],
  ["\u{1F64F}", "pray thanks please"],
  ["\u{1F4AA}", "muscle strong flex"],
  ["\u{1F441}", "eye watch see"],
  ["\u{1F9E0}", "brain mind think"],
  ["\u2764", "heart love red"],
  ["\u{1F9E1}", "orange heart"],
  ["\u{1F49B}", "yellow heart"],
  ["\u{1F49A}", "green heart"],
  ["\u{1F499}", "blue heart"],
  ["\u{1F49C}", "purple heart"],
  ["\u{1F5A4}", "black heart"],
  // Nature
  ["\u{1F331}", "seedling sprout grow"],
  ["\u{1F33F}", "herb leaf green nature"],
  ["\u{1F340}", "clover luck"],
  ["\u{1F338}", "blossom flower pink"],
  ["\u{1F33A}", "flower hibiscus"],
  ["\u{1F33B}", "sunflower"],
  ["\u{1F342}", "autumn fall leaf"],
  ["\u{1F30A}", "wave ocean water sea"],
  ["\u{1F525}", "fire flame hot"],
  ["\u2744", "snowflake cold ice winter"],
  ["\u26A1", "lightning bolt energy"],
  ["\u{1F308}", "rainbow"],
  ["\u2600", "sun sunny bright"],
  ["\u{1F319}", "moon night crescent"],
  ["\u2B50", "star favorite"],
  ["\u{1F31F}", "glowing star shine"],
  ["\u2728", "sparkles shine magic"],
  ["\u{1F3D4}", "mountain peak"],
  ["\u{1F30D}", "earth globe world"],
  ["\u{1F310}", "globe internet web"],
  // Food & objects
  ["\u2615", "coffee tea hot drink"],
  ["\u{1F375}", "tea cup hot"],
  ["\u{1F37A}", "beer drink"],
  ["\u{1F34E}", "apple fruit red"],
  ["\u{1F34B}", "lemon yellow sour"],
  ["\u{1F382}", "cake birthday"],
  // Activities & sports
  ["\u{1F3AF}", "target bullseye goal"],
  ["\u{1F3C6}", "trophy award win"],
  ["\u{1F947}", "medal gold first"],
  ["\u{1F3AE}", "game controller play"],
  ["\u{1F3A8}", "art palette creative paint"],
  ["\u{1F3B5}", "music note song"],
  ["\u{1F3AC}", "clapper film movie"],
  ["\u{1F4F7}", "camera photo"],
  ["\u{1F381}", "gift present"],
  ["\u{1F3B2}", "dice game random"],
  ["\u{1F9E9}", "puzzle piece"],
  ["\u{1F3AD}", "theater masks"],
  // Travel & places
  ["\u{1F680}", "rocket launch space"],
  ["\u2708", "airplane travel fly"],
  ["\u{1F682}", "train travel"],
  ["\u{1F3E0}", "house home"],
  ["\u{1F3D9}", "city building"],
  ["\u{1F306}", "city sunset"],
  // Objects & tools
  ["\u{1F4C1}", "folder directory"],
  ["\u{1F4C2}", "open folder"],
  ["\u{1F4C4}", "document page file"],
  ["\u{1F4DD}", "memo write note edit"],
  ["\u{1F4CB}", "clipboard copy"],
  ["\u{1F4CC}", "pushpin pin"],
  ["\u{1F4CD}", "location pin map"],
  ["\u{1F516}", "bookmark save"],
  ["\u{1F5C2}", "index dividers"],
  ["\u{1F4C5}", "calendar date schedule"],
  ["\u{1F5D3}", "calendar spiral"],
  ["\u23F0", "alarm clock time wake"],
  ["\u{1F550}", "clock time hour"],
  ["\u23F1", "stopwatch timer"],
  ["\u{1F4CA}", "chart bar data"],
  ["\u{1F4C8}", "chart up growth trend"],
  ["\u{1F4C9}", "chart down decline"],
  ["\u{1F4A1}", "idea light bulb insight"],
  ["\u{1F50D}", "search magnify zoom"],
  ["\u{1F517}", "link chain url"],
  ["\u{1F4E2}", "loudspeaker announce"],
  ["\u{1F514}", "bell notification alert"],
  ["\u{1F4AC}", "speech bubble chat message"],
  ["\u{1F4AD}", "thought think bubble"],
  ["\u{1F4DA}", "books study library"],
  ["\u{1F4D6}", "open book read"],
  ["\u{1F4DC}", "scroll document"],
  ["\u2709", "envelope email letter"],
  ["\u{1F4E7}", "email message"],
  ["\u{1F4E5}", "inbox download"],
  ["\u{1F4E4}", "outbox upload send"],
  ["\u{1F5D1}", "trash delete remove"],
  // Tech
  ["\u{1F4BB}", "laptop computer code"],
  ["\u{1F5A5}", "desktop monitor screen"],
  ["\u{1F4F1}", "phone mobile"],
  ["\u2328", "keyboard type"],
  ["\u{1F5B1}", "mouse cursor click"],
  ["\u{1F4E1}", "satellite antenna signal"],
  ["\u{1F50C}", "plug power electric"],
  ["\u{1F50B}", "battery power charge"],
  ["\u{1F4BE}", "floppy disk save"],
  ["\u{1F4BF}", "disc cd dvd"],
  ["\u{1F5A8}", "printer print"],
  // Symbols & status
  ["\u2705", "check done complete yes"],
  ["\u274C", "cross error wrong no delete"],
  ["\u26A0", "warning caution alert"],
  ["\u2753", "question mark"],
  ["\u2757", "exclamation important"],
  ["\u{1F512}", "lock secure private"],
  ["\u{1F513}", "unlock open public"],
  ["\u{1F511}", "key password access"],
  ["\u{1F6E1}", "shield protect security"],
  ["\u2699", "gear settings config"],
  ["\u{1F527}", "wrench tool fix"],
  ["\u{1F528}", "hammer build"],
  ["\u2697", "flask chemistry lab"],
  ["\u{1F52C}", "microscope science research"],
  ["\u{1F52D}", "telescope space astronomy"],
  ["\u{1F9EA}", "test tube experiment"],
  ["\u{1F48E}", "gem diamond precious"],
  ["\u{1F4B0}", "money bag rich"],
  ["\u{1F4B3}", "credit card payment"],
  ["\u{1F3F7}", "label tag price"],
  ["\u{1F380}", "ribbon bow gift"],
  // Misc useful
  ["\u{1F9ED}", "compass navigate direction"],
  ["\u{1F5FA}", "map world navigate"],
  ["\u{1F4E6}", "box package shipping"],
  ["\u{1F5C4}", "filing cabinet archive"],
  ["\u{1F510}", "lock key secure"],
  ["\u{1F4CE}", "paperclip attach"],
  ["\u2702", "scissors cut"],
  ["\u{1F58A}", "pen write edit"],
  ["\u{1F4CF}", "ruler measure"],
  ["\u{1F505}", "dim brightness"],
  ["\u{1F506}", "bright sun light"],
  ["\u267B", "recycle sustainability"],
  ["\u2714", "checkmark done"],
  ["\u2795", "plus add"],
  ["\u2796", "minus remove"],
  ["\u{1F504}", "refresh sync loop"],
  ["\u23E9", "fast forward skip"],
  ["\u23EA", "rewind back"],
  ["\u23F8", "pause stop"],
  ["\u25B6", "play start"],
  ["\u{1F500}", "shuffle random mix"]
];
var BlockSettingsModal = class extends import_obsidian.Modal {
  constructor(app, instance, block, onSave) {
    super(app);
    this.instance = instance;
    this.block = block;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Block Settings" });
    const draft = structuredClone(this.instance.config);
    new import_obsidian.Setting(contentEl).setName("Title label").setDesc("Leave empty to use the default title.").addText(
      (t) => t.setValue(typeof draft._titleLabel === "string" ? draft._titleLabel : "").setPlaceholder("Default title").onChange((v) => {
        draft._titleLabel = v;
      })
    );
    const emojiRow = contentEl.createDiv({ cls: "emoji-picker-row" });
    emojiRow.createSpan({ cls: "setting-item-name", text: "Title emoji" });
    const controls = emojiRow.createDiv({ cls: "emoji-picker-controls" });
    const triggerBtn = controls.createEl("button", { cls: "emoji-picker-trigger" });
    const updateTrigger = () => {
      const val = typeof draft._titleEmoji === "string" ? draft._titleEmoji : "";
      triggerBtn.empty();
      triggerBtn.createSpan({ text: val || "\uFF0B" });
      triggerBtn.createSpan({ cls: "emoji-picker-chevron", text: "\u25BE" });
    };
    updateTrigger();
    const clearBtn = controls.createEl("button", { cls: "emoji-picker-clear", text: "\u2715" });
    clearBtn.setAttribute("aria-label", "Clear emoji");
    const panel = contentEl.createDiv({ cls: "emoji-picker-panel" });
    panel.style.display = "none";
    const searchInput = panel.createEl("input", {
      type: "text",
      cls: "emoji-picker-search",
      placeholder: "Search\u2026"
    });
    const gridEl = panel.createDiv({ cls: "emoji-picker-grid" });
    const renderGrid = (query) => {
      gridEl.empty();
      const q = query.toLowerCase().trim();
      const filtered = q ? EMOJI_PICKER_SET.filter(([e, k]) => k.includes(q) || e === q) : EMOJI_PICKER_SET;
      for (const [emoji] of filtered) {
        const btn = gridEl.createEl("button", { cls: "emoji-btn", text: emoji });
        if (draft._titleEmoji === emoji) btn.addClass("is-selected");
        btn.addEventListener("click", () => {
          draft._titleEmoji = emoji;
          updateTrigger();
          panel.style.display = "none";
          searchInput.value = "";
          renderGrid("");
        });
      }
      if (filtered.length === 0) {
        gridEl.createSpan({ cls: "emoji-picker-empty", text: "No results" });
      }
    };
    renderGrid("");
    searchInput.addEventListener("input", () => renderGrid(searchInput.value));
    triggerBtn.addEventListener("click", () => {
      const open = panel.style.display !== "none";
      panel.style.display = open ? "none" : "block";
      if (!open) setTimeout(() => searchInput.focus(), 0);
    });
    clearBtn.addEventListener("click", () => {
      draft._titleEmoji = "";
      updateTrigger();
      panel.style.display = "none";
      searchInput.value = "";
      renderGrid("");
    });
    new import_obsidian.Setting(contentEl).setName("Hide title").addToggle(
      (t) => t.setValue(draft._hideTitle === true).onChange((v) => {
        draft._hideTitle = v;
      })
    );
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.instance.config = draft;
        this.onSave();
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
    const hr = contentEl.createEl("hr");
    hr.style.margin = "16px 0";
    contentEl.createEl("p", {
      text: "Block-specific settings:",
      cls: "setting-item-name"
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Configure block...").onClick(() => {
        this.close();
        this.block.openSettings(this.onSave);
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var RemoveBlockConfirmModal = class extends import_obsidian.Modal {
  constructor(app, onConfirm) {
    super(app);
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Remove block?" });
    contentEl.createEl("p", { text: "This block will be removed from the homepage." });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Remove").setWarning().onClick(() => {
        this.onConfirm();
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/EditToolbar.ts
var import_obsidian2 = require("obsidian");
var EditToolbar = class {
  constructor(containerEl, app, plugin, grid, onColumnsChange) {
    this.app = app;
    this.plugin = plugin;
    this.grid = grid;
    this.onColumnsChange = onColumnsChange;
    this.editMode = false;
    this.toolbarEl = containerEl.createDiv({ cls: "homepage-toolbar" });
    this.toolbarEl.setAttribute("role", "toolbar");
    this.toolbarEl.setAttribute("aria-label", "Homepage toolbar");
    this.renderToolbar();
  }
  renderToolbar() {
    this.toolbarEl.empty();
    const indicator = this.toolbarEl.createDiv({ cls: "toolbar-edit-indicator" });
    indicator.createDiv({ cls: "toolbar-edit-dot" });
    indicator.createSpan({ text: "Editing" });
    if (this.editMode) indicator.addClass("is-visible");
    const colSelect = this.toolbarEl.createEl("select", { cls: "toolbar-col-select" });
    colSelect.setAttribute("aria-label", "Number of columns");
    [2, 3, 4].forEach((n) => {
      const opt = colSelect.createEl("option", { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener("change", () => {
      this.onColumnsChange(Number(colSelect.value));
    });
    const editBtn = this.toolbarEl.createEl("button", { cls: "toolbar-edit-btn" });
    this.updateEditBtn(editBtn);
    editBtn.addEventListener("click", () => {
      this.editMode = !this.editMode;
      this.grid.setEditMode(this.editMode);
      this.updateEditBtn(editBtn);
      this.syncAddButton();
      indicator.toggleClass("is-visible", this.editMode);
      this.toolbarEl.toggleClass("toolbar-editing", this.editMode);
    });
    if (this.editMode) {
      this.toolbarEl.addClass("toolbar-editing");
      this.appendAddButton();
    }
    this.grid.onRequestAddBlock = () => {
      this.openAddBlockModal();
    };
  }
  updateEditBtn(btn) {
    btn.textContent = this.editMode ? "\u2713 Done" : "\u270F Edit";
    btn.toggleClass("toolbar-btn-active", this.editMode);
  }
  syncAddButton() {
    const existing = this.toolbarEl.querySelector(".toolbar-add-btn");
    if (this.editMode && !existing) {
      this.appendAddButton();
    } else if (!this.editMode && existing) {
      existing.remove();
    }
  }
  appendAddButton() {
    const addBtn = this.toolbarEl.createEl("button", { cls: "toolbar-add-btn", text: "+ Add Block" });
    addBtn.addEventListener("click", () => {
      this.openAddBlockModal();
    });
  }
  /** Opens the Add Block modal. Called from toolbar button and empty state CTA. */
  openAddBlockModal() {
    new AddBlockModal(this.app, (type) => {
      const factory = BlockRegistry.get(type);
      if (!factory) return;
      const maxRow = this.plugin.layout.blocks.reduce(
        (max, b) => Math.max(max, b.row + b.rowSpan - 1),
        0
      );
      const instance = {
        id: crypto.randomUUID(),
        type,
        col: 1,
        row: maxRow + 1,
        colSpan: Math.min(factory.defaultSize.colSpan, this.plugin.layout.columns),
        rowSpan: factory.defaultSize.rowSpan,
        config: { ...factory.defaultConfig }
      };
      this.grid.addBlock(instance);
    }).open();
  }
  getElement() {
    return this.toolbarEl;
  }
  destroy() {
    this.toolbarEl.remove();
  }
};
var BLOCK_META = {
  "greeting": { icon: "\u{1F44B}", desc: "Personalized greeting with time of day" },
  "clock": { icon: "\u{1F550}", desc: "Live clock with date display" },
  "folder-links": { icon: "\u{1F517}", desc: "Quick links to notes and folders" },
  "insight": { icon: "\u{1F4A1}", desc: "Daily rotating note from a tag" },
  "tag-grid": { icon: "\u{1F3F7}\uFE0F", desc: "Grid of labeled value buttons" },
  "quotes-list": { icon: "\u{1F4AC}", desc: "Collection of quotes from notes" },
  "image-gallery": { icon: "\u{1F5BC}\uFE0F", desc: "Photo grid from a vault folder" },
  "embedded-note": { icon: "\u{1F4C4}", desc: "Render a note inline on the page" },
  "static-text": { icon: "\u{1F4DD}", desc: "Markdown text block you write directly" },
  "html": { icon: "</>", desc: "Custom HTML content (sanitized)" }
};
var AddBlockModal = class extends import_obsidian2.Modal {
  constructor(app, onSelect) {
    super(app);
    this.onSelect = onSelect;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Block", cls: "add-block-modal-title" });
    const grid = contentEl.createDiv({ cls: "add-block-grid" });
    for (const factory of BlockRegistry.getAll()) {
      const meta = BLOCK_META[factory.type];
      const btn = grid.createEl("button", { cls: "add-block-option" });
      btn.createSpan({ cls: "add-block-icon", text: (_a = meta == null ? void 0 : meta.icon) != null ? _a : "\u25AA" });
      btn.createSpan({ cls: "add-block-name", text: factory.displayName });
      if (meta == null ? void 0 : meta.desc) {
        btn.createSpan({ cls: "add-block-desc", text: meta.desc });
      }
      btn.addEventListener("click", () => {
        this.onSelect(factory.type);
        this.close();
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/HomepageView.ts
var VIEW_TYPE = "homepage-blocks";
var HomepageView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.grid = null;
    this.toolbar = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Homepage";
  }
  getIcon() {
    return "home";
  }
  async onOpen() {
    var _a, _b;
    (_a = this.grid) == null ? void 0 : _a.destroy();
    (_b = this.toolbar) == null ? void 0 : _b.destroy();
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("homepage-view");
    const layout = this.plugin.layout;
    const onLayoutChange = (newLayout) => {
      this.plugin.layout = newLayout;
      void this.plugin.saveLayout(newLayout);
    };
    this.grid = new GridLayout(contentEl, this.app, this.plugin, onLayoutChange);
    this.toolbar = new EditToolbar(
      contentEl,
      this.app,
      this.plugin,
      this.grid,
      (columns) => {
        var _a2;
        (_a2 = this.grid) == null ? void 0 : _a2.setColumns(columns);
      }
    );
    contentEl.insertBefore(this.toolbar.getElement(), this.grid.getElement());
    this.grid.render(layout.blocks, layout.columns);
  }
  async onClose() {
    var _a, _b;
    (_a = this.grid) == null ? void 0 : _a.destroy();
    (_b = this.toolbar) == null ? void 0 : _b.destroy();
  }
  /** Re-render the view from scratch (e.g. after settings reset). */
  async reload() {
    await this.onOpen();
  }
};

// src/blocks/GreetingBlock.ts
var import_obsidian5 = require("obsidian");

// src/blocks/BaseBlock.ts
var import_obsidian4 = require("obsidian");
var BaseBlock = class extends import_obsidian4.Component {
  constructor(app, instance, plugin) {
    super();
    this.app = app;
    this.instance = instance;
    this.plugin = plugin;
    this._headerContainer = null;
  }
  // Override to open a per-block settings modal
  openSettings(_onSave) {
  }
  // Called by GridLayout to redirect renderHeader output outside block-content.
  setHeaderContainer(el) {
    this._headerContainer = el;
  }
  // Render the muted uppercase block header label.
  // Respects _hideTitle, _titleLabel, and _titleEmoji from instance.config.
  // Renders into the header container set by GridLayout (if any), else falls back to el.
  renderHeader(el, title) {
    var _a;
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = typeof cfg._titleLabel === "string" && cfg._titleLabel.trim() ? cfg._titleLabel.trim() : title;
    if (!label) return;
    const container = (_a = this._headerContainer) != null ? _a : el;
    const header = container.createDiv({ cls: "block-header" });
    if (typeof cfg._titleEmoji === "string" && cfg._titleEmoji) {
      header.createSpan({ cls: "block-header-emoji", text: cfg._titleEmoji });
    }
    header.createSpan({ text: label });
  }
};

// src/blocks/GreetingBlock.ts
var GreetingBlock = class extends BaseBlock {
  constructor() {
    super(...arguments);
    this.timeEl = null;
    this.nameEl = null;
  }
  render(el) {
    el.addClass("greeting-block");
    const { showTime = true } = this.instance.config;
    if (showTime) {
      this.timeEl = el.createDiv({ cls: "greeting-time" });
    }
    this.nameEl = el.createDiv({ cls: "greeting-name" });
    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 1e3));
  }
  tick() {
    const now = (0, import_obsidian5.moment)();
    const hour = now.hour();
    const { name = "bentornato", showTime = true } = this.instance.config;
    const salutation = hour >= 5 && hour < 12 ? "Buongiorno" : hour >= 12 && hour < 18 ? "Buon pomeriggio" : "Buonasera";
    if (this.timeEl && showTime) {
      this.timeEl.setText(now.format("HH:mm"));
    }
    if (this.nameEl) {
      this.nameEl.setText(`${salutation}, ${name}`);
    }
  }
  openSettings(onSave) {
    new GreetingSettingsModal(this.app, this.instance.config, (newConfig) => {
      this.instance.config = newConfig;
      onSave();
    }).open();
  }
};
var GreetingSettingsModal = class extends import_obsidian5.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Greeting Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian5.Setting(contentEl).setName("Name").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.name) != null ? _a : "bentornato").onChange((v) => {
          draft.name = v;
        });
      }
    );
    new import_obsidian5.Setting(contentEl).setName("Show time").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.showTime) != null ? _a : true).onChange((v) => {
          draft.showTime = v;
        });
      }
    );
    new import_obsidian5.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ClockBlock.ts
var import_obsidian6 = require("obsidian");
var ClockBlock = class extends BaseBlock {
  constructor() {
    super(...arguments);
    this.timeEl = null;
    this.dateEl = null;
  }
  render(el) {
    el.addClass("clock-block");
    const { showDate = true } = this.instance.config;
    this.timeEl = el.createDiv({ cls: "clock-time" });
    if (showDate) {
      this.dateEl = el.createDiv({ cls: "clock-date" });
    }
    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 1e3));
  }
  tick() {
    const now = (0, import_obsidian6.moment)();
    const { showSeconds = false, showDate = true, format = "" } = this.instance.config;
    if (this.timeEl) {
      if (format) {
        this.timeEl.setText(now.format(format));
      } else {
        this.timeEl.setText(now.format(showSeconds ? "HH:mm:ss" : "HH:mm"));
      }
    }
    if (this.dateEl && showDate) {
      this.dateEl.setText(now.format("dddd, D MMMM YYYY"));
    }
  }
  openSettings(onSave) {
    new ClockSettingsModal(this.app, this.instance.config, (newConfig) => {
      this.instance.config = newConfig;
      onSave();
    }).open();
  }
};
var ClockSettingsModal = class extends import_obsidian6.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Clock Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian6.Setting(contentEl).setName("Show seconds").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.showSeconds) != null ? _a : false).onChange((v) => {
          draft.showSeconds = v;
        });
      }
    );
    new import_obsidian6.Setting(contentEl).setName("Show date").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.showDate) != null ? _a : true).onChange((v) => {
          draft.showDate = v;
        });
      }
    );
    new import_obsidian6.Setting(contentEl).setName("Custom format").setDesc('Optional moment.js format string, e.g. "HH:mm". Leave empty for default.').addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.format) != null ? _a : "").onChange((v) => {
          draft.format = v;
        });
      }
    );
    new import_obsidian6.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/FolderLinksBlock.ts
var import_obsidian7 = require("obsidian");
var FolderSuggestModal = class extends import_obsidian7.SuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to search vault folders\u2026");
  }
  getAllFolders() {
    const folders = [];
    const recurse = (f) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof import_obsidian7.TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    return folders;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.getAllFolders().filter((f) => f.path.toLowerCase().includes(q));
  }
  renderSuggestion(folder, el) {
    el.createEl("span", { text: folder.path === "/" ? "/ (vault root)" : folder.path });
  }
  onChooseSuggestion(folder) {
    this.onChoose(folder);
  }
};
var FolderLinksBlock = class extends BaseBlock {
  constructor() {
    super(...arguments);
    this.containerEl = null;
    this.renderTimer = null;
  }
  render(el) {
    this.containerEl = el;
    el.addClass("folder-links-block");
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRender()));
    this.app.workspace.onLayoutReady(() => this.renderContent());
  }
  scheduleRender() {
    if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.renderContent();
    }, 150);
  }
  renderContent() {
    const el = this.containerEl;
    if (!el) return;
    el.empty();
    const { title = "Quick Links", folder = "", links = [] } = this.instance.config;
    this.renderHeader(el, title);
    const list = el.createDiv({ cls: "folder-links-list" });
    if (folder) {
      const normalised = folder.trim().replace(/\/+$/, "");
      if (!normalised) {
        list.createEl("p", { text: "Vault root listing is not supported. Select a subfolder.", cls: "block-loading" });
      } else {
        const folderObj = this.app.vault.getAbstractFileByPath(normalised);
        if (!(folderObj instanceof import_obsidian7.TFolder)) {
          list.createEl("p", { text: `Folder "${normalised}" not found.`, cls: "block-loading" });
        } else {
          const prefix = folderObj.path + "/";
          const notes = this.app.vault.getFiles().filter((f) => f.path.startsWith(prefix)).sort((a, b) => a.basename.localeCompare(b.basename));
          for (const file of notes) {
            const item = list.createDiv({ cls: "folder-link-item" });
            const btn = item.createEl("button", { cls: "folder-link-btn" });
            btn.createSpan({ text: file.basename });
            btn.addEventListener("click", () => {
              this.app.workspace.openLinkText(file.path, "");
            });
          }
          if (notes.length === 0) {
            list.createEl("p", { text: `No notes in "${folderObj.path}".`, cls: "block-loading" });
          }
        }
      }
    }
    for (const link of links) {
      const item = list.createDiv({ cls: "folder-link-item" });
      const btn = item.createEl("button", { cls: "folder-link-btn" });
      if (link.emoji) {
        btn.createSpan({ cls: "link-emoji", text: link.emoji });
      }
      btn.createSpan({ text: link.label });
      btn.addEventListener("click", () => {
        this.app.workspace.openLinkText(link.path, "");
      });
    }
    if (!folder && links.length === 0) {
      const hint = list.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F517}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No links yet. Add manual links or pick a folder in settings." });
    }
  }
  openSettings(onSave) {
    new FolderLinksSettingsModal(
      this.app,
      this.instance.config,
      (newConfig) => {
        this.instance.config = newConfig;
        this.renderContent();
        onSave();
      }
    ).open();
  }
};
var FolderLinksSettingsModal = class extends import_obsidian7.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Quick Links Settings" });
    const draft = structuredClone(this.config);
    (_a = draft.links) != null ? _a : draft.links = [];
    const links = draft.links;
    new import_obsidian7.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = draft.title) != null ? _a2 : "Quick Links").onChange((v) => {
          draft.title = v;
        });
      }
    );
    let folderText;
    new import_obsidian7.Setting(contentEl).setName("Auto-list folder").setDesc("List all notes from this vault folder as links.").addText((t) => {
      var _a2;
      folderText = t;
      t.setValue((_a2 = draft.folder) != null ? _a2 : "").setPlaceholder("e.g. Projects").onChange((v) => {
        draft.folder = v;
      });
    }).addButton(
      (btn) => btn.setIcon("folder").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal(this.app, (folder) => {
          const path = folder.path === "/" ? "" : folder.path;
          draft.folder = path;
          folderText.setValue(path);
        }).open();
      })
    );
    contentEl.createEl("h3", { text: "Manual links" });
    const linksContainer = contentEl.createDiv();
    const renderLinks = () => {
      linksContainer.empty();
      links.forEach((link, i) => {
        const row = linksContainer.createDiv({ cls: "settings-link-row" });
        new import_obsidian7.Setting(row).setName(`Link ${i + 1}`).addText((t) => t.setPlaceholder("Label").setValue(link.label).onChange((v) => {
          links[i].label = v;
        })).addText((t) => t.setPlaceholder("Path").setValue(link.path).onChange((v) => {
          links[i].path = v;
        })).addText((t) => {
          var _a2;
          return t.setPlaceholder("Emoji").setValue((_a2 = link.emoji) != null ? _a2 : "").onChange((v) => {
            links[i].emoji = v || void 0;
          });
        }).addButton((btn) => btn.setIcon("trash").setTooltip("Remove").onClick(() => {
          links.splice(i, 1);
          renderLinks();
        }));
      });
    };
    renderLinks();
    new import_obsidian7.Setting(contentEl).addButton((btn) => btn.setButtonText("Add Link").onClick(() => {
      links.push({ label: "", path: "" });
      renderLinks();
    })).addButton((btn) => btn.setButtonText("Save").setCta().onClick(() => {
      this.onSave(draft);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/InsightBlock.ts
var import_obsidian8 = require("obsidian");

// src/utils/tags.ts
function getFilesWithTag(app, tag) {
  return app.vault.getMarkdownFiles().filter((file) => {
    var _a, _b, _c;
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return false;
    const inlineTags = (_b = (_a = cache.tags) == null ? void 0 : _a.map((t) => t.tag)) != null ? _b : [];
    const rawFmTags = (_c = cache.frontmatter) == null ? void 0 : _c.tags;
    const fmTagArray = Array.isArray(rawFmTags) ? rawFmTags.filter((t) => typeof t === "string") : typeof rawFmTags === "string" ? [rawFmTags] : [];
    const normalizedFmTags = fmTagArray.map((t) => t.startsWith("#") ? t : `#${t}`);
    return inlineTags.includes(tag) || normalizedFmTags.includes(tag);
  });
}

// src/blocks/InsightBlock.ts
var MS_PER_DAY = 864e5;
var InsightBlock = class extends BaseBlock {
  render(el) {
    el.addClass("insight-block");
    this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] InsightBlock failed to render:", e);
      el.setText("Error loading insight. Check console for details.");
    });
  }
  async loadAndRender(el) {
    const { tag = "", title = "Daily Insight", dailySeed = true } = this.instance.config;
    this.renderHeader(el, title);
    const card = el.createDiv({ cls: "insight-card" });
    if (!tag) {
      const hint = card.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4A1}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No tag configured. Add a tag in settings to show a daily rotating note." });
      return;
    }
    const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch);
    if (files.length === 0) {
      card.setText(`No files found with tag ${tagSearch}`);
      return;
    }
    const dayIndex = Math.floor((0, import_obsidian8.moment)().startOf("day").valueOf() / MS_PER_DAY);
    const index = dailySeed ? dayIndex % files.length : Math.floor(Math.random() * files.length);
    const file = files[index];
    const cache = this.app.metadataCache.getFileCache(file);
    try {
      const content = await this.app.vault.read(file);
      const { heading, body } = this.parseContent(content, cache);
      card.createDiv({ cls: "insight-title", text: heading || file.basename });
      card.createDiv({ cls: "insight-body", text: body });
    } catch (e) {
      console.error("[Homepage Blocks] InsightBlock failed to read file:", e);
      card.setText("Error reading file.");
    }
  }
  /**
   * Extract the first heading and first paragraph using metadataCache offsets.
   * Falls back to manual parsing only if cache is unavailable.
   */
  parseContent(content, cache) {
    var _a, _b, _c, _d, _e, _f;
    const heading = (_c = (_b = (_a = cache == null ? void 0 : cache.headings) == null ? void 0 : _a[0]) == null ? void 0 : _b.heading) != null ? _c : "";
    const fmEnd = (_e = (_d = cache == null ? void 0 : cache.frontmatterPosition) == null ? void 0 : _d.end.offset) != null ? _e : 0;
    const afterFm = content.slice(fmEnd);
    const body = (_f = afterFm.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"))) != null ? _f : "";
    return { heading, body };
  }
  openSettings(onSave) {
    new InsightSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var InsightSettingsModal = class extends import_obsidian8.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Insight Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian8.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.title) != null ? _a : "Daily Insight").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.tag) != null ? _a : "").onChange((v) => {
          draft.tag = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).setName("Daily seed").setDesc("Show same note all day").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.dailySeed) != null ? _a : true).onChange((v) => {
          draft.dailySeed = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/TagGridBlock.ts
var import_obsidian9 = require("obsidian");
var TagGridBlock = class extends BaseBlock {
  render(el) {
    el.addClass("tag-grid-block");
    const { title = "Values", columns = 2, items = [] } = this.instance.config;
    this.renderHeader(el, title);
    const grid = el.createDiv({ cls: "tag-grid" });
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    if (items.length === 0) {
      const hint = grid.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F3F7}\uFE0F" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No items yet. Add values with emojis and labels in settings." });
      return;
    }
    for (const item of items) {
      const btn = grid.createEl("button", { cls: "tag-btn" });
      if (item.emoji) {
        btn.createSpan({ cls: "tag-btn-emoji", text: item.emoji });
      }
      btn.createSpan({ text: item.label });
      if (item.link) {
        btn.addEventListener("click", () => {
          this.app.workspace.openLinkText(item.link, "");
        });
      } else {
        btn.style.cursor = "default";
      }
    }
  }
  openSettings(onSave) {
    new ValuesSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var ValuesSettingsModal = class extends import_obsidian9.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Values Settings" });
    const draft = structuredClone(this.config);
    if (!Array.isArray(draft.items)) draft.items = [];
    new import_obsidian9.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.title) != null ? _a : "Values").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("1", "1").addOption("2", "2").addOption("3", "3").setValue(String((_a = draft.columns) != null ? _a : 2)).onChange((v) => {
          draft.columns = Number(v);
        });
      }
    );
    contentEl.createEl("p", { text: "Items", cls: "setting-item-name" });
    const listEl = contentEl.createDiv({ cls: "values-item-list" });
    const renderList = () => {
      listEl.empty();
      draft.items.forEach((item, i) => {
        var _a;
        const row = listEl.createDiv({ cls: "values-item-row" });
        const emojiInput = row.createEl("input", { type: "text", cls: "values-item-emoji" });
        emojiInput.value = item.emoji;
        emojiInput.placeholder = "\u{1F600}";
        emojiInput.addEventListener("input", () => {
          item.emoji = emojiInput.value;
        });
        const labelInput = row.createEl("input", { type: "text", cls: "values-item-label" });
        labelInput.value = item.label;
        labelInput.placeholder = "Label";
        labelInput.addEventListener("input", () => {
          item.label = labelInput.value;
        });
        const linkInput = row.createEl("input", { type: "text", cls: "values-item-link" });
        linkInput.value = (_a = item.link) != null ? _a : "";
        linkInput.placeholder = "Note path (optional)";
        linkInput.addEventListener("input", () => {
          item.link = linkInput.value || void 0;
        });
        const delBtn = row.createEl("button", { cls: "values-item-del", text: "\u2715" });
        delBtn.addEventListener("click", () => {
          draft.items.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();
    new import_obsidian9.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("+ Add item").onClick(() => {
        draft.items.push({ emoji: "", label: "" });
        renderList();
      })
    );
    new import_obsidian9.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/QuotesListBlock.ts
var import_obsidian10 = require("obsidian");
var COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([^)]+\)|hsla?\([^)]+\))$/;
var QuotesListBlock = class extends BaseBlock {
  render(el) {
    el.addClass("quotes-list-block");
    this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] QuotesListBlock failed to render:", e);
      el.setText("Error loading quotes. Check console for details.");
    });
  }
  async loadAndRender(el) {
    var _a, _b;
    const { source = "tag", tag = "", quotes = "", title = "Quotes", columns = 2, maxItems = 20 } = this.instance.config;
    this.renderHeader(el, title);
    const colsEl = el.createDiv({ cls: "quotes-columns" });
    const MIN_COL_WIDTH = 200;
    const updateCols = () => {
      const w = colsEl.offsetWidth;
      const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / MIN_COL_WIDTH))) : columns;
      colsEl.style.gridTemplateColumns = `repeat(${effective}, 1fr)`;
    };
    updateCols();
    const ro = new ResizeObserver(updateCols);
    ro.observe(colsEl);
    this.register(() => ro.disconnect());
    if (source === "text") {
      this.renderTextQuotes(colsEl, quotes, maxItems);
      return;
    }
    if (!tag) {
      const hint = colsEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No tag configured. Add a tag in settings to pull quotes from your notes." });
      return;
    }
    const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch).slice(0, maxItems);
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        return { file, content, cache };
      })
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[Homepage Blocks] QuotesListBlock failed to read file:", result.reason);
        continue;
      }
      const { file, content, cache } = result.value;
      const color = (_b = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.color) != null ? _b : "";
      const body = this.extractBody(content, cache);
      if (!body) continue;
      const item = colsEl.createDiv({ cls: "quote-item" });
      const quote = item.createEl("blockquote", { cls: "quote-content", text: body });
      if (color && COLOR_RE.test(color)) {
        quote.style.borderLeftColor = color;
        quote.style.color = color;
      }
      item.createDiv({ cls: "quote-source", text: file.basename });
    }
  }
  /**
   * Render quotes from plain text. Each quote is separated by `---` on its own line.
   * Optionally a source line can follow the quote text, prefixed with `—`, `–`, or `--`.
   *
   * Example:
   *   The only way to do great work is to love what you do.
   *   — Steve Jobs
   *   ---
   *   In the middle of difficulty lies opportunity.
   *   — Albert Einstein
   */
  renderTextQuotes(colsEl, raw, maxItems) {
    if (!raw.trim()) {
      const hint = colsEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No quotes yet. Add them in settings, separated by ---." });
      return;
    }
    const blocks = raw.split(/\n---\n/).map((b) => b.trim()).filter(Boolean).slice(0, maxItems);
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1];
      const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
      const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, "") : "";
      const bodyLines = hasSource ? lines.slice(0, -1) : lines;
      const body = bodyLines.join(" ");
      if (!body) continue;
      const item = colsEl.createDiv({ cls: "quote-item" });
      item.createEl("blockquote", { cls: "quote-content", text: body });
      if (sourceText) item.createDiv({ cls: "quote-source", text: sourceText });
    }
  }
  /** Extract the first few lines of body content using metadataCache frontmatter offset. */
  extractBody(content, cache) {
    var _a, _b;
    const fmEnd = (_b = (_a = cache == null ? void 0 : cache.frontmatterPosition) == null ? void 0 : _a.end.offset) != null ? _b : 0;
    const afterFm = content.slice(fmEnd);
    const lines = afterFm.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    return lines.slice(0, 3).join(" ");
  }
  openSettings(onSave) {
    new QuotesSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var QuotesSettingsModal = class extends import_obsidian10.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    var _a, _b;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Quotes List Settings" });
    const draft = structuredClone(this.config);
    (_a = draft.source) != null ? _a : draft.source = "tag";
    new import_obsidian10.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = draft.title) != null ? _a2 : "Quotes").onChange((v) => {
          draft.title = v;
        });
      }
    );
    let tagSection;
    let textSection;
    new import_obsidian10.Setting(contentEl).setName("Source").setDesc("Pull quotes from tagged notes, or enter them manually.").addDropdown(
      (d) => {
        var _a2;
        return d.addOption("tag", "Notes with tag").addOption("text", "Manual text").setValue((_a2 = draft.source) != null ? _a2 : "tag").onChange((v) => {
          draft.source = v;
          tagSection.style.display = v === "tag" ? "" : "none";
          textSection.style.display = v === "text" ? "" : "none";
        });
      }
    );
    tagSection = contentEl.createDiv();
    tagSection.style.display = draft.source === "tag" ? "" : "none";
    new import_obsidian10.Setting(tagSection).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = draft.tag) != null ? _a2 : "").onChange((v) => {
          draft.tag = v;
        });
      }
    );
    textSection = contentEl.createDiv();
    textSection.style.display = draft.source === "text" ? "" : "none";
    const textSetting = new import_obsidian10.Setting(textSection).setName("Quotes").setDesc("Separate quotes with --- on its own line. Add a source line starting with \u2014 (e.g. \u2014 Author).");
    textSetting.settingEl.style.flexDirection = "column";
    textSetting.settingEl.style.alignItems = "stretch";
    const textarea = textSetting.settingEl.createEl("textarea");
    textarea.rows = 8;
    textarea.style.width = "100%";
    textarea.style.marginTop = "8px";
    textarea.style.fontFamily = "var(--font-monospace)";
    textarea.style.fontSize = "12px";
    textarea.value = (_b = draft.quotes) != null ? _b : "";
    textarea.addEventListener("input", () => {
      draft.quotes = textarea.value;
    });
    new import_obsidian10.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a2;
        return d.addOption("2", "2").addOption("3", "3").setValue(String((_a2 = draft.columns) != null ? _a2 : 2)).onChange((v) => {
          draft.columns = Number(v);
        });
      }
    );
    new import_obsidian10.Setting(contentEl).setName("Max items").addText(
      (t) => {
        var _a2;
        return t.setValue(String((_a2 = draft.maxItems) != null ? _a2 : 20)).onChange((v) => {
          draft.maxItems = parseInt(v) || 20;
        });
      }
    );
    new import_obsidian10.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ImageGalleryBlock.ts
var import_obsidian11 = require("obsidian");
var FolderSuggestModal2 = class extends import_obsidian11.SuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to search vault folders\u2026");
  }
  getAllFolders() {
    const folders = [];
    const recurse = (f) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof import_obsidian11.TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    return folders;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.getAllFolders().filter(
      (f) => f.path.toLowerCase().includes(q)
    );
  }
  renderSuggestion(folder, el) {
    el.createEl("span", { text: folder.path === "/" ? "/ (vault root)" : folder.path });
  }
  onChooseSuggestion(folder) {
    this.onChoose(folder);
  }
};
var IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
var VIDEO_EXTS = /* @__PURE__ */ new Set([".mp4", ".webm", ".mov", ".mkv"]);
var ImageGalleryBlock = class extends BaseBlock {
  render(el) {
    el.addClass("image-gallery-block");
    this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] ImageGalleryBlock failed to render:", e);
      el.setText("Error loading gallery. Check console for details.");
    });
  }
  async loadAndRender(el) {
    const { folder = "", title = "Gallery", columns = 3, maxItems = 20, layout = "grid" } = this.instance.config;
    this.renderHeader(el, title);
    const gallery = el.createDiv({ cls: "image-gallery" });
    if (layout === "masonry") {
      gallery.addClass("masonry-layout");
      const updateCols = () => {
        const w = gallery.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / 100))) : columns;
        gallery.style.columns = String(effective);
      };
      updateCols();
      const ro = new ResizeObserver(updateCols);
      ro.observe(gallery);
      this.register(() => ro.disconnect());
    } else {
      gallery.style.gridTemplateColumns = `repeat(auto-fill, minmax(max(70px, calc(100% / ${columns})), 1fr))`;
    }
    if (!folder) {
      const hint = gallery.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F5BC}\uFE0F" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No folder selected. Pick an image folder in settings to display a gallery." });
      return;
    }
    const folderObj = this.app.vault.getAbstractFileByPath(folder);
    if (!(folderObj instanceof import_obsidian11.TFolder)) {
      gallery.setText(`Folder "${folder}" not found.`);
      return;
    }
    const files = this.getMediaFiles(folderObj).slice(0, maxItems);
    for (const file of files) {
      const ext = `.${file.extension.toLowerCase()}`;
      const wrapper = gallery.createDiv({ cls: "gallery-item" });
      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl("img");
        img.src = this.app.vault.getResourcePath(file);
        img.loading = "lazy";
        img.addEventListener("click", () => {
          this.app.workspace.openLinkText(file.path, "");
        });
      } else if (VIDEO_EXTS.has(ext)) {
        wrapper.addClass("gallery-item-video");
        wrapper.createDiv({ cls: "video-play-overlay", text: "\u25B6" });
        const video = wrapper.createEl("video");
        video.src = this.app.vault.getResourcePath(file);
        video.muted = true;
        video.loop = true;
        video.setAttribute("playsinline", "");
        video.preload = "metadata";
        wrapper.addEventListener("mouseenter", () => {
          void video.play();
        });
        wrapper.addEventListener("mouseleave", () => {
          video.pause();
          video.currentTime = 0;
        });
        wrapper.addEventListener("click", () => {
          this.app.workspace.openLinkText(file.path, "");
        });
      }
    }
  }
  getMediaFiles(folder) {
    const files = [];
    const recurse = (f) => {
      for (const child of f.children) {
        if (child instanceof import_obsidian11.TFile) {
          const ext = `.${child.extension.toLowerCase()}`;
          if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
            files.push(child);
          }
        } else if (child instanceof import_obsidian11.TFolder) {
          recurse(child);
        }
      }
    };
    recurse(folder);
    return files;
  }
  openSettings(onSave) {
    new ImageGallerySettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var ImageGallerySettingsModal = class extends import_obsidian11.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Image Gallery Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian11.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.title) != null ? _a : "Gallery").onChange((v) => {
          draft.title = v;
        });
      }
    );
    let folderText;
    new import_obsidian11.Setting(contentEl).setName("Folder").setDesc("Pick a vault folder.").addText((t) => {
      var _a;
      folderText = t;
      t.setValue((_a = draft.folder) != null ? _a : "").setPlaceholder("Attachments/Photos").onChange((v) => {
        draft.folder = v;
      });
    }).addButton(
      (btn) => btn.setIcon("folder").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal2(this.app, (folder) => {
          const path = folder.path === "/" ? "" : folder.path;
          draft.folder = path;
          folderText.setValue(path);
        }).open();
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Layout").addDropdown(
      (d) => {
        var _a;
        return d.addOption("grid", "Grid").addOption("masonry", "Masonry").setValue(String((_a = draft.layout) != null ? _a : "grid")).onChange((v) => {
          draft.layout = v;
        });
      }
    );
    new import_obsidian11.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").addOption("4", "4").setValue(String((_a = draft.columns) != null ? _a : 3)).onChange((v) => {
          draft.columns = Number(v);
        });
      }
    );
    new import_obsidian11.Setting(contentEl).setName("Max items").addText(
      (t) => {
        var _a;
        return t.setValue(String((_a = draft.maxItems) != null ? _a : 20)).onChange((v) => {
          draft.maxItems = parseInt(v) || 20;
        });
      }
    );
    new import_obsidian11.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/EmbeddedNoteBlock.ts
var import_obsidian12 = require("obsidian");
var DEBOUNCE_MS = 300;
var EmbeddedNoteBlock = class extends BaseBlock {
  constructor() {
    super(...arguments);
    this.containerEl = null;
    this.debounceTimer = null;
  }
  render(el) {
    this.containerEl = el;
    el.addClass("embedded-note-block");
    this.renderContent(el).catch((e) => {
      console.error("[Homepage Blocks] EmbeddedNoteBlock failed to render:", e);
      el.setText("Error rendering file. Check console for details.");
    });
    this.registerEvent(
      this.app.vault.on("modify", (modFile) => {
        const { filePath = "" } = this.instance.config;
        if (modFile.path === filePath && this.containerEl) {
          if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
          }
          const target = this.containerEl;
          this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            this.renderContent(target).catch((e) => {
              console.error("[Homepage Blocks] EmbeddedNoteBlock failed to re-render after modify:", e);
            });
          }, DEBOUNCE_MS);
        }
      })
    );
  }
  onunload() {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
  async renderContent(el) {
    const { filePath = "", showTitle = true } = this.instance.config;
    el.empty();
    if (!filePath) {
      const hint = el.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4C4}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No note selected. Choose a file path in settings to embed it here." });
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian12.TFile)) {
      el.setText(`File not found: ${filePath}`);
      return;
    }
    if (showTitle) {
      this.renderHeader(el, file.basename);
    }
    const contentEl = el.createDiv({ cls: "embedded-note-content" });
    try {
      const content = await this.app.vault.read(file);
      await import_obsidian12.MarkdownRenderer.render(this.app, content, contentEl, file.path, this);
    } catch (e) {
      console.error("[Homepage Blocks] EmbeddedNoteBlock MarkdownRenderer failed:", e);
      contentEl.setText("Error rendering file.");
    }
  }
  openSettings(onSave) {
    new EmbeddedNoteSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var EmbeddedNoteSettingsModal = class extends import_obsidian12.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Embedded Note Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian12.Setting(contentEl).setName("File path").setDesc("Vault path to the note (e.g. Notes/MyNote.md)").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.filePath) != null ? _a : "").onChange((v) => {
          draft.filePath = v;
        });
      }
    );
    new import_obsidian12.Setting(contentEl).setName("Show title").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.showTitle) != null ? _a : true).onChange((v) => {
          draft.showTitle = v;
        });
      }
    );
    new import_obsidian12.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/StaticTextBlock.ts
var import_obsidian13 = require("obsidian");
var StaticTextBlock = class extends BaseBlock {
  render(el) {
    el.addClass("static-text-block");
    this.renderContent(el).catch((e) => {
      console.error("[Homepage Blocks] StaticTextBlock failed to render:", e);
      el.setText("Error rendering content.");
    });
  }
  async renderContent(el) {
    const { title = "", content = "" } = this.instance.config;
    el.empty();
    if (title) {
      this.renderHeader(el, title);
    }
    const contentEl = el.createDiv({ cls: "static-text-content" });
    if (!content) {
      const hint = contentEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4DD}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No content yet. Add Markdown text in settings." });
      return;
    }
    await import_obsidian13.MarkdownRenderer.render(this.app, content, contentEl, "", this);
  }
  openSettings(onSave) {
    new StaticTextSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var StaticTextSettingsModal = class extends import_obsidian13.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Static Text Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian13.Setting(contentEl).setName("Block title").setDesc("Optional header shown above the text.").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = draft.title) != null ? _a2 : "").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian13.Setting(contentEl).setName("Content").setDesc("Supports Markdown.");
    const textarea = contentEl.createEl("textarea", { cls: "static-text-settings-textarea" });
    textarea.value = (_a = draft.content) != null ? _a : "";
    textarea.rows = 10;
    textarea.addEventListener("input", () => {
      draft.content = textarea.value;
    });
    new import_obsidian13.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/HtmlBlock.ts
var import_obsidian14 = require("obsidian");
var HtmlBlock = class extends BaseBlock {
  render(el) {
    el.addClass("html-block");
    const { title = "", html = "" } = this.instance.config;
    if (title) {
      this.renderHeader(el, title);
    }
    const contentEl = el.createDiv({ cls: "html-block-content" });
    if (!html) {
      const hint = contentEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "</>" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No HTML content yet. Add your markup in settings." });
      return;
    }
    contentEl.appendChild((0, import_obsidian14.sanitizeHTMLToDom)(html));
  }
  openSettings(onSave) {
    new HtmlBlockSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var HtmlBlockSettingsModal = class extends import_obsidian14.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "HTML Block Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian14.Setting(contentEl).setName("Block title").setDesc("Optional header shown above the HTML.").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = draft.title) != null ? _a2 : "").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian14.Setting(contentEl).setName("HTML").setDesc("HTML is sanitized before rendering.");
    const textarea = contentEl.createEl("textarea", { cls: "static-text-settings-textarea" });
    textarea.value = (_a = draft.html) != null ? _a : "";
    textarea.rows = 12;
    textarea.setAttribute("spellcheck", "false");
    textarea.addEventListener("input", () => {
      draft.html = textarea.value;
    });
    new import_obsidian14.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var DEFAULT_LAYOUT_DATA = {
  columns: 3,
  openOnStartup: false,
  blocks: [
    // Row 1
    {
      id: "default-static-text",
      type: "static-text",
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      config: { title: "", content: "" }
    },
    {
      id: "default-clock",
      type: "clock",
      col: 2,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      config: { showSeconds: false, showDate: true }
    },
    {
      id: "default-folder-links",
      type: "folder-links",
      col: 3,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      config: { title: "Quick Links", links: [] }
    },
    // Row 2
    {
      id: "default-insight",
      type: "insight",
      col: 1,
      row: 2,
      colSpan: 2,
      rowSpan: 1,
      config: { tag: "", title: "Daily Insight", dailySeed: true }
    },
    {
      id: "default-tag-grid",
      type: "tag-grid",
      col: 3,
      row: 2,
      colSpan: 1,
      rowSpan: 2,
      config: { title: "Values", columns: 2, items: [] }
    },
    // Row 3
    {
      id: "default-quotes",
      type: "quotes-list",
      col: 1,
      row: 3,
      colSpan: 2,
      rowSpan: 1,
      config: { tag: "", title: "Quotes", columns: 2, maxItems: 20 }
    },
    // Row 4
    {
      id: "default-gallery",
      type: "image-gallery",
      col: 1,
      row: 4,
      colSpan: 3,
      rowSpan: 1,
      config: { folder: "", title: "Gallery", columns: 3, maxItems: 20 }
    }
  ]
};
function getDefaultLayout() {
  return structuredClone(DEFAULT_LAYOUT_DATA);
}
var VALID_BLOCK_TYPES = /* @__PURE__ */ new Set([
  "greeting",
  "folder-links",
  "insight",
  "tag-grid",
  "quotes-list",
  "image-gallery",
  "clock",
  "embedded-note",
  "static-text",
  "html"
]);
function isValidBlockInstance(b) {
  if (!b || typeof b !== "object") return false;
  const block = b;
  return typeof block.id === "string" && typeof block.type === "string" && VALID_BLOCK_TYPES.has(block.type) && typeof block.col === "number" && block.col >= 1 && typeof block.row === "number" && block.row >= 1 && typeof block.colSpan === "number" && block.colSpan >= 1 && typeof block.rowSpan === "number" && block.rowSpan >= 1 && block.config !== null && typeof block.config === "object" && !Array.isArray(block.config);
}
function validateLayout(raw) {
  const defaults = getDefaultLayout();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const r = raw;
  const columns = typeof r.columns === "number" && [2, 3, 4].includes(r.columns) ? r.columns : defaults.columns;
  const openOnStartup = typeof r.openOnStartup === "boolean" ? r.openOnStartup : defaults.openOnStartup;
  const blocks = Array.isArray(r.blocks) ? r.blocks.filter(isValidBlockInstance) : defaults.blocks;
  return { columns, openOnStartup, blocks };
}
function registerBlocks() {
  BlockRegistry.clear();
  BlockRegistry.register({
    type: "greeting",
    displayName: "Greeting",
    defaultConfig: { name: "World", showTime: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "clock",
    displayName: "Clock / Date",
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "folder-links",
    displayName: "Quick Links",
    defaultConfig: { title: "Quick Links", folder: "", links: [] },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "insight",
    displayName: "Daily Insight",
    defaultConfig: { tag: "", title: "Daily Insight", dailySeed: true },
    defaultSize: { colSpan: 2, rowSpan: 1 },
    create: (app, instance, plugin) => new InsightBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "tag-grid",
    displayName: "Values",
    defaultConfig: { title: "Values", columns: 2, items: [] },
    defaultSize: { colSpan: 1, rowSpan: 2 },
    create: (app, instance, plugin) => new TagGridBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "quotes-list",
    displayName: "Quotes List",
    defaultConfig: { tag: "", title: "Quotes", columns: 2, maxItems: 20 },
    defaultSize: { colSpan: 2, rowSpan: 1 },
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "image-gallery",
    displayName: "Image Gallery",
    defaultConfig: { folder: "", title: "Gallery", columns: 3, maxItems: 20 },
    defaultSize: { colSpan: 3, rowSpan: 1 },
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "embedded-note",
    displayName: "Embedded Note",
    defaultConfig: { filePath: "", showTitle: true },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "static-text",
    displayName: "Static Text",
    defaultConfig: { title: "", content: "" },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "html",
    displayName: "HTML Block",
    defaultConfig: { title: "", html: "" },
    defaultSize: { colSpan: 1, rowSpan: 1 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin)
  });
}
var HomepagePlugin = class extends import_obsidian15.Plugin {
  constructor() {
    super(...arguments);
    this.layout = getDefaultLayout();
  }
  async onload() {
    registerBlocks();
    const raw = await this.loadData();
    this.layout = validateLayout(raw);
    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));
    this.addCommand({
      id: "open-homepage",
      name: "Open Homepage",
      callback: () => {
        void this.openHomepage();
      }
    });
    this.addRibbonIcon("home", "Open Homepage", () => {
      void this.openHomepage();
    });
    this.addSettingTab(new HomepageSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      if (this.layout.openOnStartup) {
        void this.openHomepage();
      }
    });
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  async saveLayout(layout) {
    this.layout = layout;
    await this.saveData(layout);
  }
  async openHomepage() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
};
var HomepageSettingTab = class extends import_obsidian15.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Homepage Blocks" });
    new import_obsidian15.Setting(containerEl).setName("Open on startup").setDesc("Automatically open the homepage when Obsidian starts.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.openOnStartup).onChange(async (value) => {
        this.plugin.layout.openOnStartup = value;
        await this.plugin.saveLayout(this.plugin.layout);
      })
    );
    new import_obsidian15.Setting(containerEl).setName("Default columns").setDesc("Number of columns in the grid layout.").addDropdown(
      (drop) => drop.addOption("2", "2 columns").addOption("3", "3 columns").addOption("4", "4 columns").setValue(String(this.plugin.layout.columns)).onChange(async (value) => {
        this.plugin.layout.columns = Number(value);
        await this.plugin.saveLayout(this.plugin.layout);
      })
    );
    new import_obsidian15.Setting(containerEl).setName("Reset to default layout").setDesc("Restore all blocks to the original default layout. Cannot be undone.").addButton(
      (btn) => btn.setButtonText("Reset layout").setWarning().onClick(async () => {
        await this.plugin.saveLayout(getDefaultLayout());
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          if (leaf.view instanceof HomepageView) {
            await leaf.view.reload();
          }
        }
      })
    );
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdRdWljayBMaW5rcycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJ1F1aWNrIExpbmtzJywgZm9sZGVyOiAnJywgbGlua3M6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEZvbGRlckxpbmtzQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2luc2lnaHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnRGFpbHkgSW5zaWdodCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW5zaWdodEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICd0YWctZ3JpZCcsXG4gICAgZGlzcGxheU5hbWU6ICdWYWx1ZXMnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oJ2hvbWUnLCAnT3BlbiBIb21lcGFnZScsICgpID0+IHsgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpOyB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSG9tZXBhZ2VTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5sYXlvdXQub3Blbk9uU3RhcnR1cCkge1xuICAgICAgICB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbnVubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7XG4gIH1cblxuICBhc3luYyBzYXZlTGF5b3V0KGxheW91dDogTGF5b3V0Q29uZmlnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5sYXlvdXQgPSBsYXlvdXQ7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YShsYXlvdXQpO1xuICB9XG5cbiAgYXN5bmMgb3BlbkhvbWVwYWdlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcbiAgICBjb25zdCBleGlzdGluZyA9IHdvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgd29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBsZWFmID0gd29ya3NwYWNlLmdldExlYWYoJ3RhYicpO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgd29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIHRhYiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgSG9tZXBhZ2VTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIb21lcGFnZSBCbG9ja3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnT3BlbiBvbiBzdGFydHVwJylcbiAgICAgIC5zZXREZXNjKCdBdXRvbWF0aWNhbGx5IG9wZW4gdGhlIGhvbWVwYWdlIHdoZW4gT2JzaWRpYW4gc3RhcnRzLicpXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4ubGF5b3V0Lm9wZW5PblN0YXJ0dXApXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0Lm9wZW5PblN0YXJ0dXAgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQodGhpcy5wbHVnaW4ubGF5b3V0KTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdEZWZhdWx0IGNvbHVtbnMnKVxuICAgICAgLnNldERlc2MoJ051bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkIGxheW91dC4nKVxuICAgICAgLmFkZERyb3Bkb3duKGRyb3AgPT5cbiAgICAgICAgZHJvcFxuICAgICAgICAgIC5hZGRPcHRpb24oJzInLCAnMiBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCczJywgJzMgY29sdW1ucycpXG4gICAgICAgICAgLmFkZE9wdGlvbignNCcsICc0IGNvbHVtbnMnKVxuICAgICAgICAgIC5zZXRWYWx1ZShTdHJpbmcodGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zID0gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQodGhpcy5wbHVnaW4ubGF5b3V0KTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdSZXNldCB0byBkZWZhdWx0IGxheW91dCcpXG4gICAgICAuc2V0RGVzYygnUmVzdG9yZSBhbGwgYmxvY2tzIHRvIHRoZSBvcmlnaW5hbCBkZWZhdWx0IGxheW91dC4gQ2Fubm90IGJlIHVuZG9uZS4nKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1Jlc2V0IGxheW91dCcpLnNldFdhcm5pbmcoKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KGdldERlZmF1bHRMYXlvdXQoKSk7XG4gICAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKSkge1xuICAgICAgICAgICAgaWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIEhvbWVwYWdlVmlldykge1xuICAgICAgICAgICAgICBhd2FpdCBsZWFmLnZpZXcucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IElIb21lcGFnZVBsdWdpbiwgTGF5b3V0Q29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcbmltcG9ydCB7IEVkaXRUb29sYmFyIH0gZnJvbSAnLi9FZGl0VG9vbGJhcic7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnaG9tZXBhZ2UtYmxvY2tzJztcblxuZXhwb3J0IGNsYXNzIEhvbWVwYWdlVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdG9vbGJhcjogRWRpdFRvb2xiYXIgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gVklFV19UWVBFOyB9XG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7IHJldHVybiAnSG9tZXBhZ2UnOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuICdob21lJzsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBGdWxsIHRlYXJkb3duOiB1bmxvYWRzIGJsb2NrcyBBTkQgcmVtb3ZlcyB0aGUgZ3JpZCBET00gZWxlbWVudFxuICAgIHRoaXMuZ3JpZD8uZGVzdHJveSgpO1xuICAgIHRoaXMudG9vbGJhcj8uZGVzdHJveSgpO1xuXG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmFkZENsYXNzKCdob21lcGFnZS12aWV3Jyk7XG5cbiAgICBjb25zdCBsYXlvdXQ6IExheW91dENvbmZpZyA9IHRoaXMucGx1Z2luLmxheW91dDtcblxuICAgIGNvbnN0IG9uTGF5b3V0Q2hhbmdlID0gKG5ld0xheW91dDogTGF5b3V0Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5sYXlvdXQgPSBuZXdMYXlvdXQ7XG4gICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmVMYXlvdXQobmV3TGF5b3V0KTtcbiAgICB9O1xuXG4gICAgdGhpcy5ncmlkID0gbmV3IEdyaWRMYXlvdXQoY29udGVudEVsLCB0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIG9uTGF5b3V0Q2hhbmdlKTtcblxuICAgIHRoaXMudG9vbGJhciA9IG5ldyBFZGl0VG9vbGJhcihcbiAgICAgIGNvbnRlbnRFbCxcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5wbHVnaW4sXG4gICAgICB0aGlzLmdyaWQsXG4gICAgICAoY29sdW1ucykgPT4geyB0aGlzLmdyaWQ/LnNldENvbHVtbnMoY29sdW1ucyk7IH0sXG4gICAgKTtcblxuICAgIC8vIFRvb2xiYXIgbXVzdCBhcHBlYXIgYWJvdmUgdGhlIGdyaWQgaW4gdGhlIGZsZXgtY29sdW1uIGxheW91dFxuICAgIGNvbnRlbnRFbC5pbnNlcnRCZWZvcmUodGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSwgdGhpcy5ncmlkLmdldEVsZW1lbnQoKSk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogUmUtcmVuZGVyIHRoZSB2aWV3IGZyb20gc2NyYXRjaCAoZS5nLiBhZnRlciBzZXR0aW5ncyByZXNldCkuICovXG4gIGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLm9uT3BlbigpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgc2V0SWNvbiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIExheW91dENvbmZpZywgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBCbG9ja1JlZ2lzdHJ5IH0gZnJvbSAnLi9CbG9ja1JlZ2lzdHJ5JztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vYmxvY2tzL0Jhc2VCbG9jayc7XG5cbnR5cGUgTGF5b3V0Q2hhbmdlQ2FsbGJhY2sgPSAobGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJpdmF0ZSBncmlkRWw6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGJsb2NrcyA9IG5ldyBNYXA8c3RyaW5nLCB7IGJsb2NrOiBCYXNlQmxvY2s7IHdyYXBwZXI6IEhUTUxFbGVtZW50IH0+KCk7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcbiAgLyoqIEFib3J0Q29udHJvbGxlciBmb3IgdGhlIGN1cnJlbnRseSBhY3RpdmUgZHJhZyBvciByZXNpemUgb3BlcmF0aW9uLiAqL1xuICBwcml2YXRlIGFjdGl2ZUFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG4gIC8qKiBEcmFnIGNsb25lIGFwcGVuZGVkIHRvIGRvY3VtZW50LmJvZHk7IHRyYWNrZWQgc28gd2UgY2FuIHJlbW92ZSBpdCBvbiBlYXJseSB0ZWFyZG93bi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVDbG9uZTogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZXNpemVPYnNlcnZlcjogUmVzaXplT2JzZXJ2ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBlZmZlY3RpdmVDb2x1bW5zID0gMztcbiAgLyoqIENhbGxiYWNrIHRvIHRyaWdnZXIgdGhlIEFkZCBCbG9jayBtb2RhbCBmcm9tIHRoZSBlbXB0eSBzdGF0ZSBDVEEuICovXG4gIG9uUmVxdWVzdEFkZEJsb2NrOiAoKCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcbiAgLyoqIElEIG9mIHRoZSBtb3N0IHJlY2VudGx5IGFkZGVkIGJsb2NrIFx1MjAxNCB1c2VkIGZvciBzY3JvbGwtaW50by12aWV3LiAqL1xuICBwcml2YXRlIGxhc3RBZGRlZEJsb2NrSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBvbkxheW91dENoYW5nZTogTGF5b3V0Q2hhbmdlQ2FsbGJhY2ssXG4gICkge1xuICAgIHRoaXMuZ3JpZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZ3JpZCcgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7XG4gICAgICBjb25zdCBuZXdFZmZlY3RpdmUgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICAgIGlmIChuZXdFZmZlY3RpdmUgIT09IHRoaXMuZWZmZWN0aXZlQ29sdW1ucykge1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci5vYnNlcnZlKHRoaXMuZ3JpZEVsKTtcbiAgfVxuXG4gIC8qKiBFeHBvc2UgdGhlIHJvb3QgZ3JpZCBlbGVtZW50IHNvIEhvbWVwYWdlVmlldyBjYW4gcmVvcmRlciBpdCBpbiB0aGUgRE9NLiAqL1xuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5ncmlkRWw7XG4gIH1cblxuICBwcml2YXRlIGNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGxheW91dENvbHVtbnM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgdyA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoO1xuICAgIGlmICh3IDw9IDApIHJldHVybiBsYXlvdXRDb2x1bW5zO1xuICAgIGlmICh3IDw9IDU0MCkgcmV0dXJuIDE7XG4gICAgaWYgKHcgPD0gODQwKSByZXR1cm4gTWF0aC5taW4oMiwgbGF5b3V0Q29sdW1ucyk7XG4gICAgaWYgKHcgPD0gMTAyNCkgcmV0dXJuIE1hdGgubWluKDMsIGxheW91dENvbHVtbnMpO1xuICAgIHJldHVybiBsYXlvdXRDb2x1bW5zO1xuICB9XG5cbiAgcmVuZGVyKGJsb2NrczogQmxvY2tJbnN0YW5jZVtdLCBjb2x1bW5zOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdncmlkJyk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIGJsb2NrcycpO1xuICAgIHRoaXMuZWZmZWN0aXZlQ29sdW1ucyA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMoY29sdW1ucyk7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmdyaWRFbC5yZW1vdmVDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktc3RhdGUnIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktaWNvbicsIHRleHQ6ICdcXHV7MUYzRTB9JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS10aXRsZScsIHRleHQ6ICdZb3VyIGhvbWVwYWdlIGlzIGVtcHR5JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywge1xuICAgICAgICBjbHM6ICdob21lcGFnZS1lbXB0eS1kZXNjJyxcbiAgICAgICAgdGV4dDogJ0FkZCBibG9ja3MgdG8gYnVpbGQgeW91ciBwZXJzb25hbCBkYXNoYm9hcmQuIFRvZ2dsZSBFZGl0IG1vZGUgaW4gdGhlIHRvb2xiYXIgdG8gZ2V0IHN0YXJ0ZWQuJyxcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgdGhpcy5vblJlcXVlc3RBZGRCbG9jaykge1xuICAgICAgICBjb25zdCBjdGEgPSBlbXB0eS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS1jdGEnLCB0ZXh0OiAnQWRkIFlvdXIgRmlyc3QgQmxvY2snIH0pO1xuICAgICAgICBjdGEuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IHRoaXMub25SZXF1ZXN0QWRkQmxvY2s/LigpOyB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGJsb2Nrcykge1xuICAgICAgdGhpcy5yZW5kZXJCbG9jayhpbnN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldChpbnN0YW5jZS50eXBlKTtcbiAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ibG9jay13cmFwcGVyJyB9KTtcbiAgICB3cmFwcGVyLmRhdGFzZXQuYmxvY2tJZCA9IGluc3RhbmNlLmlkO1xuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2dyaWRjZWxsJyk7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBmYWN0b3J5LmRpc3BsYXlOYW1lKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvLyBIZWFkZXIgem9uZSBcdTIwMTQgYWx3YXlzIHZpc2libGU7IGhvdXNlcyB0aXRsZSArIGNvbGxhcHNlIGNoZXZyb25cbiAgICBjb25zdCBoZWFkZXJab25lID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXItem9uZScgfSk7XG4gICAgY29uc3QgY2hldnJvbiA9IGhlYWRlclpvbmUuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWNvbGxhcHNlLWNoZXZyb24nIH0pO1xuXG4gICAgY29uc3QgY29udGVudEVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1jb250ZW50JyB9KTtcbiAgICBjb25zdCBibG9jayA9IGZhY3RvcnkuY3JlYXRlKHRoaXMuYXBwLCBpbnN0YW5jZSwgdGhpcy5wbHVnaW4pO1xuICAgIGJsb2NrLnNldEhlYWRlckNvbnRhaW5lcihoZWFkZXJab25lKTtcbiAgICBibG9jay5sb2FkKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYmxvY2sucmVuZGVyKGNvbnRlbnRFbCk7XG4gICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJlc3VsdC5jYXRjaChlID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0hvbWVwYWdlIEJsb2Nrc10gRXJyb3IgcmVuZGVyaW5nIGJsb2NrICR7aW5zdGFuY2UudHlwZX06YCwgZSk7XG4gICAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgYmxvY2suIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoaW5zdGFuY2UuY29sbGFwc2VkKSB3cmFwcGVyLmFkZENsYXNzKCdibG9jay1jb2xsYXBzZWQnKTtcblxuICAgIGhlYWRlclpvbmUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGNvbnN0IGlzTm93Q29sbGFwc2VkID0gIXdyYXBwZXIuaGFzQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuICAgICAgd3JhcHBlci50b2dnbGVDbGFzcygnYmxvY2stY29sbGFwc2VkJywgaXNOb3dDb2xsYXBzZWQpO1xuICAgICAgY2hldnJvbi50b2dnbGVDbGFzcygnaXMtY29sbGFwc2VkJywgaXNOb3dDb2xsYXBzZWQpO1xuICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PlxuICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sbGFwc2VkOiBpc05vd0NvbGxhcHNlZCB9IDogYixcbiAgICAgICk7XG4gICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIH0pO1xuXG4gICAgaWYgKGluc3RhbmNlLmNvbGxhcHNlZCkgY2hldnJvbi5hZGRDbGFzcygnaXMtY29sbGFwc2VkJyk7XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbHMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGluc3RhbmNlLmNvbFNwYW4sIGNvbHMpO1xuICAgIC8vIEZvciBOIGNvbHVtbnMgdGhlcmUgYXJlIChOLTEpIGdhcHMgZGlzdHJpYnV0ZWQgYWNyb3NzIE4gc2xvdHMuXG4gICAgLy8gQSBibG9jayBzcGFubmluZyBTIGNvbHVtbnMgY292ZXJzIFMgc2xvdHMgYW5kIChTLTEpIGludGVybmFsIGdhcHMsXG4gICAgLy8gc28gaXQgbXVzdCBzdWJ0cmFjdCAoTi1TKS9OIHNoYXJlIG9mIHRoZSB0b3RhbCBnYXAgc3BhY2UuXG4gICAgLy8gRm9ybXVsYTogYmFzaXMgPSBTL04gKiAxMDAlIC0gKE4tUykvTiAqIGdhcFxuICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjb2xTcGFuIC8gY29scykgKiAxMDA7XG4gICAgY29uc3QgZ2FwRnJhY3Rpb24gPSAoY29scyAtIGNvbFNwYW4pIC8gY29scztcbiAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjb2xTcGFufSAxIGNhbGMoJHtiYXNpc1BlcmNlbnR9JSAtIHZhcigtLWhwLWdhcCwgMTZweCkgKiAke2dhcEZyYWN0aW9uLnRvRml4ZWQoNCl9KWA7XG4gICAgd3JhcHBlci5zdHlsZS5taW5XaWR0aCA9IGNvbHMgPT09IDEgPyAnMCcgOiAndmFyKC0taHAtY2FyZC1taW4td2lkdGgsIDIwMHB4KSc7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBjb25zdCBvblNhdmUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG4gICAgICBuZXcgQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCBpbnN0YW5jZSwgZW50cnkuYmxvY2ssIG9uU2F2ZSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlwID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1yZXNpemUtZ3JpcCcgfSk7XG4gICAgc2V0SWNvbihncmlwLCAnbWF4aW1pemUtMicpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgdGhpcy5hdHRhY2hSZXNpemVIYW5kbGVyKGdyaXAsIHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIHRoaXMuYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZTogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3QgY2xvbmUgPSB3cmFwcGVyLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGluc3RhbmNlLmlkO1xuICAgICAgd3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgY29uc3QgY2xlYXJJbmRpY2F0b3JzID0gKCkgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IHsgd3JhcHBlcjogdyB9IG9mIHRoaXMuYmxvY2tzLnZhbHVlcygpKSB7XG4gICAgICAgICAgdy5yZW1vdmVDbGFzcygnZHJvcC1iZWZvcmUnLCAnZHJvcC1hZnRlcicpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gYCR7bWUuY2xpZW50WCAtIHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyfXB4YDtcbiAgICAgICAgY2xvbmUuc3R5bGUudG9wID0gYCR7bWUuY2xpZW50WSAtIDIwfXB4YDtcblxuICAgICAgICBjbGVhckluZGljYXRvcnMoKTtcbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludChtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmIChwdC50YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldChwdC50YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoXG4gICAgICAgICAgICBwdC5pbnNlcnRCZWZvcmUgPyAnZHJvcC1iZWZvcmUnIDogJ2Ryb3AtYWZ0ZXInLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIGNsb25lLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcbiAgICAgICAgY2xlYXJJbmRpY2F0b3JzKCk7XG5cbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludChtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIHRoaXMucmVvcmRlckJsb2NrKHNvdXJjZUlkLCBwdC5pbnNlcnRCZWZvcmVJZCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcDogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGdyaXAuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICBjb25zdCBzdGFydFggPSBlLmNsaWVudFg7XG4gICAgICBjb25zdCBzdGFydENvbFNwYW4gPSBpbnN0YW5jZS5jb2xTcGFuO1xuICAgICAgY29uc3QgY29sdW1ucyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICAgIGNvbnN0IGNvbFdpZHRoID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGggLyBjb2x1bW5zO1xuICAgICAgbGV0IGN1cnJlbnRDb2xTcGFuID0gc3RhcnRDb2xTcGFuO1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVggPSBtZS5jbGllbnRYIC0gc3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YUNvbHMgPSBNYXRoLnJvdW5kKGRlbHRhWCAvIGNvbFdpZHRoKTtcbiAgICAgICAgY3VycmVudENvbFNwYW4gPSBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBzdGFydENvbFNwYW4gKyBkZWx0YUNvbHMpKTtcbiAgICAgICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGN1cnJlbnRDb2xTcGFuIC8gY29sdW1ucykgKiAxMDA7XG4gICAgICAgIGNvbnN0IGdhcEZyYWN0aW9uID0gKGNvbHVtbnMgLSBjdXJyZW50Q29sU3BhbikgLyBjb2x1bW5zO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMSBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtnYXBGcmFjdGlvbi50b0ZpeGVkKDQpfSlgO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PlxuICAgICAgICAgIGIuaWQgPT09IGluc3RhbmNlLmlkID8geyAuLi5iLCBjb2xTcGFuOiBjdXJyZW50Q29sU3BhbiB9IDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZEluc2VydGlvblBvaW50KFxuICAgIHg6IG51bWJlcixcbiAgICB5OiBudW1iZXIsXG4gICAgZXhjbHVkZUlkOiBzdHJpbmcsXG4gICk6IHsgdGFyZ2V0SWQ6IHN0cmluZyB8IG51bGw7IGluc2VydEJlZm9yZTogYm9vbGVhbjsgaW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGwgfSB7XG4gICAgbGV0IGJlc3RUYXJnZXRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGJlc3REaXN0ID0gSW5maW5pdHk7XG4gICAgbGV0IGJlc3RJbnNlcnRCZWZvcmUgPSB0cnVlO1xuXG4gICAgZm9yIChjb25zdCBbaWQsIHsgd3JhcHBlciB9XSBvZiB0aGlzLmJsb2Nrcykge1xuICAgICAgaWYgKGlkID09PSBleGNsdWRlSWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcmVjdCA9IHdyYXBwZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBjeCA9IHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyO1xuICAgICAgY29uc3QgY3kgPSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMjtcblxuICAgICAgLy8gSWYgY3Vyc29yIGlzIGRpcmVjdGx5IG92ZXIgdGhpcyBjYXJkLCB1c2UgaXQgaW1tZWRpYXRlbHlcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIGNvbnN0IGluc2VydEJlZm9yZSA9IHggPCBjeDtcbiAgICAgICAgcmV0dXJuIHsgdGFyZ2V0SWQ6IGlkLCBpbnNlcnRCZWZvcmUsIGluc2VydEJlZm9yZUlkOiBpbnNlcnRCZWZvcmUgPyBpZCA6IHRoaXMubmV4dEJsb2NrSWQoaWQpIH07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRpc3QgPSBNYXRoLmh5cG90KHggLSBjeCwgeSAtIGN5KTtcbiAgICAgIGlmIChkaXN0IDwgYmVzdERpc3QpIHtcbiAgICAgICAgYmVzdERpc3QgPSBkaXN0O1xuICAgICAgICBiZXN0VGFyZ2V0SWQgPSBpZDtcbiAgICAgICAgYmVzdEluc2VydEJlZm9yZSA9IHggPCBjeDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWJlc3RUYXJnZXRJZCkgcmV0dXJuIHsgdGFyZ2V0SWQ6IG51bGwsIGluc2VydEJlZm9yZTogdHJ1ZSwgaW5zZXJ0QmVmb3JlSWQ6IG51bGwgfTtcbiAgICByZXR1cm4ge1xuICAgICAgdGFyZ2V0SWQ6IGJlc3RUYXJnZXRJZCxcbiAgICAgIGluc2VydEJlZm9yZTogYmVzdEluc2VydEJlZm9yZSxcbiAgICAgIGluc2VydEJlZm9yZUlkOiBiZXN0SW5zZXJ0QmVmb3JlID8gYmVzdFRhcmdldElkIDogdGhpcy5uZXh0QmxvY2tJZChiZXN0VGFyZ2V0SWQpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG5leHRCbG9ja0lkKGlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBibG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzO1xuICAgIGNvbnN0IGlkeCA9IGJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpZCk7XG4gICAgcmV0dXJuIGlkeCA+PSAwICYmIGlkeCA8IGJsb2Nrcy5sZW5ndGggLSAxID8gYmxvY2tzW2lkeCArIDFdLmlkIDogbnVsbDtcbiAgfVxuXG4gIC8qKiBSZW1vdmUgdGhlIGRyYWdnZWQgYmxvY2sgZnJvbSBpdHMgY3VycmVudCBwb3NpdGlvbiBhbmQgaW5zZXJ0IGl0IGJlZm9yZSBpbnNlcnRCZWZvcmVJZCAobnVsbCA9IGFwcGVuZCkuICovXG4gIHByaXZhdGUgcmVvcmRlckJsb2NrKGRyYWdnZWRJZDogc3RyaW5nLCBpbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGJsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3M7XG4gICAgY29uc3QgZHJhZ2dlZCA9IGJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gZHJhZ2dlZElkKTtcbiAgICBpZiAoIWRyYWdnZWQpIHJldHVybjtcblxuICAgIGNvbnN0IHdpdGhvdXREcmFnZ2VkID0gYmxvY2tzLmZpbHRlcihiID0+IGIuaWQgIT09IGRyYWdnZWRJZCk7XG4gICAgY29uc3QgaW5zZXJ0QXQgPSBpbnNlcnRCZWZvcmVJZFxuICAgICAgPyB3aXRob3V0RHJhZ2dlZC5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnNlcnRCZWZvcmVJZClcbiAgICAgIDogd2l0aG91dERyYWdnZWQubGVuZ3RoO1xuXG4gICAgLy8gTm8tb3AgaWYgZWZmZWN0aXZlbHkgc2FtZSBwb3NpdGlvblxuICAgIGNvbnN0IG9yaWdpbmFsSWR4ID0gYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGRyYWdnZWRJZCk7XG4gICAgY29uc3QgcmVzb2x2ZWRBdCA9IGluc2VydEF0ID09PSAtMSA/IHdpdGhvdXREcmFnZ2VkLmxlbmd0aCA6IGluc2VydEF0O1xuICAgIGlmIChyZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCB8fCByZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCArIDEpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFtcbiAgICAgIC4uLndpdGhvdXREcmFnZ2VkLnNsaWNlKDAsIHJlc29sdmVkQXQpLFxuICAgICAgZHJhZ2dlZCxcbiAgICAgIC4uLndpdGhvdXREcmFnZ2VkLnNsaWNlKHJlc29sdmVkQXQpLFxuICAgIF07XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0RWRpdE1vZGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZWRpdE1vZGUgPSBlbmFibGVkO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGUgY29sdW1uIGNvdW50LCBjbGFtcGluZyBlYWNoIGJsb2NrJ3MgY29sIGFuZCBjb2xTcGFuIHRvIGZpdC4gKi9cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGNvbnN0IGNvbCA9IE1hdGgubWluKGIuY29sLCBuKTtcbiAgICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihiLmNvbFNwYW4sIG4gLSBjb2wgKyAxKTtcbiAgICAgIHJldHVybiB7IC4uLmIsIGNvbCwgY29sU3BhbiB9O1xuICAgIH0pO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGNvbHVtbnM6IG4sIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLmxhc3RBZGRlZEJsb2NrSWQgPSBpbnN0YW5jZS5pZDtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGZvY3VzZWQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGZvY3VzZWRCbG9ja0lkID0gKGZvY3VzZWQ/LmNsb3Nlc3QoJ1tkYXRhLWJsb2NrLWlkXScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuYmxvY2tJZDtcbiAgICBjb25zdCBzY3JvbGxUYXJnZXRJZCA9IHRoaXMubGFzdEFkZGVkQmxvY2tJZDtcbiAgICB0aGlzLmxhc3RBZGRlZEJsb2NrSWQgPSBudWxsO1xuXG4gICAgdGhpcy5yZW5kZXIodGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuXG4gICAgaWYgKHNjcm9sbFRhcmdldElkKSB7XG4gICAgICBjb25zdCBuZXdFbCA9IHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1ibG9jay1pZD1cIiR7c2Nyb2xsVGFyZ2V0SWR9XCJdYCk7XG4gICAgICBpZiAobmV3RWwpIHtcbiAgICAgICAgbmV3RWwuYWRkQ2xhc3MoJ2Jsb2NrLWp1c3QtYWRkZWQnKTtcbiAgICAgICAgbmV3RWwuc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnbmVhcmVzdCcgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChmb2N1c2VkQmxvY2tJZCkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgW2RhdGEtYmxvY2staWQ9XCIke2ZvY3VzZWRCbG9ja0lkfVwiXWApO1xuICAgICAgZWw/LmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFVubG9hZCBhbGwgYmxvY2tzIGFuZCBjYW5jZWwgYW55IGluLXByb2dyZXNzIGRyYWcvcmVzaXplLiAqL1xuICBkZXN0cm95QWxsKCk6IHZvaWQge1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZUNsb25lPy5yZW1vdmUoKTtcbiAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcblxuICAgIGZvciAoY29uc3QgeyBibG9jayB9IG9mIHRoaXMuYmxvY2tzLnZhbHVlcygpKSB7XG4gICAgICBibG9jay51bmxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5ibG9ja3MuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKiBGdWxsIHRlYXJkb3duOiB1bmxvYWQgYmxvY2tzIGFuZCByZW1vdmUgdGhlIGdyaWQgZWxlbWVudCBmcm9tIHRoZSBET00uICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBudWxsO1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLnJlbW92ZSgpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBzZXR0aW5ncyBtb2RhbCAodGl0bGUgc2VjdGlvbiArIGJsb2NrLXNwZWNpZmljIHNldHRpbmdzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gW2Vtb2ppLCBzZWFyY2gga2V5d29yZHNdIFx1MjAxNCAxNzAgbW9zdCBjb21tb24vdXNlZnVsXG5jb25zdCBFTU9KSV9QSUNLRVJfU0VUOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXG4gIC8vIFNtaWxleXMgJiBlbW90aW9uXG4gIFsnXHVEODNEXHVERTAwJywnaGFwcHkgc21pbGUgZ3JpbiddLFsnXHVEODNEXHVERTBBJywnc21pbGUgYmx1c2ggaGFwcHknXSxbJ1x1RDgzRFx1REUwMicsJ2xhdWdoIGNyeSBmdW5ueSBqb3knXSxcbiAgWydcdUQ4M0VcdURENzInLCd0ZWFyIHNtaWxlIGdyYXRlZnVsJ10sWydcdUQ4M0RcdURFMEQnLCdoZWFydCBleWVzIGxvdmUnXSxbJ1x1RDgzRVx1REQyOScsJ3N0YXIgZXllcyBleGNpdGVkJ10sXG4gIFsnXHVEODNEXHVERTBFJywnY29vbCBzdW5nbGFzc2VzJ10sWydcdUQ4M0VcdUREMTQnLCd0aGlua2luZyBobW0nXSxbJ1x1RDgzRFx1REUwNScsJ3N3ZWF0IG5lcnZvdXMgbGF1Z2gnXSxcbiAgWydcdUQ4M0RcdURFMjInLCdjcnkgc2FkIHRlYXInXSxbJ1x1RDgzRFx1REUyNCcsJ2FuZ3J5IGh1ZmYgZnJ1c3RyYXRlZCddLFsnXHVEODNFXHVERDczJywncGFydHkgY2VsZWJyYXRlJ10sXG4gIFsnXHVEODNEXHVERTM0Jywnc2xlZXAgdGlyZWQgenp6J10sWydcdUQ4M0VcdUREMkYnLCdtaW5kIGJsb3duIGV4cGxvZGUnXSxbJ1x1RDgzRVx1REVFMScsJ3NhbHV0ZSByZXNwZWN0J10sXG4gIC8vIFBlb3BsZSAmIGdlc3R1cmVzXG4gIFsnXHVEODNEXHVEQzRCJywnd2F2ZSBoZWxsbyBieWUnXSxbJ1x1RDgzRFx1REM0RCcsJ3RodW1icyB1cCBnb29kIG9rJ10sWydcdUQ4M0RcdURDNEUnLCd0aHVtYnMgZG93biBiYWQnXSxcbiAgWydcdTI3MEMnLCd2aWN0b3J5IHBlYWNlJ10sWydcdUQ4M0VcdUREMUQnLCdoYW5kc2hha2UgZGVhbCddLFsnXHVEODNEXHVERTRGJywncHJheSB0aGFua3MgcGxlYXNlJ10sXG4gIFsnXHVEODNEXHVEQ0FBJywnbXVzY2xlIHN0cm9uZyBmbGV4J10sWydcdUQ4M0RcdURDNDEnLCdleWUgd2F0Y2ggc2VlJ10sWydcdUQ4M0VcdURERTAnLCdicmFpbiBtaW5kIHRoaW5rJ10sXG4gIFsnXHUyNzY0JywnaGVhcnQgbG92ZSByZWQnXSxbJ1x1RDgzRVx1RERFMScsJ29yYW5nZSBoZWFydCddLFsnXHVEODNEXHVEQzlCJywneWVsbG93IGhlYXJ0J10sXG4gIFsnXHVEODNEXHVEQzlBJywnZ3JlZW4gaGVhcnQnXSxbJ1x1RDgzRFx1REM5OScsJ2JsdWUgaGVhcnQnXSxbJ1x1RDgzRFx1REM5QycsJ3B1cnBsZSBoZWFydCddLFsnXHVEODNEXHVEREE0JywnYmxhY2sgaGVhcnQnXSxcbiAgLy8gTmF0dXJlXG4gIFsnXHVEODNDXHVERjMxJywnc2VlZGxpbmcgc3Byb3V0IGdyb3cnXSxbJ1x1RDgzQ1x1REYzRicsJ2hlcmIgbGVhZiBncmVlbiBuYXR1cmUnXSxbJ1x1RDgzQ1x1REY0MCcsJ2Nsb3ZlciBsdWNrJ10sXG4gIFsnXHVEODNDXHVERjM4JywnYmxvc3NvbSBmbG93ZXIgcGluayddLFsnXHVEODNDXHVERjNBJywnZmxvd2VyIGhpYmlzY3VzJ10sWydcdUQ4M0NcdURGM0InLCdzdW5mbG93ZXInXSxcbiAgWydcdUQ4M0NcdURGNDInLCdhdXR1bW4gZmFsbCBsZWFmJ10sWydcdUQ4M0NcdURGMEEnLCd3YXZlIG9jZWFuIHdhdGVyIHNlYSddLFsnXHVEODNEXHVERDI1JywnZmlyZSBmbGFtZSBob3QnXSxcbiAgWydcdTI3NDQnLCdzbm93Zmxha2UgY29sZCBpY2Ugd2ludGVyJ10sWydcdTI2QTEnLCdsaWdodG5pbmcgYm9sdCBlbmVyZ3knXSxbJ1x1RDgzQ1x1REYwOCcsJ3JhaW5ib3cnXSxcbiAgWydcdTI2MDAnLCdzdW4gc3VubnkgYnJpZ2h0J10sWydcdUQ4M0NcdURGMTknLCdtb29uIG5pZ2h0IGNyZXNjZW50J10sWydcdTJCNTAnLCdzdGFyIGZhdm9yaXRlJ10sXG4gIFsnXHVEODNDXHVERjFGJywnZ2xvd2luZyBzdGFyIHNoaW5lJ10sWydcdTI3MjgnLCdzcGFya2xlcyBzaGluZSBtYWdpYyddLFsnXHVEODNDXHVERkQ0JywnbW91bnRhaW4gcGVhayddLFxuICBbJ1x1RDgzQ1x1REYwRCcsJ2VhcnRoIGdsb2JlIHdvcmxkJ10sWydcdUQ4M0NcdURGMTAnLCdnbG9iZSBpbnRlcm5ldCB3ZWInXSxcbiAgLy8gRm9vZCAmIG9iamVjdHNcbiAgWydcdTI2MTUnLCdjb2ZmZWUgdGVhIGhvdCBkcmluayddLFsnXHVEODNDXHVERjc1JywndGVhIGN1cCBob3QnXSxbJ1x1RDgzQ1x1REY3QScsJ2JlZXIgZHJpbmsnXSxcbiAgWydcdUQ4M0NcdURGNEUnLCdhcHBsZSBmcnVpdCByZWQnXSxbJ1x1RDgzQ1x1REY0QicsJ2xlbW9uIHllbGxvdyBzb3VyJ10sWydcdUQ4M0NcdURGODInLCdjYWtlIGJpcnRoZGF5J10sXG4gIC8vIEFjdGl2aXRpZXMgJiBzcG9ydHNcbiAgWydcdUQ4M0NcdURGQUYnLCd0YXJnZXQgYnVsbHNleWUgZ29hbCddLFsnXHVEODNDXHVERkM2JywndHJvcGh5IGF3YXJkIHdpbiddLFsnXHVEODNFXHVERDQ3JywnbWVkYWwgZ29sZCBmaXJzdCddLFxuICBbJ1x1RDgzQ1x1REZBRScsJ2dhbWUgY29udHJvbGxlciBwbGF5J10sWydcdUQ4M0NcdURGQTgnLCdhcnQgcGFsZXR0ZSBjcmVhdGl2ZSBwYWludCddLFsnXHVEODNDXHVERkI1JywnbXVzaWMgbm90ZSBzb25nJ10sXG4gIFsnXHVEODNDXHVERkFDJywnY2xhcHBlciBmaWxtIG1vdmllJ10sWydcdUQ4M0RcdURDRjcnLCdjYW1lcmEgcGhvdG8nXSxbJ1x1RDgzQ1x1REY4MScsJ2dpZnQgcHJlc2VudCddLFxuICBbJ1x1RDgzQ1x1REZCMicsJ2RpY2UgZ2FtZSByYW5kb20nXSxbJ1x1RDgzRVx1RERFOScsJ3B1enpsZSBwaWVjZSddLFsnXHVEODNDXHVERkFEJywndGhlYXRlciBtYXNrcyddLFxuICAvLyBUcmF2ZWwgJiBwbGFjZXNcbiAgWydcdUQ4M0RcdURFODAnLCdyb2NrZXQgbGF1bmNoIHNwYWNlJ10sWydcdTI3MDgnLCdhaXJwbGFuZSB0cmF2ZWwgZmx5J10sWydcdUQ4M0RcdURFODInLCd0cmFpbiB0cmF2ZWwnXSxcbiAgWydcdUQ4M0NcdURGRTAnLCdob3VzZSBob21lJ10sWydcdUQ4M0NcdURGRDknLCdjaXR5IGJ1aWxkaW5nJ10sWydcdUQ4M0NcdURGMDYnLCdjaXR5IHN1bnNldCddLFxuICAvLyBPYmplY3RzICYgdG9vbHNcbiAgWydcdUQ4M0RcdURDQzEnLCdmb2xkZXIgZGlyZWN0b3J5J10sWydcdUQ4M0RcdURDQzInLCdvcGVuIGZvbGRlciddLFsnXHVEODNEXHVEQ0M0JywnZG9jdW1lbnQgcGFnZSBmaWxlJ10sXG4gIFsnXHVEODNEXHVEQ0REJywnbWVtbyB3cml0ZSBub3RlIGVkaXQnXSxbJ1x1RDgzRFx1RENDQicsJ2NsaXBib2FyZCBjb3B5J10sWydcdUQ4M0RcdURDQ0MnLCdwdXNocGluIHBpbiddLFxuICBbJ1x1RDgzRFx1RENDRCcsJ2xvY2F0aW9uIHBpbiBtYXAnXSxbJ1x1RDgzRFx1REQxNicsJ2Jvb2ttYXJrIHNhdmUnXSxbJ1x1RDgzRFx1RERDMicsJ2luZGV4IGRpdmlkZXJzJ10sXG4gIFsnXHVEODNEXHVEQ0M1JywnY2FsZW5kYXIgZGF0ZSBzY2hlZHVsZSddLFsnXHVEODNEXHVEREQzJywnY2FsZW5kYXIgc3BpcmFsJ10sWydcdTIzRjAnLCdhbGFybSBjbG9jayB0aW1lIHdha2UnXSxcbiAgWydcdUQ4M0RcdURENTAnLCdjbG9jayB0aW1lIGhvdXInXSxbJ1x1MjNGMScsJ3N0b3B3YXRjaCB0aW1lciddLFsnXHVEODNEXHVEQ0NBJywnY2hhcnQgYmFyIGRhdGEnXSxcbiAgWydcdUQ4M0RcdURDQzgnLCdjaGFydCB1cCBncm93dGggdHJlbmQnXSxbJ1x1RDgzRFx1RENDOScsJ2NoYXJ0IGRvd24gZGVjbGluZSddLFxuICBbJ1x1RDgzRFx1RENBMScsJ2lkZWEgbGlnaHQgYnVsYiBpbnNpZ2h0J10sWydcdUQ4M0RcdUREMEQnLCdzZWFyY2ggbWFnbmlmeSB6b29tJ10sWydcdUQ4M0RcdUREMTcnLCdsaW5rIGNoYWluIHVybCddLFxuICBbJ1x1RDgzRFx1RENFMicsJ2xvdWRzcGVha2VyIGFubm91bmNlJ10sWydcdUQ4M0RcdUREMTQnLCdiZWxsIG5vdGlmaWNhdGlvbiBhbGVydCddLFxuICBbJ1x1RDgzRFx1RENBQycsJ3NwZWVjaCBidWJibGUgY2hhdCBtZXNzYWdlJ10sWydcdUQ4M0RcdURDQUQnLCd0aG91Z2h0IHRoaW5rIGJ1YmJsZSddLFxuICBbJ1x1RDgzRFx1RENEQScsJ2Jvb2tzIHN0dWR5IGxpYnJhcnknXSxbJ1x1RDgzRFx1RENENicsJ29wZW4gYm9vayByZWFkJ10sWydcdUQ4M0RcdURDREMnLCdzY3JvbGwgZG9jdW1lbnQnXSxcbiAgWydcdTI3MDknLCdlbnZlbG9wZSBlbWFpbCBsZXR0ZXInXSxbJ1x1RDgzRFx1RENFNycsJ2VtYWlsIG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENFNScsJ2luYm94IGRvd25sb2FkJ10sXG4gIFsnXHVEODNEXHVEQ0U0Jywnb3V0Ym94IHVwbG9hZCBzZW5kJ10sWydcdUQ4M0RcdURERDEnLCd0cmFzaCBkZWxldGUgcmVtb3ZlJ10sXG4gIC8vIFRlY2hcbiAgWydcdUQ4M0RcdURDQkInLCdsYXB0b3AgY29tcHV0ZXIgY29kZSddLFsnXHVEODNEXHVEREE1JywnZGVza3RvcCBtb25pdG9yIHNjcmVlbiddLFsnXHVEODNEXHVEQ0YxJywncGhvbmUgbW9iaWxlJ10sXG4gIFsnXHUyMzI4Jywna2V5Ym9hcmQgdHlwZSddLFsnXHVEODNEXHVEREIxJywnbW91c2UgY3Vyc29yIGNsaWNrJ10sWydcdUQ4M0RcdURDRTEnLCdzYXRlbGxpdGUgYW50ZW5uYSBzaWduYWwnXSxcbiAgWydcdUQ4M0RcdUREMEMnLCdwbHVnIHBvd2VyIGVsZWN0cmljJ10sWydcdUQ4M0RcdUREMEInLCdiYXR0ZXJ5IHBvd2VyIGNoYXJnZSddLFsnXHVEODNEXHVEQ0JFJywnZmxvcHB5IGRpc2sgc2F2ZSddLFxuICBbJ1x1RDgzRFx1RENCRicsJ2Rpc2MgY2QgZHZkJ10sWydcdUQ4M0RcdUREQTgnLCdwcmludGVyIHByaW50J10sXG4gIC8vIFN5bWJvbHMgJiBzdGF0dXNcbiAgWydcdTI3MDUnLCdjaGVjayBkb25lIGNvbXBsZXRlIHllcyddLFsnXHUyNzRDJywnY3Jvc3MgZXJyb3Igd3Jvbmcgbm8gZGVsZXRlJ10sXG4gIFsnXHUyNkEwJywnd2FybmluZyBjYXV0aW9uIGFsZXJ0J10sWydcdTI3NTMnLCdxdWVzdGlvbiBtYXJrJ10sWydcdTI3NTcnLCdleGNsYW1hdGlvbiBpbXBvcnRhbnQnXSxcbiAgWydcdUQ4M0RcdUREMTInLCdsb2NrIHNlY3VyZSBwcml2YXRlJ10sWydcdUQ4M0RcdUREMTMnLCd1bmxvY2sgb3BlbiBwdWJsaWMnXSxbJ1x1RDgzRFx1REQxMScsJ2tleSBwYXNzd29yZCBhY2Nlc3MnXSxcbiAgWydcdUQ4M0RcdURFRTEnLCdzaGllbGQgcHJvdGVjdCBzZWN1cml0eSddLFsnXHUyNjk5JywnZ2VhciBzZXR0aW5ncyBjb25maWcnXSxbJ1x1RDgzRFx1REQyNycsJ3dyZW5jaCB0b29sIGZpeCddLFxuICBbJ1x1RDgzRFx1REQyOCcsJ2hhbW1lciBidWlsZCddLFsnXHUyNjk3JywnZmxhc2sgY2hlbWlzdHJ5IGxhYiddLFsnXHVEODNEXHVERDJDJywnbWljcm9zY29wZSBzY2llbmNlIHJlc2VhcmNoJ10sXG4gIFsnXHVEODNEXHVERDJEJywndGVsZXNjb3BlIHNwYWNlIGFzdHJvbm9teSddLFsnXHVEODNFXHVEREVBJywndGVzdCB0dWJlIGV4cGVyaW1lbnQnXSxcbiAgWydcdUQ4M0RcdURDOEUnLCdnZW0gZGlhbW9uZCBwcmVjaW91cyddLFsnXHVEODNEXHVEQ0IwJywnbW9uZXkgYmFnIHJpY2gnXSxbJ1x1RDgzRFx1RENCMycsJ2NyZWRpdCBjYXJkIHBheW1lbnQnXSxcbiAgWydcdUQ4M0NcdURGRjcnLCdsYWJlbCB0YWcgcHJpY2UnXSxbJ1x1RDgzQ1x1REY4MCcsJ3JpYmJvbiBib3cgZ2lmdCddLFxuICAvLyBNaXNjIHVzZWZ1bFxuICBbJ1x1RDgzRVx1RERFRCcsJ2NvbXBhc3MgbmF2aWdhdGUgZGlyZWN0aW9uJ10sWydcdUQ4M0RcdURERkEnLCdtYXAgd29ybGQgbmF2aWdhdGUnXSxcbiAgWydcdUQ4M0RcdURDRTYnLCdib3ggcGFja2FnZSBzaGlwcGluZyddLFsnXHVEODNEXHVEREM0JywnZmlsaW5nIGNhYmluZXQgYXJjaGl2ZSddLFxuICBbJ1x1RDgzRFx1REQxMCcsJ2xvY2sga2V5IHNlY3VyZSddLFsnXHVEODNEXHVEQ0NFJywncGFwZXJjbGlwIGF0dGFjaCddLFsnXHUyNzAyJywnc2Npc3NvcnMgY3V0J10sXG4gIFsnXHVEODNEXHVERDhBJywncGVuIHdyaXRlIGVkaXQnXSxbJ1x1RDgzRFx1RENDRicsJ3J1bGVyIG1lYXN1cmUnXSxbJ1x1RDgzRFx1REQwNScsJ2RpbSBicmlnaHRuZXNzJ10sXG4gIFsnXHVEODNEXHVERDA2JywnYnJpZ2h0IHN1biBsaWdodCddLFsnXHUyNjdCJywncmVjeWNsZSBzdXN0YWluYWJpbGl0eSddLFsnXHUyNzE0JywnY2hlY2ttYXJrIGRvbmUnXSxcbiAgWydcdTI3OTUnLCdwbHVzIGFkZCddLFsnXHUyNzk2JywnbWludXMgcmVtb3ZlJ10sWydcdUQ4M0RcdUREMDQnLCdyZWZyZXNoIHN5bmMgbG9vcCddLFxuICBbJ1x1MjNFOScsJ2Zhc3QgZm9yd2FyZCBza2lwJ10sWydcdTIzRUEnLCdyZXdpbmQgYmFjayddLFsnXHUyM0Y4JywncGF1c2Ugc3RvcCddLFxuICBbJ1x1MjVCNicsJ3BsYXkgc3RhcnQnXSxbJ1x1RDgzRFx1REQwMCcsJ3NodWZmbGUgcmFuZG9tIG1peCddLFxuXTtcblxuY2xhc3MgQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlLFxuICAgIHByaXZhdGUgYmxvY2s6IEJhc2VCbG9jayxcbiAgICBwcml2YXRlIG9uU2F2ZTogKCkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5pbnN0YW5jZS5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1RpdGxlIGxhYmVsJylcbiAgICAgIC5zZXREZXNjKCdMZWF2ZSBlbXB0eSB0byB1c2UgdGhlIGRlZmF1bHQgdGl0bGUuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0eXBlb2YgZHJhZnQuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlTGFiZWwgOiAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignRGVmYXVsdCB0aXRsZScpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll90aXRsZUxhYmVsID0gdjsgfSksXG4gICAgICApO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIEVtb2ppIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBlbW9qaVJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItcm93JyB9KTtcbiAgICBlbW9qaVJvdy5jcmVhdGVTcGFuKHsgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLCB0ZXh0OiAnVGl0bGUgZW1vamknIH0pO1xuXG4gICAgY29uc3QgY29udHJvbHMgPSBlbW9qaVJvdy5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItY29udHJvbHMnIH0pO1xuXG4gICAgY29uc3QgdHJpZ2dlckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci10cmlnZ2VyJyB9KTtcbiAgICBjb25zdCB1cGRhdGVUcmlnZ2VyID0gKCkgPT4ge1xuICAgICAgY29uc3QgdmFsID0gdHlwZW9mIGRyYWZ0Ll90aXRsZUVtb2ppID09PSAnc3RyaW5nJyA/IGRyYWZ0Ll90aXRsZUVtb2ppIDogJyc7XG4gICAgICB0cmlnZ2VyQnRuLmVtcHR5KCk7XG4gICAgICB0cmlnZ2VyQnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiB2YWwgfHwgJ1x1RkYwQicgfSk7XG4gICAgICB0cmlnZ2VyQnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdlbW9qaS1waWNrZXItY2hldnJvbicsIHRleHQ6ICdcdTI1QkUnIH0pO1xuICAgIH07XG4gICAgdXBkYXRlVHJpZ2dlcigpO1xuXG4gICAgY29uc3QgY2xlYXJCdG4gPSBjb250cm9scy5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdlbW9qaS1waWNrZXItY2xlYXInLCB0ZXh0OiAnXHUyNzE1JyB9KTtcbiAgICBjbGVhckJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2xlYXIgZW1vamknKTtcblxuICAgIGNvbnN0IHBhbmVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1wYW5lbCcgfSk7XG4gICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgIGNvbnN0IHNlYXJjaElucHV0ID0gcGFuZWwuY3JlYXRlRWwoJ2lucHV0Jywge1xuICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgY2xzOiAnZW1vamktcGlja2VyLXNlYXJjaCcsXG4gICAgICBwbGFjZWhvbGRlcjogJ1NlYXJjaFx1MjAyNicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlkRWwgPSBwYW5lbC5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItZ3JpZCcgfSk7XG5cbiAgICBjb25zdCByZW5kZXJHcmlkID0gKHF1ZXJ5OiBzdHJpbmcpID0+IHtcbiAgICAgIGdyaWRFbC5lbXB0eSgpO1xuICAgICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgY29uc3QgZmlsdGVyZWQgPSBxXG4gICAgICAgID8gRU1PSklfUElDS0VSX1NFVC5maWx0ZXIoKFtlLCBrXSkgPT4gay5pbmNsdWRlcyhxKSB8fCBlID09PSBxKVxuICAgICAgICA6IEVNT0pJX1BJQ0tFUl9TRVQ7XG4gICAgICBmb3IgKGNvbnN0IFtlbW9qaV0gb2YgZmlsdGVyZWQpIHtcbiAgICAgICAgY29uc3QgYnRuID0gZ3JpZEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLWJ0bicsIHRleHQ6IGVtb2ppIH0pO1xuICAgICAgICBpZiAoZHJhZnQuX3RpdGxlRW1vamkgPT09IGVtb2ppKSBidG4uYWRkQ2xhc3MoJ2lzLXNlbGVjdGVkJyk7XG4gICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9IGVtb2ppO1xuICAgICAgICAgIHVwZGF0ZVRyaWdnZXIoKTtcbiAgICAgICAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICAgICAgcmVuZGVyR3JpZCgnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGZpbHRlcmVkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBncmlkRWwuY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1lbXB0eScsIHRleHQ6ICdObyByZXN1bHRzJyB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlbmRlckdyaWQoJycpO1xuXG4gICAgc2VhcmNoSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiByZW5kZXJHcmlkKHNlYXJjaElucHV0LnZhbHVlKSk7XG5cbiAgICB0cmlnZ2VyQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgY29uc3Qgb3BlbiA9IHBhbmVsLnN0eWxlLmRpc3BsYXkgIT09ICdub25lJztcbiAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSBvcGVuID8gJ25vbmUnIDogJ2Jsb2NrJztcbiAgICAgIGlmICghb3Blbikgc2V0VGltZW91dCgoKSA9PiBzZWFyY2hJbnB1dC5mb2N1cygpLCAwKTtcbiAgICB9KTtcblxuICAgIGNsZWFyQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgZHJhZnQuX3RpdGxlRW1vamkgPSAnJztcbiAgICAgIHVwZGF0ZVRyaWdnZXIoKTtcbiAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBzZWFyY2hJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgcmVuZGVyR3JpZCgnJyk7XG4gICAgfSk7XG4gICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnSGlkZSB0aXRsZScpXG4gICAgICAuYWRkVG9nZ2xlKHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5faGlkZVRpdGxlID09PSB0cnVlKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5faGlkZVRpdGxlID0gdjsgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGRyYWZ0O1xuICAgICAgICAgIHRoaXMub25TYXZlKCk7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuXG4gICAgY29uc3QgaHIgPSBjb250ZW50RWwuY3JlYXRlRWwoJ2hyJyk7XG4gICAgaHIuc3R5bGUubWFyZ2luID0gJzE2cHggMCc7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICB0ZXh0OiAnQmxvY2stc3BlY2lmaWMgc2V0dGluZ3M6JyxcbiAgICAgIGNsczogJ3NldHRpbmctaXRlbS1uYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDb25maWd1cmUgYmxvY2suLi4nKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgdGhpcy5ibG9jay5vcGVuU2V0dGluZ3ModGhpcy5vblNhdmUpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBSZW1vdmUgY29uZmlybWF0aW9uIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBSZW1vdmVCbG9ja0NvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25Db25maXJtOiAoKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUmVtb3ZlIGJsb2NrPycgfSk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnVGhpcyBibG9jayB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgaG9tZXBhZ2UuJyB9KTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVtb3ZlJykuc2V0V2FybmluZygpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25Db25maXJtKCk7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEJsb2NrRmFjdG9yeSwgQmxvY2tUeXBlIH0gZnJvbSAnLi90eXBlcyc7XG5cbmNsYXNzIEJsb2NrUmVnaXN0cnlDbGFzcyB7XG4gIHByaXZhdGUgZmFjdG9yaWVzID0gbmV3IE1hcDxCbG9ja1R5cGUsIEJsb2NrRmFjdG9yeT4oKTtcblxuICByZWdpc3RlcihmYWN0b3J5OiBCbG9ja0ZhY3RvcnkpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5zZXQoZmFjdG9yeS50eXBlLCBmYWN0b3J5KTtcbiAgfVxuXG4gIGdldCh0eXBlOiBCbG9ja1R5cGUpOiBCbG9ja0ZhY3RvcnkgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmZhY3Rvcmllcy5nZXQodHlwZSk7XG4gIH1cblxuICBnZXRBbGwoKTogQmxvY2tGYWN0b3J5W10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZmFjdG9yaWVzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLmNsZWFyKCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IEJsb2NrUmVnaXN0cnkgPSBuZXcgQmxvY2tSZWdpc3RyeUNsYXNzKCk7XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIEJsb2NrVHlwZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBCbG9ja1JlZ2lzdHJ5IH0gZnJvbSAnLi9CbG9ja1JlZ2lzdHJ5JztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuXG5leHBvcnQgY2xhc3MgRWRpdFRvb2xiYXIge1xuICBwcml2YXRlIHRvb2xiYXJFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG4gICAgcHJpdmF0ZSBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICAgIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCxcbiAgICBwcml2YXRlIG9uQ29sdW1uc0NoYW5nZTogKG46IG51bWJlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgdGhpcy50b29sYmFyRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS10b29sYmFyJyB9KTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAndG9vbGJhcicpO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSB0b29sYmFyJyk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIEVkaXQgbW9kZSBpbmRpY2F0b3IgKGxlZnQtYWxpZ25lZCwgaGlkZGVuIHVudGlsIGVkaXQgbW9kZSBhY3RpdmF0ZXMpXG4gICAgY29uc3QgaW5kaWNhdG9yID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRGl2KHsgY2xzOiAndG9vbGJhci1lZGl0LWluZGljYXRvcicgfSk7XG4gICAgaW5kaWNhdG9yLmNyZWF0ZURpdih7IGNsczogJ3Rvb2xiYXItZWRpdC1kb3QnIH0pO1xuICAgIGluZGljYXRvci5jcmVhdGVTcGFuKHsgdGV4dDogJ0VkaXRpbmcnIH0pO1xuICAgIGlmICh0aGlzLmVkaXRNb2RlKSBpbmRpY2F0b3IuYWRkQ2xhc3MoJ2lzLXZpc2libGUnKTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgY29sU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOdW1iZXIgb2YgY29sdW1ucycpO1xuICAgIFsyLCAzLCA0XS5mb3JFYWNoKG4gPT4ge1xuICAgICAgY29uc3Qgb3B0ID0gY29sU2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHZhbHVlOiBTdHJpbmcobiksIHRleHQ6IGAke259IGNvbGAgfSk7XG4gICAgICBpZiAobiA9PT0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgfSk7XG4gICAgY29sU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMub25Db2x1bW5zQ2hhbmdlKE51bWJlcihjb2xTZWxlY3QudmFsdWUpKTtcbiAgICB9KTtcblxuICAgIC8vIEVkaXQgdG9nZ2xlXG4gICAgY29uc3QgZWRpdEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItZWRpdC1idG4nIH0pO1xuICAgIHRoaXMudXBkYXRlRWRpdEJ0bihlZGl0QnRuKTtcbiAgICBlZGl0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgdGhpcy5lZGl0TW9kZSA9ICF0aGlzLmVkaXRNb2RlO1xuICAgICAgdGhpcy5ncmlkLnNldEVkaXRNb2RlKHRoaXMuZWRpdE1vZGUpO1xuICAgICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgICAgdGhpcy5zeW5jQWRkQnV0dG9uKCk7XG4gICAgICBpbmRpY2F0b3IudG9nZ2xlQ2xhc3MoJ2lzLXZpc2libGUnLCB0aGlzLmVkaXRNb2RlKTtcbiAgICAgIHRoaXMudG9vbGJhckVsLnRvZ2dsZUNsYXNzKCd0b29sYmFyLWVkaXRpbmcnLCB0aGlzLmVkaXRNb2RlKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLnRvb2xiYXJFbC5hZGRDbGFzcygndG9vbGJhci1lZGl0aW5nJyk7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cblxuICAgIC8vIFdpcmUgdXAgdGhlIGdyaWQncyBlbXB0eSBzdGF0ZSBDVEEgdG8gb3BlbiB0aGUgYWRkIGJsb2NrIG1vZGFsXG4gICAgdGhpcy5ncmlkLm9uUmVxdWVzdEFkZEJsb2NrID0gKCkgPT4geyB0aGlzLm9wZW5BZGRCbG9ja01vZGFsKCk7IH07XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUVkaXRCdG4oYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IHRoaXMuZWRpdE1vZGUgPyAnXHUyNzEzIERvbmUnIDogJ1x1MjcwRiBFZGl0JztcbiAgICBidG4udG9nZ2xlQ2xhc3MoJ3Rvb2xiYXItYnRuLWFjdGl2ZScsIHRoaXMuZWRpdE1vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzeW5jQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50b29sYmFyRWwucXVlcnlTZWxlY3RvcignLnRvb2xiYXItYWRkLWJ0bicpO1xuICAgIGlmICh0aGlzLmVkaXRNb2RlICYmICFleGlzdGluZykge1xuICAgICAgdGhpcy5hcHBlbmRBZGRCdXR0b24oKTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmVkaXRNb2RlICYmIGV4aXN0aW5nKSB7XG4gICAgICBleGlzdGluZy5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZEFkZEJ1dHRvbigpOiB2b2lkIHtcbiAgICBjb25zdCBhZGRCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWFkZC1idG4nLCB0ZXh0OiAnKyBBZGQgQmxvY2snIH0pO1xuICAgIGFkZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsgdGhpcy5vcGVuQWRkQmxvY2tNb2RhbCgpOyB9KTtcbiAgfVxuXG4gIC8qKiBPcGVucyB0aGUgQWRkIEJsb2NrIG1vZGFsLiBDYWxsZWQgZnJvbSB0b29sYmFyIGJ1dHRvbiBhbmQgZW1wdHkgc3RhdGUgQ1RBLiAqL1xuICBwcml2YXRlIG9wZW5BZGRCbG9ja01vZGFsKCk6IHZvaWQge1xuICAgIG5ldyBBZGRCbG9ja01vZGFsKHRoaXMuYXBwLCAodHlwZSkgPT4ge1xuICAgICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KHR5cGUpO1xuICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgIGNvbnN0IG1heFJvdyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MucmVkdWNlKFxuICAgICAgICAobWF4LCBiKSA9PiBNYXRoLm1heChtYXgsIGIucm93ICsgYi5yb3dTcGFuIC0gMSksIDAsXG4gICAgICApO1xuXG4gICAgICBjb25zdCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSA9IHtcbiAgICAgICAgaWQ6IGNyeXB0by5yYW5kb21VVUlEKCksXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGNvbDogMSxcbiAgICAgICAgcm93OiBtYXhSb3cgKyAxLFxuICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgcm93U3BhbjogZmFjdG9yeS5kZWZhdWx0U2l6ZS5yb3dTcGFuLFxuICAgICAgICBjb25maWc6IHsgLi4uZmFjdG9yeS5kZWZhdWx0Q29uZmlnIH0sXG4gICAgICB9O1xuXG4gICAgICB0aGlzLmdyaWQuYWRkQmxvY2soaW5zdGFuY2UpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxuXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLnRvb2xiYXJFbDtcbiAgfVxuXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuY29uc3QgQkxPQ0tfTUVUQTogUmVjb3JkPEJsb2NrVHlwZSwgeyBpY29uOiBzdHJpbmc7IGRlc2M6IHN0cmluZyB9PiA9IHtcbiAgJ2dyZWV0aW5nJzogICAgICB7IGljb246ICdcXHV7MUY0NEJ9JywgZGVzYzogJ1BlcnNvbmFsaXplZCBncmVldGluZyB3aXRoIHRpbWUgb2YgZGF5JyB9LFxuICAnY2xvY2snOiAgICAgICAgIHsgaWNvbjogJ1xcdXsxRjU1MH0nLCBkZXNjOiAnTGl2ZSBjbG9jayB3aXRoIGRhdGUgZGlzcGxheScgfSxcbiAgJ2ZvbGRlci1saW5rcyc6ICB7IGljb246ICdcXHV7MUY1MTd9JywgZGVzYzogJ1F1aWNrIGxpbmtzIHRvIG5vdGVzIGFuZCBmb2xkZXJzJyB9LFxuICAnaW5zaWdodCc6ICAgICAgIHsgaWNvbjogJ1xcdXsxRjRBMX0nLCBkZXNjOiAnRGFpbHkgcm90YXRpbmcgbm90ZSBmcm9tIGEgdGFnJyB9LFxuICAndGFnLWdyaWQnOiAgICAgIHsgaWNvbjogJ1xcdXsxRjNGN31cXHVGRTBGJywgZGVzYzogJ0dyaWQgb2YgbGFiZWxlZCB2YWx1ZSBidXR0b25zJyB9LFxuICAncXVvdGVzLWxpc3QnOiAgIHsgaWNvbjogJ1xcdXsxRjRBQ30nLCBkZXNjOiAnQ29sbGVjdGlvbiBvZiBxdW90ZXMgZnJvbSBub3RlcycgfSxcbiAgJ2ltYWdlLWdhbGxlcnknOiB7IGljb246ICdcXHV7MUY1QkN9XFx1RkUwRicsIGRlc2M6ICdQaG90byBncmlkIGZyb20gYSB2YXVsdCBmb2xkZXInIH0sXG4gICdlbWJlZGRlZC1ub3RlJzogeyBpY29uOiAnXFx1ezFGNEM0fScsIGRlc2M6ICdSZW5kZXIgYSBub3RlIGlubGluZSBvbiB0aGUgcGFnZScgfSxcbiAgJ3N0YXRpYy10ZXh0JzogICB7IGljb246ICdcXHV7MUY0RER9JywgZGVzYzogJ01hcmtkb3duIHRleHQgYmxvY2sgeW91IHdyaXRlIGRpcmVjdGx5JyB9LFxuICAnaHRtbCc6ICAgICAgICAgIHsgaWNvbjogJzwvPicsIGRlc2M6ICdDdXN0b20gSFRNTCBjb250ZW50IChzYW5pdGl6ZWQpJyB9LFxufTtcblxuY2xhc3MgQWRkQmxvY2tNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvblNlbGVjdDogKHR5cGU6IEJsb2NrVHlwZSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQWRkIEJsb2NrJywgY2xzOiAnYWRkLWJsb2NrLW1vZGFsLXRpdGxlJyB9KTtcblxuICAgIGNvbnN0IGdyaWQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYWRkLWJsb2NrLWdyaWQnIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IG1ldGEgPSBCTE9DS19NRVRBW2ZhY3RvcnkudHlwZV07XG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2FkZC1ibG9jay1vcHRpb24nIH0pO1xuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdhZGQtYmxvY2staWNvbicsIHRleHQ6IG1ldGE/Lmljb24gPz8gJ1xcdTI1QUEnIH0pO1xuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdhZGQtYmxvY2stbmFtZScsIHRleHQ6IGZhY3RvcnkuZGlzcGxheU5hbWUgfSk7XG4gICAgICBpZiAobWV0YT8uZGVzYykge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1kZXNjJywgdGV4dDogbWV0YS5kZXNjIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIHByaXZhdGUgX2hlYWRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgYXBwOiBBcHAsXG4gICAgcHJvdGVjdGVkIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlLFxuICAgIHByb3RlY3RlZCBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGFic3RyYWN0IHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxuICAvLyBPdmVycmlkZSB0byBvcGVuIGEgcGVyLWJsb2NrIHNldHRpbmdzIG1vZGFsXG4gIG9wZW5TZXR0aW5ncyhfb25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7fVxuXG4gIC8vIENhbGxlZCBieSBHcmlkTGF5b3V0IHRvIHJlZGlyZWN0IHJlbmRlckhlYWRlciBvdXRwdXQgb3V0c2lkZSBibG9jay1jb250ZW50LlxuICBzZXRIZWFkZXJDb250YWluZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5faGVhZGVyQ29udGFpbmVyID0gZWw7XG4gIH1cblxuICAvLyBSZW5kZXIgdGhlIG11dGVkIHVwcGVyY2FzZSBibG9jayBoZWFkZXIgbGFiZWwuXG4gIC8vIFJlc3BlY3RzIF9oaWRlVGl0bGUsIF90aXRsZUxhYmVsLCBhbmQgX3RpdGxlRW1vamkgZnJvbSBpbnN0YW5jZS5jb25maWcuXG4gIC8vIFJlbmRlcnMgaW50byB0aGUgaGVhZGVyIGNvbnRhaW5lciBzZXQgYnkgR3JpZExheW91dCAoaWYgYW55KSwgZWxzZSBmYWxscyBiYWNrIHRvIGVsLlxuICBwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGVsOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNmZyA9IHRoaXMuaW5zdGFuY2UuY29uZmlnO1xuICAgIGlmIChjZmcuX2hpZGVUaXRsZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgIGNvbnN0IGxhYmVsID0gKHR5cGVvZiBjZmcuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVMYWJlbC50cmltKCkpXG4gICAgICA/IGNmZy5fdGl0bGVMYWJlbC50cmltKClcbiAgICAgIDogdGl0bGU7XG4gICAgaWYgKCFsYWJlbCkgcmV0dXJuO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuX2hlYWRlckNvbnRhaW5lciA/PyBlbDtcbiAgICBjb25zdCBoZWFkZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJyB9KTtcbiAgICBpZiAodHlwZW9mIGNmZy5fdGl0bGVFbW9qaSA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUVtb2ppKSB7XG4gICAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWhlYWRlci1lbW9qaScsIHRleHQ6IGNmZy5fdGl0bGVFbW9qaSB9KTtcbiAgICB9XG4gICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIENsb2NrQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkYXRlRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdjbG9jay1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93RGF0ZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd0RhdGU/OiBib29sZWFuIH07XG5cbiAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLXRpbWUnIH0pO1xuICAgIGlmIChzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay1kYXRlJyB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgeyBzaG93U2Vjb25kcyA9IGZhbHNlLCBzaG93RGF0ZSA9IHRydWUsIGZvcm1hdCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBzaG93U2Vjb25kcz86IGJvb2xlYW47XG4gICAgICBzaG93RGF0ZT86IGJvb2xlYW47XG4gICAgICBmb3JtYXQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnRpbWVFbCkge1xuICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoZm9ybWF0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoc2hvd1NlY29uZHMgPyAnSEg6bW06c3MnIDogJ0hIOm1tJykpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5kYXRlRWwgJiYgc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsLnNldFRleHQobm93LmZvcm1hdCgnZGRkZCwgRCBNTU1NIFlZWVknKSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBDbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBDbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Nsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBzZWNvbmRzJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1NlY29uZHMgYXMgYm9vbGVhbiA/PyBmYWxzZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dTZWNvbmRzID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgZGF0ZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dEYXRlIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dEYXRlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnQ3VzdG9tIGZvcm1hdCcpXG4gICAgICAuc2V0RGVzYygnT3B0aW9uYWwgbW9tZW50LmpzIGZvcm1hdCBzdHJpbmcsIGUuZy4gXCJISDptbVwiLiBMZWF2ZSBlbXB0eSBmb3IgZGVmYXVsdC4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0LmZvcm1hdCBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZvcm1hdCA9IHY7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBMaW5rSXRlbSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgZW1vamk/OiBzdHJpbmc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT4gZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQgeyB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTGlua3NCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVuZGVyVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2ZvbGRlci1saW5rcy1ibG9jaycpO1xuXG4gICAgLy8gUmUtcmVuZGVyIHdoZW4gdmF1bHQgZmlsZXMgYXJlIGNyZWF0ZWQsIGRlbGV0ZWQsIG9yIHJlbmFtZWQgKGRlYm91bmNlZClcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2NyZWF0ZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignZGVsZXRlJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcblxuICAgIC8vIERlZmVyIGZpcnN0IHJlbmRlciBzbyB2YXVsdCBpcyBmdWxseSBpbmRleGVkXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4gdGhpcy5yZW5kZXJDb250ZW50KCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVJlbmRlcigpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5yZW5kZXJUaW1lciAhPT0gbnVsbCkgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJlbmRlclRpbWVyKTtcbiAgICB0aGlzLnJlbmRlclRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5yZW5kZXJUaW1lciA9IG51bGw7XG4gICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICB9LCAxNTApO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDb250ZW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5jb250YWluZXJFbDtcbiAgICBpZiAoIWVsKSByZXR1cm47XG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnUXVpY2sgTGlua3MnLCBmb2xkZXIgPSAnJywgbGlua3MgPSBbXSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICBsaW5rcz86IExpbmtJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBsaXN0ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmtzLWxpc3QnIH0pO1xuXG4gICAgLy8gQXV0by1saXN0IG5vdGVzIGZyb20gc2VsZWN0ZWQgZm9sZGVyIChzb3J0ZWQgYWxwaGFiZXRpY2FsbHkpXG4gICAgaWYgKGZvbGRlcikge1xuICAgICAgY29uc3Qgbm9ybWFsaXNlZCA9IGZvbGRlci50cmltKCkucmVwbGFjZSgvXFwvKyQvLCAnJyk7XG5cbiAgICAgIGlmICghbm9ybWFsaXNlZCkge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnVmF1bHQgcm9vdCBsaXN0aW5nIGlzIG5vdCBzdXBwb3J0ZWQuIFNlbGVjdCBhIHN1YmZvbGRlci4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGZvbGRlck9iaiA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChub3JtYWxpc2VkKTtcblxuICAgICAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IGBGb2xkZXIgXCIke25vcm1hbGlzZWR9XCIgbm90IGZvdW5kLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGZvbGRlck9iai5wYXRoICsgJy8nO1xuICAgICAgICAgIGNvbnN0IG5vdGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKVxuICAgICAgICAgICAgLmZpbHRlcihmID0+IGYucGF0aC5zdGFydHNXaXRoKHByZWZpeCkpXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcblxuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBub3Rlcykge1xuICAgICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICAgICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICAgICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgTm8gbm90ZXMgaW4gXCIke2ZvbGRlck9iai5wYXRofVwiLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hbnVhbCBsaW5rc1xuICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICBpZiAobGluay5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2xpbmstZW1vamknLCB0ZXh0OiBsaW5rLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsaW5rLmxhYmVsIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGxpbmsucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIgJiYgbGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBoaW50ID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjUxN30nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gbGlua3MgeWV0LiBBZGQgbWFudWFsIGxpbmtzIG9yIHBpY2sgYSBmb2xkZXIgaW4gc2V0dGluZ3MuJyB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEExfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHNob3cgYSBkYWlseSByb3RhdGluZyBub3RlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhcmQuc2V0VGV4dChgTm8gZmlsZXMgZm91bmQgd2l0aCB0YWcgJHt0YWdTZWFyY2h9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVXNlIGxvY2FsIG1pZG5pZ2h0IGFzIHRoZSBkYXkgaW5kZXggc28gaXQgY2hhbmdlcyBhdCBsb2NhbCBtaWRuaWdodCwgbm90IFVUQ1xuICAgIGNvbnN0IGRheUluZGV4ID0gTWF0aC5mbG9vcihtb21lbnQoKS5zdGFydE9mKCdkYXknKS52YWx1ZU9mKCkgLyBNU19QRVJfREFZKTtcbiAgICBjb25zdCBpbmRleCA9IGRhaWx5U2VlZFxuICAgICAgPyBkYXlJbmRleCAlIGZpbGVzLmxlbmd0aFxuICAgICAgOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmaWxlcy5sZW5ndGgpO1xuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgY29uc3QgeyBoZWFkaW5nLCBib2R5IH0gPSB0aGlzLnBhcnNlQ29udGVudChjb250ZW50LCBjYWNoZSk7XG5cbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC10aXRsZScsIHRleHQ6IGhlYWRpbmcgfHwgZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1ib2R5JywgdGV4dDogYm9keSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbnNpZ2h0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCBlKTtcbiAgICAgIGNhcmQuc2V0VGV4dCgnRXJyb3IgcmVhZGluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRoZSBmaXJzdCBoZWFkaW5nIGFuZCBmaXJzdCBwYXJhZ3JhcGggdXNpbmcgbWV0YWRhdGFDYWNoZSBvZmZzZXRzLlxuICAgKiBGYWxscyBiYWNrIHRvIG1hbnVhbCBwYXJzaW5nIG9ubHkgaWYgY2FjaGUgaXMgdW5hdmFpbGFibGUuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQ29udGVudChjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiB7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH0ge1xuICAgIC8vIFVzZSBjYWNoZWQgaGVhZGluZyBpZiBhdmFpbGFibGUgKGF2b2lkcyBtYW51YWwgcGFyc2luZylcbiAgICBjb25zdCBoZWFkaW5nID0gY2FjaGU/LmhlYWRpbmdzPy5bMF0/LmhlYWRpbmcgPz8gJyc7XG5cbiAgICAvLyBTa2lwIGZyb250bWF0dGVyIHVzaW5nIHRoZSBjYWNoZWQgb2Zmc2V0XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcblxuICAgIC8vIEZpcnN0IG5vbi1lbXB0eSwgbm9uLWhlYWRpbmcgbGluZSBpcyB0aGUgYm9keVxuICAgIGNvbnN0IGJvZHkgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmluZChsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKSA/PyAnJztcblxuICAgIHJldHVybiB7IGhlYWRpbmcsIGJvZHkgfTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW5zaWdodFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW5zaWdodCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnRGFpbHkgSW5zaWdodCcpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRGFpbHkgc2VlZCcpLnNldERlc2MoJ1Nob3cgc2FtZSBub3RlIGFsbCBkYXknKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5kYWlseVNlZWQgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZGFpbHlTZWVkID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIFJldHVybnMgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdCB0aGF0IGhhdmUgdGhlIGdpdmVuIHRhZy5cbiAqIGB0YWdgIG11c3QgaW5jbHVkZSB0aGUgbGVhZGluZyBgI2AgKGUuZy4gYCN2YWx1ZXNgKS5cbiAqIEhhbmRsZXMgYm90aCBpbmxpbmUgdGFncyBhbmQgWUFNTCBmcm9udG1hdHRlciB0YWdzICh3aXRoIG9yIHdpdGhvdXQgYCNgKSxcbiAqIGFuZCBmcm9udG1hdHRlciB0YWdzIHRoYXQgYXJlIGEgcGxhaW4gc3RyaW5nIGluc3RlYWQgb2YgYW4gYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlc1dpdGhUYWcoYXBwOiBBcHAsIHRhZzogc3RyaW5nKTogVEZpbGVbXSB7XG4gIHJldHVybiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcihmaWxlID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICBpZiAoIWNhY2hlKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBpbmxpbmVUYWdzID0gY2FjaGUudGFncz8ubWFwKHQgPT4gdC50YWcpID8/IFtdO1xuXG4gICAgY29uc3QgcmF3Rm1UYWdzID0gY2FjaGUuZnJvbnRtYXR0ZXI/LnRhZ3M7XG4gICAgY29uc3QgZm1UYWdBcnJheTogc3RyaW5nW10gPVxuICAgICAgQXJyYXkuaXNBcnJheShyYXdGbVRhZ3MpID8gcmF3Rm1UYWdzLmZpbHRlcigodCk6IHQgaXMgc3RyaW5nID0+IHR5cGVvZiB0ID09PSAnc3RyaW5nJykgOlxuICAgICAgdHlwZW9mIHJhd0ZtVGFncyA9PT0gJ3N0cmluZycgPyBbcmF3Rm1UYWdzXSA6XG4gICAgICBbXTtcbiAgICBjb25zdCBub3JtYWxpemVkRm1UYWdzID0gZm1UYWdBcnJheS5tYXAodCA9PiB0LnN0YXJ0c1dpdGgoJyMnKSA/IHQgOiBgIyR7dH1gKTtcblxuICAgIHJldHVybiBpbmxpbmVUYWdzLmluY2x1ZGVzKHRhZykgfHwgbm9ybWFsaXplZEZtVGFncy5pbmNsdWRlcyh0YWcpO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgVmFsdWVJdGVtIHtcbiAgZW1vamk6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgbGluaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRhZ0dyaWRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygndGFnLWdyaWQtYmxvY2snKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnVmFsdWVzJywgY29sdW1ucyA9IDIsIGl0ZW1zID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIGl0ZW1zPzogVmFsdWVJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBncmlkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAndGFnLWdyaWQnIH0pO1xuICAgIGdyaWQuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBoaW50ID0gZ3JpZC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjNGN31cXHVGRTBGJyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGl0ZW1zIHlldC4gQWRkIHZhbHVlcyB3aXRoIGVtb2ppcyBhbmQgbGFiZWxzIGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3RhZy1idG4nIH0pO1xuICAgICAgaWYgKGl0ZW0uZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICd0YWctYnRuLWVtb2ppJywgdGV4dDogaXRlbS5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogaXRlbS5sYWJlbCB9KTtcbiAgICAgIGlmIChpdGVtLmxpbmspIHtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaXRlbS5saW5rISwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ0bi5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBWYWx1ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgVmFsdWVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnVmFsdWVzIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRyYWZ0Lml0ZW1zKSkgZHJhZnQuaXRlbXMgPSBbXTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1ZhbHVlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzEnLCAnMScpLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdJdGVtcycsIGNsczogJ3NldHRpbmctaXRlbS1uYW1lJyB9KTtcblxuICAgIGNvbnN0IGxpc3RFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICd2YWx1ZXMtaXRlbS1saXN0JyB9KTtcbiAgICBjb25zdCByZW5kZXJMaXN0ID0gKCkgPT4ge1xuICAgICAgbGlzdEVsLmVtcHR5KCk7XG4gICAgICBkcmFmdC5pdGVtcyEuZm9yRWFjaCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tcm93JyB9KTtcblxuICAgICAgICBjb25zdCBlbW9qaUlucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1lbW9qaScgfSk7XG4gICAgICAgIGVtb2ppSW5wdXQudmFsdWUgPSBpdGVtLmVtb2ppO1xuICAgICAgICBlbW9qaUlucHV0LnBsYWNlaG9sZGVyID0gJ1x1RDgzRFx1REUwMCc7XG4gICAgICAgIGVtb2ppSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0uZW1vamkgPSBlbW9qaUlucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsYWJlbElucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1sYWJlbCcgfSk7XG4gICAgICAgIGxhYmVsSW5wdXQudmFsdWUgPSBpdGVtLmxhYmVsO1xuICAgICAgICBsYWJlbElucHV0LnBsYWNlaG9sZGVyID0gJ0xhYmVsJztcbiAgICAgICAgbGFiZWxJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5sYWJlbCA9IGxhYmVsSW5wdXQudmFsdWU7IH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGluaycgfSk7XG4gICAgICAgIGxpbmtJbnB1dC52YWx1ZSA9IGl0ZW0ubGluayA/PyAnJztcbiAgICAgICAgbGlua0lucHV0LnBsYWNlaG9sZGVyID0gJ05vdGUgcGF0aCAob3B0aW9uYWwpJztcbiAgICAgICAgbGlua0lucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmxpbmsgPSBsaW5rSW5wdXQudmFsdWUgfHwgdW5kZWZpbmVkOyB9KTtcblxuICAgICAgICBjb25zdCBkZWxCdG4gPSByb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndmFsdWVzLWl0ZW0tZGVsJywgdGV4dDogJ1x1MjcxNScgfSk7XG4gICAgICAgIGRlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICBkcmFmdC5pdGVtcyEuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpc3QoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJysgQWRkIGl0ZW0nKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgZHJhZnQuaXRlbXMhLnB1c2goeyBlbW9qaTogJycsIGxhYmVsOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlzdCgpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gT25seSBhc3NpZ24gc2FmZSBDU1MgY29sb3IgdmFsdWVzOyByZWplY3QgcG90ZW50aWFsbHkgbWFsaWNpb3VzIHN0cmluZ3NcbmNvbnN0IENPTE9SX1JFID0gL14oI1swLTlhLWZBLUZdezMsOH18W2EtekEtWl0rfHJnYmE/XFwoW14pXStcXCl8aHNsYT9cXChbXildK1xcKSkkLztcblxudHlwZSBRdW90ZXNDb25maWcgPSB7XG4gIHNvdXJjZT86ICd0YWcnIHwgJ3RleHQnO1xuICB0YWc/OiBzdHJpbmc7XG4gIHF1b3Rlcz86IHN0cmluZztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGNvbHVtbnM/OiBudW1iZXI7XG4gIG1heEl0ZW1zPzogbnVtYmVyO1xufTtcblxuZXhwb3J0IGNsYXNzIFF1b3Rlc0xpc3RCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygncXVvdGVzLWxpc3QtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHF1b3Rlcy4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHNvdXJjZSA9ICd0YWcnLCB0YWcgPSAnJywgcXVvdGVzID0gJycsIHRpdGxlID0gJ1F1b3RlcycsIGNvbHVtbnMgPSAyLCBtYXhJdGVtcyA9IDIwIH0gPVxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgUXVvdGVzQ29uZmlnO1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNvbHNFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3F1b3Rlcy1jb2x1bW5zJyB9KTtcblxuICAgIGNvbnN0IE1JTl9DT0xfV0lEVEggPSAyMDA7XG4gICAgY29uc3QgdXBkYXRlQ29scyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHcgPSBjb2xzRWwub2Zmc2V0V2lkdGg7XG4gICAgICBjb25zdCBlZmZlY3RpdmUgPSB3ID4gMCA/IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIE1hdGguZmxvb3IodyAvIE1JTl9DT0xfV0lEVEgpKSkgOiBjb2x1bW5zO1xuICAgICAgY29sc0VsLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7ZWZmZWN0aXZlfSwgMWZyKWA7XG4gICAgfTtcbiAgICB1cGRhdGVDb2xzKCk7XG4gICAgY29uc3Qgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIodXBkYXRlQ29scyk7XG4gICAgcm8ub2JzZXJ2ZShjb2xzRWwpO1xuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcm8uZGlzY29ubmVjdCgpKTtcblxuICAgIGlmIChzb3VyY2UgPT09ICd0ZXh0Jykge1xuICAgICAgdGhpcy5yZW5kZXJUZXh0UXVvdGVzKGNvbHNFbCwgcXVvdGVzLCBtYXhJdGVtcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc291cmNlID09PSAndGFnJ1xuICAgIGlmICghdGFnKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEFDfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHB1bGwgcXVvdGVzIGZyb20geW91ciBub3Rlcy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCkuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgLy8gUmVhZCBhbGwgZmlsZXMgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBmaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICAgIHJldHVybiB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH07XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgcmVzdWx0LnJlYXNvbik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH0gPSByZXN1bHQudmFsdWU7XG4gICAgICBjb25zdCBjb2xvciA9IGNhY2hlPy5mcm9udG1hdHRlcj8uY29sb3IgYXMgc3RyaW5nID8/ICcnO1xuICAgICAgY29uc3QgYm9keSA9IHRoaXMuZXh0cmFjdEJvZHkoY29udGVudCwgY2FjaGUpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IHF1b3RlID0gaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGNvbG9yIGJlZm9yZSBhcHBseWluZyB0byBwcmV2ZW50IENTUyBpbmplY3Rpb25cbiAgICAgIGlmIChjb2xvciAmJiBDT0xPUl9SRS50ZXN0KGNvbG9yKSkge1xuICAgICAgICBxdW90ZS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBjb2xvcjtcbiAgICAgICAgcXVvdGUuc3R5bGUuY29sb3IgPSBjb2xvcjtcbiAgICAgIH1cblxuICAgICAgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgcXVvdGVzIGZyb20gcGxhaW4gdGV4dC4gRWFjaCBxdW90ZSBpcyBzZXBhcmF0ZWQgYnkgYC0tLWAgb24gaXRzIG93biBsaW5lLlxuICAgKiBPcHRpb25hbGx5IGEgc291cmNlIGxpbmUgY2FuIGZvbGxvdyB0aGUgcXVvdGUgdGV4dCwgcHJlZml4ZWQgd2l0aCBgXHUyMDE0YCwgYFx1MjAxM2AsIG9yIGAtLWAuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqICAgVGhlIG9ubHkgd2F5IHRvIGRvIGdyZWF0IHdvcmsgaXMgdG8gbG92ZSB3aGF0IHlvdSBkby5cbiAgICogICBcdTIwMTQgU3RldmUgSm9ic1xuICAgKiAgIC0tLVxuICAgKiAgIEluIHRoZSBtaWRkbGUgb2YgZGlmZmljdWx0eSBsaWVzIG9wcG9ydHVuaXR5LlxuICAgKiAgIFx1MjAxNCBBbGJlcnQgRWluc3RlaW5cbiAgICovXG4gIHByaXZhdGUgcmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWw6IEhUTUxFbGVtZW50LCByYXc6IHN0cmluZywgbWF4SXRlbXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghcmF3LnRyaW0oKSkge1xuICAgICAgY29uc3QgaGludCA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRBQ30nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gcXVvdGVzIHlldC4gQWRkIHRoZW0gaW4gc2V0dGluZ3MsIHNlcGFyYXRlZCBieSAtLS0uJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBibG9ja3MgPSByYXcuc3BsaXQoL1xcbi0tLVxcbi8pLm1hcChiID0+IGIudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gYmxvY2suc3BsaXQoJ1xcbicpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgaGFzU291cmNlID0gbGluZXMubGVuZ3RoID4gMSAmJiAvXihcdTIwMTR8XHUyMDEzfC0tKS8udGVzdChsYXN0TGluZSk7XG4gICAgICBjb25zdCBzb3VyY2VUZXh0ID0gaGFzU291cmNlID8gbGFzdExpbmUucmVwbGFjZSgvXihcdTIwMTR8XHUyMDEzfC0tKVxccyovLCAnJykgOiAnJztcbiAgICAgIGNvbnN0IGJvZHlMaW5lcyA9IGhhc1NvdXJjZSA/IGxpbmVzLnNsaWNlKDAsIC0xKSA6IGxpbmVzO1xuICAgICAgY29uc3QgYm9keSA9IGJvZHlMaW5lcy5qb2luKCcgJyk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG4gICAgICBpZiAoc291cmNlVGV4dCkgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBzb3VyY2VUZXh0IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBFeHRyYWN0IHRoZSBmaXJzdCBmZXcgbGluZXMgb2YgYm9keSBjb250ZW50IHVzaW5nIG1ldGFkYXRhQ2FjaGUgZnJvbnRtYXR0ZXIgb2Zmc2V0LiAqL1xuICBwcml2YXRlIGV4dHJhY3RCb2R5KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcbiAgICBjb25zdCBsaW5lcyA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSk7XG4gICAgcmV0dXJuIGxpbmVzLnNsaWNlKDAsIDMpLmpvaW4oJyAnKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgUXVvdGVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFF1b3Rlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1b3RlcyBMaXN0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyBRdW90ZXNDb25maWc7XG4gICAgZHJhZnQuc291cmNlID8/PSAndGFnJztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBTb3VyY2UgdG9nZ2xlIFx1MjAxNCBzaG93cy9oaWRlcyB0aGUgcmVsZXZhbnQgc2VjdGlvblxuICAgIGxldCB0YWdTZWN0aW9uOiBIVE1MRWxlbWVudDtcbiAgICBsZXQgdGV4dFNlY3Rpb246IEhUTUxFbGVtZW50O1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1NvdXJjZScpXG4gICAgICAuc2V0RGVzYygnUHVsbCBxdW90ZXMgZnJvbSB0YWdnZWQgbm90ZXMsIG9yIGVudGVyIHRoZW0gbWFudWFsbHkuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd0YWcnLCAnTm90ZXMgd2l0aCB0YWcnKVxuICAgICAgICAgLmFkZE9wdGlvbigndGV4dCcsICdNYW51YWwgdGV4dCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuc291cmNlID8/ICd0YWcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4ge1xuICAgICAgICAgICBkcmFmdC5zb3VyY2UgPSB2IGFzICd0YWcnIHwgJ3RleHQnO1xuICAgICAgICAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBUYWcgc2VjdGlvblxuICAgIHRhZ1NlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgIG5ldyBTZXR0aW5nKHRhZ1NlY3Rpb24pLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFRleHQgc2VjdGlvblxuICAgIHRleHRTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgIGNvbnN0IHRleHRTZXR0aW5nID0gbmV3IFNldHRpbmcodGV4dFNlY3Rpb24pXG4gICAgICAuc2V0TmFtZSgnUXVvdGVzJylcbiAgICAgIC5zZXREZXNjKCdTZXBhcmF0ZSBxdW90ZXMgd2l0aCAtLS0gb24gaXRzIG93biBsaW5lLiBBZGQgYSBzb3VyY2UgbGluZSBzdGFydGluZyB3aXRoIFx1MjAxNCAoZS5nLiBcdTIwMTQgQXV0aG9yKS4nKTtcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdjb2x1bW4nO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5hbGlnbkl0ZW1zID0gJ3N0cmV0Y2gnO1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGV4dFNldHRpbmcuc2V0dGluZ0VsLmNyZWF0ZUVsKCd0ZXh0YXJlYScpO1xuICAgIHRleHRhcmVhLnJvd3MgPSA4O1xuICAgIHRleHRhcmVhLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIHRleHRhcmVhLnN0eWxlLm1hcmdpblRvcCA9ICc4cHgnO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRGYW1pbHkgPSAndmFyKC0tZm9udC1tb25vc3BhY2UpJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LnF1b3RlcyA/PyAnJztcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQucXVvdGVzID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+XG4gICAgICBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQge1xuICAgIHRoaXMub25DaG9vc2UoZm9sZGVyKTtcbiAgfVxufVxuXG5jb25zdCBJTUFHRV9FWFRTID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy53ZWJwJywgJy5zdmcnXSk7XG5jb25zdCBWSURFT19FWFRTID0gbmV3IFNldChbJy5tcDQnLCAnLndlYm0nLCAnLm1vdicsICcubWt2J10pO1xuXG5leHBvcnQgY2xhc3MgSW1hZ2VHYWxsZXJ5QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2ltYWdlLWdhbGxlcnktYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW1hZ2VHYWxsZXJ5QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgZ2FsbGVyeS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZvbGRlciA9ICcnLCB0aXRsZSA9ICdHYWxsZXJ5JywgY29sdW1ucyA9IDMsIG1heEl0ZW1zID0gMjAsIGxheW91dCA9ICdncmlkJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgbWF4SXRlbXM/OiBudW1iZXI7XG4gICAgICBsYXlvdXQ/OiAnZ3JpZCcgfCAnbWFzb25yeSc7XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBnYWxsZXJ5ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW1hZ2UtZ2FsbGVyeScgfSk7XG5cbiAgICBpZiAobGF5b3V0ID09PSAnbWFzb25yeScpIHtcbiAgICAgIGdhbGxlcnkuYWRkQ2xhc3MoJ21hc29ucnktbGF5b3V0Jyk7XG4gICAgICBjb25zdCB1cGRhdGVDb2xzID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB3ID0gZ2FsbGVyeS5vZmZzZXRXaWR0aDtcbiAgICAgICAgY29uc3QgZWZmZWN0aXZlID0gdyA+IDAgPyBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBNYXRoLmZsb29yKHcgLyAxMDApKSkgOiBjb2x1bW5zO1xuICAgICAgICBnYWxsZXJ5LnN0eWxlLmNvbHVtbnMgPSBTdHJpbmcoZWZmZWN0aXZlKTtcbiAgICAgIH07XG4gICAgICB1cGRhdGVDb2xzKCk7XG4gICAgICBjb25zdCBybyA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVDb2xzKTtcbiAgICAgIHJvLm9ic2VydmUoZ2FsbGVyeSk7XG4gICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IHJvLmRpc2Nvbm5lY3QoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdhbGxlcnkuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoYXV0by1maWxsLCBtaW5tYXgobWF4KDcwcHgsIGNhbGMoMTAwJSAvICR7Y29sdW1uc30pKSwgMWZyKSlgO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyKSB7XG4gICAgICBjb25zdCBoaW50ID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjVCQ31cXHVGRTBGJyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGZvbGRlciBzZWxlY3RlZC4gUGljayBhbiBpbWFnZSBmb2xkZXIgaW4gc2V0dGluZ3MgdG8gZGlzcGxheSBhIGdhbGxlcnkuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KGBGb2xkZXIgXCIke2ZvbGRlcn1cIiBub3QgZm91bmQuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldE1lZGlhRmlsZXMoZm9sZGVyT2JqKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGV4dCA9IGAuJHtmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICBjb25zdCB3cmFwcGVyID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdnYWxsZXJ5LWl0ZW0nIH0pO1xuXG4gICAgICBpZiAoSU1BR0VfRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICBjb25zdCBpbWcgPSB3cmFwcGVyLmNyZWF0ZUVsKCdpbWcnKTtcbiAgICAgICAgaW1nLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgaW1nLmxvYWRpbmcgPSAnbGF6eSc7XG4gICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICB3cmFwcGVyLmFkZENsYXNzKCdnYWxsZXJ5LWl0ZW0tdmlkZW8nKTtcbiAgICAgICAgd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICd2aWRlby1wbGF5LW92ZXJsYXknLCB0ZXh0OiAnXHUyNUI2JyB9KTtcblxuICAgICAgICBjb25zdCB2aWRlbyA9IHdyYXBwZXIuY3JlYXRlRWwoJ3ZpZGVvJykgYXMgSFRNTFZpZGVvRWxlbWVudDtcbiAgICAgICAgdmlkZW8uc3JjID0gdGhpcy5hcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGZpbGUpO1xuICAgICAgICB2aWRlby5tdXRlZCA9IHRydWU7XG4gICAgICAgIHZpZGVvLmxvb3AgPSB0cnVlO1xuICAgICAgICB2aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgICAgICB2aWRlby5wcmVsb2FkID0gJ21ldGFkYXRhJztcblxuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7IHZvaWQgdmlkZW8ucGxheSgpOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4geyB2aWRlby5wYXVzZSgpOyB2aWRlby5jdXJyZW50VGltZSA9IDA7IH0pO1xuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TWVkaWFGaWxlcyhmb2xkZXI6IFRGb2xkZXIpOiBURmlsZVtdIHtcbiAgICBjb25zdCBmaWxlczogVEZpbGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgY29uc3QgZXh0ID0gYC4ke2NoaWxkLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkgfHwgVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICAgICAgZmlsZXMucHVzaChjaGlsZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKGZvbGRlcik7XG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbWFnZUdhbGxlcnlTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW1hZ2UgR2FsbGVyeSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnR2FsbGVyeScpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdGb2xkZXInKVxuICAgICAgLnNldERlc2MoJ1BpY2sgYSB2YXVsdCBmb2xkZXIuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdBdHRhY2htZW50cy9QaG90b3MnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0xheW91dCcpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCdncmlkJywgJ0dyaWQnKS5hZGRPcHRpb24oJ21hc29ucnknLCAnTWFzb25yeScpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5sYXlvdXQgPz8gJ2dyaWQnKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmxheW91dCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBjb25zdCBoaW50ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0QzR9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIG5vdGUgc2VsZWN0ZWQuIENob29zZSBhIGZpbGUgcGF0aCBpbiBzZXR0aW5ncyB0byBlbWJlZCBpdCBoZXJlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29uc3QgaGludCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRERH0nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gY29udGVudCB5ZXQuIEFkZCBNYXJrZG93biB0ZXh0IGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgJycsIHRoaXMpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFN0YXRpY1RleHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdTdGF0aWMgVGV4dCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSB0ZXh0LicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbnRlbnQnKS5zZXREZXNjKCdTdXBwb3J0cyBNYXJrZG93bi4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LmNvbnRlbnQgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMDtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuY29udGVudCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNhbml0aXplSFRNTFRvRG9tIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgSHRtbEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdodG1sLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGh0bWwgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBodG1sPzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaHRtbC1ibG9jay1jb250ZW50JyB9KTtcblxuICAgIGlmICghaHRtbCkge1xuICAgICAgY29uc3QgaGludCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJzwvPicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBIVE1MIGNvbnRlbnQgeWV0LiBBZGQgeW91ciBtYXJrdXAgaW4gc2V0dGluZ3MuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFBekI7QUFDRSxTQUFRLFlBQVksb0JBQUksSUFBNkI7QUFBQTtBQUFBLEVBRXJELFNBQVMsU0FBNkI7QUFDcEMsU0FBSyxVQUFVLElBQUksUUFBUSxNQUFNLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsSUFBSSxNQUEyQztBQUM3QyxXQUFPLEtBQUssVUFBVSxJQUFJLElBQUk7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBeUI7QUFDdkIsV0FBTyxNQUFNLEtBQUssS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN2QjtBQUNGO0FBRU8sSUFBTSxnQkFBZ0IsSUFBSSxtQkFBbUI7OztBRGY3QyxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQWV0QixZQUNFLGFBQ1EsS0FDQSxRQUNBLGdCQUNSO0FBSFE7QUFDQTtBQUNBO0FBakJWLFNBQVEsU0FBUyxvQkFBSSxJQUF3RDtBQUM3RSxTQUFRLFdBQVc7QUFFbkI7QUFBQSxTQUFRLHdCQUFnRDtBQUV4RDtBQUFBLFNBQVEsY0FBa0M7QUFDMUMsU0FBUSxpQkFBd0M7QUFDaEQsU0FBUSxtQkFBbUI7QUFFM0I7QUFBQSw2QkFBeUM7QUFFekM7QUFBQSxTQUFRLG1CQUFrQztBQVF4QyxTQUFLLFNBQVMsWUFBWSxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUM1RCxTQUFLLGlCQUFpQixJQUFJLGVBQWUsTUFBTTtBQUM3QyxZQUFNLGVBQWUsS0FBSyx3QkFBd0IsS0FBSyxPQUFPLE9BQU8sT0FBTztBQUM1RSxVQUFJLGlCQUFpQixLQUFLLGtCQUFrQjtBQUMxQyxhQUFLLFNBQVM7QUFBQSxNQUNoQjtBQUFBLElBQ0YsQ0FBQztBQUNELFNBQUssZUFBZSxRQUFRLEtBQUssTUFBTTtBQUFBLEVBQ3pDO0FBQUE7QUFBQSxFQUdBLGFBQTBCO0FBQ3hCLFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFBQSxFQUVRLHdCQUF3QixlQUErQjtBQUM3RCxVQUFNLElBQUksS0FBSyxPQUFPO0FBQ3RCLFFBQUksS0FBSyxFQUFHLFFBQU87QUFDbkIsUUFBSSxLQUFLLElBQUssUUFBTztBQUNyQixRQUFJLEtBQUssSUFBSyxRQUFPLEtBQUssSUFBSSxHQUFHLGFBQWE7QUFDOUMsUUFBSSxLQUFLLEtBQU0sUUFBTyxLQUFLLElBQUksR0FBRyxhQUFhO0FBQy9DLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxPQUFPLFFBQXlCLFNBQXVCO0FBQ3JELFNBQUssV0FBVztBQUNoQixTQUFLLE9BQU8sTUFBTTtBQUNsQixTQUFLLE9BQU8sYUFBYSxRQUFRLE1BQU07QUFDdkMsU0FBSyxPQUFPLGFBQWEsY0FBYyxpQkFBaUI7QUFDeEQsU0FBSyxtQkFBbUIsS0FBSyx3QkFBd0IsT0FBTztBQUU1RCxRQUFJLEtBQUssVUFBVTtBQUNqQixXQUFLLE9BQU8sU0FBUyxXQUFXO0FBQUEsSUFDbEMsT0FBTztBQUNMLFdBQUssT0FBTyxZQUFZLFdBQVc7QUFBQSxJQUNyQztBQUVBLFFBQUksT0FBTyxXQUFXLEdBQUc7QUFDdkIsWUFBTSxRQUFRLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztBQUNuRSxZQUFNLFVBQVUsRUFBRSxLQUFLLHVCQUF1QixNQUFNLFlBQVksQ0FBQztBQUNqRSxZQUFNLFNBQVMsS0FBSyxFQUFFLEtBQUssd0JBQXdCLE1BQU0seUJBQXlCLENBQUM7QUFDbkYsWUFBTSxTQUFTLEtBQUs7QUFBQSxRQUNsQixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUixDQUFDO0FBQ0QsVUFBSSxLQUFLLFlBQVksS0FBSyxtQkFBbUI7QUFDM0MsY0FBTSxNQUFNLE1BQU0sU0FBUyxVQUFVLEVBQUUsS0FBSyxzQkFBc0IsTUFBTSx1QkFBdUIsQ0FBQztBQUNoRyxZQUFJLGlCQUFpQixTQUFTLE1BQU07QUEzRTVDO0FBMkU4QyxxQkFBSyxzQkFBTDtBQUFBLFFBQTRCLENBQUM7QUFBQSxNQUNyRTtBQUNBO0FBQUEsSUFDRjtBQUVBLGVBQVcsWUFBWSxRQUFRO0FBQzdCLFdBQUssWUFBWSxRQUFRO0FBQUEsSUFDM0I7QUFBQSxFQUNGO0FBQUEsRUFFUSxZQUFZLFVBQStCO0FBQ2pELFVBQU0sVUFBVSxjQUFjLElBQUksU0FBUyxJQUFJO0FBQy9DLFFBQUksQ0FBQyxRQUFTO0FBRWQsVUFBTSxVQUFVLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsQ0FBQztBQUN2RSxZQUFRLFFBQVEsVUFBVSxTQUFTO0FBQ25DLFlBQVEsYUFBYSxRQUFRLFVBQVU7QUFDdkMsWUFBUSxhQUFhLGNBQWMsUUFBUSxXQUFXO0FBQ3RELFNBQUssa0JBQWtCLFNBQVMsUUFBUTtBQUV4QyxRQUFJLEtBQUssVUFBVTtBQUNqQixXQUFLLGtCQUFrQixTQUFTLFFBQVE7QUFBQSxJQUMxQztBQUdBLFVBQU0sYUFBYSxRQUFRLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBQ2pFLFVBQU0sVUFBVSxXQUFXLFdBQVcsRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBRXZFLFVBQU0sWUFBWSxRQUFRLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQzVELFVBQU0sUUFBUSxRQUFRLE9BQU8sS0FBSyxLQUFLLFVBQVUsS0FBSyxNQUFNO0FBQzVELFVBQU0sbUJBQW1CLFVBQVU7QUFDbkMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxTQUFTLE1BQU0sT0FBTyxTQUFTO0FBQ3JDLFFBQUksa0JBQWtCLFNBQVM7QUFDN0IsYUFBTyxNQUFNLE9BQUs7QUFDaEIsZ0JBQVEsTUFBTSwyQ0FBMkMsU0FBUyxJQUFJLEtBQUssQ0FBQztBQUM1RSxrQkFBVSxRQUFRLG1EQUFtRDtBQUFBLE1BQ3ZFLENBQUM7QUFBQSxJQUNIO0FBRUEsUUFBSSxTQUFTLFVBQVcsU0FBUSxTQUFTLGlCQUFpQjtBQUUxRCxlQUFXLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUMxQyxRQUFFLGdCQUFnQjtBQUNsQixZQUFNLGlCQUFpQixDQUFDLFFBQVEsU0FBUyxpQkFBaUI7QUFDMUQsY0FBUSxZQUFZLG1CQUFtQixjQUFjO0FBQ3JELGNBQVEsWUFBWSxnQkFBZ0IsY0FBYztBQUNsRCxZQUFNLFlBQVksS0FBSyxPQUFPLE9BQU8sT0FBTztBQUFBLFFBQUksT0FDOUMsRUFBRSxPQUFPLFNBQVMsS0FBSyxFQUFFLEdBQUcsR0FBRyxXQUFXLGVBQWUsSUFBSTtBQUFBLE1BQy9EO0FBQ0EsV0FBSyxLQUFLLE9BQU8sV0FBVyxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsUUFBUSxVQUFVLENBQUM7QUFBQSxJQUMxRSxDQUFDO0FBRUQsUUFBSSxTQUFTLFVBQVcsU0FBUSxTQUFTLGNBQWM7QUFFdkQsU0FBSyxPQUFPLElBQUksU0FBUyxJQUFJLEVBQUUsT0FBTyxRQUFRLENBQUM7QUFBQSxFQUNqRDtBQUFBLEVBRVEsa0JBQWtCLFNBQXNCLFVBQStCO0FBQzdFLFVBQU0sT0FBTyxLQUFLO0FBQ2xCLFVBQU0sVUFBVSxLQUFLLElBQUksU0FBUyxTQUFTLElBQUk7QUFLL0MsVUFBTSxlQUFnQixVQUFVLE9BQVE7QUFDeEMsVUFBTSxlQUFlLE9BQU8sV0FBVztBQUN2QyxZQUFRLE1BQU0sT0FBTyxHQUFHLE9BQU8sV0FBVyxZQUFZLDZCQUE2QixZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQ3pHLFlBQVEsTUFBTSxXQUFXLFNBQVMsSUFBSSxNQUFNO0FBQUEsRUFDOUM7QUFBQSxFQUVRLGtCQUFrQixTQUFzQixVQUErQjtBQUM3RSxVQUFNLE1BQU0sUUFBUSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUV6RCxVQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUN6RCxpQ0FBUSxRQUFRLGVBQWU7QUFDL0IsV0FBTyxhQUFhLGNBQWMsaUJBQWlCO0FBQ25ELFdBQU8sYUFBYSxTQUFTLGlCQUFpQjtBQUU5QyxVQUFNLGNBQWMsSUFBSSxTQUFTLFVBQVUsRUFBRSxLQUFLLHFCQUFxQixDQUFDO0FBQ3hFLGlDQUFRLGFBQWEsVUFBVTtBQUMvQixnQkFBWSxhQUFhLGNBQWMsZ0JBQWdCO0FBQ3ZELGdCQUFZLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUMzQyxRQUFFLGdCQUFnQjtBQUNsQixZQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksU0FBUyxFQUFFO0FBQ3pDLFVBQUksQ0FBQyxNQUFPO0FBQ1osWUFBTSxTQUFTLE1BQU07QUFDbkIsY0FBTSxZQUFZLEtBQUssT0FBTyxPQUFPLE9BQU87QUFBQSxVQUFJLE9BQzlDLEVBQUUsT0FBTyxTQUFTLEtBQUssV0FBVztBQUFBLFFBQ3BDO0FBQ0EsYUFBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUNoRSxhQUFLLFNBQVM7QUFBQSxNQUNoQjtBQUNBLFVBQUksbUJBQW1CLEtBQUssS0FBSyxVQUFVLE1BQU0sT0FBTyxNQUFNLEVBQUUsS0FBSztBQUFBLElBQ3ZFLENBQUM7QUFFRCxVQUFNLFlBQVksSUFBSSxTQUFTLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3BFLGlDQUFRLFdBQVcsR0FBRztBQUN0QixjQUFVLGFBQWEsY0FBYyxjQUFjO0FBQ25ELGNBQVUsaUJBQWlCLFNBQVMsQ0FBQyxNQUFNO0FBQ3pDLFFBQUUsZ0JBQWdCO0FBQ2xCLFVBQUksd0JBQXdCLEtBQUssS0FBSyxNQUFNO0FBQzFDLGNBQU0sWUFBWSxLQUFLLE9BQU8sT0FBTyxPQUFPLE9BQU8sT0FBSyxFQUFFLE9BQU8sU0FBUyxFQUFFO0FBQzVFLGFBQUssZUFBZSxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsUUFBUSxVQUFVLENBQUM7QUFDaEUsYUFBSyxTQUFTO0FBQUEsTUFDaEIsQ0FBQyxFQUFFLEtBQUs7QUFBQSxJQUNWLENBQUM7QUFFRCxVQUFNLE9BQU8sUUFBUSxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUMzRCxpQ0FBUSxNQUFNLFlBQVk7QUFDMUIsU0FBSyxhQUFhLGNBQWMsZ0JBQWdCO0FBQ2hELFNBQUssYUFBYSxTQUFTLGdCQUFnQjtBQUMzQyxTQUFLLG9CQUFvQixNQUFNLFNBQVMsUUFBUTtBQUVoRCxTQUFLLGtCQUFrQixRQUFRLFNBQVMsUUFBUTtBQUFBLEVBQ2xEO0FBQUEsRUFFUSxrQkFBa0IsUUFBcUIsU0FBc0IsVUFBK0I7QUFDbEcsV0FBTyxpQkFBaUIsYUFBYSxDQUFDLE1BQWtCO0FBak01RDtBQWtNTSxRQUFFLGVBQWU7QUFFakIsaUJBQUssMEJBQUwsbUJBQTRCO0FBQzVCLFlBQU0sS0FBSyxJQUFJLGdCQUFnQjtBQUMvQixXQUFLLHdCQUF3QjtBQUU3QixZQUFNLFFBQVEsUUFBUSxVQUFVLElBQUk7QUFDcEMsWUFBTSxTQUFTLGtCQUFrQjtBQUNqQyxZQUFNLE1BQU0sUUFBUSxHQUFHLFFBQVEsV0FBVztBQUMxQyxZQUFNLE1BQU0sU0FBUyxHQUFHLFFBQVEsWUFBWTtBQUM1QyxZQUFNLE1BQU0sT0FBTyxHQUFHLEVBQUUsVUFBVSxRQUFRLGNBQWMsQ0FBQztBQUN6RCxZQUFNLE1BQU0sTUFBTSxHQUFHLEVBQUUsVUFBVSxFQUFFO0FBQ25DLGVBQVMsS0FBSyxZQUFZLEtBQUs7QUFDL0IsV0FBSyxjQUFjO0FBRW5CLFlBQU0sV0FBVyxTQUFTO0FBQzFCLGNBQVEsU0FBUyxnQkFBZ0I7QUFFakMsWUFBTSxrQkFBa0IsTUFBTTtBQUM1QixtQkFBVyxFQUFFLFNBQVMsRUFBRSxLQUFLLEtBQUssT0FBTyxPQUFPLEdBQUc7QUFDakQsWUFBRSxZQUFZLGVBQWUsWUFBWTtBQUFBLFFBQzNDO0FBQUEsTUFDRjtBQUVBLFlBQU0sY0FBYyxDQUFDLE9BQW1CO0FBMU45QyxZQUFBQztBQTJOUSxjQUFNLE1BQU0sT0FBTyxHQUFHLEdBQUcsVUFBVSxRQUFRLGNBQWMsQ0FBQztBQUMxRCxjQUFNLE1BQU0sTUFBTSxHQUFHLEdBQUcsVUFBVSxFQUFFO0FBRXBDLHdCQUFnQjtBQUNoQixjQUFNLEtBQUssS0FBSyxtQkFBbUIsR0FBRyxTQUFTLEdBQUcsU0FBUyxRQUFRO0FBQ25FLFlBQUksR0FBRyxVQUFVO0FBQ2YsV0FBQUEsTUFBQSxLQUFLLE9BQU8sSUFBSSxHQUFHLFFBQVEsTUFBM0IsZ0JBQUFBLElBQThCLFFBQVE7QUFBQSxZQUNwQyxHQUFHLGVBQWUsZ0JBQWdCO0FBQUE7QUFBQSxRQUV0QztBQUFBLE1BQ0Y7QUFFQSxZQUFNLFlBQVksQ0FBQyxPQUFtQjtBQUNwQyxXQUFHLE1BQU07QUFDVCxhQUFLLHdCQUF3QjtBQUM3QixjQUFNLE9BQU87QUFDYixhQUFLLGNBQWM7QUFDbkIsZ0JBQVEsWUFBWSxnQkFBZ0I7QUFDcEMsd0JBQWdCO0FBRWhCLGNBQU0sS0FBSyxLQUFLLG1CQUFtQixHQUFHLFNBQVMsR0FBRyxTQUFTLFFBQVE7QUFDbkUsYUFBSyxhQUFhLFVBQVUsR0FBRyxjQUFjO0FBQUEsTUFDL0M7QUFFQSxlQUFTLGlCQUFpQixhQUFhLGFBQWEsRUFBRSxRQUFRLEdBQUcsT0FBTyxDQUFDO0FBQ3pFLGVBQVMsaUJBQWlCLFdBQVcsV0FBVyxFQUFFLFFBQVEsR0FBRyxPQUFPLENBQUM7QUFBQSxJQUN2RSxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsb0JBQW9CLE1BQW1CLFNBQXNCLFVBQStCO0FBQ2xHLFNBQUssaUJBQWlCLGFBQWEsQ0FBQyxNQUFrQjtBQXpQMUQ7QUEwUE0sUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBRWxCLGlCQUFLLDBCQUFMLG1CQUE0QjtBQUM1QixZQUFNLEtBQUssSUFBSSxnQkFBZ0I7QUFDL0IsV0FBSyx3QkFBd0I7QUFFN0IsWUFBTSxTQUFTLEVBQUU7QUFDakIsWUFBTSxlQUFlLFNBQVM7QUFDOUIsWUFBTSxVQUFVLEtBQUs7QUFDckIsWUFBTSxXQUFXLEtBQUssT0FBTyxjQUFjO0FBQzNDLFVBQUksaUJBQWlCO0FBRXJCLFlBQU0sY0FBYyxDQUFDLE9BQW1CO0FBQ3RDLGNBQU0sU0FBUyxHQUFHLFVBQVU7QUFDNUIsY0FBTSxZQUFZLEtBQUssTUFBTSxTQUFTLFFBQVE7QUFDOUMseUJBQWlCLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxTQUFTLGVBQWUsU0FBUyxDQUFDO0FBQ3hFLGNBQU0sZUFBZ0IsaUJBQWlCLFVBQVc7QUFDbEQsY0FBTSxlQUFlLFVBQVUsa0JBQWtCO0FBQ2pELGdCQUFRLE1BQU0sT0FBTyxHQUFHLGNBQWMsV0FBVyxZQUFZLDZCQUE2QixZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQUEsTUFDbEg7QUFFQSxZQUFNLFlBQVksTUFBTTtBQUN0QixXQUFHLE1BQU07QUFDVCxhQUFLLHdCQUF3QjtBQUU3QixjQUFNLFlBQVksS0FBSyxPQUFPLE9BQU8sT0FBTztBQUFBLFVBQUksT0FDOUMsRUFBRSxPQUFPLFNBQVMsS0FBSyxFQUFFLEdBQUcsR0FBRyxTQUFTLGVBQWUsSUFBSTtBQUFBLFFBQzdEO0FBQ0EsYUFBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUNoRSxhQUFLLFNBQVM7QUFBQSxNQUNoQjtBQUVBLGVBQVMsaUJBQWlCLGFBQWEsYUFBYSxFQUFFLFFBQVEsR0FBRyxPQUFPLENBQUM7QUFDekUsZUFBUyxpQkFBaUIsV0FBVyxXQUFXLEVBQUUsUUFBUSxHQUFHLE9BQU8sQ0FBQztBQUFBLElBQ3ZFLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxtQkFDTixHQUNBLEdBQ0EsV0FDbUY7QUFDbkYsUUFBSSxlQUE4QjtBQUNsQyxRQUFJLFdBQVc7QUFDZixRQUFJLG1CQUFtQjtBQUV2QixlQUFXLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEtBQUssUUFBUTtBQUMzQyxVQUFJLE9BQU8sVUFBVztBQUN0QixZQUFNLE9BQU8sUUFBUSxzQkFBc0I7QUFDM0MsWUFBTSxLQUFLLEtBQUssT0FBTyxLQUFLLFFBQVE7QUFDcEMsWUFBTSxLQUFLLEtBQUssTUFBTSxLQUFLLFNBQVM7QUFHcEMsVUFBSSxLQUFLLEtBQUssUUFBUSxLQUFLLEtBQUssU0FBUyxLQUFLLEtBQUssT0FBTyxLQUFLLEtBQUssUUFBUTtBQUMxRSxjQUFNLGVBQWUsSUFBSTtBQUN6QixlQUFPLEVBQUUsVUFBVSxJQUFJLGNBQWMsZ0JBQWdCLGVBQWUsS0FBSyxLQUFLLFlBQVksRUFBRSxFQUFFO0FBQUEsTUFDaEc7QUFFQSxZQUFNLE9BQU8sS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLEVBQUU7QUFDdEMsVUFBSSxPQUFPLFVBQVU7QUFDbkIsbUJBQVc7QUFDWCx1QkFBZTtBQUNmLDJCQUFtQixJQUFJO0FBQUEsTUFDekI7QUFBQSxJQUNGO0FBRUEsUUFBSSxDQUFDLGFBQWMsUUFBTyxFQUFFLFVBQVUsTUFBTSxjQUFjLE1BQU0sZ0JBQWdCLEtBQUs7QUFDckYsV0FBTztBQUFBLE1BQ0wsVUFBVTtBQUFBLE1BQ1YsY0FBYztBQUFBLE1BQ2QsZ0JBQWdCLG1CQUFtQixlQUFlLEtBQUssWUFBWSxZQUFZO0FBQUEsSUFDakY7QUFBQSxFQUNGO0FBQUEsRUFFUSxZQUFZLElBQTJCO0FBQzdDLFVBQU0sU0FBUyxLQUFLLE9BQU8sT0FBTztBQUNsQyxVQUFNLE1BQU0sT0FBTyxVQUFVLE9BQUssRUFBRSxPQUFPLEVBQUU7QUFDN0MsV0FBTyxPQUFPLEtBQUssTUFBTSxPQUFPLFNBQVMsSUFBSSxPQUFPLE1BQU0sQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNwRTtBQUFBO0FBQUEsRUFHUSxhQUFhLFdBQW1CLGdCQUFxQztBQUMzRSxVQUFNLFNBQVMsS0FBSyxPQUFPLE9BQU87QUFDbEMsVUFBTSxVQUFVLE9BQU8sS0FBSyxPQUFLLEVBQUUsT0FBTyxTQUFTO0FBQ25ELFFBQUksQ0FBQyxRQUFTO0FBRWQsVUFBTSxpQkFBaUIsT0FBTyxPQUFPLE9BQUssRUFBRSxPQUFPLFNBQVM7QUFDNUQsVUFBTSxXQUFXLGlCQUNiLGVBQWUsVUFBVSxPQUFLLEVBQUUsT0FBTyxjQUFjLElBQ3JELGVBQWU7QUFHbkIsVUFBTSxjQUFjLE9BQU8sVUFBVSxPQUFLLEVBQUUsT0FBTyxTQUFTO0FBQzVELFVBQU0sYUFBYSxhQUFhLEtBQUssZUFBZSxTQUFTO0FBQzdELFFBQUksZUFBZSxlQUFlLGVBQWUsY0FBYyxFQUFHO0FBRWxFLFVBQU0sWUFBWTtBQUFBLE1BQ2hCLEdBQUcsZUFBZSxNQUFNLEdBQUcsVUFBVTtBQUFBLE1BQ3JDO0FBQUEsTUFDQSxHQUFHLGVBQWUsTUFBTSxVQUFVO0FBQUEsSUFDcEM7QUFDQSxTQUFLLGVBQWUsRUFBRSxHQUFHLEtBQUssT0FBTyxRQUFRLFFBQVEsVUFBVSxDQUFDO0FBQ2hFLFNBQUssU0FBUztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxZQUFZLFNBQXdCO0FBQ2xDLFNBQUssV0FBVztBQUNoQixTQUFLLFNBQVM7QUFBQSxFQUNoQjtBQUFBO0FBQUEsRUFHQSxXQUFXLEdBQWlCO0FBQzFCLFVBQU0sWUFBWSxLQUFLLE9BQU8sT0FBTyxPQUFPLElBQUksT0FBSztBQUNuRCxZQUFNLE1BQU0sS0FBSyxJQUFJLEVBQUUsS0FBSyxDQUFDO0FBQzdCLFlBQU0sVUFBVSxLQUFLLElBQUksRUFBRSxTQUFTLElBQUksTUFBTSxDQUFDO0FBQy9DLGFBQU8sRUFBRSxHQUFHLEdBQUcsS0FBSyxRQUFRO0FBQUEsSUFDOUIsQ0FBQztBQUNELFNBQUssZUFBZSxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsU0FBUyxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQzVFLFNBQUssU0FBUztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxTQUFTLFVBQStCO0FBQ3RDLFVBQU0sWUFBWSxDQUFDLEdBQUcsS0FBSyxPQUFPLE9BQU8sUUFBUSxRQUFRO0FBQ3pELFNBQUssbUJBQW1CLFNBQVM7QUFDakMsU0FBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUNoRSxTQUFLLFNBQVM7QUFBQSxFQUNoQjtBQUFBLEVBRVEsV0FBaUI7QUEzWDNCO0FBNFhJLFVBQU0sVUFBVSxTQUFTO0FBQ3pCLFVBQU0sa0JBQWtCLHdDQUFTLFFBQVEsdUJBQWpCLG1CQUE0RCxRQUFRO0FBQzVGLFVBQU0saUJBQWlCLEtBQUs7QUFDNUIsU0FBSyxtQkFBbUI7QUFFeEIsU0FBSyxPQUFPLEtBQUssT0FBTyxPQUFPLFFBQVEsS0FBSyxPQUFPLE9BQU8sT0FBTztBQUVqRSxRQUFJLGdCQUFnQjtBQUNsQixZQUFNLFFBQVEsS0FBSyxPQUFPLGNBQTJCLG1CQUFtQixjQUFjLElBQUk7QUFDMUYsVUFBSSxPQUFPO0FBQ1QsY0FBTSxTQUFTLGtCQUFrQjtBQUNqQyxjQUFNLGVBQWUsRUFBRSxVQUFVLFVBQVUsT0FBTyxVQUFVLENBQUM7QUFBQSxNQUMvRDtBQUFBLElBQ0YsV0FBVyxnQkFBZ0I7QUFDekIsWUFBTSxLQUFLLEtBQUssT0FBTyxjQUEyQixtQkFBbUIsY0FBYyxJQUFJO0FBQ3ZGLCtCQUFJO0FBQUEsSUFDTjtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0EsYUFBbUI7QUFoWnJCO0FBaVpJLGVBQUssMEJBQUwsbUJBQTRCO0FBQzVCLFNBQUssd0JBQXdCO0FBQzdCLGVBQUssZ0JBQUwsbUJBQWtCO0FBQ2xCLFNBQUssY0FBYztBQUVuQixlQUFXLEVBQUUsTUFBTSxLQUFLLEtBQUssT0FBTyxPQUFPLEdBQUc7QUFDNUMsWUFBTSxPQUFPO0FBQUEsSUFDZjtBQUNBLFNBQUssT0FBTyxNQUFNO0FBQUEsRUFDcEI7QUFBQTtBQUFBLEVBR0EsVUFBZ0I7QUE3WmxCO0FBOFpJLGVBQUssbUJBQUwsbUJBQXFCO0FBQ3JCLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssV0FBVztBQUNoQixTQUFLLE9BQU8sT0FBTztBQUFBLEVBQ3JCO0FBQ0Y7QUFLQSxJQUFNLG1CQUF1QztBQUFBO0FBQUEsRUFFM0MsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG1CQUFtQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQ2hGLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxtQkFBbUI7QUFBQSxFQUMvRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQzFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUssdUJBQXVCO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFDNUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBO0FBQUEsRUFFM0UsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG1CQUFtQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQzFFLENBQUMsVUFBSSxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFDeEUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQSxFQUFFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUMzRSxDQUFDLFVBQUksZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUNqRSxDQUFDLGFBQUssYUFBYTtBQUFBLEVBQUUsQ0FBQyxhQUFLLFlBQVk7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBO0FBQUEsRUFFbEYsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHdCQUF3QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGFBQWE7QUFBQSxFQUNqRixDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLGFBQUssV0FBVztBQUFBLEVBQ3ZFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUFFLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUM5RSxDQUFDLFVBQUksMkJBQTJCO0FBQUEsRUFBRSxDQUFDLFVBQUksdUJBQXVCO0FBQUEsRUFBRSxDQUFDLGFBQUssU0FBUztBQUFBLEVBQy9FLENBQUMsVUFBSSxrQkFBa0I7QUFBQSxFQUFFLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsVUFBSSxlQUFlO0FBQUEsRUFDMUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQSxFQUM5RSxDQUFDLGFBQUssbUJBQW1CO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQUE7QUFBQSxFQUVyRCxDQUFDLFVBQUksc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBLEVBQUUsQ0FBQyxhQUFLLFlBQVk7QUFBQSxFQUNwRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLGFBQUssbUJBQW1CO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBO0FBQUEsRUFFekUsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQ2hGLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyw0QkFBNEI7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUN6RixDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUN0RSxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQTtBQUFBLEVBRXJFLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsVUFBSSxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFDN0UsQ0FBQyxhQUFLLFlBQVk7QUFBQSxFQUFFLENBQUMsYUFBSyxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBO0FBQUEsRUFFOUQsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGFBQWE7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUN6RSxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBLEVBQ3pFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUFFLENBQUMsYUFBSyxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFDdkUsQ0FBQyxhQUFLLHdCQUF3QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLHVCQUF1QjtBQUFBLEVBQ3JGLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsVUFBSSxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUN2RSxDQUFDLGFBQUssdUJBQXVCO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFDekQsQ0FBQyxhQUFLLHlCQUF5QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQ3BGLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyx5QkFBeUI7QUFBQSxFQUM3RCxDQUFDLGFBQUssNEJBQTRCO0FBQUEsRUFBRSxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFDaEUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQzVFLENBQUMsVUFBSSx1QkFBdUI7QUFBQSxFQUFFLENBQUMsYUFBSyxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFDM0UsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBO0FBQUEsRUFFdkQsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHdCQUF3QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUNsRixDQUFDLFVBQUksZUFBZTtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLDBCQUEwQjtBQUFBLEVBQ2xGLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUNuRixDQUFDLGFBQUssYUFBYTtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQTtBQUFBLEVBRTFDLENBQUMsVUFBSSx5QkFBeUI7QUFBQSxFQUFFLENBQUMsVUFBSSw2QkFBNkI7QUFBQSxFQUNsRSxDQUFDLFVBQUksdUJBQXVCO0FBQUEsRUFBRSxDQUFDLFVBQUksZUFBZTtBQUFBLEVBQUUsQ0FBQyxVQUFJLHVCQUF1QjtBQUFBLEVBQ2hGLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUFFLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUNwRixDQUFDLGFBQUsseUJBQXlCO0FBQUEsRUFBRSxDQUFDLFVBQUksc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFDckYsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUFFLENBQUMsVUFBSSxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyw2QkFBNkI7QUFBQSxFQUNyRixDQUFDLGFBQUssMkJBQTJCO0FBQUEsRUFBRSxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFDL0QsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQ2pGLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQTtBQUFBLEVBRWhELENBQUMsYUFBSyw0QkFBNEI7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUM5RCxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssd0JBQXdCO0FBQUEsRUFDNUQsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLGNBQWM7QUFBQSxFQUN0RSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQ3JFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUFFLENBQUMsVUFBSSx3QkFBd0I7QUFBQSxFQUFFLENBQUMsVUFBSSxnQkFBZ0I7QUFBQSxFQUM5RSxDQUFDLFVBQUksVUFBVTtBQUFBLEVBQUUsQ0FBQyxVQUFJLGNBQWM7QUFBQSxFQUFFLENBQUMsYUFBSyxtQkFBbUI7QUFBQSxFQUMvRCxDQUFDLFVBQUksbUJBQW1CO0FBQUEsRUFBRSxDQUFDLFVBQUksYUFBYTtBQUFBLEVBQUUsQ0FBQyxVQUFJLFlBQVk7QUFBQSxFQUMvRCxDQUFDLFVBQUksWUFBWTtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUMvQztBQUVBLElBQU0scUJBQU4sY0FBaUMsc0JBQU07QUFBQSxFQUNyQyxZQUNFLEtBQ1EsVUFDQSxPQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFKRDtBQUNBO0FBQ0E7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBQ2IsVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRW5ELFVBQU0sUUFBUSxnQkFBZ0IsS0FBSyxTQUFTLE1BQU07QUFFbEQsUUFBSSx3QkFBUSxTQUFTLEVBQ2xCLFFBQVEsYUFBYSxFQUNyQixRQUFRLHVDQUF1QyxFQUMvQztBQUFBLE1BQVEsT0FDUCxFQUFFLFNBQVMsT0FBTyxNQUFNLGdCQUFnQixXQUFXLE1BQU0sY0FBYyxFQUFFLEVBQ3ZFLGVBQWUsZUFBZSxFQUM5QixTQUFTLE9BQUs7QUFBRSxjQUFNLGNBQWM7QUFBQSxNQUFHLENBQUM7QUFBQSxJQUM1QztBQUdGLFVBQU0sV0FBVyxVQUFVLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ2hFLGFBQVMsV0FBVyxFQUFFLEtBQUsscUJBQXFCLE1BQU0sY0FBYyxDQUFDO0FBRXJFLFVBQU0sV0FBVyxTQUFTLFVBQVUsRUFBRSxLQUFLLHdCQUF3QixDQUFDO0FBRXBFLFVBQU0sYUFBYSxTQUFTLFNBQVMsVUFBVSxFQUFFLEtBQUssdUJBQXVCLENBQUM7QUFDOUUsVUFBTSxnQkFBZ0IsTUFBTTtBQUMxQixZQUFNLE1BQU0sT0FBTyxNQUFNLGdCQUFnQixXQUFXLE1BQU0sY0FBYztBQUN4RSxpQkFBVyxNQUFNO0FBQ2pCLGlCQUFXLFdBQVcsRUFBRSxNQUFNLE9BQU8sU0FBSSxDQUFDO0FBQzFDLGlCQUFXLFdBQVcsRUFBRSxLQUFLLHdCQUF3QixNQUFNLFNBQUksQ0FBQztBQUFBLElBQ2xFO0FBQ0Esa0JBQWM7QUFFZCxVQUFNLFdBQVcsU0FBUyxTQUFTLFVBQVUsRUFBRSxLQUFLLHNCQUFzQixNQUFNLFNBQUksQ0FBQztBQUNyRixhQUFTLGFBQWEsY0FBYyxhQUFhO0FBRWpELFVBQU0sUUFBUSxVQUFVLFVBQVUsRUFBRSxLQUFLLHFCQUFxQixDQUFDO0FBQy9ELFVBQU0sTUFBTSxVQUFVO0FBRXRCLFVBQU0sY0FBYyxNQUFNLFNBQVMsU0FBUztBQUFBLE1BQzFDLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUNMLGFBQWE7QUFBQSxJQUNmLENBQUM7QUFFRCxVQUFNLFNBQVMsTUFBTSxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUUzRCxVQUFNLGFBQWEsQ0FBQyxVQUFrQjtBQUNwQyxhQUFPLE1BQU07QUFDYixZQUFNLElBQUksTUFBTSxZQUFZLEVBQUUsS0FBSztBQUNuQyxZQUFNLFdBQVcsSUFDYixpQkFBaUIsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsS0FBSyxNQUFNLENBQUMsSUFDNUQ7QUFDSixpQkFBVyxDQUFDLEtBQUssS0FBSyxVQUFVO0FBQzlCLGNBQU0sTUFBTSxPQUFPLFNBQVMsVUFBVSxFQUFFLEtBQUssYUFBYSxNQUFNLE1BQU0sQ0FBQztBQUN2RSxZQUFJLE1BQU0sZ0JBQWdCLE1BQU8sS0FBSSxTQUFTLGFBQWE7QUFDM0QsWUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGdCQUFNLGNBQWM7QUFDcEIsd0JBQWM7QUFDZCxnQkFBTSxNQUFNLFVBQVU7QUFDdEIsc0JBQVksUUFBUTtBQUNwQixxQkFBVyxFQUFFO0FBQUEsUUFDZixDQUFDO0FBQUEsTUFDSDtBQUNBLFVBQUksU0FBUyxXQUFXLEdBQUc7QUFDekIsZUFBTyxXQUFXLEVBQUUsS0FBSyxzQkFBc0IsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUNyRTtBQUFBLElBQ0Y7QUFDQSxlQUFXLEVBQUU7QUFFYixnQkFBWSxpQkFBaUIsU0FBUyxNQUFNLFdBQVcsWUFBWSxLQUFLLENBQUM7QUFFekUsZUFBVyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3pDLFlBQU0sT0FBTyxNQUFNLE1BQU0sWUFBWTtBQUNyQyxZQUFNLE1BQU0sVUFBVSxPQUFPLFNBQVM7QUFDdEMsVUFBSSxDQUFDLEtBQU0sWUFBVyxNQUFNLFlBQVksTUFBTSxHQUFHLENBQUM7QUFBQSxJQUNwRCxDQUFDO0FBRUQsYUFBUyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3ZDLFlBQU0sY0FBYztBQUNwQixvQkFBYztBQUNkLFlBQU0sTUFBTSxVQUFVO0FBQ3RCLGtCQUFZLFFBQVE7QUFDcEIsaUJBQVcsRUFBRTtBQUFBLElBQ2YsQ0FBQztBQUdELFFBQUksd0JBQVEsU0FBUyxFQUNsQixRQUFRLFlBQVksRUFDcEI7QUFBQSxNQUFVLE9BQ1QsRUFBRSxTQUFTLE1BQU0sZUFBZSxJQUFJLEVBQ2xDLFNBQVMsT0FBSztBQUFFLGNBQU0sYUFBYTtBQUFBLE1BQUcsQ0FBQztBQUFBLElBQzNDO0FBRUYsUUFBSSx3QkFBUSxTQUFTLEVBQ2xCO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLFNBQVMsU0FBUztBQUN2QixhQUFLLE9BQU87QUFDWixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNILEVBQ0M7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLFFBQVEsRUFBRSxRQUFRLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFBQSxJQUN4RDtBQUVGLFVBQU0sS0FBSyxVQUFVLFNBQVMsSUFBSTtBQUNsQyxPQUFHLE1BQU0sU0FBUztBQUVsQixjQUFVLFNBQVMsS0FBSztBQUFBLE1BQ3RCLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFFRCxRQUFJLHdCQUFRLFNBQVMsRUFDbEI7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLG9CQUFvQixFQUFFLFFBQVEsTUFBTTtBQUNwRCxhQUFLLE1BQU07QUFDWCxhQUFLLE1BQU0sYUFBYSxLQUFLLE1BQU07QUFBQSxNQUNyQyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDO0FBSUEsSUFBTSwwQkFBTixjQUFzQyxzQkFBTTtBQUFBLEVBQzFDLFlBQVksS0FBa0IsV0FBdUI7QUFDbkQsVUFBTSxHQUFHO0FBRG1CO0FBQUEsRUFFOUI7QUFBQSxFQUVBLFNBQWU7QUFDYixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDbEQsY0FBVSxTQUFTLEtBQUssRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLFFBQUksd0JBQVEsU0FBUyxFQUNsQjtBQUFBLE1BQVUsU0FDVCxJQUFJLGNBQWMsUUFBUSxFQUFFLFdBQVcsRUFBRSxRQUFRLE1BQU07QUFDckQsYUFBSyxVQUFVO0FBQ2YsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSCxFQUNDO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxRQUFRLEVBQUUsUUFBUSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQUEsSUFDeEQ7QUFBQSxFQUNKO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FFN29CQSxJQUFBQyxtQkFBMkI7QUFLcEIsSUFBTSxjQUFOLE1BQWtCO0FBQUEsRUFJdkIsWUFDRSxhQUNRLEtBQ0EsUUFDQSxNQUNBLGlCQUNSO0FBSlE7QUFDQTtBQUNBO0FBQ0E7QUFQVixTQUFRLFdBQVc7QUFTakIsU0FBSyxZQUFZLFlBQVksVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDbEUsU0FBSyxVQUFVLGFBQWEsUUFBUSxTQUFTO0FBQzdDLFNBQUssVUFBVSxhQUFhLGNBQWMsa0JBQWtCO0FBQzVELFNBQUssY0FBYztBQUFBLEVBQ3JCO0FBQUEsRUFFUSxnQkFBc0I7QUFDNUIsU0FBSyxVQUFVLE1BQU07QUFHckIsVUFBTSxZQUFZLEtBQUssVUFBVSxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsQ0FBQztBQUM1RSxjQUFVLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQy9DLGNBQVUsV0FBVyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ3hDLFFBQUksS0FBSyxTQUFVLFdBQVUsU0FBUyxZQUFZO0FBR2xELFVBQU0sWUFBWSxLQUFLLFVBQVUsU0FBUyxVQUFVLEVBQUUsS0FBSyxxQkFBcUIsQ0FBQztBQUNqRixjQUFVLGFBQWEsY0FBYyxtQkFBbUI7QUFDeEQsS0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLFFBQVEsT0FBSztBQUNyQixZQUFNLE1BQU0sVUFBVSxTQUFTLFVBQVUsRUFBRSxPQUFPLE9BQU8sQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUMvRSxVQUFJLE1BQU0sS0FBSyxPQUFPLE9BQU8sUUFBUyxLQUFJLFdBQVc7QUFBQSxJQUN2RCxDQUFDO0FBQ0QsY0FBVSxpQkFBaUIsVUFBVSxNQUFNO0FBQ3pDLFdBQUssZ0JBQWdCLE9BQU8sVUFBVSxLQUFLLENBQUM7QUFBQSxJQUM5QyxDQUFDO0FBR0QsVUFBTSxVQUFVLEtBQUssVUFBVSxTQUFTLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQzdFLFNBQUssY0FBYyxPQUFPO0FBQzFCLFlBQVEsaUJBQWlCLFNBQVMsTUFBTTtBQUN0QyxXQUFLLFdBQVcsQ0FBQyxLQUFLO0FBQ3RCLFdBQUssS0FBSyxZQUFZLEtBQUssUUFBUTtBQUNuQyxXQUFLLGNBQWMsT0FBTztBQUMxQixXQUFLLGNBQWM7QUFDbkIsZ0JBQVUsWUFBWSxjQUFjLEtBQUssUUFBUTtBQUNqRCxXQUFLLFVBQVUsWUFBWSxtQkFBbUIsS0FBSyxRQUFRO0FBQUEsSUFDN0QsQ0FBQztBQUVELFFBQUksS0FBSyxVQUFVO0FBQ2pCLFdBQUssVUFBVSxTQUFTLGlCQUFpQjtBQUN6QyxXQUFLLGdCQUFnQjtBQUFBLElBQ3ZCO0FBR0EsU0FBSyxLQUFLLG9CQUFvQixNQUFNO0FBQUUsV0FBSyxrQkFBa0I7QUFBQSxJQUFHO0FBQUEsRUFDbEU7QUFBQSxFQUVRLGNBQWMsS0FBOEI7QUFDbEQsUUFBSSxjQUFjLEtBQUssV0FBVyxnQkFBVztBQUM3QyxRQUFJLFlBQVksc0JBQXNCLEtBQUssUUFBUTtBQUFBLEVBQ3JEO0FBQUEsRUFFUSxnQkFBc0I7QUFDNUIsVUFBTSxXQUFXLEtBQUssVUFBVSxjQUFjLGtCQUFrQjtBQUNoRSxRQUFJLEtBQUssWUFBWSxDQUFDLFVBQVU7QUFDOUIsV0FBSyxnQkFBZ0I7QUFBQSxJQUN2QixXQUFXLENBQUMsS0FBSyxZQUFZLFVBQVU7QUFDckMsZUFBUyxPQUFPO0FBQUEsSUFDbEI7QUFBQSxFQUNGO0FBQUEsRUFFUSxrQkFBd0I7QUFDOUIsVUFBTSxTQUFTLEtBQUssVUFBVSxTQUFTLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixNQUFNLGNBQWMsQ0FBQztBQUNoRyxXQUFPLGlCQUFpQixTQUFTLE1BQU07QUFBRSxXQUFLLGtCQUFrQjtBQUFBLElBQUcsQ0FBQztBQUFBLEVBQ3RFO0FBQUE7QUFBQSxFQUdRLG9CQUEwQjtBQUNoQyxRQUFJLGNBQWMsS0FBSyxLQUFLLENBQUMsU0FBUztBQUNwQyxZQUFNLFVBQVUsY0FBYyxJQUFJLElBQUk7QUFDdEMsVUFBSSxDQUFDLFFBQVM7QUFFZCxZQUFNLFNBQVMsS0FBSyxPQUFPLE9BQU8sT0FBTztBQUFBLFFBQ3ZDLENBQUMsS0FBSyxNQUFNLEtBQUssSUFBSSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUNwRDtBQUVBLFlBQU0sV0FBMEI7QUFBQSxRQUM5QixJQUFJLE9BQU8sV0FBVztBQUFBLFFBQ3RCO0FBQUEsUUFDQSxLQUFLO0FBQUEsUUFDTCxLQUFLLFNBQVM7QUFBQSxRQUNkLFNBQVMsS0FBSyxJQUFJLFFBQVEsWUFBWSxTQUFTLEtBQUssT0FBTyxPQUFPLE9BQU87QUFBQSxRQUN6RSxTQUFTLFFBQVEsWUFBWTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxHQUFHLFFBQVEsY0FBYztBQUFBLE1BQ3JDO0FBRUEsV0FBSyxLQUFLLFNBQVMsUUFBUTtBQUFBLElBQzdCLENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUFBLEVBRUEsYUFBMEI7QUFDeEIsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxTQUFLLFVBQVUsT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7QUFFQSxJQUFNLGFBQWdFO0FBQUEsRUFDcEUsWUFBaUIsRUFBRSxNQUFNLGFBQWEsTUFBTSx5Q0FBeUM7QUFBQSxFQUNyRixTQUFpQixFQUFFLE1BQU0sYUFBYSxNQUFNLCtCQUErQjtBQUFBLEVBQzNFLGdCQUFpQixFQUFFLE1BQU0sYUFBYSxNQUFNLG1DQUFtQztBQUFBLEVBQy9FLFdBQWlCLEVBQUUsTUFBTSxhQUFhLE1BQU0saUNBQWlDO0FBQUEsRUFDN0UsWUFBaUIsRUFBRSxNQUFNLG1CQUFtQixNQUFNLGdDQUFnQztBQUFBLEVBQ2xGLGVBQWlCLEVBQUUsTUFBTSxhQUFhLE1BQU0sa0NBQWtDO0FBQUEsRUFDOUUsaUJBQWlCLEVBQUUsTUFBTSxtQkFBbUIsTUFBTSxpQ0FBaUM7QUFBQSxFQUNuRixpQkFBaUIsRUFBRSxNQUFNLGFBQWEsTUFBTSxtQ0FBbUM7QUFBQSxFQUMvRSxlQUFpQixFQUFFLE1BQU0sYUFBYSxNQUFNLHlDQUF5QztBQUFBLEVBQ3JGLFFBQWlCLEVBQUUsTUFBTSxPQUFPLE1BQU0sa0NBQWtDO0FBQzFFO0FBRUEsSUFBTSxnQkFBTixjQUE0Qix1QkFBTTtBQUFBLEVBQ2hDLFlBQ0UsS0FDUSxVQUNSO0FBQ0EsVUFBTSxHQUFHO0FBRkQ7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBeElqQjtBQXlJSSxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sYUFBYSxLQUFLLHdCQUF3QixDQUFDO0FBRTVFLFVBQU0sT0FBTyxVQUFVLFVBQVUsRUFBRSxLQUFLLGlCQUFpQixDQUFDO0FBRTFELGVBQVcsV0FBVyxjQUFjLE9BQU8sR0FBRztBQUM1QyxZQUFNLE9BQU8sV0FBVyxRQUFRLElBQUk7QUFDcEMsWUFBTSxNQUFNLEtBQUssU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUMvRCxVQUFJLFdBQVcsRUFBRSxLQUFLLGtCQUFrQixPQUFNLGtDQUFNLFNBQU4sWUFBYyxTQUFTLENBQUM7QUFDdEUsVUFBSSxXQUFXLEVBQUUsS0FBSyxrQkFBa0IsTUFBTSxRQUFRLFlBQVksQ0FBQztBQUNuRSxVQUFJLDZCQUFNLE1BQU07QUFDZCxZQUFJLFdBQVcsRUFBRSxLQUFLLGtCQUFrQixNQUFNLEtBQUssS0FBSyxDQUFDO0FBQUEsTUFDM0Q7QUFDQSxVQUFJLGlCQUFpQixTQUFTLE1BQU07QUFDbEMsYUFBSyxTQUFTLFFBQVEsSUFBSTtBQUMxQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBSDFKTyxJQUFNLFlBQVk7QUFFbEIsSUFBTSxlQUFOLGNBQTJCLDBCQUFTO0FBQUEsRUFJekMsWUFBWSxNQUE2QixRQUF5QjtBQUNoRSxVQUFNLElBQUk7QUFENkI7QUFIekMsU0FBUSxPQUEwQjtBQUNsQyxTQUFRLFVBQThCO0FBQUEsRUFJdEM7QUFBQSxFQUVBLGNBQXNCO0FBQUUsV0FBTztBQUFBLEVBQVc7QUFBQSxFQUMxQyxpQkFBeUI7QUFBRSxXQUFPO0FBQUEsRUFBWTtBQUFBLEVBQzlDLFVBQWtCO0FBQUUsV0FBTztBQUFBLEVBQVE7QUFBQSxFQUVuQyxNQUFNLFNBQXdCO0FBbkJoQztBQXFCSSxlQUFLLFNBQUwsbUJBQVc7QUFDWCxlQUFLLFlBQUwsbUJBQWM7QUFFZCxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsZUFBZTtBQUVsQyxVQUFNLFNBQXVCLEtBQUssT0FBTztBQUV6QyxVQUFNLGlCQUFpQixDQUFDLGNBQTRCO0FBQ2xELFdBQUssT0FBTyxTQUFTO0FBQ3JCLFdBQUssS0FBSyxPQUFPLFdBQVcsU0FBUztBQUFBLElBQ3ZDO0FBRUEsU0FBSyxPQUFPLElBQUksV0FBVyxXQUFXLEtBQUssS0FBSyxLQUFLLFFBQVEsY0FBYztBQUUzRSxTQUFLLFVBQVUsSUFBSTtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxDQUFDLFlBQVk7QUExQ25CLFlBQUFDO0FBMENxQixTQUFBQSxNQUFBLEtBQUssU0FBTCxnQkFBQUEsSUFBVyxXQUFXO0FBQUEsTUFBVTtBQUFBLElBQ2pEO0FBR0EsY0FBVSxhQUFhLEtBQUssUUFBUSxXQUFXLEdBQUcsS0FBSyxLQUFLLFdBQVcsQ0FBQztBQUV4RSxTQUFLLEtBQUssT0FBTyxPQUFPLFFBQVEsT0FBTyxPQUFPO0FBQUEsRUFDaEQ7QUFBQSxFQUVBLE1BQU0sVUFBeUI7QUFuRGpDO0FBb0RJLGVBQUssU0FBTCxtQkFBVztBQUNYLGVBQUssWUFBTCxtQkFBYztBQUFBLEVBQ2hCO0FBQUE7QUFBQSxFQUdBLE1BQU0sU0FBd0I7QUFDNUIsVUFBTSxLQUFLLE9BQU87QUFBQSxFQUNwQjtBQUNGOzs7QUk1REEsSUFBQUMsbUJBQTRDOzs7QUNBNUMsSUFBQUMsbUJBQStCO0FBR3hCLElBQWUsWUFBZixjQUFpQywyQkFBVTtBQUFBLEVBR2hELFlBQ1ksS0FDQSxVQUNBLFFBQ1Y7QUFDQSxVQUFNO0FBSkk7QUFDQTtBQUNBO0FBTFosU0FBUSxtQkFBdUM7QUFBQSxFQVEvQztBQUFBO0FBQUEsRUFLQSxhQUFhLFNBQTJCO0FBQUEsRUFBQztBQUFBO0FBQUEsRUFHekMsbUJBQW1CLElBQXVCO0FBQ3hDLFNBQUssbUJBQW1CO0FBQUEsRUFDMUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtVLGFBQWEsSUFBaUIsT0FBcUI7QUEzQi9EO0FBNEJJLFVBQU0sTUFBTSxLQUFLLFNBQVM7QUFDMUIsUUFBSSxJQUFJLGVBQWUsS0FBTTtBQUM3QixVQUFNLFFBQVMsT0FBTyxJQUFJLGdCQUFnQixZQUFZLElBQUksWUFBWSxLQUFLLElBQ3ZFLElBQUksWUFBWSxLQUFLLElBQ3JCO0FBQ0osUUFBSSxDQUFDLE1BQU87QUFDWixVQUFNLGFBQVksVUFBSyxxQkFBTCxZQUF5QjtBQUMzQyxVQUFNLFNBQVMsVUFBVSxVQUFVLEVBQUUsS0FBSyxlQUFlLENBQUM7QUFDMUQsUUFBSSxPQUFPLElBQUksZ0JBQWdCLFlBQVksSUFBSSxhQUFhO0FBQzFELGFBQU8sV0FBVyxFQUFFLEtBQUssc0JBQXNCLE1BQU0sSUFBSSxZQUFZLENBQUM7QUFBQSxJQUN4RTtBQUNBLFdBQU8sV0FBVyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQUEsRUFDbkM7QUFDRjs7O0FEckNPLElBQU0sZ0JBQU4sY0FBNEIsVUFBVTtBQUFBLEVBQXRDO0FBQUE7QUFDTCxTQUFRLFNBQTZCO0FBQ3JDLFNBQVEsU0FBNkI7QUFBQTtBQUFBLEVBRXJDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLGdCQUFnQjtBQUU1QixVQUFNLEVBQUUsV0FBVyxLQUFLLElBQUksS0FBSyxTQUFTO0FBRTFDLFFBQUksVUFBVTtBQUNaLFdBQUssU0FBUyxHQUFHLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQUEsSUFDckQ7QUFDQSxTQUFLLFNBQVMsR0FBRyxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUVuRCxTQUFLLEtBQUs7QUFDVixTQUFLLGlCQUFpQixPQUFPLFlBQVksTUFBTSxLQUFLLEtBQUssR0FBRyxHQUFJLENBQUM7QUFBQSxFQUNuRTtBQUFBLEVBRVEsT0FBYTtBQUNuQixVQUFNLFVBQU0seUJBQU87QUFDbkIsVUFBTSxPQUFPLElBQUksS0FBSztBQUN0QixVQUFNLEVBQUUsT0FBTyxjQUFjLFdBQVcsS0FBSyxJQUFJLEtBQUssU0FBUztBQUsvRCxVQUFNLGFBQ0osUUFBUSxLQUFLLE9BQU8sS0FBSyxlQUN6QixRQUFRLE1BQU0sT0FBTyxLQUFLLG9CQUMxQjtBQUVGLFFBQUksS0FBSyxVQUFVLFVBQVU7QUFDM0IsV0FBSyxPQUFPLFFBQVEsSUFBSSxPQUFPLE9BQU8sQ0FBQztBQUFBLElBQ3pDO0FBQ0EsUUFBSSxLQUFLLFFBQVE7QUFDZixXQUFLLE9BQU8sUUFBUSxHQUFHLFVBQVUsS0FBSyxJQUFJLEVBQUU7QUFBQSxJQUM5QztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSxzQkFBc0IsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsY0FBYztBQUN2RSxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0sd0JBQU4sY0FBb0MsdUJBQU07QUFBQSxFQUN4QyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUFDYixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFdEQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLE1BQU07QUFFekMsUUFBSSx5QkFBUSxTQUFTLEVBQUUsUUFBUSxNQUFNLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUFuRXJEO0FBb0VNLGlCQUFFLFVBQVMsV0FBTSxTQUFOLFlBQXdCLFlBQVksRUFDN0MsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sT0FBTztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDckM7QUFDQSxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRTtBQUFBLE1BQVUsT0FBRTtBQXZFNUQ7QUF3RU0saUJBQUUsVUFBUyxXQUFNLGFBQU4sWUFBNkIsSUFBSSxFQUMxQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxXQUFXO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN6QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFDL0MsYUFBSyxPQUFPLEtBQUs7QUFDakIsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUVwRkEsSUFBQUMsbUJBQTRDO0FBSXJDLElBQU0sYUFBTixjQUF5QixVQUFVO0FBQUEsRUFBbkM7QUFBQTtBQUNMLFNBQVEsU0FBNkI7QUFDckMsU0FBUSxTQUE2QjtBQUFBO0FBQUEsRUFFckMsT0FBTyxJQUF1QjtBQUM1QixPQUFHLFNBQVMsYUFBYTtBQUV6QixVQUFNLEVBQUUsV0FBVyxLQUFLLElBQUksS0FBSyxTQUFTO0FBRTFDLFNBQUssU0FBUyxHQUFHLFVBQVUsRUFBRSxLQUFLLGFBQWEsQ0FBQztBQUNoRCxRQUFJLFVBQVU7QUFDWixXQUFLLFNBQVMsR0FBRyxVQUFVLEVBQUUsS0FBSyxhQUFhLENBQUM7QUFBQSxJQUNsRDtBQUVBLFNBQUssS0FBSztBQUNWLFNBQUssaUJBQWlCLE9BQU8sWUFBWSxNQUFNLEtBQUssS0FBSyxHQUFHLEdBQUksQ0FBQztBQUFBLEVBQ25FO0FBQUEsRUFFUSxPQUFhO0FBQ25CLFVBQU0sVUFBTSx5QkFBTztBQUNuQixVQUFNLEVBQUUsY0FBYyxPQUFPLFdBQVcsTUFBTSxTQUFTLEdBQUcsSUFBSSxLQUFLLFNBQVM7QUFNNUUsUUFBSSxLQUFLLFFBQVE7QUFDZixVQUFJLFFBQVE7QUFDVixhQUFLLE9BQU8sUUFBUSxJQUFJLE9BQU8sTUFBTSxDQUFDO0FBQUEsTUFDeEMsT0FBTztBQUNMLGFBQUssT0FBTyxRQUFRLElBQUksT0FBTyxjQUFjLGFBQWEsT0FBTyxDQUFDO0FBQUEsTUFDcEU7QUFBQSxJQUNGO0FBQ0EsUUFBSSxLQUFLLFVBQVUsVUFBVTtBQUMzQixXQUFLLE9BQU8sUUFBUSxJQUFJLE9BQU8sbUJBQW1CLENBQUM7QUFBQSxJQUNyRDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSxtQkFBbUIsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsY0FBYztBQUNwRSxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0scUJBQU4sY0FBaUMsdUJBQU07QUFBQSxFQUNyQyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUFDYixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFbkQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLE1BQU07QUFFekMsUUFBSSx5QkFBUSxTQUFTLEVBQUUsUUFBUSxjQUFjLEVBQUU7QUFBQSxNQUFVLE9BQUU7QUFsRS9EO0FBbUVNLGlCQUFFLFVBQVMsV0FBTSxnQkFBTixZQUFnQyxLQUFLLEVBQzlDLFNBQVMsT0FBSztBQUFFLGdCQUFNLGNBQWM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQzVDO0FBQ0EsUUFBSSx5QkFBUSxTQUFTLEVBQUUsUUFBUSxXQUFXLEVBQUU7QUFBQSxNQUFVLE9BQUU7QUF0RTVEO0FBdUVNLGlCQUFFLFVBQVMsV0FBTSxhQUFOLFlBQTZCLElBQUksRUFDMUMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sV0FBVztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDekM7QUFDQSxRQUFJLHlCQUFRLFNBQVMsRUFDbEIsUUFBUSxlQUFlLEVBQ3ZCLFFBQVEsMEVBQTBFLEVBQ2xGO0FBQUEsTUFBUSxPQUFFO0FBN0VqQjtBQThFUSxpQkFBRSxVQUFTLFdBQU0sV0FBTixZQUEwQixFQUFFLEVBQ3JDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFNBQVM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3ZDO0FBQ0YsUUFBSSx5QkFBUSxTQUFTLEVBQUU7QUFBQSxNQUFVLFNBQy9CLElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLE9BQU8sS0FBSztBQUNqQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBQzFGQSxJQUFBQyxtQkFBMkQ7QUFZM0QsSUFBTSxxQkFBTixjQUFpQyw4QkFBc0I7QUFBQSxFQUNyRCxZQUFZLEtBQWtCLFVBQXFDO0FBQ2pFLFVBQU0sR0FBRztBQURtQjtBQUU1QixTQUFLLGVBQWUsb0NBQStCO0FBQUEsRUFDckQ7QUFBQSxFQUVRLGdCQUEyQjtBQUNqQyxVQUFNLFVBQXFCLENBQUM7QUFDNUIsVUFBTSxVQUFVLENBQUMsTUFBZTtBQUM5QixjQUFRLEtBQUssQ0FBQztBQUNkLGlCQUFXLFNBQVMsRUFBRSxVQUFVO0FBQzlCLFlBQUksaUJBQWlCLHlCQUFTLFNBQVEsS0FBSztBQUFBLE1BQzdDO0FBQUEsSUFDRjtBQUNBLFlBQVEsS0FBSyxJQUFJLE1BQU0sUUFBUSxDQUFDO0FBQ2hDLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxlQUFlLE9BQTBCO0FBQ3ZDLFVBQU0sSUFBSSxNQUFNLFlBQVk7QUFDNUIsV0FBTyxLQUFLLGNBQWMsRUFBRSxPQUFPLE9BQUssRUFBRSxLQUFLLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFFQSxpQkFBaUIsUUFBaUIsSUFBdUI7QUFDdkQsT0FBRyxTQUFTLFFBQVEsRUFBRSxNQUFNLE9BQU8sU0FBUyxNQUFNLG1CQUFtQixPQUFPLEtBQUssQ0FBQztBQUFBLEVBQ3BGO0FBQUEsRUFFQSxtQkFBbUIsUUFBdUI7QUFBRSxTQUFLLFNBQVMsTUFBTTtBQUFBLEVBQUc7QUFDckU7QUFJTyxJQUFNLG1CQUFOLGNBQStCLFVBQVU7QUFBQSxFQUF6QztBQUFBO0FBQ0wsU0FBUSxjQUFrQztBQUMxQyxTQUFRLGNBQTZCO0FBQUE7QUFBQSxFQUVyQyxPQUFPLElBQXVCO0FBQzVCLFNBQUssY0FBYztBQUNuQixPQUFHLFNBQVMsb0JBQW9CO0FBR2hDLFNBQUssY0FBYyxLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsTUFBTSxLQUFLLGVBQWUsQ0FBQyxDQUFDO0FBQzNFLFNBQUssY0FBYyxLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsTUFBTSxLQUFLLGVBQWUsQ0FBQyxDQUFDO0FBQzNFLFNBQUssY0FBYyxLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsTUFBTSxLQUFLLGVBQWUsQ0FBQyxDQUFDO0FBRzNFLFNBQUssSUFBSSxVQUFVLGNBQWMsTUFBTSxLQUFLLGNBQWMsQ0FBQztBQUFBLEVBQzdEO0FBQUEsRUFFUSxpQkFBdUI7QUFDN0IsUUFBSSxLQUFLLGdCQUFnQixLQUFNLFFBQU8sYUFBYSxLQUFLLFdBQVc7QUFDbkUsU0FBSyxjQUFjLE9BQU8sV0FBVyxNQUFNO0FBQ3pDLFdBQUssY0FBYztBQUNuQixXQUFLLGNBQWM7QUFBQSxJQUNyQixHQUFHLEdBQUc7QUFBQSxFQUNSO0FBQUEsRUFFUSxnQkFBc0I7QUFDNUIsVUFBTSxLQUFLLEtBQUs7QUFDaEIsUUFBSSxDQUFDLEdBQUk7QUFDVCxPQUFHLE1BQU07QUFFVCxVQUFNLEVBQUUsUUFBUSxlQUFlLFNBQVMsSUFBSSxRQUFRLENBQUMsRUFBRSxJQUFJLEtBQUssU0FBUztBQU16RSxTQUFLLGFBQWEsSUFBSSxLQUFLO0FBRTNCLFVBQU0sT0FBTyxHQUFHLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBR3RELFFBQUksUUFBUTtBQUNWLFlBQU0sYUFBYSxPQUFPLEtBQUssRUFBRSxRQUFRLFFBQVEsRUFBRTtBQUVuRCxVQUFJLENBQUMsWUFBWTtBQUNmLGFBQUssU0FBUyxLQUFLLEVBQUUsTUFBTSw0REFBNEQsS0FBSyxnQkFBZ0IsQ0FBQztBQUFBLE1BQy9HLE9BQU87QUFDTCxjQUFNLFlBQVksS0FBSyxJQUFJLE1BQU0sc0JBQXNCLFVBQVU7QUFFakUsWUFBSSxFQUFFLHFCQUFxQiwyQkFBVTtBQUNuQyxlQUFLLFNBQVMsS0FBSyxFQUFFLE1BQU0sV0FBVyxVQUFVLGdCQUFnQixLQUFLLGdCQUFnQixDQUFDO0FBQUEsUUFDeEYsT0FBTztBQUNMLGdCQUFNLFNBQVMsVUFBVSxPQUFPO0FBQ2hDLGdCQUFNLFFBQVEsS0FBSyxJQUFJLE1BQU0sU0FBUyxFQUNuQyxPQUFPLE9BQUssRUFBRSxLQUFLLFdBQVcsTUFBTSxDQUFDLEVBQ3JDLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxTQUFTLGNBQWMsRUFBRSxRQUFRLENBQUM7QUFFdEQscUJBQVcsUUFBUSxPQUFPO0FBQ3hCLGtCQUFNLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN2RCxrQkFBTSxNQUFNLEtBQUssU0FBUyxVQUFVLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQztBQUM5RCxnQkFBSSxXQUFXLEVBQUUsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUN0QyxnQkFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLG1CQUFLLElBQUksVUFBVSxhQUFhLEtBQUssTUFBTSxFQUFFO0FBQUEsWUFDL0MsQ0FBQztBQUFBLFVBQ0g7QUFFQSxjQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3RCLGlCQUFLLFNBQVMsS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLFVBQVUsSUFBSSxNQUFNLEtBQUssZ0JBQWdCLENBQUM7QUFBQSxVQUN2RjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdBLGVBQVcsUUFBUSxPQUFPO0FBQ3hCLFlBQU0sT0FBTyxLQUFLLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3ZELFlBQU0sTUFBTSxLQUFLLFNBQVMsVUFBVSxFQUFFLEtBQUssa0JBQWtCLENBQUM7QUFDOUQsVUFBSSxLQUFLLE9BQU87QUFDZCxZQUFJLFdBQVcsRUFBRSxLQUFLLGNBQWMsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUFBLE1BQ3hEO0FBQ0EsVUFBSSxXQUFXLEVBQUUsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUNuQyxVQUFJLGlCQUFpQixTQUFTLE1BQU07QUFDbEMsYUFBSyxJQUFJLFVBQVUsYUFBYSxLQUFLLE1BQU0sRUFBRTtBQUFBLE1BQy9DLENBQUM7QUFBQSxJQUNIO0FBRUEsUUFBSSxDQUFDLFVBQVUsTUFBTSxXQUFXLEdBQUc7QUFDakMsWUFBTSxPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDdkQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxZQUFZLENBQUM7QUFDbEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSwrREFBK0QsQ0FBQztBQUFBLElBQ3ZIO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJO0FBQUEsTUFDRixLQUFLO0FBQUEsTUFDTCxLQUFLLFNBQVM7QUFBQSxNQUNkLENBQUMsY0FBYztBQUNiLGFBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQUssY0FBYztBQUNuQixlQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0YsRUFBRSxLQUFLO0FBQUEsRUFDVDtBQUNGO0FBSUEsSUFBTSwyQkFBTixjQUF1Qyx1QkFBTTtBQUFBLEVBQzNDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQWpLakI7QUFrS0ksVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXpELFVBQU0sUUFBaUUsZ0JBQWdCLEtBQUssTUFBTTtBQUNsRyxnQkFBTSxVQUFOLGtCQUFNLFFBQVUsQ0FBQztBQUNqQixVQUFNLFFBQVEsTUFBTTtBQUVwQixRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTFLNUQsWUFBQUM7QUEyS00saUJBQUUsVUFBU0EsTUFBQSxNQUFNLFVBQU4sT0FBQUEsTUFBZSxhQUFhLEVBQ3JDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFFBQVE7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3RDO0FBRUEsUUFBSTtBQUNKLFFBQUkseUJBQVEsU0FBUyxFQUNsQixRQUFRLGtCQUFrQixFQUMxQixRQUFRLGlEQUFpRCxFQUN6RCxRQUFRLE9BQUs7QUFuTHBCLFVBQUFBO0FBb0xRLG1CQUFhO0FBQ2IsUUFBRSxVQUFTQSxNQUFBLE1BQU0sV0FBTixPQUFBQSxNQUFnQixFQUFFLEVBQzNCLGVBQWUsZUFBZSxFQUM5QixTQUFTLE9BQUs7QUFBRSxjQUFNLFNBQVM7QUFBQSxNQUFHLENBQUM7QUFBQSxJQUN2QyxDQUFDLEVBQ0E7QUFBQSxNQUFVLFNBQ1QsSUFBSSxRQUFRLFFBQVEsRUFBRSxXQUFXLHNCQUFzQixFQUFFLFFBQVEsTUFBTTtBQUNyRSxZQUFJLG1CQUFtQixLQUFLLEtBQUssQ0FBQyxXQUFXO0FBQzNDLGdCQUFNLE9BQU8sT0FBTyxTQUFTLE1BQU0sS0FBSyxPQUFPO0FBQy9DLGdCQUFNLFNBQVM7QUFDZixxQkFBVyxTQUFTLElBQUk7QUFBQSxRQUMxQixDQUFDLEVBQUUsS0FBSztBQUFBLE1BQ1YsQ0FBQztBQUFBLElBQ0g7QUFFRixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRWpELFVBQU0saUJBQWlCLFVBQVUsVUFBVTtBQUUzQyxVQUFNLGNBQWMsTUFBTTtBQUN4QixxQkFBZSxNQUFNO0FBQ3JCLFlBQU0sUUFBUSxDQUFDLE1BQU0sTUFBTTtBQUN6QixjQUFNLE1BQU0sZUFBZSxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUNqRSxZQUFJLHlCQUFRLEdBQUcsRUFDWixRQUFRLFFBQVEsSUFBSSxDQUFDLEVBQUUsRUFDdkIsUUFBUSxPQUFLLEVBQUUsZUFBZSxPQUFPLEVBQUUsU0FBUyxLQUFLLEtBQUssRUFBRSxTQUFTLE9BQUs7QUFBRSxnQkFBTSxDQUFDLEVBQUUsUUFBUTtBQUFBLFFBQUcsQ0FBQyxDQUFDLEVBQ2xHLFFBQVEsT0FBSyxFQUFFLGVBQWUsTUFBTSxFQUFFLFNBQVMsS0FBSyxJQUFJLEVBQUUsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sQ0FBQyxFQUFFLE9BQU87QUFBQSxRQUFHLENBQUMsQ0FBQyxFQUMvRixRQUFRLE9BQUU7QUEvTXJCLGNBQUFBO0FBK013QixtQkFBRSxlQUFlLE9BQU8sRUFBRSxVQUFTQSxNQUFBLEtBQUssVUFBTCxPQUFBQSxNQUFjLEVBQUUsRUFBRSxTQUFTLE9BQUs7QUFBRSxrQkFBTSxDQUFDLEVBQUUsUUFBUSxLQUFLO0FBQUEsVUFBVyxDQUFDO0FBQUEsU0FBQyxFQUNySCxVQUFVLFNBQU8sSUFBSSxRQUFRLE9BQU8sRUFBRSxXQUFXLFFBQVEsRUFBRSxRQUFRLE1BQU07QUFDeEUsZ0JBQU0sT0FBTyxHQUFHLENBQUM7QUFDakIsc0JBQVk7QUFBQSxRQUNkLENBQUMsQ0FBQztBQUFBLE1BQ04sQ0FBQztBQUFBLElBQ0g7QUFDQSxnQkFBWTtBQUVaLFFBQUkseUJBQVEsU0FBUyxFQUNsQixVQUFVLFNBQU8sSUFBSSxjQUFjLFVBQVUsRUFBRSxRQUFRLE1BQU07QUFDNUQsWUFBTSxLQUFLLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDO0FBQ2xDLGtCQUFZO0FBQUEsSUFDZCxDQUFDLENBQUMsRUFDRCxVQUFVLFNBQU8sSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQ2pFLFdBQUssT0FBTyxLQUFLO0FBQ2pCLFdBQUssTUFBTTtBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBQ3BPQSxJQUFBQyxtQkFBbUU7OztBQ1E1RCxTQUFTLGdCQUFnQixLQUFVLEtBQXNCO0FBQzlELFNBQU8sSUFBSSxNQUFNLGlCQUFpQixFQUFFLE9BQU8sVUFBUTtBQVRyRDtBQVVJLFVBQU0sUUFBUSxJQUFJLGNBQWMsYUFBYSxJQUFJO0FBQ2pELFFBQUksQ0FBQyxNQUFPLFFBQU87QUFFbkIsVUFBTSxjQUFhLGlCQUFNLFNBQU4sbUJBQVksSUFBSSxPQUFLLEVBQUUsU0FBdkIsWUFBK0IsQ0FBQztBQUVuRCxVQUFNLGFBQVksV0FBTSxnQkFBTixtQkFBbUI7QUFDckMsVUFBTSxhQUNKLE1BQU0sUUFBUSxTQUFTLElBQUksVUFBVSxPQUFPLENBQUMsTUFBbUIsT0FBTyxNQUFNLFFBQVEsSUFDckYsT0FBTyxjQUFjLFdBQVcsQ0FBQyxTQUFTLElBQzFDLENBQUM7QUFDSCxVQUFNLG1CQUFtQixXQUFXLElBQUksT0FBSyxFQUFFLFdBQVcsR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7QUFFNUUsV0FBTyxXQUFXLFNBQVMsR0FBRyxLQUFLLGlCQUFpQixTQUFTLEdBQUc7QUFBQSxFQUNsRSxDQUFDO0FBQ0g7OztBRG5CQSxJQUFNLGFBQWE7QUFFWixJQUFNLGVBQU4sY0FBMkIsVUFBVTtBQUFBLEVBQzFDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLGVBQWU7QUFDM0IsU0FBSyxjQUFjLEVBQUUsRUFBRSxNQUFNLE9BQUs7QUFDaEMsY0FBUSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25FLFNBQUcsUUFBUSxtREFBbUQ7QUFBQSxJQUNoRSxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBYyxjQUFjLElBQWdDO0FBQzFELFVBQU0sRUFBRSxNQUFNLElBQUksUUFBUSxpQkFBaUIsWUFBWSxLQUFLLElBQUksS0FBSyxTQUFTO0FBTTlFLFNBQUssYUFBYSxJQUFJLEtBQUs7QUFFM0IsVUFBTSxPQUFPLEdBQUcsVUFBVSxFQUFFLEtBQUssZUFBZSxDQUFDO0FBRWpELFFBQUksQ0FBQyxLQUFLO0FBQ1IsWUFBTSxPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDdkQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxZQUFZLENBQUM7QUFDbEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSwwRUFBMEUsQ0FBQztBQUNoSTtBQUFBLElBQ0Y7QUFFQSxVQUFNLFlBQVksSUFBSSxXQUFXLEdBQUcsSUFBSSxNQUFNLElBQUksR0FBRztBQUNyRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssS0FBSyxTQUFTO0FBRWpELFFBQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsV0FBSyxRQUFRLDJCQUEyQixTQUFTLEVBQUU7QUFDbkQ7QUFBQSxJQUNGO0FBR0EsVUFBTSxXQUFXLEtBQUssVUFBTSx5QkFBTyxFQUFFLFFBQVEsS0FBSyxFQUFFLFFBQVEsSUFBSSxVQUFVO0FBQzFFLFVBQU0sUUFBUSxZQUNWLFdBQVcsTUFBTSxTQUNqQixLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksTUFBTSxNQUFNO0FBRTNDLFVBQU0sT0FBTyxNQUFNLEtBQUs7QUFDeEIsVUFBTSxRQUFRLEtBQUssSUFBSSxjQUFjLGFBQWEsSUFBSTtBQUV0RCxRQUFJO0FBQ0YsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFlBQU0sRUFBRSxTQUFTLEtBQUssSUFBSSxLQUFLLGFBQWEsU0FBUyxLQUFLO0FBRTFELFdBQUssVUFBVSxFQUFFLEtBQUssaUJBQWlCLE1BQU0sV0FBVyxLQUFLLFNBQVMsQ0FBQztBQUN2RSxXQUFLLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixNQUFNLEtBQUssQ0FBQztBQUFBLElBQ3BELFNBQVMsR0FBRztBQUNWLGNBQVEsTUFBTSx1REFBdUQsQ0FBQztBQUN0RSxXQUFLLFFBQVEscUJBQXFCO0FBQUEsSUFDcEM7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1RLGFBQWEsU0FBaUIsT0FBaUU7QUFuRXpHO0FBcUVJLFVBQU0sV0FBVSxnREFBTyxhQUFQLG1CQUFrQixPQUFsQixtQkFBc0IsWUFBdEIsWUFBaUM7QUFHakQsVUFBTSxTQUFRLDBDQUFPLHdCQUFQLG1CQUE0QixJQUFJLFdBQWhDLFlBQTBDO0FBQ3hELFVBQU0sVUFBVSxRQUFRLE1BQU0sS0FBSztBQUduQyxVQUFNLFFBQU8sYUFDVixNQUFNLElBQUksRUFDVixJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFDakIsS0FBSyxPQUFLLEtBQUssQ0FBQyxFQUFFLFdBQVcsR0FBRyxDQUFDLE1BSHZCLFlBRzRCO0FBRXpDLFdBQU8sRUFBRSxTQUFTLEtBQUs7QUFBQSxFQUN6QjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLHFCQUFxQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ2hFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSx1QkFBTixjQUFtQyx1QkFBTTtBQUFBLEVBQ3ZDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUVyRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTVHNUQ7QUE2R00saUJBQUUsVUFBUyxXQUFNLFVBQU4sWUFBeUIsZUFBZSxFQUNqRCxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFLFFBQVEsS0FBSyxFQUFFLFFBQVEsa0JBQWtCLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUFoSGhGO0FBaUhNLGlCQUFFLFVBQVMsV0FBTSxRQUFOLFlBQXVCLEVBQUUsRUFDbEMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sTUFBTTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDcEM7QUFDQSxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLFlBQVksRUFBRSxRQUFRLHdCQUF3QixFQUFFO0FBQUEsTUFBVSxPQUFFO0FBcEgvRjtBQXFITSxpQkFBRSxVQUFTLFdBQU0sY0FBTixZQUE4QixJQUFJLEVBQzNDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFlBQVk7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQzFDO0FBQ0EsUUFBSSx5QkFBUSxTQUFTLEVBQUU7QUFBQSxNQUFVLFNBQy9CLElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLE9BQU8sS0FBSztBQUNqQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBRWpJQSxJQUFBQyxtQkFBb0M7QUFVN0IsSUFBTSxlQUFOLGNBQTJCLFVBQVU7QUFBQSxFQUMxQyxPQUFPLElBQXVCO0FBQzVCLE9BQUcsU0FBUyxnQkFBZ0I7QUFFNUIsVUFBTSxFQUFFLFFBQVEsVUFBVSxVQUFVLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSSxLQUFLLFNBQVM7QUFNcEUsU0FBSyxhQUFhLElBQUksS0FBSztBQUUzQixVQUFNLE9BQU8sR0FBRyxVQUFVLEVBQUUsS0FBSyxXQUFXLENBQUM7QUFDN0MsU0FBSyxNQUFNLHNCQUFzQixVQUFVLE9BQU87QUFFbEQsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUN0QixZQUFNLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN2RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLGtCQUFrQixDQUFDO0FBQ3hFLFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sK0RBQStELENBQUM7QUFDckg7QUFBQSxJQUNGO0FBRUEsZUFBVyxRQUFRLE9BQU87QUFDeEIsWUFBTSxNQUFNLEtBQUssU0FBUyxVQUFVLEVBQUUsS0FBSyxVQUFVLENBQUM7QUFDdEQsVUFBSSxLQUFLLE9BQU87QUFDZCxZQUFJLFdBQVcsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEtBQUssTUFBTSxDQUFDO0FBQUEsTUFDM0Q7QUFDQSxVQUFJLFdBQVcsRUFBRSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ25DLFVBQUksS0FBSyxNQUFNO0FBQ2IsWUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGVBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxNQUFPLEVBQUU7QUFBQSxRQUNoRCxDQUFDO0FBQUEsTUFDSCxPQUFPO0FBQ0wsWUFBSSxNQUFNLFNBQVM7QUFBQSxNQUNyQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxhQUFhLFFBQTBCO0FBQ3JDLFFBQUksb0JBQW9CLEtBQUssS0FBSyxLQUFLLFNBQVMsUUFBUSxDQUFDLFFBQVE7QUFDL0QsV0FBSyxTQUFTLFNBQVM7QUFDdkIsYUFBTztBQUFBLElBQ1QsQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNWO0FBQ0Y7QUFFQSxJQUFNLHNCQUFOLGNBQWtDLHVCQUFNO0FBQUEsRUFDdEMsWUFDRSxLQUNRLFFBQ0EsUUFDUjtBQUNBLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBQ2IsVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXBELFVBQU0sUUFBUSxnQkFBZ0IsS0FBSyxNQUFNO0FBS3pDLFFBQUksQ0FBQyxNQUFNLFFBQVEsTUFBTSxLQUFLLEVBQUcsT0FBTSxRQUFRLENBQUM7QUFFaEQsUUFBSSx5QkFBUSxTQUFTLEVBQUUsUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUE3RTVEO0FBOEVNLGlCQUFFLFVBQVMsV0FBTSxVQUFOLFlBQWUsUUFBUSxFQUNoQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFBWSxPQUFFO0FBakY1RDtBQWtGTSxpQkFBRSxVQUFVLEtBQUssR0FBRyxFQUFFLFVBQVUsS0FBSyxHQUFHLEVBQUUsVUFBVSxLQUFLLEdBQUcsRUFDMUQsU0FBUyxRQUFPLFdBQU0sWUFBTixZQUFpQixDQUFDLENBQUMsRUFDbkMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ2hEO0FBRUEsY0FBVSxTQUFTLEtBQUssRUFBRSxNQUFNLFNBQVMsS0FBSyxvQkFBb0IsQ0FBQztBQUVuRSxVQUFNLFNBQVMsVUFBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUM5RCxVQUFNLGFBQWEsTUFBTTtBQUN2QixhQUFPLE1BQU07QUFDYixZQUFNLE1BQU8sUUFBUSxDQUFDLE1BQU0sTUFBTTtBQTVGeEM7QUE2RlEsY0FBTSxNQUFNLE9BQU8sVUFBVSxFQUFFLEtBQUssa0JBQWtCLENBQUM7QUFFdkQsY0FBTSxhQUFhLElBQUksU0FBUyxTQUFTLEVBQUUsTUFBTSxRQUFRLEtBQUssb0JBQW9CLENBQUM7QUFDbkYsbUJBQVcsUUFBUSxLQUFLO0FBQ3hCLG1CQUFXLGNBQWM7QUFDekIsbUJBQVcsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLGVBQUssUUFBUSxXQUFXO0FBQUEsUUFBTyxDQUFDO0FBRTdFLGNBQU0sYUFBYSxJQUFJLFNBQVMsU0FBUyxFQUFFLE1BQU0sUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQ25GLG1CQUFXLFFBQVEsS0FBSztBQUN4QixtQkFBVyxjQUFjO0FBQ3pCLG1CQUFXLGlCQUFpQixTQUFTLE1BQU07QUFBRSxlQUFLLFFBQVEsV0FBVztBQUFBLFFBQU8sQ0FBQztBQUU3RSxjQUFNLFlBQVksSUFBSSxTQUFTLFNBQVMsRUFBRSxNQUFNLFFBQVEsS0FBSyxtQkFBbUIsQ0FBQztBQUNqRixrQkFBVSxTQUFRLFVBQUssU0FBTCxZQUFhO0FBQy9CLGtCQUFVLGNBQWM7QUFDeEIsa0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLGVBQUssT0FBTyxVQUFVLFNBQVM7QUFBQSxRQUFXLENBQUM7QUFFdkYsY0FBTSxTQUFTLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsTUFBTSxTQUFJLENBQUM7QUFDM0UsZUFBTyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3JDLGdCQUFNLE1BQU8sT0FBTyxHQUFHLENBQUM7QUFDeEIscUJBQVc7QUFBQSxRQUNiLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQ0EsZUFBVztBQUVYLFFBQUkseUJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsWUFBWSxFQUFFLFFBQVEsTUFBTTtBQUM1QyxjQUFNLE1BQU8sS0FBSyxFQUFFLE9BQU8sSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUMxQyxtQkFBVztBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFFQSxRQUFJLHlCQUFRLFNBQVMsRUFDbEI7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFnQztBQUM1QyxhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNILEVBQ0M7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLFFBQVEsRUFBRSxRQUFRLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFBQSxJQUN4RDtBQUFBLEVBQ0o7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUMzSUEsSUFBQUMsb0JBQTJEO0FBTTNELElBQU0sV0FBVztBQVdWLElBQU0sa0JBQU4sY0FBOEIsVUFBVTtBQUFBLEVBQzdDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLG1CQUFtQjtBQUMvQixTQUFLLGNBQWMsRUFBRSxFQUFFLE1BQU0sT0FBSztBQUNoQyxjQUFRLE1BQU0sdURBQXVELENBQUM7QUFDdEUsU0FBRyxRQUFRLGtEQUFrRDtBQUFBLElBQy9ELENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFjLGNBQWMsSUFBZ0M7QUExQjlEO0FBMkJJLFVBQU0sRUFBRSxTQUFTLE9BQU8sTUFBTSxJQUFJLFNBQVMsSUFBSSxRQUFRLFVBQVUsVUFBVSxHQUFHLFdBQVcsR0FBRyxJQUMxRixLQUFLLFNBQVM7QUFFaEIsU0FBSyxhQUFhLElBQUksS0FBSztBQUUzQixVQUFNLFNBQVMsR0FBRyxVQUFVLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQztBQUVyRCxVQUFNLGdCQUFnQjtBQUN0QixVQUFNLGFBQWEsTUFBTTtBQUN2QixZQUFNLElBQUksT0FBTztBQUNqQixZQUFNLFlBQVksSUFBSSxJQUFJLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxTQUFTLEtBQUssTUFBTSxJQUFJLGFBQWEsQ0FBQyxDQUFDLElBQUk7QUFDMUYsYUFBTyxNQUFNLHNCQUFzQixVQUFVLFNBQVM7QUFBQSxJQUN4RDtBQUNBLGVBQVc7QUFDWCxVQUFNLEtBQUssSUFBSSxlQUFlLFVBQVU7QUFDeEMsT0FBRyxRQUFRLE1BQU07QUFDakIsU0FBSyxTQUFTLE1BQU0sR0FBRyxXQUFXLENBQUM7QUFFbkMsUUFBSSxXQUFXLFFBQVE7QUFDckIsV0FBSyxpQkFBaUIsUUFBUSxRQUFRLFFBQVE7QUFDOUM7QUFBQSxJQUNGO0FBR0EsUUFBSSxDQUFDLEtBQUs7QUFDUixZQUFNLE9BQU8sT0FBTyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN6RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLFlBQVksQ0FBQztBQUNsRSxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLDJFQUEyRSxDQUFDO0FBQ2pJO0FBQUEsSUFDRjtBQUVBLFVBQU0sWUFBWSxJQUFJLFdBQVcsR0FBRyxJQUFJLE1BQU0sSUFBSSxHQUFHO0FBQ3JELFVBQU0sUUFBUSxnQkFBZ0IsS0FBSyxLQUFLLFNBQVMsRUFBRSxNQUFNLEdBQUcsUUFBUTtBQUdwRSxVQUFNLFVBQVUsTUFBTSxRQUFRO0FBQUEsTUFDNUIsTUFBTSxJQUFJLE9BQU8sU0FBUztBQUN4QixjQUFNLFVBQVUsTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLElBQUk7QUFDOUMsY0FBTSxRQUFRLEtBQUssSUFBSSxjQUFjLGFBQWEsSUFBSTtBQUN0RCxlQUFPLEVBQUUsTUFBTSxTQUFTLE1BQU07QUFBQSxNQUNoQyxDQUFDO0FBQUEsSUFDSDtBQUVBLGVBQVcsVUFBVSxTQUFTO0FBQzVCLFVBQUksT0FBTyxXQUFXLFlBQVk7QUFDaEMsZ0JBQVEsTUFBTSwwREFBMEQsT0FBTyxNQUFNO0FBQ3JGO0FBQUEsTUFDRjtBQUVBLFlBQU0sRUFBRSxNQUFNLFNBQVMsTUFBTSxJQUFJLE9BQU87QUFDeEMsWUFBTSxTQUFRLDBDQUFPLGdCQUFQLG1CQUFvQixVQUFwQixZQUF1QztBQUNyRCxZQUFNLE9BQU8sS0FBSyxZQUFZLFNBQVMsS0FBSztBQUM1QyxVQUFJLENBQUMsS0FBTTtBQUVYLFlBQU0sT0FBTyxPQUFPLFVBQVUsRUFBRSxLQUFLLGFBQWEsQ0FBQztBQUNuRCxZQUFNLFFBQVEsS0FBSyxTQUFTLGNBQWMsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEtBQUssQ0FBQztBQUc5RSxVQUFJLFNBQVMsU0FBUyxLQUFLLEtBQUssR0FBRztBQUNqQyxjQUFNLE1BQU0sa0JBQWtCO0FBQzlCLGNBQU0sTUFBTSxRQUFRO0FBQUEsTUFDdEI7QUFFQSxXQUFLLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixNQUFNLEtBQUssU0FBUyxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBYVEsaUJBQWlCLFFBQXFCLEtBQWEsVUFBd0I7QUFDakYsUUFBSSxDQUFDLElBQUksS0FBSyxHQUFHO0FBQ2YsWUFBTSxPQUFPLE9BQU8sVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDekQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxZQUFZLENBQUM7QUFDbEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSx5REFBeUQsQ0FBQztBQUMvRztBQUFBLElBQ0Y7QUFFQSxVQUFNLFNBQVMsSUFBSSxNQUFNLFNBQVMsRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU8sRUFBRSxNQUFNLEdBQUcsUUFBUTtBQUV4RixlQUFXLFNBQVMsUUFBUTtBQUMxQixZQUFNLFFBQVEsTUFBTSxNQUFNLElBQUksRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFDakUsWUFBTSxXQUFXLE1BQU0sTUFBTSxTQUFTLENBQUM7QUFDdkMsWUFBTSxZQUFZLE1BQU0sU0FBUyxLQUFLLFlBQVksS0FBSyxRQUFRO0FBQy9ELFlBQU0sYUFBYSxZQUFZLFNBQVMsUUFBUSxnQkFBZ0IsRUFBRSxJQUFJO0FBQ3RFLFlBQU0sWUFBWSxZQUFZLE1BQU0sTUFBTSxHQUFHLEVBQUUsSUFBSTtBQUNuRCxZQUFNLE9BQU8sVUFBVSxLQUFLLEdBQUc7QUFDL0IsVUFBSSxDQUFDLEtBQU07QUFFWCxZQUFNLE9BQU8sT0FBTyxVQUFVLEVBQUUsS0FBSyxhQUFhLENBQUM7QUFDbkQsV0FBSyxTQUFTLGNBQWMsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEtBQUssQ0FBQztBQUNoRSxVQUFJLFdBQVksTUFBSyxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsTUFBTSxXQUFXLENBQUM7QUFBQSxJQUMxRTtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR1EsWUFBWSxTQUFpQixPQUFzQztBQW5JN0U7QUFvSUksVUFBTSxTQUFRLDBDQUFPLHdCQUFQLG1CQUE0QixJQUFJLFdBQWhDLFlBQTBDO0FBQ3hELFVBQU0sVUFBVSxRQUFRLE1BQU0sS0FBSztBQUNuQyxVQUFNLFFBQVEsUUFDWCxNQUFNLElBQUksRUFDVixJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFDakIsT0FBTyxPQUFLLEtBQUssQ0FBQyxFQUFFLFdBQVcsR0FBRyxDQUFDO0FBQ3RDLFdBQU8sTUFBTSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRztBQUFBLEVBQ25DO0FBQUEsRUFFQSxhQUFhLFFBQTBCO0FBQ3JDLFFBQUksb0JBQW9CLEtBQUssS0FBSyxLQUFLLFNBQVMsUUFBUSxDQUFDLFFBQVE7QUFDL0QsV0FBSyxTQUFTLFNBQVM7QUFDdkIsYUFBTztBQUFBLElBQ1QsQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNWO0FBQ0Y7QUFFQSxJQUFNLHNCQUFOLGNBQWtDLHdCQUFNO0FBQUEsRUFDdEMsWUFDRSxLQUNRLFFBQ0EsUUFDUjtBQUNBLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBOUpqQjtBQStKSSxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFekQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLE1BQU07QUFDekMsZ0JBQU0sV0FBTixrQkFBTSxTQUFXO0FBRWpCLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsYUFBYSxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBdEs1RCxZQUFBQztBQXVLTSxpQkFBRSxVQUFTQSxNQUFBLE1BQU0sVUFBTixPQUFBQSxNQUFlLFFBQVEsRUFDaEMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sUUFBUTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDdEM7QUFHQSxRQUFJO0FBQ0osUUFBSTtBQUVKLFFBQUksMEJBQVEsU0FBUyxFQUNsQixRQUFRLFFBQVEsRUFDaEIsUUFBUSx3REFBd0QsRUFDaEU7QUFBQSxNQUFZLE9BQUU7QUFsTHJCLFlBQUFBO0FBbUxRLGlCQUFFLFVBQVUsT0FBTyxnQkFBZ0IsRUFDakMsVUFBVSxRQUFRLGFBQWEsRUFDL0IsVUFBU0EsTUFBQSxNQUFNLFdBQU4sT0FBQUEsTUFBZ0IsS0FBSyxFQUM5QixTQUFTLE9BQUs7QUFDYixnQkFBTSxTQUFTO0FBQ2YscUJBQVcsTUFBTSxVQUFVLE1BQU0sUUFBUSxLQUFLO0FBQzlDLHNCQUFZLE1BQU0sVUFBVSxNQUFNLFNBQVMsS0FBSztBQUFBLFFBQ2xELENBQUM7QUFBQTtBQUFBLElBQ0o7QUFHRixpQkFBYSxVQUFVLFVBQVU7QUFDakMsZUFBVyxNQUFNLFVBQVUsTUFBTSxXQUFXLFFBQVEsS0FBSztBQUN6RCxRQUFJLDBCQUFRLFVBQVUsRUFBRSxRQUFRLEtBQUssRUFBRSxRQUFRLGtCQUFrQixFQUFFO0FBQUEsTUFBUSxPQUFFO0FBaE1qRixZQUFBQTtBQWlNTSxpQkFBRSxVQUFTQSxNQUFBLE1BQU0sUUFBTixPQUFBQSxNQUFhLEVBQUUsRUFDeEIsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sTUFBTTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDcEM7QUFHQSxrQkFBYyxVQUFVLFVBQVU7QUFDbEMsZ0JBQVksTUFBTSxVQUFVLE1BQU0sV0FBVyxTQUFTLEtBQUs7QUFDM0QsVUFBTSxjQUFjLElBQUksMEJBQVEsV0FBVyxFQUN4QyxRQUFRLFFBQVEsRUFDaEIsUUFBUSx3R0FBOEY7QUFDekcsZ0JBQVksVUFBVSxNQUFNLGdCQUFnQjtBQUM1QyxnQkFBWSxVQUFVLE1BQU0sYUFBYTtBQUN6QyxVQUFNLFdBQVcsWUFBWSxVQUFVLFNBQVMsVUFBVTtBQUMxRCxhQUFTLE9BQU87QUFDaEIsYUFBUyxNQUFNLFFBQVE7QUFDdkIsYUFBUyxNQUFNLFlBQVk7QUFDM0IsYUFBUyxNQUFNLGFBQWE7QUFDNUIsYUFBUyxNQUFNLFdBQVc7QUFDMUIsYUFBUyxTQUFRLFdBQU0sV0FBTixZQUFnQjtBQUNqQyxhQUFTLGlCQUFpQixTQUFTLE1BQU07QUFBRSxZQUFNLFNBQVMsU0FBUztBQUFBLElBQU8sQ0FBQztBQUUzRSxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVksT0FBRTtBQXRONUQsWUFBQUE7QUF1Tk0saUJBQUUsVUFBVSxLQUFLLEdBQUcsRUFBRSxVQUFVLEtBQUssR0FBRyxFQUN0QyxTQUFTLFFBQU9BLE1BQUEsTUFBTSxZQUFOLE9BQUFBLE1BQWlCLENBQUMsQ0FBQyxFQUNuQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDaEQ7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTNOMUQsWUFBQUE7QUE0Tk0saUJBQUUsU0FBUyxRQUFPQSxNQUFBLE1BQU0sYUFBTixPQUFBQSxNQUFrQixFQUFFLENBQUMsRUFDckMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sV0FBVyxTQUFTLENBQUMsS0FBSztBQUFBLFFBQUksQ0FBQztBQUFBO0FBQUEsSUFDekQ7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FDeE9BLElBQUFDLG9CQUFrRTtBQU1sRSxJQUFNQyxzQkFBTixjQUFpQywrQkFBc0I7QUFBQSxFQUNyRCxZQUNFLEtBQ1EsVUFDUjtBQUNBLFVBQU0sR0FBRztBQUZEO0FBR1IsU0FBSyxlQUFlLG9DQUErQjtBQUFBLEVBQ3JEO0FBQUEsRUFFUSxnQkFBMkI7QUFDakMsVUFBTSxVQUFxQixDQUFDO0FBQzVCLFVBQU0sVUFBVSxDQUFDLE1BQWU7QUFDOUIsY0FBUSxLQUFLLENBQUM7QUFDZCxpQkFBVyxTQUFTLEVBQUUsVUFBVTtBQUM5QixZQUFJLGlCQUFpQiwwQkFBUyxTQUFRLEtBQUs7QUFBQSxNQUM3QztBQUFBLElBQ0Y7QUFDQSxZQUFRLEtBQUssSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUNoQyxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsZUFBZSxPQUEwQjtBQUN2QyxVQUFNLElBQUksTUFBTSxZQUFZO0FBQzVCLFdBQU8sS0FBSyxjQUFjLEVBQUU7QUFBQSxNQUFPLE9BQ2pDLEVBQUUsS0FBSyxZQUFZLEVBQUUsU0FBUyxDQUFDO0FBQUEsSUFDakM7QUFBQSxFQUNGO0FBQUEsRUFFQSxpQkFBaUIsUUFBaUIsSUFBdUI7QUFDdkQsT0FBRyxTQUFTLFFBQVEsRUFBRSxNQUFNLE9BQU8sU0FBUyxNQUFNLG1CQUFtQixPQUFPLEtBQUssQ0FBQztBQUFBLEVBQ3BGO0FBQUEsRUFFQSxtQkFBbUIsUUFBdUI7QUFDeEMsU0FBSyxTQUFTLE1BQU07QUFBQSxFQUN0QjtBQUNGO0FBRUEsSUFBTSxhQUFhLG9CQUFJLElBQUksQ0FBQyxRQUFRLFFBQVEsU0FBUyxRQUFRLFNBQVMsTUFBTSxDQUFDO0FBQzdFLElBQU0sYUFBYSxvQkFBSSxJQUFJLENBQUMsUUFBUSxTQUFTLFFBQVEsTUFBTSxDQUFDO0FBRXJELElBQU0sb0JBQU4sY0FBZ0MsVUFBVTtBQUFBLEVBQy9DLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLHFCQUFxQjtBQUNqQyxTQUFLLGNBQWMsRUFBRSxFQUFFLE1BQU0sT0FBSztBQUNoQyxjQUFRLE1BQU0seURBQXlELENBQUM7QUFDeEUsU0FBRyxRQUFRLG1EQUFtRDtBQUFBLElBQ2hFLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFjLGNBQWMsSUFBZ0M7QUFDMUQsVUFBTSxFQUFFLFNBQVMsSUFBSSxRQUFRLFdBQVcsVUFBVSxHQUFHLFdBQVcsSUFBSSxTQUFTLE9BQU8sSUFBSSxLQUFLLFNBQVM7QUFRdEcsU0FBSyxhQUFhLElBQUksS0FBSztBQUUzQixVQUFNLFVBQVUsR0FBRyxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUVyRCxRQUFJLFdBQVcsV0FBVztBQUN4QixjQUFRLFNBQVMsZ0JBQWdCO0FBQ2pDLFlBQU0sYUFBYSxNQUFNO0FBQ3ZCLGNBQU0sSUFBSSxRQUFRO0FBQ2xCLGNBQU0sWUFBWSxJQUFJLElBQUksS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLFNBQVMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSTtBQUNoRixnQkFBUSxNQUFNLFVBQVUsT0FBTyxTQUFTO0FBQUEsTUFDMUM7QUFDQSxpQkFBVztBQUNYLFlBQU0sS0FBSyxJQUFJLGVBQWUsVUFBVTtBQUN4QyxTQUFHLFFBQVEsT0FBTztBQUNsQixXQUFLLFNBQVMsTUFBTSxHQUFHLFdBQVcsQ0FBQztBQUFBLElBQ3JDLE9BQU87QUFDTCxjQUFRLE1BQU0sc0JBQXNCLGtEQUFrRCxPQUFPO0FBQUEsSUFDL0Y7QUFFQSxRQUFJLENBQUMsUUFBUTtBQUNYLFlBQU0sT0FBTyxRQUFRLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQzFELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sa0JBQWtCLENBQUM7QUFDeEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSw2RUFBNkUsQ0FBQztBQUNuSTtBQUFBLElBQ0Y7QUFFQSxVQUFNLFlBQVksS0FBSyxJQUFJLE1BQU0sc0JBQXNCLE1BQU07QUFDN0QsUUFBSSxFQUFFLHFCQUFxQiw0QkFBVTtBQUNuQyxjQUFRLFFBQVEsV0FBVyxNQUFNLGNBQWM7QUFDL0M7QUFBQSxJQUNGO0FBRUEsVUFBTSxRQUFRLEtBQUssY0FBYyxTQUFTLEVBQUUsTUFBTSxHQUFHLFFBQVE7QUFFN0QsZUFBVyxRQUFRLE9BQU87QUFDeEIsWUFBTSxNQUFNLElBQUksS0FBSyxVQUFVLFlBQVksQ0FBQztBQUM1QyxZQUFNLFVBQVUsUUFBUSxVQUFVLEVBQUUsS0FBSyxlQUFlLENBQUM7QUFFekQsVUFBSSxXQUFXLElBQUksR0FBRyxHQUFHO0FBQ3ZCLGNBQU0sTUFBTSxRQUFRLFNBQVMsS0FBSztBQUNsQyxZQUFJLE1BQU0sS0FBSyxJQUFJLE1BQU0sZ0JBQWdCLElBQUk7QUFDN0MsWUFBSSxVQUFVO0FBQ2QsWUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGVBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxNQUFNLEVBQUU7QUFBQSxRQUMvQyxDQUFDO0FBQUEsTUFDSCxXQUFXLFdBQVcsSUFBSSxHQUFHLEdBQUc7QUFDOUIsZ0JBQVEsU0FBUyxvQkFBb0I7QUFDckMsZ0JBQVEsVUFBVSxFQUFFLEtBQUssc0JBQXNCLE1BQU0sU0FBSSxDQUFDO0FBRTFELGNBQU0sUUFBUSxRQUFRLFNBQVMsT0FBTztBQUN0QyxjQUFNLE1BQU0sS0FBSyxJQUFJLE1BQU0sZ0JBQWdCLElBQUk7QUFDL0MsY0FBTSxRQUFRO0FBQ2QsY0FBTSxPQUFPO0FBQ2IsY0FBTSxhQUFhLGVBQWUsRUFBRTtBQUNwQyxjQUFNLFVBQVU7QUFFaEIsZ0JBQVEsaUJBQWlCLGNBQWMsTUFBTTtBQUFFLGVBQUssTUFBTSxLQUFLO0FBQUEsUUFBRyxDQUFDO0FBQ25FLGdCQUFRLGlCQUFpQixjQUFjLE1BQU07QUFBRSxnQkFBTSxNQUFNO0FBQUcsZ0JBQU0sY0FBYztBQUFBLFFBQUcsQ0FBQztBQUN0RixnQkFBUSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3RDLGVBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxNQUFNLEVBQUU7QUFBQSxRQUMvQyxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSxjQUFjLFFBQTBCO0FBQzlDLFVBQU0sUUFBaUIsQ0FBQztBQUN4QixVQUFNLFVBQVUsQ0FBQyxNQUFlO0FBQzlCLGlCQUFXLFNBQVMsRUFBRSxVQUFVO0FBQzlCLFlBQUksaUJBQWlCLHlCQUFPO0FBQzFCLGdCQUFNLE1BQU0sSUFBSSxNQUFNLFVBQVUsWUFBWSxDQUFDO0FBQzdDLGNBQUksV0FBVyxJQUFJLEdBQUcsS0FBSyxXQUFXLElBQUksR0FBRyxHQUFHO0FBQzlDLGtCQUFNLEtBQUssS0FBSztBQUFBLFVBQ2xCO0FBQUEsUUFDRixXQUFXLGlCQUFpQiwyQkFBUztBQUNuQyxrQkFBUSxLQUFLO0FBQUEsUUFDZjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQ0EsWUFBUSxNQUFNO0FBQ2QsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSwwQkFBMEIsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsUUFBUTtBQUNyRSxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0sNEJBQU4sY0FBd0Msd0JBQU07QUFBQSxFQUM1QyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUFDYixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFM0QsVUFBTSxRQUFRLGdCQUFnQixLQUFLLE1BQU07QUFFekMsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUEzSzVEO0FBNEtNLGlCQUFFLFVBQVMsV0FBTSxVQUFOLFlBQXlCLFNBQVMsRUFDM0MsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sUUFBUTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDdEM7QUFDQSxRQUFJO0FBQ0osUUFBSSwwQkFBUSxTQUFTLEVBQ2xCLFFBQVEsUUFBUSxFQUNoQixRQUFRLHNCQUFzQixFQUM5QixRQUFRLE9BQUs7QUFuTHBCO0FBb0xRLG1CQUFhO0FBQ2IsUUFBRSxVQUFTLFdBQU0sV0FBTixZQUEwQixFQUFFLEVBQ3JDLGVBQWUsb0JBQW9CLEVBQ25DLFNBQVMsT0FBSztBQUFFLGNBQU0sU0FBUztBQUFBLE1BQUcsQ0FBQztBQUFBLElBQ3ZDLENBQUMsRUFDQTtBQUFBLE1BQVUsU0FDVCxJQUFJLFFBQVEsUUFBUSxFQUFFLFdBQVcsc0JBQXNCLEVBQUUsUUFBUSxNQUFNO0FBQ3JFLFlBQUlBLG9CQUFtQixLQUFLLEtBQUssQ0FBQyxXQUFXO0FBQzNDLGdCQUFNLE9BQU8sT0FBTyxTQUFTLE1BQU0sS0FBSyxPQUFPO0FBQy9DLGdCQUFNLFNBQVM7QUFDZixxQkFBVyxTQUFTLElBQUk7QUFBQSxRQUMxQixDQUFDLEVBQUUsS0FBSztBQUFBLE1BQ1YsQ0FBQztBQUFBLElBQ0g7QUFDRixRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFFBQVEsRUFBRTtBQUFBLE1BQVksT0FBRTtBQWxNM0Q7QUFtTU0saUJBQUUsVUFBVSxRQUFRLE1BQU0sRUFBRSxVQUFVLFdBQVcsU0FBUyxFQUN4RCxTQUFTLFFBQU8sV0FBTSxXQUFOLFlBQWdCLE1BQU0sQ0FBQyxFQUN2QyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxTQUFTO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN2QztBQUNBLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFBWSxPQUFFO0FBdk01RDtBQXdNTSxpQkFBRSxVQUFVLEtBQUssR0FBRyxFQUFFLFVBQVUsS0FBSyxHQUFHLEVBQUUsVUFBVSxLQUFLLEdBQUcsRUFDMUQsU0FBUyxRQUFPLFdBQU0sWUFBTixZQUFpQixDQUFDLENBQUMsRUFDbkMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ2hEO0FBQ0EsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxXQUFXLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUE1TTFEO0FBNk1NLGlCQUFFLFNBQVMsUUFBTyxXQUFNLGFBQU4sWUFBa0IsRUFBRSxDQUFDLEVBQ3JDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFdBQVcsU0FBUyxDQUFDLEtBQUs7QUFBQSxRQUFJLENBQUM7QUFBQTtBQUFBLElBQ3pEO0FBQ0EsUUFBSSwwQkFBUSxTQUFTLEVBQUU7QUFBQSxNQUFVLFNBQy9CLElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLE9BQU8sS0FBSztBQUNqQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBQ3pOQSxJQUFBQyxvQkFBNkQ7QUFJN0QsSUFBTSxjQUFjO0FBRWIsSUFBTSxvQkFBTixjQUFnQyxVQUFVO0FBQUEsRUFBMUM7QUFBQTtBQUNMLFNBQVEsY0FBa0M7QUFDMUMsU0FBUSxnQkFBK0I7QUFBQTtBQUFBLEVBRXZDLE9BQU8sSUFBdUI7QUFDNUIsU0FBSyxjQUFjO0FBQ25CLE9BQUcsU0FBUyxxQkFBcUI7QUFFakMsU0FBSyxjQUFjLEVBQUUsRUFBRSxNQUFNLE9BQUs7QUFDaEMsY0FBUSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3hFLFNBQUcsUUFBUSxrREFBa0Q7QUFBQSxJQUMvRCxDQUFDO0FBR0QsU0FBSztBQUFBLE1BQ0gsS0FBSyxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsWUFBWTtBQUN2QyxjQUFNLEVBQUUsV0FBVyxHQUFHLElBQUksS0FBSyxTQUFTO0FBQ3hDLFlBQUksUUFBUSxTQUFTLFlBQVksS0FBSyxhQUFhO0FBQ2pELGNBQUksS0FBSyxrQkFBa0IsTUFBTTtBQUMvQixtQkFBTyxhQUFhLEtBQUssYUFBYTtBQUFBLFVBQ3hDO0FBQ0EsZ0JBQU0sU0FBUyxLQUFLO0FBQ3BCLGVBQUssZ0JBQWdCLE9BQU8sV0FBVyxNQUFNO0FBQzNDLGlCQUFLLGdCQUFnQjtBQUNyQixpQkFBSyxjQUFjLE1BQU0sRUFBRSxNQUFNLE9BQUs7QUFDcEMsc0JBQVEsTUFBTSx5RUFBeUUsQ0FBQztBQUFBLFlBQzFGLENBQUM7QUFBQSxVQUNILEdBQUcsV0FBVztBQUFBLFFBQ2hCO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFdBQWlCO0FBQ2YsUUFBSSxLQUFLLGtCQUFrQixNQUFNO0FBQy9CLGFBQU8sYUFBYSxLQUFLLGFBQWE7QUFDdEMsV0FBSyxnQkFBZ0I7QUFBQSxJQUN2QjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsY0FBYyxJQUFnQztBQUMxRCxVQUFNLEVBQUUsV0FBVyxJQUFJLFlBQVksS0FBSyxJQUFJLEtBQUssU0FBUztBQUsxRCxPQUFHLE1BQU07QUFFVCxRQUFJLENBQUMsVUFBVTtBQUNiLFlBQU0sT0FBTyxHQUFHLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3JELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sWUFBWSxDQUFDO0FBQ2xFLFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0scUVBQXFFLENBQUM7QUFDM0g7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLEtBQUssSUFBSSxNQUFNLHNCQUFzQixRQUFRO0FBQzFELFFBQUksRUFBRSxnQkFBZ0IsMEJBQVE7QUFDNUIsU0FBRyxRQUFRLG1CQUFtQixRQUFRLEVBQUU7QUFDeEM7QUFBQSxJQUNGO0FBRUEsUUFBSSxXQUFXO0FBQ2IsV0FBSyxhQUFhLElBQUksS0FBSyxRQUFRO0FBQUEsSUFDckM7QUFFQSxVQUFNLFlBQVksR0FBRyxVQUFVLEVBQUUsS0FBSyx3QkFBd0IsQ0FBQztBQUUvRCxRQUFJO0FBQ0YsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFlBQU0sbUNBQWlCLE9BQU8sS0FBSyxLQUFLLFNBQVMsV0FBVyxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQzdFLFNBQVMsR0FBRztBQUNWLGNBQVEsTUFBTSxnRUFBZ0UsQ0FBQztBQUMvRSxnQkFBVSxRQUFRLHVCQUF1QjtBQUFBLElBQzNDO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLDBCQUEwQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ3JFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSw0QkFBTixjQUF3Qyx3QkFBTTtBQUFBLEVBQzVDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUUzRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRSxRQUFRLCtDQUErQyxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBMUduSDtBQTJHTSxpQkFBRSxVQUFTLFdBQU0sYUFBTixZQUE0QixFQUFFLEVBQ3ZDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFdBQVc7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3pDO0FBQ0EsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxZQUFZLEVBQUU7QUFBQSxNQUFVLE9BQUU7QUE5RzdEO0FBK0dNLGlCQUFFLFVBQVMsV0FBTSxjQUFOLFlBQThCLElBQUksRUFDM0MsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sWUFBWTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDMUM7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FDM0hBLElBQUFDLG9CQUFzRDtBQUkvQyxJQUFNLGtCQUFOLGNBQThCLFVBQVU7QUFBQSxFQUM3QyxPQUFPLElBQXVCO0FBQzVCLE9BQUcsU0FBUyxtQkFBbUI7QUFDL0IsU0FBSyxjQUFjLEVBQUUsRUFBRSxNQUFNLE9BQUs7QUFDaEMsY0FBUSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3RFLFNBQUcsUUFBUSwwQkFBMEI7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBYyxjQUFjLElBQWdDO0FBQzFELFVBQU0sRUFBRSxRQUFRLElBQUksVUFBVSxHQUFHLElBQUksS0FBSyxTQUFTO0FBS25ELE9BQUcsTUFBTTtBQUVULFFBQUksT0FBTztBQUNULFdBQUssYUFBYSxJQUFJLEtBQUs7QUFBQSxJQUM3QjtBQUVBLFVBQU0sWUFBWSxHQUFHLFVBQVUsRUFBRSxLQUFLLHNCQUFzQixDQUFDO0FBRTdELFFBQUksQ0FBQyxTQUFTO0FBQ1osWUFBTSxPQUFPLFVBQVUsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDNUQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxZQUFZLENBQUM7QUFDbEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxpREFBaUQsQ0FBQztBQUN2RztBQUFBLElBQ0Y7QUFFQSxVQUFNLG1DQUFpQixPQUFPLEtBQUssS0FBSyxTQUFTLFdBQVcsSUFBSSxJQUFJO0FBQUEsRUFDdEU7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSx3QkFBd0IsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsUUFBUTtBQUNuRSxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0sMEJBQU4sY0FBc0Msd0JBQU07QUFBQSxFQUMxQyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUF0RGpCO0FBdURJLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV6RCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRSxRQUFRLHVDQUF1QyxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBN0Q3RyxZQUFBQztBQThETSxpQkFBRSxVQUFTQSxNQUFBLE1BQU0sVUFBTixPQUFBQSxNQUF5QixFQUFFLEVBQ3BDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFFBQVE7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3RDO0FBRUEsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxTQUFTLEVBQUUsUUFBUSxvQkFBb0I7QUFDdEUsVUFBTSxXQUFXLFVBQVUsU0FBUyxZQUFZLEVBQUUsS0FBSyxnQ0FBZ0MsQ0FBQztBQUN4RixhQUFTLFNBQVEsV0FBTSxZQUFOLFlBQTJCO0FBQzVDLGFBQVMsT0FBTztBQUNoQixhQUFTLGlCQUFpQixTQUFTLE1BQU07QUFBRSxZQUFNLFVBQVUsU0FBUztBQUFBLElBQU8sQ0FBQztBQUU1RSxRQUFJLDBCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FDakZBLElBQUFDLG9CQUF1RDtBQUloRCxJQUFNLFlBQU4sY0FBd0IsVUFBVTtBQUFBLEVBQ3ZDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLFlBQVk7QUFFeEIsVUFBTSxFQUFFLFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxLQUFLLFNBQVM7QUFLaEQsUUFBSSxPQUFPO0FBQ1QsV0FBSyxhQUFhLElBQUksS0FBSztBQUFBLElBQzdCO0FBRUEsVUFBTSxZQUFZLEdBQUcsVUFBVSxFQUFFLEtBQUsscUJBQXFCLENBQUM7QUFFNUQsUUFBSSxDQUFDLE1BQU07QUFDVCxZQUFNLE9BQU8sVUFBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUM1RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLE1BQU0sQ0FBQztBQUM1RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLG9EQUFvRCxDQUFDO0FBQzFHO0FBQUEsSUFDRjtBQUVBLGNBQVUsZ0JBQVkscUNBQWtCLElBQUksQ0FBQztBQUFBLEVBQy9DO0FBQUEsRUFFQSxhQUFhLFFBQTBCO0FBQ3JDLFFBQUksdUJBQXVCLEtBQUssS0FBSyxLQUFLLFNBQVMsUUFBUSxDQUFDLFFBQVE7QUFDbEUsV0FBSyxTQUFTLFNBQVM7QUFDdkIsYUFBTztBQUFBLElBQ1QsQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNWO0FBQ0Y7QUFFQSxJQUFNLHlCQUFOLGNBQXFDLHdCQUFNO0FBQUEsRUFDekMsWUFDRSxLQUNRLFFBQ0EsUUFDUjtBQUNBLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBOUNqQjtBQStDSSxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFeEQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLE1BQU07QUFFekMsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxhQUFhLEVBQUUsUUFBUSx1Q0FBdUMsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQXJEN0csWUFBQUM7QUFzRE0saUJBQUUsVUFBU0EsTUFBQSxNQUFNLFVBQU4sT0FBQUEsTUFBeUIsRUFBRSxFQUNwQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUVBLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsTUFBTSxFQUFFLFFBQVEscUNBQXFDO0FBQ3BGLFVBQU0sV0FBVyxVQUFVLFNBQVMsWUFBWSxFQUFFLEtBQUssZ0NBQWdDLENBQUM7QUFDeEYsYUFBUyxTQUFRLFdBQU0sU0FBTixZQUF3QjtBQUN6QyxhQUFTLE9BQU87QUFDaEIsYUFBUyxhQUFhLGNBQWMsT0FBTztBQUMzQyxhQUFTLGlCQUFpQixTQUFTLE1BQU07QUFBRSxZQUFNLE9BQU8sU0FBUztBQUFBLElBQU8sQ0FBQztBQUV6RSxRQUFJLDBCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FoQnhEQSxJQUFNLHNCQUFvQztBQUFBLEVBQ3hDLFNBQVM7QUFBQSxFQUNULGVBQWU7QUFBQSxFQUNmLFFBQVE7QUFBQTtBQUFBLElBRU47QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsT0FBTyxJQUFJLFNBQVMsR0FBRztBQUFBLElBQ25DO0FBQUEsSUFDQTtBQUFBLE1BQ0UsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLE1BQUcsS0FBSztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQ3JDLFFBQVEsRUFBRSxhQUFhLE9BQU8sVUFBVSxLQUFLO0FBQUEsSUFDL0M7QUFBQSxJQUNBO0FBQUEsTUFDRSxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsTUFBRyxLQUFLO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFDckMsUUFBUSxFQUFFLE9BQU8sZUFBZSxPQUFPLENBQUMsRUFBRTtBQUFBLElBQzVDO0FBQUE7QUFBQSxJQUVBO0FBQUEsTUFDRSxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsTUFBRyxLQUFLO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFDckMsUUFBUSxFQUFFLEtBQUssSUFBSSxPQUFPLGlCQUFpQixXQUFXLEtBQUs7QUFBQSxJQUM3RDtBQUFBLElBQ0E7QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsT0FBTyxVQUFVLFNBQVMsR0FBRyxPQUFPLENBQUMsRUFBRTtBQUFBLElBQ25EO0FBQUE7QUFBQSxJQUVBO0FBQUEsTUFDRSxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsTUFBRyxLQUFLO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFDckMsUUFBUSxFQUFFLEtBQUssSUFBSSxPQUFPLFVBQVUsU0FBUyxHQUFHLFVBQVUsR0FBRztBQUFBLElBQy9EO0FBQUE7QUFBQSxJQUVBO0FBQUEsTUFDRSxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsTUFBRyxLQUFLO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFDckMsUUFBUSxFQUFFLFFBQVEsSUFBSSxPQUFPLFdBQVcsU0FBUyxHQUFHLFVBQVUsR0FBRztBQUFBLElBQ25FO0FBQUEsRUFDRjtBQUNGO0FBR0EsU0FBUyxtQkFBaUM7QUFDeEMsU0FBTyxnQkFBZ0IsbUJBQW1CO0FBQzVDO0FBSUEsSUFBTSxvQkFBb0Isb0JBQUksSUFBWTtBQUFBLEVBQ3hDO0FBQUEsRUFBWTtBQUFBLEVBQWdCO0FBQUEsRUFBVztBQUFBLEVBQ3ZDO0FBQUEsRUFBZTtBQUFBLEVBQWlCO0FBQUEsRUFBUztBQUFBLEVBQ3pDO0FBQUEsRUFBZTtBQUNqQixDQUFDO0FBRUQsU0FBUyxxQkFBcUIsR0FBZ0M7QUFDNUQsTUFBSSxDQUFDLEtBQUssT0FBTyxNQUFNLFNBQVUsUUFBTztBQUN4QyxRQUFNLFFBQVE7QUFDZCxTQUNFLE9BQU8sTUFBTSxPQUFPLFlBQ3BCLE9BQU8sTUFBTSxTQUFTLFlBQVksa0JBQWtCLElBQUksTUFBTSxJQUFJLEtBQ2xFLE9BQU8sTUFBTSxRQUFRLFlBQVksTUFBTSxPQUFPLEtBQzlDLE9BQU8sTUFBTSxRQUFRLFlBQVksTUFBTSxPQUFPLEtBQzlDLE9BQU8sTUFBTSxZQUFZLFlBQVksTUFBTSxXQUFXLEtBQ3RELE9BQU8sTUFBTSxZQUFZLFlBQVksTUFBTSxXQUFXLEtBQ3RELE1BQU0sV0FBVyxRQUFRLE9BQU8sTUFBTSxXQUFXLFlBQVksQ0FBQyxNQUFNLFFBQVEsTUFBTSxNQUFNO0FBRTVGO0FBT0EsU0FBUyxlQUFlLEtBQTRCO0FBQ2xELFFBQU0sV0FBVyxpQkFBaUI7QUFDbEMsTUFBSSxDQUFDLE9BQU8sT0FBTyxRQUFRLFlBQVksTUFBTSxRQUFRLEdBQUcsRUFBRyxRQUFPO0FBRWxFLFFBQU0sSUFBSTtBQUNWLFFBQU0sVUFBVSxPQUFPLEVBQUUsWUFBWSxZQUFZLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxJQUN6RSxFQUFFLFVBQ0YsU0FBUztBQUNiLFFBQU0sZ0JBQWdCLE9BQU8sRUFBRSxrQkFBa0IsWUFDN0MsRUFBRSxnQkFDRixTQUFTO0FBQ2IsUUFBTSxTQUFTLE1BQU0sUUFBUSxFQUFFLE1BQU0sSUFDakMsRUFBRSxPQUFPLE9BQU8sb0JBQW9CLElBQ3BDLFNBQVM7QUFFYixTQUFPLEVBQUUsU0FBUyxlQUFlLE9BQU87QUFDMUM7QUFJQSxTQUFTLGlCQUF1QjtBQUM5QixnQkFBYyxNQUFNO0FBRXBCLGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsTUFBTSxTQUFTLFVBQVUsS0FBSztBQUFBLElBQy9DLGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksY0FBYyxLQUFLLFVBQVUsTUFBTTtBQUFBLEVBQzVFLENBQUM7QUFFRCxnQkFBYyxTQUFTO0FBQUEsSUFDckIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsZUFBZSxFQUFFLGFBQWEsT0FBTyxVQUFVLEtBQUs7QUFBQSxJQUNwRCxhQUFhLEVBQUUsU0FBUyxHQUFHLFNBQVMsRUFBRTtBQUFBLElBQ3RDLFFBQVEsQ0FBQyxLQUFLLFVBQVUsV0FBVyxJQUFJLFdBQVcsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUN6RSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLGVBQWUsUUFBUSxJQUFJLE9BQU8sQ0FBQyxFQUFFO0FBQUEsSUFDN0QsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxpQkFBaUIsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUMvRSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxLQUFLLElBQUksT0FBTyxpQkFBaUIsV0FBVyxLQUFLO0FBQUEsSUFDbEUsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxhQUFhLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDM0UsQ0FBQztBQUVELGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsT0FBTyxVQUFVLFNBQVMsR0FBRyxPQUFPLENBQUMsRUFBRTtBQUFBLElBQ3hELGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksYUFBYSxLQUFLLFVBQVUsTUFBTTtBQUFBLEVBQzNFLENBQUM7QUFFRCxnQkFBYyxTQUFTO0FBQUEsSUFDckIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsZUFBZSxFQUFFLEtBQUssSUFBSSxPQUFPLFVBQVUsU0FBUyxHQUFHLFVBQVUsR0FBRztBQUFBLElBQ3BFLGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksZ0JBQWdCLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDOUUsQ0FBQztBQUVELGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsUUFBUSxJQUFJLE9BQU8sV0FBVyxTQUFTLEdBQUcsVUFBVSxHQUFHO0FBQUEsSUFDeEUsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxrQkFBa0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUNoRixDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxVQUFVLElBQUksV0FBVyxLQUFLO0FBQUEsSUFDL0MsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxrQkFBa0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUNoRixDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLElBQUksU0FBUyxHQUFHO0FBQUEsSUFDeEMsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUM5RSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHO0FBQUEsSUFDckMsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxVQUFVLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDeEUsQ0FBQztBQUNIO0FBSUEsSUFBcUIsaUJBQXJCLGNBQTRDLHlCQUFrQztBQUFBLEVBQTlFO0FBQUE7QUFDRSxrQkFBdUIsaUJBQWlCO0FBQUE7QUFBQSxFQUV4QyxNQUFNLFNBQXdCO0FBQzVCLG1CQUFlO0FBRWYsVUFBTSxNQUFNLE1BQU0sS0FBSyxTQUFTO0FBQ2hDLFNBQUssU0FBUyxlQUFlLEdBQUc7QUFFaEMsU0FBSyxhQUFhLFdBQVcsQ0FBQyxTQUFTLElBQUksYUFBYSxNQUFNLElBQUksQ0FBQztBQUVuRSxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUFFLGFBQUssS0FBSyxhQUFhO0FBQUEsTUFBRztBQUFBLElBQzlDLENBQUM7QUFFRCxTQUFLLGNBQWMsUUFBUSxpQkFBaUIsTUFBTTtBQUFFLFdBQUssS0FBSyxhQUFhO0FBQUEsSUFBRyxDQUFDO0FBRS9FLFNBQUssY0FBYyxJQUFJLG1CQUFtQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBRXpELFNBQUssSUFBSSxVQUFVLGNBQWMsTUFBTTtBQUNyQyxVQUFJLEtBQUssT0FBTyxlQUFlO0FBQzdCLGFBQUssS0FBSyxhQUFhO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFNLFdBQTBCO0FBQzlCLFNBQUssSUFBSSxVQUFVLG1CQUFtQixTQUFTO0FBQUEsRUFDakQ7QUFBQSxFQUVBLE1BQU0sV0FBVyxRQUFxQztBQUNwRCxTQUFLLFNBQVM7QUFDZCxVQUFNLEtBQUssU0FBUyxNQUFNO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbEMsVUFBTSxFQUFFLFVBQVUsSUFBSSxLQUFLO0FBQzNCLFVBQU0sV0FBVyxVQUFVLGdCQUFnQixTQUFTO0FBQ3BELFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDdkIsZ0JBQVUsV0FBVyxTQUFTLENBQUMsQ0FBQztBQUNoQztBQUFBLElBQ0Y7QUFDQSxVQUFNLE9BQU8sVUFBVSxRQUFRLEtBQUs7QUFDcEMsVUFBTSxLQUFLLGFBQWEsRUFBRSxNQUFNLFdBQVcsUUFBUSxLQUFLLENBQUM7QUFDekQsY0FBVSxXQUFXLElBQUk7QUFBQSxFQUMzQjtBQUNGO0FBSUEsSUFBTSxxQkFBTixjQUFpQyxtQ0FBaUI7QUFBQSxFQUNoRCxZQUFZLEtBQWtCLFFBQXdCO0FBQ3BELFVBQU0sS0FBSyxNQUFNO0FBRFc7QUFBQSxFQUU5QjtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxVQUFNLEVBQUUsWUFBWSxJQUFJO0FBQ3hCLGdCQUFZLE1BQU07QUFDbEIsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUV0RCxRQUFJLDBCQUFRLFdBQVcsRUFDcEIsUUFBUSxpQkFBaUIsRUFDekIsUUFBUSx1REFBdUQsRUFDL0Q7QUFBQSxNQUFVLFlBQ1QsT0FDRyxTQUFTLEtBQUssT0FBTyxPQUFPLGFBQWEsRUFDekMsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sZ0JBQWdCO0FBQ25DLGNBQU0sS0FBSyxPQUFPLFdBQVcsS0FBSyxPQUFPLE1BQU07QUFBQSxNQUNqRCxDQUFDO0FBQUEsSUFDTDtBQUVGLFFBQUksMEJBQVEsV0FBVyxFQUNwQixRQUFRLGlCQUFpQixFQUN6QixRQUFRLHVDQUF1QyxFQUMvQztBQUFBLE1BQVksVUFDWCxLQUNHLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFNBQVMsT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLENBQUMsRUFDM0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sVUFBVSxPQUFPLEtBQUs7QUFDekMsY0FBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIkZvbGRlclN1Z2dlc3RNb2RhbCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSJdCn0K
