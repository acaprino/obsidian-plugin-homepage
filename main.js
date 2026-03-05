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
      const clone = wrapper.cloneNode(true);
      clone.addClass("block-drag-clone");
      clone.style.width = `${wrapper.offsetWidth}px`;
      clone.style.height = `${wrapper.offsetHeight}px`;
      clone.style.position = "fixed";
      clone.style.left = "0";
      clone.style.top = "0";
      clone.style.pointerEvents = "none";
      const cloneOffsetX = wrapper.offsetWidth / 2;
      clone.style.transform = `translate(${e.clientX - cloneOffsetX}px, ${e.clientY - 20}px) rotate(1.5deg) scale(1.03)`;
      clone.querySelectorAll("button,input,a,[contenteditable]").forEach((el) => {
        el.setAttribute("tabindex", "-1");
        el.style.pointerEvents = "none";
      });
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
      document.body.addClass("is-dragging-block");
      let lastInsertBeforeId = null;
      let lastNewRow = false;
      let pendingX = e.clientX;
      let pendingY = e.clientY;
      let rafId = null;
      const getLiveRects = () => {
        const rects = /* @__PURE__ */ new Map();
        for (const [id, { wrapper: w }] of this.blocks) {
          if (id !== sourceId) rects.set(id, w.getBoundingClientRect());
        }
        return rects;
      };
      const movePlaceholder = (insertBeforeId, newRow) => {
        var _a2;
        if (insertBeforeId === lastInsertBeforeId && newRow === lastNewRow) return;
        lastInsertBeforeId = insertBeforeId;
        lastNewRow = newRow;
        placeholder.remove();
        placeholder.toggleClass("block-drag-placeholder--new-row", newRow);
        if (newRow) {
          placeholder.style.flex = "1 1 100%";
          placeholder.style.height = "48px";
        } else {
          placeholder.style.flex = wrapper.style.flex;
          placeholder.style.height = `${wrapper.offsetHeight}px`;
        }
        if (insertBeforeId) {
          const targetWrapper = (_a2 = this.blocks.get(insertBeforeId)) == null ? void 0 : _a2.wrapper;
          if (targetWrapper) {
            this.gridEl.insertBefore(placeholder, targetWrapper);
          } else {
            this.gridEl.appendChild(placeholder);
          }
        } else {
          this.gridEl.appendChild(placeholder);
        }
      };
      const processFrame = () => {
        rafId = null;
        clone.style.transform = `translate(${pendingX - cloneOffsetX}px, ${pendingY - 20}px) rotate(1.5deg) scale(1.03)`;
        const pt = this.findInsertionPointCached(pendingX, pendingY, sourceId, getLiveRects());
        movePlaceholder(pt.insertBeforeId, pt.newRow);
      };
      const onMouseMove = (me) => {
        pendingX = me.clientX;
        pendingY = me.clientY;
        if (rafId === null) rafId = requestAnimationFrame(processFrame);
      };
      const onMouseUp = (me) => {
        ac.abort();
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        this.activeAbortController = null;
        clone.remove();
        this.activeClone = null;
        placeholder.remove();
        wrapper.removeClass("block-dragging");
        document.body.removeClass("is-dragging-block");
        const pt = this.findInsertionPointCached(me.clientX, me.clientY, sourceId, getLiveRects());
        this.reorderBlock(sourceId, pt.insertBeforeId, pt.newRow);
        const landedEntry = this.blocks.get(sourceId);
        if (landedEntry) {
          landedEntry.wrapper.addClass("block-drop-landed");
          setTimeout(() => landedEntry.wrapper.removeClass("block-drop-landed"), 450);
        }
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
    let bestNewRow = false;
    for (const [id, rect] of rects) {
      if (id === excludeId) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const insertBefore = x < cx;
        return { insertBeforeId: insertBefore ? id : this.nextBlockId(id), newRow: false };
      }
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTargetId = id;
        bestInsertBefore = x < cx;
        bestNewRow = y > cy + rect.height / 4;
      }
    }
    if (!bestTargetId) return { insertBeforeId: null, newRow: false };
    return {
      insertBeforeId: bestInsertBefore ? bestTargetId : this.nextBlockId(bestTargetId),
      newRow: bestNewRow
    };
  }
  nextBlockId(id) {
    const blocks = this.plugin.layout.blocks;
    const idx = blocks.findIndex((b) => b.id === id);
    return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1].id : null;
  }
  /** Remove the dragged block from its current position and insert it before insertBeforeId (null = append). */
  reorderBlock(draggedId, insertBeforeId, newRow) {
    const blocks = this.plugin.layout.blocks;
    const dragged = blocks.find((b) => b.id === draggedId);
    if (!dragged) return;
    const withoutDragged = blocks.filter((b) => b.id !== draggedId);
    const insertAt = insertBeforeId ? withoutDragged.findIndex((b) => b.id === insertBeforeId) : withoutDragged.length;
    const originalIdx = blocks.findIndex((b) => b.id === draggedId);
    const resolvedAt = insertAt === -1 ? withoutDragged.length : insertAt;
    const samePosition = resolvedAt === originalIdx || resolvedAt === originalIdx + 1;
    if (samePosition && !!dragged.newRow === newRow) return;
    const draggedWithRow = newRow ? { ...dragged, newRow: true } : { ...dragged, newRow: void 0 };
    const newBlocks = [
      ...withoutDragged.slice(0, resolvedAt),
      draggedWithRow,
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
    document.body.removeClass("is-dragging-block");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiYgTnVtYmVyLmlzRmluaXRlKGJsb2NrLnJvd1NwYW4pICYmXG4gICAgKGJsb2NrLm5ld1JvdyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBibG9jay5uZXdSb3cgPT09ICdib29sZWFuJykgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdRdWljayBMaW5rcycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJ1F1aWNrIExpbmtzJywgZm9sZGVyOiAnJywgbGlua3M6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEZvbGRlckxpbmtzQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2luc2lnaHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnRGFpbHkgSW5zaWdodCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW5zaWdodEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICd0YWctZ3JpZCcsXG4gICAgZGlzcGxheU5hbWU6ICdWYWx1ZXMnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtZWRpdC1tb2RlJyxcbiAgICAgIG5hbWU6ICdUb2dnbGUgZWRpdCBtb2RlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xuICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgIGxlYWYudmlldy50b2dnbGVFZGl0TW9kZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBhYm92ZSBncmlkOyBGQUIgZmxvYXRzIGluZGVwZW5kZW50bHkgKGFscmVhZHkgaW4gY29udGVudEVsIHZpYSBFZGl0VG9vbGJhcilcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuICAgIGNvbnRlbnRFbC5pbnNlcnRCZWZvcmUodGhpcy50b29sYmFyLmdldEZhYkVsZW1lbnQoKSwgdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zLCB0cnVlKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogVG9nZ2xlIGVkaXQgbW9kZSBcdTIwMTQgY2FsbGVkIGZyb20ga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyPy50b2dnbGVFZGl0TW9kZSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5jb25zdCBNQVhfUk9XX1NQQU4gPSAxMjtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGVmZmVjdGl2ZUNvbHVtbnMgPSAzO1xuICAvKiogQ2FsbGJhY2sgdG8gdHJpZ2dlciB0aGUgQWRkIEJsb2NrIG1vZGFsIGZyb20gdGhlIGVtcHR5IHN0YXRlIENUQS4gKi9cbiAgb25SZXF1ZXN0QWRkQmxvY2s6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICAvKiogSUQgb2YgdGhlIG1vc3QgcmVjZW50bHkgYWRkZWQgYmxvY2sgXHUyMDE0IHVzZWQgZm9yIHNjcm9sbC1pbnRvLXZpZXcuICovXG4gIHByaXZhdGUgbGFzdEFkZGVkQmxvY2tJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0VmZmVjdGl2ZSA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnModGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgICAgaWYgKG5ld0VmZmVjdGl2ZSAhPT0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5ncmlkRWwpO1xuICB9XG5cbiAgLyoqIEV4cG9zZSB0aGUgcm9vdCBncmlkIGVsZW1lbnQgc28gSG9tZXBhZ2VWaWV3IGNhbiByZW9yZGVyIGl0IGluIHRoZSBET00uICovXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmdyaWRFbDtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMobGF5b3V0Q29sdW1uczogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCB3ID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGg7XG4gICAgaWYgKHcgPD0gMCkgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gICAgaWYgKHcgPD0gNTQwKSByZXR1cm4gMTtcbiAgICBpZiAodyA8PSA4NDApIHJldHVybiBNYXRoLm1pbigyLCBsYXlvdXRDb2x1bW5zKTtcbiAgICBpZiAodyA8PSAxMDI0KSByZXR1cm4gTWF0aC5taW4oMywgbGF5b3V0Q29sdW1ucyk7XG4gICAgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gIH1cblxuICByZW5kZXIoYmxvY2tzOiBCbG9ja0luc3RhbmNlW10sIGNvbHVtbnM6IG51bWJlciwgaXNJbml0aWFsID0gZmFsc2UpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0Jyk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIGJsb2NrcycpO1xuICAgIHRoaXMuZWZmZWN0aXZlQ29sdW1ucyA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMoY29sdW1ucyk7XG5cbiAgICAvLyBTdGFnZ2VyIGFuaW1hdGlvbiBvbmx5IG9uIHRoZSBpbml0aWFsIHJlbmRlciAobm90IHJlb3JkZXIvY29sbGFwc2UvY29sdW1uIGNoYW5nZSlcbiAgICBpZiAoaXNJbml0aWFsKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnaG9tZXBhZ2UtZ3JpZC0tYW5pbWF0aW5nJyk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdob21lcGFnZS1ncmlkLS1hbmltYXRpbmcnKSwgNTAwKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmdyaWRFbC5yZW1vdmVDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktc3RhdGUnIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktaWNvbicsIHRleHQ6ICdcXHV7MUYzRTB9JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS10aXRsZScsIHRleHQ6ICdZb3VyIGhvbWVwYWdlIGlzIGVtcHR5JyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywge1xuICAgICAgICBjbHM6ICdob21lcGFnZS1lbXB0eS1kZXNjJyxcbiAgICAgICAgdGV4dDogdGhpcy5lZGl0TW9kZVxuICAgICAgICAgID8gJ0NsaWNrIHRoZSBidXR0b24gYmVsb3cgdG8gYWRkIHlvdXIgZmlyc3QgYmxvY2suJ1xuICAgICAgICAgIDogJ0FkZCBibG9ja3MgdG8gYnVpbGQgeW91ciBwZXJzb25hbCBkYXNoYm9hcmQuIFRvZ2dsZSBFZGl0IG1vZGUgaW4gdGhlIHRvb2xiYXIgdG8gZ2V0IHN0YXJ0ZWQuJyxcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgdGhpcy5vblJlcXVlc3RBZGRCbG9jaykge1xuICAgICAgICBjb25zdCBjdGEgPSBlbXB0eS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdob21lcGFnZS1lbXB0eS1jdGEnLCB0ZXh0OiAnQWRkIFlvdXIgRmlyc3QgQmxvY2snIH0pO1xuICAgICAgICBjdGEuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IHRoaXMub25SZXF1ZXN0QWRkQmxvY2s/LigpOyB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGJsb2Nrcykge1xuICAgICAgdGhpcy5yZW5kZXJCbG9jayhpbnN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldChpbnN0YW5jZS50eXBlKTtcbiAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgIGlmIChpbnN0YW5jZS5uZXdSb3cpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXJvdy1icmVhaycgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvLyBIZWFkZXIgem9uZSBcdTIwMTQgYWx3YXlzIHZpc2libGU7IGhvdXNlcyB0aXRsZSArIGNvbGxhcHNlIGNoZXZyb25cbiAgICBjb25zdCBoZWFkZXJab25lID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXItem9uZScgfSk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaW5zdGFuY2UuY29sbGFwc2VkKSk7XG4gICAgY29uc3QgY2hldnJvbiA9IGhlYWRlclpvbmUuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWNvbGxhcHNlLWNoZXZyb24nIH0pO1xuICAgIGNoZXZyb24uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2suc2V0SGVhZGVyQ29udGFpbmVyKGhlYWRlclpvbmUpO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5jb2xsYXBzZWQpIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuXG4gICAgY29uc3QgdG9nZ2xlQ29sbGFwc2UgPSAoZTogRXZlbnQpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSkgcmV0dXJuOyAvLyBlZGl0IG1vZGU6IGhhbmRsZSBiYXIgb3ducyBpbnRlcmFjdGlvblxuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjaGV2cm9uLnRvZ2dsZUNsYXNzKCdpcy1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaXNOb3dDb2xsYXBzZWQpKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbGxhcHNlZDogaXNOb3dDb2xsYXBzZWQgfSA6IGIsXG4gICAgICApO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB9O1xuXG4gICAgaGVhZGVyWm9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUNvbGxhcHNlKTtcbiAgICBoZWFkZXJab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0b2dnbGVDb2xsYXBzZShlKTsgfVxuICAgIH0pO1xuXG4gICAgaWYgKGluc3RhbmNlLmNvbGxhcHNlZCkgY2hldnJvbi5hZGRDbGFzcygnaXMtY29sbGFwc2VkJyk7XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIHJvd01pbkhlaWdodChyb3dTcGFuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGlmIChyb3dTcGFuIDw9IDEpIHJldHVybiAnJztcbiAgICByZXR1cm4gYGNhbGModmFyKC0taHAtcm93LXVuaXQsIDIwMHB4KSAqICR7cm93U3Bhbn0gKyB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtyb3dTcGFuIC0gMX0pYDtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgY29scyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oaW5zdGFuY2UuY29sU3BhbiwgY29scyk7XG4gICAgLy8gRm9yIE4gY29sdW1ucyB0aGVyZSBhcmUgKE4tMSkgZ2FwcyBkaXN0cmlidXRlZCBhY3Jvc3MgTiBzbG90cy5cbiAgICAvLyBBIGJsb2NrIHNwYW5uaW5nIFMgY29sdW1ucyBjb3ZlcnMgUyBzbG90cyBhbmQgKFMtMSkgaW50ZXJuYWwgZ2FwcyxcbiAgICAvLyBzbyBpdCBtdXN0IHN1YnRyYWN0IChOLVMpL04gc2hhcmUgb2YgdGhlIHRvdGFsIGdhcCBzcGFjZS5cbiAgICAvLyBGb3JtdWxhOiBiYXNpcyA9IFMvTiAqIDEwMCUgLSAoTi1TKS9OICogZ2FwXG4gICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGNvbFNwYW4gLyBjb2xzKSAqIDEwMDtcbiAgICBjb25zdCBnYXBGcmFjdGlvbiA9IChjb2xzIC0gY29sU3BhbikgLyBjb2xzO1xuICAgIHdyYXBwZXIuc3R5bGUuZmxleCA9IGAke2NvbFNwYW59IDEgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSAqICR7Z2FwRnJhY3Rpb24udG9GaXhlZCg0KX0pYDtcbiAgICB3cmFwcGVyLnN0eWxlLm1pbldpZHRoID0gY29scyA9PT0gMSA/ICcwJyA6ICd2YXIoLS1ocC1jYXJkLW1pbi13aWR0aCwgMjAwcHgpJztcbiAgICB3cmFwcGVyLnN0eWxlLm1pbkhlaWdodCA9IHRoaXMucm93TWluSGVpZ2h0KGluc3RhbmNlLnJvd1NwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hFZGl0SGFuZGxlcyh3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBiYXIgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhhbmRsZS1iYXInIH0pO1xuXG4gICAgY29uc3QgaGFuZGxlID0gYmFyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLW1vdmUtaGFuZGxlJyB9KTtcbiAgICBzZXRJY29uKGhhbmRsZSwgJ2dyaXAtdmVydGljYWwnKTtcbiAgICBoYW5kbGUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuXG4gICAgY29uc3Qgc2V0dGluZ3NCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stc2V0dGluZ3MtYnRuJyB9KTtcbiAgICBzZXRJY29uKHNldHRpbmdzQnRuLCAnc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQmxvY2sgc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmJsb2Nrcy5nZXQoaW5zdGFuY2UuaWQpO1xuICAgICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuICAgICAgY29uc3Qgb25TYXZlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyBpbnN0YW5jZSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuICAgICAgbmV3IEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgaW5zdGFuY2UsIGVudHJ5LmJsb2NrLCBvblNhdmUpLm9wZW4oKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1yZW1vdmUtYnRuJyB9KTtcbiAgICBzZXRJY29uKHJlbW92ZUJ0biwgJ3gnKTtcbiAgICByZW1vdmVCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1JlbW92ZSBibG9jaycpO1xuICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgbmV3IFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsKHRoaXMuYXBwLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgLy8gTW92ZSB1cCAvIGRvd24ga2V5Ym9hcmQtYWNjZXNzaWJsZSByZW9yZGVyIGJ1dHRvbnNcbiAgICBjb25zdCBtb3ZlVXBCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stbW92ZS11cC1idG4nIH0pO1xuICAgIHNldEljb24obW92ZVVwQnRuLCAnY2hldnJvbi11cCcpO1xuICAgIG1vdmVVcEJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTW92ZSBibG9jayB1cCcpO1xuICAgIG1vdmVVcEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaWR4ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoaWR4IDw9IDApIHJldHVybjtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzXTtcbiAgICAgIFtuZXdCbG9ja3NbaWR4IC0gMV0sIG5ld0Jsb2Nrc1tpZHhdXSA9IFtuZXdCbG9ja3NbaWR4XSwgbmV3QmxvY2tzW2lkeCAtIDFdXTtcbiAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbW92ZURvd25CdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stbW92ZS1kb3duLWJ0bicgfSk7XG4gICAgc2V0SWNvbihtb3ZlRG93bkJ0biwgJ2NoZXZyb24tZG93bicpO1xuICAgIG1vdmVEb3duQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdNb3ZlIGJsb2NrIGRvd24nKTtcbiAgICBtb3ZlRG93bkJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaWR4ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoaWR4IDwgMCB8fCBpZHggPj0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5sZW5ndGggLSAxKSByZXR1cm47XG4gICAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrc107XG4gICAgICBbbmV3QmxvY2tzW2lkeF0sIG5ld0Jsb2Nrc1tpZHggKyAxXV0gPSBbbmV3QmxvY2tzW2lkeCArIDFdLCBuZXdCbG9ja3NbaWR4XV07XG4gICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaXAgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLXJlc2l6ZS1ncmlwJyB9KTtcbiAgICBzZXRJY29uKGdyaXAsICdtYXhpbWl6ZS0yJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICB0aGlzLmF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcCwgd3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgdGhpcy5hdHRhY2hEcmFnSGFuZGxlcihoYW5kbGUsIHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgaGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICAvLyBDbG9uZTogcG9zaXRpb24gdmlhIEdQVS1jb21wb3NpdGVkIHRyYW5zZm9ybSAobm8gbGF5b3V0IHJlY2FsYyBvbiBldmVyeSBtb3VzZW1vdmUpXG4gICAgICBjb25zdCBjbG9uZSA9IHdyYXBwZXIuY2xvbmVOb2RlKHRydWUpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgY2xvbmUuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWctY2xvbmUnKTtcbiAgICAgIGNsb25lLnN0eWxlLndpZHRoID0gYCR7d3JhcHBlci5vZmZzZXRXaWR0aH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5oZWlnaHQgPSBgJHt3cmFwcGVyLm9mZnNldEhlaWdodH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XG4gICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gJzAnO1xuICAgICAgY2xvbmUuc3R5bGUudG9wID0gJzAnO1xuICAgICAgY2xvbmUuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgIGNvbnN0IGNsb25lT2Zmc2V0WCA9IHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyO1xuICAgICAgY2xvbmUuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2UuY2xpZW50WCAtIGNsb25lT2Zmc2V0WH1weCwgJHtlLmNsaWVudFkgLSAyMH1weCkgcm90YXRlKDEuNWRlZykgc2NhbGUoMS4wMylgO1xuICAgICAgY2xvbmUucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJ2J1dHRvbixpbnB1dCxhLFtjb250ZW50ZWRpdGFibGVdJylcbiAgICAgICAgLmZvckVhY2goZWwgPT4geyBlbC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJy0xJyk7IGVsLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7IH0pO1xuICAgICAgY29uc3QgdGhlbWVkID0gKHRoaXMuZ3JpZEVsLmNsb3Nlc3QoJy5hcHAtY29udGFpbmVyJykgPz8gZG9jdW1lbnQuYm9keSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGVtZWQuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICAvLyBQbGFjZWhvbGRlciBcdTIwMTQgaW5zdGFudCBET00gaW5zZXJ0aW9uLCBubyBvcGFjaXR5IGFuaW1hdGlvbiAocHJldmVudHMgc3Ryb2JlIG9uIGZhc3QgbW92ZXMpXG4gICAgICBjb25zdCBwbGFjZWhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgcGxhY2Vob2xkZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWctcGxhY2Vob2xkZXInKTtcbiAgICAgIHBsYWNlaG9sZGVyLnN0eWxlLmZsZXggPSB3cmFwcGVyLnN0eWxlLmZsZXg7XG4gICAgICBwbGFjZWhvbGRlci5zdHlsZS5taW5XaWR0aCA9IHdyYXBwZXIuc3R5bGUubWluV2lkdGg7XG4gICAgICBwbGFjZWhvbGRlci5zdHlsZS5oZWlnaHQgPSBgJHt3cmFwcGVyLm9mZnNldEhlaWdodH1weGA7XG4gICAgICB3cmFwcGVyLmluc2VydEFkamFjZW50RWxlbWVudCgnYWZ0ZXJlbmQnLCBwbGFjZWhvbGRlcik7XG5cbiAgICAgIGNvbnN0IHNvdXJjZUlkID0gaW5zdGFuY2UuaWQ7XG4gICAgICB3cmFwcGVyLmFkZENsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuICAgICAgZG9jdW1lbnQuYm9keS5hZGRDbGFzcygnaXMtZHJhZ2dpbmctYmxvY2snKTtcblxuICAgICAgbGV0IGxhc3RJbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICBsZXQgbGFzdE5ld1JvdyA9IGZhbHNlO1xuICAgICAgbGV0IHBlbmRpbmdYID0gZS5jbGllbnRYO1xuICAgICAgbGV0IHBlbmRpbmdZID0gZS5jbGllbnRZO1xuICAgICAgbGV0IHJhZklkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgICAgY29uc3QgZ2V0TGl2ZVJlY3RzID0gKCk6IE1hcDxzdHJpbmcsIERPTVJlY3Q+ID0+IHtcbiAgICAgICAgY29uc3QgcmVjdHMgPSBuZXcgTWFwPHN0cmluZywgRE9NUmVjdD4oKTtcbiAgICAgICAgZm9yIChjb25zdCBbaWQsIHsgd3JhcHBlcjogdyB9XSBvZiB0aGlzLmJsb2Nrcykge1xuICAgICAgICAgIGlmIChpZCAhPT0gc291cmNlSWQpIHJlY3RzLnNldChpZCwgdy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlY3RzO1xuICAgICAgfTtcblxuICAgICAgY29uc3QgbW92ZVBsYWNlaG9sZGVyID0gKGluc2VydEJlZm9yZUlkOiBzdHJpbmcgfCBudWxsLCBuZXdSb3c6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgaWYgKGluc2VydEJlZm9yZUlkID09PSBsYXN0SW5zZXJ0QmVmb3JlSWQgJiYgbmV3Um93ID09PSBsYXN0TmV3Um93KSByZXR1cm47XG4gICAgICAgIGxhc3RJbnNlcnRCZWZvcmVJZCA9IGluc2VydEJlZm9yZUlkO1xuICAgICAgICBsYXN0TmV3Um93ID0gbmV3Um93O1xuICAgICAgICBwbGFjZWhvbGRlci5yZW1vdmUoKTtcbiAgICAgICAgcGxhY2Vob2xkZXIudG9nZ2xlQ2xhc3MoJ2Jsb2NrLWRyYWctcGxhY2Vob2xkZXItLW5ldy1yb3cnLCBuZXdSb3cpO1xuICAgICAgICBpZiAobmV3Um93KSB7XG4gICAgICAgICAgcGxhY2Vob2xkZXIuc3R5bGUuZmxleCA9ICcxIDEgMTAwJSc7XG4gICAgICAgICAgcGxhY2Vob2xkZXIuc3R5bGUuaGVpZ2h0ID0gJzQ4cHgnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBsYWNlaG9sZGVyLnN0eWxlLmZsZXggPSB3cmFwcGVyLnN0eWxlLmZsZXg7XG4gICAgICAgICAgcGxhY2Vob2xkZXIuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpbnNlcnRCZWZvcmVJZCkge1xuICAgICAgICAgIGNvbnN0IHRhcmdldFdyYXBwZXIgPSB0aGlzLmJsb2Nrcy5nZXQoaW5zZXJ0QmVmb3JlSWQpPy53cmFwcGVyO1xuICAgICAgICAgIGlmICh0YXJnZXRXcmFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmdyaWRFbC5pbnNlcnRCZWZvcmUocGxhY2Vob2xkZXIsIHRhcmdldFdyYXBwZXIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdyaWRFbC5hcHBlbmRDaGlsZChwbGFjZWhvbGRlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZ3JpZEVsLmFwcGVuZENoaWxkKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gckFGLXRocm90dGxlZCBmcmFtZTogYmF0Y2hlcyBjbG9uZSBtb3ZlICsgcGxhY2Vob2xkZXIgdXBkYXRlIGludG8gb25lIHBhaW50IGN5Y2xlXG4gICAgICBjb25zdCBwcm9jZXNzRnJhbWUgPSAoKSA9PiB7XG4gICAgICAgIHJhZklkID0gbnVsbDtcbiAgICAgICAgY2xvbmUuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke3BlbmRpbmdYIC0gY2xvbmVPZmZzZXRYfXB4LCAke3BlbmRpbmdZIC0gMjB9cHgpIHJvdGF0ZSgxLjVkZWcpIHNjYWxlKDEuMDMpYDtcbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludENhY2hlZChwZW5kaW5nWCwgcGVuZGluZ1ksIHNvdXJjZUlkLCBnZXRMaXZlUmVjdHMoKSk7XG4gICAgICAgIG1vdmVQbGFjZWhvbGRlcihwdC5pbnNlcnRCZWZvcmVJZCwgcHQubmV3Um93KTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIHBlbmRpbmdYID0gbWUuY2xpZW50WDtcbiAgICAgICAgcGVuZGluZ1kgPSBtZS5jbGllbnRZO1xuICAgICAgICBpZiAocmFmSWQgPT09IG51bGwpIHJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHByb2Nlc3NGcmFtZSk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlVXAgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgaWYgKHJhZklkICE9PSBudWxsKSB7IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZklkKTsgcmFmSWQgPSBudWxsOyB9XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICAgICAgY2xvbmUucmVtb3ZlKCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuICAgICAgICBwbGFjZWhvbGRlci5yZW1vdmUoKTtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmctYmxvY2snKTtcblxuICAgICAgICBjb25zdCBwdCA9IHRoaXMuZmluZEluc2VydGlvblBvaW50Q2FjaGVkKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkLCBnZXRMaXZlUmVjdHMoKSk7XG4gICAgICAgIHRoaXMucmVvcmRlckJsb2NrKHNvdXJjZUlkLCBwdC5pbnNlcnRCZWZvcmVJZCwgcHQubmV3Um93KTtcblxuICAgICAgICAvLyBEcm9wIGNvbmZpcm1hdGlvbiBmbGFzaCBvbiB0aGUgbGFuZGVkIHdyYXBwZXJcbiAgICAgICAgY29uc3QgbGFuZGVkRW50cnkgPSB0aGlzLmJsb2Nrcy5nZXQoc291cmNlSWQpO1xuICAgICAgICBpZiAobGFuZGVkRW50cnkpIHtcbiAgICAgICAgICBsYW5kZWRFbnRyeS53cmFwcGVyLmFkZENsYXNzKCdibG9jay1kcm9wLWxhbmRlZCcpO1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gbGFuZGVkRW50cnkud3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC1sYW5kZWQnKSwgNDUwKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRZID0gZS5jbGllbnRZO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IHN0YXJ0Um93U3BhbiA9IGluc3RhbmNlLnJvd1NwYW47XG4gICAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zO1xuICAgICAgY29uc3QgY29sV2lkdGggPSB0aGlzLmdyaWRFbC5vZmZzZXRXaWR0aCAvIGNvbHVtbnM7XG4gICAgICBjb25zdCByb3dVbml0UHggPVxuICAgICAgICBNYXRoLm1heCg1MCwgcGFyc2VGbG9hdChcbiAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZ3JpZEVsKS5nZXRQcm9wZXJ0eVZhbHVlKCctLWhwLXJvdy11bml0JykudHJpbSgpLFxuICAgICAgICApIHx8IDIwMCk7XG4gICAgICBsZXQgY3VycmVudENvbFNwYW4gPSBzdGFydENvbFNwYW47XG4gICAgICBsZXQgY3VycmVudFJvd1NwYW4gPSBzdGFydFJvd1NwYW47XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IG1lLmNsaWVudFggLSBzdGFydFg7XG4gICAgICAgIGNvbnN0IGRlbHRhWSA9IG1lLmNsaWVudFkgLSBzdGFydFk7XG4gICAgICAgIGNvbnN0IGRlbHRhQ29scyA9IE1hdGgucm91bmQoZGVsdGFYIC8gY29sV2lkdGgpO1xuICAgICAgICBjb25zdCBkZWx0YVJvd3MgPSBNYXRoLnJvdW5kKGRlbHRhWSAvIHJvd1VuaXRQeCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGN1cnJlbnRSb3dTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oTUFYX1JPV19TUEFOLCBzdGFydFJvd1NwYW4gKyBkZWx0YVJvd3MpKTtcbiAgICAgICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGN1cnJlbnRDb2xTcGFuIC8gY29sdW1ucykgKiAxMDA7XG4gICAgICAgIGNvbnN0IGdhcEZyYWN0aW9uID0gKGNvbHVtbnMgLSBjdXJyZW50Q29sU3BhbikgLyBjb2x1bW5zO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMSBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtnYXBGcmFjdGlvbi50b0ZpeGVkKDQpfSlgO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLm1pbkhlaWdodCA9IHRoaXMucm93TWluSGVpZ2h0KGN1cnJlbnRSb3dTcGFuKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4sIHJvd1NwYW46IGN1cnJlbnRSb3dTcGFuIH0gOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kSW5zZXJ0aW9uUG9pbnRDYWNoZWQoXG4gICAgeDogbnVtYmVyLFxuICAgIHk6IG51bWJlcixcbiAgICBleGNsdWRlSWQ6IHN0cmluZyxcbiAgICByZWN0czogTWFwPHN0cmluZywgRE9NUmVjdD4sXG4gICk6IHsgaW5zZXJ0QmVmb3JlSWQ6IHN0cmluZyB8IG51bGw7IG5ld1JvdzogYm9vbGVhbiB9IHtcbiAgICBsZXQgYmVzdFRhcmdldElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgYmVzdERpc3QgPSBJbmZpbml0eTtcbiAgICBsZXQgYmVzdEluc2VydEJlZm9yZSA9IHRydWU7XG4gICAgbGV0IGJlc3ROZXdSb3cgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgW2lkLCByZWN0XSBvZiByZWN0cykge1xuICAgICAgaWYgKGlkID09PSBleGNsdWRlSWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgY3ggPSByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMjtcbiAgICAgIGNvbnN0IGN5ID0gcmVjdC50b3AgKyByZWN0LmhlaWdodCAvIDI7XG5cbiAgICAgIC8vIElmIGN1cnNvciBpcyBkaXJlY3RseSBvdmVyIHRoaXMgY2FyZCwgdXNlIGhvcml6b250YWwgcG9zaXRpb24gb25seSAobm8gbmV3LXJvdylcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIGNvbnN0IGluc2VydEJlZm9yZSA9IHggPCBjeDtcbiAgICAgICAgcmV0dXJuIHsgaW5zZXJ0QmVmb3JlSWQ6IGluc2VydEJlZm9yZSA/IGlkIDogdGhpcy5uZXh0QmxvY2tJZChpZCksIG5ld1JvdzogZmFsc2UgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGlzdCA9IE1hdGguaHlwb3QoeCAtIGN4LCB5IC0gY3kpO1xuICAgICAgaWYgKGRpc3QgPCBiZXN0RGlzdCkge1xuICAgICAgICBiZXN0RGlzdCA9IGRpc3Q7XG4gICAgICAgIGJlc3RUYXJnZXRJZCA9IGlkO1xuICAgICAgICBiZXN0SW5zZXJ0QmVmb3JlID0geCA8IGN4O1xuICAgICAgICBiZXN0TmV3Um93ID0geSA+IGN5ICsgcmVjdC5oZWlnaHQgLyA0OyAvLyBvbmx5IGZsYWcgbmV3Um93IGlmIGNsZWFybHkgYmVsb3cgY2VudGVyXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFiZXN0VGFyZ2V0SWQpIHJldHVybiB7IGluc2VydEJlZm9yZUlkOiBudWxsLCBuZXdSb3c6IGZhbHNlIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIGluc2VydEJlZm9yZUlkOiBiZXN0SW5zZXJ0QmVmb3JlID8gYmVzdFRhcmdldElkIDogdGhpcy5uZXh0QmxvY2tJZChiZXN0VGFyZ2V0SWQpLFxuICAgICAgbmV3Um93OiBiZXN0TmV3Um93LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG5leHRCbG9ja0lkKGlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBibG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzO1xuICAgIGNvbnN0IGlkeCA9IGJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpZCk7XG4gICAgcmV0dXJuIGlkeCA+PSAwICYmIGlkeCA8IGJsb2Nrcy5sZW5ndGggLSAxID8gYmxvY2tzW2lkeCArIDFdLmlkIDogbnVsbDtcbiAgfVxuXG4gIC8qKiBSZW1vdmUgdGhlIGRyYWdnZWQgYmxvY2sgZnJvbSBpdHMgY3VycmVudCBwb3NpdGlvbiBhbmQgaW5zZXJ0IGl0IGJlZm9yZSBpbnNlcnRCZWZvcmVJZCAobnVsbCA9IGFwcGVuZCkuICovXG4gIHByaXZhdGUgcmVvcmRlckJsb2NrKGRyYWdnZWRJZDogc3RyaW5nLCBpbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCwgbmV3Um93OiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgYmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcztcbiAgICBjb25zdCBkcmFnZ2VkID0gYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBkcmFnZ2VkSWQpO1xuICAgIGlmICghZHJhZ2dlZCkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd2l0aG91dERyYWdnZWQgPSBibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gZHJhZ2dlZElkKTtcbiAgICBjb25zdCBpbnNlcnRBdCA9IGluc2VydEJlZm9yZUlkXG4gICAgICA/IHdpdGhvdXREcmFnZ2VkLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc2VydEJlZm9yZUlkKVxuICAgICAgOiB3aXRob3V0RHJhZ2dlZC5sZW5ndGg7XG5cbiAgICAvLyBOby1vcCBpZiBlZmZlY3RpdmVseSBzYW1lIHBvc2l0aW9uIGFuZCBuZXdSb3cgZmxhZyB1bmNoYW5nZWRcbiAgICBjb25zdCBvcmlnaW5hbElkeCA9IGJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBkcmFnZ2VkSWQpO1xuICAgIGNvbnN0IHJlc29sdmVkQXQgPSBpbnNlcnRBdCA9PT0gLTEgPyB3aXRob3V0RHJhZ2dlZC5sZW5ndGggOiBpbnNlcnRBdDtcbiAgICBjb25zdCBzYW1lUG9zaXRpb24gPSByZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCB8fCByZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCArIDE7XG4gICAgaWYgKHNhbWVQb3NpdGlvbiAmJiAhIWRyYWdnZWQubmV3Um93ID09PSBuZXdSb3cpIHJldHVybjtcblxuICAgIGNvbnN0IGRyYWdnZWRXaXRoUm93ID0gbmV3Um93ID8geyAuLi5kcmFnZ2VkLCBuZXdSb3c6IHRydWUgYXMgY29uc3QgfSA6IHsgLi4uZHJhZ2dlZCwgbmV3Um93OiB1bmRlZmluZWQgfTtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbXG4gICAgICAuLi53aXRob3V0RHJhZ2dlZC5zbGljZSgwLCByZXNvbHZlZEF0KSxcbiAgICAgIGRyYWdnZWRXaXRoUm93LFxuICAgICAgLi4ud2l0aG91dERyYWdnZWQuc2xpY2UocmVzb2x2ZWRBdCksXG4gICAgXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgLyoqIFVwZGF0ZSBjb2x1bW4gY291bnQsIGNsYW1waW5nIGVhY2ggYmxvY2sncyBjb2wgYW5kIGNvbFNwYW4gdG8gZml0LiAqL1xuICBzZXRDb2x1bW5zKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgY29uc3QgY29sID0gTWF0aC5taW4oYi5jb2wsIG4pO1xuICAgICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGIuY29sU3BhbiwgbiAtIGNvbCArIDEpO1xuICAgICAgcmV0dXJuIHsgLi4uYiwgY29sLCBjb2xTcGFuIH07XG4gICAgfSk7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgY29sdW1uczogbiwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgYWRkQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgaW5zdGFuY2VdO1xuICAgIHRoaXMubGFzdEFkZGVkQmxvY2tJZCA9IGluc3RhbmNlLmlkO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVyZW5kZXIoKTogdm9pZCB7XG4gICAgY29uc3QgZm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgZm9jdXNlZEJsb2NrSWQgPSAoZm9jdXNlZD8uY2xvc2VzdCgnW2RhdGEtYmxvY2staWRdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uZGF0YXNldC5ibG9ja0lkO1xuICAgIGNvbnN0IHNjcm9sbFRhcmdldElkID0gdGhpcy5sYXN0QWRkZWRCbG9ja0lkO1xuICAgIHRoaXMubGFzdEFkZGVkQmxvY2tJZCA9IG51bGw7XG5cbiAgICB0aGlzLnJlbmRlcih0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG5cbiAgICBpZiAoc2Nyb2xsVGFyZ2V0SWQpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ibG9ja3MuZ2V0KHNjcm9sbFRhcmdldElkKTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICBlbnRyeS53cmFwcGVyLmFkZENsYXNzKCdibG9jay1qdXN0LWFkZGVkJyk7XG4gICAgICAgIGVudHJ5LndyYXBwZXIuc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnbmVhcmVzdCcgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChmb2N1c2VkQmxvY2tJZCkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgW2RhdGEtYmxvY2staWQ9XCIke2ZvY3VzZWRCbG9ja0lkfVwiXWApO1xuICAgICAgZWw/LmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFVubG9hZCBhbGwgYmxvY2tzIGFuZCBjYW5jZWwgYW55IGluLXByb2dyZXNzIGRyYWcvcmVzaXplLiAqL1xuICBkZXN0cm95QWxsKCk6IHZvaWQge1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZUNsb25lPy5yZW1vdmUoKTtcbiAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNsYXNzKCdpcy1kcmFnZ2luZy1ibG9jaycpO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG51bGw7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIHNldHRpbmdzIG1vZGFsICh0aXRsZSBzZWN0aW9uICsgYmxvY2stc3BlY2lmaWMgc2V0dGluZ3MpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vLyBbZW1vamksIHNlYXJjaCBrZXl3b3Jkc10gXHUyMDE0IDE3MCBtb3N0IGNvbW1vbi91c2VmdWxcbmNvbnN0IEVNT0pJX1BJQ0tFUl9TRVQ6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgLy8gU21pbGV5cyAmIGVtb3Rpb25cbiAgWydcdUQ4M0RcdURFMDAnLCdoYXBweSBzbWlsZSBncmluJ10sWydcdUQ4M0RcdURFMEEnLCdzbWlsZSBibHVzaCBoYXBweSddLFsnXHVEODNEXHVERTAyJywnbGF1Z2ggY3J5IGZ1bm55IGpveSddLFxuICBbJ1x1RDgzRVx1REQ3MicsJ3RlYXIgc21pbGUgZ3JhdGVmdWwnXSxbJ1x1RDgzRFx1REUwRCcsJ2hlYXJ0IGV5ZXMgbG92ZSddLFsnXHVEODNFXHVERDI5Jywnc3RhciBleWVzIGV4Y2l0ZWQnXSxcbiAgWydcdUQ4M0RcdURFMEUnLCdjb29sIHN1bmdsYXNzZXMnXSxbJ1x1RDgzRVx1REQxNCcsJ3RoaW5raW5nIGhtbSddLFsnXHVEODNEXHVERTA1Jywnc3dlYXQgbmVydm91cyBsYXVnaCddLFxuICBbJ1x1RDgzRFx1REUyMicsJ2NyeSBzYWQgdGVhciddLFsnXHVEODNEXHVERTI0JywnYW5ncnkgaHVmZiBmcnVzdHJhdGVkJ10sWydcdUQ4M0VcdURENzMnLCdwYXJ0eSBjZWxlYnJhdGUnXSxcbiAgWydcdUQ4M0RcdURFMzQnLCdzbGVlcCB0aXJlZCB6enonXSxbJ1x1RDgzRVx1REQyRicsJ21pbmQgYmxvd24gZXhwbG9kZSddLFsnXHVEODNFXHVERUUxJywnc2FsdXRlIHJlc3BlY3QnXSxcbiAgLy8gUGVvcGxlICYgZ2VzdHVyZXNcbiAgWydcdUQ4M0RcdURDNEInLCd3YXZlIGhlbGxvIGJ5ZSddLFsnXHVEODNEXHVEQzREJywndGh1bWJzIHVwIGdvb2Qgb2snXSxbJ1x1RDgzRFx1REM0RScsJ3RodW1icyBkb3duIGJhZCddLFxuICBbJ1x1MjcwQycsJ3ZpY3RvcnkgcGVhY2UnXSxbJ1x1RDgzRVx1REQxRCcsJ2hhbmRzaGFrZSBkZWFsJ10sWydcdUQ4M0RcdURFNEYnLCdwcmF5IHRoYW5rcyBwbGVhc2UnXSxcbiAgWydcdUQ4M0RcdURDQUEnLCdtdXNjbGUgc3Ryb25nIGZsZXgnXSxbJ1x1RDgzRFx1REM0MScsJ2V5ZSB3YXRjaCBzZWUnXSxbJ1x1RDgzRVx1RERFMCcsJ2JyYWluIG1pbmQgdGhpbmsnXSxcbiAgWydcdTI3NjQnLCdoZWFydCBsb3ZlIHJlZCddLFsnXHVEODNFXHVEREUxJywnb3JhbmdlIGhlYXJ0J10sWydcdUQ4M0RcdURDOUInLCd5ZWxsb3cgaGVhcnQnXSxcbiAgWydcdUQ4M0RcdURDOUEnLCdncmVlbiBoZWFydCddLFsnXHVEODNEXHVEQzk5JywnYmx1ZSBoZWFydCddLFsnXHVEODNEXHVEQzlDJywncHVycGxlIGhlYXJ0J10sWydcdUQ4M0RcdUREQTQnLCdibGFjayBoZWFydCddLFxuICAvLyBOYXR1cmVcbiAgWydcdUQ4M0NcdURGMzEnLCdzZWVkbGluZyBzcHJvdXQgZ3JvdyddLFsnXHVEODNDXHVERjNGJywnaGVyYiBsZWFmIGdyZWVuIG5hdHVyZSddLFsnXHVEODNDXHVERjQwJywnY2xvdmVyIGx1Y2snXSxcbiAgWydcdUQ4M0NcdURGMzgnLCdibG9zc29tIGZsb3dlciBwaW5rJ10sWydcdUQ4M0NcdURGM0EnLCdmbG93ZXIgaGliaXNjdXMnXSxbJ1x1RDgzQ1x1REYzQicsJ3N1bmZsb3dlciddLFxuICBbJ1x1RDgzQ1x1REY0MicsJ2F1dHVtbiBmYWxsIGxlYWYnXSxbJ1x1RDgzQ1x1REYwQScsJ3dhdmUgb2NlYW4gd2F0ZXIgc2VhJ10sWydcdUQ4M0RcdUREMjUnLCdmaXJlIGZsYW1lIGhvdCddLFxuICBbJ1x1Mjc0NCcsJ3Nub3dmbGFrZSBjb2xkIGljZSB3aW50ZXInXSxbJ1x1MjZBMScsJ2xpZ2h0bmluZyBib2x0IGVuZXJneSddLFsnXHVEODNDXHVERjA4JywncmFpbmJvdyddLFxuICBbJ1x1MjYwMCcsJ3N1biBzdW5ueSBicmlnaHQnXSxbJ1x1RDgzQ1x1REYxOScsJ21vb24gbmlnaHQgY3Jlc2NlbnQnXSxbJ1x1MkI1MCcsJ3N0YXIgZmF2b3JpdGUnXSxcbiAgWydcdUQ4M0NcdURGMUYnLCdnbG93aW5nIHN0YXIgc2hpbmUnXSxbJ1x1MjcyOCcsJ3NwYXJrbGVzIHNoaW5lIG1hZ2ljJ10sWydcdUQ4M0NcdURGRDQnLCdtb3VudGFpbiBwZWFrJ10sXG4gIFsnXHVEODNDXHVERjBEJywnZWFydGggZ2xvYmUgd29ybGQnXSxbJ1x1RDgzQ1x1REYxMCcsJ2dsb2JlIGludGVybmV0IHdlYiddLFxuICAvLyBGb29kICYgb2JqZWN0c1xuICBbJ1x1MjYxNScsJ2NvZmZlZSB0ZWEgaG90IGRyaW5rJ10sWydcdUQ4M0NcdURGNzUnLCd0ZWEgY3VwIGhvdCddLFsnXHVEODNDXHVERjdBJywnYmVlciBkcmluayddLFxuICBbJ1x1RDgzQ1x1REY0RScsJ2FwcGxlIGZydWl0IHJlZCddLFsnXHVEODNDXHVERjRCJywnbGVtb24geWVsbG93IHNvdXInXSxbJ1x1RDgzQ1x1REY4MicsJ2Nha2UgYmlydGhkYXknXSxcbiAgLy8gQWN0aXZpdGllcyAmIHNwb3J0c1xuICBbJ1x1RDgzQ1x1REZBRicsJ3RhcmdldCBidWxsc2V5ZSBnb2FsJ10sWydcdUQ4M0NcdURGQzYnLCd0cm9waHkgYXdhcmQgd2luJ10sWydcdUQ4M0VcdURENDcnLCdtZWRhbCBnb2xkIGZpcnN0J10sXG4gIFsnXHVEODNDXHVERkFFJywnZ2FtZSBjb250cm9sbGVyIHBsYXknXSxbJ1x1RDgzQ1x1REZBOCcsJ2FydCBwYWxldHRlIGNyZWF0aXZlIHBhaW50J10sWydcdUQ4M0NcdURGQjUnLCdtdXNpYyBub3RlIHNvbmcnXSxcbiAgWydcdUQ4M0NcdURGQUMnLCdjbGFwcGVyIGZpbG0gbW92aWUnXSxbJ1x1RDgzRFx1RENGNycsJ2NhbWVyYSBwaG90byddLFsnXHVEODNDXHVERjgxJywnZ2lmdCBwcmVzZW50J10sXG4gIFsnXHVEODNDXHVERkIyJywnZGljZSBnYW1lIHJhbmRvbSddLFsnXHVEODNFXHVEREU5JywncHV6emxlIHBpZWNlJ10sWydcdUQ4M0NcdURGQUQnLCd0aGVhdGVyIG1hc2tzJ10sXG4gIC8vIFRyYXZlbCAmIHBsYWNlc1xuICBbJ1x1RDgzRFx1REU4MCcsJ3JvY2tldCBsYXVuY2ggc3BhY2UnXSxbJ1x1MjcwOCcsJ2FpcnBsYW5lIHRyYXZlbCBmbHknXSxbJ1x1RDgzRFx1REU4MicsJ3RyYWluIHRyYXZlbCddLFxuICBbJ1x1RDgzQ1x1REZFMCcsJ2hvdXNlIGhvbWUnXSxbJ1x1RDgzQ1x1REZEOScsJ2NpdHkgYnVpbGRpbmcnXSxbJ1x1RDgzQ1x1REYwNicsJ2NpdHkgc3Vuc2V0J10sXG4gIC8vIE9iamVjdHMgJiB0b29sc1xuICBbJ1x1RDgzRFx1RENDMScsJ2ZvbGRlciBkaXJlY3RvcnknXSxbJ1x1RDgzRFx1RENDMicsJ29wZW4gZm9sZGVyJ10sWydcdUQ4M0RcdURDQzQnLCdkb2N1bWVudCBwYWdlIGZpbGUnXSxcbiAgWydcdUQ4M0RcdURDREQnLCdtZW1vIHdyaXRlIG5vdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NCJywnY2xpcGJvYXJkIGNvcHknXSxbJ1x1RDgzRFx1RENDQycsJ3B1c2hwaW4gcGluJ10sXG4gIFsnXHVEODNEXHVEQ0NEJywnbG9jYXRpb24gcGluIG1hcCddLFsnXHVEODNEXHVERDE2JywnYm9va21hcmsgc2F2ZSddLFsnXHVEODNEXHVEREMyJywnaW5kZXggZGl2aWRlcnMnXSxcbiAgWydcdUQ4M0RcdURDQzUnLCdjYWxlbmRhciBkYXRlIHNjaGVkdWxlJ10sWydcdUQ4M0RcdURERDMnLCdjYWxlbmRhciBzcGlyYWwnXSxbJ1x1MjNGMCcsJ2FsYXJtIGNsb2NrIHRpbWUgd2FrZSddLFxuICBbJ1x1RDgzRFx1REQ1MCcsJ2Nsb2NrIHRpbWUgaG91ciddLFsnXHUyM0YxJywnc3RvcHdhdGNoIHRpbWVyJ10sWydcdUQ4M0RcdURDQ0EnLCdjaGFydCBiYXIgZGF0YSddLFxuICBbJ1x1RDgzRFx1RENDOCcsJ2NoYXJ0IHVwIGdyb3d0aCB0cmVuZCddLFsnXHVEODNEXHVEQ0M5JywnY2hhcnQgZG93biBkZWNsaW5lJ10sXG4gIFsnXHVEODNEXHVEQ0ExJywnaWRlYSBsaWdodCBidWxiIGluc2lnaHQnXSxbJ1x1RDgzRFx1REQwRCcsJ3NlYXJjaCBtYWduaWZ5IHpvb20nXSxbJ1x1RDgzRFx1REQxNycsJ2xpbmsgY2hhaW4gdXJsJ10sXG4gIFsnXHVEODNEXHVEQ0UyJywnbG91ZHNwZWFrZXIgYW5ub3VuY2UnXSxbJ1x1RDgzRFx1REQxNCcsJ2JlbGwgbm90aWZpY2F0aW9uIGFsZXJ0J10sXG4gIFsnXHVEODNEXHVEQ0FDJywnc3BlZWNoIGJ1YmJsZSBjaGF0IG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENBRCcsJ3Rob3VnaHQgdGhpbmsgYnViYmxlJ10sXG4gIFsnXHVEODNEXHVEQ0RBJywnYm9va3Mgc3R1ZHkgbGlicmFyeSddLFsnXHVEODNEXHVEQ0Q2Jywnb3BlbiBib29rIHJlYWQnXSxbJ1x1RDgzRFx1RENEQycsJ3Njcm9sbCBkb2N1bWVudCddLFxuICBbJ1x1MjcwOScsJ2VudmVsb3BlIGVtYWlsIGxldHRlciddLFsnXHVEODNEXHVEQ0U3JywnZW1haWwgbWVzc2FnZSddLFsnXHVEODNEXHVEQ0U1JywnaW5ib3ggZG93bmxvYWQnXSxcbiAgWydcdUQ4M0RcdURDRTQnLCdvdXRib3ggdXBsb2FkIHNlbmQnXSxbJ1x1RDgzRFx1REREMScsJ3RyYXNoIGRlbGV0ZSByZW1vdmUnXSxcbiAgLy8gVGVjaFxuICBbJ1x1RDgzRFx1RENCQicsJ2xhcHRvcCBjb21wdXRlciBjb2RlJ10sWydcdUQ4M0RcdUREQTUnLCdkZXNrdG9wIG1vbml0b3Igc2NyZWVuJ10sWydcdUQ4M0RcdURDRjEnLCdwaG9uZSBtb2JpbGUnXSxcbiAgWydcdTIzMjgnLCdrZXlib2FyZCB0eXBlJ10sWydcdUQ4M0RcdUREQjEnLCdtb3VzZSBjdXJzb3IgY2xpY2snXSxbJ1x1RDgzRFx1RENFMScsJ3NhdGVsbGl0ZSBhbnRlbm5hIHNpZ25hbCddLFxuICBbJ1x1RDgzRFx1REQwQycsJ3BsdWcgcG93ZXIgZWxlY3RyaWMnXSxbJ1x1RDgzRFx1REQwQicsJ2JhdHRlcnkgcG93ZXIgY2hhcmdlJ10sWydcdUQ4M0RcdURDQkUnLCdmbG9wcHkgZGlzayBzYXZlJ10sXG4gIFsnXHVEODNEXHVEQ0JGJywnZGlzYyBjZCBkdmQnXSxbJ1x1RDgzRFx1RERBOCcsJ3ByaW50ZXIgcHJpbnQnXSxcbiAgLy8gU3ltYm9scyAmIHN0YXR1c1xuICBbJ1x1MjcwNScsJ2NoZWNrIGRvbmUgY29tcGxldGUgeWVzJ10sWydcdTI3NEMnLCdjcm9zcyBlcnJvciB3cm9uZyBubyBkZWxldGUnXSxcbiAgWydcdTI2QTAnLCd3YXJuaW5nIGNhdXRpb24gYWxlcnQnXSxbJ1x1Mjc1MycsJ3F1ZXN0aW9uIG1hcmsnXSxbJ1x1Mjc1NycsJ2V4Y2xhbWF0aW9uIGltcG9ydGFudCddLFxuICBbJ1x1RDgzRFx1REQxMicsJ2xvY2sgc2VjdXJlIHByaXZhdGUnXSxbJ1x1RDgzRFx1REQxMycsJ3VubG9jayBvcGVuIHB1YmxpYyddLFsnXHVEODNEXHVERDExJywna2V5IHBhc3N3b3JkIGFjY2VzcyddLFxuICBbJ1x1RDgzRFx1REVFMScsJ3NoaWVsZCBwcm90ZWN0IHNlY3VyaXR5J10sWydcdTI2OTknLCdnZWFyIHNldHRpbmdzIGNvbmZpZyddLFsnXHVEODNEXHVERDI3Jywnd3JlbmNoIHRvb2wgZml4J10sXG4gIFsnXHVEODNEXHVERDI4JywnaGFtbWVyIGJ1aWxkJ10sWydcdTI2OTcnLCdmbGFzayBjaGVtaXN0cnkgbGFiJ10sWydcdUQ4M0RcdUREMkMnLCdtaWNyb3Njb3BlIHNjaWVuY2UgcmVzZWFyY2gnXSxcbiAgWydcdUQ4M0RcdUREMkQnLCd0ZWxlc2NvcGUgc3BhY2UgYXN0cm9ub215J10sWydcdUQ4M0VcdURERUEnLCd0ZXN0IHR1YmUgZXhwZXJpbWVudCddLFxuICBbJ1x1RDgzRFx1REM4RScsJ2dlbSBkaWFtb25kIHByZWNpb3VzJ10sWydcdUQ4M0RcdURDQjAnLCdtb25leSBiYWcgcmljaCddLFsnXHVEODNEXHVEQ0IzJywnY3JlZGl0IGNhcmQgcGF5bWVudCddLFxuICBbJ1x1RDgzQ1x1REZGNycsJ2xhYmVsIHRhZyBwcmljZSddLFsnXHVEODNDXHVERjgwJywncmliYm9uIGJvdyBnaWZ0J10sXG4gIC8vIE1pc2MgdXNlZnVsXG4gIFsnXHVEODNFXHVEREVEJywnY29tcGFzcyBuYXZpZ2F0ZSBkaXJlY3Rpb24nXSxbJ1x1RDgzRFx1RERGQScsJ21hcCB3b3JsZCBuYXZpZ2F0ZSddLFxuICBbJ1x1RDgzRFx1RENFNicsJ2JveCBwYWNrYWdlIHNoaXBwaW5nJ10sWydcdUQ4M0RcdUREQzQnLCdmaWxpbmcgY2FiaW5ldCBhcmNoaXZlJ10sXG4gIFsnXHVEODNEXHVERDEwJywnbG9jayBrZXkgc2VjdXJlJ10sWydcdUQ4M0RcdURDQ0UnLCdwYXBlcmNsaXAgYXR0YWNoJ10sWydcdTI3MDInLCdzY2lzc29ycyBjdXQnXSxcbiAgWydcdUQ4M0RcdUREOEEnLCdwZW4gd3JpdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NGJywncnVsZXIgbWVhc3VyZSddLFsnXHVEODNEXHVERDA1JywnZGltIGJyaWdodG5lc3MnXSxcbiAgWydcdUQ4M0RcdUREMDYnLCdicmlnaHQgc3VuIGxpZ2h0J10sWydcdTI2N0InLCdyZWN5Y2xlIHN1c3RhaW5hYmlsaXR5J10sWydcdTI3MTQnLCdjaGVja21hcmsgZG9uZSddLFxuICBbJ1x1Mjc5NScsJ3BsdXMgYWRkJ10sWydcdTI3OTYnLCdtaW51cyByZW1vdmUnXSxbJ1x1RDgzRFx1REQwNCcsJ3JlZnJlc2ggc3luYyBsb29wJ10sXG4gIFsnXHUyM0U5JywnZmFzdCBmb3J3YXJkIHNraXAnXSxbJ1x1MjNFQScsJ3Jld2luZCBiYWNrJ10sWydcdTIzRjgnLCdwYXVzZSBzdG9wJ10sXG4gIFsnXHUyNUI2JywncGxheSBzdGFydCddLFsnXHVEODNEXHVERDAwJywnc2h1ZmZsZSByYW5kb20gbWl4J10sXG5dO1xuXG5jbGFzcyBCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJpdmF0ZSBibG9jazogQmFzZUJsb2NrLFxuICAgIHByaXZhdGUgb25TYXZlOiAoKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmluc3RhbmNlLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnVGl0bGUgbGFiZWwnKVxuICAgICAgLnNldERlc2MoJ0xlYXZlIGVtcHR5IHRvIHVzZSB0aGUgZGVmYXVsdCB0aXRsZS4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKHR5cGVvZiBkcmFmdC5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgPyBkcmFmdC5fdGl0bGVMYWJlbCA6ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdEZWZhdWx0IHRpdGxlJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX3RpdGxlTGFiZWwgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgRW1vamkgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIGNvbnN0IGVtb2ppUm93ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1yb3cnIH0pO1xuICAgIGVtb2ppUm93LmNyZWF0ZVNwYW4oeyBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsIHRleHQ6ICdUaXRsZSBlbW9qaScgfSk7XG5cbiAgICBjb25zdCBjb250cm9scyA9IGVtb2ppUm93LmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1jb250cm9scycgfSk7XG5cbiAgICBjb25zdCB0cmlnZ2VyQnRuID0gY29udHJvbHMuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktcGlja2VyLXRyaWdnZXInIH0pO1xuICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXIgPSAoKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSB0eXBlb2YgZHJhZnQuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlRW1vamkgOiAnJztcbiAgICAgIHRyaWdnZXJCdG4uZW1wdHkoKTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCAnXHVGRjBCJyB9KTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1jaGV2cm9uJywgdGV4dDogJ1x1MjVCRScgfSk7XG4gICAgfTtcbiAgICB1cGRhdGVUcmlnZ2VyKCk7XG5cbiAgICBjb25zdCBjbGVhckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci1jbGVhcicsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgIGNsZWFyQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDbGVhciBlbW9qaScpO1xuXG4gICAgY29uc3QgcGFuZWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLXBhbmVsJyB9KTtcbiAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgY29uc3Qgc2VhcmNoSW5wdXQgPSBwYW5lbC5jcmVhdGVFbCgnaW5wdXQnLCB7XG4gICAgICB0eXBlOiAndGV4dCcsXG4gICAgICBjbHM6ICdlbW9qaS1waWNrZXItc2VhcmNoJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnU2VhcmNoXHUyMDI2JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaWRFbCA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1ncmlkJyB9KTtcblxuICAgIGNvbnN0IHJlbmRlckdyaWQgPSAocXVlcnk6IHN0cmluZykgPT4ge1xuICAgICAgZ3JpZEVsLmVtcHR5KCk7XG4gICAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZCA9IHFcbiAgICAgICAgPyBFTU9KSV9QSUNLRVJfU0VULmZpbHRlcigoW2UsIGtdKSA9PiBrLmluY2x1ZGVzKHEpIHx8IGUgPT09IHEpXG4gICAgICAgIDogRU1PSklfUElDS0VSX1NFVDtcbiAgICAgIGZvciAoY29uc3QgW2Vtb2ppXSBvZiBmaWx0ZXJlZCkge1xuICAgICAgICBjb25zdCBidG4gPSBncmlkRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktYnRuJywgdGV4dDogZW1vamkgfSk7XG4gICAgICAgIGlmIChkcmFmdC5fdGl0bGVFbW9qaSA9PT0gZW1vamkpIGJ0bi5hZGRDbGFzcygnaXMtc2VsZWN0ZWQnKTtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gZW1vamk7XG4gICAgICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgc2VhcmNoSW5wdXQudmFsdWUgPSAnJztcbiAgICAgICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGdyaWRFbC5jcmVhdGVTcGFuKHsgY2xzOiAnZW1vamktcGlja2VyLWVtcHR5JywgdGV4dDogJ05vIHJlc3VsdHMnIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVuZGVyR3JpZCgnJyk7XG5cbiAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHJlbmRlckdyaWQoc2VhcmNoSW5wdXQudmFsdWUpKTtcblxuICAgIHRyaWdnZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBvcGVuID0gcGFuZWwuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9IG9wZW4gPyAnbm9uZScgOiAnYmxvY2snO1xuICAgICAgaWYgKCFvcGVuKSBzZXRUaW1lb3V0KCgpID0+IHNlYXJjaElucHV0LmZvY3VzKCksIDApO1xuICAgIH0pO1xuXG4gICAgY2xlYXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9ICcnO1xuICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICB9KTtcbiAgICAvLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIaWRlIHRpdGxlJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0Ll9oaWRlVGl0bGUgPT09IHRydWUpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll9oaWRlVGl0bGUgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBsZXQgZHJhZnROZXdSb3cgPSB0aGlzLmluc3RhbmNlLm5ld1JvdyA9PT0gdHJ1ZTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnU3RhcnQgb24gbmV3IHJvdycpXG4gICAgICAuc2V0RGVzYygnRm9yY2UgdGhpcyBibG9jayB0byBiZWdpbiBvbiBhIG5ldyByb3cuJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0TmV3Um93KVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdE5ld1JvdyA9IHY7IH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBkcmFmdDtcbiAgICAgICAgICB0aGlzLmluc3RhbmNlLm5ld1JvdyA9IGRyYWZ0TmV3Um93IHx8IHVuZGVmaW5lZDtcbiAgICAgICAgICB0aGlzLm9uU2F2ZSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcblxuICAgIGNvbnN0IGhyID0gY29udGVudEVsLmNyZWF0ZUVsKCdocicpO1xuICAgIGhyLnN0eWxlLm1hcmdpbiA9ICcxNnB4IDAnO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywge1xuICAgICAgdGV4dDogJ0Jsb2NrLXNwZWNpZmljIHNldHRpbmdzOicsXG4gICAgICBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ29uZmlndXJlIGJsb2NrLi4uJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIHRoaXMuYmxvY2sub3BlblNldHRpbmdzKHRoaXMub25TYXZlKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUmVtb3ZlIGNvbmZpcm1hdGlvbiBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1JlbW92ZSBibG9jaz8nIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1RoaXMgYmxvY2sgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGhvbWVwYWdlLicgfSk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1JlbW92ZScpLnNldFdhcm5pbmcoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9uQ29uZmlybSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBCbG9ja0ZhY3RvcnksIEJsb2NrVHlwZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5jbGFzcyBCbG9ja1JlZ2lzdHJ5Q2xhc3Mge1xuICBwcml2YXRlIGZhY3RvcmllcyA9IG5ldyBNYXA8QmxvY2tUeXBlLCBCbG9ja0ZhY3Rvcnk+KCk7XG5cbiAgcmVnaXN0ZXIoZmFjdG9yeTogQmxvY2tGYWN0b3J5KTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuc2V0KGZhY3RvcnkudHlwZSwgZmFjdG9yeSk7XG4gIH1cblxuICBnZXQodHlwZTogQmxvY2tUeXBlKTogQmxvY2tGYWN0b3J5IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3JpZXMuZ2V0KHR5cGUpO1xuICB9XG5cbiAgZ2V0QWxsKCk6IEJsb2NrRmFjdG9yeVtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmZhY3Rvcmllcy52YWx1ZXMoKSk7XG4gIH1cblxuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5jbGVhcigpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBCbG9ja1JlZ2lzdHJ5ID0gbmV3IEJsb2NrUmVnaXN0cnlDbGFzcygpO1xuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBCbG9ja1R5cGUsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sYmFyIHtcbiAgcHJpdmF0ZSB0b29sYmFyRWw6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGZhYkVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQsXG4gICAgcHJpdmF0ZSBvbkNvbHVtbnNDaGFuZ2U6IChuOiBudW1iZXIpID0+IHZvaWQsXG4gICkge1xuICAgIC8vIEZsb2F0aW5nIGFjdGlvbiBidXR0b24gXHUyMDE0IHZpc2libGUgaW4gcmVhZCBtb2RlLCB0cmlnZ2VycyBlZGl0IG1vZGVcbiAgICB0aGlzLmZhYkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZWRpdC1mYWInIH0pO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgdGhpcy5mYWJFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRW50ZXIgZWRpdCBtb2RlJyk7XG4gICAgdGhpcy5mYWJFbC5zZXRUZXh0KCdcdTI3MEYnKTtcbiAgICB0aGlzLmZhYkVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGVFZGl0TW9kZSgpKTtcbiAgICB0aGlzLmZhYkVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnRvZ2dsZUVkaXRNb2RlKCk7IH1cbiAgICB9KTtcblxuICAgIHRoaXMudG9vbGJhckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtdG9vbGJhcicgfSk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3Rvb2xiYXInKTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgdG9vbGJhcicpO1xuICAgIHRoaXMucmVuZGVyVG9vbGJhcigpO1xuICB9XG5cbiAgLyoqIFRvZ2dsZSBlZGl0IG1vZGUgXHUyMDE0IGNhbGxlZCBmcm9tIEZBQiwgRG9uZSBidXR0b24sIGFuZCBrZXlib2FyZCBzaG9ydGN1dCBjb21tYW5kLiAqL1xuICB0b2dnbGVFZGl0TW9kZSgpOiB2b2lkIHtcbiAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgdGhpcy5ncmlkLnNldEVkaXRNb2RlKHRoaXMuZWRpdE1vZGUpO1xuICAgIHRoaXMuc3luY1Zpc2liaWxpdHkoKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY1Zpc2liaWxpdHkoKTogdm9pZCB7XG4gICAgLy8gUmVhZCBtb2RlOiBzaG93IEZBQiwgaGlkZSB0b29sYmFyXG4gICAgLy8gRWRpdCBtb2RlOiBzaG93IHRvb2xiYXIsIGhpZGUgRkFCXG4gICAgdGhpcy5mYWJFbC50b2dnbGVDbGFzcygnaXMtaGlkZGVuJywgdGhpcy5lZGl0TW9kZSk7XG4gICAgdGhpcy50b29sYmFyRWwudG9nZ2xlQ2xhc3MoJ2lzLXZpc2libGUnLCB0aGlzLmVkaXRNb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gRWRpdCBtb2RlIGluZGljYXRvciAobGVmdC1hbGlnbmVkKVxuICAgIGNvbnN0IGluZGljYXRvciA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZURpdih7IGNsczogJ3Rvb2xiYXItZWRpdC1pbmRpY2F0b3IgaXMtdmlzaWJsZScgfSk7XG4gICAgaW5kaWNhdG9yLmNyZWF0ZURpdih7IGNsczogJ3Rvb2xiYXItZWRpdC1kb3QnIH0pO1xuICAgIGluZGljYXRvci5jcmVhdGVTcGFuKHsgdGV4dDogJ0VkaXRpbmcnIH0pO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gQWRkIEJsb2NrIGJ1dHRvbiAob25seSBpbiBlZGl0IG1vZGUpXG4gICAgY29uc3QgYWRkQnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1hZGQtYnRuJywgdGV4dDogJysgQWRkIEJsb2NrJyB9KTtcbiAgICBhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IHRoaXMub3BlbkFkZEJsb2NrTW9kYWwoKTsgfSk7XG5cbiAgICAvLyBEb25lIGJ1dHRvbiBcdTIwMTQgZXhpdHMgZWRpdCBtb2RlXG4gICAgY29uc3QgZG9uZUJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItZWRpdC1idG4gdG9vbGJhci1idG4tYWN0aXZlJywgdGV4dDogJ1x1MjcxMyBEb25lJyB9KTtcbiAgICBkb25lQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGVFZGl0TW9kZSgpKTtcblxuICAgIC8vIFdpcmUgdXAgdGhlIGdyaWQncyBlbXB0eSBzdGF0ZSBDVEEgdG8gb3BlbiB0aGUgYWRkIGJsb2NrIG1vZGFsXG4gICAgdGhpcy5ncmlkLm9uUmVxdWVzdEFkZEJsb2NrID0gKCkgPT4geyB0aGlzLm9wZW5BZGRCbG9ja01vZGFsKCk7IH07XG4gIH1cblxuICAvKiogT3BlbnMgdGhlIEFkZCBCbG9jayBtb2RhbC4gQ2FsbGVkIGZyb20gdG9vbGJhciBidXR0b24gYW5kIGVtcHR5IHN0YXRlIENUQS4gKi9cbiAgcHJpdmF0ZSBvcGVuQWRkQmxvY2tNb2RhbCgpOiB2b2lkIHtcbiAgICBuZXcgQWRkQmxvY2tNb2RhbCh0aGlzLmFwcCwgKHR5cGUpID0+IHtcbiAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBtYXhSb3cgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLnJlZHVjZShcbiAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UgPSB7XG4gICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICB0eXBlLFxuICAgICAgICBjb2w6IDEsXG4gICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgY29sU3BhbjogTWF0aC5taW4oZmFjdG9yeS5kZWZhdWx0U2l6ZS5jb2xTcGFuLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyksXG4gICAgICAgIHJvd1NwYW46IGZhY3RvcnkuZGVmYXVsdFNpemUucm93U3BhbixcbiAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgfTtcblxuICAgICAgdGhpcy5ncmlkLmFkZEJsb2NrKGluc3RhbmNlKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBnZXRGYWJFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5mYWJFbDtcbiAgfVxuXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5ncmlkLm9uUmVxdWVzdEFkZEJsb2NrID0gbnVsbDtcbiAgICB0aGlzLmZhYkVsLnJlbW92ZSgpO1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNvbnN0IEJMT0NLX01FVEE6IFJlY29yZDxCbG9ja1R5cGUsIHsgaWNvbjogc3RyaW5nOyBkZXNjOiBzdHJpbmcgfT4gPSB7XG4gICdncmVldGluZyc6ICAgICAgeyBpY29uOiAnXFx1ezFGNDRCfScsIGRlc2M6ICdQZXJzb25hbGl6ZWQgZ3JlZXRpbmcgd2l0aCB0aW1lIG9mIGRheScgfSxcbiAgJ2Nsb2NrJzogICAgICAgICB7IGljb246ICdcXHV7MUY1NTB9JywgZGVzYzogJ0xpdmUgY2xvY2sgd2l0aCBkYXRlIGRpc3BsYXknIH0sXG4gICdmb2xkZXItbGlua3MnOiAgeyBpY29uOiAnXFx1ezFGNTE3fScsIGRlc2M6ICdRdWljayBsaW5rcyB0byBub3RlcyBhbmQgZm9sZGVycycgfSxcbiAgJ2luc2lnaHQnOiAgICAgICB7IGljb246ICdcXHV7MUY0QTF9JywgZGVzYzogJ0RhaWx5IHJvdGF0aW5nIG5vdGUgZnJvbSBhIHRhZycgfSxcbiAgJ3RhZy1ncmlkJzogICAgICB7IGljb246ICdcXHV7MUYzRjd9XFx1RkUwRicsIGRlc2M6ICdHcmlkIG9mIGxhYmVsZWQgdmFsdWUgYnV0dG9ucycgfSxcbiAgJ3F1b3Rlcy1saXN0JzogICB7IGljb246ICdcXHV7MUY0QUN9JywgZGVzYzogJ0NvbGxlY3Rpb24gb2YgcXVvdGVzIGZyb20gbm90ZXMnIH0sXG4gICdpbWFnZS1nYWxsZXJ5JzogeyBpY29uOiAnXFx1ezFGNUJDfVxcdUZFMEYnLCBkZXNjOiAnUGhvdG8gZ3JpZCBmcm9tIGEgdmF1bHQgZm9sZGVyJyB9LFxuICAnZW1iZWRkZWQtbm90ZSc6IHsgaWNvbjogJ1xcdXsxRjRDNH0nLCBkZXNjOiAnUmVuZGVyIGEgbm90ZSBpbmxpbmUgb24gdGhlIHBhZ2UnIH0sXG4gICdzdGF0aWMtdGV4dCc6ICAgeyBpY29uOiAnXFx1ezFGNEREfScsIGRlc2M6ICdNYXJrZG93biB0ZXh0IGJsb2NrIHlvdSB3cml0ZSBkaXJlY3RseScgfSxcbiAgJ2h0bWwnOiAgICAgICAgICB7IGljb246ICc8Lz4nLCBkZXNjOiAnQ3VzdG9tIEhUTUwgY29udGVudCAoc2FuaXRpemVkKScgfSxcbn07XG5cbmNsYXNzIEFkZEJsb2NrTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25TZWxlY3Q6ICh0eXBlOiBCbG9ja1R5cGUpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0FkZCBCbG9jaycsIGNsczogJ2FkZC1ibG9jay1tb2RhbC10aXRsZScgfSk7XG5cbiAgICBjb25zdCBncmlkID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2FkZC1ibG9jay1ncmlkJyB9KTtcblxuICAgIGZvciAoY29uc3QgZmFjdG9yeSBvZiBCbG9ja1JlZ2lzdHJ5LmdldEFsbCgpKSB7XG4gICAgICBjb25zdCBtZXRhID0gQkxPQ0tfTUVUQVtmYWN0b3J5LnR5cGVdO1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdhZGQtYmxvY2stb3B0aW9uJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLWljb24nLCB0ZXh0OiBtZXRhPy5pY29uID8/ICdcXHUyNUFBJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLW5hbWUnLCB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lIH0pO1xuICAgICAgaWYgKG1ldGE/LmRlc2MpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdhZGQtYmxvY2stZGVzYycsIHRleHQ6IG1ldGEuZGVzYyB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5vblNlbGVjdChmYWN0b3J5LnR5cGUpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgR3JlZXRpbmdCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG5hbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2dyZWV0aW5nLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dUaW1lID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93VGltZT86IGJvb2xlYW4gfTtcblxuICAgIGlmIChzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdncmVldGluZy10aW1lJyB9KTtcbiAgICB9XG4gICAgdGhpcy5uYW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdncmVldGluZy1uYW1lJyB9KTtcblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCBob3VyID0gbm93LmhvdXIoKTtcbiAgICBjb25zdCB7IG5hbWUgPSAnYmVudG9ybmF0bycsIHNob3dUaW1lID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgbmFtZT86IHN0cmluZztcbiAgICAgIHNob3dUaW1lPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2FsdXRhdGlvbiA9XG4gICAgICBob3VyID49IDUgJiYgaG91ciA8IDEyID8gJ0J1b25naW9ybm8nIDpcbiAgICAgIGhvdXIgPj0gMTIgJiYgaG91ciA8IDE4ID8gJ0J1b24gcG9tZXJpZ2dpbycgOlxuICAgICAgJ0J1b25hc2VyYSc7XG5cbiAgICBpZiAodGhpcy50aW1lRWwgJiYgc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdCgnSEg6bW0nKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm5hbWVFbCkge1xuICAgICAgdGhpcy5uYW1lRWwuc2V0VGV4dChgJHtzYWx1dGF0aW9ufSwgJHtuYW1lfWApO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgR3JlZXRpbmdTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgR3JlZXRpbmdTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdHcmVldGluZyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ05hbWUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQubmFtZSBhcyBzdHJpbmcgPz8gJ2JlbnRvcm5hdG8nKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubmFtZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHRpbWUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93VGltZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGltZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDb21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlQmxvY2sgZXh0ZW5kcyBDb21wb25lbnQge1xuICBwcml2YXRlIF9oZWFkZXJDb250YWluZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFwcDogQXBwLFxuICAgIHByb3RlY3RlZCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcm90ZWN0ZWQgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBhYnN0cmFjdCByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbiAgLy8gT3ZlcnJpZGUgdG8gb3BlbiBhIHBlci1ibG9jayBzZXR0aW5ncyBtb2RhbFxuICBvcGVuU2V0dGluZ3MoX29uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge31cblxuICAvLyBDYWxsZWQgYnkgR3JpZExheW91dCB0byByZWRpcmVjdCByZW5kZXJIZWFkZXIgb3V0cHV0IG91dHNpZGUgYmxvY2stY29udGVudC5cbiAgc2V0SGVhZGVyQ29udGFpbmVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuX2hlYWRlckNvbnRhaW5lciA9IGVsO1xuICB9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsLlxuICAvLyBSZXNwZWN0cyBfaGlkZVRpdGxlLCBfdGl0bGVMYWJlbCwgYW5kIF90aXRsZUVtb2ppIGZyb20gaW5zdGFuY2UuY29uZmlnLlxuICAvLyBSZW5kZXJzIGludG8gdGhlIGhlYWRlciBjb250YWluZXIgc2V0IGJ5IEdyaWRMYXlvdXQgKGlmIGFueSksIGVsc2UgZmFsbHMgYmFjayB0byBlbC5cbiAgcHJvdGVjdGVkIHJlbmRlckhlYWRlcihlbDogSFRNTEVsZW1lbnQsIHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjZmcgPSB0aGlzLmluc3RhbmNlLmNvbmZpZztcbiAgICBpZiAoY2ZnLl9oaWRlVGl0bGUgPT09IHRydWUpIHJldHVybjtcbiAgICBjb25zdCBsYWJlbCA9ICh0eXBlb2YgY2ZnLl90aXRsZUxhYmVsID09PSAnc3RyaW5nJyAmJiBjZmcuX3RpdGxlTGFiZWwudHJpbSgpKVxuICAgICAgPyBjZmcuX3RpdGxlTGFiZWwudHJpbSgpXG4gICAgICA6IHRpdGxlO1xuICAgIGlmICghbGFiZWwpIHJldHVybjtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLl9oZWFkZXJDb250YWluZXIgPz8gZWw7XG4gICAgY29uc3QgaGVhZGVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhlYWRlcicgfSk7XG4gICAgaWYgKHR5cGVvZiBjZmcuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVFbW9qaSkge1xuICAgICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyBjbHM6ICdibG9jay1oZWFkZXItZW1vamknLCB0ZXh0OiBjZmcuX3RpdGxlRW1vamkgfSk7XG4gICAgfVxuICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgdGV4dDogbGFiZWwgfSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBDbG9ja0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGF0ZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnY2xvY2stYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd0RhdGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dEYXRlPzogYm9vbGVhbiB9O1xuXG4gICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay10aW1lJyB9KTtcbiAgICBpZiAoc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stZGF0ZScgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IHsgc2hvd1NlY29uZHMgPSBmYWxzZSwgc2hvd0RhdGUgPSB0cnVlLCBmb3JtYXQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgc2hvd1NlY29uZHM/OiBib29sZWFuO1xuICAgICAgc2hvd0RhdGU/OiBib29sZWFuO1xuICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy50aW1lRWwpIHtcbiAgICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KGZvcm1hdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KHNob3dTZWNvbmRzID8gJ0hIOm1tOnNzJyA6ICdISDptbScpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0ZUVsICYmIHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ2RkZGQsIEQgTU1NTSBZWVlZJykpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgQ2xvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgQ2xvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgc2Vjb25kcycpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dTZWNvbmRzIGFzIGJvb2xlYW4gPz8gZmFsc2UpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93U2Vjb25kcyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGRhdGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93RGF0ZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RGF0ZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0N1c3RvbSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ09wdGlvbmFsIG1vbWVudC5qcyBmb3JtYXQgc3RyaW5nLCBlLmcuIFwiSEg6bW1cIi4gTGVhdmUgZW1wdHkgZm9yIGRlZmF1bHQuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb3JtYXQgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb3JtYXQgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgTGlua0l0ZW0ge1xuICBsYWJlbDogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIGVtb2ppPzogc3RyaW5nO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+IGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHsgdGhpcy5vbkNob29zZShmb2xkZXIpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIEZvbGRlckxpbmtzQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlbmRlclRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdmb2xkZXItbGlua3MtYmxvY2snKTtcblxuICAgIC8vIFJlLXJlbmRlciB3aGVuIHZhdWx0IGZpbGVzIGFyZSBjcmVhdGVkLCBkZWxldGVkLCBvciByZW5hbWVkIChkZWJvdW5jZWQpXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG5cbiAgICAvLyBEZWZlciBmaXJzdCByZW5kZXIgc28gdmF1bHQgaXMgZnVsbHkgaW5kZXhlZFxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHRoaXMucmVuZGVyQ29udGVudCgpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVSZW5kZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVuZGVyVGltZXIgIT09IG51bGwpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZW5kZXJUaW1lcik7XG4gICAgdGhpcy5yZW5kZXJUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMucmVuZGVyVGltZXIgPSBudWxsO1xuICAgICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gICAgfSwgMTUwKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQ29udGVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1F1aWNrIExpbmtzJywgZm9sZGVyID0gJycsIGxpbmtzID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgbGlua3M/OiBMaW5rSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgbGlzdCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rcy1saXN0JyB9KTtcblxuICAgIC8vIEF1dG8tbGlzdCBub3RlcyBmcm9tIHNlbGVjdGVkIGZvbGRlciAoc29ydGVkIGFscGhhYmV0aWNhbGx5KVxuICAgIGlmIChmb2xkZXIpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGlzZWQgPSBmb2xkZXIudHJpbSgpLnJlcGxhY2UoL1xcLyskLywgJycpO1xuXG4gICAgICBpZiAoIW5vcm1hbGlzZWQpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1ZhdWx0IHJvb3QgbGlzdGluZyBpcyBub3Qgc3VwcG9ydGVkLiBTZWxlY3QgYSBzdWJmb2xkZXIuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXNlZCk7XG5cbiAgICAgICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtub3JtYWxpc2VkfVwiIG5vdCBmb3VuZC5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcmVmaXggPSBmb2xkZXJPYmoucGF0aCArICcvJztcbiAgICAgICAgICBjb25zdCBub3RlcyA9IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKClcbiAgICAgICAgICAgIC5maWx0ZXIoZiA9PiBmLnBhdGguc3RhcnRzV2l0aChwcmVmaXgpKVxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYE5vIG5vdGVzIGluIFwiJHtmb2xkZXJPYmoucGF0aH1cIi5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYW51YWwgbGlua3NcbiAgICBmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgaWYgKGxpbmsuZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdsaW5rLWVtb2ppJywgdGV4dDogbGluay5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogbGluay5sYWJlbCB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChsaW5rLnBhdGgsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyICYmIGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgaGludCA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY1MTd9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGxpbmtzIHlldC4gQWRkIG1hbnVhbCBsaW5rcyBvciBwaWNrIGEgZm9sZGVyIGluIHNldHRpbmdzLicgfSk7XG4gICAgfVxuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVuZGVyVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZW5kZXJUaW1lcik7XG4gICAgICB0aGlzLnJlbmRlclRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEExfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHNob3cgYSBkYWlseSByb3RhdGluZyBub3RlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhcmQuc2V0VGV4dChgTm8gZmlsZXMgZm91bmQgd2l0aCB0YWcgJHt0YWdTZWFyY2h9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVXNlIGxvY2FsIG1pZG5pZ2h0IGFzIHRoZSBkYXkgaW5kZXggc28gaXQgY2hhbmdlcyBhdCBsb2NhbCBtaWRuaWdodCwgbm90IFVUQ1xuICAgIGNvbnN0IGRheUluZGV4ID0gTWF0aC5mbG9vcihtb21lbnQoKS5zdGFydE9mKCdkYXknKS52YWx1ZU9mKCkgLyBNU19QRVJfREFZKTtcbiAgICBjb25zdCBpbmRleCA9IGRhaWx5U2VlZFxuICAgICAgPyBkYXlJbmRleCAlIGZpbGVzLmxlbmd0aFxuICAgICAgOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmaWxlcy5sZW5ndGgpO1xuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgY29uc3QgeyBoZWFkaW5nLCBib2R5IH0gPSB0aGlzLnBhcnNlQ29udGVudChjb250ZW50LCBjYWNoZSk7XG5cbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC10aXRsZScsIHRleHQ6IGhlYWRpbmcgfHwgZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1ib2R5JywgdGV4dDogYm9keSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbnNpZ2h0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCBlKTtcbiAgICAgIGNhcmQuc2V0VGV4dCgnRXJyb3IgcmVhZGluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRoZSBmaXJzdCBoZWFkaW5nIGFuZCBmaXJzdCBwYXJhZ3JhcGggdXNpbmcgbWV0YWRhdGFDYWNoZSBvZmZzZXRzLlxuICAgKiBGYWxscyBiYWNrIHRvIG1hbnVhbCBwYXJzaW5nIG9ubHkgaWYgY2FjaGUgaXMgdW5hdmFpbGFibGUuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQ29udGVudChjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiB7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH0ge1xuICAgIC8vIFVzZSBjYWNoZWQgaGVhZGluZyBpZiBhdmFpbGFibGUgKGF2b2lkcyBtYW51YWwgcGFyc2luZylcbiAgICBjb25zdCBoZWFkaW5nID0gY2FjaGU/LmhlYWRpbmdzPy5bMF0/LmhlYWRpbmcgPz8gJyc7XG5cbiAgICAvLyBTa2lwIGZyb250bWF0dGVyIHVzaW5nIHRoZSBjYWNoZWQgb2Zmc2V0XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcblxuICAgIC8vIEZpcnN0IG5vbi1lbXB0eSwgbm9uLWhlYWRpbmcgbGluZSBpcyB0aGUgYm9keVxuICAgIGNvbnN0IGJvZHkgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmluZChsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKSA/PyAnJztcblxuICAgIHJldHVybiB7IGhlYWRpbmcsIGJvZHkgfTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW5zaWdodFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW5zaWdodCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnRGFpbHkgSW5zaWdodCcpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRGFpbHkgc2VlZCcpLnNldERlc2MoJ1Nob3cgc2FtZSBub3RlIGFsbCBkYXknKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5kYWlseVNlZWQgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZGFpbHlTZWVkID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIFJldHVybnMgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdCB0aGF0IGhhdmUgdGhlIGdpdmVuIHRhZy5cbiAqIGB0YWdgIG11c3QgaW5jbHVkZSB0aGUgbGVhZGluZyBgI2AgKGUuZy4gYCN2YWx1ZXNgKS5cbiAqIEhhbmRsZXMgYm90aCBpbmxpbmUgdGFncyBhbmQgWUFNTCBmcm9udG1hdHRlciB0YWdzICh3aXRoIG9yIHdpdGhvdXQgYCNgKSxcbiAqIGFuZCBmcm9udG1hdHRlciB0YWdzIHRoYXQgYXJlIGEgcGxhaW4gc3RyaW5nIGluc3RlYWQgb2YgYW4gYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlc1dpdGhUYWcoYXBwOiBBcHAsIHRhZzogc3RyaW5nKTogVEZpbGVbXSB7XG4gIHJldHVybiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcihmaWxlID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICBpZiAoIWNhY2hlKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBpbmxpbmVUYWdzID0gY2FjaGUudGFncz8ubWFwKHQgPT4gdC50YWcpID8/IFtdO1xuXG4gICAgY29uc3QgcmF3Rm1UYWdzID0gY2FjaGUuZnJvbnRtYXR0ZXI/LnRhZ3M7XG4gICAgY29uc3QgZm1UYWdBcnJheTogc3RyaW5nW10gPVxuICAgICAgQXJyYXkuaXNBcnJheShyYXdGbVRhZ3MpID8gcmF3Rm1UYWdzLmZpbHRlcigodCk6IHQgaXMgc3RyaW5nID0+IHR5cGVvZiB0ID09PSAnc3RyaW5nJykgOlxuICAgICAgdHlwZW9mIHJhd0ZtVGFncyA9PT0gJ3N0cmluZycgPyBbcmF3Rm1UYWdzXSA6XG4gICAgICBbXTtcbiAgICBjb25zdCBub3JtYWxpemVkRm1UYWdzID0gZm1UYWdBcnJheS5tYXAodCA9PiB0LnN0YXJ0c1dpdGgoJyMnKSA/IHQgOiBgIyR7dH1gKTtcblxuICAgIHJldHVybiBpbmxpbmVUYWdzLmluY2x1ZGVzKHRhZykgfHwgbm9ybWFsaXplZEZtVGFncy5pbmNsdWRlcyh0YWcpO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgVmFsdWVJdGVtIHtcbiAgZW1vamk6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgbGluaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRhZ0dyaWRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygndGFnLWdyaWQtYmxvY2snKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnVmFsdWVzJywgY29sdW1ucyA9IDIsIGl0ZW1zID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIGl0ZW1zPzogVmFsdWVJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBncmlkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAndGFnLWdyaWQnIH0pO1xuICAgIGdyaWQuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBoaW50ID0gZ3JpZC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjNGN31cXHVGRTBGJyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGl0ZW1zIHlldC4gQWRkIHZhbHVlcyB3aXRoIGVtb2ppcyBhbmQgbGFiZWxzIGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3RhZy1idG4nIH0pO1xuICAgICAgaWYgKGl0ZW0uZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICd0YWctYnRuLWVtb2ppJywgdGV4dDogaXRlbS5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogaXRlbS5sYWJlbCB9KTtcbiAgICAgIGlmIChpdGVtLmxpbmspIHtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaXRlbS5saW5rISwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ0bi5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBWYWx1ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgVmFsdWVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnVmFsdWVzIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRyYWZ0Lml0ZW1zKSkgZHJhZnQuaXRlbXMgPSBbXTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1ZhbHVlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzEnLCAnMScpLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdJdGVtcycsIGNsczogJ3NldHRpbmctaXRlbS1uYW1lJyB9KTtcblxuICAgIGNvbnN0IGxpc3RFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICd2YWx1ZXMtaXRlbS1saXN0JyB9KTtcbiAgICBjb25zdCByZW5kZXJMaXN0ID0gKCkgPT4ge1xuICAgICAgbGlzdEVsLmVtcHR5KCk7XG4gICAgICBkcmFmdC5pdGVtcyEuZm9yRWFjaCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tcm93JyB9KTtcblxuICAgICAgICBjb25zdCBlbW9qaUlucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1lbW9qaScgfSk7XG4gICAgICAgIGVtb2ppSW5wdXQudmFsdWUgPSBpdGVtLmVtb2ppO1xuICAgICAgICBlbW9qaUlucHV0LnBsYWNlaG9sZGVyID0gJ1x1RDgzRFx1REUwMCc7XG4gICAgICAgIGVtb2ppSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0uZW1vamkgPSBlbW9qaUlucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsYWJlbElucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1sYWJlbCcgfSk7XG4gICAgICAgIGxhYmVsSW5wdXQudmFsdWUgPSBpdGVtLmxhYmVsO1xuICAgICAgICBsYWJlbElucHV0LnBsYWNlaG9sZGVyID0gJ0xhYmVsJztcbiAgICAgICAgbGFiZWxJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5sYWJlbCA9IGxhYmVsSW5wdXQudmFsdWU7IH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGluaycgfSk7XG4gICAgICAgIGxpbmtJbnB1dC52YWx1ZSA9IGl0ZW0ubGluayA/PyAnJztcbiAgICAgICAgbGlua0lucHV0LnBsYWNlaG9sZGVyID0gJ05vdGUgcGF0aCAob3B0aW9uYWwpJztcbiAgICAgICAgbGlua0lucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmxpbmsgPSBsaW5rSW5wdXQudmFsdWUgfHwgdW5kZWZpbmVkOyB9KTtcblxuICAgICAgICBjb25zdCBkZWxCdG4gPSByb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndmFsdWVzLWl0ZW0tZGVsJywgdGV4dDogJ1x1MjcxNScgfSk7XG4gICAgICAgIGRlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICBkcmFmdC5pdGVtcyEuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpc3QoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJysgQWRkIGl0ZW0nKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgZHJhZnQuaXRlbXMhLnB1c2goeyBlbW9qaTogJycsIGxhYmVsOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlzdCgpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gT25seSBhc3NpZ24gc2FmZSBDU1MgY29sb3IgdmFsdWVzOyByZWplY3QgcG90ZW50aWFsbHkgbWFsaWNpb3VzIHN0cmluZ3NcbmNvbnN0IENPTE9SX1JFID0gL14oI1swLTlhLWZBLUZdezMsOH18W2EtekEtWl0rfHJnYmE/XFwoW14pXStcXCl8aHNsYT9cXChbXildK1xcKSkkLztcblxudHlwZSBRdW90ZXNDb25maWcgPSB7XG4gIHNvdXJjZT86ICd0YWcnIHwgJ3RleHQnO1xuICB0YWc/OiBzdHJpbmc7XG4gIHF1b3Rlcz86IHN0cmluZztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGNvbHVtbnM/OiBudW1iZXI7XG4gIG1heEl0ZW1zPzogbnVtYmVyO1xuICBoZWlnaHRNb2RlPzogJ3dyYXAnIHwgJ2V4dGVuZCc7XG59O1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgc291cmNlID0gJ3RhZycsIHRhZyA9ICcnLCBxdW90ZXMgPSAnJywgdGl0bGUgPSAnUXVvdGVzJywgY29sdW1ucyA9IDIsIG1heEl0ZW1zID0gMjAsIGhlaWdodE1vZGUgPSAnd3JhcCcgfSA9XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyBRdW90ZXNDb25maWc7XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgZWwudG9nZ2xlQ2xhc3MoJ3F1b3Rlcy1saXN0LWJsb2NrLS1leHRlbmQnLCBoZWlnaHRNb2RlID09PSAnZXh0ZW5kJyk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG4gICAgaWYgKGhlaWdodE1vZGUgPT09ICd3cmFwJykge1xuICAgICAgY29sc0VsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgICAgY29sc0VsLnNldEF0dHJpYnV0ZSgncm9sZScsICdyZWdpb24nKTtcbiAgICAgIGNvbHNFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUXVvdGVzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgTUlOX0NPTF9XSURUSCA9IDIwMDtcbiAgICBjb25zdCB1cGRhdGVDb2xzID0gKCkgPT4ge1xuICAgICAgY29uc3QgdyA9IGNvbHNFbC5vZmZzZXRXaWR0aDtcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZSA9IHcgPiAwID8gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgTWF0aC5mbG9vcih3IC8gTUlOX0NPTF9XSURUSCkpKSA6IGNvbHVtbnM7XG4gICAgICBjb2xzRWwuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtlZmZlY3RpdmV9LCAxZnIpYDtcbiAgICB9O1xuICAgIHVwZGF0ZUNvbHMoKTtcbiAgICBjb25zdCBybyA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVDb2xzKTtcbiAgICByby5vYnNlcnZlKGNvbHNFbCk7XG4gICAgdGhpcy5yZWdpc3RlcigoKSA9PiByby5kaXNjb25uZWN0KCkpO1xuXG4gICAgaWYgKHNvdXJjZSA9PT0gJ3RleHQnKSB7XG4gICAgICB0aGlzLnJlbmRlclRleHRRdW90ZXMoY29sc0VsLCBxdW90ZXMsIG1heEl0ZW1zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBzb3VyY2UgPT09ICd0YWcnXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0QUN9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIHRhZyBjb25maWd1cmVkLiBBZGQgYSB0YWcgaW4gc2V0dGluZ3MgdG8gcHVsbCBxdW90ZXMgZnJvbSB5b3VyIG5vdGVzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbmRlciBxdW90ZXMgZnJvbSBwbGFpbiB0ZXh0LiBFYWNoIHF1b3RlIGlzIHNlcGFyYXRlZCBieSBgLS0tYCBvbiBpdHMgb3duIGxpbmUuXG4gICAqIE9wdGlvbmFsbHkgYSBzb3VyY2UgbGluZSBjYW4gZm9sbG93IHRoZSBxdW90ZSB0ZXh0LCBwcmVmaXhlZCB3aXRoIGBcdTIwMTRgLCBgXHUyMDEzYCwgb3IgYC0tYC5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICogICBUaGUgb25seSB3YXkgdG8gZG8gZ3JlYXQgd29yayBpcyB0byBsb3ZlIHdoYXQgeW91IGRvLlxuICAgKiAgIFx1MjAxNCBTdGV2ZSBKb2JzXG4gICAqICAgLS0tXG4gICAqICAgSW4gdGhlIG1pZGRsZSBvZiBkaWZmaWN1bHR5IGxpZXMgb3Bwb3J0dW5pdHkuXG4gICAqICAgXHUyMDE0IEFsYmVydCBFaW5zdGVpblxuICAgKi9cbiAgcHJpdmF0ZSByZW5kZXJUZXh0UXVvdGVzKGNvbHNFbDogSFRNTEVsZW1lbnQsIHJhdzogc3RyaW5nLCBtYXhJdGVtczogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCFyYXcudHJpbSgpKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEFDfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBxdW90ZXMgeWV0LiBBZGQgdGhlbSBpbiBzZXR0aW5ncywgc2VwYXJhdGVkIGJ5IC0tLS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJsb2NrcyA9IHJhdy5zcGxpdCgvXFxuLS0tXFxuLykubWFwKGIgPT4gYi50cmltKCkpLmZpbHRlcihCb29sZWFuKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuICAgICAgY29uc3QgbGluZXMgPSBibG9jay5zcGxpdCgnXFxuJykubWFwKGwgPT4gbC50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGNvbnN0IGxhc3RMaW5lID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV07XG4gICAgICBjb25zdCBoYXNTb3VyY2UgPSBsaW5lcy5sZW5ndGggPiAxICYmIC9eKFx1MjAxNHxcdTIwMTN8LS0pLy50ZXN0KGxhc3RMaW5lKTtcbiAgICAgIGNvbnN0IHNvdXJjZVRleHQgPSBoYXNTb3VyY2UgPyBsYXN0TGluZS5yZXBsYWNlKC9eKFx1MjAxNHxcdTIwMTN8LS0pXFxzKi8sICcnKSA6ICcnO1xuICAgICAgY29uc3QgYm9keUxpbmVzID0gaGFzU291cmNlID8gbGluZXMuc2xpY2UoMCwgLTEpIDogbGluZXM7XG4gICAgICBjb25zdCBib2R5ID0gYm9keUxpbmVzLmpvaW4oJyAnKTtcbiAgICAgIGlmICghYm9keSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGl0ZW0gPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtaXRlbScgfSk7XG4gICAgICBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcbiAgICAgIGlmIChzb3VyY2VUZXh0KSBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IHNvdXJjZVRleHQgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEV4dHJhY3QgdGhlIGZpcnN0IGZldyBsaW5lcyBvZiBib2R5IGNvbnRlbnQgdXNpbmcgbWV0YWRhdGFDYWNoZSBmcm9udG1hdHRlciBvZmZzZXQuICovXG4gIHByaXZhdGUgZXh0cmFjdEJvZHkoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuICAgIGNvbnN0IGxpbmVzID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2UoMCwgMykuam9pbignICcpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBRdW90ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgUXVvdGVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVvdGVzIExpc3QgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpIGFzIFF1b3Rlc0NvbmZpZztcbiAgICBkcmFmdC5zb3VyY2UgPz89ICd0YWcnO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVvdGVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFNvdXJjZSB0b2dnbGUgXHUyMDE0IHNob3dzL2hpZGVzIHRoZSByZWxldmFudCBzZWN0aW9uXG4gICAgbGV0IHRhZ1NlY3Rpb246IEhUTUxFbGVtZW50O1xuICAgIGxldCB0ZXh0U2VjdGlvbjogSFRNTEVsZW1lbnQ7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnU291cmNlJylcbiAgICAgIC5zZXREZXNjKCdQdWxsIHF1b3RlcyBmcm9tIHRhZ2dlZCBub3Rlcywgb3IgZW50ZXIgdGhlbSBtYW51YWxseS4nKVxuICAgICAgLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgICAgZC5hZGRPcHRpb24oJ3RhZycsICdOb3RlcyB3aXRoIHRhZycpXG4gICAgICAgICAuYWRkT3B0aW9uKCd0ZXh0JywgJ01hbnVhbCB0ZXh0JylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5zb3VyY2UgPz8gJ3RhZycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7XG4gICAgICAgICAgIGRyYWZ0LnNvdXJjZSA9IHYgYXMgJ3RhZycgfCAndGV4dCc7XG4gICAgICAgICAgIHRhZ1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHYgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGV4dCcgPyAnJyA6ICdub25lJztcbiAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIFRhZyBzZWN0aW9uXG4gICAgdGFnU2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcbiAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgbmV3IFNldHRpbmcodGFnU2VjdGlvbikuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgLy8gVGV4dCBzZWN0aW9uXG4gICAgdGV4dFNlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGV4dFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGRyYWZ0LnNvdXJjZSA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgY29uc3QgdGV4dFNldHRpbmcgPSBuZXcgU2V0dGluZyh0ZXh0U2VjdGlvbilcbiAgICAgIC5zZXROYW1lKCdRdW90ZXMnKVxuICAgICAgLnNldERlc2MoJ1NlcGFyYXRlIHF1b3RlcyB3aXRoIC0tLSBvbiBpdHMgb3duIGxpbmUuIEFkZCBhIHNvdXJjZSBsaW5lIHN0YXJ0aW5nIHdpdGggXHUyMDE0IChlLmcuIFx1MjAxNCBBdXRob3IpLicpO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5mbGV4RGlyZWN0aW9uID0gJ2NvbHVtbic7XG4gICAgdGV4dFNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmFsaWduSXRlbXMgPSAnc3RyZXRjaCc7XG4gICAgY29uc3QgdGV4dGFyZWEgPSB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuY3JlYXRlRWwoJ3RleHRhcmVhJyk7XG4gICAgdGV4dGFyZWEucm93cyA9IDg7XG4gICAgdGV4dGFyZWEuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgdGV4dGFyZWEuc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XG4gICAgdGV4dGFyZWEuc3R5bGUuZm9udEZhbWlseSA9ICd2YXIoLS1mb250LW1vbm9zcGFjZSknO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRTaXplID0gJzEycHgnO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQucXVvdGVzID8/ICcnO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5xdW90ZXMgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0hlaWdodCBtb2RlJylcbiAgICAgIC5zZXREZXNjKCdTY3JvbGwga2VlcHMgdGhlIGJsb2NrIGNvbXBhY3QuIEdyb3cgdG8gZml0IGFsbCB3b3JrcyBiZXN0IGF0IGZ1bGwgd2lkdGguJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd3cmFwJywgJ1Njcm9sbCAoZml4ZWQgaGVpZ2h0KScpXG4gICAgICAgICAuYWRkT3B0aW9uKCdleHRlbmQnLCAnR3JvdyB0byBmaXQgYWxsJylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5oZWlnaHRNb2RlID8/ICd3cmFwJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuaGVpZ2h0TW9kZSA9IHYgYXMgJ3dyYXAnIHwgJ2V4dGVuZCc7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwLCBsYXlvdXQgPSAnZ3JpZCcgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIG1heEl0ZW1zPzogbnVtYmVyO1xuICAgICAgbGF5b3V0PzogJ2dyaWQnIHwgJ21hc29ucnknO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ2FsbGVyeSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ltYWdlLWdhbGxlcnknIH0pO1xuXG4gICAgaWYgKGxheW91dCA9PT0gJ21hc29ucnknKSB7XG4gICAgICBnYWxsZXJ5LmFkZENsYXNzKCdtYXNvbnJ5LWxheW91dCcpO1xuICAgICAgY29uc3QgdXBkYXRlQ29scyA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdyA9IGdhbGxlcnkub2Zmc2V0V2lkdGg7XG4gICAgICAgIGNvbnN0IGVmZmVjdGl2ZSA9IHcgPiAwID8gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgTWF0aC5mbG9vcih3IC8gMTAwKSkpIDogY29sdW1ucztcbiAgICAgICAgZ2FsbGVyeS5zdHlsZS5jb2x1bW5zID0gU3RyaW5nKGVmZmVjdGl2ZSk7XG4gICAgICB9O1xuICAgICAgdXBkYXRlQ29scygpO1xuICAgICAgY29uc3Qgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIodXBkYXRlQ29scyk7XG4gICAgICByby5vYnNlcnZlKGdhbGxlcnkpO1xuICAgICAgdGhpcy5yZWdpc3RlcigoKSA9PiByby5kaXNjb25uZWN0KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KGF1dG8tZmlsbCwgbWlubWF4KG1heCg3MHB4LCBjYWxjKDEwMCUgLyAke2NvbHVtbnN9KSksIDFmcikpYDtcbiAgICB9XG5cbiAgICBpZiAoIWZvbGRlcikge1xuICAgICAgY29uc3QgaGludCA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY1QkN9XFx1RkUwRicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBmb2xkZXIgc2VsZWN0ZWQuIFBpY2sgYW4gaW1hZ2UgZm9sZGVyIGluIHNldHRpbmdzIHRvIGRpc3BsYXkgYSBnYWxsZXJ5LicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdMYXlvdXQnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignZ3JpZCcsICdHcmlkJykuYWRkT3B0aW9uKCdtYXNvbnJ5JywgJ01hc29ucnknKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubGF5b3V0ID8/ICdncmlkJykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5sYXlvdXQgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpLmFkZE9wdGlvbignNCcsICc0JylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5jb25zdCBERUJPVU5DRV9NUyA9IDMwMDtcblxuZXhwb3J0IGNsYXNzIEVtYmVkZGVkTm90ZUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkZWJvdW5jZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdlbWJlZGRlZC1ub3RlLWJsb2NrJyk7XG5cbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuXG4gICAgLy8gUmVnaXN0ZXIgdmF1bHQgbGlzdGVuZXIgb25jZTsgZGVib3VuY2UgcmFwaWQgc2F2ZXNcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC52YXVsdC5vbignbW9kaWZ5JywgKG1vZEZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IGZpbGVQYXRoPzogc3RyaW5nIH07XG4gICAgICAgIGlmIChtb2RGaWxlLnBhdGggPT09IGZpbGVQYXRoICYmIHRoaXMuY29udGFpbmVyRWwpIHtcbiAgICAgICAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ29udGVudCh0YXJnZXQpLmNhdGNoKGUgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmUtcmVuZGVyIGFmdGVyIG1vZGlmeTonLCBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIERFQk9VTkNFX01TKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJywgc2hvd1RpdGxlID0gdHJ1ZSwgaGVpZ2h0TW9kZSA9ICdzY3JvbGwnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgICBoZWlnaHRNb2RlPzogJ3Njcm9sbCcgfCAnZ3Jvdyc7XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG4gICAgZWwudG9nZ2xlQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2stLWdyb3cnLCBoZWlnaHRNb2RlID09PSAnZ3JvdycpO1xuXG4gICAgaWYgKCFmaWxlUGF0aCkge1xuICAgICAgY29uc3QgaGludCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEM0fScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBub3RlIHNlbGVjdGVkLiBDaG9vc2UgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MgdG8gZW1iZWQgaXQgaGVyZS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIGVsLnNldFRleHQoYEZpbGUgbm90IGZvdW5kOiAke2ZpbGVQYXRofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaG93VGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCBmaWxlLmJhc2VuYW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdlbWJlZGRlZC1ub3RlLWNvbnRlbnQnIH0pO1xuICAgIGlmIChoZWlnaHRNb2RlID09PSAnc2Nyb2xsJykge1xuICAgICAgY29udGVudEVsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgICAgY29udGVudEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdyZWdpb24nKTtcbiAgICAgIGNvbnRlbnRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBmaWxlLmJhc2VuYW1lKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIZWlnaHQgbW9kZScpXG4gICAgICAuc2V0RGVzYygnU2Nyb2xsIGtlZXBzIHRoZSBibG9jayBjb21wYWN0LiBHcm93IHRvIGZpdCBhbGwgZXhwYW5kcyB0aGUgY2FyZCB0byBzaG93IHRoZSBmdWxsIG5vdGUuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCdzY3JvbGwnLCAnU2Nyb2xsIChmaXhlZCBoZWlnaHQpJylcbiAgICAgICAgIC5hZGRPcHRpb24oJ2dyb3cnLCAnR3JvdyB0byBmaXQgYWxsJylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5oZWlnaHRNb2RlIGFzIHN0cmluZyA/PyAnc2Nyb2xsJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuaGVpZ2h0TW9kZSA9IHY7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1hcmtkb3duUmVuZGVyZXIsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgU3RhdGljVGV4dEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdzdGF0aWMtdGV4dC1ibG9jaycpO1xuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBTdGF0aWNUZXh0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBjb250ZW50LicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGl0bGUgPSAnJywgY29udGVudCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbnRlbnQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnc3RhdGljLXRleHQtY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0RER9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGNvbnRlbnQgeWV0LiBBZGQgTWFya2Rvd24gdGV4dCBpbiBzZXR0aW5ncy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICc8Lz4nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gSFRNTCBjb250ZW50IHlldC4gQWRkIHlvdXIgbWFya3VwIGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29udGVudEVsLmFwcGVuZENoaWxkKHNhbml0aXplSFRNTFRvRG9tKGh0bWwpKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEh0bWxCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hUTUwgQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgSFRNTC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdIVE1MJykuc2V0RGVzYygnSFRNTCBpcyBzYW5pdGl6ZWQgYmVmb3JlIHJlbmRlcmluZy4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0Lmh0bWwgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMjtcbiAgICB0ZXh0YXJlYS5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuaHRtbCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsb0JBQXVEOzs7QUNBdkQsSUFBQUMsbUJBQXdDOzs7QUNBeEMsc0JBQTZDOzs7QUNFN0MsSUFBTSxxQkFBTixNQUF5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RUFBRSxRQUFRLFlBQVk7QUFDakUsY0FBTSxLQUFLLE9BQU8sV0FBVyxpQkFBaUIsQ0FBQztBQUMvQyxtQkFBVyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEdBQUc7QUFDaEUsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGtCQUFNLEtBQUssS0FBSyxPQUFPO0FBQUEsVUFDekI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJGb2xkZXJTdWdnZXN0TW9kYWwiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
