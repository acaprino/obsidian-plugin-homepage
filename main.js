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
      const sourceId = instance.id;
      wrapper.addClass("block-dragging");
      const cachedRects = /* @__PURE__ */ new Map();
      for (const [id, { wrapper: w }] of this.blocks) {
        if (id !== sourceId) cachedRects.set(id, w.getBoundingClientRect());
      }
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
        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, cachedRects);
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
    if (heightMode === "extend") el.addClass("quotes-list-block--extend");
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
    new import_obsidian10.Setting(contentEl).setName("Height mode").setDesc("Wrap: fixed height with scrollbar. Extend: block grows to show all quotes.").addDropdown(
      (d) => {
        var _a2;
        return d.addOption("wrap", "Wrap (scroll)").addOption("extend", "Extend (show all)").setValue((_a2 = draft.heightMode) != null ? _a2 : "wrap").onChange((v) => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdRdWljayBMaW5rcycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJ1F1aWNrIExpbmtzJywgZm9sZGVyOiAnJywgbGlua3M6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEZvbGRlckxpbmtzQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2luc2lnaHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnRGFpbHkgSW5zaWdodCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW5zaWdodEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICd0YWctZ3JpZCcsXG4gICAgZGlzcGxheU5hbWU6ICdWYWx1ZXMnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtZWRpdC1tb2RlJyxcbiAgICAgIG5hbWU6ICdUb2dnbGUgZWRpdCBtb2RlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xuICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgIGxlYWYudmlldy50b2dnbGVFZGl0TW9kZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBhYm92ZSBncmlkOyBGQUIgZmxvYXRzIGluZGVwZW5kZW50bHkgKGFscmVhZHkgaW4gY29udGVudEVsIHZpYSBFZGl0VG9vbGJhcilcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuICAgIGNvbnRlbnRFbC5pbnNlcnRCZWZvcmUodGhpcy50b29sYmFyLmdldEZhYkVsZW1lbnQoKSwgdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zLCB0cnVlKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogVG9nZ2xlIGVkaXQgbW9kZSBcdTIwMTQgY2FsbGVkIGZyb20ga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyPy50b2dnbGVFZGl0TW9kZSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZWZmZWN0aXZlQ29sdW1ucyA9IDM7XG4gIC8qKiBDYWxsYmFjayB0byB0cmlnZ2VyIHRoZSBBZGQgQmxvY2sgbW9kYWwgZnJvbSB0aGUgZW1wdHkgc3RhdGUgQ1RBLiAqL1xuICBvblJlcXVlc3RBZGRCbG9jazogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG4gIC8qKiBJRCBvZiB0aGUgbW9zdCByZWNlbnRseSBhZGRlZCBibG9jayBcdTIwMTQgdXNlZCBmb3Igc2Nyb2xsLWludG8tdmlldy4gKi9cbiAgcHJpdmF0ZSBsYXN0QWRkZWRCbG9ja0lkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG4gICAgcHJpdmF0ZSBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICAgIHByaXZhdGUgb25MYXlvdXRDaGFuZ2U6IExheW91dENoYW5nZUNhbGxiYWNrLFxuICApIHtcbiAgICB0aGlzLmdyaWRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWdyaWQnIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgY29uc3QgbmV3RWZmZWN0aXZlID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG4gICAgICBpZiAobmV3RWZmZWN0aXZlICE9PSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnMpIHtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmdyaWRFbCk7XG4gIH1cblxuICAvKiogRXhwb3NlIHRoZSByb290IGdyaWQgZWxlbWVudCBzbyBIb21lcGFnZVZpZXcgY2FuIHJlb3JkZXIgaXQgaW4gdGhlIERPTS4gKi9cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZ3JpZEVsO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhsYXlvdXRDb2x1bW5zOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IHcgPSB0aGlzLmdyaWRFbC5vZmZzZXRXaWR0aDtcbiAgICBpZiAodyA8PSAwKSByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgICBpZiAodyA8PSA1NDApIHJldHVybiAxO1xuICAgIGlmICh3IDw9IDg0MCkgcmV0dXJuIE1hdGgubWluKDIsIGxheW91dENvbHVtbnMpO1xuICAgIGlmICh3IDw9IDEwMjQpIHJldHVybiBNYXRoLm1pbigzLCBsYXlvdXRDb2x1bW5zKTtcbiAgICByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyLCBpc0luaXRpYWwgPSBmYWxzZSk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpc3QnKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgYmxvY2tzJyk7XG4gICAgdGhpcy5lZmZlY3RpdmVDb2x1bW5zID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhjb2x1bW5zKTtcblxuICAgIC8vIFN0YWdnZXIgYW5pbWF0aW9uIG9ubHkgb24gdGhlIGluaXRpYWwgcmVuZGVyIChub3QgcmVvcmRlci9jb2xsYXBzZS9jb2x1bW4gY2hhbmdlKVxuICAgIGlmIChpc0luaXRpYWwpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmFkZENsYXNzKCdob21lcGFnZS1ncmlkLS1hbmltYXRpbmcnKTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ncmlkRWwucmVtb3ZlQ2xhc3MoJ2hvbWVwYWdlLWdyaWQtLWFuaW1hdGluZycpLCA1MDApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgZW1wdHkgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1zdGF0ZScgfSk7XG4gICAgICBlbXB0eS5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1pY29uJywgdGV4dDogJ1xcdXsxRjNFMH0nIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7IGNsczogJ2hvbWVwYWdlLWVtcHR5LXRpdGxlJywgdGV4dDogJ1lvdXIgaG9tZXBhZ2UgaXMgZW1wdHknIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgIGNsczogJ2hvbWVwYWdlLWVtcHR5LWRlc2MnLFxuICAgICAgICB0ZXh0OiB0aGlzLmVkaXRNb2RlXG4gICAgICAgICAgPyAnQ2xpY2sgdGhlIGJ1dHRvbiBiZWxvdyB0byBhZGQgeW91ciBmaXJzdCBibG9jay4nXG4gICAgICAgICAgOiAnQWRkIGJsb2NrcyB0byBidWlsZCB5b3VyIHBlcnNvbmFsIGRhc2hib2FyZC4gVG9nZ2xlIEVkaXQgbW9kZSBpbiB0aGUgdG9vbGJhciB0byBnZXQgc3RhcnRlZC4nLFxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSAmJiB0aGlzLm9uUmVxdWVzdEFkZEJsb2NrKSB7XG4gICAgICAgIGNvbnN0IGN0YSA9IGVtcHR5LmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2hvbWVwYWdlLWVtcHR5LWN0YScsIHRleHQ6ICdBZGQgWW91ciBGaXJzdCBCbG9jaycgfSk7XG4gICAgICAgIGN0YS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsgdGhpcy5vblJlcXVlc3RBZGRCbG9jaz8uKCk7IH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgYmxvY2tzKSB7XG4gICAgICB0aGlzLnJlbmRlckJsb2NrKGluc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KGluc3RhbmNlLnR5cGUpO1xuICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvLyBIZWFkZXIgem9uZSBcdTIwMTQgYWx3YXlzIHZpc2libGU7IGhvdXNlcyB0aXRsZSArIGNvbGxhcHNlIGNoZXZyb25cbiAgICBjb25zdCBoZWFkZXJab25lID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXItem9uZScgfSk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaW5zdGFuY2UuY29sbGFwc2VkKSk7XG4gICAgY29uc3QgY2hldnJvbiA9IGhlYWRlclpvbmUuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWNvbGxhcHNlLWNoZXZyb24nIH0pO1xuICAgIGNoZXZyb24uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2suc2V0SGVhZGVyQ29udGFpbmVyKGhlYWRlclpvbmUpO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5jb2xsYXBzZWQpIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuXG4gICAgY29uc3QgdG9nZ2xlQ29sbGFwc2UgPSAoZTogRXZlbnQpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSkgcmV0dXJuOyAvLyBlZGl0IG1vZGU6IGhhbmRsZSBiYXIgb3ducyBpbnRlcmFjdGlvblxuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjaGV2cm9uLnRvZ2dsZUNsYXNzKCdpcy1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaXNOb3dDb2xsYXBzZWQpKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbGxhcHNlZDogaXNOb3dDb2xsYXBzZWQgfSA6IGIsXG4gICAgICApO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB9O1xuXG4gICAgaGVhZGVyWm9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUNvbGxhcHNlKTtcbiAgICBoZWFkZXJab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0b2dnbGVDb2xsYXBzZShlKTsgfVxuICAgIH0pO1xuXG4gICAgaWYgKGluc3RhbmNlLmNvbGxhcHNlZCkgY2hldnJvbi5hZGRDbGFzcygnaXMtY29sbGFwc2VkJyk7XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbHMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGluc3RhbmNlLmNvbFNwYW4sIGNvbHMpO1xuICAgIC8vIEZvciBOIGNvbHVtbnMgdGhlcmUgYXJlIChOLTEpIGdhcHMgZGlzdHJpYnV0ZWQgYWNyb3NzIE4gc2xvdHMuXG4gICAgLy8gQSBibG9jayBzcGFubmluZyBTIGNvbHVtbnMgY292ZXJzIFMgc2xvdHMgYW5kIChTLTEpIGludGVybmFsIGdhcHMsXG4gICAgLy8gc28gaXQgbXVzdCBzdWJ0cmFjdCAoTi1TKS9OIHNoYXJlIG9mIHRoZSB0b3RhbCBnYXAgc3BhY2UuXG4gICAgLy8gRm9ybXVsYTogYmFzaXMgPSBTL04gKiAxMDAlIC0gKE4tUykvTiAqIGdhcFxuICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjb2xTcGFuIC8gY29scykgKiAxMDA7XG4gICAgY29uc3QgZ2FwRnJhY3Rpb24gPSAoY29scyAtIGNvbFNwYW4pIC8gY29scztcbiAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjb2xTcGFufSAxIGNhbGMoJHtiYXNpc1BlcmNlbnR9JSAtIHZhcigtLWhwLWdhcCwgMTZweCkgKiAke2dhcEZyYWN0aW9uLnRvRml4ZWQoNCl9KWA7XG4gICAgd3JhcHBlci5zdHlsZS5taW5XaWR0aCA9IGNvbHMgPT09IDEgPyAnMCcgOiAndmFyKC0taHAtY2FyZC1taW4td2lkdGgsIDIwMHB4KSc7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBjb25zdCBvblNhdmUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG4gICAgICBuZXcgQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCBpbnN0YW5jZSwgZW50cnkuYmxvY2ssIG9uU2F2ZSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICAvLyBNb3ZlIHVwIC8gZG93biBrZXlib2FyZC1hY2Nlc3NpYmxlIHJlb3JkZXIgYnV0dG9uc1xuICAgIGNvbnN0IG1vdmVVcEJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1tb3ZlLXVwLWJ0bicgfSk7XG4gICAgc2V0SWNvbihtb3ZlVXBCdG4sICdjaGV2cm9uLXVwJyk7XG4gICAgbW92ZVVwQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdNb3ZlIGJsb2NrIHVwJyk7XG4gICAgbW92ZVVwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBpZHggPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc3RhbmNlLmlkKTtcbiAgICAgIGlmIChpZHggPD0gMCkgcmV0dXJuO1xuICAgICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3NdO1xuICAgICAgW25ld0Jsb2Nrc1tpZHggLSAxXSwgbmV3QmxvY2tzW2lkeF1dID0gW25ld0Jsb2Nrc1tpZHhdLCBuZXdCbG9ja3NbaWR4IC0gMV1dO1xuICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBtb3ZlRG93bkJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1tb3ZlLWRvd24tYnRuJyB9KTtcbiAgICBzZXRJY29uKG1vdmVEb3duQnRuLCAnY2hldnJvbi1kb3duJyk7XG4gICAgbW92ZURvd25CdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ01vdmUgYmxvY2sgZG93bicpO1xuICAgIG1vdmVEb3duQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBpZHggPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc3RhbmNlLmlkKTtcbiAgICAgIGlmIChpZHggPCAwIHx8IGlkeCA+PSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmxlbmd0aCAtIDEpIHJldHVybjtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzXTtcbiAgICAgIFtuZXdCbG9ja3NbaWR4XSwgbmV3QmxvY2tzW2lkeCArIDFdXSA9IFtuZXdCbG9ja3NbaWR4ICsgMV0sIG5ld0Jsb2Nrc1tpZHhdXTtcbiAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnIH0pO1xuICAgIHNldEljb24oZ3JpcCwgJ21heGltaXplLTInKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIHRoaXMuYXR0YWNoUmVzaXplSGFuZGxlcihncmlwLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICB0aGlzLmF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZSwgd3JhcHBlciwgaW5zdGFuY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hEcmFnSGFuZGxlcihoYW5kbGU6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIC8vIExpZ2h0d2VpZ2h0IGNsb25lIFx1MjAxNCBubyBkZWVwLWNvcHkgb2YgaGVhdnkgYmxvY2sgY29udGVudFxuICAgICAgY29uc3QgY2xvbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIC8vIEFwcGVuZCBpbnNpZGUgdGhlbWVkIGNvbnRhaW5lciBzbyBDU1MgdmFycyByZXNvbHZlIGNvcnJlY3RseVxuICAgICAgY29uc3QgdGhlbWVkID0gKHRoaXMuZ3JpZEVsLmNsb3Nlc3QoJy5hcHAtY29udGFpbmVyJykgPz8gZG9jdW1lbnQuYm9keSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGVtZWQuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGluc3RhbmNlLmlkO1xuICAgICAgd3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgLy8gQ2FjaGUgcmVjdHMgb25jZSBhdCBkcmFnIHN0YXJ0IHRvIGF2b2lkIGxheW91dCB0aHJhc2ggb24gZXZlcnkgbW91c2Vtb3ZlXG4gICAgICBjb25zdCBjYWNoZWRSZWN0cyA9IG5ldyBNYXA8c3RyaW5nLCBET01SZWN0PigpO1xuICAgICAgZm9yIChjb25zdCBbaWQsIHsgd3JhcHBlcjogdyB9XSBvZiB0aGlzLmJsb2Nrcykge1xuICAgICAgICBpZiAoaWQgIT09IHNvdXJjZUlkKSBjYWNoZWRSZWN0cy5zZXQoaWQsIHcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjbGVhckluZGljYXRvcnMgPSAoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgeyB3cmFwcGVyOiB3IH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgICAgICB3LnJlbW92ZUNsYXNzKCdkcm9wLWJlZm9yZScsICdkcm9wLWFmdGVyJyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHttZS5jbGllbnRYIC0gd3JhcHBlci5vZmZzZXRXaWR0aCAvIDJ9cHhgO1xuICAgICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHttZS5jbGllbnRZIC0gMjB9cHhgO1xuXG4gICAgICAgIGNsZWFySW5kaWNhdG9ycygpO1xuICAgICAgICBjb25zdCBwdCA9IHRoaXMuZmluZEluc2VydGlvblBvaW50Q2FjaGVkKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkLCBjYWNoZWRSZWN0cyk7XG4gICAgICAgIGlmIChwdC50YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldChwdC50YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoXG4gICAgICAgICAgICBwdC5pbnNlcnRCZWZvcmUgPyAnZHJvcC1iZWZvcmUnIDogJ2Ryb3AtYWZ0ZXInLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIGNsb25lLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcbiAgICAgICAgY2xlYXJJbmRpY2F0b3JzKCk7XG5cbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludENhY2hlZChtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCwgY2FjaGVkUmVjdHMpO1xuICAgICAgICB0aGlzLnJlb3JkZXJCbG9jayhzb3VyY2VJZCwgcHQuaW5zZXJ0QmVmb3JlSWQpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjdXJyZW50Q29sU3BhbiAvIGNvbHVtbnMpICogMTAwO1xuICAgICAgICBjb25zdCBnYXBGcmFjdGlvbiA9IChjb2x1bW5zIC0gY3VycmVudENvbFNwYW4pIC8gY29sdW1ucztcbiAgICAgICAgd3JhcHBlci5zdHlsZS5mbGV4ID0gYCR7Y3VycmVudENvbFNwYW59IDEgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSAqICR7Z2FwRnJhY3Rpb24udG9GaXhlZCg0KX0pYDtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4gfSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRJbnNlcnRpb25Qb2ludENhY2hlZChcbiAgICB4OiBudW1iZXIsXG4gICAgeTogbnVtYmVyLFxuICAgIGV4Y2x1ZGVJZDogc3RyaW5nLFxuICAgIHJlY3RzOiBNYXA8c3RyaW5nLCBET01SZWN0PixcbiAgKTogeyB0YXJnZXRJZDogc3RyaW5nIHwgbnVsbDsgaW5zZXJ0QmVmb3JlOiBib29sZWFuOyBpbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCB9IHtcbiAgICBsZXQgYmVzdFRhcmdldElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgYmVzdERpc3QgPSBJbmZpbml0eTtcbiAgICBsZXQgYmVzdEluc2VydEJlZm9yZSA9IHRydWU7XG5cbiAgICBmb3IgKGNvbnN0IFtpZCwgcmVjdF0gb2YgcmVjdHMpIHtcbiAgICAgIGlmIChpZCA9PT0gZXhjbHVkZUlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGN4ID0gcmVjdC5sZWZ0ICsgcmVjdC53aWR0aCAvIDI7XG4gICAgICBjb25zdCBjeSA9IHJlY3QudG9wICsgcmVjdC5oZWlnaHQgLyAyO1xuXG4gICAgICAvLyBJZiBjdXJzb3IgaXMgZGlyZWN0bHkgb3ZlciB0aGlzIGNhcmQsIHVzZSBpdCBpbW1lZGlhdGVseVxuICAgICAgaWYgKHggPj0gcmVjdC5sZWZ0ICYmIHggPD0gcmVjdC5yaWdodCAmJiB5ID49IHJlY3QudG9wICYmIHkgPD0gcmVjdC5ib3R0b20pIHtcbiAgICAgICAgY29uc3QgaW5zZXJ0QmVmb3JlID0geCA8IGN4O1xuICAgICAgICByZXR1cm4geyB0YXJnZXRJZDogaWQsIGluc2VydEJlZm9yZSwgaW5zZXJ0QmVmb3JlSWQ6IGluc2VydEJlZm9yZSA/IGlkIDogdGhpcy5uZXh0QmxvY2tJZChpZCkgfTtcbiAgICAgIH1cblxuICAgICAgLy8gQmV5b25kIDMwMHB4IGZyb20gY2VudGVyLCBkb24ndCBzaG93IGluZGljYXRvciBcdTIwMTQgcHJldmVudHMgdW5pbnR1aXRpdmUgaGlnaGxpZ2h0c1xuICAgICAgY29uc3QgZGlzdCA9IE1hdGguaHlwb3QoeCAtIGN4LCB5IC0gY3kpO1xuICAgICAgaWYgKGRpc3QgPCBiZXN0RGlzdCAmJiBkaXN0IDwgMzAwKSB7XG4gICAgICAgIGJlc3REaXN0ID0gZGlzdDtcbiAgICAgICAgYmVzdFRhcmdldElkID0gaWQ7XG4gICAgICAgIGJlc3RJbnNlcnRCZWZvcmUgPSB4IDwgY3g7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFiZXN0VGFyZ2V0SWQpIHJldHVybiB7IHRhcmdldElkOiBudWxsLCBpbnNlcnRCZWZvcmU6IHRydWUsIGluc2VydEJlZm9yZUlkOiBudWxsIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIHRhcmdldElkOiBiZXN0VGFyZ2V0SWQsXG4gICAgICBpbnNlcnRCZWZvcmU6IGJlc3RJbnNlcnRCZWZvcmUsXG4gICAgICBpbnNlcnRCZWZvcmVJZDogYmVzdEluc2VydEJlZm9yZSA/IGJlc3RUYXJnZXRJZCA6IHRoaXMubmV4dEJsb2NrSWQoYmVzdFRhcmdldElkKSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBuZXh0QmxvY2tJZChpZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgYmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcztcbiAgICBjb25zdCBpZHggPSBibG9ja3MuZmluZEluZGV4KGIgPT4gYi5pZCA9PT0gaWQpO1xuICAgIHJldHVybiBpZHggPj0gMCAmJiBpZHggPCBibG9ja3MubGVuZ3RoIC0gMSA/IGJsb2Nrc1tpZHggKyAxXS5pZCA6IG51bGw7XG4gIH1cblxuICAvKiogUmVtb3ZlIHRoZSBkcmFnZ2VkIGJsb2NrIGZyb20gaXRzIGN1cnJlbnQgcG9zaXRpb24gYW5kIGluc2VydCBpdCBiZWZvcmUgaW5zZXJ0QmVmb3JlSWQgKG51bGwgPSBhcHBlbmQpLiAqL1xuICBwcml2YXRlIHJlb3JkZXJCbG9jayhkcmFnZ2VkSWQ6IHN0cmluZywgaW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGwpOiB2b2lkIHtcbiAgICBjb25zdCBibG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzO1xuICAgIGNvbnN0IGRyYWdnZWQgPSBibG9ja3MuZmluZChiID0+IGIuaWQgPT09IGRyYWdnZWRJZCk7XG4gICAgaWYgKCFkcmFnZ2VkKSByZXR1cm47XG5cbiAgICBjb25zdCB3aXRob3V0RHJhZ2dlZCA9IGJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBkcmFnZ2VkSWQpO1xuICAgIGNvbnN0IGluc2VydEF0ID0gaW5zZXJ0QmVmb3JlSWRcbiAgICAgID8gd2l0aG91dERyYWdnZWQuZmluZEluZGV4KGIgPT4gYi5pZCA9PT0gaW5zZXJ0QmVmb3JlSWQpXG4gICAgICA6IHdpdGhvdXREcmFnZ2VkLmxlbmd0aDtcblxuICAgIC8vIE5vLW9wIGlmIGVmZmVjdGl2ZWx5IHNhbWUgcG9zaXRpb25cbiAgICBjb25zdCBvcmlnaW5hbElkeCA9IGJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBkcmFnZ2VkSWQpO1xuICAgIGNvbnN0IHJlc29sdmVkQXQgPSBpbnNlcnRBdCA9PT0gLTEgPyB3aXRob3V0RHJhZ2dlZC5sZW5ndGggOiBpbnNlcnRBdDtcbiAgICBpZiAocmVzb2x2ZWRBdCA9PT0gb3JpZ2luYWxJZHggfHwgcmVzb2x2ZWRBdCA9PT0gb3JpZ2luYWxJZHggKyAxKSByZXR1cm47XG5cbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbXG4gICAgICAuLi53aXRob3V0RHJhZ2dlZC5zbGljZSgwLCByZXNvbHZlZEF0KSxcbiAgICAgIGRyYWdnZWQsXG4gICAgICAuLi53aXRob3V0RHJhZ2dlZC5zbGljZShyZXNvbHZlZEF0KSxcbiAgICBdO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHNldEVkaXRNb2RlKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLmVkaXRNb2RlID0gZW5hYmxlZDtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICAvKiogVXBkYXRlIGNvbHVtbiBjb3VudCwgY2xhbXBpbmcgZWFjaCBibG9jaydzIGNvbCBhbmQgY29sU3BhbiB0byBmaXQuICovXG4gIHNldENvbHVtbnMobjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBjb25zdCBjb2wgPSBNYXRoLm1pbihiLmNvbCwgbik7XG4gICAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oYi5jb2xTcGFuLCBuIC0gY29sICsgMSk7XG4gICAgICByZXR1cm4geyAuLi5iLCBjb2wsIGNvbFNwYW4gfTtcbiAgICB9KTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBjb2x1bW5zOiBuLCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBhZGRCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCBpbnN0YW5jZV07XG4gICAgdGhpcy5sYXN0QWRkZWRCbG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXJlbmRlcigpOiB2b2lkIHtcbiAgICBjb25zdCBmb2N1c2VkID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICBjb25zdCBmb2N1c2VkQmxvY2tJZCA9IChmb2N1c2VkPy5jbG9zZXN0KCdbZGF0YS1ibG9jay1pZF0nKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5kYXRhc2V0LmJsb2NrSWQ7XG4gICAgY29uc3Qgc2Nyb2xsVGFyZ2V0SWQgPSB0aGlzLmxhc3RBZGRlZEJsb2NrSWQ7XG4gICAgdGhpcy5sYXN0QWRkZWRCbG9ja0lkID0gbnVsbDtcblxuICAgIHRoaXMucmVuZGVyKHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcblxuICAgIGlmIChzY3JvbGxUYXJnZXRJZCkge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmJsb2Nrcy5nZXQoc2Nyb2xsVGFyZ2V0SWQpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIGVudHJ5LndyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWp1c3QtYWRkZWQnKTtcbiAgICAgICAgZW50cnkud3JhcHBlci5zY3JvbGxJbnRvVmlldyh7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICduZWFyZXN0JyB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGZvY3VzZWRCbG9ja0lkKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1ibG9jay1pZD1cIiR7Zm9jdXNlZEJsb2NrSWR9XCJdYCk7XG4gICAgICBlbD8uZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICAvKiogVW5sb2FkIGFsbCBibG9ja3MgYW5kIGNhbmNlbCBhbnkgaW4tcHJvZ3Jlc3MgZHJhZy9yZXNpemUuICovXG4gIGRlc3Ryb3lBbGwoKTogdm9pZCB7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmU/LnJlbW92ZSgpO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG51bGw7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIHNldHRpbmdzIG1vZGFsICh0aXRsZSBzZWN0aW9uICsgYmxvY2stc3BlY2lmaWMgc2V0dGluZ3MpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vLyBbZW1vamksIHNlYXJjaCBrZXl3b3Jkc10gXHUyMDE0IDE3MCBtb3N0IGNvbW1vbi91c2VmdWxcbmNvbnN0IEVNT0pJX1BJQ0tFUl9TRVQ6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgLy8gU21pbGV5cyAmIGVtb3Rpb25cbiAgWydcdUQ4M0RcdURFMDAnLCdoYXBweSBzbWlsZSBncmluJ10sWydcdUQ4M0RcdURFMEEnLCdzbWlsZSBibHVzaCBoYXBweSddLFsnXHVEODNEXHVERTAyJywnbGF1Z2ggY3J5IGZ1bm55IGpveSddLFxuICBbJ1x1RDgzRVx1REQ3MicsJ3RlYXIgc21pbGUgZ3JhdGVmdWwnXSxbJ1x1RDgzRFx1REUwRCcsJ2hlYXJ0IGV5ZXMgbG92ZSddLFsnXHVEODNFXHVERDI5Jywnc3RhciBleWVzIGV4Y2l0ZWQnXSxcbiAgWydcdUQ4M0RcdURFMEUnLCdjb29sIHN1bmdsYXNzZXMnXSxbJ1x1RDgzRVx1REQxNCcsJ3RoaW5raW5nIGhtbSddLFsnXHVEODNEXHVERTA1Jywnc3dlYXQgbmVydm91cyBsYXVnaCddLFxuICBbJ1x1RDgzRFx1REUyMicsJ2NyeSBzYWQgdGVhciddLFsnXHVEODNEXHVERTI0JywnYW5ncnkgaHVmZiBmcnVzdHJhdGVkJ10sWydcdUQ4M0VcdURENzMnLCdwYXJ0eSBjZWxlYnJhdGUnXSxcbiAgWydcdUQ4M0RcdURFMzQnLCdzbGVlcCB0aXJlZCB6enonXSxbJ1x1RDgzRVx1REQyRicsJ21pbmQgYmxvd24gZXhwbG9kZSddLFsnXHVEODNFXHVERUUxJywnc2FsdXRlIHJlc3BlY3QnXSxcbiAgLy8gUGVvcGxlICYgZ2VzdHVyZXNcbiAgWydcdUQ4M0RcdURDNEInLCd3YXZlIGhlbGxvIGJ5ZSddLFsnXHVEODNEXHVEQzREJywndGh1bWJzIHVwIGdvb2Qgb2snXSxbJ1x1RDgzRFx1REM0RScsJ3RodW1icyBkb3duIGJhZCddLFxuICBbJ1x1MjcwQycsJ3ZpY3RvcnkgcGVhY2UnXSxbJ1x1RDgzRVx1REQxRCcsJ2hhbmRzaGFrZSBkZWFsJ10sWydcdUQ4M0RcdURFNEYnLCdwcmF5IHRoYW5rcyBwbGVhc2UnXSxcbiAgWydcdUQ4M0RcdURDQUEnLCdtdXNjbGUgc3Ryb25nIGZsZXgnXSxbJ1x1RDgzRFx1REM0MScsJ2V5ZSB3YXRjaCBzZWUnXSxbJ1x1RDgzRVx1RERFMCcsJ2JyYWluIG1pbmQgdGhpbmsnXSxcbiAgWydcdTI3NjQnLCdoZWFydCBsb3ZlIHJlZCddLFsnXHVEODNFXHVEREUxJywnb3JhbmdlIGhlYXJ0J10sWydcdUQ4M0RcdURDOUInLCd5ZWxsb3cgaGVhcnQnXSxcbiAgWydcdUQ4M0RcdURDOUEnLCdncmVlbiBoZWFydCddLFsnXHVEODNEXHVEQzk5JywnYmx1ZSBoZWFydCddLFsnXHVEODNEXHVEQzlDJywncHVycGxlIGhlYXJ0J10sWydcdUQ4M0RcdUREQTQnLCdibGFjayBoZWFydCddLFxuICAvLyBOYXR1cmVcbiAgWydcdUQ4M0NcdURGMzEnLCdzZWVkbGluZyBzcHJvdXQgZ3JvdyddLFsnXHVEODNDXHVERjNGJywnaGVyYiBsZWFmIGdyZWVuIG5hdHVyZSddLFsnXHVEODNDXHVERjQwJywnY2xvdmVyIGx1Y2snXSxcbiAgWydcdUQ4M0NcdURGMzgnLCdibG9zc29tIGZsb3dlciBwaW5rJ10sWydcdUQ4M0NcdURGM0EnLCdmbG93ZXIgaGliaXNjdXMnXSxbJ1x1RDgzQ1x1REYzQicsJ3N1bmZsb3dlciddLFxuICBbJ1x1RDgzQ1x1REY0MicsJ2F1dHVtbiBmYWxsIGxlYWYnXSxbJ1x1RDgzQ1x1REYwQScsJ3dhdmUgb2NlYW4gd2F0ZXIgc2VhJ10sWydcdUQ4M0RcdUREMjUnLCdmaXJlIGZsYW1lIGhvdCddLFxuICBbJ1x1Mjc0NCcsJ3Nub3dmbGFrZSBjb2xkIGljZSB3aW50ZXInXSxbJ1x1MjZBMScsJ2xpZ2h0bmluZyBib2x0IGVuZXJneSddLFsnXHVEODNDXHVERjA4JywncmFpbmJvdyddLFxuICBbJ1x1MjYwMCcsJ3N1biBzdW5ueSBicmlnaHQnXSxbJ1x1RDgzQ1x1REYxOScsJ21vb24gbmlnaHQgY3Jlc2NlbnQnXSxbJ1x1MkI1MCcsJ3N0YXIgZmF2b3JpdGUnXSxcbiAgWydcdUQ4M0NcdURGMUYnLCdnbG93aW5nIHN0YXIgc2hpbmUnXSxbJ1x1MjcyOCcsJ3NwYXJrbGVzIHNoaW5lIG1hZ2ljJ10sWydcdUQ4M0NcdURGRDQnLCdtb3VudGFpbiBwZWFrJ10sXG4gIFsnXHVEODNDXHVERjBEJywnZWFydGggZ2xvYmUgd29ybGQnXSxbJ1x1RDgzQ1x1REYxMCcsJ2dsb2JlIGludGVybmV0IHdlYiddLFxuICAvLyBGb29kICYgb2JqZWN0c1xuICBbJ1x1MjYxNScsJ2NvZmZlZSB0ZWEgaG90IGRyaW5rJ10sWydcdUQ4M0NcdURGNzUnLCd0ZWEgY3VwIGhvdCddLFsnXHVEODNDXHVERjdBJywnYmVlciBkcmluayddLFxuICBbJ1x1RDgzQ1x1REY0RScsJ2FwcGxlIGZydWl0IHJlZCddLFsnXHVEODNDXHVERjRCJywnbGVtb24geWVsbG93IHNvdXInXSxbJ1x1RDgzQ1x1REY4MicsJ2Nha2UgYmlydGhkYXknXSxcbiAgLy8gQWN0aXZpdGllcyAmIHNwb3J0c1xuICBbJ1x1RDgzQ1x1REZBRicsJ3RhcmdldCBidWxsc2V5ZSBnb2FsJ10sWydcdUQ4M0NcdURGQzYnLCd0cm9waHkgYXdhcmQgd2luJ10sWydcdUQ4M0VcdURENDcnLCdtZWRhbCBnb2xkIGZpcnN0J10sXG4gIFsnXHVEODNDXHVERkFFJywnZ2FtZSBjb250cm9sbGVyIHBsYXknXSxbJ1x1RDgzQ1x1REZBOCcsJ2FydCBwYWxldHRlIGNyZWF0aXZlIHBhaW50J10sWydcdUQ4M0NcdURGQjUnLCdtdXNpYyBub3RlIHNvbmcnXSxcbiAgWydcdUQ4M0NcdURGQUMnLCdjbGFwcGVyIGZpbG0gbW92aWUnXSxbJ1x1RDgzRFx1RENGNycsJ2NhbWVyYSBwaG90byddLFsnXHVEODNDXHVERjgxJywnZ2lmdCBwcmVzZW50J10sXG4gIFsnXHVEODNDXHVERkIyJywnZGljZSBnYW1lIHJhbmRvbSddLFsnXHVEODNFXHVEREU5JywncHV6emxlIHBpZWNlJ10sWydcdUQ4M0NcdURGQUQnLCd0aGVhdGVyIG1hc2tzJ10sXG4gIC8vIFRyYXZlbCAmIHBsYWNlc1xuICBbJ1x1RDgzRFx1REU4MCcsJ3JvY2tldCBsYXVuY2ggc3BhY2UnXSxbJ1x1MjcwOCcsJ2FpcnBsYW5lIHRyYXZlbCBmbHknXSxbJ1x1RDgzRFx1REU4MicsJ3RyYWluIHRyYXZlbCddLFxuICBbJ1x1RDgzQ1x1REZFMCcsJ2hvdXNlIGhvbWUnXSxbJ1x1RDgzQ1x1REZEOScsJ2NpdHkgYnVpbGRpbmcnXSxbJ1x1RDgzQ1x1REYwNicsJ2NpdHkgc3Vuc2V0J10sXG4gIC8vIE9iamVjdHMgJiB0b29sc1xuICBbJ1x1RDgzRFx1RENDMScsJ2ZvbGRlciBkaXJlY3RvcnknXSxbJ1x1RDgzRFx1RENDMicsJ29wZW4gZm9sZGVyJ10sWydcdUQ4M0RcdURDQzQnLCdkb2N1bWVudCBwYWdlIGZpbGUnXSxcbiAgWydcdUQ4M0RcdURDREQnLCdtZW1vIHdyaXRlIG5vdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NCJywnY2xpcGJvYXJkIGNvcHknXSxbJ1x1RDgzRFx1RENDQycsJ3B1c2hwaW4gcGluJ10sXG4gIFsnXHVEODNEXHVEQ0NEJywnbG9jYXRpb24gcGluIG1hcCddLFsnXHVEODNEXHVERDE2JywnYm9va21hcmsgc2F2ZSddLFsnXHVEODNEXHVEREMyJywnaW5kZXggZGl2aWRlcnMnXSxcbiAgWydcdUQ4M0RcdURDQzUnLCdjYWxlbmRhciBkYXRlIHNjaGVkdWxlJ10sWydcdUQ4M0RcdURERDMnLCdjYWxlbmRhciBzcGlyYWwnXSxbJ1x1MjNGMCcsJ2FsYXJtIGNsb2NrIHRpbWUgd2FrZSddLFxuICBbJ1x1RDgzRFx1REQ1MCcsJ2Nsb2NrIHRpbWUgaG91ciddLFsnXHUyM0YxJywnc3RvcHdhdGNoIHRpbWVyJ10sWydcdUQ4M0RcdURDQ0EnLCdjaGFydCBiYXIgZGF0YSddLFxuICBbJ1x1RDgzRFx1RENDOCcsJ2NoYXJ0IHVwIGdyb3d0aCB0cmVuZCddLFsnXHVEODNEXHVEQ0M5JywnY2hhcnQgZG93biBkZWNsaW5lJ10sXG4gIFsnXHVEODNEXHVEQ0ExJywnaWRlYSBsaWdodCBidWxiIGluc2lnaHQnXSxbJ1x1RDgzRFx1REQwRCcsJ3NlYXJjaCBtYWduaWZ5IHpvb20nXSxbJ1x1RDgzRFx1REQxNycsJ2xpbmsgY2hhaW4gdXJsJ10sXG4gIFsnXHVEODNEXHVEQ0UyJywnbG91ZHNwZWFrZXIgYW5ub3VuY2UnXSxbJ1x1RDgzRFx1REQxNCcsJ2JlbGwgbm90aWZpY2F0aW9uIGFsZXJ0J10sXG4gIFsnXHVEODNEXHVEQ0FDJywnc3BlZWNoIGJ1YmJsZSBjaGF0IG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENBRCcsJ3Rob3VnaHQgdGhpbmsgYnViYmxlJ10sXG4gIFsnXHVEODNEXHVEQ0RBJywnYm9va3Mgc3R1ZHkgbGlicmFyeSddLFsnXHVEODNEXHVEQ0Q2Jywnb3BlbiBib29rIHJlYWQnXSxbJ1x1RDgzRFx1RENEQycsJ3Njcm9sbCBkb2N1bWVudCddLFxuICBbJ1x1MjcwOScsJ2VudmVsb3BlIGVtYWlsIGxldHRlciddLFsnXHVEODNEXHVEQ0U3JywnZW1haWwgbWVzc2FnZSddLFsnXHVEODNEXHVEQ0U1JywnaW5ib3ggZG93bmxvYWQnXSxcbiAgWydcdUQ4M0RcdURDRTQnLCdvdXRib3ggdXBsb2FkIHNlbmQnXSxbJ1x1RDgzRFx1REREMScsJ3RyYXNoIGRlbGV0ZSByZW1vdmUnXSxcbiAgLy8gVGVjaFxuICBbJ1x1RDgzRFx1RENCQicsJ2xhcHRvcCBjb21wdXRlciBjb2RlJ10sWydcdUQ4M0RcdUREQTUnLCdkZXNrdG9wIG1vbml0b3Igc2NyZWVuJ10sWydcdUQ4M0RcdURDRjEnLCdwaG9uZSBtb2JpbGUnXSxcbiAgWydcdTIzMjgnLCdrZXlib2FyZCB0eXBlJ10sWydcdUQ4M0RcdUREQjEnLCdtb3VzZSBjdXJzb3IgY2xpY2snXSxbJ1x1RDgzRFx1RENFMScsJ3NhdGVsbGl0ZSBhbnRlbm5hIHNpZ25hbCddLFxuICBbJ1x1RDgzRFx1REQwQycsJ3BsdWcgcG93ZXIgZWxlY3RyaWMnXSxbJ1x1RDgzRFx1REQwQicsJ2JhdHRlcnkgcG93ZXIgY2hhcmdlJ10sWydcdUQ4M0RcdURDQkUnLCdmbG9wcHkgZGlzayBzYXZlJ10sXG4gIFsnXHVEODNEXHVEQ0JGJywnZGlzYyBjZCBkdmQnXSxbJ1x1RDgzRFx1RERBOCcsJ3ByaW50ZXIgcHJpbnQnXSxcbiAgLy8gU3ltYm9scyAmIHN0YXR1c1xuICBbJ1x1MjcwNScsJ2NoZWNrIGRvbmUgY29tcGxldGUgeWVzJ10sWydcdTI3NEMnLCdjcm9zcyBlcnJvciB3cm9uZyBubyBkZWxldGUnXSxcbiAgWydcdTI2QTAnLCd3YXJuaW5nIGNhdXRpb24gYWxlcnQnXSxbJ1x1Mjc1MycsJ3F1ZXN0aW9uIG1hcmsnXSxbJ1x1Mjc1NycsJ2V4Y2xhbWF0aW9uIGltcG9ydGFudCddLFxuICBbJ1x1RDgzRFx1REQxMicsJ2xvY2sgc2VjdXJlIHByaXZhdGUnXSxbJ1x1RDgzRFx1REQxMycsJ3VubG9jayBvcGVuIHB1YmxpYyddLFsnXHVEODNEXHVERDExJywna2V5IHBhc3N3b3JkIGFjY2VzcyddLFxuICBbJ1x1RDgzRFx1REVFMScsJ3NoaWVsZCBwcm90ZWN0IHNlY3VyaXR5J10sWydcdTI2OTknLCdnZWFyIHNldHRpbmdzIGNvbmZpZyddLFsnXHVEODNEXHVERDI3Jywnd3JlbmNoIHRvb2wgZml4J10sXG4gIFsnXHVEODNEXHVERDI4JywnaGFtbWVyIGJ1aWxkJ10sWydcdTI2OTcnLCdmbGFzayBjaGVtaXN0cnkgbGFiJ10sWydcdUQ4M0RcdUREMkMnLCdtaWNyb3Njb3BlIHNjaWVuY2UgcmVzZWFyY2gnXSxcbiAgWydcdUQ4M0RcdUREMkQnLCd0ZWxlc2NvcGUgc3BhY2UgYXN0cm9ub215J10sWydcdUQ4M0VcdURERUEnLCd0ZXN0IHR1YmUgZXhwZXJpbWVudCddLFxuICBbJ1x1RDgzRFx1REM4RScsJ2dlbSBkaWFtb25kIHByZWNpb3VzJ10sWydcdUQ4M0RcdURDQjAnLCdtb25leSBiYWcgcmljaCddLFsnXHVEODNEXHVEQ0IzJywnY3JlZGl0IGNhcmQgcGF5bWVudCddLFxuICBbJ1x1RDgzQ1x1REZGNycsJ2xhYmVsIHRhZyBwcmljZSddLFsnXHVEODNDXHVERjgwJywncmliYm9uIGJvdyBnaWZ0J10sXG4gIC8vIE1pc2MgdXNlZnVsXG4gIFsnXHVEODNFXHVEREVEJywnY29tcGFzcyBuYXZpZ2F0ZSBkaXJlY3Rpb24nXSxbJ1x1RDgzRFx1RERGQScsJ21hcCB3b3JsZCBuYXZpZ2F0ZSddLFxuICBbJ1x1RDgzRFx1RENFNicsJ2JveCBwYWNrYWdlIHNoaXBwaW5nJ10sWydcdUQ4M0RcdUREQzQnLCdmaWxpbmcgY2FiaW5ldCBhcmNoaXZlJ10sXG4gIFsnXHVEODNEXHVERDEwJywnbG9jayBrZXkgc2VjdXJlJ10sWydcdUQ4M0RcdURDQ0UnLCdwYXBlcmNsaXAgYXR0YWNoJ10sWydcdTI3MDInLCdzY2lzc29ycyBjdXQnXSxcbiAgWydcdUQ4M0RcdUREOEEnLCdwZW4gd3JpdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NGJywncnVsZXIgbWVhc3VyZSddLFsnXHVEODNEXHVERDA1JywnZGltIGJyaWdodG5lc3MnXSxcbiAgWydcdUQ4M0RcdUREMDYnLCdicmlnaHQgc3VuIGxpZ2h0J10sWydcdTI2N0InLCdyZWN5Y2xlIHN1c3RhaW5hYmlsaXR5J10sWydcdTI3MTQnLCdjaGVja21hcmsgZG9uZSddLFxuICBbJ1x1Mjc5NScsJ3BsdXMgYWRkJ10sWydcdTI3OTYnLCdtaW51cyByZW1vdmUnXSxbJ1x1RDgzRFx1REQwNCcsJ3JlZnJlc2ggc3luYyBsb29wJ10sXG4gIFsnXHUyM0U5JywnZmFzdCBmb3J3YXJkIHNraXAnXSxbJ1x1MjNFQScsJ3Jld2luZCBiYWNrJ10sWydcdTIzRjgnLCdwYXVzZSBzdG9wJ10sXG4gIFsnXHUyNUI2JywncGxheSBzdGFydCddLFsnXHVEODNEXHVERDAwJywnc2h1ZmZsZSByYW5kb20gbWl4J10sXG5dO1xuXG5jbGFzcyBCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJpdmF0ZSBibG9jazogQmFzZUJsb2NrLFxuICAgIHByaXZhdGUgb25TYXZlOiAoKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmluc3RhbmNlLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnVGl0bGUgbGFiZWwnKVxuICAgICAgLnNldERlc2MoJ0xlYXZlIGVtcHR5IHRvIHVzZSB0aGUgZGVmYXVsdCB0aXRsZS4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKHR5cGVvZiBkcmFmdC5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgPyBkcmFmdC5fdGl0bGVMYWJlbCA6ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdEZWZhdWx0IHRpdGxlJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX3RpdGxlTGFiZWwgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgRW1vamkgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIGNvbnN0IGVtb2ppUm93ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1yb3cnIH0pO1xuICAgIGVtb2ppUm93LmNyZWF0ZVNwYW4oeyBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsIHRleHQ6ICdUaXRsZSBlbW9qaScgfSk7XG5cbiAgICBjb25zdCBjb250cm9scyA9IGVtb2ppUm93LmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1jb250cm9scycgfSk7XG5cbiAgICBjb25zdCB0cmlnZ2VyQnRuID0gY29udHJvbHMuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktcGlja2VyLXRyaWdnZXInIH0pO1xuICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXIgPSAoKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSB0eXBlb2YgZHJhZnQuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlRW1vamkgOiAnJztcbiAgICAgIHRyaWdnZXJCdG4uZW1wdHkoKTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCAnXHVGRjBCJyB9KTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1jaGV2cm9uJywgdGV4dDogJ1x1MjVCRScgfSk7XG4gICAgfTtcbiAgICB1cGRhdGVUcmlnZ2VyKCk7XG5cbiAgICBjb25zdCBjbGVhckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci1jbGVhcicsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgIGNsZWFyQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDbGVhciBlbW9qaScpO1xuXG4gICAgY29uc3QgcGFuZWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLXBhbmVsJyB9KTtcbiAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgY29uc3Qgc2VhcmNoSW5wdXQgPSBwYW5lbC5jcmVhdGVFbCgnaW5wdXQnLCB7XG4gICAgICB0eXBlOiAndGV4dCcsXG4gICAgICBjbHM6ICdlbW9qaS1waWNrZXItc2VhcmNoJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnU2VhcmNoXHUyMDI2JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaWRFbCA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1ncmlkJyB9KTtcblxuICAgIGNvbnN0IHJlbmRlckdyaWQgPSAocXVlcnk6IHN0cmluZykgPT4ge1xuICAgICAgZ3JpZEVsLmVtcHR5KCk7XG4gICAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZCA9IHFcbiAgICAgICAgPyBFTU9KSV9QSUNLRVJfU0VULmZpbHRlcigoW2UsIGtdKSA9PiBrLmluY2x1ZGVzKHEpIHx8IGUgPT09IHEpXG4gICAgICAgIDogRU1PSklfUElDS0VSX1NFVDtcbiAgICAgIGZvciAoY29uc3QgW2Vtb2ppXSBvZiBmaWx0ZXJlZCkge1xuICAgICAgICBjb25zdCBidG4gPSBncmlkRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktYnRuJywgdGV4dDogZW1vamkgfSk7XG4gICAgICAgIGlmIChkcmFmdC5fdGl0bGVFbW9qaSA9PT0gZW1vamkpIGJ0bi5hZGRDbGFzcygnaXMtc2VsZWN0ZWQnKTtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gZW1vamk7XG4gICAgICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgc2VhcmNoSW5wdXQudmFsdWUgPSAnJztcbiAgICAgICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGdyaWRFbC5jcmVhdGVTcGFuKHsgY2xzOiAnZW1vamktcGlja2VyLWVtcHR5JywgdGV4dDogJ05vIHJlc3VsdHMnIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVuZGVyR3JpZCgnJyk7XG5cbiAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHJlbmRlckdyaWQoc2VhcmNoSW5wdXQudmFsdWUpKTtcblxuICAgIHRyaWdnZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBvcGVuID0gcGFuZWwuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9IG9wZW4gPyAnbm9uZScgOiAnYmxvY2snO1xuICAgICAgaWYgKCFvcGVuKSBzZXRUaW1lb3V0KCgpID0+IHNlYXJjaElucHV0LmZvY3VzKCksIDApO1xuICAgIH0pO1xuXG4gICAgY2xlYXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9ICcnO1xuICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICB9KTtcbiAgICAvLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIaWRlIHRpdGxlJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0Ll9oaWRlVGl0bGUgPT09IHRydWUpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll9oaWRlVGl0bGUgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gZHJhZnQ7XG4gICAgICAgICAgdGhpcy5vblNhdmUoKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG5cbiAgICBjb25zdCBociA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaHInKTtcbiAgICBoci5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdCbG9jay1zcGVjaWZpYyBzZXR0aW5nczonLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NvbmZpZ3VyZSBibG9jay4uLicpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmJsb2NrLm9wZW5TZXR0aW5ncyh0aGlzLm9uU2F2ZSk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBmYWJFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICAvLyBGbG9hdGluZyBhY3Rpb24gYnV0dG9uIFx1MjAxNCB2aXNpYmxlIGluIHJlYWQgbW9kZSwgdHJpZ2dlcnMgZWRpdCBtb2RlXG4gICAgdGhpcy5mYWJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWVkaXQtZmFiJyB9KTtcbiAgICB0aGlzLmZhYkVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcbiAgICB0aGlzLmZhYkVsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0VudGVyIGVkaXQgbW9kZScpO1xuICAgIHRoaXMuZmFiRWwuc2V0VGV4dCgnXHUyNzBGJyk7XG4gICAgdGhpcy5mYWJFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudG9nZ2xlRWRpdE1vZGUoKSk7XG4gICAgdGhpcy5mYWJFbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSB7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy50b2dnbGVFZGl0TW9kZSgpOyB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIC8qKiBUb2dnbGUgZWRpdCBtb2RlIFx1MjAxNCBjYWxsZWQgZnJvbSBGQUIsIERvbmUgYnV0dG9uLCBhbmQga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9ICF0aGlzLmVkaXRNb2RlO1xuICAgIHRoaXMuZ3JpZC5zZXRFZGl0TW9kZSh0aGlzLmVkaXRNb2RlKTtcbiAgICB0aGlzLnN5bmNWaXNpYmlsaXR5KCk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNWaXNpYmlsaXR5KCk6IHZvaWQge1xuICAgIC8vIFJlYWQgbW9kZTogc2hvdyBGQUIsIGhpZGUgdG9vbGJhclxuICAgIC8vIEVkaXQgbW9kZTogc2hvdyB0b29sYmFyLCBoaWRlIEZBQlxuICAgIHRoaXMuZmFiRWwudG9nZ2xlQ2xhc3MoJ2lzLWhpZGRlbicsIHRoaXMuZWRpdE1vZGUpO1xuICAgIHRoaXMudG9vbGJhckVsLnRvZ2dsZUNsYXNzKCdpcy12aXNpYmxlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIEVkaXQgbW9kZSBpbmRpY2F0b3IgKGxlZnQtYWxpZ25lZClcbiAgICBjb25zdCBpbmRpY2F0b3IgPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVEaXYoeyBjbHM6ICd0b29sYmFyLWVkaXQtaW5kaWNhdG9yIGlzLXZpc2libGUnIH0pO1xuICAgIGluZGljYXRvci5jcmVhdGVEaXYoeyBjbHM6ICd0b29sYmFyLWVkaXQtZG90JyB9KTtcbiAgICBpbmRpY2F0b3IuY3JlYXRlU3Bhbih7IHRleHQ6ICdFZGl0aW5nJyB9KTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgY29sU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOdW1iZXIgb2YgY29sdW1ucycpO1xuICAgIFsyLCAzLCA0XS5mb3JFYWNoKG4gPT4ge1xuICAgICAgY29uc3Qgb3B0ID0gY29sU2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHZhbHVlOiBTdHJpbmcobiksIHRleHQ6IGAke259IGNvbGAgfSk7XG4gICAgICBpZiAobiA9PT0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgfSk7XG4gICAgY29sU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMub25Db2x1bW5zQ2hhbmdlKE51bWJlcihjb2xTZWxlY3QudmFsdWUpKTtcbiAgICB9KTtcblxuICAgIC8vIEFkZCBCbG9jayBidXR0b24gKG9ubHkgaW4gZWRpdCBtb2RlKVxuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4geyB0aGlzLm9wZW5BZGRCbG9ja01vZGFsKCk7IH0pO1xuXG4gICAgLy8gRG9uZSBidXR0b24gXHUyMDE0IGV4aXRzIGVkaXQgbW9kZVxuICAgIGNvbnN0IGRvbmVCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWVkaXQtYnRuIHRvb2xiYXItYnRuLWFjdGl2ZScsIHRleHQ6ICdcdTI3MTMgRG9uZScgfSk7XG4gICAgZG9uZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudG9nZ2xlRWRpdE1vZGUoKSk7XG5cbiAgICAvLyBXaXJlIHVwIHRoZSBncmlkJ3MgZW1wdHkgc3RhdGUgQ1RBIHRvIG9wZW4gdGhlIGFkZCBibG9jayBtb2RhbFxuICAgIHRoaXMuZ3JpZC5vblJlcXVlc3RBZGRCbG9jayA9ICgpID0+IHsgdGhpcy5vcGVuQWRkQmxvY2tNb2RhbCgpOyB9O1xuICB9XG5cbiAgLyoqIE9wZW5zIHRoZSBBZGQgQmxvY2sgbW9kYWwuIENhbGxlZCBmcm9tIHRvb2xiYXIgYnV0dG9uIGFuZCBlbXB0eSBzdGF0ZSBDVEEuICovXG4gIHByaXZhdGUgb3BlbkFkZEJsb2NrTW9kYWwoKTogdm9pZCB7XG4gICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQodHlwZSk7XG4gICAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgIChtYXgsIGIpID0+IE1hdGgubWF4KG1heCwgYi5yb3cgKyBiLnJvd1NwYW4gLSAxKSwgMCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICBpZDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY29sOiAxLFxuICAgICAgICByb3c6IG1heFJvdyArIDEsXG4gICAgICAgIGNvbFNwYW46IE1hdGgubWluKGZhY3RvcnkuZGVmYXVsdFNpemUuY29sU3BhbiwgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpLFxuICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgIGNvbmZpZzogeyAuLi5mYWN0b3J5LmRlZmF1bHRDb25maWcgfSxcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgfSkub3BlbigpO1xuICB9XG5cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMudG9vbGJhckVsO1xuICB9XG5cbiAgZ2V0RmFiRWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZmFiRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZ3JpZC5vblJlcXVlc3RBZGRCbG9jayA9IG51bGw7XG4gICAgdGhpcy5mYWJFbC5yZW1vdmUoKTtcbiAgICB0aGlzLnRvb2xiYXJFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG5jb25zdCBCTE9DS19NRVRBOiBSZWNvcmQ8QmxvY2tUeXBlLCB7IGljb246IHN0cmluZzsgZGVzYzogc3RyaW5nIH0+ID0ge1xuICAnZ3JlZXRpbmcnOiAgICAgIHsgaWNvbjogJ1xcdXsxRjQ0Qn0nLCBkZXNjOiAnUGVyc29uYWxpemVkIGdyZWV0aW5nIHdpdGggdGltZSBvZiBkYXknIH0sXG4gICdjbG9jayc6ICAgICAgICAgeyBpY29uOiAnXFx1ezFGNTUwfScsIGRlc2M6ICdMaXZlIGNsb2NrIHdpdGggZGF0ZSBkaXNwbGF5JyB9LFxuICAnZm9sZGVyLWxpbmtzJzogIHsgaWNvbjogJ1xcdXsxRjUxN30nLCBkZXNjOiAnUXVpY2sgbGlua3MgdG8gbm90ZXMgYW5kIGZvbGRlcnMnIH0sXG4gICdpbnNpZ2h0JzogICAgICAgeyBpY29uOiAnXFx1ezFGNEExfScsIGRlc2M6ICdEYWlseSByb3RhdGluZyBub3RlIGZyb20gYSB0YWcnIH0sXG4gICd0YWctZ3JpZCc6ICAgICAgeyBpY29uOiAnXFx1ezFGM0Y3fVxcdUZFMEYnLCBkZXNjOiAnR3JpZCBvZiBsYWJlbGVkIHZhbHVlIGJ1dHRvbnMnIH0sXG4gICdxdW90ZXMtbGlzdCc6ICAgeyBpY29uOiAnXFx1ezFGNEFDfScsIGRlc2M6ICdDb2xsZWN0aW9uIG9mIHF1b3RlcyBmcm9tIG5vdGVzJyB9LFxuICAnaW1hZ2UtZ2FsbGVyeSc6IHsgaWNvbjogJ1xcdXsxRjVCQ31cXHVGRTBGJywgZGVzYzogJ1Bob3RvIGdyaWQgZnJvbSBhIHZhdWx0IGZvbGRlcicgfSxcbiAgJ2VtYmVkZGVkLW5vdGUnOiB7IGljb246ICdcXHV7MUY0QzR9JywgZGVzYzogJ1JlbmRlciBhIG5vdGUgaW5saW5lIG9uIHRoZSBwYWdlJyB9LFxuICAnc3RhdGljLXRleHQnOiAgIHsgaWNvbjogJ1xcdXsxRjRERH0nLCBkZXNjOiAnTWFya2Rvd24gdGV4dCBibG9jayB5b3Ugd3JpdGUgZGlyZWN0bHknIH0sXG4gICdodG1sJzogICAgICAgICAgeyBpY29uOiAnPC8+JywgZGVzYzogJ0N1c3RvbSBIVE1MIGNvbnRlbnQgKHNhbml0aXplZCknIH0sXG59O1xuXG5jbGFzcyBBZGRCbG9ja01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uU2VsZWN0OiAodHlwZTogQmxvY2tUeXBlKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBZGQgQmxvY2snLCBjbHM6ICdhZGQtYmxvY2stbW9kYWwtdGl0bGUnIH0pO1xuXG4gICAgY29uc3QgZ3JpZCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdhZGQtYmxvY2stZ3JpZCcgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGZhY3Rvcnkgb2YgQmxvY2tSZWdpc3RyeS5nZXRBbGwoKSkge1xuICAgICAgY29uc3QgbWV0YSA9IEJMT0NLX01FVEFbZmFjdG9yeS50eXBlXTtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYWRkLWJsb2NrLW9wdGlvbicgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1pY29uJywgdGV4dDogbWV0YT8uaWNvbiA/PyAnXFx1MjVBQScgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1uYW1lJywgdGV4dDogZmFjdG9yeS5kaXNwbGF5TmFtZSB9KTtcbiAgICAgIGlmIChtZXRhPy5kZXNjKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLWRlc2MnLCB0ZXh0OiBtZXRhLmRlc2MgfSk7XG4gICAgICB9XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMub25TZWxlY3QoZmFjdG9yeS50eXBlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEdyZWV0aW5nQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdncmVldGluZy1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd1RpbWU/OiBib29sZWFuIH07XG5cbiAgICBpZiAoc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctdGltZScgfSk7XG4gICAgfVxuICAgIHRoaXMubmFtZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctbmFtZScgfSk7XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgaG91ciA9IG5vdy5ob3VyKCk7XG4gICAgY29uc3QgeyBuYW1lID0gJ2JlbnRvcm5hdG8nLCBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgICBzaG93VGltZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGNvbnN0IHNhbHV0YXRpb24gPVxuICAgICAgaG91ciA+PSA1ICYmIGhvdXIgPCAxMiA/ICdCdW9uZ2lvcm5vJyA6XG4gICAgICBob3VyID49IDEyICYmIGhvdXIgPCAxOCA/ICdCdW9uIHBvbWVyaWdnaW8nIDpcbiAgICAgICdCdW9uYXNlcmEnO1xuXG4gICAgaWYgKHRoaXMudGltZUVsICYmIHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ0hIOm1tJykpO1xuICAgIH1cbiAgICBpZiAodGhpcy5uYW1lRWwpIHtcbiAgICAgIHRoaXMubmFtZUVsLnNldFRleHQoYCR7c2FsdXRhdGlvbn0sICR7bmFtZX1gKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEdyZWV0aW5nU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEdyZWV0aW5nU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnR3JlZXRpbmcgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdOYW1lJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0Lm5hbWUgYXMgc3RyaW5nID8/ICdiZW50b3JuYXRvJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm5hbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aW1lJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpbWUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUJsb2NrIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgcHJpdmF0ZSBfaGVhZGVyQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gQ2FsbGVkIGJ5IEdyaWRMYXlvdXQgdG8gcmVkaXJlY3QgcmVuZGVySGVhZGVyIG91dHB1dCBvdXRzaWRlIGJsb2NrLWNvbnRlbnQuXG4gIHNldEhlYWRlckNvbnRhaW5lcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLl9oZWFkZXJDb250YWluZXIgPSBlbDtcbiAgfVxuXG4gIC8vIFJlbmRlciB0aGUgbXV0ZWQgdXBwZXJjYXNlIGJsb2NrIGhlYWRlciBsYWJlbC5cbiAgLy8gUmVzcGVjdHMgX2hpZGVUaXRsZSwgX3RpdGxlTGFiZWwsIGFuZCBfdGl0bGVFbW9qaSBmcm9tIGluc3RhbmNlLmNvbmZpZy5cbiAgLy8gUmVuZGVycyBpbnRvIHRoZSBoZWFkZXIgY29udGFpbmVyIHNldCBieSBHcmlkTGF5b3V0IChpZiBhbnkpLCBlbHNlIGZhbGxzIGJhY2sgdG8gZWwuXG4gIHByb3RlY3RlZCByZW5kZXJIZWFkZXIoZWw6IEhUTUxFbGVtZW50LCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY2ZnID0gdGhpcy5pbnN0YW5jZS5jb25maWc7XG4gICAgaWYgKGNmZy5faGlkZVRpdGxlID09PSB0cnVlKSByZXR1cm47XG4gICAgY29uc3QgbGFiZWwgPSAodHlwZW9mIGNmZy5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUxhYmVsLnRyaW0oKSlcbiAgICAgID8gY2ZnLl90aXRsZUxhYmVsLnRyaW0oKVxuICAgICAgOiB0aXRsZTtcbiAgICBpZiAoIWxhYmVsKSByZXR1cm47XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5faGVhZGVyQ29udGFpbmVyID8/IGVsO1xuICAgIGNvbnN0IGhlYWRlciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXInIH0pO1xuICAgIGlmICh0eXBlb2YgY2ZnLl90aXRsZUVtb2ppID09PSAnc3RyaW5nJyAmJiBjZmcuX3RpdGxlRW1vamkpIHtcbiAgICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgY2xzOiAnYmxvY2staGVhZGVyLWVtb2ppJywgdGV4dDogY2ZnLl90aXRsZUVtb2ppIH0pO1xuICAgIH1cbiAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRhdGVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2Nsb2NrLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dEYXRlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93RGF0ZT86IGJvb2xlYW4gfTtcblxuICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stdGltZScgfSk7XG4gICAgaWYgKHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLWRhdGUnIH0pO1xuICAgIH1cblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCB7IHNob3dTZWNvbmRzID0gZmFsc2UsIHNob3dEYXRlID0gdHJ1ZSwgZm9ybWF0ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHNob3dTZWNvbmRzPzogYm9vbGVhbjtcbiAgICAgIHNob3dEYXRlPzogYm9vbGVhbjtcbiAgICAgIGZvcm1hdD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudGltZUVsKSB7XG4gICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChmb3JtYXQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChzaG93U2Vjb25kcyA/ICdISDptbTpzcycgOiAnSEg6bW0nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmRhdGVFbCAmJiBzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwuc2V0VGV4dChub3cuZm9ybWF0KCdkZGRkLCBEIE1NTU0gWVlZWScpKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IENsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIENsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ2xvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHNlY29uZHMnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93U2Vjb25kcyBhcyBib29sZWFuID8/IGZhbHNlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1NlY29uZHMgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBkYXRlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0RhdGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0RhdGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdDdXN0b20gZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdPcHRpb25hbCBtb21lbnQuanMgZm9ybWF0IHN0cmluZywgZS5nLiBcIkhIOm1tXCIuIExlYXZlIGVtcHR5IGZvciBkZWZhdWx0LicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9ybWF0IGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9ybWF0ID0gdjsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIExpbmtJdGVtIHtcbiAgbGFiZWw6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBlbW9qaT86IHN0cmluZztcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEZvbGRlciBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclN1Z2dlc3RNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxURm9sZGVyPiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PiBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlciwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGZvbGRlci5wYXRoID09PSAnLycgPyAnLyAodmF1bHQgcm9vdCknIDogZm9sZGVyLnBhdGggfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyKTogdm9pZCB7IHRoaXMub25DaG9vc2UoZm9sZGVyKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjbGFzcyBGb2xkZXJMaW5rc0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZW5kZXJUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZm9sZGVyLWxpbmtzLWJsb2NrJyk7XG5cbiAgICAvLyBSZS1yZW5kZXIgd2hlbiB2YXVsdCBmaWxlcyBhcmUgY3JlYXRlZCwgZGVsZXRlZCwgb3IgcmVuYW1lZCAoZGVib3VuY2VkKVxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignY3JlYXRlJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdkZWxldGUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuXG4gICAgLy8gRGVmZXIgZmlyc3QgcmVuZGVyIHNvIHZhdWx0IGlzIGZ1bGx5IGluZGV4ZWRcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB0aGlzLnJlbmRlckNvbnRlbnQoKSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlUmVuZGVyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlbmRlclRpbWVyICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVuZGVyVGltZXIpO1xuICAgIHRoaXMucmVuZGVyVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnJlbmRlclRpbWVyID0gbnVsbDtcbiAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgIH0sIDE1MCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNvbnRlbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdRdWljayBMaW5rcycsIGZvbGRlciA9ICcnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG5cbiAgICAvLyBBdXRvLWxpc3Qgbm90ZXMgZnJvbSBzZWxlY3RlZCBmb2xkZXIgKHNvcnRlZCBhbHBoYWJldGljYWxseSlcbiAgICBpZiAoZm9sZGVyKSB7XG4gICAgICBjb25zdCBub3JtYWxpc2VkID0gZm9sZGVyLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKTtcblxuICAgICAgaWYgKCFub3JtYWxpc2VkKSB7XG4gICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdWYXVsdCByb290IGxpc3RpbmcgaXMgbm90IHN1cHBvcnRlZC4gU2VsZWN0IGEgc3ViZm9sZGVyLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGlzZWQpO1xuXG4gICAgICAgIGlmICghKGZvbGRlck9iaiBpbnN0YW5jZW9mIFRGb2xkZXIpKSB7XG4gICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYEZvbGRlciBcIiR7bm9ybWFsaXNlZH1cIiBub3QgZm91bmQuYCwgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcHJlZml4ID0gZm9sZGVyT2JqLnBhdGggKyAnLyc7XG4gICAgICAgICAgY29uc3Qgbm90ZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpXG4gICAgICAgICAgICAuZmlsdGVyKGYgPT4gZi5wYXRoLnN0YXJ0c1dpdGgocHJlZml4KSlcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSkpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIG5vdGVzKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub3Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IGBObyBub3RlcyBpbiBcIiR7Zm9sZGVyT2JqLnBhdGh9XCIuYCwgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFudWFsIGxpbmtzXG4gICAgZm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgIGlmIChsaW5rLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnbGluay1lbW9qaScsIHRleHQ6IGxpbmsuZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGxpbmsubGFiZWwgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobGluay5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWZvbGRlciAmJiBsaW5rcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNTE3fScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBsaW5rcyB5ZXQuIEFkZCBtYW51YWwgbGlua3Mgb3IgcGljayBhIGZvbGRlciBpbiBzZXR0aW5ncy4nIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlbmRlclRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVuZGVyVGltZXIpO1xuICAgICAgdGhpcy5yZW5kZXJUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwoXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgICAobmV3Q29uZmlnKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICAgICAgb25TYXZlKCk7XG4gICAgICB9LFxuICAgICkub3BlbigpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyTGlua3NTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVpY2sgTGlua3MgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQ6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0gPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuICAgIGRyYWZ0LmxpbmtzID8/PSBbXTtcbiAgICBjb25zdCBsaW5rcyA9IGRyYWZ0LmxpbmtzO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVpY2sgTGlua3MnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdBdXRvLWxpc3QgZm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdMaXN0IGFsbCBub3RlcyBmcm9tIHRoaXMgdmF1bHQgZm9sZGVyIGFzIGxpbmtzLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdlLmcuIFByb2plY3RzJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnTWFudWFsIGxpbmtzJyB9KTtcblxuICAgIGNvbnN0IGxpbmtzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuXG4gICAgY29uc3QgcmVuZGVyTGlua3MgPSAoKSA9PiB7XG4gICAgICBsaW5rc0NvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgbGlua3MuZm9yRWFjaCgobGluaywgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaW5rc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdzZXR0aW5ncy1saW5rLXJvdycgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHJvdylcbiAgICAgICAgICAuc2V0TmFtZShgTGluayAke2kgKyAxfWApXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdMYWJlbCcpLnNldFZhbHVlKGxpbmsubGFiZWwpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5sYWJlbCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignUGF0aCcpLnNldFZhbHVlKGxpbmsucGF0aCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLnBhdGggPSB2OyB9KSlcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0Vtb2ppJykuc2V0VmFsdWUobGluay5lbW9qaSA/PyAnJykub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmVtb2ppID0gdiB8fCB1bmRlZmluZWQ7IH0pKVxuICAgICAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRJY29uKCd0cmFzaCcpLnNldFRvb2x0aXAoJ1JlbW92ZScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgbGlua3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpbmtzKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0QnV0dG9uVGV4dCgnQWRkIExpbmsnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgbGlua3MucHVzaCh7IGxhYmVsOiAnJywgcGF0aDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpbmtzKCk7XG4gICAgICB9KSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSkpO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IE1TX1BFUl9EQVkgPSA4Nl80MDBfMDAwO1xuXG5leHBvcnQgY2xhc3MgSW5zaWdodEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbnNpZ2h0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBpbnNpZ2h0LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGRhaWx5U2VlZD86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjYXJkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1jYXJkJyB9KTtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBjb25zdCBoaW50ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRBMX0nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gdGFnIGNvbmZpZ3VyZWQuIEFkZCBhIHRhZyBpbiBzZXR0aW5ncyB0byBzaG93IGEgZGFpbHkgcm90YXRpbmcgbm90ZS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncy5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0eXBlb2YgdCA9PT0gJ3N0cmluZycpIDpcbiAgICAgIHR5cGVvZiByYXdGbVRhZ3MgPT09ICdzdHJpbmcnID8gW3Jhd0ZtVGFnc10gOlxuICAgICAgW107XG4gICAgY29uc3Qgbm9ybWFsaXplZEZtVGFncyA9IGZtVGFnQXJyYXkubWFwKHQgPT4gdC5zdGFydHNXaXRoKCcjJykgPyB0IDogYCMke3R9YCk7XG5cbiAgICByZXR1cm4gaW5saW5lVGFncy5pbmNsdWRlcyh0YWcpIHx8IG5vcm1hbGl6ZWRGbVRhZ3MuaW5jbHVkZXModGFnKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIFZhbHVlSXRlbSB7XG4gIGVtb2ppOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGxpbms/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUYWdHcmlkQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3RhZy1ncmlkLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1ZhbHVlcycsIGNvbHVtbnMgPSAyLCBpdGVtcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ3JpZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3RhZy1ncmlkJyB9KTtcbiAgICBncmlkLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgaGludCA9IGdyaWQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUYzRjd9XFx1RkUwRicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBpdGVtcyB5ZXQuIEFkZCB2YWx1ZXMgd2l0aCBlbW9qaXMgYW5kIGxhYmVscyBpbiBzZXR0aW5ncy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0YWctYnRuJyB9KTtcbiAgICAgIGlmIChpdGVtLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAndGFnLWJ0bi1lbW9qaScsIHRleHQ6IGl0ZW0uZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGl0ZW0ubGFiZWwgfSk7XG4gICAgICBpZiAoaXRlbS5saW5rKSB7XG4gICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGl0ZW0ubGluayEsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidG4uc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgVmFsdWVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFZhbHVlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1ZhbHVlcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZykgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgaXRlbXM/OiBWYWx1ZUl0ZW1bXTtcbiAgICB9O1xuICAgIGlmICghQXJyYXkuaXNBcnJheShkcmFmdC5pdGVtcykpIGRyYWZ0Lml0ZW1zID0gW107XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdWYWx1ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcxJywgJzEnKS5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnSXRlbXMnLCBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScgfSk7XG5cbiAgICBjb25zdCBsaXN0RWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tbGlzdCcgfSk7XG4gICAgY29uc3QgcmVuZGVyTGlzdCA9ICgpID0+IHtcbiAgICAgIGxpc3RFbC5lbXB0eSgpO1xuICAgICAgZHJhZnQuaXRlbXMhLmZvckVhY2goKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogJ3ZhbHVlcy1pdGVtLXJvdycgfSk7XG5cbiAgICAgICAgY29uc3QgZW1vamlJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tZW1vamknIH0pO1xuICAgICAgICBlbW9qaUlucHV0LnZhbHVlID0gaXRlbS5lbW9qaTtcbiAgICAgICAgZW1vamlJbnB1dC5wbGFjZWhvbGRlciA9ICdcdUQ4M0RcdURFMDAnO1xuICAgICAgICBlbW9qaUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmVtb2ppID0gZW1vamlJbnB1dC52YWx1ZTsgfSk7XG5cbiAgICAgICAgY29uc3QgbGFiZWxJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGFiZWwnIH0pO1xuICAgICAgICBsYWJlbElucHV0LnZhbHVlID0gaXRlbS5sYWJlbDtcbiAgICAgICAgbGFiZWxJbnB1dC5wbGFjZWhvbGRlciA9ICdMYWJlbCc7XG4gICAgICAgIGxhYmVsSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0ubGFiZWwgPSBsYWJlbElucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsaW5rSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWxpbmsnIH0pO1xuICAgICAgICBsaW5rSW5wdXQudmFsdWUgPSBpdGVtLmxpbmsgPz8gJyc7XG4gICAgICAgIGxpbmtJbnB1dC5wbGFjZWhvbGRlciA9ICdOb3RlIHBhdGggKG9wdGlvbmFsKSc7XG4gICAgICAgIGxpbmtJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5saW5rID0gbGlua0lucHV0LnZhbHVlIHx8IHVuZGVmaW5lZDsgfSk7XG5cbiAgICAgICAgY29uc3QgZGVsQnRuID0gcm93LmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3ZhbHVlcy1pdGVtLWRlbCcsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgICAgICBkZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgZHJhZnQuaXRlbXMhLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZW5kZXJMaXN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICByZW5kZXJMaXN0KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCcrIEFkZCBpdGVtJykub25DbGljaygoKSA9PiB7XG4gICAgICAgIGRyYWZ0Lml0ZW1zIS5wdXNoKHsgZW1vamk6ICcnLCBsYWJlbDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25TYXZlKGRyYWZ0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIE9ubHkgYXNzaWduIHNhZmUgQ1NTIGNvbG9yIHZhbHVlczsgcmVqZWN0IHBvdGVudGlhbGx5IG1hbGljaW91cyBzdHJpbmdzXG5jb25zdCBDT0xPUl9SRSA9IC9eKCNbMC05YS1mQS1GXXszLDh9fFthLXpBLVpdK3xyZ2JhP1xcKFteKV0rXFwpfGhzbGE/XFwoW14pXStcXCkpJC87XG5cbnR5cGUgUXVvdGVzQ29uZmlnID0ge1xuICBzb3VyY2U/OiAndGFnJyB8ICd0ZXh0JztcbiAgdGFnPzogc3RyaW5nO1xuICBxdW90ZXM/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBjb2x1bW5zPzogbnVtYmVyO1xuICBtYXhJdGVtcz86IG51bWJlcjtcbiAgaGVpZ2h0TW9kZT86ICd3cmFwJyB8ICdleHRlbmQnO1xufTtcblxuZXhwb3J0IGNsYXNzIFF1b3Rlc0xpc3RCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygncXVvdGVzLWxpc3QtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHF1b3Rlcy4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHNvdXJjZSA9ICd0YWcnLCB0YWcgPSAnJywgcXVvdGVzID0gJycsIHRpdGxlID0gJ1F1b3RlcycsIGNvbHVtbnMgPSAyLCBtYXhJdGVtcyA9IDIwLCBoZWlnaHRNb2RlID0gJ3dyYXAnIH0gPVxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgUXVvdGVzQ29uZmlnO1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGlmIChoZWlnaHRNb2RlID09PSAnZXh0ZW5kJykgZWwuYWRkQ2xhc3MoJ3F1b3Rlcy1saXN0LWJsb2NrLS1leHRlbmQnKTtcblxuICAgIGNvbnN0IGNvbHNFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3F1b3Rlcy1jb2x1bW5zJyB9KTtcblxuICAgIGNvbnN0IE1JTl9DT0xfV0lEVEggPSAyMDA7XG4gICAgY29uc3QgdXBkYXRlQ29scyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHcgPSBjb2xzRWwub2Zmc2V0V2lkdGg7XG4gICAgICBjb25zdCBlZmZlY3RpdmUgPSB3ID4gMCA/IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIE1hdGguZmxvb3IodyAvIE1JTl9DT0xfV0lEVEgpKSkgOiBjb2x1bW5zO1xuICAgICAgY29sc0VsLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7ZWZmZWN0aXZlfSwgMWZyKWA7XG4gICAgfTtcbiAgICB1cGRhdGVDb2xzKCk7XG4gICAgY29uc3Qgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIodXBkYXRlQ29scyk7XG4gICAgcm8ub2JzZXJ2ZShjb2xzRWwpO1xuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcm8uZGlzY29ubmVjdCgpKTtcblxuICAgIGlmIChzb3VyY2UgPT09ICd0ZXh0Jykge1xuICAgICAgdGhpcy5yZW5kZXJUZXh0UXVvdGVzKGNvbHNFbCwgcXVvdGVzLCBtYXhJdGVtcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc291cmNlID09PSAndGFnJ1xuICAgIGlmICghdGFnKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEFDfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHB1bGwgcXVvdGVzIGZyb20geW91ciBub3Rlcy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCkuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgLy8gUmVhZCBhbGwgZmlsZXMgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBmaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICAgIHJldHVybiB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH07XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgcmVzdWx0LnJlYXNvbik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH0gPSByZXN1bHQudmFsdWU7XG4gICAgICBjb25zdCBjb2xvciA9IGNhY2hlPy5mcm9udG1hdHRlcj8uY29sb3IgYXMgc3RyaW5nID8/ICcnO1xuICAgICAgY29uc3QgYm9keSA9IHRoaXMuZXh0cmFjdEJvZHkoY29udGVudCwgY2FjaGUpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IHF1b3RlID0gaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGNvbG9yIGJlZm9yZSBhcHBseWluZyB0byBwcmV2ZW50IENTUyBpbmplY3Rpb25cbiAgICAgIGlmIChjb2xvciAmJiBDT0xPUl9SRS50ZXN0KGNvbG9yKSkge1xuICAgICAgICBxdW90ZS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBjb2xvcjtcbiAgICAgICAgcXVvdGUuc3R5bGUuY29sb3IgPSBjb2xvcjtcbiAgICAgIH1cblxuICAgICAgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgcXVvdGVzIGZyb20gcGxhaW4gdGV4dC4gRWFjaCBxdW90ZSBpcyBzZXBhcmF0ZWQgYnkgYC0tLWAgb24gaXRzIG93biBsaW5lLlxuICAgKiBPcHRpb25hbGx5IGEgc291cmNlIGxpbmUgY2FuIGZvbGxvdyB0aGUgcXVvdGUgdGV4dCwgcHJlZml4ZWQgd2l0aCBgXHUyMDE0YCwgYFx1MjAxM2AsIG9yIGAtLWAuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqICAgVGhlIG9ubHkgd2F5IHRvIGRvIGdyZWF0IHdvcmsgaXMgdG8gbG92ZSB3aGF0IHlvdSBkby5cbiAgICogICBcdTIwMTQgU3RldmUgSm9ic1xuICAgKiAgIC0tLVxuICAgKiAgIEluIHRoZSBtaWRkbGUgb2YgZGlmZmljdWx0eSBsaWVzIG9wcG9ydHVuaXR5LlxuICAgKiAgIFx1MjAxNCBBbGJlcnQgRWluc3RlaW5cbiAgICovXG4gIHByaXZhdGUgcmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWw6IEhUTUxFbGVtZW50LCByYXc6IHN0cmluZywgbWF4SXRlbXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghcmF3LnRyaW0oKSkge1xuICAgICAgY29uc3QgaGludCA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRBQ30nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gcXVvdGVzIHlldC4gQWRkIHRoZW0gaW4gc2V0dGluZ3MsIHNlcGFyYXRlZCBieSAtLS0uJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBibG9ja3MgPSByYXcuc3BsaXQoL1xcbi0tLVxcbi8pLm1hcChiID0+IGIudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gYmxvY2suc3BsaXQoJ1xcbicpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgaGFzU291cmNlID0gbGluZXMubGVuZ3RoID4gMSAmJiAvXihcdTIwMTR8XHUyMDEzfC0tKS8udGVzdChsYXN0TGluZSk7XG4gICAgICBjb25zdCBzb3VyY2VUZXh0ID0gaGFzU291cmNlID8gbGFzdExpbmUucmVwbGFjZSgvXihcdTIwMTR8XHUyMDEzfC0tKVxccyovLCAnJykgOiAnJztcbiAgICAgIGNvbnN0IGJvZHlMaW5lcyA9IGhhc1NvdXJjZSA/IGxpbmVzLnNsaWNlKDAsIC0xKSA6IGxpbmVzO1xuICAgICAgY29uc3QgYm9keSA9IGJvZHlMaW5lcy5qb2luKCcgJyk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG4gICAgICBpZiAoc291cmNlVGV4dCkgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBzb3VyY2VUZXh0IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBFeHRyYWN0IHRoZSBmaXJzdCBmZXcgbGluZXMgb2YgYm9keSBjb250ZW50IHVzaW5nIG1ldGFkYXRhQ2FjaGUgZnJvbnRtYXR0ZXIgb2Zmc2V0LiAqL1xuICBwcml2YXRlIGV4dHJhY3RCb2R5KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcbiAgICBjb25zdCBsaW5lcyA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSk7XG4gICAgcmV0dXJuIGxpbmVzLnNsaWNlKDAsIDMpLmpvaW4oJyAnKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgUXVvdGVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFF1b3Rlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1b3RlcyBMaXN0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyBRdW90ZXNDb25maWc7XG4gICAgZHJhZnQuc291cmNlID8/PSAndGFnJztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBTb3VyY2UgdG9nZ2xlIFx1MjAxNCBzaG93cy9oaWRlcyB0aGUgcmVsZXZhbnQgc2VjdGlvblxuICAgIGxldCB0YWdTZWN0aW9uOiBIVE1MRWxlbWVudDtcbiAgICBsZXQgdGV4dFNlY3Rpb246IEhUTUxFbGVtZW50O1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1NvdXJjZScpXG4gICAgICAuc2V0RGVzYygnUHVsbCBxdW90ZXMgZnJvbSB0YWdnZWQgbm90ZXMsIG9yIGVudGVyIHRoZW0gbWFudWFsbHkuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd0YWcnLCAnTm90ZXMgd2l0aCB0YWcnKVxuICAgICAgICAgLmFkZE9wdGlvbigndGV4dCcsICdNYW51YWwgdGV4dCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuc291cmNlID8/ICd0YWcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4ge1xuICAgICAgICAgICBkcmFmdC5zb3VyY2UgPSB2IGFzICd0YWcnIHwgJ3RleHQnO1xuICAgICAgICAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBUYWcgc2VjdGlvblxuICAgIHRhZ1NlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgIG5ldyBTZXR0aW5nKHRhZ1NlY3Rpb24pLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFRleHQgc2VjdGlvblxuICAgIHRleHRTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgIGNvbnN0IHRleHRTZXR0aW5nID0gbmV3IFNldHRpbmcodGV4dFNlY3Rpb24pXG4gICAgICAuc2V0TmFtZSgnUXVvdGVzJylcbiAgICAgIC5zZXREZXNjKCdTZXBhcmF0ZSBxdW90ZXMgd2l0aCAtLS0gb24gaXRzIG93biBsaW5lLiBBZGQgYSBzb3VyY2UgbGluZSBzdGFydGluZyB3aXRoIFx1MjAxNCAoZS5nLiBcdTIwMTQgQXV0aG9yKS4nKTtcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdjb2x1bW4nO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5hbGlnbkl0ZW1zID0gJ3N0cmV0Y2gnO1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGV4dFNldHRpbmcuc2V0dGluZ0VsLmNyZWF0ZUVsKCd0ZXh0YXJlYScpO1xuICAgIHRleHRhcmVhLnJvd3MgPSA4O1xuICAgIHRleHRhcmVhLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIHRleHRhcmVhLnN0eWxlLm1hcmdpblRvcCA9ICc4cHgnO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRGYW1pbHkgPSAndmFyKC0tZm9udC1tb25vc3BhY2UpJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LnF1b3RlcyA/PyAnJztcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQucXVvdGVzID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIZWlnaHQgbW9kZScpXG4gICAgICAuc2V0RGVzYygnV3JhcDogZml4ZWQgaGVpZ2h0IHdpdGggc2Nyb2xsYmFyLiBFeHRlbmQ6IGJsb2NrIGdyb3dzIHRvIHNob3cgYWxsIHF1b3Rlcy4nKVxuICAgICAgLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgICAgZC5hZGRPcHRpb24oJ3dyYXAnLCAnV3JhcCAoc2Nyb2xsKScpXG4gICAgICAgICAuYWRkT3B0aW9uKCdleHRlbmQnLCAnRXh0ZW5kIChzaG93IGFsbCknKVxuICAgICAgICAgLnNldFZhbHVlKGRyYWZ0LmhlaWdodE1vZGUgPz8gJ3dyYXAnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5oZWlnaHRNb2RlID0gdiBhcyAnd3JhcCcgfCAnZXh0ZW5kJzsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+XG4gICAgICBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQge1xuICAgIHRoaXMub25DaG9vc2UoZm9sZGVyKTtcbiAgfVxufVxuXG5jb25zdCBJTUFHRV9FWFRTID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy53ZWJwJywgJy5zdmcnXSk7XG5jb25zdCBWSURFT19FWFRTID0gbmV3IFNldChbJy5tcDQnLCAnLndlYm0nLCAnLm1vdicsICcubWt2J10pO1xuXG5leHBvcnQgY2xhc3MgSW1hZ2VHYWxsZXJ5QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2ltYWdlLWdhbGxlcnktYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW1hZ2VHYWxsZXJ5QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgZ2FsbGVyeS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZvbGRlciA9ICcnLCB0aXRsZSA9ICdHYWxsZXJ5JywgY29sdW1ucyA9IDMsIG1heEl0ZW1zID0gMjAsIGxheW91dCA9ICdncmlkJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgbWF4SXRlbXM/OiBudW1iZXI7XG4gICAgICBsYXlvdXQ/OiAnZ3JpZCcgfCAnbWFzb25yeSc7XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBnYWxsZXJ5ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW1hZ2UtZ2FsbGVyeScgfSk7XG5cbiAgICBpZiAobGF5b3V0ID09PSAnbWFzb25yeScpIHtcbiAgICAgIGdhbGxlcnkuYWRkQ2xhc3MoJ21hc29ucnktbGF5b3V0Jyk7XG4gICAgICBjb25zdCB1cGRhdGVDb2xzID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB3ID0gZ2FsbGVyeS5vZmZzZXRXaWR0aDtcbiAgICAgICAgY29uc3QgZWZmZWN0aXZlID0gdyA+IDAgPyBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBNYXRoLmZsb29yKHcgLyAxMDApKSkgOiBjb2x1bW5zO1xuICAgICAgICBnYWxsZXJ5LnN0eWxlLmNvbHVtbnMgPSBTdHJpbmcoZWZmZWN0aXZlKTtcbiAgICAgIH07XG4gICAgICB1cGRhdGVDb2xzKCk7XG4gICAgICBjb25zdCBybyA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVDb2xzKTtcbiAgICAgIHJvLm9ic2VydmUoZ2FsbGVyeSk7XG4gICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IHJvLmRpc2Nvbm5lY3QoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdhbGxlcnkuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoYXV0by1maWxsLCBtaW5tYXgobWF4KDcwcHgsIGNhbGMoMTAwJSAvICR7Y29sdW1uc30pKSwgMWZyKSlgO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyKSB7XG4gICAgICBjb25zdCBoaW50ID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjVCQ31cXHVGRTBGJyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGZvbGRlciBzZWxlY3RlZC4gUGljayBhbiBpbWFnZSBmb2xkZXIgaW4gc2V0dGluZ3MgdG8gZGlzcGxheSBhIGdhbGxlcnkuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KGBGb2xkZXIgXCIke2ZvbGRlcn1cIiBub3QgZm91bmQuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldE1lZGlhRmlsZXMoZm9sZGVyT2JqKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGV4dCA9IGAuJHtmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICBjb25zdCB3cmFwcGVyID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdnYWxsZXJ5LWl0ZW0nIH0pO1xuXG4gICAgICBpZiAoSU1BR0VfRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICBjb25zdCBpbWcgPSB3cmFwcGVyLmNyZWF0ZUVsKCdpbWcnKTtcbiAgICAgICAgaW1nLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgaW1nLmxvYWRpbmcgPSAnbGF6eSc7XG4gICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICB3cmFwcGVyLmFkZENsYXNzKCdnYWxsZXJ5LWl0ZW0tdmlkZW8nKTtcbiAgICAgICAgd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICd2aWRlby1wbGF5LW92ZXJsYXknLCB0ZXh0OiAnXHUyNUI2JyB9KTtcblxuICAgICAgICBjb25zdCB2aWRlbyA9IHdyYXBwZXIuY3JlYXRlRWwoJ3ZpZGVvJykgYXMgSFRNTFZpZGVvRWxlbWVudDtcbiAgICAgICAgdmlkZW8uc3JjID0gdGhpcy5hcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGZpbGUpO1xuICAgICAgICB2aWRlby5tdXRlZCA9IHRydWU7XG4gICAgICAgIHZpZGVvLmxvb3AgPSB0cnVlO1xuICAgICAgICB2aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgICAgICB2aWRlby5wcmVsb2FkID0gJ21ldGFkYXRhJztcblxuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7IHZvaWQgdmlkZW8ucGxheSgpOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4geyB2aWRlby5wYXVzZSgpOyB2aWRlby5jdXJyZW50VGltZSA9IDA7IH0pO1xuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TWVkaWFGaWxlcyhmb2xkZXI6IFRGb2xkZXIpOiBURmlsZVtdIHtcbiAgICBjb25zdCBmaWxlczogVEZpbGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgY29uc3QgZXh0ID0gYC4ke2NoaWxkLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkgfHwgVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICAgICAgZmlsZXMucHVzaChjaGlsZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKGZvbGRlcik7XG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbWFnZUdhbGxlcnlTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW1hZ2UgR2FsbGVyeSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnR2FsbGVyeScpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdGb2xkZXInKVxuICAgICAgLnNldERlc2MoJ1BpY2sgYSB2YXVsdCBmb2xkZXIuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdBdHRhY2htZW50cy9QaG90b3MnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0xheW91dCcpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCdncmlkJywgJ0dyaWQnKS5hZGRPcHRpb24oJ21hc29ucnknLCAnTWFzb25yeScpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5sYXlvdXQgPz8gJ2dyaWQnKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmxheW91dCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBjb25zdCBoaW50ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0QzR9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIG5vdGUgc2VsZWN0ZWQuIENob29zZSBhIGZpbGUgcGF0aCBpbiBzZXR0aW5ncyB0byBlbWJlZCBpdCBoZXJlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29uc3QgaGludCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjRERH0nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gY29udGVudCB5ZXQuIEFkZCBNYXJrZG93biB0ZXh0IGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgJycsIHRoaXMpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFN0YXRpY1RleHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdTdGF0aWMgVGV4dCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSB0ZXh0LicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbnRlbnQnKS5zZXREZXNjKCdTdXBwb3J0cyBNYXJrZG93bi4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LmNvbnRlbnQgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMDtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuY29udGVudCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNhbml0aXplSFRNTFRvRG9tIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgSHRtbEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdodG1sLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGh0bWwgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBodG1sPzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaHRtbC1ibG9jay1jb250ZW50JyB9KTtcblxuICAgIGlmICghaHRtbCkge1xuICAgICAgY29uc3QgaGludCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJzwvPicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBIVE1MIGNvbnRlbnQgeWV0LiBBZGQgeW91ciBtYXJrdXAgaW4gc2V0dGluZ3MuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFBekI7QUFDRSxTQUFRLFlBQVksb0JBQUksSUFBNkI7QUFBQTtBQUFBLEVBRXJELFNBQVMsU0FBNkI7QUFDcEMsU0FBSyxVQUFVLElBQUksUUFBUSxNQUFNLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsSUFBSSxNQUEyQztBQUM3QyxXQUFPLEtBQUssVUFBVSxJQUFJLElBQUk7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBeUI7QUFDdkIsV0FBTyxNQUFNLEtBQUssS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN2QjtBQUNGO0FBRU8sSUFBTSxnQkFBZ0IsSUFBSSxtQkFBbUI7OztBRGY3QyxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQWV0QixZQUNFLGFBQ1EsS0FDQSxRQUNBLGdCQUNSO0FBSFE7QUFDQTtBQUNBO0FBakJWLFNBQVEsU0FBUyxvQkFBSSxJQUF3RDtBQUM3RSxTQUFRLFdBQVc7QUFFbkI7QUFBQSxTQUFRLHdCQUFnRDtBQUV4RDtBQUFBLFNBQVEsY0FBa0M7QUFDMUMsU0FBUSxpQkFBd0M7QUFDaEQsU0FBUSxtQkFBbUI7QUFFM0I7QUFBQSw2QkFBeUM7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SUFDTDtBQUVGLFFBQUksMEJBQVEsV0FBVyxFQUNwQixRQUFRLGlCQUFpQixFQUN6QixRQUFRLHVDQUF1QyxFQUMvQztBQUFBLE1BQVksVUFDWCxLQUNHLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFNBQVMsT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLENBQUMsRUFDM0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sVUFBVSxPQUFPLEtBQUs7QUFDekMsY0FBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIkZvbGRlclN1Z2dlc3RNb2RhbCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSJdCn0K
