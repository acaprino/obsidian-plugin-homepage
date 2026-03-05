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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdRdWljayBMaW5rcycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJ1F1aWNrIExpbmtzJywgZm9sZGVyOiAnJywgbGlua3M6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEZvbGRlckxpbmtzQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2luc2lnaHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnRGFpbHkgSW5zaWdodCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW5zaWdodEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICd0YWctZ3JpZCcsXG4gICAgZGlzcGxheU5hbWU6ICdWYWx1ZXMnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICd0b2dnbGUtZWRpdC1tb2RlJyxcbiAgICAgIG5hbWU6ICdUb2dnbGUgZWRpdCBtb2RlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xuICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgIGxlYWYudmlldy50b2dnbGVFZGl0TW9kZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBhYm92ZSBncmlkOyBGQUIgZmxvYXRzIGluZGVwZW5kZW50bHkgKGFscmVhZHkgaW4gY29udGVudEVsIHZpYSBFZGl0VG9vbGJhcilcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuICAgIGNvbnRlbnRFbC5pbnNlcnRCZWZvcmUodGhpcy50b29sYmFyLmdldEZhYkVsZW1lbnQoKSwgdGhpcy50b29sYmFyLmdldEVsZW1lbnQoKSk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zLCB0cnVlKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogVG9nZ2xlIGVkaXQgbW9kZSBcdTIwMTQgY2FsbGVkIGZyb20ga2V5Ym9hcmQgc2hvcnRjdXQgY29tbWFuZC4gKi9cbiAgdG9nZ2xlRWRpdE1vZGUoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyPy50b2dnbGVFZGl0TW9kZSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZWZmZWN0aXZlQ29sdW1ucyA9IDM7XG4gIC8qKiBDYWxsYmFjayB0byB0cmlnZ2VyIHRoZSBBZGQgQmxvY2sgbW9kYWwgZnJvbSB0aGUgZW1wdHkgc3RhdGUgQ1RBLiAqL1xuICBvblJlcXVlc3RBZGRCbG9jazogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG4gIC8qKiBJRCBvZiB0aGUgbW9zdCByZWNlbnRseSBhZGRlZCBibG9jayBcdTIwMTQgdXNlZCBmb3Igc2Nyb2xsLWludG8tdmlldy4gKi9cbiAgcHJpdmF0ZSBsYXN0QWRkZWRCbG9ja0lkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG4gICAgcHJpdmF0ZSBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICAgIHByaXZhdGUgb25MYXlvdXRDaGFuZ2U6IExheW91dENoYW5nZUNhbGxiYWNrLFxuICApIHtcbiAgICB0aGlzLmdyaWRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWdyaWQnIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgY29uc3QgbmV3RWZmZWN0aXZlID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG4gICAgICBpZiAobmV3RWZmZWN0aXZlICE9PSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnMpIHtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmdyaWRFbCk7XG4gIH1cblxuICAvKiogRXhwb3NlIHRoZSByb290IGdyaWQgZWxlbWVudCBzbyBIb21lcGFnZVZpZXcgY2FuIHJlb3JkZXIgaXQgaW4gdGhlIERPTS4gKi9cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZ3JpZEVsO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhsYXlvdXRDb2x1bW5zOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IHcgPSB0aGlzLmdyaWRFbC5vZmZzZXRXaWR0aDtcbiAgICBpZiAodyA8PSAwKSByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgICBpZiAodyA8PSA1NDApIHJldHVybiAxO1xuICAgIGlmICh3IDw9IDg0MCkgcmV0dXJuIE1hdGgubWluKDIsIGxheW91dENvbHVtbnMpO1xuICAgIGlmICh3IDw9IDEwMjQpIHJldHVybiBNYXRoLm1pbigzLCBsYXlvdXRDb2x1bW5zKTtcbiAgICByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyLCBpc0luaXRpYWwgPSBmYWxzZSk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpc3QnKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgYmxvY2tzJyk7XG4gICAgdGhpcy5lZmZlY3RpdmVDb2x1bW5zID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhjb2x1bW5zKTtcblxuICAgIC8vIFN0YWdnZXIgYW5pbWF0aW9uIG9ubHkgb24gdGhlIGluaXRpYWwgcmVuZGVyIChub3QgcmVvcmRlci9jb2xsYXBzZS9jb2x1bW4gY2hhbmdlKVxuICAgIGlmIChpc0luaXRpYWwpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmFkZENsYXNzKCdob21lcGFnZS1ncmlkLS1hbmltYXRpbmcnKTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ncmlkRWwucmVtb3ZlQ2xhc3MoJ2hvbWVwYWdlLWdyaWQtLWFuaW1hdGluZycpLCA1MDApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgZW1wdHkgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1zdGF0ZScgfSk7XG4gICAgICBlbXB0eS5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1pY29uJywgdGV4dDogJ1xcdXsxRjNFMH0nIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7IGNsczogJ2hvbWVwYWdlLWVtcHR5LXRpdGxlJywgdGV4dDogJ1lvdXIgaG9tZXBhZ2UgaXMgZW1wdHknIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgIGNsczogJ2hvbWVwYWdlLWVtcHR5LWRlc2MnLFxuICAgICAgICB0ZXh0OiB0aGlzLmVkaXRNb2RlXG4gICAgICAgICAgPyAnQ2xpY2sgdGhlIGJ1dHRvbiBiZWxvdyB0byBhZGQgeW91ciBmaXJzdCBibG9jay4nXG4gICAgICAgICAgOiAnQWRkIGJsb2NrcyB0byBidWlsZCB5b3VyIHBlcnNvbmFsIGRhc2hib2FyZC4gVG9nZ2xlIEVkaXQgbW9kZSBpbiB0aGUgdG9vbGJhciB0byBnZXQgc3RhcnRlZC4nLFxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSAmJiB0aGlzLm9uUmVxdWVzdEFkZEJsb2NrKSB7XG4gICAgICAgIGNvbnN0IGN0YSA9IGVtcHR5LmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2hvbWVwYWdlLWVtcHR5LWN0YScsIHRleHQ6ICdBZGQgWW91ciBGaXJzdCBCbG9jaycgfSk7XG4gICAgICAgIGN0YS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsgdGhpcy5vblJlcXVlc3RBZGRCbG9jaz8uKCk7IH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgYmxvY2tzKSB7XG4gICAgICB0aGlzLnJlbmRlckJsb2NrKGluc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KGluc3RhbmNlLnR5cGUpO1xuICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvLyBIZWFkZXIgem9uZSBcdTIwMTQgYWx3YXlzIHZpc2libGU7IGhvdXNlcyB0aXRsZSArIGNvbGxhcHNlIGNoZXZyb25cbiAgICBjb25zdCBoZWFkZXJab25lID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXItem9uZScgfSk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgaGVhZGVyWm9uZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaW5zdGFuY2UuY29sbGFwc2VkKSk7XG4gICAgY29uc3QgY2hldnJvbiA9IGhlYWRlclpvbmUuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWNvbGxhcHNlLWNoZXZyb24nIH0pO1xuICAgIGNoZXZyb24uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2suc2V0SGVhZGVyQ29udGFpbmVyKGhlYWRlclpvbmUpO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5jb2xsYXBzZWQpIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuXG4gICAgY29uc3QgdG9nZ2xlQ29sbGFwc2UgPSAoZTogRXZlbnQpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAodGhpcy5lZGl0TW9kZSkgcmV0dXJuOyAvLyBlZGl0IG1vZGU6IGhhbmRsZSBiYXIgb3ducyBpbnRlcmFjdGlvblxuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjaGV2cm9uLnRvZ2dsZUNsYXNzKCdpcy1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBoZWFkZXJab25lLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIFN0cmluZyghaXNOb3dDb2xsYXBzZWQpKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbGxhcHNlZDogaXNOb3dDb2xsYXBzZWQgfSA6IGIsXG4gICAgICApO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB9O1xuXG4gICAgaGVhZGVyWm9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUNvbGxhcHNlKTtcbiAgICBoZWFkZXJab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0b2dnbGVDb2xsYXBzZShlKTsgfVxuICAgIH0pO1xuXG4gICAgaWYgKGluc3RhbmNlLmNvbGxhcHNlZCkgY2hldnJvbi5hZGRDbGFzcygnaXMtY29sbGFwc2VkJyk7XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbHMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGluc3RhbmNlLmNvbFNwYW4sIGNvbHMpO1xuICAgIC8vIEZvciBOIGNvbHVtbnMgdGhlcmUgYXJlIChOLTEpIGdhcHMgZGlzdHJpYnV0ZWQgYWNyb3NzIE4gc2xvdHMuXG4gICAgLy8gQSBibG9jayBzcGFubmluZyBTIGNvbHVtbnMgY292ZXJzIFMgc2xvdHMgYW5kIChTLTEpIGludGVybmFsIGdhcHMsXG4gICAgLy8gc28gaXQgbXVzdCBzdWJ0cmFjdCAoTi1TKS9OIHNoYXJlIG9mIHRoZSB0b3RhbCBnYXAgc3BhY2UuXG4gICAgLy8gRm9ybXVsYTogYmFzaXMgPSBTL04gKiAxMDAlIC0gKE4tUykvTiAqIGdhcFxuICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjb2xTcGFuIC8gY29scykgKiAxMDA7XG4gICAgY29uc3QgZ2FwRnJhY3Rpb24gPSAoY29scyAtIGNvbFNwYW4pIC8gY29scztcbiAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjb2xTcGFufSAxIGNhbGMoJHtiYXNpc1BlcmNlbnR9JSAtIHZhcigtLWhwLWdhcCwgMTZweCkgKiAke2dhcEZyYWN0aW9uLnRvRml4ZWQoNCl9KWA7XG4gICAgd3JhcHBlci5zdHlsZS5taW5XaWR0aCA9IGNvbHMgPT09IDEgPyAnMCcgOiAndmFyKC0taHAtY2FyZC1taW4td2lkdGgsIDIwMHB4KSc7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBjb25zdCBvblNhdmUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG4gICAgICBuZXcgQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCBpbnN0YW5jZSwgZW50cnkuYmxvY2ssIG9uU2F2ZSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICAvLyBNb3ZlIHVwIC8gZG93biBrZXlib2FyZC1hY2Nlc3NpYmxlIHJlb3JkZXIgYnV0dG9uc1xuICAgIGNvbnN0IG1vdmVVcEJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1tb3ZlLXVwLWJ0bicgfSk7XG4gICAgc2V0SWNvbihtb3ZlVXBCdG4sICdjaGV2cm9uLXVwJyk7XG4gICAgbW92ZVVwQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdNb3ZlIGJsb2NrIHVwJyk7XG4gICAgbW92ZVVwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBpZHggPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc3RhbmNlLmlkKTtcbiAgICAgIGlmIChpZHggPD0gMCkgcmV0dXJuO1xuICAgICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3NdO1xuICAgICAgW25ld0Jsb2Nrc1tpZHggLSAxXSwgbmV3QmxvY2tzW2lkeF1dID0gW25ld0Jsb2Nrc1tpZHhdLCBuZXdCbG9ja3NbaWR4IC0gMV1dO1xuICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBtb3ZlRG93bkJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1tb3ZlLWRvd24tYnRuJyB9KTtcbiAgICBzZXRJY29uKG1vdmVEb3duQnRuLCAnY2hldnJvbi1kb3duJyk7XG4gICAgbW92ZURvd25CdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ01vdmUgYmxvY2sgZG93bicpO1xuICAgIG1vdmVEb3duQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBpZHggPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGluc3RhbmNlLmlkKTtcbiAgICAgIGlmIChpZHggPCAwIHx8IGlkeCA+PSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmxlbmd0aCAtIDEpIHJldHVybjtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzXTtcbiAgICAgIFtuZXdCbG9ja3NbaWR4XSwgbmV3QmxvY2tzW2lkeCArIDFdXSA9IFtuZXdCbG9ja3NbaWR4ICsgMV0sIG5ld0Jsb2Nrc1tpZHhdXTtcbiAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnIH0pO1xuICAgIHNldEljb24oZ3JpcCwgJ21heGltaXplLTInKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIHRoaXMuYXR0YWNoUmVzaXplSGFuZGxlcihncmlwLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICB0aGlzLmF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZSwgd3JhcHBlciwgaW5zdGFuY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hEcmFnSGFuZGxlcihoYW5kbGU6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIC8vIEZsb2F0aW5nIGNsb25lIHRoYXQgZm9sbG93cyB0aGUgY3Vyc29yXG4gICAgICBjb25zdCBjbG9uZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgY2xvbmUuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWctY2xvbmUnKTtcbiAgICAgIGNsb25lLnN0eWxlLndpZHRoID0gYCR7d3JhcHBlci5vZmZzZXRXaWR0aH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5oZWlnaHQgPSBgJHt3cmFwcGVyLm9mZnNldEhlaWdodH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gYCR7ZS5jbGllbnRYIC0gd3JhcHBlci5vZmZzZXRXaWR0aCAvIDJ9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUudG9wID0gYCR7ZS5jbGllbnRZIC0gMjB9cHhgO1xuICAgICAgY29uc3QgdGhlbWVkID0gKHRoaXMuZ3JpZEVsLmNsb3Nlc3QoJy5hcHAtY29udGFpbmVyJykgPz8gZG9jdW1lbnQuYm9keSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGVtZWQuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICAvLyBQbGFjZWhvbGRlciBcdTIwMTQgc2hvd3MgdGhlIGxhbmRpbmcgc3BvdCBpbiB0aGUgcmVhbCBsYXlvdXRcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBwbGFjZWhvbGRlci5hZGRDbGFzcygnYmxvY2stZHJhZy1wbGFjZWhvbGRlcicpO1xuICAgICAgcGxhY2Vob2xkZXIuc3R5bGUuZmxleCA9IHdyYXBwZXIuc3R5bGUuZmxleDtcbiAgICAgIHBsYWNlaG9sZGVyLnN0eWxlLm1pbldpZHRoID0gd3JhcHBlci5zdHlsZS5taW5XaWR0aDtcbiAgICAgIHBsYWNlaG9sZGVyLnN0eWxlLmhlaWdodCA9IGAke3dyYXBwZXIub2Zmc2V0SGVpZ2h0fXB4YDtcbiAgICAgIHdyYXBwZXIuaW5zZXJ0QWRqYWNlbnRFbGVtZW50KCdhZnRlcmVuZCcsIHBsYWNlaG9sZGVyKTtcblxuICAgICAgY29uc3Qgc291cmNlSWQgPSBpbnN0YW5jZS5pZDtcbiAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgIC8vIENhY2hlIHJlY3RzIG9uY2UgYXQgZHJhZyBzdGFydCB0byBhdm9pZCBsYXlvdXQgdGhyYXNoIG9uIGV2ZXJ5IG1vdXNlbW92ZVxuICAgICAgY29uc3QgY2FjaGVkUmVjdHMgPSBuZXcgTWFwPHN0cmluZywgRE9NUmVjdD4oKTtcbiAgICAgIGZvciAoY29uc3QgW2lkLCB7IHdyYXBwZXI6IHcgfV0gb2YgdGhpcy5ibG9ja3MpIHtcbiAgICAgICAgaWYgKGlkICE9PSBzb3VyY2VJZCkgY2FjaGVkUmVjdHMuc2V0KGlkLCB3LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGxhc3RJbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgICAgIGNvbnN0IG1vdmVQbGFjZWhvbGRlciA9IChpbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCkgPT4ge1xuICAgICAgICBpZiAoaW5zZXJ0QmVmb3JlSWQgPT09IGxhc3RJbnNlcnRCZWZvcmVJZCkgcmV0dXJuO1xuICAgICAgICBsYXN0SW5zZXJ0QmVmb3JlSWQgPSBpbnNlcnRCZWZvcmVJZDtcbiAgICAgICAgcGxhY2Vob2xkZXIucmVtb3ZlKCk7XG4gICAgICAgIGlmIChpbnNlcnRCZWZvcmVJZCkge1xuICAgICAgICAgIGNvbnN0IHRhcmdldFdyYXBwZXIgPSB0aGlzLmJsb2Nrcy5nZXQoaW5zZXJ0QmVmb3JlSWQpPy53cmFwcGVyO1xuICAgICAgICAgIGlmICh0YXJnZXRXcmFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmdyaWRFbC5pbnNlcnRCZWZvcmUocGxhY2Vob2xkZXIsIHRhcmdldFdyYXBwZXIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmdyaWRFbC5hcHBlbmRDaGlsZChwbGFjZWhvbGRlcik7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gYCR7bWUuY2xpZW50WCAtIHdyYXBwZXIub2Zmc2V0V2lkdGggLyAyfXB4YDtcbiAgICAgICAgY2xvbmUuc3R5bGUudG9wID0gYCR7bWUuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgICAgY29uc3QgcHQgPSB0aGlzLmZpbmRJbnNlcnRpb25Qb2ludENhY2hlZChtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCwgY2FjaGVkUmVjdHMpO1xuICAgICAgICBtb3ZlUGxhY2Vob2xkZXIocHQuaW5zZXJ0QmVmb3JlSWQpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICAgICAgY2xvbmUucmVtb3ZlKCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuICAgICAgICBwbGFjZWhvbGRlci5yZW1vdmUoKTtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgICBjb25zdCBwdCA9IHRoaXMuZmluZEluc2VydGlvblBvaW50Q2FjaGVkKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkLCBjYWNoZWRSZWN0cyk7XG4gICAgICAgIHRoaXMucmVvcmRlckJsb2NrKHNvdXJjZUlkLCBwdC5pbnNlcnRCZWZvcmVJZCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcDogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGdyaXAuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICBjb25zdCBzdGFydFggPSBlLmNsaWVudFg7XG4gICAgICBjb25zdCBzdGFydENvbFNwYW4gPSBpbnN0YW5jZS5jb2xTcGFuO1xuICAgICAgY29uc3QgY29sdW1ucyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICAgIGNvbnN0IGNvbFdpZHRoID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGggLyBjb2x1bW5zO1xuICAgICAgbGV0IGN1cnJlbnRDb2xTcGFuID0gc3RhcnRDb2xTcGFuO1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVggPSBtZS5jbGllbnRYIC0gc3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YUNvbHMgPSBNYXRoLnJvdW5kKGRlbHRhWCAvIGNvbFdpZHRoKTtcbiAgICAgICAgY3VycmVudENvbFNwYW4gPSBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBzdGFydENvbFNwYW4gKyBkZWx0YUNvbHMpKTtcbiAgICAgICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGN1cnJlbnRDb2xTcGFuIC8gY29sdW1ucykgKiAxMDA7XG4gICAgICAgIGNvbnN0IGdhcEZyYWN0aW9uID0gKGNvbHVtbnMgLSBjdXJyZW50Q29sU3BhbikgLyBjb2x1bW5zO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMSBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpICogJHtnYXBGcmFjdGlvbi50b0ZpeGVkKDQpfSlgO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PlxuICAgICAgICAgIGIuaWQgPT09IGluc3RhbmNlLmlkID8geyAuLi5iLCBjb2xTcGFuOiBjdXJyZW50Q29sU3BhbiB9IDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZEluc2VydGlvblBvaW50Q2FjaGVkKFxuICAgIHg6IG51bWJlcixcbiAgICB5OiBudW1iZXIsXG4gICAgZXhjbHVkZUlkOiBzdHJpbmcsXG4gICAgcmVjdHM6IE1hcDxzdHJpbmcsIERPTVJlY3Q+LFxuICApOiB7IHRhcmdldElkOiBzdHJpbmcgfCBudWxsOyBpbnNlcnRCZWZvcmU6IGJvb2xlYW47IGluc2VydEJlZm9yZUlkOiBzdHJpbmcgfCBudWxsIH0ge1xuICAgIGxldCBiZXN0VGFyZ2V0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGxldCBiZXN0RGlzdCA9IEluZmluaXR5O1xuICAgIGxldCBiZXN0SW5zZXJ0QmVmb3JlID0gdHJ1ZTtcblxuICAgIGZvciAoY29uc3QgW2lkLCByZWN0XSBvZiByZWN0cykge1xuICAgICAgaWYgKGlkID09PSBleGNsdWRlSWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgY3ggPSByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMjtcbiAgICAgIGNvbnN0IGN5ID0gcmVjdC50b3AgKyByZWN0LmhlaWdodCAvIDI7XG5cbiAgICAgIC8vIElmIGN1cnNvciBpcyBkaXJlY3RseSBvdmVyIHRoaXMgY2FyZCwgdXNlIGl0IGltbWVkaWF0ZWx5XG4gICAgICBpZiAoeCA+PSByZWN0LmxlZnQgJiYgeCA8PSByZWN0LnJpZ2h0ICYmIHkgPj0gcmVjdC50b3AgJiYgeSA8PSByZWN0LmJvdHRvbSkge1xuICAgICAgICBjb25zdCBpbnNlcnRCZWZvcmUgPSB4IDwgY3g7XG4gICAgICAgIHJldHVybiB7IHRhcmdldElkOiBpZCwgaW5zZXJ0QmVmb3JlLCBpbnNlcnRCZWZvcmVJZDogaW5zZXJ0QmVmb3JlID8gaWQgOiB0aGlzLm5leHRCbG9ja0lkKGlkKSB9O1xuICAgICAgfVxuXG4gICAgICAvLyBCZXlvbmQgMzAwcHggZnJvbSBjZW50ZXIsIGRvbid0IHNob3cgaW5kaWNhdG9yIFx1MjAxNCBwcmV2ZW50cyB1bmludHVpdGl2ZSBoaWdobGlnaHRzXG4gICAgICBjb25zdCBkaXN0ID0gTWF0aC5oeXBvdCh4IC0gY3gsIHkgLSBjeSk7XG4gICAgICBpZiAoZGlzdCA8IGJlc3REaXN0ICYmIGRpc3QgPCAzMDApIHtcbiAgICAgICAgYmVzdERpc3QgPSBkaXN0O1xuICAgICAgICBiZXN0VGFyZ2V0SWQgPSBpZDtcbiAgICAgICAgYmVzdEluc2VydEJlZm9yZSA9IHggPCBjeDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWJlc3RUYXJnZXRJZCkgcmV0dXJuIHsgdGFyZ2V0SWQ6IG51bGwsIGluc2VydEJlZm9yZTogdHJ1ZSwgaW5zZXJ0QmVmb3JlSWQ6IG51bGwgfTtcbiAgICByZXR1cm4ge1xuICAgICAgdGFyZ2V0SWQ6IGJlc3RUYXJnZXRJZCxcbiAgICAgIGluc2VydEJlZm9yZTogYmVzdEluc2VydEJlZm9yZSxcbiAgICAgIGluc2VydEJlZm9yZUlkOiBiZXN0SW5zZXJ0QmVmb3JlID8gYmVzdFRhcmdldElkIDogdGhpcy5uZXh0QmxvY2tJZChiZXN0VGFyZ2V0SWQpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG5leHRCbG9ja0lkKGlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBibG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzO1xuICAgIGNvbnN0IGlkeCA9IGJsb2Nrcy5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpZCk7XG4gICAgcmV0dXJuIGlkeCA+PSAwICYmIGlkeCA8IGJsb2Nrcy5sZW5ndGggLSAxID8gYmxvY2tzW2lkeCArIDFdLmlkIDogbnVsbDtcbiAgfVxuXG4gIC8qKiBSZW1vdmUgdGhlIGRyYWdnZWQgYmxvY2sgZnJvbSBpdHMgY3VycmVudCBwb3NpdGlvbiBhbmQgaW5zZXJ0IGl0IGJlZm9yZSBpbnNlcnRCZWZvcmVJZCAobnVsbCA9IGFwcGVuZCkuICovXG4gIHByaXZhdGUgcmVvcmRlckJsb2NrKGRyYWdnZWRJZDogc3RyaW5nLCBpbnNlcnRCZWZvcmVJZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGJsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3M7XG4gICAgY29uc3QgZHJhZ2dlZCA9IGJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gZHJhZ2dlZElkKTtcbiAgICBpZiAoIWRyYWdnZWQpIHJldHVybjtcblxuICAgIGNvbnN0IHdpdGhvdXREcmFnZ2VkID0gYmxvY2tzLmZpbHRlcihiID0+IGIuaWQgIT09IGRyYWdnZWRJZCk7XG4gICAgY29uc3QgaW5zZXJ0QXQgPSBpbnNlcnRCZWZvcmVJZFxuICAgICAgPyB3aXRob3V0RHJhZ2dlZC5maW5kSW5kZXgoYiA9PiBiLmlkID09PSBpbnNlcnRCZWZvcmVJZClcbiAgICAgIDogd2l0aG91dERyYWdnZWQubGVuZ3RoO1xuXG4gICAgLy8gTm8tb3AgaWYgZWZmZWN0aXZlbHkgc2FtZSBwb3NpdGlvblxuICAgIGNvbnN0IG9yaWdpbmFsSWR4ID0gYmxvY2tzLmZpbmRJbmRleChiID0+IGIuaWQgPT09IGRyYWdnZWRJZCk7XG4gICAgY29uc3QgcmVzb2x2ZWRBdCA9IGluc2VydEF0ID09PSAtMSA/IHdpdGhvdXREcmFnZ2VkLmxlbmd0aCA6IGluc2VydEF0O1xuICAgIGlmIChyZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCB8fCByZXNvbHZlZEF0ID09PSBvcmlnaW5hbElkeCArIDEpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFtcbiAgICAgIC4uLndpdGhvdXREcmFnZ2VkLnNsaWNlKDAsIHJlc29sdmVkQXQpLFxuICAgICAgZHJhZ2dlZCxcbiAgICAgIC4uLndpdGhvdXREcmFnZ2VkLnNsaWNlKHJlc29sdmVkQXQpLFxuICAgIF07XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0RWRpdE1vZGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZWRpdE1vZGUgPSBlbmFibGVkO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGUgY29sdW1uIGNvdW50LCBjbGFtcGluZyBlYWNoIGJsb2NrJ3MgY29sIGFuZCBjb2xTcGFuIHRvIGZpdC4gKi9cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGNvbnN0IGNvbCA9IE1hdGgubWluKGIuY29sLCBuKTtcbiAgICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihiLmNvbFNwYW4sIG4gLSBjb2wgKyAxKTtcbiAgICAgIHJldHVybiB7IC4uLmIsIGNvbCwgY29sU3BhbiB9O1xuICAgIH0pO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGNvbHVtbnM6IG4sIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLmxhc3RBZGRlZEJsb2NrSWQgPSBpbnN0YW5jZS5pZDtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGZvY3VzZWQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGZvY3VzZWRCbG9ja0lkID0gKGZvY3VzZWQ/LmNsb3Nlc3QoJ1tkYXRhLWJsb2NrLWlkXScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuYmxvY2tJZDtcbiAgICBjb25zdCBzY3JvbGxUYXJnZXRJZCA9IHRoaXMubGFzdEFkZGVkQmxvY2tJZDtcbiAgICB0aGlzLmxhc3RBZGRlZEJsb2NrSWQgPSBudWxsO1xuXG4gICAgdGhpcy5yZW5kZXIodGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuXG4gICAgaWYgKHNjcm9sbFRhcmdldElkKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChzY3JvbGxUYXJnZXRJZCk7XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgZW50cnkud3JhcHBlci5hZGRDbGFzcygnYmxvY2stanVzdC1hZGRlZCcpO1xuICAgICAgICBlbnRyeS53cmFwcGVyLnNjcm9sbEludG9WaWV3KHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZm9jdXNlZEJsb2NrSWQpIHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oYFtkYXRhLWJsb2NrLWlkPVwiJHtmb2N1c2VkQmxvY2tJZH1cIl1gKTtcbiAgICAgIGVsPy5mb2N1cygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBVbmxvYWQgYWxsIGJsb2NrcyBhbmQgY2FuY2VsIGFueSBpbi1wcm9ncmVzcyBkcmFnL3Jlc2l6ZS4gKi9cbiAgZGVzdHJveUFsbCgpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgdGhpcy5hY3RpdmVDbG9uZT8ucmVtb3ZlKCk7XG4gICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHsgYmxvY2sgfSBvZiB0aGlzLmJsb2Nrcy52YWx1ZXMoKSkge1xuICAgICAgYmxvY2sudW5sb2FkKCk7XG4gICAgfVxuICAgIHRoaXMuYmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICAvKiogRnVsbCB0ZWFyZG93bjogdW5sb2FkIGJsb2NrcyBhbmQgcmVtb3ZlIHRoZSBncmlkIGVsZW1lbnQgZnJvbSB0aGUgRE9NLiAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXI/LmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbnVsbDtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgc2V0dGluZ3MgbW9kYWwgKHRpdGxlIHNlY3Rpb24gKyBibG9jay1zcGVjaWZpYyBzZXR0aW5ncykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8vIFtlbW9qaSwgc2VhcmNoIGtleXdvcmRzXSBcdTIwMTQgMTcwIG1vc3QgY29tbW9uL3VzZWZ1bFxuY29uc3QgRU1PSklfUElDS0VSX1NFVDogW3N0cmluZywgc3RyaW5nXVtdID0gW1xuICAvLyBTbWlsZXlzICYgZW1vdGlvblxuICBbJ1x1RDgzRFx1REUwMCcsJ2hhcHB5IHNtaWxlIGdyaW4nXSxbJ1x1RDgzRFx1REUwQScsJ3NtaWxlIGJsdXNoIGhhcHB5J10sWydcdUQ4M0RcdURFMDInLCdsYXVnaCBjcnkgZnVubnkgam95J10sXG4gIFsnXHVEODNFXHVERDcyJywndGVhciBzbWlsZSBncmF0ZWZ1bCddLFsnXHVEODNEXHVERTBEJywnaGVhcnQgZXllcyBsb3ZlJ10sWydcdUQ4M0VcdUREMjknLCdzdGFyIGV5ZXMgZXhjaXRlZCddLFxuICBbJ1x1RDgzRFx1REUwRScsJ2Nvb2wgc3VuZ2xhc3NlcyddLFsnXHVEODNFXHVERDE0JywndGhpbmtpbmcgaG1tJ10sWydcdUQ4M0RcdURFMDUnLCdzd2VhdCBuZXJ2b3VzIGxhdWdoJ10sXG4gIFsnXHVEODNEXHVERTIyJywnY3J5IHNhZCB0ZWFyJ10sWydcdUQ4M0RcdURFMjQnLCdhbmdyeSBodWZmIGZydXN0cmF0ZWQnXSxbJ1x1RDgzRVx1REQ3MycsJ3BhcnR5IGNlbGVicmF0ZSddLFxuICBbJ1x1RDgzRFx1REUzNCcsJ3NsZWVwIHRpcmVkIHp6eiddLFsnXHVEODNFXHVERDJGJywnbWluZCBibG93biBleHBsb2RlJ10sWydcdUQ4M0VcdURFRTEnLCdzYWx1dGUgcmVzcGVjdCddLFxuICAvLyBQZW9wbGUgJiBnZXN0dXJlc1xuICBbJ1x1RDgzRFx1REM0QicsJ3dhdmUgaGVsbG8gYnllJ10sWydcdUQ4M0RcdURDNEQnLCd0aHVtYnMgdXAgZ29vZCBvayddLFsnXHVEODNEXHVEQzRFJywndGh1bWJzIGRvd24gYmFkJ10sXG4gIFsnXHUyNzBDJywndmljdG9yeSBwZWFjZSddLFsnXHVEODNFXHVERDFEJywnaGFuZHNoYWtlIGRlYWwnXSxbJ1x1RDgzRFx1REU0RicsJ3ByYXkgdGhhbmtzIHBsZWFzZSddLFxuICBbJ1x1RDgzRFx1RENBQScsJ211c2NsZSBzdHJvbmcgZmxleCddLFsnXHVEODNEXHVEQzQxJywnZXllIHdhdGNoIHNlZSddLFsnXHVEODNFXHVEREUwJywnYnJhaW4gbWluZCB0aGluayddLFxuICBbJ1x1Mjc2NCcsJ2hlYXJ0IGxvdmUgcmVkJ10sWydcdUQ4M0VcdURERTEnLCdvcmFuZ2UgaGVhcnQnXSxbJ1x1RDgzRFx1REM5QicsJ3llbGxvdyBoZWFydCddLFxuICBbJ1x1RDgzRFx1REM5QScsJ2dyZWVuIGhlYXJ0J10sWydcdUQ4M0RcdURDOTknLCdibHVlIGhlYXJ0J10sWydcdUQ4M0RcdURDOUMnLCdwdXJwbGUgaGVhcnQnXSxbJ1x1RDgzRFx1RERBNCcsJ2JsYWNrIGhlYXJ0J10sXG4gIC8vIE5hdHVyZVxuICBbJ1x1RDgzQ1x1REYzMScsJ3NlZWRsaW5nIHNwcm91dCBncm93J10sWydcdUQ4M0NcdURGM0YnLCdoZXJiIGxlYWYgZ3JlZW4gbmF0dXJlJ10sWydcdUQ4M0NcdURGNDAnLCdjbG92ZXIgbHVjayddLFxuICBbJ1x1RDgzQ1x1REYzOCcsJ2Jsb3Nzb20gZmxvd2VyIHBpbmsnXSxbJ1x1RDgzQ1x1REYzQScsJ2Zsb3dlciBoaWJpc2N1cyddLFsnXHVEODNDXHVERjNCJywnc3VuZmxvd2VyJ10sXG4gIFsnXHVEODNDXHVERjQyJywnYXV0dW1uIGZhbGwgbGVhZiddLFsnXHVEODNDXHVERjBBJywnd2F2ZSBvY2VhbiB3YXRlciBzZWEnXSxbJ1x1RDgzRFx1REQyNScsJ2ZpcmUgZmxhbWUgaG90J10sXG4gIFsnXHUyNzQ0Jywnc25vd2ZsYWtlIGNvbGQgaWNlIHdpbnRlciddLFsnXHUyNkExJywnbGlnaHRuaW5nIGJvbHQgZW5lcmd5J10sWydcdUQ4M0NcdURGMDgnLCdyYWluYm93J10sXG4gIFsnXHUyNjAwJywnc3VuIHN1bm55IGJyaWdodCddLFsnXHVEODNDXHVERjE5JywnbW9vbiBuaWdodCBjcmVzY2VudCddLFsnXHUyQjUwJywnc3RhciBmYXZvcml0ZSddLFxuICBbJ1x1RDgzQ1x1REYxRicsJ2dsb3dpbmcgc3RhciBzaGluZSddLFsnXHUyNzI4Jywnc3BhcmtsZXMgc2hpbmUgbWFnaWMnXSxbJ1x1RDgzQ1x1REZENCcsJ21vdW50YWluIHBlYWsnXSxcbiAgWydcdUQ4M0NcdURGMEQnLCdlYXJ0aCBnbG9iZSB3b3JsZCddLFsnXHVEODNDXHVERjEwJywnZ2xvYmUgaW50ZXJuZXQgd2ViJ10sXG4gIC8vIEZvb2QgJiBvYmplY3RzXG4gIFsnXHUyNjE1JywnY29mZmVlIHRlYSBob3QgZHJpbmsnXSxbJ1x1RDgzQ1x1REY3NScsJ3RlYSBjdXAgaG90J10sWydcdUQ4M0NcdURGN0EnLCdiZWVyIGRyaW5rJ10sXG4gIFsnXHVEODNDXHVERjRFJywnYXBwbGUgZnJ1aXQgcmVkJ10sWydcdUQ4M0NcdURGNEInLCdsZW1vbiB5ZWxsb3cgc291ciddLFsnXHVEODNDXHVERjgyJywnY2FrZSBiaXJ0aGRheSddLFxuICAvLyBBY3Rpdml0aWVzICYgc3BvcnRzXG4gIFsnXHVEODNDXHVERkFGJywndGFyZ2V0IGJ1bGxzZXllIGdvYWwnXSxbJ1x1RDgzQ1x1REZDNicsJ3Ryb3BoeSBhd2FyZCB3aW4nXSxbJ1x1RDgzRVx1REQ0NycsJ21lZGFsIGdvbGQgZmlyc3QnXSxcbiAgWydcdUQ4M0NcdURGQUUnLCdnYW1lIGNvbnRyb2xsZXIgcGxheSddLFsnXHVEODNDXHVERkE4JywnYXJ0IHBhbGV0dGUgY3JlYXRpdmUgcGFpbnQnXSxbJ1x1RDgzQ1x1REZCNScsJ211c2ljIG5vdGUgc29uZyddLFxuICBbJ1x1RDgzQ1x1REZBQycsJ2NsYXBwZXIgZmlsbSBtb3ZpZSddLFsnXHVEODNEXHVEQ0Y3JywnY2FtZXJhIHBob3RvJ10sWydcdUQ4M0NcdURGODEnLCdnaWZ0IHByZXNlbnQnXSxcbiAgWydcdUQ4M0NcdURGQjInLCdkaWNlIGdhbWUgcmFuZG9tJ10sWydcdUQ4M0VcdURERTknLCdwdXp6bGUgcGllY2UnXSxbJ1x1RDgzQ1x1REZBRCcsJ3RoZWF0ZXIgbWFza3MnXSxcbiAgLy8gVHJhdmVsICYgcGxhY2VzXG4gIFsnXHVEODNEXHVERTgwJywncm9ja2V0IGxhdW5jaCBzcGFjZSddLFsnXHUyNzA4JywnYWlycGxhbmUgdHJhdmVsIGZseSddLFsnXHVEODNEXHVERTgyJywndHJhaW4gdHJhdmVsJ10sXG4gIFsnXHVEODNDXHVERkUwJywnaG91c2UgaG9tZSddLFsnXHVEODNDXHVERkQ5JywnY2l0eSBidWlsZGluZyddLFsnXHVEODNDXHVERjA2JywnY2l0eSBzdW5zZXQnXSxcbiAgLy8gT2JqZWN0cyAmIHRvb2xzXG4gIFsnXHVEODNEXHVEQ0MxJywnZm9sZGVyIGRpcmVjdG9yeSddLFsnXHVEODNEXHVEQ0MyJywnb3BlbiBmb2xkZXInXSxbJ1x1RDgzRFx1RENDNCcsJ2RvY3VtZW50IHBhZ2UgZmlsZSddLFxuICBbJ1x1RDgzRFx1RENERCcsJ21lbW8gd3JpdGUgbm90ZSBlZGl0J10sWydcdUQ4M0RcdURDQ0InLCdjbGlwYm9hcmQgY29weSddLFsnXHVEODNEXHVEQ0NDJywncHVzaHBpbiBwaW4nXSxcbiAgWydcdUQ4M0RcdURDQ0QnLCdsb2NhdGlvbiBwaW4gbWFwJ10sWydcdUQ4M0RcdUREMTYnLCdib29rbWFyayBzYXZlJ10sWydcdUQ4M0RcdUREQzInLCdpbmRleCBkaXZpZGVycyddLFxuICBbJ1x1RDgzRFx1RENDNScsJ2NhbGVuZGFyIGRhdGUgc2NoZWR1bGUnXSxbJ1x1RDgzRFx1REREMycsJ2NhbGVuZGFyIHNwaXJhbCddLFsnXHUyM0YwJywnYWxhcm0gY2xvY2sgdGltZSB3YWtlJ10sXG4gIFsnXHVEODNEXHVERDUwJywnY2xvY2sgdGltZSBob3VyJ10sWydcdTIzRjEnLCdzdG9wd2F0Y2ggdGltZXInXSxbJ1x1RDgzRFx1RENDQScsJ2NoYXJ0IGJhciBkYXRhJ10sXG4gIFsnXHVEODNEXHVEQ0M4JywnY2hhcnQgdXAgZ3Jvd3RoIHRyZW5kJ10sWydcdUQ4M0RcdURDQzknLCdjaGFydCBkb3duIGRlY2xpbmUnXSxcbiAgWydcdUQ4M0RcdURDQTEnLCdpZGVhIGxpZ2h0IGJ1bGIgaW5zaWdodCddLFsnXHVEODNEXHVERDBEJywnc2VhcmNoIG1hZ25pZnkgem9vbSddLFsnXHVEODNEXHVERDE3JywnbGluayBjaGFpbiB1cmwnXSxcbiAgWydcdUQ4M0RcdURDRTInLCdsb3Vkc3BlYWtlciBhbm5vdW5jZSddLFsnXHVEODNEXHVERDE0JywnYmVsbCBub3RpZmljYXRpb24gYWxlcnQnXSxcbiAgWydcdUQ4M0RcdURDQUMnLCdzcGVlY2ggYnViYmxlIGNoYXQgbWVzc2FnZSddLFsnXHVEODNEXHVEQ0FEJywndGhvdWdodCB0aGluayBidWJibGUnXSxcbiAgWydcdUQ4M0RcdURDREEnLCdib29rcyBzdHVkeSBsaWJyYXJ5J10sWydcdUQ4M0RcdURDRDYnLCdvcGVuIGJvb2sgcmVhZCddLFsnXHVEODNEXHVEQ0RDJywnc2Nyb2xsIGRvY3VtZW50J10sXG4gIFsnXHUyNzA5JywnZW52ZWxvcGUgZW1haWwgbGV0dGVyJ10sWydcdUQ4M0RcdURDRTcnLCdlbWFpbCBtZXNzYWdlJ10sWydcdUQ4M0RcdURDRTUnLCdpbmJveCBkb3dubG9hZCddLFxuICBbJ1x1RDgzRFx1RENFNCcsJ291dGJveCB1cGxvYWQgc2VuZCddLFsnXHVEODNEXHVEREQxJywndHJhc2ggZGVsZXRlIHJlbW92ZSddLFxuICAvLyBUZWNoXG4gIFsnXHVEODNEXHVEQ0JCJywnbGFwdG9wIGNvbXB1dGVyIGNvZGUnXSxbJ1x1RDgzRFx1RERBNScsJ2Rlc2t0b3AgbW9uaXRvciBzY3JlZW4nXSxbJ1x1RDgzRFx1RENGMScsJ3Bob25lIG1vYmlsZSddLFxuICBbJ1x1MjMyOCcsJ2tleWJvYXJkIHR5cGUnXSxbJ1x1RDgzRFx1RERCMScsJ21vdXNlIGN1cnNvciBjbGljayddLFsnXHVEODNEXHVEQ0UxJywnc2F0ZWxsaXRlIGFudGVubmEgc2lnbmFsJ10sXG4gIFsnXHVEODNEXHVERDBDJywncGx1ZyBwb3dlciBlbGVjdHJpYyddLFsnXHVEODNEXHVERDBCJywnYmF0dGVyeSBwb3dlciBjaGFyZ2UnXSxbJ1x1RDgzRFx1RENCRScsJ2Zsb3BweSBkaXNrIHNhdmUnXSxcbiAgWydcdUQ4M0RcdURDQkYnLCdkaXNjIGNkIGR2ZCddLFsnXHVEODNEXHVEREE4JywncHJpbnRlciBwcmludCddLFxuICAvLyBTeW1ib2xzICYgc3RhdHVzXG4gIFsnXHUyNzA1JywnY2hlY2sgZG9uZSBjb21wbGV0ZSB5ZXMnXSxbJ1x1Mjc0QycsJ2Nyb3NzIGVycm9yIHdyb25nIG5vIGRlbGV0ZSddLFxuICBbJ1x1MjZBMCcsJ3dhcm5pbmcgY2F1dGlvbiBhbGVydCddLFsnXHUyNzUzJywncXVlc3Rpb24gbWFyayddLFsnXHUyNzU3JywnZXhjbGFtYXRpb24gaW1wb3J0YW50J10sXG4gIFsnXHVEODNEXHVERDEyJywnbG9jayBzZWN1cmUgcHJpdmF0ZSddLFsnXHVEODNEXHVERDEzJywndW5sb2NrIG9wZW4gcHVibGljJ10sWydcdUQ4M0RcdUREMTEnLCdrZXkgcGFzc3dvcmQgYWNjZXNzJ10sXG4gIFsnXHVEODNEXHVERUUxJywnc2hpZWxkIHByb3RlY3Qgc2VjdXJpdHknXSxbJ1x1MjY5OScsJ2dlYXIgc2V0dGluZ3MgY29uZmlnJ10sWydcdUQ4M0RcdUREMjcnLCd3cmVuY2ggdG9vbCBmaXgnXSxcbiAgWydcdUQ4M0RcdUREMjgnLCdoYW1tZXIgYnVpbGQnXSxbJ1x1MjY5NycsJ2ZsYXNrIGNoZW1pc3RyeSBsYWInXSxbJ1x1RDgzRFx1REQyQycsJ21pY3Jvc2NvcGUgc2NpZW5jZSByZXNlYXJjaCddLFxuICBbJ1x1RDgzRFx1REQyRCcsJ3RlbGVzY29wZSBzcGFjZSBhc3Ryb25vbXknXSxbJ1x1RDgzRVx1RERFQScsJ3Rlc3QgdHViZSBleHBlcmltZW50J10sXG4gIFsnXHVEODNEXHVEQzhFJywnZ2VtIGRpYW1vbmQgcHJlY2lvdXMnXSxbJ1x1RDgzRFx1RENCMCcsJ21vbmV5IGJhZyByaWNoJ10sWydcdUQ4M0RcdURDQjMnLCdjcmVkaXQgY2FyZCBwYXltZW50J10sXG4gIFsnXHVEODNDXHVERkY3JywnbGFiZWwgdGFnIHByaWNlJ10sWydcdUQ4M0NcdURGODAnLCdyaWJib24gYm93IGdpZnQnXSxcbiAgLy8gTWlzYyB1c2VmdWxcbiAgWydcdUQ4M0VcdURERUQnLCdjb21wYXNzIG5hdmlnYXRlIGRpcmVjdGlvbiddLFsnXHVEODNEXHVEREZBJywnbWFwIHdvcmxkIG5hdmlnYXRlJ10sXG4gIFsnXHVEODNEXHVEQ0U2JywnYm94IHBhY2thZ2Ugc2hpcHBpbmcnXSxbJ1x1RDgzRFx1RERDNCcsJ2ZpbGluZyBjYWJpbmV0IGFyY2hpdmUnXSxcbiAgWydcdUQ4M0RcdUREMTAnLCdsb2NrIGtleSBzZWN1cmUnXSxbJ1x1RDgzRFx1RENDRScsJ3BhcGVyY2xpcCBhdHRhY2gnXSxbJ1x1MjcwMicsJ3NjaXNzb3JzIGN1dCddLFxuICBbJ1x1RDgzRFx1REQ4QScsJ3BlbiB3cml0ZSBlZGl0J10sWydcdUQ4M0RcdURDQ0YnLCdydWxlciBtZWFzdXJlJ10sWydcdUQ4M0RcdUREMDUnLCdkaW0gYnJpZ2h0bmVzcyddLFxuICBbJ1x1RDgzRFx1REQwNicsJ2JyaWdodCBzdW4gbGlnaHQnXSxbJ1x1MjY3QicsJ3JlY3ljbGUgc3VzdGFpbmFiaWxpdHknXSxbJ1x1MjcxNCcsJ2NoZWNrbWFyayBkb25lJ10sXG4gIFsnXHUyNzk1JywncGx1cyBhZGQnXSxbJ1x1Mjc5NicsJ21pbnVzIHJlbW92ZSddLFsnXHVEODNEXHVERDA0JywncmVmcmVzaCBzeW5jIGxvb3AnXSxcbiAgWydcdTIzRTknLCdmYXN0IGZvcndhcmQgc2tpcCddLFsnXHUyM0VBJywncmV3aW5kIGJhY2snXSxbJ1x1MjNGOCcsJ3BhdXNlIHN0b3AnXSxcbiAgWydcdTI1QjYnLCdwbGF5IHN0YXJ0J10sWydcdUQ4M0RcdUREMDAnLCdzaHVmZmxlIHJhbmRvbSBtaXgnXSxcbl07XG5cbmNsYXNzIEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcml2YXRlIGJsb2NrOiBCYXNlQmxvY2ssXG4gICAgcHJpdmF0ZSBvblNhdmU6ICgpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Jsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuaW5zdGFuY2UuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdUaXRsZSBsYWJlbCcpXG4gICAgICAuc2V0RGVzYygnTGVhdmUgZW1wdHkgdG8gdXNlIHRoZSBkZWZhdWx0IHRpdGxlLicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUodHlwZW9mIGRyYWZ0Ll90aXRsZUxhYmVsID09PSAnc3RyaW5nJyA/IGRyYWZ0Ll90aXRsZUxhYmVsIDogJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0RlZmF1bHQgdGl0bGUnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5fdGl0bGVMYWJlbCA9IHY7IH0pLFxuICAgICAgKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBFbW9qaSBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgY29uc3QgZW1vamlSb3cgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLXJvdycgfSk7XG4gICAgZW1vamlSb3cuY3JlYXRlU3Bhbih7IGNsczogJ3NldHRpbmctaXRlbS1uYW1lJywgdGV4dDogJ1RpdGxlIGVtb2ppJyB9KTtcblxuICAgIGNvbnN0IGNvbnRyb2xzID0gZW1vamlSb3cuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLWNvbnRyb2xzJyB9KTtcblxuICAgIGNvbnN0IHRyaWdnZXJCdG4gPSBjb250cm9scy5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdlbW9qaS1waWNrZXItdHJpZ2dlcicgfSk7XG4gICAgY29uc3QgdXBkYXRlVHJpZ2dlciA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHZhbCA9IHR5cGVvZiBkcmFmdC5fdGl0bGVFbW9qaSA9PT0gJ3N0cmluZycgPyBkcmFmdC5fdGl0bGVFbW9qaSA6ICcnO1xuICAgICAgdHJpZ2dlckJ0bi5lbXB0eSgpO1xuICAgICAgdHJpZ2dlckJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogdmFsIHx8ICdcdUZGMEInIH0pO1xuICAgICAgdHJpZ2dlckJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnZW1vamktcGlja2VyLWNoZXZyb24nLCB0ZXh0OiAnXHUyNUJFJyB9KTtcbiAgICB9O1xuICAgIHVwZGF0ZVRyaWdnZXIoKTtcblxuICAgIGNvbnN0IGNsZWFyQnRuID0gY29udHJvbHMuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktcGlja2VyLWNsZWFyJywgdGV4dDogJ1x1MjcxNScgfSk7XG4gICAgY2xlYXJCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0NsZWFyIGVtb2ppJyk7XG5cbiAgICBjb25zdCBwYW5lbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdlbW9qaS1waWNrZXItcGFuZWwnIH0pO1xuICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHBhbmVsLmNyZWF0ZUVsKCdpbnB1dCcsIHtcbiAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgIGNsczogJ2Vtb2ppLXBpY2tlci1zZWFyY2gnLFxuICAgICAgcGxhY2Vob2xkZXI6ICdTZWFyY2hcdTIwMjYnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpZEVsID0gcGFuZWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLWdyaWQnIH0pO1xuXG4gICAgY29uc3QgcmVuZGVyR3JpZCA9IChxdWVyeTogc3RyaW5nKSA9PiB7XG4gICAgICBncmlkRWwuZW1wdHkoKTtcbiAgICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgIGNvbnN0IGZpbHRlcmVkID0gcVxuICAgICAgICA/IEVNT0pJX1BJQ0tFUl9TRVQuZmlsdGVyKChbZSwga10pID0+IGsuaW5jbHVkZXMocSkgfHwgZSA9PT0gcSlcbiAgICAgICAgOiBFTU9KSV9QSUNLRVJfU0VUO1xuICAgICAgZm9yIChjb25zdCBbZW1vamldIG9mIGZpbHRlcmVkKSB7XG4gICAgICAgIGNvbnN0IGJ0biA9IGdyaWRFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdlbW9qaS1idG4nLCB0ZXh0OiBlbW9qaSB9KTtcbiAgICAgICAgaWYgKGRyYWZ0Ll90aXRsZUVtb2ppID09PSBlbW9qaSkgYnRuLmFkZENsYXNzKCdpcy1zZWxlY3RlZCcpO1xuICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgZHJhZnQuX3RpdGxlRW1vamkgPSBlbW9qaTtcbiAgICAgICAgICB1cGRhdGVUcmlnZ2VyKCk7XG4gICAgICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICBzZWFyY2hJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgICAgIHJlbmRlckdyaWQoJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZ3JpZEVsLmNyZWF0ZVNwYW4oeyBjbHM6ICdlbW9qaS1waWNrZXItZW1wdHknLCB0ZXh0OiAnTm8gcmVzdWx0cycgfSk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZW5kZXJHcmlkKCcnKTtcblxuICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4gcmVuZGVyR3JpZChzZWFyY2hJbnB1dC52YWx1ZSkpO1xuXG4gICAgdHJpZ2dlckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIGNvbnN0IG9wZW4gPSBwYW5lbC5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG4gICAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gb3BlbiA/ICdub25lJyA6ICdibG9jayc7XG4gICAgICBpZiAoIW9wZW4pIHNldFRpbWVvdXQoKCkgPT4gc2VhcmNoSW5wdXQuZm9jdXMoKSwgMCk7XG4gICAgfSk7XG5cbiAgICBjbGVhckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gJyc7XG4gICAgICB1cGRhdGVUcmlnZ2VyKCk7XG4gICAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgc2VhcmNoSW5wdXQudmFsdWUgPSAnJztcbiAgICAgIHJlbmRlckdyaWQoJycpO1xuICAgIH0pO1xuICAgIC8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0hpZGUgdGl0bGUnKVxuICAgICAgLmFkZFRvZ2dsZSh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuX2hpZGVUaXRsZSA9PT0gdHJ1ZSlcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX2hpZGVUaXRsZSA9IHY7IH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBkcmFmdDtcbiAgICAgICAgICB0aGlzLm9uU2F2ZSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcblxuICAgIGNvbnN0IGhyID0gY29udGVudEVsLmNyZWF0ZUVsKCdocicpO1xuICAgIGhyLnN0eWxlLm1hcmdpbiA9ICcxNnB4IDAnO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywge1xuICAgICAgdGV4dDogJ0Jsb2NrLXNwZWNpZmljIHNldHRpbmdzOicsXG4gICAgICBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ29uZmlndXJlIGJsb2NrLi4uJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIHRoaXMuYmxvY2sub3BlblNldHRpbmdzKHRoaXMub25TYXZlKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUmVtb3ZlIGNvbmZpcm1hdGlvbiBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1JlbW92ZSBibG9jaz8nIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1RoaXMgYmxvY2sgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGhvbWVwYWdlLicgfSk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1JlbW92ZScpLnNldFdhcm5pbmcoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9uQ29uZmlybSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBCbG9ja0ZhY3RvcnksIEJsb2NrVHlwZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5jbGFzcyBCbG9ja1JlZ2lzdHJ5Q2xhc3Mge1xuICBwcml2YXRlIGZhY3RvcmllcyA9IG5ldyBNYXA8QmxvY2tUeXBlLCBCbG9ja0ZhY3Rvcnk+KCk7XG5cbiAgcmVnaXN0ZXIoZmFjdG9yeTogQmxvY2tGYWN0b3J5KTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuc2V0KGZhY3RvcnkudHlwZSwgZmFjdG9yeSk7XG4gIH1cblxuICBnZXQodHlwZTogQmxvY2tUeXBlKTogQmxvY2tGYWN0b3J5IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3JpZXMuZ2V0KHR5cGUpO1xuICB9XG5cbiAgZ2V0QWxsKCk6IEJsb2NrRmFjdG9yeVtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmZhY3Rvcmllcy52YWx1ZXMoKSk7XG4gIH1cblxuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5jbGVhcigpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBCbG9ja1JlZ2lzdHJ5ID0gbmV3IEJsb2NrUmVnaXN0cnlDbGFzcygpO1xuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBCbG9ja1R5cGUsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sYmFyIHtcbiAgcHJpdmF0ZSB0b29sYmFyRWw6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGZhYkVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQsXG4gICAgcHJpdmF0ZSBvbkNvbHVtbnNDaGFuZ2U6IChuOiBudW1iZXIpID0+IHZvaWQsXG4gICkge1xuICAgIC8vIEZsb2F0aW5nIGFjdGlvbiBidXR0b24gXHUyMDE0IHZpc2libGUgaW4gcmVhZCBtb2RlLCB0cmlnZ2VycyBlZGl0IG1vZGVcbiAgICB0aGlzLmZhYkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZWRpdC1mYWInIH0pO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgIHRoaXMuZmFiRWwuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgdGhpcy5mYWJFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRW50ZXIgZWRpdCBtb2RlJyk7XG4gICAgdGhpcy5mYWJFbC5zZXRUZXh0KCdcdTI3MEYnKTtcbiAgICB0aGlzLmZhYkVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGVFZGl0TW9kZSgpKTtcbiAgICB0aGlzLmZhYkVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnRvZ2dsZUVkaXRNb2RlKCk7IH1cbiAgICB9KTtcblxuICAgIHRoaXMudG9vbGJhckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtdG9vbGJhcicgfSk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3Rvb2xiYXInKTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgdG9vbGJhcicpO1xuICAgIHRoaXMucmVuZGVyVG9vbGJhcigpO1xuICB9XG5cbiAgLyoqIFRvZ2dsZSBlZGl0IG1vZGUgXHUyMDE0IGNhbGxlZCBmcm9tIEZBQiwgRG9uZSBidXR0b24sIGFuZCBrZXlib2FyZCBzaG9ydGN1dCBjb21tYW5kLiAqL1xuICB0b2dnbGVFZGl0TW9kZSgpOiB2b2lkIHtcbiAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgdGhpcy5ncmlkLnNldEVkaXRNb2RlKHRoaXMuZWRpdE1vZGUpO1xuICAgIHRoaXMuc3luY1Zpc2liaWxpdHkoKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY1Zpc2liaWxpdHkoKTogdm9pZCB7XG4gICAgLy8gUmVhZCBtb2RlOiBzaG93IEZBQiwgaGlkZSB0b29sYmFyXG4gICAgLy8gRWRpdCBtb2RlOiBzaG93IHRvb2xiYXIsIGhpZGUgRkFCXG4gICAgdGhpcy5mYWJFbC50b2dnbGVDbGFzcygnaXMtaGlkZGVuJywgdGhpcy5lZGl0TW9kZSk7XG4gICAgdGhpcy50b29sYmFyRWwudG9nZ2xlQ2xhc3MoJ2lzLXZpc2libGUnLCB0aGlzLmVkaXRNb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gRWRpdCBtb2RlIGluZGljYXRvciAobGVmdC1hbGlnbmVkKVxuICAgIGNvbnN0IGluZGljYXRvciA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZURpdih7IGNsczogJ3Rvb2xiYXItZWRpdC1pbmRpY2F0b3IgaXMtdmlzaWJsZScgfSk7XG4gICAgaW5kaWNhdG9yLmNyZWF0ZURpdih7IGNsczogJ3Rvb2xiYXItZWRpdC1kb3QnIH0pO1xuICAgIGluZGljYXRvci5jcmVhdGVTcGFuKHsgdGV4dDogJ0VkaXRpbmcnIH0pO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gQWRkIEJsb2NrIGJ1dHRvbiAob25seSBpbiBlZGl0IG1vZGUpXG4gICAgY29uc3QgYWRkQnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1hZGQtYnRuJywgdGV4dDogJysgQWRkIEJsb2NrJyB9KTtcbiAgICBhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IHRoaXMub3BlbkFkZEJsb2NrTW9kYWwoKTsgfSk7XG5cbiAgICAvLyBEb25lIGJ1dHRvbiBcdTIwMTQgZXhpdHMgZWRpdCBtb2RlXG4gICAgY29uc3QgZG9uZUJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItZWRpdC1idG4gdG9vbGJhci1idG4tYWN0aXZlJywgdGV4dDogJ1x1MjcxMyBEb25lJyB9KTtcbiAgICBkb25lQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGVFZGl0TW9kZSgpKTtcblxuICAgIC8vIFdpcmUgdXAgdGhlIGdyaWQncyBlbXB0eSBzdGF0ZSBDVEEgdG8gb3BlbiB0aGUgYWRkIGJsb2NrIG1vZGFsXG4gICAgdGhpcy5ncmlkLm9uUmVxdWVzdEFkZEJsb2NrID0gKCkgPT4geyB0aGlzLm9wZW5BZGRCbG9ja01vZGFsKCk7IH07XG4gIH1cblxuICAvKiogT3BlbnMgdGhlIEFkZCBCbG9jayBtb2RhbC4gQ2FsbGVkIGZyb20gdG9vbGJhciBidXR0b24gYW5kIGVtcHR5IHN0YXRlIENUQS4gKi9cbiAgcHJpdmF0ZSBvcGVuQWRkQmxvY2tNb2RhbCgpOiB2b2lkIHtcbiAgICBuZXcgQWRkQmxvY2tNb2RhbCh0aGlzLmFwcCwgKHR5cGUpID0+IHtcbiAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBtYXhSb3cgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLnJlZHVjZShcbiAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UgPSB7XG4gICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICB0eXBlLFxuICAgICAgICBjb2w6IDEsXG4gICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgY29sU3BhbjogTWF0aC5taW4oZmFjdG9yeS5kZWZhdWx0U2l6ZS5jb2xTcGFuLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyksXG4gICAgICAgIHJvd1NwYW46IGZhY3RvcnkuZGVmYXVsdFNpemUucm93U3BhbixcbiAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgfTtcblxuICAgICAgdGhpcy5ncmlkLmFkZEJsb2NrKGluc3RhbmNlKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBnZXRGYWJFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5mYWJFbDtcbiAgfVxuXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5ncmlkLm9uUmVxdWVzdEFkZEJsb2NrID0gbnVsbDtcbiAgICB0aGlzLmZhYkVsLnJlbW92ZSgpO1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNvbnN0IEJMT0NLX01FVEE6IFJlY29yZDxCbG9ja1R5cGUsIHsgaWNvbjogc3RyaW5nOyBkZXNjOiBzdHJpbmcgfT4gPSB7XG4gICdncmVldGluZyc6ICAgICAgeyBpY29uOiAnXFx1ezFGNDRCfScsIGRlc2M6ICdQZXJzb25hbGl6ZWQgZ3JlZXRpbmcgd2l0aCB0aW1lIG9mIGRheScgfSxcbiAgJ2Nsb2NrJzogICAgICAgICB7IGljb246ICdcXHV7MUY1NTB9JywgZGVzYzogJ0xpdmUgY2xvY2sgd2l0aCBkYXRlIGRpc3BsYXknIH0sXG4gICdmb2xkZXItbGlua3MnOiAgeyBpY29uOiAnXFx1ezFGNTE3fScsIGRlc2M6ICdRdWljayBsaW5rcyB0byBub3RlcyBhbmQgZm9sZGVycycgfSxcbiAgJ2luc2lnaHQnOiAgICAgICB7IGljb246ICdcXHV7MUY0QTF9JywgZGVzYzogJ0RhaWx5IHJvdGF0aW5nIG5vdGUgZnJvbSBhIHRhZycgfSxcbiAgJ3RhZy1ncmlkJzogICAgICB7IGljb246ICdcXHV7MUYzRjd9XFx1RkUwRicsIGRlc2M6ICdHcmlkIG9mIGxhYmVsZWQgdmFsdWUgYnV0dG9ucycgfSxcbiAgJ3F1b3Rlcy1saXN0JzogICB7IGljb246ICdcXHV7MUY0QUN9JywgZGVzYzogJ0NvbGxlY3Rpb24gb2YgcXVvdGVzIGZyb20gbm90ZXMnIH0sXG4gICdpbWFnZS1nYWxsZXJ5JzogeyBpY29uOiAnXFx1ezFGNUJDfVxcdUZFMEYnLCBkZXNjOiAnUGhvdG8gZ3JpZCBmcm9tIGEgdmF1bHQgZm9sZGVyJyB9LFxuICAnZW1iZWRkZWQtbm90ZSc6IHsgaWNvbjogJ1xcdXsxRjRDNH0nLCBkZXNjOiAnUmVuZGVyIGEgbm90ZSBpbmxpbmUgb24gdGhlIHBhZ2UnIH0sXG4gICdzdGF0aWMtdGV4dCc6ICAgeyBpY29uOiAnXFx1ezFGNEREfScsIGRlc2M6ICdNYXJrZG93biB0ZXh0IGJsb2NrIHlvdSB3cml0ZSBkaXJlY3RseScgfSxcbiAgJ2h0bWwnOiAgICAgICAgICB7IGljb246ICc8Lz4nLCBkZXNjOiAnQ3VzdG9tIEhUTUwgY29udGVudCAoc2FuaXRpemVkKScgfSxcbn07XG5cbmNsYXNzIEFkZEJsb2NrTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25TZWxlY3Q6ICh0eXBlOiBCbG9ja1R5cGUpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0FkZCBCbG9jaycsIGNsczogJ2FkZC1ibG9jay1tb2RhbC10aXRsZScgfSk7XG5cbiAgICBjb25zdCBncmlkID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2FkZC1ibG9jay1ncmlkJyB9KTtcblxuICAgIGZvciAoY29uc3QgZmFjdG9yeSBvZiBCbG9ja1JlZ2lzdHJ5LmdldEFsbCgpKSB7XG4gICAgICBjb25zdCBtZXRhID0gQkxPQ0tfTUVUQVtmYWN0b3J5LnR5cGVdO1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdhZGQtYmxvY2stb3B0aW9uJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLWljb24nLCB0ZXh0OiBtZXRhPy5pY29uID8/ICdcXHUyNUFBJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLW5hbWUnLCB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lIH0pO1xuICAgICAgaWYgKG1ldGE/LmRlc2MpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdhZGQtYmxvY2stZGVzYycsIHRleHQ6IG1ldGEuZGVzYyB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5vblNlbGVjdChmYWN0b3J5LnR5cGUpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgR3JlZXRpbmdCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG5hbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2dyZWV0aW5nLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dUaW1lID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93VGltZT86IGJvb2xlYW4gfTtcblxuICAgIGlmIChzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdncmVldGluZy10aW1lJyB9KTtcbiAgICB9XG4gICAgdGhpcy5uYW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdncmVldGluZy1uYW1lJyB9KTtcblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCBob3VyID0gbm93LmhvdXIoKTtcbiAgICBjb25zdCB7IG5hbWUgPSAnYmVudG9ybmF0bycsIHNob3dUaW1lID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgbmFtZT86IHN0cmluZztcbiAgICAgIHNob3dUaW1lPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2FsdXRhdGlvbiA9XG4gICAgICBob3VyID49IDUgJiYgaG91ciA8IDEyID8gJ0J1b25naW9ybm8nIDpcbiAgICAgIGhvdXIgPj0gMTIgJiYgaG91ciA8IDE4ID8gJ0J1b24gcG9tZXJpZ2dpbycgOlxuICAgICAgJ0J1b25hc2VyYSc7XG5cbiAgICBpZiAodGhpcy50aW1lRWwgJiYgc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdCgnSEg6bW0nKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm5hbWVFbCkge1xuICAgICAgdGhpcy5uYW1lRWwuc2V0VGV4dChgJHtzYWx1dGF0aW9ufSwgJHtuYW1lfWApO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgR3JlZXRpbmdTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgR3JlZXRpbmdTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdHcmVldGluZyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ05hbWUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQubmFtZSBhcyBzdHJpbmcgPz8gJ2JlbnRvcm5hdG8nKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubmFtZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHRpbWUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93VGltZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGltZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDb21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlQmxvY2sgZXh0ZW5kcyBDb21wb25lbnQge1xuICBwcml2YXRlIF9oZWFkZXJDb250YWluZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFwcDogQXBwLFxuICAgIHByb3RlY3RlZCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcm90ZWN0ZWQgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBhYnN0cmFjdCByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbiAgLy8gT3ZlcnJpZGUgdG8gb3BlbiBhIHBlci1ibG9jayBzZXR0aW5ncyBtb2RhbFxuICBvcGVuU2V0dGluZ3MoX29uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge31cblxuICAvLyBDYWxsZWQgYnkgR3JpZExheW91dCB0byByZWRpcmVjdCByZW5kZXJIZWFkZXIgb3V0cHV0IG91dHNpZGUgYmxvY2stY29udGVudC5cbiAgc2V0SGVhZGVyQ29udGFpbmVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuX2hlYWRlckNvbnRhaW5lciA9IGVsO1xuICB9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsLlxuICAvLyBSZXNwZWN0cyBfaGlkZVRpdGxlLCBfdGl0bGVMYWJlbCwgYW5kIF90aXRsZUVtb2ppIGZyb20gaW5zdGFuY2UuY29uZmlnLlxuICAvLyBSZW5kZXJzIGludG8gdGhlIGhlYWRlciBjb250YWluZXIgc2V0IGJ5IEdyaWRMYXlvdXQgKGlmIGFueSksIGVsc2UgZmFsbHMgYmFjayB0byBlbC5cbiAgcHJvdGVjdGVkIHJlbmRlckhlYWRlcihlbDogSFRNTEVsZW1lbnQsIHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjZmcgPSB0aGlzLmluc3RhbmNlLmNvbmZpZztcbiAgICBpZiAoY2ZnLl9oaWRlVGl0bGUgPT09IHRydWUpIHJldHVybjtcbiAgICBjb25zdCBsYWJlbCA9ICh0eXBlb2YgY2ZnLl90aXRsZUxhYmVsID09PSAnc3RyaW5nJyAmJiBjZmcuX3RpdGxlTGFiZWwudHJpbSgpKVxuICAgICAgPyBjZmcuX3RpdGxlTGFiZWwudHJpbSgpXG4gICAgICA6IHRpdGxlO1xuICAgIGlmICghbGFiZWwpIHJldHVybjtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLl9oZWFkZXJDb250YWluZXIgPz8gZWw7XG4gICAgY29uc3QgaGVhZGVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhlYWRlcicgfSk7XG4gICAgaWYgKHR5cGVvZiBjZmcuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVFbW9qaSkge1xuICAgICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyBjbHM6ICdibG9jay1oZWFkZXItZW1vamknLCB0ZXh0OiBjZmcuX3RpdGxlRW1vamkgfSk7XG4gICAgfVxuICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgdGV4dDogbGFiZWwgfSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBDbG9ja0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGF0ZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnY2xvY2stYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd0RhdGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dEYXRlPzogYm9vbGVhbiB9O1xuXG4gICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay10aW1lJyB9KTtcbiAgICBpZiAoc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stZGF0ZScgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IHsgc2hvd1NlY29uZHMgPSBmYWxzZSwgc2hvd0RhdGUgPSB0cnVlLCBmb3JtYXQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgc2hvd1NlY29uZHM/OiBib29sZWFuO1xuICAgICAgc2hvd0RhdGU/OiBib29sZWFuO1xuICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy50aW1lRWwpIHtcbiAgICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KGZvcm1hdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KHNob3dTZWNvbmRzID8gJ0hIOm1tOnNzJyA6ICdISDptbScpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0ZUVsICYmIHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ2RkZGQsIEQgTU1NTSBZWVlZJykpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgQ2xvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgQ2xvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgc2Vjb25kcycpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dTZWNvbmRzIGFzIGJvb2xlYW4gPz8gZmFsc2UpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93U2Vjb25kcyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGRhdGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93RGF0ZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RGF0ZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0N1c3RvbSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ09wdGlvbmFsIG1vbWVudC5qcyBmb3JtYXQgc3RyaW5nLCBlLmcuIFwiSEg6bW1cIi4gTGVhdmUgZW1wdHkgZm9yIGRlZmF1bHQuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb3JtYXQgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb3JtYXQgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgTGlua0l0ZW0ge1xuICBsYWJlbDogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIGVtb2ppPzogc3RyaW5nO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+IGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHsgdGhpcy5vbkNob29zZShmb2xkZXIpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIEZvbGRlckxpbmtzQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlbmRlclRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdmb2xkZXItbGlua3MtYmxvY2snKTtcblxuICAgIC8vIFJlLXJlbmRlciB3aGVuIHZhdWx0IGZpbGVzIGFyZSBjcmVhdGVkLCBkZWxldGVkLCBvciByZW5hbWVkIChkZWJvdW5jZWQpXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG5cbiAgICAvLyBEZWZlciBmaXJzdCByZW5kZXIgc28gdmF1bHQgaXMgZnVsbHkgaW5kZXhlZFxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHRoaXMucmVuZGVyQ29udGVudCgpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVSZW5kZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVuZGVyVGltZXIgIT09IG51bGwpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZW5kZXJUaW1lcik7XG4gICAgdGhpcy5yZW5kZXJUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMucmVuZGVyVGltZXIgPSBudWxsO1xuICAgICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gICAgfSwgMTUwKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQ29udGVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1F1aWNrIExpbmtzJywgZm9sZGVyID0gJycsIGxpbmtzID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgbGlua3M/OiBMaW5rSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgbGlzdCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rcy1saXN0JyB9KTtcblxuICAgIC8vIEF1dG8tbGlzdCBub3RlcyBmcm9tIHNlbGVjdGVkIGZvbGRlciAoc29ydGVkIGFscGhhYmV0aWNhbGx5KVxuICAgIGlmIChmb2xkZXIpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGlzZWQgPSBmb2xkZXIudHJpbSgpLnJlcGxhY2UoL1xcLyskLywgJycpO1xuXG4gICAgICBpZiAoIW5vcm1hbGlzZWQpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1ZhdWx0IHJvb3QgbGlzdGluZyBpcyBub3Qgc3VwcG9ydGVkLiBTZWxlY3QgYSBzdWJmb2xkZXIuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXNlZCk7XG5cbiAgICAgICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtub3JtYWxpc2VkfVwiIG5vdCBmb3VuZC5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcmVmaXggPSBmb2xkZXJPYmoucGF0aCArICcvJztcbiAgICAgICAgICBjb25zdCBub3RlcyA9IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKClcbiAgICAgICAgICAgIC5maWx0ZXIoZiA9PiBmLnBhdGguc3RhcnRzV2l0aChwcmVmaXgpKVxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYE5vIG5vdGVzIGluIFwiJHtmb2xkZXJPYmoucGF0aH1cIi5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYW51YWwgbGlua3NcbiAgICBmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgaWYgKGxpbmsuZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdsaW5rLWVtb2ppJywgdGV4dDogbGluay5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogbGluay5sYWJlbCB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChsaW5rLnBhdGgsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyICYmIGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgaGludCA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY1MTd9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGxpbmtzIHlldC4gQWRkIG1hbnVhbCBsaW5rcyBvciBwaWNrIGEgZm9sZGVyIGluIHNldHRpbmdzLicgfSk7XG4gICAgfVxuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVuZGVyVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZW5kZXJUaW1lcik7XG4gICAgICB0aGlzLnJlbmRlclRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEExfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyB0YWcgY29uZmlndXJlZC4gQWRkIGEgdGFnIGluIHNldHRpbmdzIHRvIHNob3cgYSBkYWlseSByb3RhdGluZyBub3RlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhcmQuc2V0VGV4dChgTm8gZmlsZXMgZm91bmQgd2l0aCB0YWcgJHt0YWdTZWFyY2h9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVXNlIGxvY2FsIG1pZG5pZ2h0IGFzIHRoZSBkYXkgaW5kZXggc28gaXQgY2hhbmdlcyBhdCBsb2NhbCBtaWRuaWdodCwgbm90IFVUQ1xuICAgIGNvbnN0IGRheUluZGV4ID0gTWF0aC5mbG9vcihtb21lbnQoKS5zdGFydE9mKCdkYXknKS52YWx1ZU9mKCkgLyBNU19QRVJfREFZKTtcbiAgICBjb25zdCBpbmRleCA9IGRhaWx5U2VlZFxuICAgICAgPyBkYXlJbmRleCAlIGZpbGVzLmxlbmd0aFxuICAgICAgOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmaWxlcy5sZW5ndGgpO1xuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgY29uc3QgeyBoZWFkaW5nLCBib2R5IH0gPSB0aGlzLnBhcnNlQ29udGVudChjb250ZW50LCBjYWNoZSk7XG5cbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC10aXRsZScsIHRleHQ6IGhlYWRpbmcgfHwgZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1ib2R5JywgdGV4dDogYm9keSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbnNpZ2h0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCBlKTtcbiAgICAgIGNhcmQuc2V0VGV4dCgnRXJyb3IgcmVhZGluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRoZSBmaXJzdCBoZWFkaW5nIGFuZCBmaXJzdCBwYXJhZ3JhcGggdXNpbmcgbWV0YWRhdGFDYWNoZSBvZmZzZXRzLlxuICAgKiBGYWxscyBiYWNrIHRvIG1hbnVhbCBwYXJzaW5nIG9ubHkgaWYgY2FjaGUgaXMgdW5hdmFpbGFibGUuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQ29udGVudChjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiB7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH0ge1xuICAgIC8vIFVzZSBjYWNoZWQgaGVhZGluZyBpZiBhdmFpbGFibGUgKGF2b2lkcyBtYW51YWwgcGFyc2luZylcbiAgICBjb25zdCBoZWFkaW5nID0gY2FjaGU/LmhlYWRpbmdzPy5bMF0/LmhlYWRpbmcgPz8gJyc7XG5cbiAgICAvLyBTa2lwIGZyb250bWF0dGVyIHVzaW5nIHRoZSBjYWNoZWQgb2Zmc2V0XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcblxuICAgIC8vIEZpcnN0IG5vbi1lbXB0eSwgbm9uLWhlYWRpbmcgbGluZSBpcyB0aGUgYm9keVxuICAgIGNvbnN0IGJvZHkgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmluZChsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKSA/PyAnJztcblxuICAgIHJldHVybiB7IGhlYWRpbmcsIGJvZHkgfTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW5zaWdodFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW5zaWdodCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnRGFpbHkgSW5zaWdodCcpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRGFpbHkgc2VlZCcpLnNldERlc2MoJ1Nob3cgc2FtZSBub3RlIGFsbCBkYXknKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5kYWlseVNlZWQgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZGFpbHlTZWVkID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIFJldHVybnMgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdCB0aGF0IGhhdmUgdGhlIGdpdmVuIHRhZy5cbiAqIGB0YWdgIG11c3QgaW5jbHVkZSB0aGUgbGVhZGluZyBgI2AgKGUuZy4gYCN2YWx1ZXNgKS5cbiAqIEhhbmRsZXMgYm90aCBpbmxpbmUgdGFncyBhbmQgWUFNTCBmcm9udG1hdHRlciB0YWdzICh3aXRoIG9yIHdpdGhvdXQgYCNgKSxcbiAqIGFuZCBmcm9udG1hdHRlciB0YWdzIHRoYXQgYXJlIGEgcGxhaW4gc3RyaW5nIGluc3RlYWQgb2YgYW4gYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlc1dpdGhUYWcoYXBwOiBBcHAsIHRhZzogc3RyaW5nKTogVEZpbGVbXSB7XG4gIHJldHVybiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcihmaWxlID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICBpZiAoIWNhY2hlKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBpbmxpbmVUYWdzID0gY2FjaGUudGFncz8ubWFwKHQgPT4gdC50YWcpID8/IFtdO1xuXG4gICAgY29uc3QgcmF3Rm1UYWdzID0gY2FjaGUuZnJvbnRtYXR0ZXI/LnRhZ3M7XG4gICAgY29uc3QgZm1UYWdBcnJheTogc3RyaW5nW10gPVxuICAgICAgQXJyYXkuaXNBcnJheShyYXdGbVRhZ3MpID8gcmF3Rm1UYWdzLmZpbHRlcigodCk6IHQgaXMgc3RyaW5nID0+IHR5cGVvZiB0ID09PSAnc3RyaW5nJykgOlxuICAgICAgdHlwZW9mIHJhd0ZtVGFncyA9PT0gJ3N0cmluZycgPyBbcmF3Rm1UYWdzXSA6XG4gICAgICBbXTtcbiAgICBjb25zdCBub3JtYWxpemVkRm1UYWdzID0gZm1UYWdBcnJheS5tYXAodCA9PiB0LnN0YXJ0c1dpdGgoJyMnKSA/IHQgOiBgIyR7dH1gKTtcblxuICAgIHJldHVybiBpbmxpbmVUYWdzLmluY2x1ZGVzKHRhZykgfHwgbm9ybWFsaXplZEZtVGFncy5pbmNsdWRlcyh0YWcpO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgVmFsdWVJdGVtIHtcbiAgZW1vamk6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgbGluaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRhZ0dyaWRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygndGFnLWdyaWQtYmxvY2snKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnVmFsdWVzJywgY29sdW1ucyA9IDIsIGl0ZW1zID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIGl0ZW1zPzogVmFsdWVJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBncmlkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAndGFnLWdyaWQnIH0pO1xuICAgIGdyaWQuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBoaW50ID0gZ3JpZC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC1pY29uJywgdGV4dDogJ1xcdXsxRjNGN31cXHVGRTBGJyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGl0ZW1zIHlldC4gQWRkIHZhbHVlcyB3aXRoIGVtb2ppcyBhbmQgbGFiZWxzIGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3RhZy1idG4nIH0pO1xuICAgICAgaWYgKGl0ZW0uZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICd0YWctYnRuLWVtb2ppJywgdGV4dDogaXRlbS5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogaXRlbS5sYWJlbCB9KTtcbiAgICAgIGlmIChpdGVtLmxpbmspIHtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoaXRlbS5saW5rISwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ0bi5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBWYWx1ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgVmFsdWVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnVmFsdWVzIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRyYWZ0Lml0ZW1zKSkgZHJhZnQuaXRlbXMgPSBbXTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1ZhbHVlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzEnLCAnMScpLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdJdGVtcycsIGNsczogJ3NldHRpbmctaXRlbS1uYW1lJyB9KTtcblxuICAgIGNvbnN0IGxpc3RFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICd2YWx1ZXMtaXRlbS1saXN0JyB9KTtcbiAgICBjb25zdCByZW5kZXJMaXN0ID0gKCkgPT4ge1xuICAgICAgbGlzdEVsLmVtcHR5KCk7XG4gICAgICBkcmFmdC5pdGVtcyEuZm9yRWFjaCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tcm93JyB9KTtcblxuICAgICAgICBjb25zdCBlbW9qaUlucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1lbW9qaScgfSk7XG4gICAgICAgIGVtb2ppSW5wdXQudmFsdWUgPSBpdGVtLmVtb2ppO1xuICAgICAgICBlbW9qaUlucHV0LnBsYWNlaG9sZGVyID0gJ1x1RDgzRFx1REUwMCc7XG4gICAgICAgIGVtb2ppSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0uZW1vamkgPSBlbW9qaUlucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsYWJlbElucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1sYWJlbCcgfSk7XG4gICAgICAgIGxhYmVsSW5wdXQudmFsdWUgPSBpdGVtLmxhYmVsO1xuICAgICAgICBsYWJlbElucHV0LnBsYWNlaG9sZGVyID0gJ0xhYmVsJztcbiAgICAgICAgbGFiZWxJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5sYWJlbCA9IGxhYmVsSW5wdXQudmFsdWU7IH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGluaycgfSk7XG4gICAgICAgIGxpbmtJbnB1dC52YWx1ZSA9IGl0ZW0ubGluayA/PyAnJztcbiAgICAgICAgbGlua0lucHV0LnBsYWNlaG9sZGVyID0gJ05vdGUgcGF0aCAob3B0aW9uYWwpJztcbiAgICAgICAgbGlua0lucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmxpbmsgPSBsaW5rSW5wdXQudmFsdWUgfHwgdW5kZWZpbmVkOyB9KTtcblxuICAgICAgICBjb25zdCBkZWxCdG4gPSByb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndmFsdWVzLWl0ZW0tZGVsJywgdGV4dDogJ1x1MjcxNScgfSk7XG4gICAgICAgIGRlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICBkcmFmdC5pdGVtcyEuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpc3QoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJysgQWRkIGl0ZW0nKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgZHJhZnQuaXRlbXMhLnB1c2goeyBlbW9qaTogJycsIGxhYmVsOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlzdCgpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gT25seSBhc3NpZ24gc2FmZSBDU1MgY29sb3IgdmFsdWVzOyByZWplY3QgcG90ZW50aWFsbHkgbWFsaWNpb3VzIHN0cmluZ3NcbmNvbnN0IENPTE9SX1JFID0gL14oI1swLTlhLWZBLUZdezMsOH18W2EtekEtWl0rfHJnYmE/XFwoW14pXStcXCl8aHNsYT9cXChbXildK1xcKSkkLztcblxudHlwZSBRdW90ZXNDb25maWcgPSB7XG4gIHNvdXJjZT86ICd0YWcnIHwgJ3RleHQnO1xuICB0YWc/OiBzdHJpbmc7XG4gIHF1b3Rlcz86IHN0cmluZztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGNvbHVtbnM/OiBudW1iZXI7XG4gIG1heEl0ZW1zPzogbnVtYmVyO1xuICBoZWlnaHRNb2RlPzogJ3dyYXAnIHwgJ2V4dGVuZCc7XG59O1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgc291cmNlID0gJ3RhZycsIHRhZyA9ICcnLCBxdW90ZXMgPSAnJywgdGl0bGUgPSAnUXVvdGVzJywgY29sdW1ucyA9IDIsIG1heEl0ZW1zID0gMjAsIGhlaWdodE1vZGUgPSAnd3JhcCcgfSA9XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyBRdW90ZXNDb25maWc7XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgZWwudG9nZ2xlQ2xhc3MoJ3F1b3Rlcy1saXN0LWJsb2NrLS1leHRlbmQnLCBoZWlnaHRNb2RlID09PSAnZXh0ZW5kJyk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG4gICAgaWYgKGhlaWdodE1vZGUgPT09ICd3cmFwJykge1xuICAgICAgY29sc0VsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgICAgY29sc0VsLnNldEF0dHJpYnV0ZSgncm9sZScsICdyZWdpb24nKTtcbiAgICAgIGNvbHNFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUXVvdGVzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgTUlOX0NPTF9XSURUSCA9IDIwMDtcbiAgICBjb25zdCB1cGRhdGVDb2xzID0gKCkgPT4ge1xuICAgICAgY29uc3QgdyA9IGNvbHNFbC5vZmZzZXRXaWR0aDtcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZSA9IHcgPiAwID8gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgTWF0aC5mbG9vcih3IC8gTUlOX0NPTF9XSURUSCkpKSA6IGNvbHVtbnM7XG4gICAgICBjb2xzRWwuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtlZmZlY3RpdmV9LCAxZnIpYDtcbiAgICB9O1xuICAgIHVwZGF0ZUNvbHMoKTtcbiAgICBjb25zdCBybyA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVDb2xzKTtcbiAgICByby5vYnNlcnZlKGNvbHNFbCk7XG4gICAgdGhpcy5yZWdpc3RlcigoKSA9PiByby5kaXNjb25uZWN0KCkpO1xuXG4gICAgaWYgKHNvdXJjZSA9PT0gJ3RleHQnKSB7XG4gICAgICB0aGlzLnJlbmRlclRleHRRdW90ZXMoY29sc0VsLCBxdW90ZXMsIG1heEl0ZW1zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBzb3VyY2UgPT09ICd0YWcnXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0QUN9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIHRhZyBjb25maWd1cmVkLiBBZGQgYSB0YWcgaW4gc2V0dGluZ3MgdG8gcHVsbCBxdW90ZXMgZnJvbSB5b3VyIG5vdGVzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbmRlciBxdW90ZXMgZnJvbSBwbGFpbiB0ZXh0LiBFYWNoIHF1b3RlIGlzIHNlcGFyYXRlZCBieSBgLS0tYCBvbiBpdHMgb3duIGxpbmUuXG4gICAqIE9wdGlvbmFsbHkgYSBzb3VyY2UgbGluZSBjYW4gZm9sbG93IHRoZSBxdW90ZSB0ZXh0LCBwcmVmaXhlZCB3aXRoIGBcdTIwMTRgLCBgXHUyMDEzYCwgb3IgYC0tYC5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICogICBUaGUgb25seSB3YXkgdG8gZG8gZ3JlYXQgd29yayBpcyB0byBsb3ZlIHdoYXQgeW91IGRvLlxuICAgKiAgIFx1MjAxNCBTdGV2ZSBKb2JzXG4gICAqICAgLS0tXG4gICAqICAgSW4gdGhlIG1pZGRsZSBvZiBkaWZmaWN1bHR5IGxpZXMgb3Bwb3J0dW5pdHkuXG4gICAqICAgXHUyMDE0IEFsYmVydCBFaW5zdGVpblxuICAgKi9cbiAgcHJpdmF0ZSByZW5kZXJUZXh0UXVvdGVzKGNvbHNFbDogSFRNTEVsZW1lbnQsIHJhdzogc3RyaW5nLCBtYXhJdGVtczogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCFyYXcudHJpbSgpKSB7XG4gICAgICBjb25zdCBoaW50ID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEFDfScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBxdW90ZXMgeWV0LiBBZGQgdGhlbSBpbiBzZXR0aW5ncywgc2VwYXJhdGVkIGJ5IC0tLS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJsb2NrcyA9IHJhdy5zcGxpdCgvXFxuLS0tXFxuLykubWFwKGIgPT4gYi50cmltKCkpLmZpbHRlcihCb29sZWFuKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuICAgICAgY29uc3QgbGluZXMgPSBibG9jay5zcGxpdCgnXFxuJykubWFwKGwgPT4gbC50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGNvbnN0IGxhc3RMaW5lID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV07XG4gICAgICBjb25zdCBoYXNTb3VyY2UgPSBsaW5lcy5sZW5ndGggPiAxICYmIC9eKFx1MjAxNHxcdTIwMTN8LS0pLy50ZXN0KGxhc3RMaW5lKTtcbiAgICAgIGNvbnN0IHNvdXJjZVRleHQgPSBoYXNTb3VyY2UgPyBsYXN0TGluZS5yZXBsYWNlKC9eKFx1MjAxNHxcdTIwMTN8LS0pXFxzKi8sICcnKSA6ICcnO1xuICAgICAgY29uc3QgYm9keUxpbmVzID0gaGFzU291cmNlID8gbGluZXMuc2xpY2UoMCwgLTEpIDogbGluZXM7XG4gICAgICBjb25zdCBib2R5ID0gYm9keUxpbmVzLmpvaW4oJyAnKTtcbiAgICAgIGlmICghYm9keSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGl0ZW0gPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtaXRlbScgfSk7XG4gICAgICBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcbiAgICAgIGlmIChzb3VyY2VUZXh0KSBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IHNvdXJjZVRleHQgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEV4dHJhY3QgdGhlIGZpcnN0IGZldyBsaW5lcyBvZiBib2R5IGNvbnRlbnQgdXNpbmcgbWV0YWRhdGFDYWNoZSBmcm9udG1hdHRlciBvZmZzZXQuICovXG4gIHByaXZhdGUgZXh0cmFjdEJvZHkoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuICAgIGNvbnN0IGxpbmVzID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2UoMCwgMykuam9pbignICcpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBRdW90ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgUXVvdGVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVvdGVzIExpc3QgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpIGFzIFF1b3Rlc0NvbmZpZztcbiAgICBkcmFmdC5zb3VyY2UgPz89ICd0YWcnO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVvdGVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFNvdXJjZSB0b2dnbGUgXHUyMDE0IHNob3dzL2hpZGVzIHRoZSByZWxldmFudCBzZWN0aW9uXG4gICAgbGV0IHRhZ1NlY3Rpb246IEhUTUxFbGVtZW50O1xuICAgIGxldCB0ZXh0U2VjdGlvbjogSFRNTEVsZW1lbnQ7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnU291cmNlJylcbiAgICAgIC5zZXREZXNjKCdQdWxsIHF1b3RlcyBmcm9tIHRhZ2dlZCBub3Rlcywgb3IgZW50ZXIgdGhlbSBtYW51YWxseS4nKVxuICAgICAgLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgICAgZC5hZGRPcHRpb24oJ3RhZycsICdOb3RlcyB3aXRoIHRhZycpXG4gICAgICAgICAuYWRkT3B0aW9uKCd0ZXh0JywgJ01hbnVhbCB0ZXh0JylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5zb3VyY2UgPz8gJ3RhZycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7XG4gICAgICAgICAgIGRyYWZ0LnNvdXJjZSA9IHYgYXMgJ3RhZycgfCAndGV4dCc7XG4gICAgICAgICAgIHRhZ1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHYgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGV4dCcgPyAnJyA6ICdub25lJztcbiAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIFRhZyBzZWN0aW9uXG4gICAgdGFnU2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcbiAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgbmV3IFNldHRpbmcodGFnU2VjdGlvbikuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgLy8gVGV4dCBzZWN0aW9uXG4gICAgdGV4dFNlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGV4dFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGRyYWZ0LnNvdXJjZSA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgY29uc3QgdGV4dFNldHRpbmcgPSBuZXcgU2V0dGluZyh0ZXh0U2VjdGlvbilcbiAgICAgIC5zZXROYW1lKCdRdW90ZXMnKVxuICAgICAgLnNldERlc2MoJ1NlcGFyYXRlIHF1b3RlcyB3aXRoIC0tLSBvbiBpdHMgb3duIGxpbmUuIEFkZCBhIHNvdXJjZSBsaW5lIHN0YXJ0aW5nIHdpdGggXHUyMDE0IChlLmcuIFx1MjAxNCBBdXRob3IpLicpO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5mbGV4RGlyZWN0aW9uID0gJ2NvbHVtbic7XG4gICAgdGV4dFNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmFsaWduSXRlbXMgPSAnc3RyZXRjaCc7XG4gICAgY29uc3QgdGV4dGFyZWEgPSB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuY3JlYXRlRWwoJ3RleHRhcmVhJyk7XG4gICAgdGV4dGFyZWEucm93cyA9IDg7XG4gICAgdGV4dGFyZWEuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgdGV4dGFyZWEuc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XG4gICAgdGV4dGFyZWEuc3R5bGUuZm9udEZhbWlseSA9ICd2YXIoLS1mb250LW1vbm9zcGFjZSknO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRTaXplID0gJzEycHgnO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQucXVvdGVzID8/ICcnO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5xdW90ZXMgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0hlaWdodCBtb2RlJylcbiAgICAgIC5zZXREZXNjKCdTY3JvbGwga2VlcHMgdGhlIGJsb2NrIGNvbXBhY3QuIEdyb3cgdG8gZml0IGFsbCB3b3JrcyBiZXN0IGF0IGZ1bGwgd2lkdGguJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd3cmFwJywgJ1Njcm9sbCAoZml4ZWQgaGVpZ2h0KScpXG4gICAgICAgICAuYWRkT3B0aW9uKCdleHRlbmQnLCAnR3JvdyB0byBmaXQgYWxsJylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5oZWlnaHRNb2RlID8/ICd3cmFwJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuaGVpZ2h0TW9kZSA9IHYgYXMgJ3dyYXAnIHwgJ2V4dGVuZCc7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwLCBsYXlvdXQgPSAnZ3JpZCcgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIG1heEl0ZW1zPzogbnVtYmVyO1xuICAgICAgbGF5b3V0PzogJ2dyaWQnIHwgJ21hc29ucnknO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ2FsbGVyeSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ltYWdlLWdhbGxlcnknIH0pO1xuXG4gICAgaWYgKGxheW91dCA9PT0gJ21hc29ucnknKSB7XG4gICAgICBnYWxsZXJ5LmFkZENsYXNzKCdtYXNvbnJ5LWxheW91dCcpO1xuICAgICAgY29uc3QgdXBkYXRlQ29scyA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdyA9IGdhbGxlcnkub2Zmc2V0V2lkdGg7XG4gICAgICAgIGNvbnN0IGVmZmVjdGl2ZSA9IHcgPiAwID8gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgTWF0aC5mbG9vcih3IC8gMTAwKSkpIDogY29sdW1ucztcbiAgICAgICAgZ2FsbGVyeS5zdHlsZS5jb2x1bW5zID0gU3RyaW5nKGVmZmVjdGl2ZSk7XG4gICAgICB9O1xuICAgICAgdXBkYXRlQ29scygpO1xuICAgICAgY29uc3Qgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIodXBkYXRlQ29scyk7XG4gICAgICByby5vYnNlcnZlKGdhbGxlcnkpO1xuICAgICAgdGhpcy5yZWdpc3RlcigoKSA9PiByby5kaXNjb25uZWN0KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KGF1dG8tZmlsbCwgbWlubWF4KG1heCg3MHB4LCBjYWxjKDEwMCUgLyAke2NvbHVtbnN9KSksIDFmcikpYDtcbiAgICB9XG5cbiAgICBpZiAoIWZvbGRlcikge1xuICAgICAgY29uc3QgaGludCA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY1QkN9XFx1RkUwRicgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBmb2xkZXIgc2VsZWN0ZWQuIFBpY2sgYW4gaW1hZ2UgZm9sZGVyIGluIHNldHRpbmdzIHRvIGRpc3BsYXkgYSBnYWxsZXJ5LicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdMYXlvdXQnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignZ3JpZCcsICdHcmlkJykuYWRkT3B0aW9uKCdtYXNvbnJ5JywgJ01hc29ucnknKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubGF5b3V0ID8/ICdncmlkJykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5sYXlvdXQgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpLmFkZE9wdGlvbignNCcsICc0JylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5jb25zdCBERUJPVU5DRV9NUyA9IDMwMDtcblxuZXhwb3J0IGNsYXNzIEVtYmVkZGVkTm90ZUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkZWJvdW5jZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdlbWJlZGRlZC1ub3RlLWJsb2NrJyk7XG5cbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuXG4gICAgLy8gUmVnaXN0ZXIgdmF1bHQgbGlzdGVuZXIgb25jZTsgZGVib3VuY2UgcmFwaWQgc2F2ZXNcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC52YXVsdC5vbignbW9kaWZ5JywgKG1vZEZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IGZpbGVQYXRoPzogc3RyaW5nIH07XG4gICAgICAgIGlmIChtb2RGaWxlLnBhdGggPT09IGZpbGVQYXRoICYmIHRoaXMuY29udGFpbmVyRWwpIHtcbiAgICAgICAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ29udGVudCh0YXJnZXQpLmNhdGNoKGUgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmUtcmVuZGVyIGFmdGVyIG1vZGlmeTonLCBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIERFQk9VTkNFX01TKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJywgc2hvd1RpdGxlID0gdHJ1ZSwgaGVpZ2h0TW9kZSA9ICdzY3JvbGwnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgICBoZWlnaHRNb2RlPzogJ3Njcm9sbCcgfCAnZ3Jvdyc7XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG4gICAgZWwudG9nZ2xlQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2stLWdyb3cnLCBoZWlnaHRNb2RlID09PSAnZ3JvdycpO1xuXG4gICAgaWYgKCFmaWxlUGF0aCkge1xuICAgICAgY29uc3QgaGludCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQnIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LWljb24nLCB0ZXh0OiAnXFx1ezFGNEM0fScgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtdGV4dCcsIHRleHQ6ICdObyBub3RlIHNlbGVjdGVkLiBDaG9vc2UgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MgdG8gZW1iZWQgaXQgaGVyZS4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIGVsLnNldFRleHQoYEZpbGUgbm90IGZvdW5kOiAke2ZpbGVQYXRofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaG93VGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCBmaWxlLmJhc2VuYW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdlbWJlZGRlZC1ub3RlLWNvbnRlbnQnIH0pO1xuICAgIGlmIChoZWlnaHRNb2RlID09PSAnc2Nyb2xsJykge1xuICAgICAgY29udGVudEVsLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICAgICAgY29udGVudEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdyZWdpb24nKTtcbiAgICAgIGNvbnRlbnRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBmaWxlLmJhc2VuYW1lKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIZWlnaHQgbW9kZScpXG4gICAgICAuc2V0RGVzYygnU2Nyb2xsIGtlZXBzIHRoZSBibG9jayBjb21wYWN0LiBHcm93IHRvIGZpdCBhbGwgZXhwYW5kcyB0aGUgY2FyZCB0byBzaG93IHRoZSBmdWxsIG5vdGUuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCdzY3JvbGwnLCAnU2Nyb2xsIChmaXhlZCBoZWlnaHQpJylcbiAgICAgICAgIC5hZGRPcHRpb24oJ2dyb3cnLCAnR3JvdyB0byBmaXQgYWxsJylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5oZWlnaHRNb2RlIGFzIHN0cmluZyA/PyAnc2Nyb2xsJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuaGVpZ2h0TW9kZSA9IHY7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1hcmtkb3duUmVuZGVyZXIsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgU3RhdGljVGV4dEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdzdGF0aWMtdGV4dC1ibG9jaycpO1xuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBTdGF0aWNUZXh0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBjb250ZW50LicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGl0bGUgPSAnJywgY29udGVudCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbnRlbnQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnc3RhdGljLXRleHQtY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICdcXHV7MUY0RER9JyB9KTtcbiAgICAgIGhpbnQuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludC10ZXh0JywgdGV4dDogJ05vIGNvbnRlbnQgeWV0LiBBZGQgTWFya2Rvd24gdGV4dCBpbiBzZXR0aW5ncy4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stZW1wdHktaGludCcgfSk7XG4gICAgICBoaW50LmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWVtcHR5LWhpbnQtaWNvbicsIHRleHQ6ICc8Lz4nIH0pO1xuICAgICAgaGludC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1lbXB0eS1oaW50LXRleHQnLCB0ZXh0OiAnTm8gSFRNTCBjb250ZW50IHlldC4gQWRkIHlvdXIgbWFya3VwIGluIHNldHRpbmdzLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29udGVudEVsLmFwcGVuZENoaWxkKHNhbml0aXplSFRNTFRvRG9tKGh0bWwpKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEh0bWxCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hUTUwgQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgSFRNTC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdIVE1MJykuc2V0RGVzYygnSFRNTCBpcyBzYW5pdGl6ZWQgYmVmb3JlIHJlbmRlcmluZy4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0Lmh0bWwgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMjtcbiAgICB0ZXh0YXJlYS5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuaHRtbCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsb0JB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QkFBaUIsQ0FBQztBQUMvQyxtQkFBVyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEdBQUc7QUFDaEUsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGtCQUFNLEtBQUssS0FBSyxPQUFPO0FBQUEsVUFDekI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJGb2xkZXJTdWdnZXN0TW9kYWwiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
