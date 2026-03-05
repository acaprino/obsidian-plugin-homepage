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
var MAX_ROW_SPAN = 12;
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
  render(blocks, columns, isInitial = false) {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.setAttribute("role", "list");
    this.gridEl.setAttribute("aria-label", "Homepage blocks");
    this.effectiveColumns = this.computeEffectiveColumns(columns);
    if (isInitial) {
      this.gridEl.addClass("homepage-grid--animating");
      setTimeout(() => this.gridEl.removeClass("homepage-grid--animating"), 500);
    }
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
        text: this.editMode ? "Click the button below to add your first block." : "Add blocks to build your personal dashboard. Toggle Edit mode in the toolbar to get started."
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
    if (instance.newRow) {
      this.gridEl.createDiv({ cls: "homepage-row-break" });
    }
    const wrapper = this.gridEl.createDiv({ cls: "homepage-block-wrapper" });
    wrapper.dataset.blockId = instance.id;
    wrapper.setAttribute("role", "listitem");
    this.applyGridPosition(wrapper, instance);
    if (this.editMode) {
      this.attachEditHandles(wrapper, instance);
    }
    const headerZone = wrapper.createDiv({ cls: "block-header-zone" });
    headerZone.setAttribute("role", "button");
    headerZone.setAttribute("tabindex", "0");
    headerZone.setAttribute("aria-expanded", String(!instance.collapsed));
    const chevron = headerZone.createSpan({ cls: "block-collapse-chevron" });
    chevron.setAttribute("aria-hidden", "true");
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
    const toggleCollapse = (e) => {
      e.stopPropagation();
      if (this.editMode) return;
      const isNowCollapsed = !wrapper.hasClass("block-collapsed");
      wrapper.toggleClass("block-collapsed", isNowCollapsed);
      chevron.toggleClass("is-collapsed", isNowCollapsed);
      headerZone.setAttribute("aria-expanded", String(!isNowCollapsed));
      const newBlocks = this.plugin.layout.blocks.map(
        (b) => b.id === instance.id ? { ...b, collapsed: isNowCollapsed } : b
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    };
    headerZone.addEventListener("click", toggleCollapse);
    headerZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse(e);
      }
    });
    if (instance.collapsed) chevron.addClass("is-collapsed");
    this.blocks.set(instance.id, { block, wrapper });
  }
  rowMinHeight(rowSpan) {
    if (rowSpan <= 1) return "";
    return `calc(var(--hp-row-unit, 200px) * ${rowSpan} + var(--hp-gap, 16px) * ${rowSpan - 1})`;
  }
  applyGridPosition(wrapper, instance) {
    const cols = this.effectiveColumns;
    const colSpan = Math.min(instance.colSpan, cols);
    const basisPercent = colSpan / cols * 100;
    const gapFraction = (cols - colSpan) / cols;
    wrapper.style.flex = `${colSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
    wrapper.style.minWidth = cols === 1 ? "0" : "var(--hp-card-min-width, 200px)";
    wrapper.style.minHeight = this.rowMinHeight(instance.rowSpan);
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
    const moveUpBtn = bar.createEl("button", { cls: "block-move-up-btn" });
    (0, import_obsidian.setIcon)(moveUpBtn, "chevron-up");
    moveUpBtn.setAttribute("aria-label", "Move block up");
    moveUpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = this.plugin.layout.blocks.findIndex((b) => b.id === instance.id);
      if (idx <= 0) return;
      const newBlocks = [...this.plugin.layout.blocks];
      [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
    });
    const moveDownBtn = bar.createEl("button", { cls: "block-move-down-btn" });
    (0, import_obsidian.setIcon)(moveDownBtn, "chevron-down");
    moveDownBtn.setAttribute("aria-label", "Move block down");
    moveDownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = this.plugin.layout.blocks.findIndex((b) => b.id === instance.id);
      if (idx < 0 || idx >= this.plugin.layout.blocks.length - 1) return;
      const newBlocks = [...this.plugin.layout.blocks];
      [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
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
      var _a, _b;
      e.preventDefault();
      (_a = this.activeAbortController) == null ? void 0 : _a.abort();
      const ac = new AbortController();
      this.activeAbortController = ac;
      const clone = document.createElement("div");
      clone.addClass("block-drag-clone");
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.left = `${e.clientX - wrapper.offsetWidth / 2}px`;
      clone.style.top = `${e.clientY - 20}px`;
      const themed = (_b = this.gridEl.closest(".app-container")) != null ? _b : document.body;
      themed.appendChild(clone);
      this.activeClone = clone;
      const placeholder = document.createElement("div");
      placeholder.addClass("block-drag-placeholder");
      placeholder.style.flex = wrapper.style.flex;
      placeholder.style.minWidth = wrapper.style.minWidth;
      placeholder.style.height = `${wrapper.offsetHeight}px`;
      wrapper.insertAdjacentElement("afterend", placeholder);
      const sourceId = instance.id;
      wrapper.addClass("block-dragging");
      const cachedRects = /* @__PURE__ */ new Map();
      for (const [id, { wrapper: w }] of this.blocks) {
        if (id !== sourceId) cachedRects.set(id, w.getBoundingClientRect());
      }
      let lastInsertBeforeId = null;
      const movePlaceholder = (insertBeforeId) => {
        var _a2;
        if (insertBeforeId === lastInsertBeforeId) return;
        lastInsertBeforeId = insertBeforeId;
        placeholder.remove();
        if (insertBeforeId) {
          const targetWrapper = (_a2 = this.blocks.get(insertBeforeId)) == null ? void 0 : _a2.wrapper;
          if (targetWrapper) {
            this.gridEl.insertBefore(placeholder, targetWrapper);
            return;
          }
        }
        this.gridEl.appendChild(placeholder);
      };
      const onMouseMove = (me) => {
        clone.style.left = `${me.clientX - wrapper.offsetWidth / 2}px`;
        clone.style.top = `${me.clientY - 20}px`;
        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, cachedRects);
        movePlaceholder(pt.insertBeforeId);
      };
      const onMouseUp = (me) => {
        ac.abort();
        this.activeAbortController = null;
        clone.remove();
        this.activeClone = null;
        placeholder.remove();
        wrapper.removeClass("block-dragging");
        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, cachedRects);
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
      const startY = e.clientY;
      const startColSpan = instance.colSpan;
      const startRowSpan = instance.rowSpan;
      const columns = this.effectiveColumns;
      const colWidth = this.gridEl.offsetWidth / columns;
      const rowUnitPx = Math.max(50, parseFloat(
        getComputedStyle(this.gridEl).getPropertyValue("--hp-row-unit").trim()
      ) || 200);
      let currentColSpan = startColSpan;
      let currentRowSpan = startRowSpan;
      const onMouseMove = (me) => {
        const deltaX = me.clientX - startX;
        const deltaY = me.clientY - startY;
        const deltaCols = Math.round(deltaX / colWidth);
        const deltaRows = Math.round(deltaY / rowUnitPx);
        currentColSpan = Math.max(1, Math.min(columns, startColSpan + deltaCols));
        currentRowSpan = Math.max(1, Math.min(MAX_ROW_SPAN, startRowSpan + deltaRows));
        const basisPercent = currentColSpan / columns * 100;
        const gapFraction = (columns - currentColSpan) / columns;
        wrapper.style.flex = `${currentColSpan} 1 calc(${basisPercent}% - var(--hp-gap, 16px) * ${gapFraction.toFixed(4)})`;
        wrapper.style.minHeight = this.rowMinHeight(currentRowSpan);
      };
      const onMouseUp = () => {
        ac.abort();
        this.activeAbortController = null;
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? { ...b, colSpan: currentColSpan, rowSpan: currentRowSpan } : b
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };
      document.addEventListener("mousemove", onMouseMove, { signal: ac.signal });
      document.addEventListener("mouseup", onMouseUp, { signal: ac.signal });
    });
  }
  findInsertionPointCached(x, y, excludeId, rects) {
    let bestTargetId = null;
    let bestDist = Infinity;
    let bestInsertBefore = true;
    for (const [id, rect] of rects) {
      if (id === excludeId) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const insertBefore = x < cx;
        return { targetId: id, insertBefore, insertBeforeId: insertBefore ? id : this.nextBlockId(id) };
      }
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
      const entry = this.blocks.get(scrollTargetId);
      if (entry) {
        entry.wrapper.addClass("block-just-added");
        entry.wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    let draftNewRow = this.instance.newRow === true;
    new import_obsidian.Setting(contentEl).setName("Start on new row").setDesc("Force this block to begin on a new row.").addToggle(
      (t) => t.setValue(draftNewRow).onChange((v) => {
        draftNewRow = v;
      })
    );
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.instance.config = draft;
        this.instance.newRow = draftNewRow || void 0;
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
    this.containerEl = containerEl;
    this.app = app;
    this.plugin = plugin;
    this.grid = grid;
    this.onColumnsChange = onColumnsChange;
    this.editMode = false;
    this.fabEl = containerEl.createDiv({ cls: "homepage-edit-fab" });
    this.fabEl.setAttribute("role", "button");
    this.fabEl.setAttribute("tabindex", "0");
    this.fabEl.setAttribute("aria-label", "Enter edit mode");
    this.fabEl.setText("\u270F");
    this.fabEl.addEventListener("click", () => this.toggleEditMode());
    this.fabEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleEditMode();
      }
    });
    this.toolbarEl = containerEl.createDiv({ cls: "homepage-toolbar" });
    this.toolbarEl.setAttribute("role", "toolbar");
    this.toolbarEl.setAttribute("aria-label", "Homepage toolbar");
    this.renderToolbar();
  }
  /** Toggle edit mode — called from FAB, Done button, and keyboard shortcut command. */
  toggleEditMode() {
    this.editMode = !this.editMode;
    this.grid.setEditMode(this.editMode);
    this.syncVisibility();
    this.renderToolbar();
  }
  syncVisibility() {
    this.fabEl.toggleClass("is-hidden", this.editMode);
    this.toolbarEl.toggleClass("is-visible", this.editMode);
  }
  renderToolbar() {
    this.toolbarEl.empty();
    const indicator = this.toolbarEl.createDiv({ cls: "toolbar-edit-indicator is-visible" });
    indicator.createDiv({ cls: "toolbar-edit-dot" });
    indicator.createSpan({ text: "Editing" });
    const colSelect = this.toolbarEl.createEl("select", { cls: "toolbar-col-select" });
    colSelect.setAttribute("aria-label", "Number of columns");
    [2, 3, 4].forEach((n) => {
      const opt = colSelect.createEl("option", { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener("change", () => {
      this.onColumnsChange(Number(colSelect.value));
    });
    const addBtn = this.toolbarEl.createEl("button", { cls: "toolbar-add-btn", text: "+ Add Block" });
    addBtn.addEventListener("click", () => {
      this.openAddBlockModal();
    });
    const doneBtn = this.toolbarEl.createEl("button", { cls: "toolbar-edit-btn toolbar-btn-active", text: "\u2713 Done" });
    doneBtn.addEventListener("click", () => this.toggleEditMode());
    this.grid.onRequestAddBlock = () => {
      this.openAddBlockModal();
    };
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
  getFabElement() {
    return this.fabEl;
  }
  destroy() {
    this.grid.onRequestAddBlock = null;
    this.fabEl.remove();
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
    contentEl.insertBefore(this.toolbar.getFabElement(), this.toolbar.getElement());
    this.grid.render(layout.blocks, layout.columns, true);
  }
  async onClose() {
    var _a, _b;
    (_a = this.grid) == null ? void 0 : _a.destroy();
    (_b = this.toolbar) == null ? void 0 : _b.destroy();
  }
  /** Toggle edit mode — called from keyboard shortcut command. */
  toggleEditMode() {
    var _a;
    (_a = this.toolbar) == null ? void 0 : _a.toggleEditMode();
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
  onunload() {
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
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
    const { source = "tag", tag = "", quotes = "", title = "Quotes", columns = 2, maxItems = 20, heightMode = "wrap" } = this.instance.config;
    this.renderHeader(el, title);
    el.toggleClass("quotes-list-block--extend", heightMode === "extend");
    const colsEl = el.createDiv({ cls: "quotes-columns" });
    if (heightMode === "wrap") {
      colsEl.setAttribute("tabindex", "0");
      colsEl.setAttribute("role", "region");
      colsEl.setAttribute("aria-label", "Quotes");
    }
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
    new import_obsidian10.Setting(contentEl).setName("Height mode").setDesc("Scroll keeps the block compact. Grow to fit all works best at full width.").addDropdown(
      (d) => {
        var _a2;
        return d.addOption("wrap", "Scroll (fixed height)").addOption("extend", "Grow to fit all").setValue((_a2 = draft.heightMode) != null ? _a2 : "wrap").onChange((v) => {
          draft.heightMode = v;
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
    const { filePath = "", showTitle = true, heightMode = "scroll" } = this.instance.config;
    el.empty();
    el.toggleClass("embedded-note-block--grow", heightMode === "grow");
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
    if (heightMode === "scroll") {
      contentEl.setAttribute("tabindex", "0");
      contentEl.setAttribute("role", "region");
      contentEl.setAttribute("aria-label", file.basename);
    }
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
    new import_obsidian12.Setting(contentEl).setName("Height mode").setDesc("Scroll keeps the block compact. Grow to fit all expands the card to show the full note.").addDropdown(
      (d) => {
        var _a;
        return d.addOption("scroll", "Scroll (fixed height)").addOption("grow", "Grow to fit all").setValue((_a = draft.heightMode) != null ? _a : "scroll").onChange((v) => {
          draft.heightMode = v;
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
  return typeof block.id === "string" && typeof block.type === "string" && VALID_BLOCK_TYPES.has(block.type) && typeof block.col === "number" && block.col >= 1 && typeof block.row === "number" && block.row >= 1 && typeof block.colSpan === "number" && block.colSpan >= 1 && typeof block.rowSpan === "number" && block.rowSpan >= 1 && Number.isFinite(block.rowSpan) && (block.newRow === void 0 || typeof block.newRow === "boolean") && block.config !== null && typeof block.config === "object" && !Array.isArray(block.config);
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
    this.addCommand({
      id: "toggle-edit-mode",
      name: "Toggle edit mode",
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.toggleEditMode();
          }
        }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiYgTnVtYmVyLmlzRmluaXRlKGJsb2NrLnJvd1NwYW4pICYmXG4gICAgKGJsb2NrLm5ld1JvdyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBibG9jay5uZXdSb3cgPT09ICdib29sZWFuJykgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdRdWljayBMaW5rcycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJ1F1aWNrIExpbmtzJywgZm9sZGVyOiAnJywgbGlua3M6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEZvbGRlckxpbmtzQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2luc2lnaHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnRGFpbHkgSW5zaWdodCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW5zaWdodEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICd0YWctZ3JpZCcsXG4gICAgZGlzcGxheU5hbWU6ICdWYWx1ZXMnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtZWRpdC1tb2RlJyxcbiAgICAgIG5hbWU6ICdUb2dnbGUgZWRpdCBtb2RlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xuICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgIGxlYWYudmlldy50b2dnbGVFZGl0TW9kZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBhYm92ZSBncmlkOyBGQUIgZmxvYXRzIGluZGVwZW5kZW50bHkgKGFscmVhZHkgaW4gY29udGVudEVsIHZpYSBFZGl0VG9vbGJhcilcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuICAgIGNvbnRlbnRFbC5pbnNlcnRCZWZvcmUodGhpcy50b29sYmFyLmdldEZhYkVsZW1lbnQoKSwgdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zLCB0cnVlKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogVG9nZ2xlIGVkaXQgbW9kZSBcdTIwMTQgY2FsbGVkIGZyb20ga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyPy50b2dnbGVFZGl0TW9kZSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5jb25zdCBNQVhfUk9XX1NQQU4gPSAxMjtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGVmZmVjdGl2ZUNvbHVtbnMgPSAzO1xuICAvKiogQ2FsbGJhY2sgdG8gdHJpZ2dlciB0aGUgQWRkIEJsb2NrIG1vZGFsIGZyb20gdGhlIGVtcHR5IHN0YXRlIENUQS4gKi9cbiAgb25SZXF1ZXN0QWRkQmxvY2s6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICAvKiogSUQgb2YgdGhlIG1vc3QgcmVjZW50bHkgYWRkZWQgYmxvY2sgXHUyMDE0IHVzZWQgZm9yIHNjcm9sbC1pbnRvLXZpZXcuICovXG4gIHByaXZhdGUgbGFzdEFkZGVkQmxvY2tJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0VmZmVjdGl2ZSA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnModGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgICAgaWYgKG5ld0VmZmVjdGl2ZSAhPT0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5ncmlkRWwpO1xuICB9XG5cbiAgLyoqIEV4cG9zZSB0aGUgcm9vdCBncmlkIGVsZW1lbnQgc28gSG9tZXBhZ2VWaWV3IGNhbiByZW9yZGVyIGl0IGluIHRoZSBET00uICovXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmdyaWRFbDtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMobGF5b3V0Q29sdW1uczogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCB3ID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGg7XG4gICAgaWYgKHcgPD0gMCkgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gICAgaWYgKHcgPD0gNTQwKSByZXR1cm4gMTtcbiAgICBpZiAodyA8PSA4NDApIHJldHVybiBNYXRoLm1pbigyLCBsYXlvdXRDb2x1bW5zKTtcbiAgICBpZiAodyA8PSAxMDI0KSByZXR1cm4gTWF0aC5taW4oMywgbGF5b3V0Q29sdW1ucyk7XG4gICAgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gIH1cblxuICByZW5kZXIoYmxvY2tzOiBCbG9ja0luc3RhbmNlW10sIGNvbHVtbnM6IG51bWJlciwgaXNJbml0aWFsID0gZmFsc2UpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0Jyk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIGJsb2NrcycpO1xuICAgIHRoaXMuZWZmZWN0aXZlQ29sdW1ucyA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMoY29sdW1ucyk7XG5cbiAgICAvLyBTdGFnZ2VyIGFuaW1hdGlvbiBvbmx5IG9uIHRoZSBpbml0aWFsIHJlbmRlciAobm90IHJlb3JkZXIvY29sbGFwc2UvY29sdW1uIGNoYW5nZSlcbiAgICBpZiAoaXNJbml0aWFsKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnaG9tZXBhZ2UtZ3JpZC0tYW5pbWF0aW5nJyk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdob21lcGFnZS1ncmlkLS1hbmltYXRpbmcnKSwgNTAwKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmdyaWRFbC5yZW1vdmVDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktc3RhdGUnIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktaWNvbicsIHRleHQ6ICdcXHV7MUYzRTB9JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS10aXRsZScsIHRleHQ6ICdZb3VyIGhvbWVwYWdlIGlzIGVtcHR5JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywge1xuICAgICAgICBjbHM6ICdob21lcGFnZS1lbXB0eS1kZXNjJyxcbiAgICAgICAgdGV4dDogdGhpcy5lZGl0TW9kZVxuICAgICAgICAgID8gJ0NsaWNrIHRoZSBidXR0b24gYmVsb3cgdG8gYWRkIHlvdXIgZmlyc3QgYmxvY2suJ1xuICAgICAgICAgIDogJ0FkZCBibG9ja3MgdG8gYnVpbGQgeW91ciBwZXJzb25hbCBkYXNoYm9hcmQuIFRvZ2dsZSBFZGl0IG1vZGUgaW4gdGhlIHRvb2xiYXIgdG8gZ2V0IHN0YXJ0ZWQuJyxcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgdGhpcy5vblJlcXVlc3RBZGRCbG9jaykge1xuICAgICAgICBjb25zdCBjdGEgPSBlbXB0eS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS1jdGEnLCB0ZXh0OiAnQWRkIFlvdXIgRmlyc3QgQmxvY2snIH0pO1xuICAgICAgICBjdGEuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IHRoaXMub25SZXF1ZXN0QWRkQmxvY2s/LigpOyB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGJsb2Nrcykge1xuICAgICAgdGhpcy5yZW5kZXJCbG9jayhpbnN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldChpbnN0YW5jZS50eXBlKTtcbiAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgIGlmIChpbnN0YW5jZS5uZXdSb3cpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXJvdy1icmVhaycgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvLyBIZWFkZXIgem9uZSBcdTIwMTQgYWx3YXlzIHZpc2libGU7IGhvdXNlcyB0aXRsZSArIGNvbGxhcHNlIGNoZXZyb25cbiAgICBjb25zdCBoZWFkZXJab25lID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXItem9uZScgfSk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaW5zdGFuY2UuY29sbGFwc2VkKSk7XG4gICAgY29uc3QgY2hldnJvbiA9IGhlYWRlclpvbmUuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWNvbGxhcHNlLWNoZXZyb24nIH0pO1xuICAgIGNoZXZyb24uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2suc2V0SGVhZGVyQ29udGFpbmVyKGhlYWRlclpvbmUpO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5jb2xsYXBzZWQpIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuXG4gICAgY29uc3QgdG9nZ2xlQ29sbGFwc2UgPSAoZTogRXZlbnQpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSkgcmV0dXJuOyAvLyBlZGl0IG1vZGU6IGhhbmRsZSBiYXIgb3ducyBpbnRlcmFjdGlvblxuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjaGV2cm9uLnRvZ2dsZUNsYXNzKCdpcy1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaXNOb3dDb2xsYXBzZWQpKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbGxhcHNlZDogaXNOb3dDb2xsYXBzZWQgfSA6IGIsXG4gICAgICApO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB9O1xuXG4gICAgaGVhZGVyWm9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUNvbGxhcHNlKTtcbiAgICBoZWFkZXJab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0b2dnbGVDb2xsYXBzZShlKTsgfVxuICAgIH0pO1xuXG4gICAgaWYgKGluc3RhbmNlLmNvbGxhcHNlZCkgY2hldnJvbi5hZGRDbGFzcygnaXMtY29sbGFwc2VkJyk7XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIHJvd01pbkhlaWdodChyb3dTcGFuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGlmIChyb3dTcGFuIDw9IDEpIHJldHVybiAnJztcbiAgICByZXR1cm4gYGNhbGModmFyKC0taHAtcm93LXVuaXQsIDIwMHB4KSAqICR7cm93U3Bhbn0gKyB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtyb3dTcGFuIC0gMX0pYDtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgY29scyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oaW5zdGFuY2UuY29sU3BhbiwgY29scyk7XG4gICAgLy8gRm9yIE4gY29sdW1ucyB0aGVyZSBhcmUgKE4tMSkgZ2FwcyBkaXN0cmlidXRlZCBhY3Jvc3MgTiBzbG90cy5cbiAgICAvLyBBIGJsb2NrIHNwYW5uaW5nIFMgY29sdW1ucyBjb3ZlcnMgUyBzbG90cyBhbmQgKFMtMSkgaW50ZXJuYWwgZ2FwcyxcbiAgICAvLyBzbyBpdCBtdXN0IHN1YnRyYWN0IChOLVMpL04gc2hhcmUgb2YgdGhlIHRvdGFsIGdhcCBzcGFjZS5cbiAgICAvLyBGb3JtdWxhOiBiYXNpcyA9IFMvTiAqIDEwMCUgLSAoTi1TKS9OICogZ2FwXG4gICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGNvbFNwYW4gLyBjb2xzKSAqIDEwMDtcbiAgICBjb25zdCBnYXBGcmFjdGlvbiA9IChjb2xzIC0gY29sU3BhbikgLyBjb2xzO1xuICAgIHdyYXBwZXIuc3R5bGUuZmxleCA9IGAke2NvbFNwYW59IDEgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSAqICR7Z2FwRnJhY3Rpb24udG9GaXhlZCg0KX0pYDtcbiAgICB3cmFwcGVyLnN0eWxlLm1pbldpZHRoID0gY29scyA9PT0gMSA/ICcwJyA6ICd2YXIoLS1ocC1jYXJkLW1pbi13aWR0aCwgMjAwcHgpJztcbiAgICB3cmFwcGVyLnN0eWxlLm1pbkhlaWdodCA9IHRoaXMucm93TWluSGVpZ2h0KGluc3RhbmNlLnJvd1NwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hFZGl0SGFuZGxlcyh3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBiYXIgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhhbmRsZS1iYXInIH0pO1xuXG4gICAgY29uc3QgaGFuZGxlID0gYmFyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLW1vdmUtaGFuZGxlJyB9KTtcbiAgICBzZXRJY29uKGhhbmRsZSwgJ2dyaXAtdmVydGljYWwnKTtcbiAgICBoYW5kbGUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuXG4gICAgY29uc3Qgc2V0dGluZ3NCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stc2V0dGluZ3MtYnRuJyB9KTtcbiAgICBzZXRJY29uKHNldHRpbmdzQnRuLCAnc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQmxvY2sgc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmJsb2Nrcy5nZXQoaW5zdGFuY2UuaWQpO1xuICAgICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuICAgICAgY29uc3Qgb25TYXZlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyBpbnN0YW5jZSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuICAgICAgbmV3IEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgaW5zdGFuY2UsIGVudHJ5LmJsb2NrLCBvblNhdmUpLm9wZW4oKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1yZW1vdmUtYnRuJyB9KTtcbiAgICBzZXRJY29uKHJlbW92ZUJ0biwgJ3gnKTtcbiAgICByZW1vdmVCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1JlbW92ZSBibG9jaycpO1xuICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgbmV3IFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsKHRoaXMuYXBwLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gTW92ZSB1cCAvIGRvd24ga2V5Ym9hcmQtYWNjZXNzaWJsZSByZW9yZGVyIGJ1dHRvbnNcbiAgICBjb25zdCBtb3ZlVXBCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stbW92ZS11cC1idG4nIH0pO1xuICAgIHNldEljb24obW92ZVVwQnRuLCAnY2hldnJvbi11cCcpO1xuICAgIG1vdmVVcEJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTW92ZSBibG9jayB1cCcpO1xuICAgIG1vdmVVcEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaWR4ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoaWR4IDw9IDApIHJldHVybjtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzXTtcbiAgICAgIFtuZXdCbG9ja3NbaWR4IC0gMV0sIG5ld0Jsb2Nrc1tpZHhdXSA9IFtuZXdCbG9ja3NbaWR4XSwgbmV3QmxvY2tzW2lkeCAtIDFdXTtcbiAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbW92ZURvd25CdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stbW92ZS1kb3duLWJ0bicgfSk7XG4gICAgc2V0SWNvbihtb3ZlRG93bkJ0biwgJ2NoZXZyb24tZG93bicpO1xuICAgIG1vdmVEb3duQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdNb3ZlIGJsb2NrIGRvd24nKTtcbiAgICBtb3ZlRG93bkJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaWR4ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoaWR4IDwgMCB8fCBpZHggPj0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5sZW5ndGggLSAxKSByZXR1cm47XG4gICAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrc107XG4gICAgICBbbmV3QmxvY2tzW2lkeF0sIG5ld0Jsb2Nrc1tpZHggKyAxXV0gPSBbbmV3QmxvY2tzW2lkeCArIDFdLCBuZXdCbG9ja3NbaWR4XV07XG4gICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaXAgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLXJlc2l6ZS1ncmlwJyB9KTtcbiAgICBzZXRJY29uKGdyaXAsICdtYXhpbWl6ZS0yJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICB0aGlzLmF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcCwgd3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgdGhpcy5hdHRhY2hEcmFnSGFuZGxlcihoYW5kbGUsIHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgaGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICAvLyBGbG9hdGluZyBjbG9uZSB0aGF0IGZvbGxvd3MgdGhlIGN1cnNvclxuICAgICAgY29uc3QgY2xvbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIGNvbnN0IHRoZW1lZCA9ICh0aGlzLmdyaWRFbC5jbG9zZXN0KCcuYXBwLWNvbnRhaW5lcicpID8/IGRvY3VtZW50LmJvZHkpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhlbWVkLmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBjbG9uZTtcblxuICAgICAgLy8gUGxhY2Vob2xkZXIgXHUyMDE0IHNob3dzIHRoZSBsYW5kaW5nIHNwb3QgaW4gdGhlIHJlYWwgbGF5b3V0XG4gICAgICBjb25zdCBwbGFjZWhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgcGxhY2Vob2xkZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWctcGxhY2Vob2xkZXInKTtcbiAgICAgIHBsYWNlaG9sZGVyLnN0eWxlLmZsZXggPSB3cmFwcGVyLnN0eWxlLmZsZXg7XG4gICAgICBwbGFjZWhvbGRlci5zdHlsZS5taW5XaWR0aCA9IHdyYXBwZXIuc3R5bGUubWluV2lkdGg7XG4gICAgICBwbGFjZWhvbGRlci5zdHlsZS5oZWlnaHQgPSBgJHt3cmFwcGVyLm9mZnNldEhlaWdodH1weGA7XG4gICAgICB3cmFwcGVyLmluc2VydEFkamFjZW50RWxlbWVudCgnYWZ0ZXJlbmQnLCBwbGFjZWhvbGRlcik7XG5cbiAgICAgIGNvbnN0IHNvdXJjZUlkID0gaW5zdGFuY2UuaWQ7XG4gICAgICB3cmFwcGVyLmFkZENsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuXG4gICAgICAvLyBDYWNoZSByZWN0cyBvbmNlIGF0IGRyYWcgc3RhcnQgdG8gYXZvaWQgbGF5b3V0IHRocmFzaCBvbiBldmVyeSBtb3VzZW1vdmVcbiAgICAgIGNvbnN0IGNhY2hlZFJlY3RzID0gbmV3IE1hcDxzdHJpbmcsIERPTVJlY3Q+KCk7XG4gICAgICBmb3IgKGNvbnN0IFtpZCwgeyB3cmFwcGVyOiB3IH1dIG9mIHRoaXMuYmxvY2tzKSB7XG4gICAgICAgIGlmIChpZCAhPT0gc291cmNlSWQpIGNhY2hlZFJlY3RzLnNldChpZCwgdy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSk7XG4gICAgICB9XG5cbiAgICAgIGxldCBsYXN0SW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICBjb25zdCBtb3ZlUGxhY2Vob2xkZXIgPSAoaW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGwpID0+IHtcbiAgICAgICAgaWYgKGluc2VydEJlZm9yZUlkID09PSBsYXN0SW5zZXJ0QmVmb3JlSWQpIHJldHVybjtcbiAgICAgICAgbGFzdEluc2VydEJlZm9yZUlkID0gaW5zZXJ0QmVmb3JlSWQ7XG4gICAgICAgIHBsYWNlaG9sZGVyLnJlbW92ZSgpO1xuICAgICAgICBpZiAoaW5zZXJ0QmVmb3JlSWQpIHtcbiAgICAgICAgICBjb25zdCB0YXJnZXRXcmFwcGVyID0gdGhpcy5ibG9ja3MuZ2V0KGluc2VydEJlZm9yZUlkKT8ud3JhcHBlcjtcbiAgICAgICAgICBpZiAodGFyZ2V0V3JhcHBlcikge1xuICAgICAgICAgICAgdGhpcy5ncmlkRWwuaW5zZXJ0QmVmb3JlKHBsYWNlaG9sZGVyLCB0YXJnZXRXcmFwcGVyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ncmlkRWwuYXBwZW5kQ2hpbGQocGxhY2Vob2xkZXIpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke21lLmNsaWVudFggLSB3cmFwcGVyLm9mZnNldFdpZHRoIC8gMn1weGA7XG4gICAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke21lLmNsaWVudFkgLSAyMH1weGA7XG4gICAgICAgIGNvbnN0IHB0ID0gdGhpcy5maW5kSW5zZXJ0aW9uUG9pbnRDYWNoZWQobWUuY2xpZW50WCwgbWUuY2xpZW50WSwgc291cmNlSWQsIGNhY2hlZFJlY3RzKTtcbiAgICAgICAgbW92ZVBsYWNlaG9sZGVyKHB0Lmluc2VydEJlZm9yZUlkKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIGNsb25lLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICAgICAgcGxhY2Vob2xkZXIucmVtb3ZlKCk7XG4gICAgICAgIHdyYXBwZXIucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludENhY2hlZChtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCwgY2FjaGVkUmVjdHMpO1xuICAgICAgICB0aGlzLnJlb3JkZXJCbG9jayhzb3VyY2VJZCwgcHQuaW5zZXJ0QmVmb3JlSWQpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRZID0gZS5jbGllbnRZO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IHN0YXJ0Um93U3BhbiA9IGluc3RhbmNlLnJvd1NwYW47XG4gICAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zO1xuICAgICAgY29uc3QgY29sV2lkdGggPSB0aGlzLmdyaWRFbC5vZmZzZXRXaWR0aCAvIGNvbHVtbnM7XG4gICAgICBjb25zdCByb3dVbml0UHggPVxuICAgICAgICBNYXRoLm1heCg1MCwgcGFyc2VGbG9hdChcbiAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZ3JpZEVsKS5nZXRQcm9wZXJ0eVZhbHVlKCctLWhwLXJvdy11bml0JykudHJpbSgpLFxuICAgICAgICApIHx8IDIwMCk7XG4gICAgICBsZXQgY3VycmVudENvbFNwYW4gPSBzdGFydENvbFNwYW47XG4gICAgICBsZXQgY3VycmVudFJvd1NwYW4gPSBzdGFydFJvd1NwYW47XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IG1lLmNsaWVudFggLSBzdGFydFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IG1lLmNsaWVudFkgLSBzdGFydFk7XG4gICAgICAgIGNvbnN0IGRlbHRhQ29scyA9IE1hdGgucm91bmQoZGVsdGFYIC8gY29sV2lkdGgpO1xuICAgICAgICBjb25zdCBkZWx0YVJvd3MgPSBNYXRoLnJvdW5kKGRlbHRhWSAvIHJvd1VuaXRQeCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGN1cnJlbnRSb3dTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oTUFYX1JPV19TUEFOLCBzdGFydFJvd1NwYW4gKyBkZWx0YVJvd3MpKTtcbiAgICAgICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGN1cnJlbnRDb2xTcGFuIC8gY29sdW1ucykgKiAxMDA7XG4gICAgICAgIGNvbnN0IGdhcEZyYWN0aW9uID0gKGNvbHVtbnMgLSBjdXJyZW50Q29sU3BhbikgLyBjb2x1bW5zO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMSBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtnYXBGcmFjdGlvbi50b0ZpeGVkKDQpfSlgO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLm1pbkhlaWdodCA9IHRoaXMucm93TWluSGVpZ2h0KGN1cnJlbnRSb3dTcGFuKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4sIHJvd1NwYW46IGN1cnJlbnRSb3dTcGFuIH0gOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kSW5zZXJ0aW9uUG9pbnRDYWNoZWQoXG4gICAgeDogbnVtYmVyLFxuICAgIHk6IG51bWJlcixcbiAgICBleGNsdWRlSWQ6IHN0cmluZyxcbiAgICByZWN0czogTWFwPHN0cmluZywgRE9NUmVjdD4sXG4gICk6IHsgdGFyZ2V0SWQ6IHN0cmluZyB8IG51bGw7IGluc2VydEJlZm9yZTogYm9vbGVhbjsgaW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGwgfSB7XG4gICAgbGV0IGJlc3RUYXJnZXRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGJlc3REaXN0ID0gSW5maW5pdHk7XG4gICAgbGV0IGJlc3RJbnNlcnRCZWZvcmUgPSB0cnVlO1xuXG4gICAgZm9yIChjb25zdCBbaWQsIHJlY3RdIG9mIHJlY3RzKSB7XG4gICAgICBpZiAoaWQgPT09IGV4Y2x1ZGVJZCkgY29udGludWU7XG4gICAgICBjb25zdCBjeCA9IHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyO1xuICAgICAgY29uc3QgY3kgPSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMjtcblxuICAgICAgLy8gSWYgY3Vyc29yIGlzIGRpcmVjdGx5IG92ZXIgdGhpcyBjYXJkLCB1c2UgaXQgaW1tZWRpYXRlbHlcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIGNvbnN0IGluc2VydEJlZm9yZSA9IHggPCBjeDtcbiAgICAgICAgcmV0dXJuIHsgdGFyZ2V0SWQ6IGlkLCBpbnNlcnRCZWZvcmUsIGluc2VydEJlZm9yZUlkOiBpbnNlcnRCZWZvcmUgPyBpZCA6IHRoaXMubmV4dEJsb2NrSWQoaWQpIH07XG4gICAgICB9XG5cbiAgICAgIC8vIEJleW9uZCAzMDBweCBmcm9tIGNlbnRlciwgZG9uJ3Qgc2hvdyBpbmRpY2F0b3IgXHUyMDE0IHByZXZlbnRzIHVuaW50dWl0aXZlIGhpZ2hsaWdodHNcbiAgICAgIGNvbnN0IGRpc3QgPSBNYXRoLmh5cG90KHggLSBjeCwgeSAtIGN5KTtcbiAgICAgIGlmIChkaXN0IDwgYmVzdERpc3QgJiYgZGlzdCA8IDMwMCkge1xuICAgICAgICBiZXN0RGlzdCA9IGRpc3Q7XG4gICAgICAgIGJlc3RUYXJnZXRJZCA9IGlkO1xuICAgICAgICBiZXN0SW5zZXJ0QmVmb3JlID0geCA8IGN4O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghYmVzdFRhcmdldElkKSByZXR1cm4geyB0YXJnZXRJZDogbnVsbCwgaW5zZXJ0QmVmb3JlOiB0cnVlLCBpbnNlcnRCZWZvcmVJZDogbnVsbCB9O1xuICAgIHJldHVybiB7XG4gICAgICB0YXJnZXRJZDogYmVzdFRhcmdldElkLFxuICAgICAgaW5zZXJ0QmVmb3JlOiBiZXN0SW5zZXJ0QmVmb3JlLFxuICAgICAgaW5zZXJ0QmVmb3JlSWQ6IGJlc3RJbnNlcnRCZWZvcmUgPyBiZXN0VGFyZ2V0SWQgOiB0aGlzLm5leHRCbG9ja0lkKGJlc3RUYXJnZXRJZCksXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgbmV4dEJsb2NrSWQoaWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGJsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3M7XG4gICAgY29uc3QgaWR4ID0gYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGlkKTtcbiAgICByZXR1cm4gaWR4ID49IDAgJiYgaWR4IDwgYmxvY2tzLmxlbmd0aCAtIDEgPyBibG9ja3NbaWR4ICsgMV0uaWQgOiBudWxsO1xuICB9XG5cbiAgLyoqIFJlbW92ZSB0aGUgZHJhZ2dlZCBibG9jayBmcm9tIGl0cyBjdXJyZW50IHBvc2l0aW9uIGFuZCBpbnNlcnQgaXQgYmVmb3JlIGluc2VydEJlZm9yZUlkIChudWxsID0gYXBwZW5kKS4gKi9cbiAgcHJpdmF0ZSByZW9yZGVyQmxvY2soZHJhZ2dlZElkOiBzdHJpbmcsIGluc2VydEJlZm9yZUlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgY29uc3QgYmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcztcbiAgICBjb25zdCBkcmFnZ2VkID0gYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBkcmFnZ2VkSWQpO1xuICAgIGlmICghZHJhZ2dlZCkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd2l0aG91dERyYWdnZWQgPSBibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gZHJhZ2dlZElkKTtcbiAgICBjb25zdCBpbnNlcnRBdCA9IGluc2VydEJlZm9yZUlkXG4gICAgICA/IHdpdGhvdXREcmFnZ2VkLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc2VydEJlZm9yZUlkKVxuICAgICAgOiB3aXRob3V0RHJhZ2dlZC5sZW5ndGg7XG5cbiAgICAvLyBOby1vcCBpZiBlZmZlY3RpdmVseSBzYW1lIHBvc2l0aW9uXG4gICAgY29uc3Qgb3JpZ2luYWxJZHggPSBibG9ja3MuZmluZEluZGV4KGIgPT4gYi5pZCA9PT0gZHJhZ2dlZElkKTtcbiAgICBjb25zdCByZXNvbHZlZEF0ID0gaW5zZXJ0QXQgPT09IC0xID8gd2l0aG91dERyYWdnZWQubGVuZ3RoIDogaW5zZXJ0QXQ7XG4gICAgaWYgKHJlc29sdmVkQXQgPT09IG9yaWdpbmFsSWR4IHx8IHJlc29sdmVkQXQgPT09IG9yaWdpbmFsSWR4ICsgMSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3QmxvY2tzID0gW1xuICAgICAgLi4ud2l0aG91dERyYWdnZWQuc2xpY2UoMCwgcmVzb2x2ZWRBdCksXG4gICAgICBkcmFnZ2VkLFxuICAgICAgLi4ud2l0aG91dERyYWdnZWQuc2xpY2UocmVzb2x2ZWRBdCksXG4gICAgXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgLyoqIFVwZGF0ZSBjb2x1bW4gY291bnQsIGNsYW1waW5nIGVhY2ggYmxvY2sncyBjb2wgYW5kIGNvbFNwYW4gdG8gZml0LiAqL1xuICBzZXRDb2x1bW5zKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgY29uc3QgY29sID0gTWF0aC5taW4oYi5jb2wsIG4pO1xuICAgICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGIuY29sU3BhbiwgbiAtIGNvbCArIDEpO1xuICAgICAgcmV0dXJuIHsgLi4uYiwgY29sLCBjb2xTcGFuIH07XG4gICAgfSk7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgY29sdW1uczogbiwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgYWRkQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgaW5zdGFuY2VdO1xuICAgIHRoaXMubGFzdEFkZGVkQmxvY2tJZCA9IGluc3RhbmNlLmlkO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVyZW5kZXIoKTogdm9pZCB7XG4gICAgY29uc3QgZm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgZm9jdXNlZEJsb2NrSWQgPSAoZm9jdXNlZD8uY2xvc2VzdCgnW2RhdGEtYmxvY2staWRdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uZGF0YXNldC5ibG9ja0lkO1xuICAgIGNvbnN0IHNjcm9sbFRhcmdldElkID0gdGhpcy5sYXN0QWRkZWRCbG9ja0lkO1xuICAgIHRoaXMubGFzdEFkZGVkQmxvY2tJZCA9IG51bGw7XG5cbiAgICB0aGlzLnJlbmRlcih0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG5cbiAgICBpZiAoc2Nyb2xsVGFyZ2V0SWQpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ibG9ja3MuZ2V0KHNjcm9sbFRhcmdldElkKTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICBlbnRyeS53cmFwcGVyLmFkZENsYXNzKCdibG9jay1qdXN0LWFkZGVkJyk7XG4gICAgICAgIGVudHJ5LndyYXBwZXIuc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnbmVhcmVzdCcgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChmb2N1c2VkQmxvY2tJZCkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgW2RhdGEtYmxvY2staWQ9XCIke2ZvY3VzZWRCbG9ja0lkfVwiXWApO1xuICAgICAgZWw/LmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFVubG9hZCBhbGwgYmxvY2tzIGFuZCBjYW5jZWwgYW55IGluLXByb2dyZXNzIGRyYWcvcmVzaXplLiAqL1xuICBkZXN0cm95QWxsKCk6IHZvaWQge1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZUNsb25lPy5yZW1vdmUoKTtcbiAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcblxuICAgIGZvciAoY29uc3QgeyBibG9jayB9IG9mIHRoaXMuYmxvY2tzLnZhbHVlcygpKSB7XG4gICAgICBibG9jay51bmxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5ibG9ja3MuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKiBGdWxsIHRlYXJkb3duOiB1bmxvYWQgYmxvY2tzIGFuZCByZW1vdmUgdGhlIGdyaWQgZWxlbWVudCBmcm9tIHRoZSBET00uICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBudWxsO1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLnJlbW92ZSgpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBzZXR0aW5ncyBtb2RhbCAodGl0bGUgc2VjdGlvbiArIGJsb2NrLXNwZWNpZmljIHNldHRpbmdzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gW2Vtb2ppLCBzZWFyY2gga2V5d29yZHNdIFx1MjAxNCAxNzAgbW9zdCBjb21tb24vdXNlZnVsXG5jb25zdCBFTU9KSV9QSUNLRVJfU0VUOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXG4gIC8vIFNtaWxleXMgJiBlbW90aW9uXG4gIFsnXHVEODNEXHVERTAwJywnaGFwcHkgc21pbGUgZ3JpbiddLFsnXHVEODNEXHVERTBBJywnc21pbGUgYmx1c2ggaGFwcHknXSxbJ1x1RDgzRFx1REUwMicsJ2xhdWdoIGNyeSBmdW5ueSBqb3knXSxcbiAgWydcdUQ4M0VcdURENzInLCd0ZWFyIHNtaWxlIGdyYXRlZnVsJ10sWydcdUQ4M0RcdURFMEQnLCdoZWFydCBleWVzIGxvdmUnXSxbJ1x1RDgzRVx1REQyOScsJ3N0YXIgZXllcyBleGNpdGVkJ10sXG4gIFsnXHVEODNEXHVERTBFJywnY29vbCBzdW5nbGFzc2VzJ10sWydcdUQ4M0VcdUREMTQnLCd0aGlua2luZyBobW0nXSxbJ1x1RDgzRFx1REUwNScsJ3N3ZWF0IG5lcnZvdXMgbGF1Z2gnXSxcbiAgWydcdUQ4M0RcdURFMjInLCdjcnkgc2FkIHRlYXInXSxbJ1x1RDgzRFx1REUyNCcsJ2FuZ3J5IGh1ZmYgZnJ1c3RyYXRlZCddLFsnXHVEODNFXHVERDczJywncGFydHkgY2VsZWJyYXRlJ10sXG4gIFsnXHVEODNEXHVERTM0Jywnc2xlZXAgdGlyZWQgenp6J10sWydcdUQ4M0VcdUREMkYnLCdtaW5kIGJsb3duIGV4cGxvZGUnXSxbJ1x1RDgzRVx1REVFMScsJ3NhbHV0ZSByZXNwZWN0J10sXG4gIC8vIFBlb3BsZSAmIGdlc3R1cmVzXG4gIFsnXHVEODNEXHVEQzRCJywnd2F2ZSBoZWxsbyBieWUnXSxbJ1x1RDgzRFx1REM0RCcsJ3RodW1icyB1cCBnb29kIG9rJ10sWydcdUQ4M0RcdURDNEUnLCd0aHVtYnMgZG93biBiYWQnXSxcbiAgWydcdTI3MEMnLCd2aWN0b3J5IHBlYWNlJ10sWydcdUQ4M0VcdUREMUQnLCdoYW5kc2hha2UgZGVhbCddLFsnXHVEODNEXHVERTRGJywncHJheSB0aGFua3MgcGxlYXNlJ10sXG4gIFsnXHVEODNEXHVEQ0FBJywnbXVzY2xlIHN0cm9uZyBmbGV4J10sWydcdUQ4M0RcdURDNDEnLCdleWUgd2F0Y2ggc2VlJ10sWydcdUQ4M0VcdURERTAnLCdicmFpbiBtaW5kIHRoaW5rJ10sXG4gIFsnXHUyNzY0JywnaGVhcnQgbG92ZSByZWQnXSxbJ1x1RDgzRVx1RERFMScsJ29yYW5nZSBoZWFydCddLFsnXHVEODNEXHVEQzlCJywneWVsbG93IGhlYXJ0J10sXG4gIFsnXHVEODNEXHVEQzlBJywnZ3JlZW4gaGVhcnQnXSxbJ1x1RDgzRFx1REM5OScsJ2JsdWUgaGVhcnQnXSxbJ1x1RDgzRFx1REM5QycsJ3B1cnBsZSBoZWFydCddLFsnXHVEODNEXHVEREE0JywnYmxhY2sgaGVhcnQnXSxcbiAgLy8gTmF0dXJlXG4gIFsnXHVEODNDXHVERjMxJywnc2VlZGxpbmcgc3Byb3V0IGdyb3cnXSxbJ1x1RDgzQ1x1REYzRicsJ2hlcmIgbGVhZiBncmVlbiBuYXR1cmUnXSxbJ1x1RDgzQ1x1REY0MCcsJ2Nsb3ZlciBsdWNrJ10sXG4gIFsnXHVEODNDXHVERjM4JywnYmxvc3NvbSBmbG93ZXIgcGluayddLFsnXHVEODNDXHVERjNBJywnZmxvd2VyIGhpYmlzY3VzJ10sWydcdUQ4M0NcdURGM0InLCdzdW5mbG93ZXInXSxcbiAgWydcdUQ4M0NcdURGNDInLCdhdXR1bW4gZmFsbCBsZWFmJ10sWydcdUQ4M0NcdURGMEEnLCd3YXZlIG9jZWFuIHdhdGVyIHNlYSddLFsnXHVEODNEXHVERDI1JywnZmlyZSBmbGFtZSBob3QnXSxcbiAgWydcdTI3NDQnLCdzbm93Zmxha2UgY29sZCBpY2Ugd2ludGVyJ10sWydcdTI2QTEnLCdsaWdodG5pbmcgYm9sdCBlbmVyZ3knXSxbJ1x1RDgzQ1x1REYwOCcsJ3JhaW5ib3cnXSxcbiAgWydcdTI2MDAnLCdzdW4gc3VubnkgYnJpZ2h0J10sWydcdUQ4M0NcdURGMTknLCdtb29uIG5pZ2h0IGNyZXNjZW50J10sWydcdTJCNTAnLCdzdGFyIGZhdm9yaXRlJ10sXG4gIFsnXHVEODNDXHVERjFGJywnZ2xvd2luZyBzdGFyIHNoaW5lJ10sWydcdTI3MjgnLCdzcGFya2xlcyBzaGluZSBtYWdpYyddLFsnXHVEODNDXHVERkQ0JywnbW91bnRhaW4gcGVhayddLFxuICBbJ1x1RDgzQ1x1REYwRCcsJ2VhcnRoIGdsb2JlIHdvcmxkJ10sWydcdUQ4M0NcdURGMTAnLCdnbG9iZSBpbnRlcm5ldCB3ZWInXSxcbiAgLy8gRm9vZCAmIG9iamVjdHNcbiAgWydcdTI2MTUnLCdjb2ZmZWUgdGVhIGhvdCBkcmluayddLFsnXHVEODNDXHVERjc1JywndGVhIGN1cCBob3QnXSxbJ1x1RDgzQ1x1REY3QScsJ2JlZXIgZHJpbmsnXSxcbiAgWydcdUQ4M0NcdURGNEUnLCdhcHBsZSBmcnVpdCByZWQnXSxbJ1x1RDgzQ1x1REY0QicsJ2xlbW9uIHllbGxvdyBzb3VyJ10sWydcdUQ4M0NcdURGODInLCdjYWtlIGJpcnRoZGF5J10sXG4gIC8vIEFjdGl2aXRpZXMgJiBzcG9ydHNcbiAgWydcdUQ4M0NcdURGQUYnLCd0YXJnZXQgYnVsbHNleWUgZ29hbCddLFsnXHVEODNDXHVERkM2JywndHJvcGh5IGF3YXJkIHdpbiddLFsnXHVEODNFXHVERDQ3JywnbWVkYWwgZ29sZCBmaXJzdCddLFxuICBbJ1x1RDgzQ1x1REZBRScsJ2dhbWUgY29udHJvbGxlciBwbGF5J10sWydcdUQ4M0NcdURGQTgnLCdhcnQgcGFsZXR0ZSBjcmVhdGl2ZSBwYWludCddLFsnXHVEODNDXHVERkI1JywnbXVzaWMgbm90ZSBzb25nJ10sXG4gIFsnXHVEODNDXHVERkFDJywnY2xhcHBlciBmaWxtIG1vdmllJ10sWydcdUQ4M0RcdURDRjcnLCdjYW1lcmEgcGhvdG8nXSxbJ1x1RDgzQ1x1REY4MScsJ2dpZnQgcHJlc2VudCddLFxuICBbJ1x1RDgzQ1x1REZCMicsJ2RpY2UgZ2FtZSByYW5kb20nXSxbJ1x1RDgzRVx1RERFOScsJ3B1enpsZSBwaWVjZSddLFsnXHVEODNDXHVERkFEJywndGhlYXRlciBtYXNrcyddLFxuICAvLyBUcmF2ZWwgJiBwbGFjZXNcbiAgWydcdUQ4M0RcdURFODAnLCdyb2NrZXQgbGF1bmNoIHNwYWNlJ10sWydcdTI3MDgnLCdhaXJwbGFuZSB0cmF2ZWwgZmx5J10sWydcdUQ4M0RcdURFODInLCd0cmFpbiB0cmF2ZWwnXSxcbiAgWydcdUQ4M0NcdURGRTAnLCdob3VzZSBob21lJ10sWydcdUQ4M0NcdURGRDknLCdjaXR5IGJ1aWxkaW5nJ10sWydcdUQ4M0NcdURGMDYnLCdjaXR5IHN1bnNldCddLFxuICAvLyBPYmplY3RzICYgdG9vbHNcbiAgWydcdUQ4M0RcdURDQzEnLCdmb2xkZXIgZGlyZWN0b3J5J10sWydcdUQ4M0RcdURDQzInLCdvcGVuIGZvbGRlciddLFsnXHVEODNEXHVEQ0M0JywnZG9jdW1lbnQgcGFnZSBmaWxlJ10sXG4gIFsnXHVEODNEXHVEQ0REJywnbWVtbyB3cml0ZSBub3RlIGVkaXQnXSxbJ1x1RDgzRFx1RENDQicsJ2NsaXBib2FyZCBjb3B5J10sWydcdUQ4M0RcdURDQ0MnLCdwdXNocGluIHBpbiddLFxuICBbJ1x1RDgzRFx1RENDRCcsJ2xvY2F0aW9uIHBpbiBtYXAnXSxbJ1x1RDgzRFx1REQxNicsJ2Jvb2ttYXJrIHNhdmUnXSxbJ1x1RDgzRFx1RERDMicsJ2luZGV4IGRpdmlkZXJzJ10sXG4gIFsnXHVEODNEXHVEQ0M1JywnY2FsZW5kYXIgZGF0ZSBzY2hlZHVsZSddLFsnXHVEODNEXHVEREQzJywnY2FsZW5kYXIgc3BpcmFsJ10sWydcdTIzRjAnLCdhbGFybSBjbG9jayB0aW1lIHdha2UnXSxcbiAgWydcdUQ4M0RcdURENTAnLCdjbG9jayB0aW1lIGhvdXInXSxbJ1x1MjNGMScsJ3N0b3B3YXRjaCB0aW1lciddLFsnXHVEODNEXHVEQ0NBJywnY2hhcnQgYmFyIGRhdGEnXSxcbiAgWydcdUQ4M0RcdURDQzgnLCdjaGFydCB1cCBncm93dGggdHJlbmQnXSxbJ1x1RDgzRFx1RENDOScsJ2NoYXJ0IGRvd24gZGVjbGluZSddLFxuICBbJ1x1RDgzRFx1RENBMScsJ2lkZWEgbGlnaHQgYnVsYiBpbnNpZ2h0J10sWydcdUQ4M0RcdUREMEQnLCdzZWFyY2ggbWFnbmlmeSB6b29tJ10sWydcdUQ4M0RcdUREMTcnLCdsaW5rIGNoYWluIHVybCddLFxuICBbJ1x1RDgzRFx1RENFMicsJ2xvdWRzcGVha2VyIGFubm91bmNlJ10sWydcdUQ4M0RcdUREMTQnLCdiZWxsIG5vdGlmaWNhdGlvbiBhbGVydCddLFxuICBbJ1x1RDgzRFx1RENBQycsJ3NwZWVjaCBidWJibGUgY2hhdCBtZXNzYWdlJ10sWydcdUQ4M0RcdURDQUQnLCd0aG91Z2h0IHRoaW5rIGJ1YmJsZSddLFxuICBbJ1x1RDgzRFx1RENEQScsJ2Jvb2tzIHN0dWR5IGxpYnJhcnknXSxbJ1x1RDgzRFx1RENENicsJ29wZW4gYm9vayByZWFkJ10sWydcdUQ4M0RcdURDREMnLCdzY3JvbGwgZG9jdW1lbnQnXSxcbiAgWydcdTI3MDknLCdlbnZlbG9wZSBlbWFpbCBsZXR0ZXInXSxbJ1x1RDgzRFx1RENFNycsJ2VtYWlsIG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENFNScsJ2luYm94IGRvd25sb2FkJ10sXG4gIFsnXHVEODNEXHVEQ0U0Jywnb3V0Ym94IHVwbG9hZCBzZW5kJ10sWydcdUQ4M0RcdURERDEnLCd0cmFzaCBkZWxldGUgcmVtb3ZlJ10sXG4gIC8vIFRlY2hcbiAgWydcdUQ4M0RcdURDQkInLCdsYXB0b3AgY29tcHV0ZXIgY29kZSddLFsnXHVEODNEXHVEREE1JywnZGVza3RvcCBtb25pdG9yIHNjcmVlbiddLFsnXHVEODNEXHVEQ0YxJywncGhvbmUgbW9iaWxlJ10sXG4gIFsnXHUyMzI4Jywna2V5Ym9hcmQgdHlwZSddLFsnXHVEODNEXHVEREIxJywnbW91c2UgY3Vyc29yIGNsaWNrJ10sWydcdUQ4M0RcdURDRTEnLCdzYXRlbGxpdGUgYW50ZW5uYSBzaWduYWwnXSxcbiAgWydcdUQ4M0RcdUREMEMnLCdwbHVnIHBvd2VyIGVsZWN0cmljJ10sWydcdUQ4M0RcdUREMEInLCdiYXR0ZXJ5IHBvd2VyIGNoYXJnZSddLFsnXHVEODNEXHVEQ0JFJywnZmxvcHB5IGRpc2sgc2F2ZSddLFxuICBbJ1x1RDgzRFx1RENCRicsJ2Rpc2MgY2QgZHZkJ10sWydcdUQ4M0RcdUREQTgnLCdwcmludGVyIHByaW50J10sXG4gIC8vIFN5bWJvbHMgJiBzdGF0dXNcbiAgWydcdTI3MDUnLCdjaGVjayBkb25lIGNvbXBsZXRlIHllcyddLFsnXHUyNzRDJywnY3Jvc3MgZXJyb3Igd3Jvbmcgbm8gZGVsZXRlJ10sXG4gIFsnXHUyNkEwJywnd2FybmluZyBjYXV0aW9uIGFsZXJ0J10sWydcdTI3NTMnLCdxdWVzdGlvbiBtYXJrJ10sWydcdTI3NTcnLCdleGNsYW1hdGlvbiBpbXBvcnRhbnQnXSxcbiAgWydcdUQ4M0RcdUREMTInLCdsb2NrIHNlY3VyZSBwcml2YXRlJ10sWydcdUQ4M0RcdUREMTMnLCd1bmxvY2sgb3BlbiBwdWJsaWMnXSxbJ1x1RDgzRFx1REQxMScsJ2tleSBwYXNzd29yZCBhY2Nlc3MnXSxcbiAgWydcdUQ4M0RcdURFRTEnLCdzaGllbGQgcHJvdGVjdCBzZWN1cml0eSddLFsnXHUyNjk5JywnZ2VhciBzZXR0aW5ncyBjb25maWcnXSxbJ1x1RDgzRFx1REQyNycsJ3dyZW5jaCB0b29sIGZpeCddLFxuICBbJ1x1RDgzRFx1REQyOCcsJ2hhbW1lciBidWlsZCddLFsnXHUyNjk3JywnZmxhc2sgY2hlbWlzdHJ5IGxhYiddLFsnXHVEODNEXHVERDJDJywnbWljcm9zY29wZSBzY2llbmNlIHJlc2VhcmNoJ10sXG4gIFsnXHVEODNEXHVERDJEJywndGVsZXNjb3BlIHNwYWNlIGFzdHJvbm9teSddLFsnXHVEODNFXHVEREVBJywndGVzdCB0dWJlIGV4cGVyaW1lbnQnXSxcbiAgWydcdUQ4M0RcdURDOEUnLCdnZW0gZGlhbW9uZCBwcmVjaW91cyddLFsnXHVEODNEXHVEQ0IwJywnbW9uZXkgYmFnIHJpY2gnXSxbJ1x1RDgzRFx1RENCMycsJ2NyZWRpdCBjYXJkIHBheW1lbnQnXSxcbiAgWydcdUQ4M0NcdURGRjcnLCdsYWJlbCB0YWcgcHJpY2UnXSxbJ1x1RDgzQ1x1REY4MCcsJ3JpYmJvbiBib3cgZ2lmdCddLFxuICAvLyBNaXNjIHVzZWZ1bFxuICBbJ1x1RDgzRVx1RERFRCcsJ2NvbXBhc3MgbmF2aWdhdGUgZGlyZWN0aW9uJ10sWydcdUQ4M0RcdURERkEnLCdtYXAgd29ybGQgbmF2aWdhdGUnXSxcbiAgWydcdUQ4M0RcdURDRTYnLCdib3ggcGFja2FnZSBzaGlwcGluZyddLFsnXHVEODNEXHVEREM0JywnZmlsaW5nIGNhYmluZXQgYXJjaGl2ZSddLFxuICBbJ1x1RDgzRFx1REQxMCcsJ2xvY2sga2V5IHNlY3VyZSddLFsnXHVEODNEXHVEQ0NFJywncGFwZXJjbGlwIGF0dGFjaCddLFsnXHUyNzAyJywnc2Npc3NvcnMgY3V0J10sXG4gIFsnXHVEODNEXHVERDhBJywncGVuIHdyaXRlIGVkaXQnXSxbJ1x1RDgzRFx1RENDRicsJ3J1bGVyIG1lYXN1cmUnXSxbJ1x1RDgzRFx1REQwNScsJ2RpbSBicmlnaHRuZXNzJ10sXG4gIFsnXHVEODNEXHVERDA2JywnYnJpZ2h0IHN1biBsaWdodCddLFsnXHUyNjdCJywncmVjeWNsZSBzdXN0YWluYWJpbGl0eSddLFsnXHUyNzE0JywnY2hlY2ttYXJrIGRvbmUnXSxcbiAgWydcdTI3OTUnLCdwbHVzIGFkZCddLFsnXHUyNzk2JywnbWludXMgcmVtb3ZlJ10sWydcdUQ4M0RcdUREMDQnLCdyZWZyZXNoIHN5bmMgbG9vcCddLFxuICBbJ1x1MjNFOScsJ2Zhc3QgZm9yd2FyZCBza2lwJ10sWydcdTIzRUEnLCdyZXdpbmQgYmFjayddLFsnXHUyM0Y4JywncGF1c2Ugc3RvcCddLFxuICBbJ1x1MjVCNicsJ3BsYXkgc3RhcnQnXSxbJ1x1RDgzRFx1REQwMCcsJ3NodWZmbGUgcmFuZG9tIG1peCddLFxuXTtcblxuY2xhc3MgQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlLFxuICAgIHByaXZhdGUgYmxvY2s6IEJhc2VCbG9jayxcbiAgICBwcml2YXRlIG9uU2F2ZTogKCkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5pbnN0YW5jZS5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1RpdGxlIGxhYmVsJylcbiAgICAgIC5zZXREZXNjKCdMZWF2ZSBlbXB0eSB0byB1c2UgdGhlIGRlZmF1bHQgdGl0bGUuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0eXBlb2YgZHJhZnQuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlTGFiZWwgOiAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignRGVmYXVsdCB0aXRsZScpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll90aXRsZUxhYmVsID0gdjsgfSksXG4gICAgICApO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIEVtb2ppIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBlbW9qaVJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItcm93JyB9KTtcbiAgICBlbW9qaVJvdy5jcmVhdGVTcGFuKHsgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLCB0ZXh0OiAnVGl0bGUgZW1vamknIH0pO1xuXG4gICAgY29uc3QgY29udHJvbHMgPSBlbW9qaVJvdy5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItY29udHJvbHMnIH0pO1xuXG4gICAgY29uc3QgdHJpZ2dlckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci10cmlnZ2VyJyB9KTtcbiAgICBjb25zdCB1cGRhdGVUcmlnZ2VyID0gKCkgPT4ge1xuICAgICAgY29uc3QgdmFsID0gdHlwZW9mIGRyYWZ0Ll90aXRsZUVtb2ppID09PSAnc3RyaW5nJyA/IGRyYWZ0Ll90aXRsZUVtb2ppIDogJyc7XG4gICAgICB0cmlnZ2VyQnRuLmVtcHR5KCk7XG4gICAgICB0cmlnZ2VyQnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiB2YWwgfHwgJ1x1RkYwQicgfSk7XG4gICAgICB0cmlnZ2VyQnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdlbW9qaS1waWNrZXItY2hldnJvbicsIHRleHQ6ICdcdTI1QkUnIH0pO1xuICAgIH07XG4gICAgdXBkYXRlVHJpZ2dlcigpO1xuXG4gICAgY29uc3QgY2xlYXJCdG4gPSBjb250cm9scy5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdlbW9qaS1waWNrZXItY2xlYXInLCB0ZXh0OiAnXHUyNzE1JyB9KTtcbiAgICBjbGVhckJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2xlYXIgZW1vamknKTtcblxuICAgIGNvbnN0IHBhbmVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1wYW5lbCcgfSk7XG4gICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgIGNvbnN0IHNlYXJjaElucHV0ID0gcGFuZWwuY3JlYXRlRWwoJ2lucHV0Jywge1xuICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgY2xzOiAnZW1vamktcGlja2VyLXNlYXJjaCcsXG4gICAgICBwbGFjZWhvbGRlcjogJ1NlYXJjaFx1MjAyNicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlkRWwgPSBwYW5lbC5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItZ3JpZCcgfSk7XG5cbiAgICBjb25zdCByZW5kZXJHcmlkID0gKHF1ZXJ5OiBzdHJpbmcpID0+IHtcbiAgICAgIGdyaWRFbC5lbXB0eSgpO1xuICAgICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgY29uc3QgZmlsdGVyZWQgPSBxXG4gICAgICAgID8gRU1PSklfUElDS0VSX1NFVC5maWx0ZXIoKFtlLCBrXSkgPT4gay5pbmNsdWRlcyhxKSB8fCBlID09PSBxKVxuICAgICAgICA6IEVNT0pJX1BJQ0tFUl9TRVQ7XG4gICAgICBmb3IgKGNvbnN0IFtlbW9qaV0gb2YgZmlsdGVyZWQpIHtcbiAgICAgICAgY29uc3QgYnRuID0gZ3JpZEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLWJ0bicsIHRleHQ6IGVtb2ppIH0pO1xuICAgICAgICBpZiAoZHJhZnQuX3RpdGxlRW1vamkgPT09IGVtb2ppKSBidG4uYWRkQ2xhc3MoJ2lzLXNlbGVjdGVkJyk7XG4gICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9IGVtb2ppO1xuICAgICAgICAgIHVwZGF0ZVRyaWdnZXIoKTtcbiAgICAgICAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICAgICAgcmVuZGVyR3JpZCgnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGZpbHRlcmVkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBncmlkRWwuY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1lbXB0eScsIHRleHQ6ICdObyByZXN1bHRzJyB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlbmRlckdyaWQoJycpO1xuXG4gICAgc2VhcmNoSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiByZW5kZXJHcmlkKHNlYXJjaElucHV0LnZhbHVlKSk7XG5cbiAgICB0cmlnZ2VyQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgY29uc3Qgb3BlbiA9IHBhbmVsLnN0eWxlLmRpc3BsYXkgIT09ICdub25lJztcbiAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSBvcGVuID8gJ25vbmUnIDogJ2Jsb2NrJztcbiAgICAgIGlmICghb3Blbikgc2V0VGltZW91dCgoKSA9PiBzZWFyY2hJbnB1dC5mb2N1cygpLCAwKTtcbiAgICB9KTtcblxuICAgIGNsZWFyQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgZHJhZnQuX3RpdGxlRW1vamkgPSAnJztcbiAgICAgIHVwZGF0ZVRyaWdnZXIoKTtcbiAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBzZWFyY2hJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgcmVuZGVyR3JpZCgnJyk7XG4gICAgfSk7XG4gICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnSGlkZSB0aXRsZScpXG4gICAgICAuYWRkVG9nZ2xlKHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5faGlkZVRpdGxlID09PSB0cnVlKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5faGlkZVRpdGxlID0gdjsgfSksXG4gICAgICApO1xuXG4gICAgbGV0IGRyYWZ0TmV3Um93ID0gdGhpcy5pbnN0YW5jZS5uZXdSb3cgPT09IHRydWU7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1N0YXJ0IG9uIG5ldyByb3cnKVxuICAgICAgLnNldERlc2MoJ0ZvcmNlIHRoaXMgYmxvY2sgdG8gYmVnaW4gb24gYSBuZXcgcm93LicpXG4gICAgICAuYWRkVG9nZ2xlKHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdE5ld1JvdylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnROZXdSb3cgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gZHJhZnQ7XG4gICAgICAgICAgdGhpcy5pbnN0YW5jZS5uZXdSb3cgPSBkcmFmdE5ld1JvdyB8fCB1bmRlZmluZWQ7XG4gICAgICAgICAgdGhpcy5vblNhdmUoKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG5cbiAgICBjb25zdCBociA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaHInKTtcbiAgICBoci5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdCbG9jay1zcGVjaWZpYyBzZXR0aW5nczonLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NvbmZpZ3VyZSBibG9jay4uLicpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmJsb2NrLm9wZW5TZXR0aW5ncyh0aGlzLm9uU2F2ZSk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBmYWJFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICAvLyBGbG9hdGluZyBhY3Rpb24gYnV0dG9uIFx1MjAxNCB2aXNpYmxlIGluIHJlYWQgbW9kZSwgdHJpZ2dlcnMgZWRpdCBtb2RlXG4gICAgdGhpcy5mYWJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWVkaXQtZmFiJyB9KTtcbiAgICB0aGlzLmZhYkVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcbiAgICB0aGlzLmZhYkVsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0VudGVyIGVkaXQgbW9kZScpO1xuICAgIHRoaXMuZmFiRWwuc2V0VGV4dCgnXHUyNzBGJyk7XG4gICAgdGhpcy5mYWJFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudG9nZ2xlRWRpdE1vZGUoKSk7XG4gICAgdGhpcy5mYWJFbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSB7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy50b2dnbGVFZGl0TW9kZSgpOyB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIC8qKiBUb2dnbGUgZWRpdCBtb2RlIFx1MjAxNCBjYWxsZWQgZnJvbSBGQUIsIERvbmUgYnV0dG9uLCBhbmQga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9ICF0aGlzLmVkaXRNb2RlO1xuICAgIHRoaXMuZ3JpZC5zZXRFZGl0TW9kZSh0aGlzLmVkaXRNb2RlKTtcbiAgICB0aGlzLnN5bmNWaXNpYmlsaXR5KCk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNWaXNpYmlsaXR5KCk6IHZvaWQge1xuICAgIC8vIFJlYWQgbW9kZTogc2hvdyBGQUIsIGhpZGUgdG9vbGJhclxuICAgIC8vIEVkaXQgbW9kZTogc2hvdyB0b29sYmFyLCBoaWRlIEZBQlxuICAgIHRoaXMuZmFiRWwudG9nZ2xlQ2xhc3MoJ2lzLWhpZGRlbicsIHRoaXMuZWRpdE1vZGUpO1xuICAgIHRoaXMudG9vbGJhckVsLnRvZ2dsZUNsYXNzKCdpcy12aXNpYmxlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIEVkaXQgbW9kZSBpbmRpY2F0b3IgKGxlZnQtYWxpZ25lZClcbiAgICBjb25zdCBpbmRpY2F0b3IgPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVEaXYoeyBjbHM6ICd0b29sYmFyLWVkaXQtaW5kaWNhdG9yIGlzLXZpc2libGUnIH0pO1xuICAgIGluZGljYXRvci5jcmVhdGVEaXYoeyBjbHM6ICd0b29sYmFyLWVkaXQtZG90JyB9KTtcbiAgICBpbmRpY2F0b3IuY3JlYXRlU3Bhbih7IHRleHQ6ICdFZGl0aW5nJyB9KTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgY29sU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOdW1iZXIgb2YgY29sdW1ucycpO1xuICAgIFsyLCAzLCA0XS5mb3JFYWNoKG4gPT4ge1xuICAgICAgY29uc3Qgb3B0ID0gY29sU2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHZhbHVlOiBTdHJpbmcobiksIHRleHQ6IGAke259IGNvbGAgfSk7XG4gICAgICBpZiAobiA9PT0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgfSk7XG4gICAgY29sU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMub25Db2x1bW5zQ2hhbmdlKE51bWJlcihjb2xTZWxlY3QudmFsdWUpKTtcbiAgICB9KTtcblxuICAgIC8vIEFkZCBCbG9jayBidXR0b24gKG9ubHkgaW4gZWRpdCBtb2RlKVxuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4geyB0aGlzLm9wZW5BZGRCbG9ja01vZGFsKCk7IH0pO1xuXG4gICAgLy8gRG9uZSBidXR0b24gXHUyMDE0IGV4aXRzIGVkaXQgbW9kZVxuICAgIGNvbnN0IGRvbmVCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWVkaXQtYnRuIHRvb2xiYXItYnRuLWFjdGl2ZScsIHRleHQ6ICdcdTI3MTMgRG9uZScgfSk7XG4gICAgZG9uZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudG9nZ2xlRWRpdE1vZGUoKSk7XG5cbiAgICAvLyBXaXJlIHVwIHRoZSBncmlkJ3MgZW1wdHkgc3RhdGUgQ1RBIHRvIG9wZW4gdGhlIGFkZCBibG9jayBtb2RhbFxuICAgIHRoaXMuZ3JpZC5vblJlcXVlc3RBZGRCbG9jayA9ICgpID0+IHsgdGhpcy5vcGVuQWRkQmxvY2tNb2RhbCgpOyB9O1xuICB9XG5cbiAgLyoqIE9wZW5zIHRoZSBBZGQgQmxvY2sgbW9kYWwuIENhbGxlZCBmcm9tIHRvb2xiYXIgYnV0dG9uIGFuZCBlbXB0eSBzdGF0ZSBDVEEuICovXG4gIHByaXZhdGUgb3BlbkFkZEJsb2NrTW9kYWwoKTogdm9pZCB7XG4gICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQodHlwZSk7XG4gICAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgIChtYXgsIGIpID0+IE1hdGgubWF4KG1heCwgYi5yb3cgKyBiLnJvd1NwYW4gLSAxKSwgMCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICBpZDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY29sOiAxLFxuICAgICAgICByb3c6IG1heFJvdyArIDEsXG4gICAgICAgIGNvbFNwYW46IE1hdGgubWluKGZhY3RvcnkuZGVmYXVsdFNpemUuY29sU3BhbiwgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpLFxuICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgIGNvbmZpZzogeyAuLi5mYWN0b3J5LmRlZmF1bHRDb25maWcgfSxcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgfSkub3BlbigpO1xuICB9XG5cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMudG9vbGJhckVsO1xuICB9XG5cbiAgZ2V0RmFiRWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZmFiRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZ3JpZC5vblJlcXVlc3RBZGRCbG9jayA9IG51bGw7XG4gICAgdGhpcy5mYWJFbC5yZW1vdmUoKTtcbiAgICB0aGlzLnRvb2xiYXJFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG5jb25zdCBCTE9DS19NRVRBOiBSZWNvcmQ8QmxvY2tUeXBlLCB7IGljb246IHN0cmluZzsgZGVzYzogc3RyaW5nIH0+ID0ge1xuICAnZ3JlZXRpbmcnOiAgICAgIHsgaWNvbjogJ1xcdXsxRjQ0Qn0nLCBkZXNjOiAnUGVyc29uYWxpemVkIGdyZWV0aW5nIHdpdGggdGltZSBvZiBkYXknIH0sXG4gICdjbG9jayc6ICAgICAgICAgeyBpY29uOiAnXFx1ezFGNTUwfScsIGRlc2M6ICdMaXZlIGNsb2NrIHdpdGggZGF0ZSBkaXNwbGF5JyB9LFxuICAnZm9sZGVyLWxpbmtzJzogIHsgaWNvbjogJ1xcdXsxRjUxN30nLCBkZXNjOiAnUXVpY2sgbGlua3MgdG8gbm90ZXMgYW5kIGZvbGRlcnMnIH0sXG4gICdpbnNpZ2h0JzogICAgICAgeyBpY29uOiAnXFx1ezFGNEExfScsIGRlc2M6ICdEYWlseSByb3RhdGluZyBub3RlIGZyb20gYSB0YWcnIH0sXG4gICd0YWctZ3JpZCc6ICAgICAgeyBpY29uOiAnXFx1ezFGM0Y3fVxcdUZFMEYnLCBkZXNjOiAnR3JpZCBvZiBsYWJlbGVkIHZhbHVlIGJ1dHRvbnMnIH0sXG4gICdxdW90ZXMtbGlzdCc6ICAgeyBpY29uOiAnXFx1ezFGNEFDfScsIGRlc2M6ICdDb2xsZWN0aW9uIG9mIHF1b3RlcyBmcm9tIG5vdGVzJyB9LFxuICAnaW1hZ2UtZ2FsbGVyeSc6IHsgaWNvbjogJ1xcdXsxRjVCQ31cXHVGRTBGJywgZGVzYzogJ1Bob3RvIGdyaWQgZnJvbSBhIHZhdWx0IGZvbGRlcicgfSxcbiAgJ2VtYmVkZGVkLW5vdGUnOiB7IGljb246ICdcXHV7MUY0QzR9JywgZGVzYzogJ1JlbmRlciBhIG5vdGUgaW5saW5lIG9uIHRoZSBwYWdlJyB9LFxuICAnc3RhdGljLXRleHQnOiAgIHsgaWNvbjogJ1xcdXsxRjRERH0nLCBkZXNjOiAnTWFya2Rvd24gdGV4dCBibG9jayB5b3Ugd3JpdGUgZGlyZWN0bHknIH0sXG4gICdodG1sJzogICAgICAgICAgeyBpY29uOiAnPC8+JywgZGVzYzogJ0N1c3RvbSBIVE1MIGNvbnRlbnQgKHNhbml0aXplZCknIH0sXG59O1xuXG5jbGFzcyBBZGRCbG9ja01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uU2VsZWN0OiAodHlwZTogQmxvY2tUeXBlKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBZGQgQmxvY2snLCBjbHM6ICdhZGQtYmxvY2stbW9kYWwtdGl0bGUnIH0pO1xuXG4gICAgY29uc3QgZ3JpZCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdhZGQtYmxvY2stZ3JpZCcgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGZhY3Rvcnkgb2YgQmxvY2tSZWdpc3RyeS5nZXRBbGwoKSkge1xuICAgICAgY29uc3QgbWV0YSA9IEJMT0NLX01FVEFbZmFjdG9yeS50eXBlXTtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYWRkLWJsb2NrLW9wdGlvbicgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1pY29uJywgdGV4dDogbWV0YT8uaWNvbiA/PyAnXFx1MjVBQScgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1uYW1lJywgdGV4dDogZmFjdG9yeS5kaXNwbGF5TmFtZSB9KTtcbiAgICAgIGlmIChtZXRhPy5kZXNjKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLWRlc2MnLCB0ZXh0OiBtZXRhLmRlc2MgfSk7XG4gICAgICB9XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMub25TZWxlY3QoZmFjdG9yeS50eXBlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEdyZWV0aW5nQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdncmVldGluZy1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd1RpbWU/OiBib29sZWFuIH07XG5cbiAgICBpZiAoc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctdGltZScgfSk7XG4gICAgfVxuICAgIHRoaXMubmFtZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctbmFtZScgfSk7XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgaG91ciA9IG5vdy5ob3VyKCk7XG4gICAgY29uc3QgeyBuYW1lID0gJ2JlbnRvcm5hdG8nLCBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgICBzaG93VGltZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGNvbnN0IHNhbHV0YXRpb24gPVxuICAgICAgaG91ciA+PSA1ICYmIGhvdXIgPCAxMiA/ICdCdW9uZ2lvcm5vJyA6XG4gICAgICBob3VyID49IDEyICYmIGhvdXIgPCAxOCA/ICdCdW9uIHBvbWVyaWdnaW8nIDpcbiAgICAgICdCdW9uYXNlcmEnO1xuXG4gICAgaWYgKHRoaXMudGltZUVsICYmIHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ0hIOm1tJykpO1xuICAgIH1cbiAgICBpZiAodGhpcy5uYW1lRWwpIHtcbiAgICAgIHRoaXMubmFtZUVsLnNldFRleHQoYCR7c2FsdXRhdGlvbn0sICR7bmFtZX1gKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEdyZWV0aW5nU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEdyZWV0aW5nU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnR3JlZXRpbmcgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdOYW1lJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0Lm5hbWUgYXMgc3RyaW5nID8/ICdiZW50b3JuYXRvJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm5hbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aW1lJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpbWUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUJsb2NrIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgcHJpdmF0ZSBfaGVhZGVyQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gQ2FsbGVkIGJ5IEdyaWRMYXlvdXQgdG8gcmVkaXJlY3QgcmVuZGVySGVhZGVyIG91dHB1dCBvdXRzaWRlIGJsb2NrLWNvbnRlbnQuXG4gIHNldEhlYWRlckNvbnRhaW5lcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLl9oZWFkZXJDb250YWluZXIgPSBlbDtcbiAgfVxuXG4gIC8vIFJlbmRlciB0aGUgbXV0ZWQgdXBwZXJjYXNlIGJsb2NrIGhlYWRlciBsYWJlbC5cbiAgLy8gUmVzcGVjdHMgX2hpZGVUaXRsZSwgX3RpdGxlTGFiZWwsIGFuZCBfdGl0bGVFbW9qaSBmcm9tIGluc3RhbmNlLmNvbmZpZy5cbiAgLy8gUmVuZGVycyBpbnRvIHRoZSBoZWFkZXIgY29udGFpbmVyIHNldCBieSBHcmlkTGF5b3V0IChpZiBhbnkpLCBlbHNlIGZhbGxzIGJhY2sgdG8gZWwuXG4gIHByb3RlY3RlZCByZW5kZXJIZWFkZXIoZWw6IEhUTUxFbGVtZW50LCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY2ZnID0gdGhpcy5pbnN0YW5jZS5jb25maWc7XG4gICAgaWYgKGNmZy5faGlkZVRpdGxlID09PSB0cnVlKSByZXR1cm47XG4gICAgY29uc3QgbGFiZWwgPSAodHlwZW9mIGNmZy5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUxhYmVsLnRyaW0oKSlcbiAgICAgID8gY2ZnLl90aXRsZUxhYmVsLnRyaW0oKVxuICAgICAgOiB0aXRsZTtcbiAgICBpZiAoIWxhYmVsKSByZXR1cm47XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5faGVhZGVyQ29udGFpbmVyID8/IGVsO1xuICAgIGNvbnN0IGhlYWRlciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXInIH0pO1xuICAgIGlmICh0eXBlb2YgY2ZnLl90aXRsZUVtb2ppID09PSAnc3RyaW5nJyAmJiBjZmcuX3RpdGxlRW1vamkpIHtcbiAgICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgY2xzOiAnYmxvY2staGVhZGVyLWVtb2ppJywgdGV4dDogY2ZnLl90aXRsZUVtb2ppIH0pO1xuICAgIH1cbiAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRhdGVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2Nsb2NrLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dEYXRlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93RGF0ZT86IGJvb2xlYW4gfTtcblxuICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stdGltZScgfSk7XG4gICAgaWYgKHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLWRhdGUnIH0pO1xuICAgIH1cblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCB7IHNob3dTZWNvbmRzID0gZmFsc2UsIHNob3dEYXRlID0gdHJ1ZSwgZm9ybWF0ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHNob3dTZWNvbmRzPzogYm9vbGVhbjtcbiAgICAgIHNob3dEYXRlPzogYm9vbGVhbjtcbiAgICAgIGZvcm1hdD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudGltZUVsKSB7XG4gICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChmb3JtYXQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChzaG93U2Vjb25kcyA/ICdISDptbTpzcycgOiAnSEg6bW0nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmRhdGVFbCAmJiBzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwuc2V0VGV4dChub3cuZm9ybWF0KCdkZGRkLCBEIE1NTU0gWVlZWScpKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IENsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIENsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ2xvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHNlY29uZHMnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93U2Vjb25kcyBhcyBib29sZWFuID8/IGZhbHNlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1NlY29uZHMgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBkYXRlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0RhdGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0RhdGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdDdXN0b20gZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdPcHRpb25hbCBtb21lbnQuanMgZm9ybWF0IHN0cmluZywgZS5nLiBcIkhIOm1tXCIuIExlYXZlIGVtcHR5IGZvciBkZWZhdWx0LicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9ybWF0IGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9ybWF0ID0gdjsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIExpbmtJdGVtIHtcbiAgbGFiZWw6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBlbW9qaT86IHN0cmluZztcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEZvbGRlciBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclN1Z2dlc3RNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxURm9sZGVyPiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PiBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlciwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGZvbGRlci5wYXRoID09PSAnLycgPyAnLyAodmF1bHQgcm9vdCknIDogZm9sZGVyLnBhdGggfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyKTogdm9pZCB7IHRoaXMub25DaG9vc2UoZm9sZGVyKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjbGFzcyBGb2xkZXJMaW5rc0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZW5kZXJUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZm9sZGVyLWxpbmtzLWJsb2NrJyk7XG5cbiAgICAvLyBSZS1yZW5kZXIgd2hlbiB2YXVsdCBmaWxlcyBhcmUgY3JlYXRlZCwgZGVsZXRlZCwgb3IgcmVuYW1lZCAoZGVib3VuY2VkKVxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignY3JlYXRlJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdkZWxldGUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuXG4gICAgLy8gRGVmZXIgZmlyc3QgcmVuZGVyIHNvIHZhdWx0IGlzIGZ1bGx5IGluZGV4ZWRcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB0aGlzLnJlbmRlckNvbnRlbnQoKSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlUmVuZGVyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlbmRlclRpbWVyICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVuZGVyVGltZXIpO1xuICAgIHRoaXMucmVuZGVyVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnJlbmRlclRpbWVyID0gbnVsbDtcbiAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgIH0sIDE1MCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNvbnRlbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdRdWljayBMaW5rcycsIGZvbGRlciA9ICcnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG5cbiAgICAvLyBBdXRvLWxpc3Qgbm90ZXMgZnJvbSBzZWxlY3RlZCBmb2xkZXIgKHNvcnRlZCBhbHBoYWJldGljYWxseSlcbiAgICBpZiAoZm9sZGVyKSB7XG4gICAgICBjb25zdCBub3JtYWxpc2VkID0gZm9sZGVyLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKTtcblxuICAgICAgaWYgKCFub3JtYWxpc2VkKSB7XG4gICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdWYXVsdCByb290IGxpc3RpbmcgaXMgbm90IHN1cHBvcnRlZC4gU2VsZWN0IGEgc3ViZm9sZGVyLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGlzZWQpO1xuXG4gICAgICAgIGlmICghKGZvbGRlck9iaiBpbnN0YW5jZW9mIFRGb2xkZXIpKSB7XG4gICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYEZvbGRlciBcIiR7bm9ybWFsaXNlZH1cIiBub3QgZm91bmQuYCwgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcHJlZml4ID0gZm9sZGVyT2JqLnBhdGggKyAnLyc7XG4gICAgICAgICAgY29uc3Qgbm90ZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpXG4gICAgICAgICAgICAuZmlsdGVyKGYgPT4gZi5wYXRoLnN0YXJ0c1dpdGgocHJlZml4KSlcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSkpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIG5vdGVzKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub3Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IGBObyBub3RlcyBpbiBcIiR7Zm9sZGVyT2JqLnBhdGh9XCIuYCwgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFudWFsIGxpbmtzXG4gICAgZm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgIGlmIChsaW5rLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnbGluay1lbW9qaScsIHRleHQ6IGxpbmsuZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGxpbmsubGFiZWwgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobGluay5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWZvbGRlciAmJiBsaW5rcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNTE3fScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBsaW5rcyB5ZXQuIEFkZCBtYW51YWwgbGlua3Mgb3IgcGljayBhIGZvbGRlciBpbiBzZXR0aW5ncy4nIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlbmRlclRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVuZGVyVGltZXIpO1xuICAgICAgdGhpcy5yZW5kZXJUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwoXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgICAobmV3Q29uZmlnKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICAgICAgb25TYXZlKCk7XG4gICAgICB9LFxuICAgICkub3BlbigpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyTGlua3NTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVpY2sgTGlua3MgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQ6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0gPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuICAgIGRyYWZ0LmxpbmtzID8/PSBbXTtcbiAgICBjb25zdCBsaW5rcyA9IGRyYWZ0LmxpbmtzO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVpY2sgTGlua3MnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdBdXRvLWxpc3QgZm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdMaXN0IGFsbCBub3RlcyBmcm9tIHRoaXMgdmF1bHQgZm9sZGVyIGFzIGxpbmtzLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdlLmcuIFByb2plY3RzJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnTWFudWFsIGxpbmtzJyB9KTtcblxuICAgIGNvbnN0IGxpbmtzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuXG4gICAgY29uc3QgcmVuZGVyTGlua3MgPSAoKSA9PiB7XG4gICAgICBsaW5rc0NvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgbGlua3MuZm9yRWFjaCgobGluaywgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaW5rc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdzZXR0aW5ncy1saW5rLXJvdycgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHJvdylcbiAgICAgICAgICAuc2V0TmFtZShgTGluayAke2kgKyAxfWApXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdMYWJlbCcpLnNldFZhbHVlKGxpbmsubGFiZWwpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5sYWJlbCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignUGF0aCcpLnNldFZhbHVlKGxpbmsucGF0aCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLnBhdGggPSB2OyB9KSlcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0Vtb2ppJykuc2V0VmFsdWUobGluay5lbW9qaSA/PyAnJykub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmVtb2ppID0gdiB8fCB1bmRlZmluZWQ7IH0pKVxuICAgICAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRJY29uKCd0cmFzaCcpLnNldFRvb2x0aXAoJ1JlbW92ZScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgbGlua3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpbmtzKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0QnV0dG9uVGV4dCgnQWRkIExpbmsnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgbGlua3MucHVzaCh7IGxhYmVsOiAnJywgcGF0aDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpbmtzKCk7XG4gICAgICB9KSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSkpO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IE1TX1BFUl9EQVkgPSA4Nl80MDBfMDAwO1xuXG5leHBvcnQgY2xhc3MgSW5zaWdodEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbnNpZ2h0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBpbnNpZ2h0LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGRhaWx5U2VlZD86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjYXJkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1jYXJkJyB9KTtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBjb25zdCBoaW50ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRBMX0nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gdGFnIGNvbmZpZ3VyZWQuIEFkZCBhIHRhZyBpbiBzZXR0aW5ncyB0byBzaG93IGEgZGFpbHkgcm90YXRpbmcgbm90ZS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncy5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0eXBlb2YgdCA9PT0gJ3N0cmluZycpIDpcbiAgICAgIHR5cGVvZiByYXdGbVRhZ3MgPT09ICdzdHJpbmcnID8gW3Jhd0ZtVGFnc10gOlxuICAgICAgW107XG4gICAgY29uc3Qgbm9ybWFsaXplZEZtVGFncyA9IGZtVGFnQXJyYXkubWFwKHQgPT4gdC5zdGFydHNXaXRoKCcjJykgPyB0IDogYCMke3R9YCk7XG5cbiAgICByZXR1cm4gaW5saW5lVGFncy5pbmNsdWRlcyh0YWcpIHx8IG5vcm1hbGl6ZWRGbVRhZ3MuaW5jbHVkZXModGFnKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIFZhbHVlSXRlbSB7XG4gIGVtb2ppOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGxpbms/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUYWdHcmlkQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3RhZy1ncmlkLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1ZhbHVlcycsIGNvbHVtbnMgPSAyLCBpdGVtcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ3JpZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3RhZy1ncmlkJyB9KTtcbiAgICBncmlkLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgaGludCA9IGdyaWQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUYzRjd9XFx1RkUwRicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBpdGVtcyB5ZXQuIEFkZCB2YWx1ZXMgd2l0aCBlbW9qaXMgYW5kIGxhYmVscyBpbiBzZXR0aW5ncy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0YWctYnRuJyB9KTtcbiAgICAgIGlmIChpdGVtLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAndGFnLWJ0bi1lbW9qaScsIHRleHQ6IGl0ZW0uZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGl0ZW0ubGFiZWwgfSk7XG4gICAgICBpZiAoaXRlbS5saW5rKSB7XG4gICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGl0ZW0ubGluayEsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidG4uc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgVmFsdWVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFZhbHVlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1ZhbHVlcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZykgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgaXRlbXM/OiBWYWx1ZUl0ZW1bXTtcbiAgICB9O1xuICAgIGlmICghQXJyYXkuaXNBcnJheShkcmFmdC5pdGVtcykpIGRyYWZ0Lml0ZW1zID0gW107XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdWYWx1ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcxJywgJzEnKS5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnSXRlbXMnLCBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScgfSk7XG5cbiAgICBjb25zdCBsaXN0RWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tbGlzdCcgfSk7XG4gICAgY29uc3QgcmVuZGVyTGlzdCA9ICgpID0+IHtcbiAgICAgIGxpc3RFbC5lbXB0eSgpO1xuICAgICAgZHJhZnQuaXRlbXMhLmZvckVhY2goKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogJ3ZhbHVlcy1pdGVtLXJvdycgfSk7XG5cbiAgICAgICAgY29uc3QgZW1vamlJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tZW1vamknIH0pO1xuICAgICAgICBlbW9qaUlucHV0LnZhbHVlID0gaXRlbS5lbW9qaTtcbiAgICAgICAgZW1vamlJbnB1dC5wbGFjZWhvbGRlciA9ICdcdUQ4M0RcdURFMDAnO1xuICAgICAgICBlbW9qaUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmVtb2ppID0gZW1vamlJbnB1dC52YWx1ZTsgfSk7XG5cbiAgICAgICAgY29uc3QgbGFiZWxJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGFiZWwnIH0pO1xuICAgICAgICBsYWJlbElucHV0LnZhbHVlID0gaXRlbS5sYWJlbDtcbiAgICAgICAgbGFiZWxJbnB1dC5wbGFjZWhvbGRlciA9ICdMYWJlbCc7XG4gICAgICAgIGxhYmVsSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0ubGFiZWwgPSBsYWJlbElucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsaW5rSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWxpbmsnIH0pO1xuICAgICAgICBsaW5rSW5wdXQudmFsdWUgPSBpdGVtLmxpbmsgPz8gJyc7XG4gICAgICAgIGxpbmtJbnB1dC5wbGFjZWhvbGRlciA9ICdOb3RlIHBhdGggKG9wdGlvbmFsKSc7XG4gICAgICAgIGxpbmtJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5saW5rID0gbGlua0lucHV0LnZhbHVlIHx8IHVuZGVmaW5lZDsgfSk7XG5cbiAgICAgICAgY29uc3QgZGVsQnRuID0gcm93LmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3ZhbHVlcy1pdGVtLWRlbCcsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgICAgICBkZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgZHJhZnQuaXRlbXMhLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZW5kZXJMaXN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICByZW5kZXJMaXN0KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCcrIEFkZCBpdGVtJykub25DbGljaygoKSA9PiB7XG4gICAgICAgIGRyYWZ0Lml0ZW1zIS5wdXNoKHsgZW1vamk6ICcnLCBsYWJlbDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25TYXZlKGRyYWZ0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIE9ubHkgYXNzaWduIHNhZmUgQ1NTIGNvbG9yIHZhbHVlczsgcmVqZWN0IHBvdGVudGlhbGx5IG1hbGljaW91cyBzdHJpbmdzXG5jb25zdCBDT0xPUl9SRSA9IC9eKCNbMC05YS1mQS1GXXszLDh9fFthLXpBLVpdK3xyZ2JhP1xcKFteKV0rXFwpfGhzbGE/XFwoW14pXStcXCkpJC87XG5cbnR5cGUgUXVvdGVzQ29uZmlnID0ge1xuICBzb3VyY2U/OiAndGFnJyB8ICd0ZXh0JztcbiAgdGFnPzogc3RyaW5nO1xuICBxdW90ZXM/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBjb2x1bW5zPzogbnVtYmVyO1xuICBtYXhJdGVtcz86IG51bWJlcjtcbiAgaGVpZ2h0TW9kZT86ICd3cmFwJyB8ICdleHRlbmQnO1xufTtcblxuZXhwb3J0IGNsYXNzIFF1b3Rlc0xpc3RCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygncXVvdGVzLWxpc3QtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHF1b3Rlcy4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHNvdXJjZSA9ICd0YWcnLCB0YWcgPSAnJywgcXVvdGVzID0gJycsIHRpdGxlID0gJ1F1b3RlcycsIGNvbHVtbnMgPSAyLCBtYXhJdGVtcyA9IDIwLCBoZWlnaHRNb2RlID0gJ3dyYXAnIH0gPVxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgUXVvdGVzQ29uZmlnO1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGVsLnRvZ2dsZUNsYXNzKCdxdW90ZXMtbGlzdC1ibG9jay0tZXh0ZW5kJywgaGVpZ2h0TW9kZSA9PT0gJ2V4dGVuZCcpO1xuXG4gICAgY29uc3QgY29sc0VsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGVzLWNvbHVtbnMnIH0pO1xuICAgIGlmIChoZWlnaHRNb2RlID09PSAnd3JhcCcpIHtcbiAgICAgIGNvbHNFbC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgIGNvbHNFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncmVnaW9uJyk7XG4gICAgICBjb2xzRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1F1b3RlcycpO1xuICAgIH1cblxuICAgIGNvbnN0IE1JTl9DT0xfV0lEVEggPSAyMDA7XG4gICAgY29uc3QgdXBkYXRlQ29scyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHcgPSBjb2xzRWwub2Zmc2V0V2lkdGg7XG4gICAgICBjb25zdCBlZmZlY3RpdmUgPSB3ID4gMCA/IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIE1hdGguZmxvb3IodyAvIE1JTl9DT0xfV0lEVEgpKSkgOiBjb2x1bW5zO1xuICAgICAgY29sc0VsLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7ZWZmZWN0aXZlfSwgMWZyKWA7XG4gICAgfTtcbiAgICB1cGRhdGVDb2xzKCk7XG4gICAgY29uc3Qgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIodXBkYXRlQ29scyk7XG4gICAgcm8ub2JzZXJ2ZShjb2xzRWwpO1xuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcm8uZGlzY29ubmVjdCgpKTtcblxuICAgIGlmIChzb3VyY2UgPT09ICd0ZXh0Jykge1xuICAgICAgdGhpcy5yZW5kZXJUZXh0UXVvdGVzKGNvbHNFbCwgcXVvdGVzLCBtYXhJdGVtcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc291cmNlID09PSAndGFnJ1xuICAgIGlmICghdGFnKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEFDfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHB1bGwgcXVvdGVzIGZyb20geW91ciBub3Rlcy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCkuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgLy8gUmVhZCBhbGwgZmlsZXMgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBmaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICAgIHJldHVybiB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH07XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgcmVzdWx0LnJlYXNvbik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH0gPSByZXN1bHQudmFsdWU7XG4gICAgICBjb25zdCBjb2xvciA9IGNhY2hlPy5mcm9udG1hdHRlcj8uY29sb3IgYXMgc3RyaW5nID8/ICcnO1xuICAgICAgY29uc3QgYm9keSA9IHRoaXMuZXh0cmFjdEJvZHkoY29udGVudCwgY2FjaGUpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IHF1b3RlID0gaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGNvbG9yIGJlZm9yZSBhcHBseWluZyB0byBwcmV2ZW50IENTUyBpbmplY3Rpb25cbiAgICAgIGlmIChjb2xvciAmJiBDT0xPUl9SRS50ZXN0KGNvbG9yKSkge1xuICAgICAgICBxdW90ZS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBjb2xvcjtcbiAgICAgICAgcXVvdGUuc3R5bGUuY29sb3IgPSBjb2xvcjtcbiAgICAgIH1cblxuICAgICAgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgcXVvdGVzIGZyb20gcGxhaW4gdGV4dC4gRWFjaCBxdW90ZSBpcyBzZXBhcmF0ZWQgYnkgYC0tLWAgb24gaXRzIG93biBsaW5lLlxuICAgKiBPcHRpb25hbGx5IGEgc291cmNlIGxpbmUgY2FuIGZvbGxvdyB0aGUgcXVvdGUgdGV4dCwgcHJlZml4ZWQgd2l0aCBgXHUyMDE0YCwgYFx1MjAxM2AsIG9yIGAtLWAuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqICAgVGhlIG9ubHkgd2F5IHRvIGRvIGdyZWF0IHdvcmsgaXMgdG8gbG92ZSB3aGF0IHlvdSBkby5cbiAgICogICBcdTIwMTQgU3RldmUgSm9ic1xuICAgKiAgIC0tLVxuICAgKiAgIEluIHRoZSBtaWRkbGUgb2YgZGlmZmljdWx0eSBsaWVzIG9wcG9ydHVuaXR5LlxuICAgKiAgIFx1MjAxNCBBbGJlcnQgRWluc3RlaW5cbiAgICovXG4gIHByaXZhdGUgcmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWw6IEhUTUxFbGVtZW50LCByYXc6IHN0cmluZywgbWF4SXRlbXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghcmF3LnRyaW0oKSkge1xuICAgICAgY29uc3QgaGludCA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRBQ30nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gcXVvdGVzIHlldC4gQWRkIHRoZW0gaW4gc2V0dGluZ3MsIHNlcGFyYXRlZCBieSAtLS0uJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBibG9ja3MgPSByYXcuc3BsaXQoL1xcbi0tLVxcbi8pLm1hcChiID0+IGIudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gYmxvY2suc3BsaXQoJ1xcbicpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgaGFzU291cmNlID0gbGluZXMubGVuZ3RoID4gMSAmJiAvXihcdTIwMTR8XHUyMDEzfC0tKS8udGVzdChsYXN0TGluZSk7XG4gICAgICBjb25zdCBzb3VyY2VUZXh0ID0gaGFzU291cmNlID8gbGFzdExpbmUucmVwbGFjZSgvXihcdTIwMTR8XHUyMDEzfC0tKVxccyovLCAnJykgOiAnJztcbiAgICAgIGNvbnN0IGJvZHlMaW5lcyA9IGhhc1NvdXJjZSA/IGxpbmVzLnNsaWNlKDAsIC0xKSA6IGxpbmVzO1xuICAgICAgY29uc3QgYm9keSA9IGJvZHlMaW5lcy5qb2luKCcgJyk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG4gICAgICBpZiAoc291cmNlVGV4dCkgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBzb3VyY2VUZXh0IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBFeHRyYWN0IHRoZSBmaXJzdCBmZXcgbGluZXMgb2YgYm9keSBjb250ZW50IHVzaW5nIG1ldGFkYXRhQ2FjaGUgZnJvbnRtYXR0ZXIgb2Zmc2V0LiAqL1xuICBwcml2YXRlIGV4dHJhY3RCb2R5KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcbiAgICBjb25zdCBsaW5lcyA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSk7XG4gICAgcmV0dXJuIGxpbmVzLnNsaWNlKDAsIDMpLmpvaW4oJyAnKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgUXVvdGVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFF1b3Rlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1b3RlcyBMaXN0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyBRdW90ZXNDb25maWc7XG4gICAgZHJhZnQuc291cmNlID8/PSAndGFnJztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBTb3VyY2UgdG9nZ2xlIFx1MjAxNCBzaG93cy9oaWRlcyB0aGUgcmVsZXZhbnQgc2VjdGlvblxuICAgIGxldCB0YWdTZWN0aW9uOiBIVE1MRWxlbWVudDtcbiAgICBsZXQgdGV4dFNlY3Rpb246IEhUTUxFbGVtZW50O1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1NvdXJjZScpXG4gICAgICAuc2V0RGVzYygnUHVsbCBxdW90ZXMgZnJvbSB0YWdnZWQgbm90ZXMsIG9yIGVudGVyIHRoZW0gbWFudWFsbHkuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd0YWcnLCAnTm90ZXMgd2l0aCB0YWcnKVxuICAgICAgICAgLmFkZE9wdGlvbigndGV4dCcsICdNYW51YWwgdGV4dCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuc291cmNlID8/ICd0YWcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4ge1xuICAgICAgICAgICBkcmFmdC5zb3VyY2UgPSB2IGFzICd0YWcnIHwgJ3RleHQnO1xuICAgICAgICAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBUYWcgc2VjdGlvblxuICAgIHRhZ1NlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgIG5ldyBTZXR0aW5nKHRhZ1NlY3Rpb24pLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFRleHQgc2VjdGlvblxuICAgIHRleHRTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgIGNvbnN0IHRleHRTZXR0aW5nID0gbmV3IFNldHRpbmcodGV4dFNlY3Rpb24pXG4gICAgICAuc2V0TmFtZSgnUXVvdGVzJylcbiAgICAgIC5zZXREZXNjKCdTZXBhcmF0ZSBxdW90ZXMgd2l0aCAtLS0gb24gaXRzIG93biBsaW5lLiBBZGQgYSBzb3VyY2UgbGluZSBzdGFydGluZyB3aXRoIFx1MjAxNCAoZS5nLiBcdTIwMTQgQXV0aG9yKS4nKTtcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdjb2x1bW4nO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5hbGlnbkl0ZW1zID0gJ3N0cmV0Y2gnO1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGV4dFNldHRpbmcuc2V0dGluZ0VsLmNyZWF0ZUVsKCd0ZXh0YXJlYScpO1xuICAgIHRleHRhcmVhLnJvd3MgPSA4O1xuICAgIHRleHRhcmVhLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIHRleHRhcmVhLnN0eWxlLm1hcmdpblRvcCA9ICc4cHgnO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRGYW1pbHkgPSAndmFyKC0tZm9udC1tb25vc3BhY2UpJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LnF1b3RlcyA/PyAnJztcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQucXVvdGVzID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIZWlnaHQgbW9kZScpXG4gICAgICAuc2V0RGVzYygnU2Nyb2xsIGtlZXBzIHRoZSBibG9jayBjb21wYWN0LiBHcm93IHRvIGZpdCBhbGwgd29ya3MgYmVzdCBhdCBmdWxsIHdpZHRoLicpXG4gICAgICAuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgICBkLmFkZE9wdGlvbignd3JhcCcsICdTY3JvbGwgKGZpeGVkIGhlaWdodCknKVxuICAgICAgICAgLmFkZE9wdGlvbignZXh0ZW5kJywgJ0dyb3cgdG8gZml0IGFsbCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuaGVpZ2h0TW9kZSA/PyAnd3JhcCcpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmhlaWdodE1vZGUgPSB2IGFzICd3cmFwJyB8ICdleHRlbmQnOyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURmlsZSwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gXHUyNTAwXHUyNTAwIEZvbGRlciBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclN1Z2dlc3RNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxURm9sZGVyPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT5cbiAgICAgIGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpLFxuICAgICk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlciwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGZvbGRlci5wYXRoID09PSAnLycgPyAnLyAodmF1bHQgcm9vdCknIDogZm9sZGVyLnBhdGggfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyKTogdm9pZCB7XG4gICAgdGhpcy5vbkNob29zZShmb2xkZXIpO1xuICB9XG59XG5cbmNvbnN0IElNQUdFX0VYVFMgPSBuZXcgU2V0KFsnLnBuZycsICcuanBnJywgJy5qcGVnJywgJy5naWYnLCAnLndlYnAnLCAnLnN2ZyddKTtcbmNvbnN0IFZJREVPX0VYVFMgPSBuZXcgU2V0KFsnLm1wNCcsICcud2VibScsICcubW92JywgJy5ta3YnXSk7XG5cbmV4cG9ydCBjbGFzcyBJbWFnZUdhbGxlcnlCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaW1hZ2UtZ2FsbGVyeS1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbWFnZUdhbGxlcnlCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBnYWxsZXJ5LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgZm9sZGVyID0gJycsIHRpdGxlID0gJ0dhbGxlcnknLCBjb2x1bW5zID0gMywgbWF4SXRlbXMgPSAyMCwgbGF5b3V0ID0gJ2dyaWQnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICAgIGxheW91dD86ICdncmlkJyB8ICdtYXNvbnJ5JztcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcblxuICAgIGlmIChsYXlvdXQgPT09ICdtYXNvbnJ5Jykge1xuICAgICAgZ2FsbGVyeS5hZGRDbGFzcygnbWFzb25yeS1sYXlvdXQnKTtcbiAgICAgIGNvbnN0IHVwZGF0ZUNvbHMgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHcgPSBnYWxsZXJ5Lm9mZnNldFdpZHRoO1xuICAgICAgICBjb25zdCBlZmZlY3RpdmUgPSB3ID4gMCA/IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIE1hdGguZmxvb3IodyAvIDEwMCkpKSA6IGNvbHVtbnM7XG4gICAgICAgIGdhbGxlcnkuc3R5bGUuY29sdW1ucyA9IFN0cmluZyhlZmZlY3RpdmUpO1xuICAgICAgfTtcbiAgICAgIHVwZGF0ZUNvbHMoKTtcbiAgICAgIGNvbnN0IHJvID0gbmV3IFJlc2l6ZU9ic2VydmVyKHVwZGF0ZUNvbHMpO1xuICAgICAgcm8ub2JzZXJ2ZShnYWxsZXJ5KTtcbiAgICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcm8uZGlzY29ubmVjdCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2FsbGVyeS5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdChhdXRvLWZpbGwsIG1pbm1heChtYXgoNzBweCwgY2FsYygxMDAlIC8gJHtjb2x1bW5zfSkpLCAxZnIpKWA7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBnYWxsZXJ5LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNUJDfVxcdUZFMEYnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gZm9sZGVyIHNlbGVjdGVkLiBQaWNrIGFuIGltYWdlIGZvbGRlciBpbiBzZXR0aW5ncyB0byBkaXNwbGF5IGEgZ2FsbGVyeS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZvbGRlck9iaiA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuICAgIGlmICghKGZvbGRlck9iaiBpbnN0YW5jZW9mIFRGb2xkZXIpKSB7XG4gICAgICBnYWxsZXJ5LnNldFRleHQoYEZvbGRlciBcIiR7Zm9sZGVyfVwiIG5vdCBmb3VuZC5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuZ2V0TWVkaWFGaWxlcyhmb2xkZXJPYmopLnNsaWNlKDAsIG1heEl0ZW1zKTtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgZXh0ID0gYC4ke2ZpbGUuZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCl9YDtcbiAgICAgIGNvbnN0IHdyYXBwZXIgPSBnYWxsZXJ5LmNyZWF0ZURpdih7IGNsczogJ2dhbGxlcnktaXRlbScgfSk7XG5cbiAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpKSB7XG4gICAgICAgIGNvbnN0IGltZyA9IHdyYXBwZXIuY3JlYXRlRWwoJ2ltZycpO1xuICAgICAgICBpbWcuc3JjID0gdGhpcy5hcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGZpbGUpO1xuICAgICAgICBpbWcubG9hZGluZyA9ICdsYXp5JztcbiAgICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChWSURFT19FWFRTLmhhcyhleHQpKSB7XG4gICAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2dhbGxlcnktaXRlbS12aWRlbycpO1xuICAgICAgICB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ3ZpZGVvLXBsYXktb3ZlcmxheScsIHRleHQ6ICdcdTI1QjYnIH0pO1xuXG4gICAgICAgIGNvbnN0IHZpZGVvID0gd3JhcHBlci5jcmVhdGVFbCgndmlkZW8nKSBhcyBIVE1MVmlkZW9FbGVtZW50O1xuICAgICAgICB2aWRlby5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIHZpZGVvLm11dGVkID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8ubG9vcCA9IHRydWU7XG4gICAgICAgIHZpZGVvLnNldEF0dHJpYnV0ZSgncGxheXNpbmxpbmUnLCAnJyk7XG4gICAgICAgIHZpZGVvLnByZWxvYWQgPSAnbWV0YWRhdGEnO1xuXG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VlbnRlcicsICgpID0+IHsgdm9pZCB2aWRlby5wbGF5KCk7IH0pO1xuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCAoKSA9PiB7IHZpZGVvLnBhdXNlKCk7IHZpZGVvLmN1cnJlbnRUaW1lID0gMDsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRNZWRpYUZpbGVzKGZvbGRlcjogVEZvbGRlcik6IFRGaWxlW10ge1xuICAgIGNvbnN0IGZpbGVzOiBURmlsZVtdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICBjb25zdCBleHQgPSBgLiR7Y2hpbGQuZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCl9YDtcbiAgICAgICAgICBpZiAoSU1BR0VfRVhUUy5oYXMoZXh0KSB8fCBWSURFT19FWFRTLmhhcyhleHQpKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGNoaWxkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgcmVjdXJzZShjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UoZm9sZGVyKTtcbiAgICByZXR1cm4gZmlsZXM7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBJbWFnZUdhbGxlcnlTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdJbWFnZSBHYWxsZXJ5IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICdHYWxsZXJ5JylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0ZvbGRlcicpXG4gICAgICAuc2V0RGVzYygnUGljayBhIHZhdWx0IGZvbGRlci4nKVxuICAgICAgLmFkZFRleHQodCA9PiB7XG4gICAgICAgIGZvbGRlclRleHQgPSB0O1xuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0LmZvbGRlciBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0F0dGFjaG1lbnRzL1Bob3RvcycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZvbGRlciA9IHY7IH0pO1xuICAgICAgfSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRJY29uKCdmb2xkZXInKS5zZXRUb29sdGlwKCdCcm93c2UgdmF1bHQgZm9sZGVycycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIG5ldyBGb2xkZXJTdWdnZXN0TW9kYWwodGhpcy5hcHAsIChmb2xkZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSBmb2xkZXIucGF0aCA9PT0gJy8nID8gJycgOiBmb2xkZXIucGF0aDtcbiAgICAgICAgICAgIGRyYWZ0LmZvbGRlciA9IHBhdGg7XG4gICAgICAgICAgICBmb2xkZXJUZXh0LnNldFZhbHVlKHBhdGgpO1xuICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTGF5b3V0JykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJ2dyaWQnLCAnR3JpZCcpLmFkZE9wdGlvbignbWFzb25yeScsICdNYXNvbnJ5JylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmxheW91dCA/PyAnZ3JpZCcpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubGF5b3V0ID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKS5hZGRPcHRpb24oJzQnLCAnNCcpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDMpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgREVCT1VOQ0VfTVMgPSAzMDA7XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZE5vdGVCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZW1iZWRkZWQtbm90ZS1ibG9jaycpO1xuXG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgZmlsZS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZ2lzdGVyIHZhdWx0IGxpc3RlbmVyIG9uY2U7IGRlYm91bmNlIHJhcGlkIHNhdmVzXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAudmF1bHQub24oJ21vZGlmeScsIChtb2RGaWxlKSA9PiB7XG4gICAgICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBmaWxlUGF0aD86IHN0cmluZyB9O1xuICAgICAgICBpZiAobW9kRmlsZS5wYXRoID09PSBmaWxlUGF0aCAmJiB0aGlzLmNvbnRhaW5lckVsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQodGFyZ2V0KS5jYXRjaChlID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlLXJlbmRlciBhZnRlciBtb2RpZnk6JywgZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LCBERUJPVU5DRV9NUyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZpbGVQYXRoID0gJycsIHNob3dUaXRsZSA9IHRydWUsIGhlaWdodE1vZGUgPSAnc2Nyb2xsJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgZmlsZVBhdGg/OiBzdHJpbmc7XG4gICAgICBzaG93VGl0bGU/OiBib29sZWFuO1xuICAgICAgaGVpZ2h0TW9kZT86ICdzY3JvbGwnIHwgJ2dyb3cnO1xuICAgIH07XG5cbiAgICBlbC5lbXB0eSgpO1xuICAgIGVsLnRvZ2dsZUNsYXNzKCdlbWJlZGRlZC1ub3RlLWJsb2NrLS1ncm93JywgaGVpZ2h0TW9kZSA9PT0gJ2dyb3cnKTtcblxuICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRDNH0nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gbm90ZSBzZWxlY3RlZC4gQ2hvb3NlIGEgZmlsZSBwYXRoIGluIHNldHRpbmdzIHRvIGVtYmVkIGl0IGhlcmUuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICBlbC5zZXRUZXh0KGBGaWxlIG5vdCBmb3VuZDogJHtmaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2hvd1RpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgZmlsZS5iYXNlbmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1iZWRkZWQtbm90ZS1jb250ZW50JyB9KTtcbiAgICBpZiAoaGVpZ2h0TW9kZSA9PT0gJ3Njcm9sbCcpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgIGNvbnRlbnRFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncmVnaW9uJyk7XG4gICAgICBjb250ZW50RWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgZmlsZS5iYXNlbmFtZSk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgZmlsZS5wYXRoLCB0aGlzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBNYXJrZG93blJlbmRlcmVyIGZhaWxlZDonLCBlKTtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBFbWJlZGRlZE5vdGVTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdFbWJlZGRlZCBOb3RlIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRmlsZSBwYXRoJykuc2V0RGVzYygnVmF1bHQgcGF0aCB0byB0aGUgbm90ZSAoZS5nLiBOb3Rlcy9NeU5vdGUubWQpJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LmZpbGVQYXRoIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZpbGVQYXRoID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGl0bGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93VGl0bGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnSGVpZ2h0IG1vZGUnKVxuICAgICAgLnNldERlc2MoJ1Njcm9sbCBrZWVwcyB0aGUgYmxvY2sgY29tcGFjdC4gR3JvdyB0byBmaXQgYWxsIGV4cGFuZHMgdGhlIGNhcmQgdG8gc2hvdyB0aGUgZnVsbCBub3RlLicpXG4gICAgICAuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgICBkLmFkZE9wdGlvbignc2Nyb2xsJywgJ1Njcm9sbCAoZml4ZWQgaGVpZ2h0KScpXG4gICAgICAgICAuYWRkT3B0aW9uKCdncm93JywgJ0dyb3cgdG8gZml0IGFsbCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuaGVpZ2h0TW9kZSBhcyBzdHJpbmcgPz8gJ3Njcm9sbCcpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmhlaWdodE1vZGUgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNYXJrZG93blJlbmRlcmVyLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIFN0YXRpY1RleHRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnc3RhdGljLXRleHQtYmxvY2snKTtcbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gU3RhdGljVGV4dEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgY29udGVudC4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGNvbnRlbnQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb250ZW50Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3N0YXRpYy10ZXh0LWNvbnRlbnQnIH0pO1xuXG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICBjb25zdCBoaW50ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEREfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBjb250ZW50IHlldC4gQWRkIE1hcmtkb3duIHRleHQgaW4gc2V0dGluZ3MuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCAnJywgdGhpcyk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFN0YXRpY1RleHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N0YXRpYyBUZXh0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5zZXREZXNjKCdPcHRpb25hbCBoZWFkZXIgc2hvd24gYWJvdmUgdGhlIHRleHQuJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29udGVudCcpLnNldERlc2MoJ1N1cHBvcnRzIE1hcmtkb3duLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuY29udGVudCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEwO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5jb250ZW50ID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgc2FuaXRpemVIVE1MVG9Eb20gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBIdG1sQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2h0bWwtYmxvY2snKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnJywgaHRtbCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGh0bWw/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdodG1sLWJsb2NrLWNvbnRlbnQnIH0pO1xuXG4gICAgaWYgKCFodG1sKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnPC8+JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIEhUTUwgY29udGVudCB5ZXQuIEFkZCB5b3VyIG1hcmt1cCBpbiBzZXR0aW5ncy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnRlbnRFbC5hcHBlbmRDaGlsZChzYW5pdGl6ZUhUTUxUb0RvbShodG1sKSk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEh0bWxCbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIVE1MIEJsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5zZXREZXNjKCdPcHRpb25hbCBoZWFkZXIgc2hvd24gYWJvdmUgdGhlIEhUTUwuJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnSFRNTCcpLnNldERlc2MoJ0hUTUwgaXMgc2FuaXRpemVkIGJlZm9yZSByZW5kZXJpbmcuJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5odG1sIGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTI7XG4gICAgdGV4dGFyZWEuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0Lmh0bWwgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG9CQUF1RDs7O0FDQXZELElBQUFDLG1CQUF3Qzs7O0FDQXhDLHNCQUE2Qzs7O0FDRTdDLElBQU0scUJBQU4sTUFBeUI7QUFBQSxFQUF6QjtBQUNFLFNBQVEsWUFBWSxvQkFBSSxJQUE2QjtBQUFBO0FBQUEsRUFFckQsU0FBUyxTQUE2QjtBQUNwQyxTQUFLLFVBQVUsSUFBSSxRQUFRLE1BQU0sT0FBTztBQUFBLEVBQzFDO0FBQUEsRUFFQSxJQUFJLE1BQTJDO0FBQzdDLFdBQU8sS0FBSyxVQUFVLElBQUksSUFBSTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxTQUF5QjtBQUN2QixXQUFPLE1BQU0sS0FBSyxLQUFLLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDM0M7QUFBQSxFQUVBLFFBQWM7QUFDWixTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZCO0FBQ0Y7QUFFTyxJQUFNLGdCQUFnQixJQUFJLG1CQUFtQjs7O0FEZnBELElBQU0sZUFBZTtBQUVkLElBQU0sYUFBTixNQUFpQjtBQUFBLEVBZXRCLFlBQ0UsYUFDUSxLQUNBLFFBQ0EsZ0JBQ1I7QUFIUTtBQUNBO0FBQ0E7QUFqQlYsU0FBUSxTQUFTLG9CQUFJLElBQXdEO0FBQzdFLFNBQVEsV0FBVztBQUVuQjtBQUFBLFNBQVEsd0JBQWdEO0FBRXhEO0FBQUEsU0FBUSxjQUFrQztBQUMxQyxTQUFRLGlCQUF3QztBQUNoRCxTQUFRLG1CQUFtQjtBQUUzQjtBQUFBLDZCQUF5QztBQUV6QztBQUFBLFNBQVEsbUJBQWtDO0FBUXhDLFNBQUssU0FBUyxZQUFZLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQzVELFNBQUssaUJBQWlCLElBQUksZUFBZSxNQUFNO0FBQzdDLFlBQU0sZUFBZSxLQUFLLHdCQUF3QixLQUFLLE9BQU8sT0FBTyxPQUFPO0FBQzVFLFVBQUksaUJBQWlCLEtBQUssa0JBQWtCO0FBQzFDLGFBQUssU0FBUztBQUFBLE1BQ2hCO0FBQUEsSUFDRixDQUFDO0FBQ0QsU0FBSyxlQUFlLFFBQVEsS0FBSyxNQUFNO0FBQUEsRUFDekM7QUFBQTtBQUFBLEVBR0EsYUFBMEI7QUFDeEIsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRVEsd0JBQXdCLGVBQStCO0FBQzdELFVBQU0sSUFBSSxLQUFLLE9BQU87QUFDdEIsUUFBSSxLQUFLLEVBQUcsUUFBTztBQUNuQixRQUFJLEtBQUssSUFBSyxRQUFPO0FBQ3JCLFFBQUksS0FBSyxJQUFLLFFBQU8sS0FBSyxJQUFJLEdBQUcsYUFBYTtBQUM5QyxRQUFJLEtBQUssS0FBTSxRQUFPLEtBQUssSUFBSSxHQUFHLGFBQWE7QUFDL0MsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE9BQU8sUUFBeUIsU0FBaUIsWUFBWSxPQUFhO0FBQ3hFLFNBQUssV0FBVztBQUNoQixTQUFLLE9BQU8sTUFBTTtBQUNsQixTQUFLLE9BQU8sYUFBYSxRQUFRLE1BQU07QUFDdkMsU0FBSyxPQUFPLGFBQWEsY0FBYyxpQkFBaUI7QUFDeEQsU0FBSyxtQkFBbUIsS0FBSyx3QkFBd0IsT0FBTztBQUc1RCxRQUFJLFdBQVc7QUFDYixXQUFLLE9BQU8sU0FBUywwQkFBMEI7QUFDL0MsaUJBQVcsTUFBTSxLQUFLLE9BQU8sWUFBWSwwQkFBMEIsR0FBRyxHQUFHO0FBQUEsSUFDM0U7QUFFQSxRQUFJLEtBQUssVUFBVTtBQUNqQixXQUFLLE9BQU8sU0FBUyxXQUFXO0FBQUEsSUFDbEMsT0FBTztBQUNMLFdBQUssT0FBTyxZQUFZLFdBQVc7QUFBQSxJQUNyQztBQUVBLFFBQUksT0FBTyxXQUFXLEdBQUc7QUFDdkIsWUFBTSxRQUFRLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztBQUNuRSxZQUFNLFVBQVUsRUFBRSxLQUFLLHVCQUF1QixNQUFNLFlBQVksQ0FBQztBQUNqRSxZQUFNLFNBQVMsS0FBSyxFQUFFLEtBQUssd0JBQXdCLE1BQU0seUJBQXlCLENBQUM7QUFDbkYsWUFBTSxTQUFTLEtBQUs7QUFBQSxRQUNsQixLQUFLO0FBQUEsUUFDTCxNQUFNLEtBQUssV0FDUCxvREFDQTtBQUFBLE1BQ04sQ0FBQztBQUNELFVBQUksS0FBSyxZQUFZLEtBQUssbUJBQW1CO0FBQzNDLGNBQU0sTUFBTSxNQUFNLFNBQVMsVUFBVSxFQUFFLEtBQUssc0JBQXNCLE1BQU0sdUJBQXVCLENBQUM7QUFDaEcsWUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBckY1QztBQXFGOEMscUJBQUssc0JBQUw7QUFBQSxRQUE0QixDQUFDO0FBQUEsTUFDckU7QUFDQTtBQUFBLElBQ0Y7QUFFQSxlQUFXLFlBQVksUUFBUTtBQUM3QixXQUFLLFlBQVksUUFBUTtBQUFBLElBQzNCO0FBQUEsRUFDRjtBQUFBLEVBRVEsWUFBWSxVQUErQjtBQUNqRCxVQUFNLFVBQVUsY0FBYyxJQUFJLFNBQVMsSUFBSTtBQUMvQyxRQUFJLENBQUMsUUFBUztBQUVkLFFBQUksU0FBUyxRQUFRO0FBQ25CLFdBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyxxQkFBcUIsQ0FBQztBQUFBLElBQ3JEO0FBRUEsVUFBTSxVQUFVLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsQ0FBQztBQUN2RSxZQUFRLFFBQVEsVUFBVSxTQUFTO0FBQ25DLFlBQVEsYUFBYSxRQUFRLFVBQVU7QUFDdkMsU0FBSyxrQkFBa0IsU0FBUyxRQUFRO0FBRXhDLFFBQUksS0FBSyxVQUFVO0FBQ2pCLFdBQUssa0JBQWtCLFNBQVMsUUFBUTtBQUFBLElBQzFDO0FBR0EsVUFBTSxhQUFhLFFBQVEsVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFDakUsZUFBVyxhQUFhLFFBQVEsUUFBUTtBQUN4QyxlQUFXLGFBQWEsWUFBWSxHQUFHO0FBQ3ZDLGVBQVcsYUFBYSxpQkFBaUIsT0FBTyxDQUFDLFNBQVMsU0FBUyxDQUFDO0FBQ3BFLFVBQU0sVUFBVSxXQUFXLFdBQVcsRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBQ3ZFLFlBQVEsYUFBYSxlQUFlLE1BQU07QUFFMUMsVUFBTSxZQUFZLFFBQVEsVUFBVSxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFDNUQsVUFBTSxRQUFRLFFBQVEsT0FBTyxLQUFLLEtBQUssVUFBVSxLQUFLLE1BQU07QUFDNUQsVUFBTSxtQkFBbUIsVUFBVTtBQUNuQyxVQUFNLEtBQUs7QUFDWCxVQUFNLFNBQVMsTUFBTSxPQUFPLFNBQVM7QUFDckMsUUFBSSxrQkFBa0IsU0FBUztBQUM3QixhQUFPLE1BQU0sT0FBSztBQUNoQixnQkFBUSxNQUFNLDJDQUEyQyxTQUFTLElBQUksS0FBSyxDQUFDO0FBQzVFLGtCQUFVLFFBQVEsbURBQW1EO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0g7QUFFQSxRQUFJLFNBQVMsVUFBVyxTQUFRLFNBQVMsaUJBQWlCO0FBRTFELFVBQU0saUJBQWlCLENBQUMsTUFBYTtBQUNuQyxRQUFFLGdCQUFnQjtBQUNsQixVQUFJLEtBQUssU0FBVTtBQUNuQixZQUFNLGlCQUFpQixDQUFDLFFBQVEsU0FBUyxpQkFBaUI7QUFDMUQsY0FBUSxZQUFZLG1CQUFtQixjQUFjO0FBQ3JELGNBQVEsWUFBWSxnQkFBZ0IsY0FBYztBQUNsRCxpQkFBVyxhQUFhLGlCQUFpQixPQUFPLENBQUMsY0FBYyxDQUFDO0FBQ2hFLFlBQU0sWUFBWSxLQUFLLE9BQU8sT0FBTyxPQUFPO0FBQUEsUUFBSSxPQUM5QyxFQUFFLE9BQU8sU0FBUyxLQUFLLEVBQUUsR0FBRyxHQUFHLFdBQVcsZUFBZSxJQUFJO0FBQUEsTUFDL0Q7QUFDQSxXQUFLLEtBQUssT0FBTyxXQUFXLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUFBLElBQzFFO0FBRUEsZUFBVyxpQkFBaUIsU0FBUyxjQUFjO0FBQ25ELGVBQVcsaUJBQWlCLFdBQVcsQ0FBQyxNQUFxQjtBQUMzRCxVQUFJLEVBQUUsUUFBUSxXQUFXLEVBQUUsUUFBUSxLQUFLO0FBQUUsVUFBRSxlQUFlO0FBQUcsdUJBQWUsQ0FBQztBQUFBLE1BQUc7QUFBQSxJQUNuRixDQUFDO0FBRUQsUUFBSSxTQUFTLFVBQVcsU0FBUSxTQUFTLGNBQWM7QUFFdkQsU0FBSyxPQUFPLElBQUksU0FBUyxJQUFJLEVBQUUsT0FBTyxRQUFRLENBQUM7QUFBQSxFQUNqRDtBQUFBLEVBRVEsYUFBYSxTQUF5QjtBQUM1QyxRQUFJLFdBQVcsRUFBRyxRQUFPO0FBQ3pCLFdBQU8sb0NBQW9DLE9BQU8sNEJBQTRCLFVBQVUsQ0FBQztBQUFBLEVBQzNGO0FBQUEsRUFFUSxrQkFBa0IsU0FBc0IsVUFBK0I7QUFDN0UsVUFBTSxPQUFPLEtBQUs7QUFDbEIsVUFBTSxVQUFVLEtBQUssSUFBSSxTQUFTLFNBQVMsSUFBSTtBQUsvQyxVQUFNLGVBQWdCLFVBQVUsT0FBUTtBQUN4QyxVQUFNLGVBQWUsT0FBTyxXQUFXO0FBQ3ZDLFlBQVEsTUFBTSxPQUFPLEdBQUcsT0FBTyxXQUFXLFlBQVksNkJBQTZCLFlBQVksUUFBUSxDQUFDLENBQUM7QUFDekcsWUFBUSxNQUFNLFdBQVcsU0FBUyxJQUFJLE1BQU07QUFDNUMsWUFBUSxNQUFNLFlBQVksS0FBSyxhQUFhLFNBQVMsT0FBTztBQUFBLEVBQzlEO0FBQUEsRUFFUSxrQkFBa0IsU0FBc0IsVUFBK0I7QUFDN0UsVUFBTSxNQUFNLFFBQVEsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFFekQsVUFBTSxTQUFTLElBQUksVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFDekQsaUNBQVEsUUFBUSxlQUFlO0FBQy9CLFdBQU8sYUFBYSxjQUFjLGlCQUFpQjtBQUNuRCxXQUFPLGFBQWEsU0FBUyxpQkFBaUI7QUFFOUMsVUFBTSxjQUFjLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxxQkFBcUIsQ0FBQztBQUN4RSxpQ0FBUSxhQUFhLFVBQVU7QUFDL0IsZ0JBQVksYUFBYSxjQUFjLGdCQUFnQjtBQUN2RCxnQkFBWSxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDM0MsUUFBRSxnQkFBZ0I7QUFDbEIsWUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLFNBQVMsRUFBRTtBQUN6QyxVQUFJLENBQUMsTUFBTztBQUNaLFlBQU0sU0FBUyxNQUFNO0FBQ25CLGNBQU0sWUFBWSxLQUFLLE9BQU8sT0FBTyxPQUFPO0FBQUEsVUFBSSxPQUM5QyxFQUFFLE9BQU8sU0FBUyxLQUFLLFdBQVc7QUFBQSxRQUNwQztBQUNBLGFBQUssZUFBZSxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsUUFBUSxVQUFVLENBQUM7QUFDaEUsYUFBSyxTQUFTO0FBQUEsTUFDaEI7QUFDQSxVQUFJLG1CQUFtQixLQUFLLEtBQUssVUFBVSxNQUFNLE9BQU8sTUFBTSxFQUFFLEtBQUs7QUFBQSxJQUN2RSxDQUFDO0FBRUQsVUFBTSxZQUFZLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUNwRSxpQ0FBUSxXQUFXLEdBQUc7QUFDdEIsY0FBVSxhQUFhLGNBQWMsY0FBYztBQUNuRCxjQUFVLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUN6QyxRQUFFLGdCQUFnQjtBQUNsQixVQUFJLHdCQUF3QixLQUFLLEtBQUssTUFBTTtBQUMxQyxjQUFNLFlBQVksS0FBSyxPQUFPLE9BQU8sT0FBTyxPQUFPLE9BQUssRUFBRSxPQUFPLFNBQVMsRUFBRTtBQUM1RSxhQUFLLGVBQWUsRUFBRSxHQUFHLEtBQUssT0FBTyxRQUFRLFFBQVEsVUFBVSxDQUFDO0FBQ2hFLGFBQUssU0FBUztBQUFBLE1BQ2hCLENBQUMsRUFBRSxLQUFLO0FBQUEsSUFDVixDQUFDO0FBR0QsVUFBTSxZQUFZLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUNyRSxpQ0FBUSxXQUFXLFlBQVk7QUFDL0IsY0FBVSxhQUFhLGNBQWMsZUFBZTtBQUNwRCxjQUFVLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUN6QyxRQUFFLGdCQUFnQjtBQUNsQixZQUFNLE1BQU0sS0FBSyxPQUFPLE9BQU8sT0FBTyxVQUFVLE9BQUssRUFBRSxPQUFPLFNBQVMsRUFBRTtBQUN6RSxVQUFJLE9BQU8sRUFBRztBQUNkLFlBQU0sWUFBWSxDQUFDLEdBQUcsS0FBSyxPQUFPLE9BQU8sTUFBTTtBQUMvQyxPQUFDLFVBQVUsTUFBTSxDQUFDLEdBQUcsVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUFHLFVBQVUsTUFBTSxDQUFDLENBQUM7QUFDMUUsV0FBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUNoRSxXQUFLLFNBQVM7QUFBQSxJQUNoQixDQUFDO0FBRUQsVUFBTSxjQUFjLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxzQkFBc0IsQ0FBQztBQUN6RSxpQ0FBUSxhQUFhLGNBQWM7QUFDbkMsZ0JBQVksYUFBYSxjQUFjLGlCQUFpQjtBQUN4RCxnQkFBWSxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDM0MsUUFBRSxnQkFBZ0I7QUFDbEIsWUFBTSxNQUFNLEtBQUssT0FBTyxPQUFPLE9BQU8sVUFBVSxPQUFLLEVBQUUsT0FBTyxTQUFTLEVBQUU7QUFDekUsVUFBSSxNQUFNLEtBQUssT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLFNBQVMsRUFBRztBQUM1RCxZQUFNLFlBQVksQ0FBQyxHQUFHLEtBQUssT0FBTyxPQUFPLE1BQU07QUFDL0MsT0FBQyxVQUFVLEdBQUcsR0FBRyxVQUFVLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQU0sQ0FBQyxHQUFHLFVBQVUsR0FBRyxDQUFDO0FBQzFFLFdBQUssZUFBZSxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsUUFBUSxVQUFVLENBQUM7QUFDaEUsV0FBSyxTQUFTO0FBQUEsSUFDaEIsQ0FBQztBQUVELFVBQU0sT0FBTyxRQUFRLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBQzNELGlDQUFRLE1BQU0sWUFBWTtBQUMxQixTQUFLLGFBQWEsY0FBYyxnQkFBZ0I7QUFDaEQsU0FBSyxhQUFhLFNBQVMsZ0JBQWdCO0FBQzNDLFNBQUssb0JBQW9CLE1BQU0sU0FBUyxRQUFRO0FBRWhELFNBQUssa0JBQWtCLFFBQVEsU0FBUyxRQUFRO0FBQUEsRUFDbEQ7QUFBQSxFQUVRLGtCQUFrQixRQUFxQixTQUFzQixVQUErQjtBQUNsRyxXQUFPLGlCQUFpQixhQUFhLENBQUMsTUFBa0I7QUExUDVEO0FBMlBNLFFBQUUsZUFBZTtBQUVqQixpQkFBSywwQkFBTCxtQkFBNEI7QUFDNUIsWUFBTSxLQUFLLElBQUksZ0JBQWdCO0FBQy9CLFdBQUssd0JBQXdCO0FBRzdCLFlBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxZQUFNLFNBQVMsa0JBQWtCO0FBQ2pDLFlBQU0sTUFBTSxRQUFRLEdBQUcsUUFBUSxXQUFXO0FBQzFDLFlBQU0sTUFBTSxTQUFTLEdBQUcsUUFBUSxZQUFZO0FBQzVDLFlBQU0sTUFBTSxPQUFPLEdBQUcsRUFBRSxVQUFVLFFBQVEsY0FBYyxDQUFDO0FBQ3pELFlBQU0sTUFBTSxNQUFNLEdBQUcsRUFBRSxVQUFVLEVBQUU7QUFDbkMsWUFBTSxVQUFVLFVBQUssT0FBTyxRQUFRLGdCQUFnQixNQUFwQyxZQUF5QyxTQUFTO0FBQ2xFLGFBQU8sWUFBWSxLQUFLO0FBQ3hCLFdBQUssY0FBYztBQUduQixZQUFNLGNBQWMsU0FBUyxjQUFjLEtBQUs7QUFDaEQsa0JBQVksU0FBUyx3QkFBd0I7QUFDN0Msa0JBQVksTUFBTSxPQUFPLFFBQVEsTUFBTTtBQUN2QyxrQkFBWSxNQUFNLFdBQVcsUUFBUSxNQUFNO0FBQzNDLGtCQUFZLE1BQU0sU0FBUyxHQUFHLFFBQVEsWUFBWTtBQUNsRCxjQUFRLHNCQUFzQixZQUFZLFdBQVc7QUFFckQsWUFBTSxXQUFXLFNBQVM7QUFDMUIsY0FBUSxTQUFTLGdCQUFnQjtBQUdqQyxZQUFNLGNBQWMsb0JBQUksSUFBcUI7QUFDN0MsaUJBQVcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsS0FBSyxLQUFLLFFBQVE7QUFDOUMsWUFBSSxPQUFPLFNBQVUsYUFBWSxJQUFJLElBQUksRUFBRSxzQkFBc0IsQ0FBQztBQUFBLE1BQ3BFO0FBRUEsVUFBSSxxQkFBb0M7QUFFeEMsWUFBTSxrQkFBa0IsQ0FBQyxtQkFBa0M7QUEvUmpFLFlBQUFDO0FBZ1NRLFlBQUksbUJBQW1CLG1CQUFvQjtBQUMzQyw2QkFBcUI7QUFDckIsb0JBQVksT0FBTztBQUNuQixZQUFJLGdCQUFnQjtBQUNsQixnQkFBTSxpQkFBZ0JBLE1BQUEsS0FBSyxPQUFPLElBQUksY0FBYyxNQUE5QixnQkFBQUEsSUFBaUM7QUFDdkQsY0FBSSxlQUFlO0FBQ2pCLGlCQUFLLE9BQU8sYUFBYSxhQUFhLGFBQWE7QUFDbkQ7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUNBLGFBQUssT0FBTyxZQUFZLFdBQVc7QUFBQSxNQUNyQztBQUVBLFlBQU0sY0FBYyxDQUFDLE9BQW1CO0FBQ3RDLGNBQU0sTUFBTSxPQUFPLEdBQUcsR0FBRyxVQUFVLFFBQVEsY0FBYyxDQUFDO0FBQzFELGNBQU0sTUFBTSxNQUFNLEdBQUcsR0FBRyxVQUFVLEVBQUU7QUFDcEMsY0FBTSxLQUFLLEtBQUsseUJBQXlCLEdBQUcsU0FBUyxHQUFHLFNBQVMsVUFBVSxXQUFXO0FBQ3RGLHdCQUFnQixHQUFHLGNBQWM7QUFBQSxNQUNuQztBQUVBLFlBQU0sWUFBWSxDQUFDLE9BQW1CO0FBQ3BDLFdBQUcsTUFBTTtBQUNULGFBQUssd0JBQXdCO0FBQzdCLGNBQU0sT0FBTztBQUNiLGFBQUssY0FBYztBQUNuQixvQkFBWSxPQUFPO0FBQ25CLGdCQUFRLFlBQVksZ0JBQWdCO0FBRXBDLGNBQU0sS0FBSyxLQUFLLHlCQUF5QixHQUFHLFNBQVMsR0FBRyxTQUFTLFVBQVUsV0FBVztBQUN0RixhQUFLLGFBQWEsVUFBVSxHQUFHLGNBQWM7QUFBQSxNQUMvQztBQUVBLGVBQVMsaUJBQWlCLGFBQWEsYUFBYSxFQUFFLFFBQVEsR0FBRyxPQUFPLENBQUM7QUFDekUsZUFBUyxpQkFBaUIsV0FBVyxXQUFXLEVBQUUsUUFBUSxHQUFHLE9BQU8sQ0FBQztBQUFBLElBQ3ZFLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxvQkFBb0IsTUFBbUIsU0FBc0IsVUFBK0I7QUFDbEcsU0FBSyxpQkFBaUIsYUFBYSxDQUFDLE1BQWtCO0FBdFUxRDtBQXVVTSxRQUFFLGVBQWU7QUFDakIsUUFBRSxnQkFBZ0I7QUFFbEIsaUJBQUssMEJBQUwsbUJBQTRCO0FBQzVCLFlBQU0sS0FBSyxJQUFJLGdCQUFnQjtBQUMvQixXQUFLLHdCQUF3QjtBQUU3QixZQUFNLFNBQVMsRUFBRTtBQUNqQixZQUFNLFNBQVMsRUFBRTtBQUNqQixZQUFNLGVBQWUsU0FBUztBQUM5QixZQUFNLGVBQWUsU0FBUztBQUM5QixZQUFNLFVBQVUsS0FBSztBQUNyQixZQUFNLFdBQVcsS0FBSyxPQUFPLGNBQWM7QUFDM0MsWUFBTSxZQUNKLEtBQUssSUFBSSxJQUFJO0FBQUEsUUFDWCxpQkFBaUIsS0FBSyxNQUFNLEVBQUUsaUJBQWlCLGVBQWUsRUFBRSxLQUFLO0FBQUEsTUFDdkUsS0FBSyxHQUFHO0FBQ1YsVUFBSSxpQkFBaUI7QUFDckIsVUFBSSxpQkFBaUI7QUFFckIsWUFBTSxjQUFjLENBQUMsT0FBbUI7QUFDdEMsY0FBTSxTQUFTLEdBQUcsVUFBVTtBQUM1QixjQUFNLFNBQVMsR0FBRyxVQUFVO0FBQzVCLGNBQU0sWUFBWSxLQUFLLE1BQU0sU0FBUyxRQUFRO0FBQzlDLGNBQU0sWUFBWSxLQUFLLE1BQU0sU0FBUyxTQUFTO0FBQy9DLHlCQUFpQixLQUFLLElBQUksR0FBRyxLQUFLLElBQUksU0FBUyxlQUFlLFNBQVMsQ0FBQztBQUN4RSx5QkFBaUIsS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLGNBQWMsZUFBZSxTQUFTLENBQUM7QUFDN0UsY0FBTSxlQUFnQixpQkFBaUIsVUFBVztBQUNsRCxjQUFNLGVBQWUsVUFBVSxrQkFBa0I7QUFDakQsZ0JBQVEsTUFBTSxPQUFPLEdBQUcsY0FBYyxXQUFXLFlBQVksNkJBQTZCLFlBQVksUUFBUSxDQUFDLENBQUM7QUFDaEgsZ0JBQVEsTUFBTSxZQUFZLEtBQUssYUFBYSxjQUFjO0FBQUEsTUFDNUQ7QUFFQSxZQUFNLFlBQVksTUFBTTtBQUN0QixXQUFHLE1BQU07QUFDVCxhQUFLLHdCQUF3QjtBQUU3QixjQUFNLFlBQVksS0FBSyxPQUFPLE9BQU8sT0FBTztBQUFBLFVBQUksT0FDOUMsRUFBRSxPQUFPLFNBQVMsS0FBSyxFQUFFLEdBQUcsR0FBRyxTQUFTLGdCQUFnQixTQUFTLGVBQWUsSUFBSTtBQUFBLFFBQ3RGO0FBQ0EsYUFBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxRQUFRLFVBQVUsQ0FBQztBQUNoRSxhQUFLLFNBQVM7QUFBQSxNQUNoQjtBQUVBLGVBQVMsaUJBQWlCLGFBQWEsYUFBYSxFQUFFLFFBQVEsR0FBRyxPQUFPLENBQUM7QUFDekUsZUFBUyxpQkFBaUIsV0FBVyxXQUFXLEVBQUUsUUFBUSxHQUFHLE9BQU8sQ0FBQztBQUFBLElBQ3ZFLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSx5QkFDTixHQUNBLEdBQ0EsV0FDQSxPQUNtRjtBQUNuRixRQUFJLGVBQThCO0FBQ2xDLFFBQUksV0FBVztBQUNmLFFBQUksbUJBQW1CO0FBRXZCLGVBQVcsQ0FBQyxJQUFJLElBQUksS0FBSyxPQUFPO0FBQzlCLFVBQUksT0FBTyxVQUFXO0FBQ3RCLFlBQU0sS0FBSyxLQUFLLE9BQU8sS0FBSyxRQUFRO0FBQ3BDLFlBQU0sS0FBSyxLQUFLLE1BQU0sS0FBSyxTQUFTO0FBR3BDLFVBQUksS0FBSyxLQUFLLFFBQVEsS0FBSyxLQUFLLFNBQVMsS0FBSyxLQUFLLE9BQU8sS0FBSyxLQUFLLFFBQVE7QUFDMUUsY0FBTSxlQUFlLElBQUk7QUFDekIsZUFBTyxFQUFFLFVBQVUsSUFBSSxjQUFjLGdCQUFnQixlQUFlLEtBQUssS0FBSyxZQUFZLEVBQUUsRUFBRTtBQUFBLE1BQ2hHO0FBR0EsWUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxFQUFFO0FBQ3RDLFVBQUksT0FBTyxZQUFZLE9BQU8sS0FBSztBQUNqQyxtQkFBVztBQUNYLHVCQUFlO0FBQ2YsMkJBQW1CLElBQUk7QUFBQSxNQUN6QjtBQUFBLElBQ0Y7QUFFQSxRQUFJLENBQUMsYUFBYyxRQUFPLEVBQUUsVUFBVSxNQUFNLGNBQWMsTUFBTSxnQkFBZ0IsS0FBSztBQUNyRixXQUFPO0FBQUEsTUFDTCxVQUFVO0FBQUEsTUFDVixjQUFjO0FBQUEsTUFDZCxnQkFBZ0IsbUJBQW1CLGVBQWUsS0FBSyxZQUFZLFlBQVk7QUFBQSxJQUNqRjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLFlBQVksSUFBMkI7QUFDN0MsVUFBTSxTQUFTLEtBQUssT0FBTyxPQUFPO0FBQ2xDLFVBQU0sTUFBTSxPQUFPLFVBQVUsT0FBSyxFQUFFLE9BQU8sRUFBRTtBQUM3QyxXQUFPLE9BQU8sS0FBSyxNQUFNLE9BQU8sU0FBUyxJQUFJLE9BQU8sTUFBTSxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ3BFO0FBQUE7QUFBQSxFQUdRLGFBQWEsV0FBbUIsZ0JBQXFDO0FBQzNFLFVBQU0sU0FBUyxLQUFLLE9BQU8sT0FBTztBQUNsQyxVQUFNLFVBQVUsT0FBTyxLQUFLLE9BQUssRUFBRSxPQUFPLFNBQVM7QUFDbkQsUUFBSSxDQUFDLFFBQVM7QUFFZCxVQUFNLGlCQUFpQixPQUFPLE9BQU8sT0FBSyxFQUFFLE9BQU8sU0FBUztBQUM1RCxVQUFNLFdBQVcsaUJBQ2IsZUFBZSxVQUFVLE9BQUssRUFBRSxPQUFPLGNBQWMsSUFDckQsZUFBZTtBQUduQixVQUFNLGNBQWMsT0FBTyxVQUFVLE9BQUssRUFBRSxPQUFPLFNBQVM7QUFDNUQsVUFBTSxhQUFhLGFBQWEsS0FBSyxlQUFlLFNBQVM7QUFDN0QsUUFBSSxlQUFlLGVBQWUsZUFBZSxjQUFjLEVBQUc7QUFFbEUsVUFBTSxZQUFZO0FBQUEsTUFDaEIsR0FBRyxlQUFlLE1BQU0sR0FBRyxVQUFVO0FBQUEsTUFDckM7QUFBQSxNQUNBLEdBQUcsZUFBZSxNQUFNLFVBQVU7QUFBQSxJQUNwQztBQUNBLFNBQUssZUFBZSxFQUFFLEdBQUcsS0FBSyxPQUFPLFFBQVEsUUFBUSxVQUFVLENBQUM7QUFDaEUsU0FBSyxTQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUVBLFlBQVksU0FBd0I7QUFDbEMsU0FBSyxXQUFXO0FBQ2hCLFNBQUssU0FBUztBQUFBLEVBQ2hCO0FBQUE7QUFBQSxFQUdBLFdBQVcsR0FBaUI7QUFDMUIsVUFBTSxZQUFZLEtBQUssT0FBTyxPQUFPLE9BQU8sSUFBSSxPQUFLO0FBQ25ELFlBQU0sTUFBTSxLQUFLLElBQUksRUFBRSxLQUFLLENBQUM7QUFDN0IsWUFBTSxVQUFVLEtBQUssSUFBSSxFQUFFLFNBQVMsSUFBSSxNQUFNLENBQUM7QUFDL0MsYUFBTyxFQUFFLEdBQUcsR0FBRyxLQUFLLFFBQVE7QUFBQSxJQUM5QixDQUFDO0FBQ0QsU0FBSyxlQUFlLEVBQUUsR0FBRyxLQUFLLE9BQU8sUUFBUSxTQUFTLEdBQUcsUUFBUSxVQUFVLENBQUM7QUFDNUUsU0FBSyxTQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUVBLFNBQVMsVUFBK0I7QUFDdEMsVUFBTSxZQUFZLENBQUMsR0FBRyxLQUFLLE9BQU8sT0FBTyxRQUFRLFFBQVE7QUFDekQsU0FBSyxtQkFBbUIsU0FBUztBQUNqQyxTQUFLLGVBQWUsRUFBRSxHQUFHLEtBQUssT0FBTyxRQUFRLFFBQVEsVUFBVSxDQUFDO0FBQ2hFLFNBQUssU0FBUztBQUFBLEVBQ2hCO0FBQUEsRUFFUSxXQUFpQjtBQXBkM0I7QUFxZEksVUFBTSxVQUFVLFNBQVM7QUFDekIsVUFBTSxrQkFBa0Isd0NBQVMsUUFBUSx1QkFBakIsbUJBQTRELFFBQVE7QUFDNUYsVUFBTSxpQkFBaUIsS0FBSztBQUM1QixTQUFLLG1CQUFtQjtBQUV4QixTQUFLLE9BQU8sS0FBSyxPQUFPLE9BQU8sUUFBUSxLQUFLLE9BQU8sT0FBTyxPQUFPO0FBRWpFLFFBQUksZ0JBQWdCO0FBQ2xCLFlBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxjQUFjO0FBQzVDLFVBQUksT0FBTztBQUNULGNBQU0sUUFBUSxTQUFTLGtCQUFrQjtBQUN6QyxjQUFNLFFBQVEsZUFBZSxFQUFFLFVBQVUsVUFBVSxPQUFPLFVBQVUsQ0FBQztBQUFBLE1BQ3ZFO0FBQUEsSUFDRixXQUFXLGdCQUFnQjtBQUN6QixZQUFNLEtBQUssS0FBSyxPQUFPLGNBQTJCLG1CQUFtQixjQUFjLElBQUk7QUFDdkYsK0JBQUk7QUFBQSxJQUNOO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHQSxhQUFtQjtBQXplckI7QUEwZUksZUFBSywwQkFBTCxtQkFBNEI7QUFDNUIsU0FBSyx3QkFBd0I7QUFDN0IsZUFBSyxnQkFBTCxtQkFBa0I7QUFDbEIsU0FBSyxjQUFjO0FBRW5CLGVBQVcsRUFBRSxNQUFNLEtBQUssS0FBSyxPQUFPLE9BQU8sR0FBRztBQUM1QyxZQUFNLE9BQU87QUFBQSxJQUNmO0FBQ0EsU0FBSyxPQUFPLE1BQU07QUFBQSxFQUNwQjtBQUFBO0FBQUEsRUFHQSxVQUFnQjtBQXRmbEI7QUF1ZkksZUFBSyxtQkFBTCxtQkFBcUI7QUFDckIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxXQUFXO0FBQ2hCLFNBQUssT0FBTyxPQUFPO0FBQUEsRUFDckI7QUFDRjtBQUtBLElBQU0sbUJBQXVDO0FBQUE7QUFBQSxFQUUzQyxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFBRSxDQUFDLGFBQUssbUJBQW1CO0FBQUEsRUFBRSxDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFDaEYsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG1CQUFtQjtBQUFBLEVBQy9FLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFDMUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUFFLENBQUMsYUFBSyx1QkFBdUI7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUM1RSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUE7QUFBQSxFQUUzRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssbUJBQW1CO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFDMUUsQ0FBQyxVQUFJLGVBQWU7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUN4RSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBLEVBQUUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQzNFLENBQUMsVUFBSSxnQkFBZ0I7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQ2pFLENBQUMsYUFBSyxhQUFhO0FBQUEsRUFBRSxDQUFDLGFBQUssWUFBWTtBQUFBLEVBQUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUFFLENBQUMsYUFBSyxhQUFhO0FBQUE7QUFBQSxFQUVsRixDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssd0JBQXdCO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBLEVBQ2pGLENBQUMsYUFBSyxxQkFBcUI7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxXQUFXO0FBQUEsRUFDdkUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQzlFLENBQUMsVUFBSSwyQkFBMkI7QUFBQSxFQUFFLENBQUMsVUFBSSx1QkFBdUI7QUFBQSxFQUFFLENBQUMsYUFBSyxTQUFTO0FBQUEsRUFDL0UsQ0FBQyxVQUFJLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLGVBQWU7QUFBQSxFQUMxRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLFVBQUksc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBLEVBQzlFLENBQUMsYUFBSyxtQkFBbUI7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQTtBQUFBLEVBRXJELENBQUMsVUFBSSxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyxhQUFhO0FBQUEsRUFBRSxDQUFDLGFBQUssWUFBWTtBQUFBLEVBQ3BFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUFFLENBQUMsYUFBSyxtQkFBbUI7QUFBQSxFQUFFLENBQUMsYUFBSyxlQUFlO0FBQUE7QUFBQSxFQUV6RSxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFBRSxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFDaEYsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLDRCQUE0QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQ3pGLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQ3RFLENBQUMsYUFBSyxrQkFBa0I7QUFBQSxFQUFFLENBQUMsYUFBSyxjQUFjO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBO0FBQUEsRUFFckUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGNBQWM7QUFBQSxFQUM3RSxDQUFDLGFBQUssWUFBWTtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQSxFQUFFLENBQUMsYUFBSyxhQUFhO0FBQUE7QUFBQSxFQUU5RCxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFBRSxDQUFDLGFBQUssYUFBYTtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQ3pFLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUFFLENBQUMsYUFBSyxhQUFhO0FBQUEsRUFDekUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUN2RSxDQUFDLGFBQUssd0JBQXdCO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLFVBQUksdUJBQXVCO0FBQUEsRUFDckYsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGdCQUFnQjtBQUFBLEVBQ3ZFLENBQUMsYUFBSyx1QkFBdUI7QUFBQSxFQUFFLENBQUMsYUFBSyxvQkFBb0I7QUFBQSxFQUN6RCxDQUFDLGFBQUsseUJBQXlCO0FBQUEsRUFBRSxDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFDcEYsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHlCQUF5QjtBQUFBLEVBQzdELENBQUMsYUFBSyw0QkFBNEI7QUFBQSxFQUFFLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUNoRSxDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFDNUUsQ0FBQyxVQUFJLHVCQUF1QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGVBQWU7QUFBQSxFQUFFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUMzRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLGFBQUsscUJBQXFCO0FBQUE7QUFBQSxFQUV2RCxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssd0JBQXdCO0FBQUEsRUFBRSxDQUFDLGFBQUssY0FBYztBQUFBLEVBQ2xGLENBQUMsVUFBSSxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQUEsRUFBRSxDQUFDLGFBQUssMEJBQTBCO0FBQUEsRUFDbEYsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHNCQUFzQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQ25GLENBQUMsYUFBSyxhQUFhO0FBQUEsRUFBRSxDQUFDLGFBQUssZUFBZTtBQUFBO0FBQUEsRUFFMUMsQ0FBQyxVQUFJLHlCQUF5QjtBQUFBLEVBQUUsQ0FBQyxVQUFJLDZCQUE2QjtBQUFBLEVBQ2xFLENBQUMsVUFBSSx1QkFBdUI7QUFBQSxFQUFFLENBQUMsVUFBSSxlQUFlO0FBQUEsRUFBRSxDQUFDLFVBQUksdUJBQXVCO0FBQUEsRUFDaEYsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLHFCQUFxQjtBQUFBLEVBQ3BGLENBQUMsYUFBSyx5QkFBeUI7QUFBQSxFQUFFLENBQUMsVUFBSSxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyxpQkFBaUI7QUFBQSxFQUNyRixDQUFDLGFBQUssY0FBYztBQUFBLEVBQUUsQ0FBQyxVQUFJLHFCQUFxQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLDZCQUE2QjtBQUFBLEVBQ3JGLENBQUMsYUFBSywyQkFBMkI7QUFBQSxFQUFFLENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUMvRCxDQUFDLGFBQUssc0JBQXNCO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFBRSxDQUFDLGFBQUsscUJBQXFCO0FBQUEsRUFDakYsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBLEVBQUUsQ0FBQyxhQUFLLGlCQUFpQjtBQUFBO0FBQUEsRUFFaEQsQ0FBQyxhQUFLLDRCQUE0QjtBQUFBLEVBQUUsQ0FBQyxhQUFLLG9CQUFvQjtBQUFBLEVBQzlELENBQUMsYUFBSyxzQkFBc0I7QUFBQSxFQUFFLENBQUMsYUFBSyx3QkFBd0I7QUFBQSxFQUM1RCxDQUFDLGFBQUssaUJBQWlCO0FBQUEsRUFBRSxDQUFDLGFBQUssa0JBQWtCO0FBQUEsRUFBRSxDQUFDLFVBQUksY0FBYztBQUFBLEVBQ3RFLENBQUMsYUFBSyxnQkFBZ0I7QUFBQSxFQUFFLENBQUMsYUFBSyxlQUFlO0FBQUEsRUFBRSxDQUFDLGFBQUssZ0JBQWdCO0FBQUEsRUFDckUsQ0FBQyxhQUFLLGtCQUFrQjtBQUFBLEVBQUUsQ0FBQyxVQUFJLHdCQUF3QjtBQUFBLEVBQUUsQ0FBQyxVQUFJLGdCQUFnQjtBQUFBLEVBQzlFLENBQUMsVUFBSSxVQUFVO0FBQUEsRUFBRSxDQUFDLFVBQUksY0FBYztBQUFBLEVBQUUsQ0FBQyxhQUFLLG1CQUFtQjtBQUFBLEVBQy9ELENBQUMsVUFBSSxtQkFBbUI7QUFBQSxFQUFFLENBQUMsVUFBSSxhQUFhO0FBQUEsRUFBRSxDQUFDLFVBQUksWUFBWTtBQUFBLEVBQy9ELENBQUMsVUFBSSxZQUFZO0FBQUEsRUFBRSxDQUFDLGFBQUssb0JBQW9CO0FBQy9DO0FBRUEsSUFBTSxxQkFBTixjQUFpQyxzQkFBTTtBQUFBLEVBQ3JDLFlBQ0UsS0FDUSxVQUNBLE9BQ0EsUUFDUjtBQUNBLFVBQU0sR0FBRztBQUpEO0FBQ0E7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUFDYixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFbkQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLFNBQVMsTUFBTTtBQUVsRCxRQUFJLHdCQUFRLFNBQVMsRUFDbEIsUUFBUSxhQUFhLEVBQ3JCLFFBQVEsdUNBQXVDLEVBQy9DO0FBQUEsTUFBUSxPQUNQLEVBQUUsU0FBUyxPQUFPLE1BQU0sZ0JBQWdCLFdBQVcsTUFBTSxjQUFjLEVBQUUsRUFDdkUsZUFBZSxlQUFlLEVBQzlCLFNBQVMsT0FBSztBQUFFLGNBQU0sY0FBYztBQUFBLE1BQUcsQ0FBQztBQUFBLElBQzVDO0FBR0YsVUFBTSxXQUFXLFVBQVUsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDaEUsYUFBUyxXQUFXLEVBQUUsS0FBSyxxQkFBcUIsTUFBTSxjQUFjLENBQUM7QUFFckUsVUFBTSxXQUFXLFNBQVMsVUFBVSxFQUFFLEtBQUssd0JBQXdCLENBQUM7QUFFcEUsVUFBTSxhQUFhLFNBQVMsU0FBUyxVQUFVLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztBQUM5RSxVQUFNLGdCQUFnQixNQUFNO0FBQzFCLFlBQU0sTUFBTSxPQUFPLE1BQU0sZ0JBQWdCLFdBQVcsTUFBTSxjQUFjO0FBQ3hFLGlCQUFXLE1BQU07QUFDakIsaUJBQVcsV0FBVyxFQUFFLE1BQU0sT0FBTyxTQUFJLENBQUM7QUFDMUMsaUJBQVcsV0FBVyxFQUFFLEtBQUssd0JBQXdCLE1BQU0sU0FBSSxDQUFDO0FBQUEsSUFDbEU7QUFDQSxrQkFBYztBQUVkLFVBQU0sV0FBVyxTQUFTLFNBQVMsVUFBVSxFQUFFLEtBQUssc0JBQXNCLE1BQU0sU0FBSSxDQUFDO0FBQ3JGLGFBQVMsYUFBYSxjQUFjLGFBQWE7QUFFakQsVUFBTSxRQUFRLFVBQVUsVUFBVSxFQUFFLEtBQUsscUJBQXFCLENBQUM7QUFDL0QsVUFBTSxNQUFNLFVBQVU7QUFFdEIsVUFBTSxjQUFjLE1BQU0sU0FBUyxTQUFTO0FBQUEsTUFDMUMsTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLE1BQ0wsYUFBYTtBQUFBLElBQ2YsQ0FBQztBQUVELFVBQU0sU0FBUyxNQUFNLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBRTNELFVBQU0sYUFBYSxDQUFDLFVBQWtCO0FBQ3BDLGFBQU8sTUFBTTtBQUNiLFlBQU0sSUFBSSxNQUFNLFlBQVksRUFBRSxLQUFLO0FBQ25DLFlBQU0sV0FBVyxJQUNiLGlCQUFpQixPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxJQUM1RDtBQUNKLGlCQUFXLENBQUMsS0FBSyxLQUFLLFVBQVU7QUFDOUIsY0FBTSxNQUFNLE9BQU8sU0FBUyxVQUFVLEVBQUUsS0FBSyxhQUFhLE1BQU0sTUFBTSxDQUFDO0FBQ3ZFLFlBQUksTUFBTSxnQkFBZ0IsTUFBTyxLQUFJLFNBQVMsYUFBYTtBQUMzRCxZQUFJLGlCQUFpQixTQUFTLE1BQU07QUFDbEMsZ0JBQU0sY0FBYztBQUNwQix3QkFBYztBQUNkLGdCQUFNLE1BQU0sVUFBVTtBQUN0QixzQkFBWSxRQUFRO0FBQ3BCLHFCQUFXLEVBQUU7QUFBQSxRQUNmLENBQUM7QUFBQSxNQUNIO0FBQ0EsVUFBSSxTQUFTLFdBQVcsR0FBRztBQUN6QixlQUFPLFdBQVcsRUFBRSxLQUFLLHNCQUFzQixNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQ3JFO0FBQUEsSUFDRjtBQUNBLGVBQVcsRUFBRTtBQUViLGdCQUFZLGlCQUFpQixTQUFTLE1BQU0sV0FBVyxZQUFZLEtBQUssQ0FBQztBQUV6RSxlQUFXLGlCQUFpQixTQUFTLE1BQU07QUFDekMsWUFBTSxPQUFPLE1BQU0sTUFBTSxZQUFZO0FBQ3JDLFlBQU0sTUFBTSxVQUFVLE9BQU8sU0FBUztBQUN0QyxVQUFJLENBQUMsS0FBTSxZQUFXLE1BQU0sWUFBWSxNQUFNLEdBQUcsQ0FBQztBQUFBLElBQ3BELENBQUM7QUFFRCxhQUFTLGlCQUFpQixTQUFTLE1BQU07QUFDdkMsWUFBTSxjQUFjO0FBQ3BCLG9CQUFjO0FBQ2QsWUFBTSxNQUFNLFVBQVU7QUFDdEIsa0JBQVksUUFBUTtBQUNwQixpQkFBVyxFQUFFO0FBQUEsSUFDZixDQUFDO0FBR0QsUUFBSSx3QkFBUSxTQUFTLEVBQ2xCLFFBQVEsWUFBWSxFQUNwQjtBQUFBLE1BQVUsT0FDVCxFQUFFLFNBQVMsTUFBTSxlQUFlLElBQUksRUFDbEMsU0FBUyxPQUFLO0FBQUUsY0FBTSxhQUFhO0FBQUEsTUFBRyxDQUFDO0FBQUEsSUFDM0M7QUFFRixRQUFJLGNBQWMsS0FBSyxTQUFTLFdBQVc7QUFDM0MsUUFBSSx3QkFBUSxTQUFTLEVBQ2xCLFFBQVEsa0JBQWtCLEVBQzFCLFFBQVEseUNBQXlDLEVBQ2pEO0FBQUEsTUFBVSxPQUNULEVBQUUsU0FBUyxXQUFXLEVBQ3BCLFNBQVMsT0FBSztBQUFFLHNCQUFjO0FBQUEsTUFBRyxDQUFDO0FBQUEsSUFDdEM7QUFFRixRQUFJLHdCQUFRLFNBQVMsRUFDbEI7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQUssU0FBUyxTQUFTLGVBQWU7QUFDdEMsYUFBSyxPQUFPO0FBQ1osYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSCxFQUNDO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxRQUFRLEVBQUUsUUFBUSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQUEsSUFDeEQ7QUFFRixVQUFNLEtBQUssVUFBVSxTQUFTLElBQUk7QUFDbEMsT0FBRyxNQUFNLFNBQVM7QUFFbEIsY0FBVSxTQUFTLEtBQUs7QUFBQSxNQUN0QixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsSUFDUCxDQUFDO0FBRUQsUUFBSSx3QkFBUSxTQUFTLEVBQ2xCO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxvQkFBb0IsRUFBRSxRQUFRLE1BQU07QUFDcEQsYUFBSyxNQUFNO0FBQ1gsYUFBSyxNQUFNLGFBQWEsS0FBSyxNQUFNO0FBQUEsTUFDckMsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNKO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1QztBQUlBLElBQU0sMEJBQU4sY0FBc0Msc0JBQU07QUFBQSxFQUMxQyxZQUFZLEtBQWtCLFdBQXVCO0FBQ25ELFVBQU0sR0FBRztBQURtQjtBQUFBLEVBRTlCO0FBQUEsRUFFQSxTQUFlO0FBQ2IsVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2xELGNBQVUsU0FBUyxLQUFLLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixRQUFJLHdCQUFRLFNBQVMsRUFDbEI7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxNQUFNO0FBQ3JELGFBQUssVUFBVTtBQUNmLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0gsRUFDQztBQUFBLE1BQVUsU0FDVCxJQUFJLGNBQWMsUUFBUSxFQUFFLFFBQVEsTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUFBLElBQ3hEO0FBQUEsRUFDSjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBRWh2QkEsSUFBQUMsbUJBQTJCO0FBS3BCLElBQU0sY0FBTixNQUFrQjtBQUFBLEVBS3ZCLFlBQ1UsYUFDQSxLQUNBLFFBQ0EsTUFDQSxpQkFDUjtBQUxRO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFQVixTQUFRLFdBQVc7QUFVakIsU0FBSyxRQUFRLFlBQVksVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFDL0QsU0FBSyxNQUFNLGFBQWEsUUFBUSxRQUFRO0FBQ3hDLFNBQUssTUFBTSxhQUFhLFlBQVksR0FBRztBQUN2QyxTQUFLLE1BQU0sYUFBYSxjQUFjLGlCQUFpQjtBQUN2RCxTQUFLLE1BQU0sUUFBUSxRQUFHO0FBQ3RCLFNBQUssTUFBTSxpQkFBaUIsU0FBUyxNQUFNLEtBQUssZUFBZSxDQUFDO0FBQ2hFLFNBQUssTUFBTSxpQkFBaUIsV0FBVyxDQUFDLE1BQXFCO0FBQzNELFVBQUksRUFBRSxRQUFRLFdBQVcsRUFBRSxRQUFRLEtBQUs7QUFBRSxVQUFFLGVBQWU7QUFBRyxhQUFLLGVBQWU7QUFBQSxNQUFHO0FBQUEsSUFDdkYsQ0FBQztBQUVELFNBQUssWUFBWSxZQUFZLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ2xFLFNBQUssVUFBVSxhQUFhLFFBQVEsU0FBUztBQUM3QyxTQUFLLFVBQVUsYUFBYSxjQUFjLGtCQUFrQjtBQUM1RCxTQUFLLGNBQWM7QUFBQSxFQUNyQjtBQUFBO0FBQUEsRUFHQSxpQkFBdUI7QUFDckIsU0FBSyxXQUFXLENBQUMsS0FBSztBQUN0QixTQUFLLEtBQUssWUFBWSxLQUFLLFFBQVE7QUFDbkMsU0FBSyxlQUFlO0FBQ3BCLFNBQUssY0FBYztBQUFBLEVBQ3JCO0FBQUEsRUFFUSxpQkFBdUI7QUFHN0IsU0FBSyxNQUFNLFlBQVksYUFBYSxLQUFLLFFBQVE7QUFDakQsU0FBSyxVQUFVLFlBQVksY0FBYyxLQUFLLFFBQVE7QUFBQSxFQUN4RDtBQUFBLEVBRVEsZ0JBQXNCO0FBQzVCLFNBQUssVUFBVSxNQUFNO0FBR3JCLFVBQU0sWUFBWSxLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssb0NBQW9DLENBQUM7QUFDdkYsY0FBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUMvQyxjQUFVLFdBQVcsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUd4QyxVQUFNLFlBQVksS0FBSyxVQUFVLFNBQVMsVUFBVSxFQUFFLEtBQUsscUJBQXFCLENBQUM7QUFDakYsY0FBVSxhQUFhLGNBQWMsbUJBQW1CO0FBQ3hELEtBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxRQUFRLE9BQUs7QUFDckIsWUFBTSxNQUFNLFVBQVUsU0FBUyxVQUFVLEVBQUUsT0FBTyxPQUFPLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUM7QUFDL0UsVUFBSSxNQUFNLEtBQUssT0FBTyxPQUFPLFFBQVMsS0FBSSxXQUFXO0FBQUEsSUFDdkQsQ0FBQztBQUNELGNBQVUsaUJBQWlCLFVBQVUsTUFBTTtBQUN6QyxXQUFLLGdCQUFnQixPQUFPLFVBQVUsS0FBSyxDQUFDO0FBQUEsSUFDOUMsQ0FBQztBQUdELFVBQU0sU0FBUyxLQUFLLFVBQVUsU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsTUFBTSxjQUFjLENBQUM7QUFDaEcsV0FBTyxpQkFBaUIsU0FBUyxNQUFNO0FBQUUsV0FBSyxrQkFBa0I7QUFBQSxJQUFHLENBQUM7QUFHcEUsVUFBTSxVQUFVLEtBQUssVUFBVSxTQUFTLFVBQVUsRUFBRSxLQUFLLHVDQUF1QyxNQUFNLGNBQVMsQ0FBQztBQUNoSCxZQUFRLGlCQUFpQixTQUFTLE1BQU0sS0FBSyxlQUFlLENBQUM7QUFHN0QsU0FBSyxLQUFLLG9CQUFvQixNQUFNO0FBQUUsV0FBSyxrQkFBa0I7QUFBQSxJQUFHO0FBQUEsRUFDbEU7QUFBQTtBQUFBLEVBR1Esb0JBQTBCO0FBQ2hDLFFBQUksY0FBYyxLQUFLLEtBQUssQ0FBQyxTQUFTO0FBQ3BDLFlBQU0sVUFBVSxjQUFjLElBQUksSUFBSTtBQUN0QyxVQUFJLENBQUMsUUFBUztBQUVkLFlBQU0sU0FBUyxLQUFLLE9BQU8sT0FBTyxPQUFPO0FBQUEsUUFDdkMsQ0FBQyxLQUFLLE1BQU0sS0FBSyxJQUFJLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQ3BEO0FBRUEsWUFBTSxXQUEwQjtBQUFBLFFBQzlCLElBQUksT0FBTyxXQUFXO0FBQUEsUUFDdEI7QUFBQSxRQUNBLEtBQUs7QUFBQSxRQUNMLEtBQUssU0FBUztBQUFBLFFBQ2QsU0FBUyxLQUFLLElBQUksUUFBUSxZQUFZLFNBQVMsS0FBSyxPQUFPLE9BQU8sT0FBTztBQUFBLFFBQ3pFLFNBQVMsUUFBUSxZQUFZO0FBQUEsUUFDN0IsUUFBUSxFQUFFLEdBQUcsUUFBUSxjQUFjO0FBQUEsTUFDckM7QUFFQSxXQUFLLEtBQUssU0FBUyxRQUFRO0FBQUEsSUFDN0IsQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNWO0FBQUEsRUFFQSxhQUEwQjtBQUN4QixXQUFPLEtBQUs7QUFBQSxFQUNkO0FBQUEsRUFFQSxnQkFBNkI7QUFDM0IsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxTQUFLLEtBQUssb0JBQW9CO0FBQzlCLFNBQUssTUFBTSxPQUFPO0FBQ2xCLFNBQUssVUFBVSxPQUFPO0FBQUEsRUFDeEI7QUFDRjtBQUVBLElBQU0sYUFBZ0U7QUFBQSxFQUNwRSxZQUFpQixFQUFFLE1BQU0sYUFBYSxNQUFNLHlDQUF5QztBQUFBLEVBQ3JGLFNBQWlCLEVBQUUsTUFBTSxhQUFhLE1BQU0sK0JBQStCO0FBQUEsRUFDM0UsZ0JBQWlCLEVBQUUsTUFBTSxhQUFhLE1BQU0sbUNBQW1DO0FBQUEsRUFDL0UsV0FBaUIsRUFBRSxNQUFNLGFBQWEsTUFBTSxpQ0FBaUM7QUFBQSxFQUM3RSxZQUFpQixFQUFFLE1BQU0sbUJBQW1CLE1BQU0sZ0NBQWdDO0FBQUEsRUFDbEYsZUFBaUIsRUFBRSxNQUFNLGFBQWEsTUFBTSxrQ0FBa0M7QUFBQSxFQUM5RSxpQkFBaUIsRUFBRSxNQUFNLG1CQUFtQixNQUFNLGlDQUFpQztBQUFBLEVBQ25GLGlCQUFpQixFQUFFLE1BQU0sYUFBYSxNQUFNLG1DQUFtQztBQUFBLEVBQy9FLGVBQWlCLEVBQUUsTUFBTSxhQUFhLE1BQU0seUNBQXlDO0FBQUEsRUFDckYsUUFBaUIsRUFBRSxNQUFNLE9BQU8sTUFBTSxrQ0FBa0M7QUFDMUU7QUFFQSxJQUFNLGdCQUFOLGNBQTRCLHVCQUFNO0FBQUEsRUFDaEMsWUFDRSxLQUNRLFVBQ1I7QUFDQSxVQUFNLEdBQUc7QUFGRDtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUE1SWpCO0FBNklJLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxhQUFhLEtBQUssd0JBQXdCLENBQUM7QUFFNUUsVUFBTSxPQUFPLFVBQVUsVUFBVSxFQUFFLEtBQUssaUJBQWlCLENBQUM7QUFFMUQsZUFBVyxXQUFXLGNBQWMsT0FBTyxHQUFHO0FBQzVDLFlBQU0sT0FBTyxXQUFXLFFBQVEsSUFBSTtBQUNwQyxZQUFNLE1BQU0sS0FBSyxTQUFTLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQy9ELFVBQUksV0FBVyxFQUFFLEtBQUssa0JBQWtCLE9BQU0sa0NBQU0sU0FBTixZQUFjLFNBQVMsQ0FBQztBQUN0RSxVQUFJLFdBQVcsRUFBRSxLQUFLLGtCQUFrQixNQUFNLFFBQVEsWUFBWSxDQUFDO0FBQ25FLFVBQUksNkJBQU0sTUFBTTtBQUNkLFlBQUksV0FBVyxFQUFFLEtBQUssa0JBQWtCLE1BQU0sS0FBSyxLQUFLLENBQUM7QUFBQSxNQUMzRDtBQUNBLFVBQUksaUJBQWlCLFNBQVMsTUFBTTtBQUNsQyxhQUFLLFNBQVMsUUFBUSxJQUFJO0FBQzFCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FIOUpPLElBQU0sWUFBWTtBQUVsQixJQUFNLGVBQU4sY0FBMkIsMEJBQVM7QUFBQSxFQUl6QyxZQUFZLE1BQTZCLFFBQXlCO0FBQ2hFLFVBQU0sSUFBSTtBQUQ2QjtBQUh6QyxTQUFRLE9BQTBCO0FBQ2xDLFNBQVEsVUFBOEI7QUFBQSxFQUl0QztBQUFBLEVBRUEsY0FBc0I7QUFBRSxXQUFPO0FBQUEsRUFBVztBQUFBLEVBQzFDLGlCQUF5QjtBQUFFLFdBQU87QUFBQSxFQUFZO0FBQUEsRUFDOUMsVUFBa0I7QUFBRSxXQUFPO0FBQUEsRUFBUTtBQUFBLEVBRW5DLE1BQU0sU0FBd0I7QUFuQmhDO0FBcUJJLGVBQUssU0FBTCxtQkFBVztBQUNYLGVBQUssWUFBTCxtQkFBYztBQUVkLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxlQUFlO0FBRWxDLFVBQU0sU0FBdUIsS0FBSyxPQUFPO0FBRXpDLFVBQU0saUJBQWlCLENBQUMsY0FBNEI7QUFDbEQsV0FBSyxPQUFPLFNBQVM7QUFDckIsV0FBSyxLQUFLLE9BQU8sV0FBVyxTQUFTO0FBQUEsSUFDdkM7QUFFQSxTQUFLLE9BQU8sSUFBSSxXQUFXLFdBQVcsS0FBSyxLQUFLLEtBQUssUUFBUSxjQUFjO0FBRTNFLFNBQUssVUFBVSxJQUFJO0FBQUEsTUFDakI7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFBQSxNQUNMLENBQUMsWUFBWTtBQTFDbkIsWUFBQUM7QUEwQ3FCLFNBQUFBLE1BQUEsS0FBSyxTQUFMLGdCQUFBQSxJQUFXLFdBQVc7QUFBQSxNQUFVO0FBQUEsSUFDakQ7QUFHQSxjQUFVLGFBQWEsS0FBSyxRQUFRLFdBQVcsR0FBRyxLQUFLLEtBQUssV0FBVyxDQUFDO0FBQ3hFLGNBQVUsYUFBYSxLQUFLLFFBQVEsY0FBYyxHQUFHLEtBQUssUUFBUSxXQUFXLENBQUM7QUFFOUUsU0FBSyxLQUFLLE9BQU8sT0FBTyxRQUFRLE9BQU8sU0FBUyxJQUFJO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLE1BQU0sVUFBeUI7QUFwRGpDO0FBcURJLGVBQUssU0FBTCxtQkFBVztBQUNYLGVBQUssWUFBTCxtQkFBYztBQUFBLEVBQ2hCO0FBQUE7QUFBQSxFQUdBLGlCQUF1QjtBQTFEekI7QUEyREksZUFBSyxZQUFMLG1CQUFjO0FBQUEsRUFDaEI7QUFBQTtBQUFBLEVBR0EsTUFBTSxTQUF3QjtBQUM1QixVQUFNLEtBQUssT0FBTztBQUFBLEVBQ3BCO0FBQ0Y7OztBSWxFQSxJQUFBQyxtQkFBNEM7OztBQ0E1QyxJQUFBQyxtQkFBK0I7QUFHeEIsSUFBZSxZQUFmLGNBQWlDLDJCQUFVO0FBQUEsRUFHaEQsWUFDWSxLQUNBLFVBQ0EsUUFDVjtBQUNBLFVBQU07QUFKSTtBQUNBO0FBQ0E7QUFMWixTQUFRLG1CQUF1QztBQUFBLEVBUS9DO0FBQUE7QUFBQSxFQUtBLGFBQWEsU0FBMkI7QUFBQSxFQUFDO0FBQUE7QUFBQSxFQUd6QyxtQkFBbUIsSUFBdUI7QUFDeEMsU0FBSyxtQkFBbUI7QUFBQSxFQUMxQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS1UsYUFBYSxJQUFpQixPQUFxQjtBQTNCL0Q7QUE0QkksVUFBTSxNQUFNLEtBQUssU0FBUztBQUMxQixRQUFJLElBQUksZUFBZSxLQUFNO0FBQzdCLFVBQU0sUUFBUyxPQUFPLElBQUksZ0JBQWdCLFlBQVksSUFBSSxZQUFZLEtBQUssSUFDdkUsSUFBSSxZQUFZLEtBQUssSUFDckI7QUFDSixRQUFJLENBQUMsTUFBTztBQUNaLFVBQU0sYUFBWSxVQUFLLHFCQUFMLFlBQXlCO0FBQzNDLFVBQU0sU0FBUyxVQUFVLFVBQVUsRUFBRSxLQUFLLGVBQWUsQ0FBQztBQUMxRCxRQUFJLE9BQU8sSUFBSSxnQkFBZ0IsWUFBWSxJQUFJLGFBQWE7QUFDMUQsYUFBTyxXQUFXLEVBQUUsS0FBSyxzQkFBc0IsTUFBTSxJQUFJLFlBQVksQ0FBQztBQUFBLElBQ3hFO0FBQ0EsV0FBTyxXQUFXLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFBQSxFQUNuQztBQUNGOzs7QURyQ08sSUFBTSxnQkFBTixjQUE0QixVQUFVO0FBQUEsRUFBdEM7QUFBQTtBQUNMLFNBQVEsU0FBNkI7QUFDckMsU0FBUSxTQUE2QjtBQUFBO0FBQUEsRUFFckMsT0FBTyxJQUF1QjtBQUM1QixPQUFHLFNBQVMsZ0JBQWdCO0FBRTVCLFVBQU0sRUFBRSxXQUFXLEtBQUssSUFBSSxLQUFLLFNBQVM7QUFFMUMsUUFBSSxVQUFVO0FBQ1osV0FBSyxTQUFTLEdBQUcsVUFBVSxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFBQSxJQUNyRDtBQUNBLFNBQUssU0FBUyxHQUFHLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBRW5ELFNBQUssS0FBSztBQUNWLFNBQUssaUJBQWlCLE9BQU8sWUFBWSxNQUFNLEtBQUssS0FBSyxHQUFHLEdBQUksQ0FBQztBQUFBLEVBQ25FO0FBQUEsRUFFUSxPQUFhO0FBQ25CLFVBQU0sVUFBTSx5QkFBTztBQUNuQixVQUFNLE9BQU8sSUFBSSxLQUFLO0FBQ3RCLFVBQU0sRUFBRSxPQUFPLGNBQWMsV0FBVyxLQUFLLElBQUksS0FBSyxTQUFTO0FBSy9ELFVBQU0sYUFDSixRQUFRLEtBQUssT0FBTyxLQUFLLGVBQ3pCLFFBQVEsTUFBTSxPQUFPLEtBQUssb0JBQzFCO0FBRUYsUUFBSSxLQUFLLFVBQVUsVUFBVTtBQUMzQixXQUFLLE9BQU8sUUFBUSxJQUFJLE9BQU8sT0FBTyxDQUFDO0FBQUEsSUFDekM7QUFDQSxRQUFJLEtBQUssUUFBUTtBQUNmLFdBQUssT0FBTyxRQUFRLEdBQUcsVUFBVSxLQUFLLElBQUksRUFBRTtBQUFBLElBQzlDO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLHNCQUFzQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxjQUFjO0FBQ3ZFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSx3QkFBTixjQUFvQyx1QkFBTTtBQUFBLEVBQ3hDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUV0RCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLE1BQU0sRUFBRTtBQUFBLE1BQVEsT0FBRTtBQW5FckQ7QUFvRU0saUJBQUUsVUFBUyxXQUFNLFNBQU4sWUFBd0IsWUFBWSxFQUM3QyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxPQUFPO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUNyQztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFLFFBQVEsV0FBVyxFQUFFO0FBQUEsTUFBVSxPQUFFO0FBdkU1RDtBQXdFTSxpQkFBRSxVQUFTLFdBQU0sYUFBTixZQUE2QixJQUFJLEVBQzFDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFdBQVc7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3pDO0FBQ0EsUUFBSSx5QkFBUSxTQUFTLEVBQUU7QUFBQSxNQUFVLFNBQy9CLElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLE9BQU8sS0FBSztBQUNqQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBRXBGQSxJQUFBQyxtQkFBNEM7QUFJckMsSUFBTSxhQUFOLGNBQXlCLFVBQVU7QUFBQSxFQUFuQztBQUFBO0FBQ0wsU0FBUSxTQUE2QjtBQUNyQyxTQUFRLFNBQTZCO0FBQUE7QUFBQSxFQUVyQyxPQUFPLElBQXVCO0FBQzVCLE9BQUcsU0FBUyxhQUFhO0FBRXpCLFVBQU0sRUFBRSxXQUFXLEtBQUssSUFBSSxLQUFLLFNBQVM7QUFFMUMsU0FBSyxTQUFTLEdBQUcsVUFBVSxFQUFFLEtBQUssYUFBYSxDQUFDO0FBQ2hELFFBQUksVUFBVTtBQUNaLFdBQUssU0FBUyxHQUFHLFVBQVUsRUFBRSxLQUFLLGFBQWEsQ0FBQztBQUFBLElBQ2xEO0FBRUEsU0FBSyxLQUFLO0FBQ1YsU0FBSyxpQkFBaUIsT0FBTyxZQUFZLE1BQU0sS0FBSyxLQUFLLEdBQUcsR0FBSSxDQUFDO0FBQUEsRUFDbkU7QUFBQSxFQUVRLE9BQWE7QUFDbkIsVUFBTSxVQUFNLHlCQUFPO0FBQ25CLFVBQU0sRUFBRSxjQUFjLE9BQU8sV0FBVyxNQUFNLFNBQVMsR0FBRyxJQUFJLEtBQUssU0FBUztBQU01RSxRQUFJLEtBQUssUUFBUTtBQUNmLFVBQUksUUFBUTtBQUNWLGFBQUssT0FBTyxRQUFRLElBQUksT0FBTyxNQUFNLENBQUM7QUFBQSxNQUN4QyxPQUFPO0FBQ0wsYUFBSyxPQUFPLFFBQVEsSUFBSSxPQUFPLGNBQWMsYUFBYSxPQUFPLENBQUM7QUFBQSxNQUNwRTtBQUFBLElBQ0Y7QUFDQSxRQUFJLEtBQUssVUFBVSxVQUFVO0FBQzNCLFdBQUssT0FBTyxRQUFRLElBQUksT0FBTyxtQkFBbUIsQ0FBQztBQUFBLElBQ3JEO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLG1CQUFtQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxjQUFjO0FBQ3BFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSxxQkFBTixjQUFpQyx1QkFBTTtBQUFBLEVBQ3JDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUVuRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLGNBQWMsRUFBRTtBQUFBLE1BQVUsT0FBRTtBQWxFL0Q7QUFtRU0saUJBQUUsVUFBUyxXQUFNLGdCQUFOLFlBQWdDLEtBQUssRUFDOUMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sY0FBYztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDNUM7QUFDQSxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRTtBQUFBLE1BQVUsT0FBRTtBQXRFNUQ7QUF1RU0saUJBQUUsVUFBUyxXQUFNLGFBQU4sWUFBNkIsSUFBSSxFQUMxQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxXQUFXO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN6QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUNsQixRQUFRLGVBQWUsRUFDdkIsUUFBUSwwRUFBMEUsRUFDbEY7QUFBQSxNQUFRLE9BQUU7QUE3RWpCO0FBOEVRLGlCQUFFLFVBQVMsV0FBTSxXQUFOLFlBQTBCLEVBQUUsRUFDckMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sU0FBUztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDdkM7QUFDRixRQUFJLHlCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FDMUZBLElBQUFDLG1CQUEyRDtBQVkzRCxJQUFNLHFCQUFOLGNBQWlDLDhCQUFzQjtBQUFBLEVBQ3JELFlBQVksS0FBa0IsVUFBcUM7QUFDakUsVUFBTSxHQUFHO0FBRG1CO0FBRTVCLFNBQUssZUFBZSxvQ0FBK0I7QUFBQSxFQUNyRDtBQUFBLEVBRVEsZ0JBQTJCO0FBQ2pDLFVBQU0sVUFBcUIsQ0FBQztBQUM1QixVQUFNLFVBQVUsQ0FBQyxNQUFlO0FBQzlCLGNBQVEsS0FBSyxDQUFDO0FBQ2QsaUJBQVcsU0FBUyxFQUFFLFVBQVU7QUFDOUIsWUFBSSxpQkFBaUIseUJBQVMsU0FBUSxLQUFLO0FBQUEsTUFDN0M7QUFBQSxJQUNGO0FBQ0EsWUFBUSxLQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUFDaEMsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLGVBQWUsT0FBMEI7QUFDdkMsVUFBTSxJQUFJLE1BQU0sWUFBWTtBQUM1QixXQUFPLEtBQUssY0FBYyxFQUFFLE9BQU8sT0FBSyxFQUFFLEtBQUssWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDMUU7QUFBQSxFQUVBLGlCQUFpQixRQUFpQixJQUF1QjtBQUN2RCxPQUFHLFNBQVMsUUFBUSxFQUFFLE1BQU0sT0FBTyxTQUFTLE1BQU0sbUJBQW1CLE9BQU8sS0FBSyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVBLG1CQUFtQixRQUF1QjtBQUFFLFNBQUssU0FBUyxNQUFNO0FBQUEsRUFBRztBQUNyRTtBQUlPLElBQU0sbUJBQU4sY0FBK0IsVUFBVTtBQUFBLEVBQXpDO0FBQUE7QUFDTCxTQUFRLGNBQWtDO0FBQzFDLFNBQVEsY0FBNkI7QUFBQTtBQUFBLEVBRXJDLE9BQU8sSUFBdUI7QUFDNUIsU0FBSyxjQUFjO0FBQ25CLE9BQUcsU0FBUyxvQkFBb0I7QUFHaEMsU0FBSyxjQUFjLEtBQUssSUFBSSxNQUFNLEdBQUcsVUFBVSxNQUFNLEtBQUssZUFBZSxDQUFDLENBQUM7QUFDM0UsU0FBSyxjQUFjLEtBQUssSUFBSSxNQUFNLEdBQUcsVUFBVSxNQUFNLEtBQUssZUFBZSxDQUFDLENBQUM7QUFDM0UsU0FBSyxjQUFjLEtBQUssSUFBSSxNQUFNLEdBQUcsVUFBVSxNQUFNLEtBQUssZUFBZSxDQUFDLENBQUM7QUFHM0UsU0FBSyxJQUFJLFVBQVUsY0FBYyxNQUFNLEtBQUssY0FBYyxDQUFDO0FBQUEsRUFDN0Q7QUFBQSxFQUVRLGlCQUF1QjtBQUM3QixRQUFJLEtBQUssZ0JBQWdCLEtBQU0sUUFBTyxhQUFhLEtBQUssV0FBVztBQUNuRSxTQUFLLGNBQWMsT0FBTyxXQUFXLE1BQU07QUFDekMsV0FBSyxjQUFjO0FBQ25CLFdBQUssY0FBYztBQUFBLElBQ3JCLEdBQUcsR0FBRztBQUFBLEVBQ1I7QUFBQSxFQUVRLGdCQUFzQjtBQUM1QixVQUFNLEtBQUssS0FBSztBQUNoQixRQUFJLENBQUMsR0FBSTtBQUNULE9BQUcsTUFBTTtBQUVULFVBQU0sRUFBRSxRQUFRLGVBQWUsU0FBUyxJQUFJLFFBQVEsQ0FBQyxFQUFFLElBQUksS0FBSyxTQUFTO0FBTXpFLFNBQUssYUFBYSxJQUFJLEtBQUs7QUFFM0IsVUFBTSxPQUFPLEdBQUcsVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFHdEQsUUFBSSxRQUFRO0FBQ1YsWUFBTSxhQUFhLE9BQU8sS0FBSyxFQUFFLFFBQVEsUUFBUSxFQUFFO0FBRW5ELFVBQUksQ0FBQyxZQUFZO0FBQ2YsYUFBSyxTQUFTLEtBQUssRUFBRSxNQUFNLDREQUE0RCxLQUFLLGdCQUFnQixDQUFDO0FBQUEsTUFDL0csT0FBTztBQUNMLGNBQU0sWUFBWSxLQUFLLElBQUksTUFBTSxzQkFBc0IsVUFBVTtBQUVqRSxZQUFJLEVBQUUscUJBQXFCLDJCQUFVO0FBQ25DLGVBQUssU0FBUyxLQUFLLEVBQUUsTUFBTSxXQUFXLFVBQVUsZ0JBQWdCLEtBQUssZ0JBQWdCLENBQUM7QUFBQSxRQUN4RixPQUFPO0FBQ0wsZ0JBQU0sU0FBUyxVQUFVLE9BQU87QUFDaEMsZ0JBQU0sUUFBUSxLQUFLLElBQUksTUFBTSxTQUFTLEVBQ25DLE9BQU8sT0FBSyxFQUFFLEtBQUssV0FBVyxNQUFNLENBQUMsRUFDckMsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFNBQVMsY0FBYyxFQUFFLFFBQVEsQ0FBQztBQUV0RCxxQkFBVyxRQUFRLE9BQU87QUFDeEIsa0JBQU0sT0FBTyxLQUFLLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3ZELGtCQUFNLE1BQU0sS0FBSyxTQUFTLFVBQVUsRUFBRSxLQUFLLGtCQUFrQixDQUFDO0FBQzlELGdCQUFJLFdBQVcsRUFBRSxNQUFNLEtBQUssU0FBUyxDQUFDO0FBQ3RDLGdCQUFJLGlCQUFpQixTQUFTLE1BQU07QUFDbEMsbUJBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxNQUFNLEVBQUU7QUFBQSxZQUMvQyxDQUFDO0FBQUEsVUFDSDtBQUVBLGNBQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsaUJBQUssU0FBUyxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsVUFBVSxJQUFJLE1BQU0sS0FBSyxnQkFBZ0IsQ0FBQztBQUFBLFVBQ3ZGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBR0EsZUFBVyxRQUFRLE9BQU87QUFDeEIsWUFBTSxPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDdkQsWUFBTSxNQUFNLEtBQUssU0FBUyxVQUFVLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQztBQUM5RCxVQUFJLEtBQUssT0FBTztBQUNkLFlBQUksV0FBVyxFQUFFLEtBQUssY0FBYyxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQUEsTUFDeEQ7QUFDQSxVQUFJLFdBQVcsRUFBRSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ25DLFVBQUksaUJBQWlCLFNBQVMsTUFBTTtBQUNsQyxhQUFLLElBQUksVUFBVSxhQUFhLEtBQUssTUFBTSxFQUFFO0FBQUEsTUFDL0MsQ0FBQztBQUFBLElBQ0g7QUFFQSxRQUFJLENBQUMsVUFBVSxNQUFNLFdBQVcsR0FBRztBQUNqQyxZQUFNLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN2RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLFlBQVksQ0FBQztBQUNsRSxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLCtEQUErRCxDQUFDO0FBQUEsSUFDdkg7QUFBQSxFQUNGO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFFBQUksS0FBSyxnQkFBZ0IsTUFBTTtBQUM3QixhQUFPLGFBQWEsS0FBSyxXQUFXO0FBQ3BDLFdBQUssY0FBYztBQUFBLElBQ3JCO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJO0FBQUEsTUFDRixLQUFLO0FBQUEsTUFDTCxLQUFLLFNBQVM7QUFBQSxNQUNkLENBQUMsY0FBYztBQUNiLGFBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQUssY0FBYztBQUNuQixlQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0YsRUFBRSxLQUFLO0FBQUEsRUFDVDtBQUNGO0FBSUEsSUFBTSwyQkFBTixjQUF1Qyx1QkFBTTtBQUFBLEVBQzNDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQXhLakI7QUF5S0ksVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXpELFVBQU0sUUFBaUUsZ0JBQWdCLEtBQUssTUFBTTtBQUNsRyxnQkFBTSxVQUFOLGtCQUFNLFFBQVUsQ0FBQztBQUNqQixVQUFNLFFBQVEsTUFBTTtBQUVwQixRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQWpMNUQsWUFBQUM7QUFrTE0saUJBQUUsVUFBU0EsTUFBQSxNQUFNLFVBQU4sT0FBQUEsTUFBZSxhQUFhLEVBQ3JDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFFBQVE7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3RDO0FBRUEsUUFBSTtBQUNKLFFBQUkseUJBQVEsU0FBUyxFQUNsQixRQUFRLGtCQUFrQixFQUMxQixRQUFRLGlEQUFpRCxFQUN6RCxRQUFRLE9BQUs7QUExTHBCLFVBQUFBO0FBMkxRLG1CQUFhO0FBQ2IsUUFBRSxVQUFTQSxNQUFBLE1BQU0sV0FBTixPQUFBQSxNQUFnQixFQUFFLEVBQzNCLGVBQWUsZUFBZSxFQUM5QixTQUFTLE9BQUs7QUFBRSxjQUFNLFNBQVM7QUFBQSxNQUFHLENBQUM7QUFBQSxJQUN2QyxDQUFDLEVBQ0E7QUFBQSxNQUFVLFNBQ1QsSUFBSSxRQUFRLFFBQVEsRUFBRSxXQUFXLHNCQUFzQixFQUFFLFFBQVEsTUFBTTtBQUNyRSxZQUFJLG1CQUFtQixLQUFLLEtBQUssQ0FBQyxXQUFXO0FBQzNDLGdCQUFNLE9BQU8sT0FBTyxTQUFTLE1BQU0sS0FBSyxPQUFPO0FBQy9DLGdCQUFNLFNBQVM7QUFDZixxQkFBVyxTQUFTLElBQUk7QUFBQSxRQUMxQixDQUFDLEVBQUUsS0FBSztBQUFBLE1BQ1YsQ0FBQztBQUFBLElBQ0g7QUFFRixjQUFVLFNBQVMsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRWpELFVBQU0saUJBQWlCLFVBQVUsVUFBVTtBQUUzQyxVQUFNLGNBQWMsTUFBTTtBQUN4QixxQkFBZSxNQUFNO0FBQ3JCLFlBQU0sUUFBUSxDQUFDLE1BQU0sTUFBTTtBQUN6QixjQUFNLE1BQU0sZUFBZSxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUNqRSxZQUFJLHlCQUFRLEdBQUcsRUFDWixRQUFRLFFBQVEsSUFBSSxDQUFDLEVBQUUsRUFDdkIsUUFBUSxPQUFLLEVBQUUsZUFBZSxPQUFPLEVBQUUsU0FBUyxLQUFLLEtBQUssRUFBRSxTQUFTLE9BQUs7QUFBRSxnQkFBTSxDQUFDLEVBQUUsUUFBUTtBQUFBLFFBQUcsQ0FBQyxDQUFDLEVBQ2xHLFFBQVEsT0FBSyxFQUFFLGVBQWUsTUFBTSxFQUFFLFNBQVMsS0FBSyxJQUFJLEVBQUUsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sQ0FBQyxFQUFFLE9BQU87QUFBQSxRQUFHLENBQUMsQ0FBQyxFQUMvRixRQUFRLE9BQUU7QUF0TnJCLGNBQUFBO0FBc053QixtQkFBRSxlQUFlLE9BQU8sRUFBRSxVQUFTQSxNQUFBLEtBQUssVUFBTCxPQUFBQSxNQUFjLEVBQUUsRUFBRSxTQUFTLE9BQUs7QUFBRSxrQkFBTSxDQUFDLEVBQUUsUUFBUSxLQUFLO0FBQUEsVUFBVyxDQUFDO0FBQUEsU0FBQyxFQUNySCxVQUFVLFNBQU8sSUFBSSxRQUFRLE9BQU8sRUFBRSxXQUFXLFFBQVEsRUFBRSxRQUFRLE1BQU07QUFDeEUsZ0JBQU0sT0FBTyxHQUFHLENBQUM7QUFDakIsc0JBQVk7QUFBQSxRQUNkLENBQUMsQ0FBQztBQUFBLE1BQ04sQ0FBQztBQUFBLElBQ0g7QUFDQSxnQkFBWTtBQUVaLFFBQUkseUJBQVEsU0FBUyxFQUNsQixVQUFVLFNBQU8sSUFBSSxjQUFjLFVBQVUsRUFBRSxRQUFRLE1BQU07QUFDNUQsWUFBTSxLQUFLLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDO0FBQ2xDLGtCQUFZO0FBQUEsSUFDZCxDQUFDLENBQUMsRUFDRCxVQUFVLFNBQU8sSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQ2pFLFdBQUssT0FBTyxLQUFLO0FBQ2pCLFdBQUssTUFBTTtBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBQzNPQSxJQUFBQyxtQkFBbUU7OztBQ1E1RCxTQUFTLGdCQUFnQixLQUFVLEtBQXNCO0FBQzlELFNBQU8sSUFBSSxNQUFNLGlCQUFpQixFQUFFLE9BQU8sVUFBUTtBQVRyRDtBQVVJLFVBQU0sUUFBUSxJQUFJLGNBQWMsYUFBYSxJQUFJO0FBQ2pELFFBQUksQ0FBQyxNQUFPLFFBQU87QUFFbkIsVUFBTSxjQUFhLGlCQUFNLFNBQU4sbUJBQVksSUFBSSxPQUFLLEVBQUUsU0FBdkIsWUFBK0IsQ0FBQztBQUVuRCxVQUFNLGFBQVksV0FBTSxnQkFBTixtQkFBbUI7QUFDckMsVUFBTSxhQUNKLE1BQU0sUUFBUSxTQUFTLElBQUksVUFBVSxPQUFPLENBQUMsTUFBbUIsT0FBTyxNQUFNLFFBQVEsSUFDckYsT0FBTyxjQUFjLFdBQVcsQ0FBQyxTQUFTLElBQzFDLENBQUM7QUFDSCxVQUFNLG1CQUFtQixXQUFXLElBQUksT0FBSyxFQUFFLFdBQVcsR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7QUFFNUUsV0FBTyxXQUFXLFNBQVMsR0FBRyxLQUFLLGlCQUFpQixTQUFTLEdBQUc7QUFBQSxFQUNsRSxDQUFDO0FBQ0g7OztBRG5CQSxJQUFNLGFBQWE7QUFFWixJQUFNLGVBQU4sY0FBMkIsVUFBVTtBQUFBLEVBQzFDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLGVBQWU7QUFDM0IsU0FBSyxjQUFjLEVBQUUsRUFBRSxNQUFNLE9BQUs7QUFDaEMsY0FBUSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25FLFNBQUcsUUFBUSxtREFBbUQ7QUFBQSxJQUNoRSxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBYyxjQUFjLElBQWdDO0FBQzFELFVBQU0sRUFBRSxNQUFNLElBQUksUUFBUSxpQkFBaUIsWUFBWSxLQUFLLElBQUksS0FBSyxTQUFTO0FBTTlFLFNBQUssYUFBYSxJQUFJLEtBQUs7QUFFM0IsVUFBTSxPQUFPLEdBQUcsVUFBVSxFQUFFLEtBQUssZUFBZSxDQUFDO0FBRWpELFFBQUksQ0FBQyxLQUFLO0FBQ1IsWUFBTSxPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDdkQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxZQUFZLENBQUM7QUFDbEUsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSwwRUFBMEUsQ0FBQztBQUNoSTtBQUFBLElBQ0Y7QUFFQSxVQUFNLFlBQVksSUFBSSxXQUFXLEdBQUcsSUFBSSxNQUFNLElBQUksR0FBRztBQUNyRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssS0FBSyxTQUFTO0FBRWpELFFBQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsV0FBSyxRQUFRLDJCQUEyQixTQUFTLEVBQUU7QUFDbkQ7QUFBQSxJQUNGO0FBR0EsVUFBTSxXQUFXLEtBQUssVUFBTSx5QkFBTyxFQUFFLFFBQVEsS0FBSyxFQUFFLFFBQVEsSUFBSSxVQUFVO0FBQzFFLFVBQU0sUUFBUSxZQUNWLFdBQVcsTUFBTSxTQUNqQixLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksTUFBTSxNQUFNO0FBRTNDLFVBQU0sT0FBTyxNQUFNLEtBQUs7QUFDeEIsVUFBTSxRQUFRLEtBQUssSUFBSSxjQUFjLGFBQWEsSUFBSTtBQUV0RCxRQUFJO0FBQ0YsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFlBQU0sRUFBRSxTQUFTLEtBQUssSUFBSSxLQUFLLGFBQWEsU0FBUyxLQUFLO0FBRTFELFdBQUssVUFBVSxFQUFFLEtBQUssaUJBQWlCLE1BQU0sV0FBVyxLQUFLLFNBQVMsQ0FBQztBQUN2RSxXQUFLLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixNQUFNLEtBQUssQ0FBQztBQUFBLElBQ3BELFNBQVMsR0FBRztBQUNWLGNBQVEsTUFBTSx1REFBdUQsQ0FBQztBQUN0RSxXQUFLLFFBQVEscUJBQXFCO0FBQUEsSUFDcEM7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1RLGFBQWEsU0FBaUIsT0FBaUU7QUFuRXpHO0FBcUVJLFVBQU0sV0FBVSxnREFBTyxhQUFQLG1CQUFrQixPQUFsQixtQkFBc0IsWUFBdEIsWUFBaUM7QUFHakQsVUFBTSxTQUFRLDBDQUFPLHdCQUFQLG1CQUE0QixJQUFJLFdBQWhDLFlBQTBDO0FBQ3hELFVBQU0sVUFBVSxRQUFRLE1BQU0sS0FBSztBQUduQyxVQUFNLFFBQU8sYUFDVixNQUFNLElBQUksRUFDVixJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFDakIsS0FBSyxPQUFLLEtBQUssQ0FBQyxFQUFFLFdBQVcsR0FBRyxDQUFDLE1BSHZCLFlBRzRCO0FBRXpDLFdBQU8sRUFBRSxTQUFTLEtBQUs7QUFBQSxFQUN6QjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLHFCQUFxQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ2hFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSx1QkFBTixjQUFtQyx1QkFBTTtBQUFBLEVBQ3ZDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUVyRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTVHNUQ7QUE2R00saUJBQUUsVUFBUyxXQUFNLFVBQU4sWUFBeUIsZUFBZSxFQUNqRCxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFLFFBQVEsS0FBSyxFQUFFLFFBQVEsa0JBQWtCLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUFoSGhGO0FBaUhNLGlCQUFFLFVBQVMsV0FBTSxRQUFOLFlBQXVCLEVBQUUsRUFDbEMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sTUFBTTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDcEM7QUFDQSxRQUFJLHlCQUFRLFNBQVMsRUFBRSxRQUFRLFlBQVksRUFBRSxRQUFRLHdCQUF3QixFQUFFO0FBQUEsTUFBVSxPQUFFO0FBcEgvRjtBQXFITSxpQkFBRSxVQUFTLFdBQU0sY0FBTixZQUE4QixJQUFJLEVBQzNDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFlBQVk7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQzFDO0FBQ0EsUUFBSSx5QkFBUSxTQUFTLEVBQUU7QUFBQSxNQUFVLFNBQy9CLElBQUksY0FBYyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUMvQyxhQUFLLE9BQU8sS0FBSztBQUNqQixhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBZ0I7QUFBRSxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQUc7QUFDNUM7OztBRWpJQSxJQUFBQyxtQkFBb0M7QUFVN0IsSUFBTSxlQUFOLGNBQTJCLFVBQVU7QUFBQSxFQUMxQyxPQUFPLElBQXVCO0FBQzVCLE9BQUcsU0FBUyxnQkFBZ0I7QUFFNUIsVUFBTSxFQUFFLFFBQVEsVUFBVSxVQUFVLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSSxLQUFLLFNBQVM7QUFNcEUsU0FBSyxhQUFhLElBQUksS0FBSztBQUUzQixVQUFNLE9BQU8sR0FBRyxVQUFVLEVBQUUsS0FBSyxXQUFXLENBQUM7QUFDN0MsU0FBSyxNQUFNLHNCQUFzQixVQUFVLE9BQU87QUFFbEQsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUN0QixZQUFNLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN2RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLGtCQUFrQixDQUFDO0FBQ3hFLFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sK0RBQStELENBQUM7QUFDckg7QUFBQSxJQUNGO0FBRUEsZUFBVyxRQUFRLE9BQU87QUFDeEIsWUFBTSxNQUFNLEtBQUssU0FBUyxVQUFVLEVBQUUsS0FBSyxVQUFVLENBQUM7QUFDdEQsVUFBSSxLQUFLLE9BQU87QUFDZCxZQUFJLFdBQVcsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEtBQUssTUFBTSxDQUFDO0FBQUEsTUFDM0Q7QUFDQSxVQUFJLFdBQVcsRUFBRSxNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ25DLFVBQUksS0FBSyxNQUFNO0FBQ2IsWUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGVBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxNQUFPLEVBQUU7QUFBQSxRQUNoRCxDQUFDO0FBQUEsTUFDSCxPQUFPO0FBQ0wsWUFBSSxNQUFNLFNBQVM7QUFBQSxNQUNyQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxhQUFhLFFBQTBCO0FBQ3JDLFFBQUksb0JBQW9CLEtBQUssS0FBSyxLQUFLLFNBQVMsUUFBUSxDQUFDLFFBQVE7QUFDL0QsV0FBSyxTQUFTLFNBQVM7QUFDdkIsYUFBTztBQUFBLElBQ1QsQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUNWO0FBQ0Y7QUFFQSxJQUFNLHNCQUFOLGNBQWtDLHVCQUFNO0FBQUEsRUFDdEMsWUFDRSxLQUNRLFFBQ0EsUUFDUjtBQUNBLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFBQSxFQUdWO0FBQUEsRUFFQSxTQUFlO0FBQ2IsVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXBELFVBQU0sUUFBUSxnQkFBZ0IsS0FBSyxNQUFNO0FBS3pDLFFBQUksQ0FBQyxNQUFNLFFBQVEsTUFBTSxLQUFLLEVBQUcsT0FBTSxRQUFRLENBQUM7QUFFaEQsUUFBSSx5QkFBUSxTQUFTLEVBQUUsUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUE3RTVEO0FBOEVNLGlCQUFFLFVBQVMsV0FBTSxVQUFOLFlBQWUsUUFBUSxFQUNoQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUNBLFFBQUkseUJBQVEsU0FBUyxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFBWSxPQUFFO0FBakY1RDtBQWtGTSxpQkFBRSxVQUFVLEtBQUssR0FBRyxFQUFFLFVBQVUsS0FBSyxHQUFHLEVBQUUsVUFBVSxLQUFLLEdBQUcsRUFDMUQsU0FBUyxRQUFPLFdBQU0sWUFBTixZQUFpQixDQUFDLENBQUMsRUFDbkMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ2hEO0FBRUEsY0FBVSxTQUFTLEtBQUssRUFBRSxNQUFNLFNBQVMsS0FBSyxvQkFBb0IsQ0FBQztBQUVuRSxVQUFNLFNBQVMsVUFBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUM5RCxVQUFNLGFBQWEsTUFBTTtBQUN2QixhQUFPLE1BQU07QUFDYixZQUFNLE1BQU8sUUFBUSxDQUFDLE1BQU0sTUFBTTtBQTVGeEM7QUE2RlEsY0FBTSxNQUFNLE9BQU8sVUFBVSxFQUFFLEtBQUssa0JBQWtCLENBQUM7QUFFdkQsY0FBTSxhQUFhLElBQUksU0FBUyxTQUFTLEVBQUUsTUFBTSxRQUFRLEtBQUssb0JBQW9CLENBQUM7QUFDbkYsbUJBQVcsUUFBUSxLQUFLO0FBQ3hCLG1CQUFXLGNBQWM7QUFDekIsbUJBQVcsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLGVBQUssUUFBUSxXQUFXO0FBQUEsUUFBTyxDQUFDO0FBRTdFLGNBQU0sYUFBYSxJQUFJLFNBQVMsU0FBUyxFQUFFLE1BQU0sUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQ25GLG1CQUFXLFFBQVEsS0FBSztBQUN4QixtQkFBVyxjQUFjO0FBQ3pCLG1CQUFXLGlCQUFpQixTQUFTLE1BQU07QUFBRSxlQUFLLFFBQVEsV0FBVztBQUFBLFFBQU8sQ0FBQztBQUU3RSxjQUFNLFlBQVksSUFBSSxTQUFTLFNBQVMsRUFBRSxNQUFNLFFBQVEsS0FBSyxtQkFBbUIsQ0FBQztBQUNqRixrQkFBVSxTQUFRLFVBQUssU0FBTCxZQUFhO0FBQy9CLGtCQUFVLGNBQWM7QUFDeEIsa0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLGVBQUssT0FBTyxVQUFVLFNBQVM7QUFBQSxRQUFXLENBQUM7QUFFdkYsY0FBTSxTQUFTLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsTUFBTSxTQUFJLENBQUM7QUFDM0UsZUFBTyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3JDLGdCQUFNLE1BQU8sT0FBTyxHQUFHLENBQUM7QUFDeEIscUJBQVc7QUFBQSxRQUNiLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQ0EsZUFBVztBQUVYLFFBQUkseUJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsWUFBWSxFQUFFLFFBQVEsTUFBTTtBQUM1QyxjQUFNLE1BQU8sS0FBSyxFQUFFLE9BQU8sSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUMxQyxtQkFBVztBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFFQSxRQUFJLHlCQUFRLFNBQVMsRUFDbEI7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFnQztBQUM1QyxhQUFLLE1BQU07QUFBQSxNQUNiLENBQUM7QUFBQSxJQUNILEVBQ0M7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLFFBQVEsRUFBRSxRQUFRLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFBQSxJQUN4RDtBQUFBLEVBQ0o7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUMzSUEsSUFBQUMsb0JBQTJEO0FBTTNELElBQU0sV0FBVztBQVlWLElBQU0sa0JBQU4sY0FBOEIsVUFBVTtBQUFBLEVBQzdDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLG1CQUFtQjtBQUMvQixTQUFLLGNBQWMsRUFBRSxFQUFFLE1BQU0sT0FBSztBQUNoQyxjQUFRLE1BQU0sdURBQXVELENBQUM7QUFDdEUsU0FBRyxRQUFRLGtEQUFrRDtBQUFBLElBQy9ELENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFjLGNBQWMsSUFBZ0M7QUEzQjlEO0FBNEJJLFVBQU0sRUFBRSxTQUFTLE9BQU8sTUFBTSxJQUFJLFNBQVMsSUFBSSxRQUFRLFVBQVUsVUFBVSxHQUFHLFdBQVcsSUFBSSxhQUFhLE9BQU8sSUFDL0csS0FBSyxTQUFTO0FBRWhCLFNBQUssYUFBYSxJQUFJLEtBQUs7QUFFM0IsT0FBRyxZQUFZLDZCQUE2QixlQUFlLFFBQVE7QUFFbkUsVUFBTSxTQUFTLEdBQUcsVUFBVSxFQUFFLEtBQUssaUJBQWlCLENBQUM7QUFDckQsUUFBSSxlQUFlLFFBQVE7QUFDekIsYUFBTyxhQUFhLFlBQVksR0FBRztBQUNuQyxhQUFPLGFBQWEsUUFBUSxRQUFRO0FBQ3BDLGFBQU8sYUFBYSxjQUFjLFFBQVE7QUFBQSxJQUM1QztBQUVBLFVBQU0sZ0JBQWdCO0FBQ3RCLFVBQU0sYUFBYSxNQUFNO0FBQ3ZCLFlBQU0sSUFBSSxPQUFPO0FBQ2pCLFlBQU0sWUFBWSxJQUFJLElBQUksS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLFNBQVMsS0FBSyxNQUFNLElBQUksYUFBYSxDQUFDLENBQUMsSUFBSTtBQUMxRixhQUFPLE1BQU0sc0JBQXNCLFVBQVUsU0FBUztBQUFBLElBQ3hEO0FBQ0EsZUFBVztBQUNYLFVBQU0sS0FBSyxJQUFJLGVBQWUsVUFBVTtBQUN4QyxPQUFHLFFBQVEsTUFBTTtBQUNqQixTQUFLLFNBQVMsTUFBTSxHQUFHLFdBQVcsQ0FBQztBQUVuQyxRQUFJLFdBQVcsUUFBUTtBQUNyQixXQUFLLGlCQUFpQixRQUFRLFFBQVEsUUFBUTtBQUM5QztBQUFBLElBQ0Y7QUFHQSxRQUFJLENBQUMsS0FBSztBQUNSLFlBQU0sT0FBTyxPQUFPLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3pELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sWUFBWSxDQUFDO0FBQ2xFLFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sMkVBQTJFLENBQUM7QUFDakk7QUFBQSxJQUNGO0FBRUEsVUFBTSxZQUFZLElBQUksV0FBVyxHQUFHLElBQUksTUFBTSxJQUFJLEdBQUc7QUFDckQsVUFBTSxRQUFRLGdCQUFnQixLQUFLLEtBQUssU0FBUyxFQUFFLE1BQU0sR0FBRyxRQUFRO0FBR3BFLFVBQU0sVUFBVSxNQUFNLFFBQVE7QUFBQSxNQUM1QixNQUFNLElBQUksT0FBTyxTQUFTO0FBQ3hCLGNBQU0sVUFBVSxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssSUFBSTtBQUM5QyxjQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWMsYUFBYSxJQUFJO0FBQ3RELGVBQU8sRUFBRSxNQUFNLFNBQVMsTUFBTTtBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNIO0FBRUEsZUFBVyxVQUFVLFNBQVM7QUFDNUIsVUFBSSxPQUFPLFdBQVcsWUFBWTtBQUNoQyxnQkFBUSxNQUFNLDBEQUEwRCxPQUFPLE1BQU07QUFDckY7QUFBQSxNQUNGO0FBRUEsWUFBTSxFQUFFLE1BQU0sU0FBUyxNQUFNLElBQUksT0FBTztBQUN4QyxZQUFNLFNBQVEsMENBQU8sZ0JBQVAsbUJBQW9CLFVBQXBCLFlBQXVDO0FBQ3JELFlBQU0sT0FBTyxLQUFLLFlBQVksU0FBUyxLQUFLO0FBQzVDLFVBQUksQ0FBQyxLQUFNO0FBRVgsWUFBTSxPQUFPLE9BQU8sVUFBVSxFQUFFLEtBQUssYUFBYSxDQUFDO0FBQ25ELFlBQU0sUUFBUSxLQUFLLFNBQVMsY0FBYyxFQUFFLEtBQUssaUJBQWlCLE1BQU0sS0FBSyxDQUFDO0FBRzlFLFVBQUksU0FBUyxTQUFTLEtBQUssS0FBSyxHQUFHO0FBQ2pDLGNBQU0sTUFBTSxrQkFBa0I7QUFDOUIsY0FBTSxNQUFNLFFBQVE7QUFBQSxNQUN0QjtBQUVBLFdBQUssVUFBVSxFQUFFLEtBQUssZ0JBQWdCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFhUSxpQkFBaUIsUUFBcUIsS0FBYSxVQUF3QjtBQUNqRixRQUFJLENBQUMsSUFBSSxLQUFLLEdBQUc7QUFDZixZQUFNLE9BQU8sT0FBTyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUN6RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLFlBQVksQ0FBQztBQUNsRSxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLHlEQUF5RCxDQUFDO0FBQy9HO0FBQUEsSUFDRjtBQUVBLFVBQU0sU0FBUyxJQUFJLE1BQU0sU0FBUyxFQUFFLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBTyxFQUFFLE1BQU0sR0FBRyxRQUFRO0FBRXhGLGVBQVcsU0FBUyxRQUFRO0FBQzFCLFlBQU0sUUFBUSxNQUFNLE1BQU0sSUFBSSxFQUFFLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUNqRSxZQUFNLFdBQVcsTUFBTSxNQUFNLFNBQVMsQ0FBQztBQUN2QyxZQUFNLFlBQVksTUFBTSxTQUFTLEtBQUssWUFBWSxLQUFLLFFBQVE7QUFDL0QsWUFBTSxhQUFhLFlBQVksU0FBUyxRQUFRLGdCQUFnQixFQUFFLElBQUk7QUFDdEUsWUFBTSxZQUFZLFlBQVksTUFBTSxNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQ25ELFlBQU0sT0FBTyxVQUFVLEtBQUssR0FBRztBQUMvQixVQUFJLENBQUMsS0FBTTtBQUVYLFlBQU0sT0FBTyxPQUFPLFVBQVUsRUFBRSxLQUFLLGFBQWEsQ0FBQztBQUNuRCxXQUFLLFNBQVMsY0FBYyxFQUFFLEtBQUssaUJBQWlCLE1BQU0sS0FBSyxDQUFDO0FBQ2hFLFVBQUksV0FBWSxNQUFLLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixNQUFNLFdBQVcsQ0FBQztBQUFBLElBQzFFO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHUSxZQUFZLFNBQWlCLE9BQXNDO0FBM0k3RTtBQTRJSSxVQUFNLFNBQVEsMENBQU8sd0JBQVAsbUJBQTRCLElBQUksV0FBaEMsWUFBMEM7QUFDeEQsVUFBTSxVQUFVLFFBQVEsTUFBTSxLQUFLO0FBQ25DLFVBQU0sUUFBUSxRQUNYLE1BQU0sSUFBSSxFQUNWLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQyxFQUNqQixPQUFPLE9BQUssS0FBSyxDQUFDLEVBQUUsV0FBVyxHQUFHLENBQUM7QUFDdEMsV0FBTyxNQUFNLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQUEsRUFDbkM7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSxvQkFBb0IsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsUUFBUTtBQUMvRCxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0sc0JBQU4sY0FBa0Msd0JBQU07QUFBQSxFQUN0QyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUF0S2pCO0FBdUtJLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV6RCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUN6QyxnQkFBTSxXQUFOLGtCQUFNLFNBQVc7QUFFakIsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxhQUFhLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUE5SzVELFlBQUFDO0FBK0tNLGlCQUFFLFVBQVNBLE1BQUEsTUFBTSxVQUFOLE9BQUFBLE1BQWUsUUFBUSxFQUNoQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUdBLFFBQUk7QUFDSixRQUFJO0FBRUosUUFBSSwwQkFBUSxTQUFTLEVBQ2xCLFFBQVEsUUFBUSxFQUNoQixRQUFRLHdEQUF3RCxFQUNoRTtBQUFBLE1BQVksT0FBRTtBQTFMckIsWUFBQUE7QUEyTFEsaUJBQUUsVUFBVSxPQUFPLGdCQUFnQixFQUNqQyxVQUFVLFFBQVEsYUFBYSxFQUMvQixVQUFTQSxNQUFBLE1BQU0sV0FBTixPQUFBQSxNQUFnQixLQUFLLEVBQzlCLFNBQVMsT0FBSztBQUNiLGdCQUFNLFNBQVM7QUFDZixxQkFBVyxNQUFNLFVBQVUsTUFBTSxRQUFRLEtBQUs7QUFDOUMsc0JBQVksTUFBTSxVQUFVLE1BQU0sU0FBUyxLQUFLO0FBQUEsUUFDbEQsQ0FBQztBQUFBO0FBQUEsSUFDSjtBQUdGLGlCQUFhLFVBQVUsVUFBVTtBQUNqQyxlQUFXLE1BQU0sVUFBVSxNQUFNLFdBQVcsUUFBUSxLQUFLO0FBQ3pELFFBQUksMEJBQVEsVUFBVSxFQUFFLFFBQVEsS0FBSyxFQUFFLFFBQVEsa0JBQWtCLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUF4TWpGLFlBQUFBO0FBeU1NLGlCQUFFLFVBQVNBLE1BQUEsTUFBTSxRQUFOLE9BQUFBLE1BQWEsRUFBRSxFQUN4QixTQUFTLE9BQUs7QUFBRSxnQkFBTSxNQUFNO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUNwQztBQUdBLGtCQUFjLFVBQVUsVUFBVTtBQUNsQyxnQkFBWSxNQUFNLFVBQVUsTUFBTSxXQUFXLFNBQVMsS0FBSztBQUMzRCxVQUFNLGNBQWMsSUFBSSwwQkFBUSxXQUFXLEVBQ3hDLFFBQVEsUUFBUSxFQUNoQixRQUFRLHdHQUE4RjtBQUN6RyxnQkFBWSxVQUFVLE1BQU0sZ0JBQWdCO0FBQzVDLGdCQUFZLFVBQVUsTUFBTSxhQUFhO0FBQ3pDLFVBQU0sV0FBVyxZQUFZLFVBQVUsU0FBUyxVQUFVO0FBQzFELGFBQVMsT0FBTztBQUNoQixhQUFTLE1BQU0sUUFBUTtBQUN2QixhQUFTLE1BQU0sWUFBWTtBQUMzQixhQUFTLE1BQU0sYUFBYTtBQUM1QixhQUFTLE1BQU0sV0FBVztBQUMxQixhQUFTLFNBQVEsV0FBTSxXQUFOLFlBQWdCO0FBQ2pDLGFBQVMsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLFlBQU0sU0FBUyxTQUFTO0FBQUEsSUFBTyxDQUFDO0FBRTNFLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFBWSxPQUFFO0FBOU41RCxZQUFBQTtBQStOTSxpQkFBRSxVQUFVLEtBQUssR0FBRyxFQUFFLFVBQVUsS0FBSyxHQUFHLEVBQ3RDLFNBQVMsUUFBT0EsTUFBQSxNQUFNLFlBQU4sT0FBQUEsTUFBaUIsQ0FBQyxDQUFDLEVBQ25DLFNBQVMsT0FBSztBQUFFLGdCQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUNoRDtBQUNBLFFBQUksMEJBQVEsU0FBUyxFQUNsQixRQUFRLGFBQWEsRUFDckIsUUFBUSwyRUFBMkUsRUFDbkY7QUFBQSxNQUFZLE9BQUU7QUF0T3JCLFlBQUFBO0FBdU9RLGlCQUFFLFVBQVUsUUFBUSx1QkFBdUIsRUFDekMsVUFBVSxVQUFVLGlCQUFpQixFQUNyQyxVQUFTQSxNQUFBLE1BQU0sZUFBTixPQUFBQSxNQUFvQixNQUFNLEVBQ25DLFNBQVMsT0FBSztBQUFFLGdCQUFNLGFBQWE7QUFBQSxRQUF3QixDQUFDO0FBQUE7QUFBQSxJQUNoRTtBQUNGLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsV0FBVyxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBNU8xRCxZQUFBQTtBQTZPTSxpQkFBRSxTQUFTLFFBQU9BLE1BQUEsTUFBTSxhQUFOLE9BQUFBLE1BQWtCLEVBQUUsQ0FBQyxFQUNyQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxXQUFXLFNBQVMsQ0FBQyxLQUFLO0FBQUEsUUFBSSxDQUFDO0FBQUE7QUFBQSxJQUN6RDtBQUNBLFFBQUksMEJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFDL0MsYUFBSyxPQUFPLEtBQUs7QUFDakIsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUN6UEEsSUFBQUMsb0JBQWtFO0FBTWxFLElBQU1DLHNCQUFOLGNBQWlDLCtCQUFzQjtBQUFBLEVBQ3JELFlBQ0UsS0FDUSxVQUNSO0FBQ0EsVUFBTSxHQUFHO0FBRkQ7QUFHUixTQUFLLGVBQWUsb0NBQStCO0FBQUEsRUFDckQ7QUFBQSxFQUVRLGdCQUEyQjtBQUNqQyxVQUFNLFVBQXFCLENBQUM7QUFDNUIsVUFBTSxVQUFVLENBQUMsTUFBZTtBQUM5QixjQUFRLEtBQUssQ0FBQztBQUNkLGlCQUFXLFNBQVMsRUFBRSxVQUFVO0FBQzlCLFlBQUksaUJBQWlCLDBCQUFTLFNBQVEsS0FBSztBQUFBLE1BQzdDO0FBQUEsSUFDRjtBQUNBLFlBQVEsS0FBSyxJQUFJLE1BQU0sUUFBUSxDQUFDO0FBQ2hDLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxlQUFlLE9BQTBCO0FBQ3ZDLFVBQU0sSUFBSSxNQUFNLFlBQVk7QUFDNUIsV0FBTyxLQUFLLGNBQWMsRUFBRTtBQUFBLE1BQU8sT0FDakMsRUFBRSxLQUFLLFlBQVksRUFBRSxTQUFTLENBQUM7QUFBQSxJQUNqQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGlCQUFpQixRQUFpQixJQUF1QjtBQUN2RCxPQUFHLFNBQVMsUUFBUSxFQUFFLE1BQU0sT0FBTyxTQUFTLE1BQU0sbUJBQW1CLE9BQU8sS0FBSyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVBLG1CQUFtQixRQUF1QjtBQUN4QyxTQUFLLFNBQVMsTUFBTTtBQUFBLEVBQ3RCO0FBQ0Y7QUFFQSxJQUFNLGFBQWEsb0JBQUksSUFBSSxDQUFDLFFBQVEsUUFBUSxTQUFTLFFBQVEsU0FBUyxNQUFNLENBQUM7QUFDN0UsSUFBTSxhQUFhLG9CQUFJLElBQUksQ0FBQyxRQUFRLFNBQVMsUUFBUSxNQUFNLENBQUM7QUFFckQsSUFBTSxvQkFBTixjQUFnQyxVQUFVO0FBQUEsRUFDL0MsT0FBTyxJQUF1QjtBQUM1QixPQUFHLFNBQVMscUJBQXFCO0FBQ2pDLFNBQUssY0FBYyxFQUFFLEVBQUUsTUFBTSxPQUFLO0FBQ2hDLGNBQVEsTUFBTSx5REFBeUQsQ0FBQztBQUN4RSxTQUFHLFFBQVEsbURBQW1EO0FBQUEsSUFDaEUsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQWMsY0FBYyxJQUFnQztBQUMxRCxVQUFNLEVBQUUsU0FBUyxJQUFJLFFBQVEsV0FBVyxVQUFVLEdBQUcsV0FBVyxJQUFJLFNBQVMsT0FBTyxJQUFJLEtBQUssU0FBUztBQVF0RyxTQUFLLGFBQWEsSUFBSSxLQUFLO0FBRTNCLFVBQU0sVUFBVSxHQUFHLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBRXJELFFBQUksV0FBVyxXQUFXO0FBQ3hCLGNBQVEsU0FBUyxnQkFBZ0I7QUFDakMsWUFBTSxhQUFhLE1BQU07QUFDdkIsY0FBTSxJQUFJLFFBQVE7QUFDbEIsY0FBTSxZQUFZLElBQUksSUFBSSxLQUFLLElBQUksR0FBRyxLQUFLLElBQUksU0FBUyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJO0FBQ2hGLGdCQUFRLE1BQU0sVUFBVSxPQUFPLFNBQVM7QUFBQSxNQUMxQztBQUNBLGlCQUFXO0FBQ1gsWUFBTSxLQUFLLElBQUksZUFBZSxVQUFVO0FBQ3hDLFNBQUcsUUFBUSxPQUFPO0FBQ2xCLFdBQUssU0FBUyxNQUFNLEdBQUcsV0FBVyxDQUFDO0FBQUEsSUFDckMsT0FBTztBQUNMLGNBQVEsTUFBTSxzQkFBc0Isa0RBQWtELE9BQU87QUFBQSxJQUMvRjtBQUVBLFFBQUksQ0FBQyxRQUFRO0FBQ1gsWUFBTSxPQUFPLFFBQVEsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDMUQsV0FBSyxVQUFVLEVBQUUsS0FBSyx5QkFBeUIsTUFBTSxrQkFBa0IsQ0FBQztBQUN4RSxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLDZFQUE2RSxDQUFDO0FBQ25JO0FBQUEsSUFDRjtBQUVBLFVBQU0sWUFBWSxLQUFLLElBQUksTUFBTSxzQkFBc0IsTUFBTTtBQUM3RCxRQUFJLEVBQUUscUJBQXFCLDRCQUFVO0FBQ25DLGNBQVEsUUFBUSxXQUFXLE1BQU0sY0FBYztBQUMvQztBQUFBLElBQ0Y7QUFFQSxVQUFNLFFBQVEsS0FBSyxjQUFjLFNBQVMsRUFBRSxNQUFNLEdBQUcsUUFBUTtBQUU3RCxlQUFXLFFBQVEsT0FBTztBQUN4QixZQUFNLE1BQU0sSUFBSSxLQUFLLFVBQVUsWUFBWSxDQUFDO0FBQzVDLFlBQU0sVUFBVSxRQUFRLFVBQVUsRUFBRSxLQUFLLGVBQWUsQ0FBQztBQUV6RCxVQUFJLFdBQVcsSUFBSSxHQUFHLEdBQUc7QUFDdkIsY0FBTSxNQUFNLFFBQVEsU0FBUyxLQUFLO0FBQ2xDLFlBQUksTUFBTSxLQUFLLElBQUksTUFBTSxnQkFBZ0IsSUFBSTtBQUM3QyxZQUFJLFVBQVU7QUFDZCxZQUFJLGlCQUFpQixTQUFTLE1BQU07QUFDbEMsZUFBSyxJQUFJLFVBQVUsYUFBYSxLQUFLLE1BQU0sRUFBRTtBQUFBLFFBQy9DLENBQUM7QUFBQSxNQUNILFdBQVcsV0FBVyxJQUFJLEdBQUcsR0FBRztBQUM5QixnQkFBUSxTQUFTLG9CQUFvQjtBQUNyQyxnQkFBUSxVQUFVLEVBQUUsS0FBSyxzQkFBc0IsTUFBTSxTQUFJLENBQUM7QUFFMUQsY0FBTSxRQUFRLFFBQVEsU0FBUyxPQUFPO0FBQ3RDLGNBQU0sTUFBTSxLQUFLLElBQUksTUFBTSxnQkFBZ0IsSUFBSTtBQUMvQyxjQUFNLFFBQVE7QUFDZCxjQUFNLE9BQU87QUFDYixjQUFNLGFBQWEsZUFBZSxFQUFFO0FBQ3BDLGNBQU0sVUFBVTtBQUVoQixnQkFBUSxpQkFBaUIsY0FBYyxNQUFNO0FBQUUsZUFBSyxNQUFNLEtBQUs7QUFBQSxRQUFHLENBQUM7QUFDbkUsZ0JBQVEsaUJBQWlCLGNBQWMsTUFBTTtBQUFFLGdCQUFNLE1BQU07QUFBRyxnQkFBTSxjQUFjO0FBQUEsUUFBRyxDQUFDO0FBQ3RGLGdCQUFRLGlCQUFpQixTQUFTLE1BQU07QUFDdEMsZUFBSyxJQUFJLFVBQVUsYUFBYSxLQUFLLE1BQU0sRUFBRTtBQUFBLFFBQy9DLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLGNBQWMsUUFBMEI7QUFDOUMsVUFBTSxRQUFpQixDQUFDO0FBQ3hCLFVBQU0sVUFBVSxDQUFDLE1BQWU7QUFDOUIsaUJBQVcsU0FBUyxFQUFFLFVBQVU7QUFDOUIsWUFBSSxpQkFBaUIseUJBQU87QUFDMUIsZ0JBQU0sTUFBTSxJQUFJLE1BQU0sVUFBVSxZQUFZLENBQUM7QUFDN0MsY0FBSSxXQUFXLElBQUksR0FBRyxLQUFLLFdBQVcsSUFBSSxHQUFHLEdBQUc7QUFDOUMsa0JBQU0sS0FBSyxLQUFLO0FBQUEsVUFDbEI7QUFBQSxRQUNGLFdBQVcsaUJBQWlCLDJCQUFTO0FBQ25DLGtCQUFRLEtBQUs7QUFBQSxRQUNmO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQSxZQUFRLE1BQU07QUFDZCxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLDBCQUEwQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ3JFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSw0QkFBTixjQUF3Qyx3QkFBTTtBQUFBLEVBQzVDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUUzRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTNLNUQ7QUE0S00saUJBQUUsVUFBUyxXQUFNLFVBQU4sWUFBeUIsU0FBUyxFQUMzQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxRQUFRO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUN0QztBQUNBLFFBQUk7QUFDSixRQUFJLDBCQUFRLFNBQVMsRUFDbEIsUUFBUSxRQUFRLEVBQ2hCLFFBQVEsc0JBQXNCLEVBQzlCLFFBQVEsT0FBSztBQW5McEI7QUFvTFEsbUJBQWE7QUFDYixRQUFFLFVBQVMsV0FBTSxXQUFOLFlBQTBCLEVBQUUsRUFDckMsZUFBZSxvQkFBb0IsRUFDbkMsU0FBUyxPQUFLO0FBQUUsY0FBTSxTQUFTO0FBQUEsTUFBRyxDQUFDO0FBQUEsSUFDdkMsQ0FBQyxFQUNBO0FBQUEsTUFBVSxTQUNULElBQUksUUFBUSxRQUFRLEVBQUUsV0FBVyxzQkFBc0IsRUFBRSxRQUFRLE1BQU07QUFDckUsWUFBSUEsb0JBQW1CLEtBQUssS0FBSyxDQUFDLFdBQVc7QUFDM0MsZ0JBQU0sT0FBTyxPQUFPLFNBQVMsTUFBTSxLQUFLLE9BQU87QUFDL0MsZ0JBQU0sU0FBUztBQUNmLHFCQUFXLFNBQVMsSUFBSTtBQUFBLFFBQzFCLENBQUMsRUFBRSxLQUFLO0FBQUEsTUFDVixDQUFDO0FBQUEsSUFDSDtBQUNGLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsUUFBUSxFQUFFO0FBQUEsTUFBWSxPQUFFO0FBbE0zRDtBQW1NTSxpQkFBRSxVQUFVLFFBQVEsTUFBTSxFQUFFLFVBQVUsV0FBVyxTQUFTLEVBQ3hELFNBQVMsUUFBTyxXQUFNLFdBQU4sWUFBZ0IsTUFBTSxDQUFDLEVBQ3ZDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFNBQVM7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3ZDO0FBQ0EsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxTQUFTLEVBQUU7QUFBQSxNQUFZLE9BQUU7QUF2TTVEO0FBd01NLGlCQUFFLFVBQVUsS0FBSyxHQUFHLEVBQUUsVUFBVSxLQUFLLEdBQUcsRUFBRSxVQUFVLEtBQUssR0FBRyxFQUMxRCxTQUFTLFFBQU8sV0FBTSxZQUFOLFlBQWlCLENBQUMsQ0FBQyxFQUNuQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDaEQ7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRTtBQUFBLE1BQVEsT0FBRTtBQTVNMUQ7QUE2TU0saUJBQUUsU0FBUyxRQUFPLFdBQU0sYUFBTixZQUFrQixFQUFFLENBQUMsRUFDckMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sV0FBVyxTQUFTLENBQUMsS0FBSztBQUFBLFFBQUksQ0FBQztBQUFBO0FBQUEsSUFDekQ7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFBRTtBQUFBLE1BQVUsU0FDL0IsSUFBSSxjQUFjLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQy9DLGFBQUssT0FBTyxLQUFLO0FBQ2pCLGFBQUssTUFBTTtBQUFBLE1BQ2IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFnQjtBQUFFLFNBQUssVUFBVSxNQUFNO0FBQUEsRUFBRztBQUM1Qzs7O0FDek5BLElBQUFDLG9CQUE2RDtBQUk3RCxJQUFNLGNBQWM7QUFFYixJQUFNLG9CQUFOLGNBQWdDLFVBQVU7QUFBQSxFQUExQztBQUFBO0FBQ0wsU0FBUSxjQUFrQztBQUMxQyxTQUFRLGdCQUErQjtBQUFBO0FBQUEsRUFFdkMsT0FBTyxJQUF1QjtBQUM1QixTQUFLLGNBQWM7QUFDbkIsT0FBRyxTQUFTLHFCQUFxQjtBQUVqQyxTQUFLLGNBQWMsRUFBRSxFQUFFLE1BQU0sT0FBSztBQUNoQyxjQUFRLE1BQU0seURBQXlELENBQUM7QUFDeEUsU0FBRyxRQUFRLGtEQUFrRDtBQUFBLElBQy9ELENBQUM7QUFHRCxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQyxZQUFZO0FBQ3ZDLGNBQU0sRUFBRSxXQUFXLEdBQUcsSUFBSSxLQUFLLFNBQVM7QUFDeEMsWUFBSSxRQUFRLFNBQVMsWUFBWSxLQUFLLGFBQWE7QUFDakQsY0FBSSxLQUFLLGtCQUFrQixNQUFNO0FBQy9CLG1CQUFPLGFBQWEsS0FBSyxhQUFhO0FBQUEsVUFDeEM7QUFDQSxnQkFBTSxTQUFTLEtBQUs7QUFDcEIsZUFBSyxnQkFBZ0IsT0FBTyxXQUFXLE1BQU07QUFDM0MsaUJBQUssZ0JBQWdCO0FBQ3JCLGlCQUFLLGNBQWMsTUFBTSxFQUFFLE1BQU0sT0FBSztBQUNwQyxzQkFBUSxNQUFNLHlFQUF5RSxDQUFDO0FBQUEsWUFDMUYsQ0FBQztBQUFBLFVBQ0gsR0FBRyxXQUFXO0FBQUEsUUFDaEI7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRUEsV0FBaUI7QUFDZixRQUFJLEtBQUssa0JBQWtCLE1BQU07QUFDL0IsYUFBTyxhQUFhLEtBQUssYUFBYTtBQUN0QyxXQUFLLGdCQUFnQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxjQUFjLElBQWdDO0FBQzFELFVBQU0sRUFBRSxXQUFXLElBQUksWUFBWSxNQUFNLGFBQWEsU0FBUyxJQUFJLEtBQUssU0FBUztBQU1qRixPQUFHLE1BQU07QUFDVCxPQUFHLFlBQVksNkJBQTZCLGVBQWUsTUFBTTtBQUVqRSxRQUFJLENBQUMsVUFBVTtBQUNiLFlBQU0sT0FBTyxHQUFHLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3JELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sWUFBWSxDQUFDO0FBQ2xFLFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0scUVBQXFFLENBQUM7QUFDM0g7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLEtBQUssSUFBSSxNQUFNLHNCQUFzQixRQUFRO0FBQzFELFFBQUksRUFBRSxnQkFBZ0IsMEJBQVE7QUFDNUIsU0FBRyxRQUFRLG1CQUFtQixRQUFRLEVBQUU7QUFDeEM7QUFBQSxJQUNGO0FBRUEsUUFBSSxXQUFXO0FBQ2IsV0FBSyxhQUFhLElBQUksS0FBSyxRQUFRO0FBQUEsSUFDckM7QUFFQSxVQUFNLFlBQVksR0FBRyxVQUFVLEVBQUUsS0FBSyx3QkFBd0IsQ0FBQztBQUMvRCxRQUFJLGVBQWUsVUFBVTtBQUMzQixnQkFBVSxhQUFhLFlBQVksR0FBRztBQUN0QyxnQkFBVSxhQUFhLFFBQVEsUUFBUTtBQUN2QyxnQkFBVSxhQUFhLGNBQWMsS0FBSyxRQUFRO0FBQUEsSUFDcEQ7QUFFQSxRQUFJO0FBQ0YsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFlBQU0sbUNBQWlCLE9BQU8sS0FBSyxLQUFLLFNBQVMsV0FBVyxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQzdFLFNBQVMsR0FBRztBQUNWLGNBQVEsTUFBTSxnRUFBZ0UsQ0FBQztBQUMvRSxnQkFBVSxRQUFRLHVCQUF1QjtBQUFBLElBQzNDO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLDBCQUEwQixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ3JFLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSw0QkFBTixjQUF3Qyx3QkFBTTtBQUFBLEVBQzVDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUUzRCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFdBQVcsRUFBRSxRQUFRLCtDQUErQyxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBakhuSDtBQWtITSxpQkFBRSxVQUFTLFdBQU0sYUFBTixZQUE0QixFQUFFLEVBQ3ZDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFdBQVc7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3pDO0FBQ0EsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxZQUFZLEVBQUU7QUFBQSxNQUFVLE9BQUU7QUFySDdEO0FBc0hNLGlCQUFFLFVBQVMsV0FBTSxjQUFOLFlBQThCLElBQUksRUFDM0MsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sWUFBWTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDMUM7QUFDQSxRQUFJLDBCQUFRLFNBQVMsRUFDbEIsUUFBUSxhQUFhLEVBQ3JCLFFBQVEseUZBQXlGLEVBQ2pHO0FBQUEsTUFBWSxPQUFFO0FBNUhyQjtBQTZIUSxpQkFBRSxVQUFVLFVBQVUsdUJBQXVCLEVBQzNDLFVBQVUsUUFBUSxpQkFBaUIsRUFDbkMsVUFBUyxXQUFNLGVBQU4sWUFBOEIsUUFBUSxFQUMvQyxTQUFTLE9BQUs7QUFBRSxnQkFBTSxhQUFhO0FBQUEsUUFBRyxDQUFDO0FBQUE7QUFBQSxJQUMzQztBQUNGLFFBQUksMEJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFDL0MsYUFBSyxPQUFPLEtBQUs7QUFDakIsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUMzSUEsSUFBQUMsb0JBQXNEO0FBSS9DLElBQU0sa0JBQU4sY0FBOEIsVUFBVTtBQUFBLEVBQzdDLE9BQU8sSUFBdUI7QUFDNUIsT0FBRyxTQUFTLG1CQUFtQjtBQUMvQixTQUFLLGNBQWMsRUFBRSxFQUFFLE1BQU0sT0FBSztBQUNoQyxjQUFRLE1BQU0sdURBQXVELENBQUM7QUFDdEUsU0FBRyxRQUFRLDBCQUEwQjtBQUFBLElBQ3ZDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFjLGNBQWMsSUFBZ0M7QUFDMUQsVUFBTSxFQUFFLFFBQVEsSUFBSSxVQUFVLEdBQUcsSUFBSSxLQUFLLFNBQVM7QUFLbkQsT0FBRyxNQUFNO0FBRVQsUUFBSSxPQUFPO0FBQ1QsV0FBSyxhQUFhLElBQUksS0FBSztBQUFBLElBQzdCO0FBRUEsVUFBTSxZQUFZLEdBQUcsVUFBVSxFQUFFLEtBQUssc0JBQXNCLENBQUM7QUFFN0QsUUFBSSxDQUFDLFNBQVM7QUFDWixZQUFNLE9BQU8sVUFBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUM1RCxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLFlBQVksQ0FBQztBQUNsRSxXQUFLLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLGlEQUFpRCxDQUFDO0FBQ3ZHO0FBQUEsSUFDRjtBQUVBLFVBQU0sbUNBQWlCLE9BQU8sS0FBSyxLQUFLLFNBQVMsV0FBVyxJQUFJLElBQUk7QUFBQSxFQUN0RTtBQUFBLEVBRUEsYUFBYSxRQUEwQjtBQUNyQyxRQUFJLHdCQUF3QixLQUFLLEtBQUssS0FBSyxTQUFTLFFBQVEsQ0FBQyxRQUFRO0FBQ25FLFdBQUssU0FBUyxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTSwwQkFBTixjQUFzQyx3QkFBTTtBQUFBLEVBQzFDLFlBQ0UsS0FDUSxRQUNBLFFBQ1I7QUFDQSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQXREakI7QUF1REksVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixjQUFVLE1BQU07QUFDaEIsY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXpELFVBQU0sUUFBUSxnQkFBZ0IsS0FBSyxNQUFNO0FBRXpDLFFBQUksMEJBQVEsU0FBUyxFQUFFLFFBQVEsYUFBYSxFQUFFLFFBQVEsdUNBQXVDLEVBQUU7QUFBQSxNQUFRLE9BQUU7QUE3RDdHLFlBQUFDO0FBOERNLGlCQUFFLFVBQVNBLE1BQUEsTUFBTSxVQUFOLE9BQUFBLE1BQXlCLEVBQUUsRUFDcEMsU0FBUyxPQUFLO0FBQUUsZ0JBQU0sUUFBUTtBQUFBLFFBQUcsQ0FBQztBQUFBO0FBQUEsSUFDdEM7QUFFQSxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLFNBQVMsRUFBRSxRQUFRLG9CQUFvQjtBQUN0RSxVQUFNLFdBQVcsVUFBVSxTQUFTLFlBQVksRUFBRSxLQUFLLGdDQUFnQyxDQUFDO0FBQ3hGLGFBQVMsU0FBUSxXQUFNLFlBQU4sWUFBMkI7QUFDNUMsYUFBUyxPQUFPO0FBQ2hCLGFBQVMsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLFlBQU0sVUFBVSxTQUFTO0FBQUEsSUFBTyxDQUFDO0FBRTVFLFFBQUksMEJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFDL0MsYUFBSyxPQUFPLEtBQUs7QUFDakIsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QUNqRkEsSUFBQUMsb0JBQXVEO0FBSWhELElBQU0sWUFBTixjQUF3QixVQUFVO0FBQUEsRUFDdkMsT0FBTyxJQUF1QjtBQUM1QixPQUFHLFNBQVMsWUFBWTtBQUV4QixVQUFNLEVBQUUsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLEtBQUssU0FBUztBQUtoRCxRQUFJLE9BQU87QUFDVCxXQUFLLGFBQWEsSUFBSSxLQUFLO0FBQUEsSUFDN0I7QUFFQSxVQUFNLFlBQVksR0FBRyxVQUFVLEVBQUUsS0FBSyxxQkFBcUIsQ0FBQztBQUU1RCxRQUFJLENBQUMsTUFBTTtBQUNULFlBQU0sT0FBTyxVQUFVLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQzVELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sTUFBTSxDQUFDO0FBQzVELFdBQUssVUFBVSxFQUFFLEtBQUsseUJBQXlCLE1BQU0sb0RBQW9ELENBQUM7QUFDMUc7QUFBQSxJQUNGO0FBRUEsY0FBVSxnQkFBWSxxQ0FBa0IsSUFBSSxDQUFDO0FBQUEsRUFDL0M7QUFBQSxFQUVBLGFBQWEsUUFBMEI7QUFDckMsUUFBSSx1QkFBdUIsS0FBSyxLQUFLLEtBQUssU0FBUyxRQUFRLENBQUMsUUFBUTtBQUNsRSxXQUFLLFNBQVMsU0FBUztBQUN2QixhQUFPO0FBQUEsSUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFDRjtBQUVBLElBQU0seUJBQU4sY0FBcUMsd0JBQU07QUFBQSxFQUN6QyxZQUNFLEtBQ1EsUUFDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSEQ7QUFDQTtBQUFBLEVBR1Y7QUFBQSxFQUVBLFNBQWU7QUE5Q2pCO0FBK0NJLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUV4RCxVQUFNLFFBQVEsZ0JBQWdCLEtBQUssTUFBTTtBQUV6QyxRQUFJLDBCQUFRLFNBQVMsRUFBRSxRQUFRLGFBQWEsRUFBRSxRQUFRLHVDQUF1QyxFQUFFO0FBQUEsTUFBUSxPQUFFO0FBckQ3RyxZQUFBQztBQXNETSxpQkFBRSxVQUFTQSxNQUFBLE1BQU0sVUFBTixPQUFBQSxNQUF5QixFQUFFLEVBQ3BDLFNBQVMsT0FBSztBQUFFLGdCQUFNLFFBQVE7QUFBQSxRQUFHLENBQUM7QUFBQTtBQUFBLElBQ3RDO0FBRUEsUUFBSSwwQkFBUSxTQUFTLEVBQUUsUUFBUSxNQUFNLEVBQUUsUUFBUSxxQ0FBcUM7QUFDcEYsVUFBTSxXQUFXLFVBQVUsU0FBUyxZQUFZLEVBQUUsS0FBSyxnQ0FBZ0MsQ0FBQztBQUN4RixhQUFTLFNBQVEsV0FBTSxTQUFOLFlBQXdCO0FBQ3pDLGFBQVMsT0FBTztBQUNoQixhQUFTLGFBQWEsY0FBYyxPQUFPO0FBQzNDLGFBQVMsaUJBQWlCLFNBQVMsTUFBTTtBQUFFLFlBQU0sT0FBTyxTQUFTO0FBQUEsSUFBTyxDQUFDO0FBRXpFLFFBQUksMEJBQVEsU0FBUyxFQUFFO0FBQUEsTUFBVSxTQUMvQixJQUFJLGNBQWMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFDL0MsYUFBSyxPQUFPLEtBQUs7QUFDakIsYUFBSyxNQUFNO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQUUsU0FBSyxVQUFVLE1BQU07QUFBQSxFQUFHO0FBQzVDOzs7QWhCeERBLElBQU0sc0JBQW9DO0FBQUEsRUFDeEMsU0FBUztBQUFBLEVBQ1QsZUFBZTtBQUFBLEVBQ2YsUUFBUTtBQUFBO0FBQUEsSUFFTjtBQUFBLE1BQ0UsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLE1BQUcsS0FBSztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQ3JDLFFBQVEsRUFBRSxPQUFPLElBQUksU0FBUyxHQUFHO0FBQUEsSUFDbkM7QUFBQSxJQUNBO0FBQUEsTUFDRSxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsTUFBRyxLQUFLO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFBRyxTQUFTO0FBQUEsTUFDckMsUUFBUSxFQUFFLGFBQWEsT0FBTyxVQUFVLEtBQUs7QUFBQSxJQUMvQztBQUFBLElBQ0E7QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsT0FBTyxlQUFlLE9BQU8sQ0FBQyxFQUFFO0FBQUEsSUFDNUM7QUFBQTtBQUFBLElBRUE7QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsS0FBSyxJQUFJLE9BQU8saUJBQWlCLFdBQVcsS0FBSztBQUFBLElBQzdEO0FBQUEsSUFDQTtBQUFBLE1BQ0UsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLE1BQUcsS0FBSztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQUcsU0FBUztBQUFBLE1BQ3JDLFFBQVEsRUFBRSxPQUFPLFVBQVUsU0FBUyxHQUFHLE9BQU8sQ0FBQyxFQUFFO0FBQUEsSUFDbkQ7QUFBQTtBQUFBLElBRUE7QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsS0FBSyxJQUFJLE9BQU8sVUFBVSxTQUFTLEdBQUcsVUFBVSxHQUFHO0FBQUEsSUFDL0Q7QUFBQTtBQUFBLElBRUE7QUFBQSxNQUNFLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUFHLEtBQUs7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUFHLFNBQVM7QUFBQSxNQUNyQyxRQUFRLEVBQUUsUUFBUSxJQUFJLE9BQU8sV0FBVyxTQUFTLEdBQUcsVUFBVSxHQUFHO0FBQUEsSUFDbkU7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxTQUFTLG1CQUFpQztBQUN4QyxTQUFPLGdCQUFnQixtQkFBbUI7QUFDNUM7QUFJQSxJQUFNLG9CQUFvQixvQkFBSSxJQUFZO0FBQUEsRUFDeEM7QUFBQSxFQUFZO0FBQUEsRUFBZ0I7QUFBQSxFQUFXO0FBQUEsRUFDdkM7QUFBQSxFQUFlO0FBQUEsRUFBaUI7QUFBQSxFQUFTO0FBQUEsRUFDekM7QUFBQSxFQUFlO0FBQ2pCLENBQUM7QUFFRCxTQUFTLHFCQUFxQixHQUFnQztBQUM1RCxNQUFJLENBQUMsS0FBSyxPQUFPLE1BQU0sU0FBVSxRQUFPO0FBQ3hDLFFBQU0sUUFBUTtBQUNkLFNBQ0UsT0FBTyxNQUFNLE9BQU8sWUFDcEIsT0FBTyxNQUFNLFNBQVMsWUFBWSxrQkFBa0IsSUFBSSxNQUFNLElBQUksS0FDbEUsT0FBTyxNQUFNLFFBQVEsWUFBWSxNQUFNLE9BQU8sS0FDOUMsT0FBTyxNQUFNLFFBQVEsWUFBWSxNQUFNLE9BQU8sS0FDOUMsT0FBTyxNQUFNLFlBQVksWUFBWSxNQUFNLFdBQVcsS0FDdEQsT0FBTyxNQUFNLFlBQVksWUFBWSxNQUFNLFdBQVcsS0FBSyxPQUFPLFNBQVMsTUFBTSxPQUFPLE1BQ3ZGLE1BQU0sV0FBVyxVQUFhLE9BQU8sTUFBTSxXQUFXLGNBQ3ZELE1BQU0sV0FBVyxRQUFRLE9BQU8sTUFBTSxXQUFXLFlBQVksQ0FBQyxNQUFNLFFBQVEsTUFBTSxNQUFNO0FBRTVGO0FBT0EsU0FBUyxlQUFlLEtBQTRCO0FBQ2xELFFBQU0sV0FBVyxpQkFBaUI7QUFDbEMsTUFBSSxDQUFDLE9BQU8sT0FBTyxRQUFRLFlBQVksTUFBTSxRQUFRLEdBQUcsRUFBRyxRQUFPO0FBRWxFLFFBQU0sSUFBSTtBQUNWLFFBQU0sVUFBVSxPQUFPLEVBQUUsWUFBWSxZQUFZLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxJQUN6RSxFQUFFLFVBQ0YsU0FBUztBQUNiLFFBQU0sZ0JBQWdCLE9BQU8sRUFBRSxrQkFBa0IsWUFDN0MsRUFBRSxnQkFDRixTQUFTO0FBQ2IsUUFBTSxTQUFTLE1BQU0sUUFBUSxFQUFFLE1BQU0sSUFDakMsRUFBRSxPQUFPLE9BQU8sb0JBQW9CLElBQ3BDLFNBQVM7QUFFYixTQUFPLEVBQUUsU0FBUyxlQUFlLE9BQU87QUFDMUM7QUFJQSxTQUFTLGlCQUF1QjtBQUM5QixnQkFBYyxNQUFNO0FBRXBCLGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsTUFBTSxTQUFTLFVBQVUsS0FBSztBQUFBLElBQy9DLGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksY0FBYyxLQUFLLFVBQVUsTUFBTTtBQUFBLEVBQzVFLENBQUM7QUFFRCxnQkFBYyxTQUFTO0FBQUEsSUFDckIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsZUFBZSxFQUFFLGFBQWEsT0FBTyxVQUFVLEtBQUs7QUFBQSxJQUNwRCxhQUFhLEVBQUUsU0FBUyxHQUFHLFNBQVMsRUFBRTtBQUFBLElBQ3RDLFFBQVEsQ0FBQyxLQUFLLFVBQVUsV0FBVyxJQUFJLFdBQVcsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUN6RSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLGVBQWUsUUFBUSxJQUFJLE9BQU8sQ0FBQyxFQUFFO0FBQUEsSUFDN0QsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxpQkFBaUIsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUMvRSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxLQUFLLElBQUksT0FBTyxpQkFBaUIsV0FBVyxLQUFLO0FBQUEsSUFDbEUsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxhQUFhLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDM0UsQ0FBQztBQUVELGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsT0FBTyxVQUFVLFNBQVMsR0FBRyxPQUFPLENBQUMsRUFBRTtBQUFBLElBQ3hELGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksYUFBYSxLQUFLLFVBQVUsTUFBTTtBQUFBLEVBQzNFLENBQUM7QUFFRCxnQkFBYyxTQUFTO0FBQUEsSUFDckIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLElBQ2IsZUFBZSxFQUFFLEtBQUssSUFBSSxPQUFPLFVBQVUsU0FBUyxHQUFHLFVBQVUsR0FBRztBQUFBLElBQ3BFLGFBQWEsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFO0FBQUEsSUFDdEMsUUFBUSxDQUFDLEtBQUssVUFBVSxXQUFXLElBQUksZ0JBQWdCLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDOUUsQ0FBQztBQUVELGdCQUFjLFNBQVM7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixhQUFhO0FBQUEsSUFDYixlQUFlLEVBQUUsUUFBUSxJQUFJLE9BQU8sV0FBVyxTQUFTLEdBQUcsVUFBVSxHQUFHO0FBQUEsSUFDeEUsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxrQkFBa0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUNoRixDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxVQUFVLElBQUksV0FBVyxLQUFLO0FBQUEsSUFDL0MsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxrQkFBa0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUNoRixDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLElBQUksU0FBUyxHQUFHO0FBQUEsSUFDeEMsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVLE1BQU07QUFBQSxFQUM5RSxDQUFDO0FBRUQsZ0JBQWMsU0FBUztBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFBQSxJQUNiLGVBQWUsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHO0FBQUEsSUFDckMsYUFBYSxFQUFFLFNBQVMsR0FBRyxTQUFTLEVBQUU7QUFBQSxJQUN0QyxRQUFRLENBQUMsS0FBSyxVQUFVLFdBQVcsSUFBSSxVQUFVLEtBQUssVUFBVSxNQUFNO0FBQUEsRUFDeEUsQ0FBQztBQUNIO0FBSUEsSUFBcUIsaUJBQXJCLGNBQTRDLHlCQUFrQztBQUFBLEVBQTlFO0FBQUE7QUFDRSxrQkFBdUIsaUJBQWlCO0FBQUE7QUFBQSxFQUV4QyxNQUFNLFNBQXdCO0FBQzVCLG1CQUFlO0FBRWYsVUFBTSxNQUFNLE1BQU0sS0FBSyxTQUFTO0FBQ2hDLFNBQUssU0FBUyxlQUFlLEdBQUc7QUFFaEMsU0FBSyxhQUFhLFdBQVcsQ0FBQyxTQUFTLElBQUksYUFBYSxNQUFNLElBQUksQ0FBQztBQUVuRSxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUFFLGFBQUssS0FBSyxhQUFhO0FBQUEsTUFBRztBQUFBLElBQzlDLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNkLGNBQU0sU0FBUyxLQUFLLElBQUksVUFBVSxnQkFBZ0IsU0FBUztBQUMzRCxtQkFBVyxRQUFRLFFBQVE7QUFDekIsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGlCQUFLLEtBQUssZUFBZTtBQUFBLFVBQzNCO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLGNBQWMsUUFBUSxpQkFBaUIsTUFBTTtBQUFFLFdBQUssS0FBSyxhQUFhO0FBQUEsSUFBRyxDQUFDO0FBRS9FLFNBQUssY0FBYyxJQUFJLG1CQUFtQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBRXpELFNBQUssSUFBSSxVQUFVLGNBQWMsTUFBTTtBQUNyQyxVQUFJLEtBQUssT0FBTyxlQUFlO0FBQzdCLGFBQUssS0FBSyxhQUFhO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFNLFdBQTBCO0FBQzlCLFNBQUssSUFBSSxVQUFVLG1CQUFtQixTQUFTO0FBQUEsRUFDakQ7QUFBQSxFQUVBLE1BQU0sV0FBVyxRQUFxQztBQUNwRCxTQUFLLFNBQVM7QUFDZCxVQUFNLEtBQUssU0FBUyxNQUFNO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbEMsVUFBTSxFQUFFLFVBQVUsSUFBSSxLQUFLO0FBQzNCLFVBQU0sV0FBVyxVQUFVLGdCQUFnQixTQUFTO0FBQ3BELFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDdkIsZ0JBQVUsV0FBVyxTQUFTLENBQUMsQ0FBQztBQUNoQztBQUFBLElBQ0Y7QUFDQSxVQUFNLE9BQU8sVUFBVSxRQUFRLEtBQUs7QUFDcEMsVUFBTSxLQUFLLGFBQWEsRUFBRSxNQUFNLFdBQVcsUUFBUSxLQUFLLENBQUM7QUFDekQsY0FBVSxXQUFXLElBQUk7QUFBQSxFQUMzQjtBQUNGO0FBSUEsSUFBTSxxQkFBTixjQUFpQyxtQ0FBaUI7QUFBQSxFQUNoRCxZQUFZLEtBQWtCLFFBQXdCO0FBQ3BELFVBQU0sS0FBSyxNQUFNO0FBRFc7QUFBQSxFQUU5QjtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxVQUFNLEVBQUUsWUFBWSxJQUFJO0FBQ3hCLGdCQUFZLE1BQU07QUFDbEIsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUV0RCxRQUFJLDBCQUFRLFdBQVcsRUFDcEIsUUFBUSxpQkFBaUIsRUFDekIsUUFBUSx1REFBdUQsRUFDL0Q7QUFBQSxNQUFVLFlBQ1QsT0FDRyxTQUFTLEtBQUssT0FBTyxPQUFPLGFBQWEsRUFDekMsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sZ0JBQWdCO0FBQ25DLGNBQU0sS0FBSyxPQUFPLFdBQVcsS0FBSyxPQUFPLE1BQU07QUFBQSxNQUNqRCxDQUFDO0FBQUEsSUFDTDtBQUVGLFFBQUksMEJBQVEsV0FBVyxFQUNwQixRQUFRLGlCQUFpQixFQUN6QixRQUFRLHVDQUF1QyxFQUMvQztBQUFBLE1BQVksVUFDWCxLQUNHLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFNBQVMsT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLENBQUMsRUFDM0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sVUFBVSxPQUFPLEtBQUs7QUFDekMsY0FBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIkZvbGRlclN1Z2dlc3RNb2RhbCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSJdCn0K
