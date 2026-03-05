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
    if (w > 0 && w <= 540) return 1;
    if (w > 0 && w <= 840) return Math.min(2, layoutColumns);
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
      empty.createEl("p", { text: "No blocks yet. Click Edit to add your first block." });
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
    const contentEl = wrapper.createDiv({ cls: "block-content" });
    const block = factory.create(this.app, instance, this.plugin);
    block.load();
    const result = block.render(contentEl);
    if (result instanceof Promise) {
      result.catch((e) => {
        console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
        contentEl.setText("Error rendering block. Check console for details.");
      });
    }
    if (instance.collapsed) wrapper.addClass("block-collapsed");
    const collapseBtn = wrapper.createEl("button", { cls: "block-collapse-btn" });
    (0, import_obsidian.setIcon)(collapseBtn, instance.collapsed ? "chevron-right" : "chevron-down");
    collapseBtn.setAttribute("aria-label", instance.collapsed ? "Expand" : "Collapse");
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isNowCollapsed = !wrapper.hasClass("block-collapsed");
      wrapper.toggleClass("block-collapsed", isNowCollapsed);
      (0, import_obsidian.setIcon)(collapseBtn, isNowCollapsed ? "chevron-right" : "chevron-down");
      collapseBtn.setAttribute("aria-label", isNowCollapsed ? "Expand" : "Collapse");
      const newBlocks = this.plugin.layout.blocks.map(
        (b) => b.id === instance.id ? { ...b, collapsed: isNowCollapsed } : b
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    });
    this.blocks.set(instance.id, { block, wrapper });
  }
  applyGridPosition(wrapper, instance) {
    const cols = this.effectiveColumns;
    const colSpan = Math.min(instance.colSpan, cols);
    const basisPercent = colSpan / cols * 100;
    wrapper.style.flex = `${colSpan} 0 calc(${basisPercent}% - var(--hp-gap, 16px))`;
    wrapper.style.minWidth = "0";
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
      clone.style.left = `${e.clientX - 20}px`;
      clone.style.top = `${e.clientY - 20}px`;
      document.body.appendChild(clone);
      this.activeClone = clone;
      const sourceId = instance.id;
      wrapper.addClass("block-dragging");
      const onMouseMove = (me) => {
        var _a2;
        clone.style.left = `${me.clientX - 20}px`;
        clone.style.top = `${me.clientY - 20}px`;
        this.gridEl.querySelectorAll(".homepage-block-wrapper").forEach((el) => {
          el.removeClass("block-drop-target");
        });
        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          (_a2 = this.blocks.get(targetId)) == null ? void 0 : _a2.wrapper.addClass("block-drop-target");
        }
      };
      const onMouseUp = (me) => {
        ac.abort();
        this.activeAbortController = null;
        clone.remove();
        this.activeClone = null;
        wrapper.removeClass("block-dragging");
        this.gridEl.querySelectorAll(".homepage-block-wrapper").forEach((el) => {
          el.removeClass("block-drop-target");
        });
        const targetId = this.findBlockUnderCursor(me.clientX, me.clientY, sourceId);
        if (targetId) {
          this.swapBlocks(sourceId, targetId);
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
      const startColSpan = instance.colSpan;
      const columns = this.effectiveColumns;
      const colWidth = this.gridEl.offsetWidth / columns;
      let currentColSpan = startColSpan;
      const onMouseMove = (me) => {
        const deltaX = me.clientX - startX;
        const deltaCols = Math.round(deltaX / colWidth);
        currentColSpan = Math.max(1, Math.min(columns, startColSpan + deltaCols));
        const basisPercent = currentColSpan / columns * 100;
        wrapper.style.flex = `${currentColSpan} 0 calc(${basisPercent}% - var(--hp-gap, 16px))`;
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
  findBlockUnderCursor(x, y, excludeId) {
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
  swapBlocks(idA, idB) {
    const bA = this.plugin.layout.blocks.find((b) => b.id === idA);
    const bB = this.plugin.layout.blocks.find((b) => b.id === idB);
    if (!bA || !bB) return;
    const newBlocks = this.plugin.layout.blocks.map((b) => {
      if (b.id === idA) return { ...b, col: bB.col, row: bB.row, colSpan: bB.colSpan, rowSpan: bB.rowSpan };
      if (b.id === idB) return { ...b, col: bA.col, row: bA.row, colSpan: bA.colSpan, rowSpan: bA.rowSpan };
      return b;
    });
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
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  rerender() {
    var _a;
    const focused = document.activeElement;
    const focusedBlockId = (_a = focused == null ? void 0 : focused.closest("[data-block-id]")) == null ? void 0 : _a.dataset.blockId;
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
    if (focusedBlockId) {
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
    });
    if (this.editMode) {
      this.appendAddButton();
    }
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
    });
  }
  getElement() {
    return this.toolbarEl;
  }
  destroy() {
    this.toolbarEl.remove();
  }
};
var BLOCK_ICONS = {
  "greeting": "\u{1F44B}",
  "clock": "\u{1F550}",
  "folder-links": "\u{1F517}",
  "insight": "\u{1F4A1}",
  "tag-grid": "\u{1F3F7}\uFE0F",
  "quotes-list": "\u{1F4AC}",
  "image-gallery": "\u{1F5BC}\uFE0F",
  "embedded-note": "\u{1F4C4}",
  "static-text": "\u{1F4DD}",
  "html": "</>"
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
      const btn = grid.createEl("button", { cls: "add-block-option" });
      btn.createSpan({ cls: "add-block-icon", text: (_a = BLOCK_ICONS[factory.type]) != null ? _a : "\u25AA" });
      btn.createSpan({ cls: "add-block-name", text: factory.displayName });
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
  }
  // Override to open a per-block settings modal
  openSettings(_onSave) {
  }
  // Render the muted uppercase block header label.
  // Respects _hideTitle, _titleLabel, and _titleEmoji from instance.config.
  renderHeader(el, title) {
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = typeof cfg._titleLabel === "string" && cfg._titleLabel.trim() ? cfg._titleLabel.trim() : title;
    if (!label) return;
    const header = el.createDiv({ cls: "block-header" });
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
      list.createEl("p", { text: "Add links or select a folder in settings.", cls: "block-loading" });
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
      card.setText("Configure a tag in block settings.");
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
      grid.setText("No items. Configure in settings.");
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
      colsEl.setText("Configure a tag in settings.");
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
      colsEl.setText("Add quotes in settings.");
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
    const { folder = "", title = "Gallery", columns = 3, maxItems = 20 } = this.instance.config;
    this.renderHeader(el, title);
    const gallery = el.createDiv({ cls: "image-gallery" });
    gallery.style.gridTemplateColumns = `repeat(auto-fill, minmax(max(70px, calc(100% / ${columns})), 1fr))`;
    if (!folder) {
      gallery.setText("Configure a folder path in settings.");
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
      el.setText("Configure a file path in settings.");
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
      contentEl.setText("Configure text in settings.");
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
      contentEl.setText("Configure HTML in settings.");
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
    displayName: "Folder Links",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVmFsdWVzJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnVmFsdWVzJywgY29sdW1uczogMiwgaXRlbXM6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMiB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFRhZ0dyaWRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgIGRpc3BsYXlOYW1lOiAnUXVvdGVzIExpc3QnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgUXVvdGVzTGlzdEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbWFnZS1nYWxsZXJ5JyxcbiAgICBkaXNwbGF5TmFtZTogJ0ltYWdlIEdhbGxlcnknLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMywgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEltYWdlR2FsbGVyeUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdlbWJlZGRlZC1ub3RlJyxcbiAgICBkaXNwbGF5TmFtZTogJ0VtYmVkZGVkIE5vdGUnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZmlsZVBhdGg6ICcnLCBzaG93VGl0bGU6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgRW1iZWRkZWROb3RlQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3N0YXRpYy10ZXh0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1N0YXRpYyBUZXh0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgY29udGVudDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgU3RhdGljVGV4dEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdodG1sJyxcbiAgICBkaXNwbGF5TmFtZTogJ0hUTUwgQmxvY2snLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBodG1sOiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBIdG1sQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEhvbWVwYWdlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIGltcGxlbWVudHMgSUhvbWVwYWdlUGx1Z2luIHtcbiAgbGF5b3V0OiBMYXlvdXRDb25maWcgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJlZ2lzdGVyQmxvY2tzKCk7XG5cbiAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCkgYXMgdW5rbm93bjtcbiAgICB0aGlzLmxheW91dCA9IHZhbGlkYXRlTGF5b3V0KHJhdyk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmKSA9PiBuZXcgSG9tZXBhZ2VWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4taG9tZXBhZ2UnLFxuICAgICAgbmFtZTogJ09wZW4gSG9tZXBhZ2UnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHsgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpOyB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdob21lJywgJ09wZW4gSG9tZXBhZ2UnLCAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSk7XG5cbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEhvbWVwYWdlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMubGF5b3V0Lm9wZW5PblN0YXJ0dXApIHtcbiAgICAgICAgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb251bmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZUxheW91dChsYXlvdXQ6IExheW91dENvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGF5b3V0ID0gbGF5b3V0O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEobGF5b3V0KTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5Ib21lcGFnZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyB0YWIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEhvbWVwYWdlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IEhvbWVwYWdlUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSG9tZXBhZ2UgQmxvY2tzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ09wZW4gb24gc3RhcnR1cCcpXG4gICAgICAuc2V0RGVzYygnQXV0b21hdGljYWxseSBvcGVuIHRoZSBob21lcGFnZSB3aGVuIE9ic2lkaWFuIHN0YXJ0cy4nKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRGVmYXVsdCBjb2x1bW5zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZCBsYXlvdXQuJylcbiAgICAgIC5hZGREcm9wZG93bihkcm9wID0+XG4gICAgICAgIGRyb3BcbiAgICAgICAgICAuYWRkT3B0aW9uKCcyJywgJzIgY29sdW1ucycpXG4gICAgICAgICAgLmFkZE9wdGlvbignMycsICczIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzQnLCAnNCBjb2x1bW5zJylcbiAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyA9IE51bWJlcih2YWx1ZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUmVzZXQgdG8gZGVmYXVsdCBsYXlvdXQnKVxuICAgICAgLnNldERlc2MoJ1Jlc3RvcmUgYWxsIGJsb2NrcyB0byB0aGUgb3JpZ2luYWwgZGVmYXVsdCBsYXlvdXQuIENhbm5vdCBiZSB1bmRvbmUuJylcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZXNldCBsYXlvdXQnKS5zZXRXYXJuaW5nKCkub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChnZXREZWZhdWx0TGF5b3V0KCkpO1xuICAgICAgICAgIGZvciAoY29uc3QgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkpIHtcbiAgICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgICAgYXdhaXQgbGVhZi52aWV3LnJlbG9hZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBJSG9tZXBhZ2VQbHVnaW4sIExheW91dENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5pbXBvcnQgeyBFZGl0VG9vbGJhciB9IGZyb20gJy4vRWRpdFRvb2xiYXInO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFID0gJ2hvbWVwYWdlLWJsb2Nrcyc7XG5cbmV4cG9ydCBjbGFzcyBIb21lcGFnZVZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRvb2xiYXI6IEVkaXRUb29sYmFyIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIFZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gJ0hvbWVwYWdlJzsgfVxuICBnZXRJY29uKCk6IHN0cmluZyB7IHJldHVybiAnaG9tZSc7IH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gRnVsbCB0ZWFyZG93bjogdW5sb2FkcyBibG9ja3MgQU5EIHJlbW92ZXMgdGhlIGdyaWQgRE9NIGVsZW1lbnRcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcblxuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcygnaG9tZXBhZ2UtdmlldycpO1xuXG4gICAgY29uc3QgbGF5b3V0OiBMYXlvdXRDb25maWcgPSB0aGlzLnBsdWdpbi5sYXlvdXQ7XG5cbiAgICBjb25zdCBvbkxheW91dENoYW5nZSA9IChuZXdMYXlvdXQ6IExheW91dENvbmZpZykgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0ID0gbmV3TGF5b3V0O1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KG5ld0xheW91dCk7XG4gICAgfTtcblxuICAgIHRoaXMuZ3JpZCA9IG5ldyBHcmlkTGF5b3V0KGNvbnRlbnRFbCwgdGhpcy5hcHAsIHRoaXMucGx1Z2luLCBvbkxheW91dENoYW5nZSk7XG5cbiAgICB0aGlzLnRvb2xiYXIgPSBuZXcgRWRpdFRvb2xiYXIoXG4gICAgICBjb250ZW50RWwsXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgdGhpcy5ncmlkLFxuICAgICAgKGNvbHVtbnMpID0+IHsgdGhpcy5ncmlkPy5zZXRDb2x1bW5zKGNvbHVtbnMpOyB9LFxuICAgICk7XG5cbiAgICAvLyBUb29sYmFyIG11c3QgYXBwZWFyIGFib3ZlIHRoZSBncmlkIGluIHRoZSBmbGV4LWNvbHVtbiBsYXlvdXRcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuXG4gICAgdGhpcy5ncmlkLnJlbmRlcihsYXlvdXQuYmxvY2tzLCBsYXlvdXQuY29sdW1ucyk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZ3JpZD8uZGVzdHJveSgpO1xuICAgIHRoaXMudG9vbGJhcj8uZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZWZmZWN0aXZlQ29sdW1ucyA9IDM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0VmZmVjdGl2ZSA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnModGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgICAgaWYgKG5ld0VmZmVjdGl2ZSAhPT0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5ncmlkRWwpO1xuICB9XG5cbiAgLyoqIEV4cG9zZSB0aGUgcm9vdCBncmlkIGVsZW1lbnQgc28gSG9tZXBhZ2VWaWV3IGNhbiByZW9yZGVyIGl0IGluIHRoZSBET00uICovXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmdyaWRFbDtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMobGF5b3V0Q29sdW1uczogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCB3ID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGg7XG4gICAgaWYgKHcgPiAwICYmIHcgPD0gNTQwKSByZXR1cm4gMTtcbiAgICBpZiAodyA+IDAgJiYgdyA8PSA4NDApIHJldHVybiBNYXRoLm1pbigyLCBsYXlvdXRDb2x1bW5zKTtcbiAgICByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwuZW1wdHkoKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZCcpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSBibG9ja3MnKTtcbiAgICB0aGlzLmVmZmVjdGl2ZUNvbHVtbnMgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGNvbHVtbnMpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmFkZENsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ncmlkRWwucmVtb3ZlQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH1cblxuICAgIGlmIChibG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eSA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWVtcHR5LXN0YXRlJyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnTm8gYmxvY2tzIHlldC4gQ2xpY2sgRWRpdCB0byBhZGQgeW91ciBmaXJzdCBibG9jay4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgYmxvY2tzKSB7XG4gICAgICB0aGlzLnJlbmRlckJsb2NrKGluc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KGluc3RhbmNlLnR5cGUpO1xuICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZGNlbGwnKTtcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGZhY3RvcnkuZGlzcGxheU5hbWUpO1xuICAgIHRoaXMuYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlciwgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stY29udGVudCcgfSk7XG4gICAgY29uc3QgYmxvY2sgPSBmYWN0b3J5LmNyZWF0ZSh0aGlzLmFwcCwgaW5zdGFuY2UsIHRoaXMucGx1Z2luKTtcbiAgICBibG9jay5sb2FkKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYmxvY2sucmVuZGVyKGNvbnRlbnRFbCk7XG4gICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJlc3VsdC5jYXRjaChlID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0hvbWVwYWdlIEJsb2Nrc10gRXJyb3IgcmVuZGVyaW5nIGJsb2NrICR7aW5zdGFuY2UudHlwZX06YCwgZSk7XG4gICAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgYmxvY2suIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDb2xsYXBzZSB0b2dnbGUgKGFic29sdXRlbHkgcG9zaXRpb25lZCwgaGlkZGVuIGluIGVkaXQgbW9kZSlcbiAgICBpZiAoaW5zdGFuY2UuY29sbGFwc2VkKSB3cmFwcGVyLmFkZENsYXNzKCdibG9jay1jb2xsYXBzZWQnKTtcbiAgICBjb25zdCBjb2xsYXBzZUJ0biA9IHdyYXBwZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stY29sbGFwc2UtYnRuJyB9KTtcbiAgICBzZXRJY29uKGNvbGxhcHNlQnRuLCBpbnN0YW5jZS5jb2xsYXBzZWQgPyAnY2hldnJvbi1yaWdodCcgOiAnY2hldnJvbi1kb3duJyk7XG4gICAgY29sbGFwc2VCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgaW5zdGFuY2UuY29sbGFwc2VkID8gJ0V4cGFuZCcgOiAnQ29sbGFwc2UnKTtcbiAgICBjb2xsYXBzZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBzZXRJY29uKGNvbGxhcHNlQnRuLCBpc05vd0NvbGxhcHNlZCA/ICdjaGV2cm9uLXJpZ2h0JyA6ICdjaGV2cm9uLWRvd24nKTtcbiAgICAgIGNvbGxhcHNlQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGlzTm93Q29sbGFwc2VkID8gJ0V4cGFuZCcgOiAnQ29sbGFwc2UnKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbGxhcHNlZDogaXNOb3dDb2xsYXBzZWQgfSA6IGIsXG4gICAgICApO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuYmxvY2tzLnNldChpbnN0YW5jZS5pZCwgeyBibG9jaywgd3JhcHBlciB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgY29scyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oaW5zdGFuY2UuY29sU3BhbiwgY29scyk7XG4gICAgLy8gZmxleC1ncm93IHByb3BvcnRpb25hbCB0byBjb2xTcGFuIHNvIHdyYXBwZWQgaXRlbXMgc3RyZXRjaCB0byBmaWxsIHRoZSByb3dcbiAgICBjb25zdCBiYXNpc1BlcmNlbnQgPSAoY29sU3BhbiAvIGNvbHMpICogMTAwO1xuICAgIHdyYXBwZXIuc3R5bGUuZmxleCA9IGAke2NvbFNwYW59IDAgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSlgO1xuICAgIHdyYXBwZXIuc3R5bGUubWluV2lkdGggPSAnMCc7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBjb25zdCBvblNhdmUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG4gICAgICBuZXcgQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCBpbnN0YW5jZSwgZW50cnkuYmxvY2ssIG9uU2F2ZSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlwID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1yZXNpemUtZ3JpcCcgfSk7XG4gICAgc2V0SWNvbihncmlwLCAnbWF4aW1pemUtMicpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgdGhpcy5hdHRhY2hSZXNpemVIYW5kbGVyKGdyaXAsIHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIHRoaXMuYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZTogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3QgY2xvbmUgPSB3cmFwcGVyLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIDIwfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGluc3RhbmNlLmlkO1xuICAgICAgd3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke21lLmNsaWVudFggLSAyMH1weGA7XG4gICAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke21lLmNsaWVudFkgLSAyMH1weGA7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5ibG9ja3MuZ2V0KHRhcmdldElkKT8ud3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjbG9uZS5yZW1vdmUoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG4gICAgICAgIHdyYXBwZXIucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXRJZCA9IHRoaXMuZmluZEJsb2NrVW5kZXJDdXJzb3IobWUuY2xpZW50WCwgbWUuY2xpZW50WSwgc291cmNlSWQpO1xuICAgICAgICBpZiAodGFyZ2V0SWQpIHtcbiAgICAgICAgICB0aGlzLnN3YXBCbG9ja3Moc291cmNlSWQsIHRhcmdldElkKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjdXJyZW50Q29sU3BhbiAvIGNvbHVtbnMpICogMTAwO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMCBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpKWA7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlVXAgPSAoKSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbFNwYW46IGN1cnJlbnRDb2xTcGFuIH0gOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQmxvY2tVbmRlckN1cnNvcih4OiBudW1iZXIsIHk6IG51bWJlciwgZXhjbHVkZUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IFtpZCwgeyB3cmFwcGVyIH1dIG9mIHRoaXMuYmxvY2tzKSB7XG4gICAgICBpZiAoaWQgPT09IGV4Y2x1ZGVJZCkgY29udGludWU7XG4gICAgICBjb25zdCByZWN0ID0gd3JhcHBlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKiogU3dhcCBwb3NpdGlvbnMgb2YgdHdvIGJsb2NrcyB1c2luZyBpbW11dGFibGUgdXBkYXRlcy4gKi9cbiAgcHJpdmF0ZSBzd2FwQmxvY2tzKGlkQTogc3RyaW5nLCBpZEI6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGJBID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRBKTtcbiAgICBjb25zdCBiQiA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmluZChiID0+IGIuaWQgPT09IGlkQik7XG4gICAgaWYgKCFiQSB8fCAhYkIpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgaWYgKGIuaWQgPT09IGlkQSkgcmV0dXJuIHsgLi4uYiwgY29sOiBiQi5jb2wsIHJvdzogYkIucm93LCBjb2xTcGFuOiBiQi5jb2xTcGFuLCByb3dTcGFuOiBiQi5yb3dTcGFuIH07XG4gICAgICBpZiAoYi5pZCA9PT0gaWRCKSByZXR1cm4geyAuLi5iLCBjb2w6IGJBLmNvbCwgcm93OiBiQS5yb3csIGNvbFNwYW46IGJBLmNvbFNwYW4sIHJvd1NwYW46IGJBLnJvd1NwYW4gfTtcbiAgICAgIHJldHVybiBiO1xuICAgIH0pO1xuXG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0RWRpdE1vZGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZWRpdE1vZGUgPSBlbmFibGVkO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGUgY29sdW1uIGNvdW50LCBjbGFtcGluZyBlYWNoIGJsb2NrJ3MgY29sIGFuZCBjb2xTcGFuIHRvIGZpdC4gKi9cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGNvbnN0IGNvbCA9IE1hdGgubWluKGIuY29sLCBuKTtcbiAgICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihiLmNvbFNwYW4sIG4gLSBjb2wgKyAxKTtcbiAgICAgIHJldHVybiB7IC4uLmIsIGNvbCwgY29sU3BhbiB9O1xuICAgIH0pO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGNvbHVtbnM6IG4sIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGZvY3VzZWQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGZvY3VzZWRCbG9ja0lkID0gKGZvY3VzZWQ/LmNsb3Nlc3QoJ1tkYXRhLWJsb2NrLWlkXScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuYmxvY2tJZDtcbiAgICB0aGlzLnJlbmRlcih0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG4gICAgaWYgKGZvY3VzZWRCbG9ja0lkKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1ibG9jay1pZD1cIiR7Zm9jdXNlZEJsb2NrSWR9XCJdYCk7XG4gICAgICBlbD8uZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICAvKiogVW5sb2FkIGFsbCBibG9ja3MgYW5kIGNhbmNlbCBhbnkgaW4tcHJvZ3Jlc3MgZHJhZy9yZXNpemUuICovXG4gIGRlc3Ryb3lBbGwoKTogdm9pZCB7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmU/LnJlbW92ZSgpO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG51bGw7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIHNldHRpbmdzIG1vZGFsICh0aXRsZSBzZWN0aW9uICsgYmxvY2stc3BlY2lmaWMgc2V0dGluZ3MpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vLyBbZW1vamksIHNlYXJjaCBrZXl3b3Jkc10gXHUyMDE0IDE3MCBtb3N0IGNvbW1vbi91c2VmdWxcbmNvbnN0IEVNT0pJX1BJQ0tFUl9TRVQ6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgLy8gU21pbGV5cyAmIGVtb3Rpb25cbiAgWydcdUQ4M0RcdURFMDAnLCdoYXBweSBzbWlsZSBncmluJ10sWydcdUQ4M0RcdURFMEEnLCdzbWlsZSBibHVzaCBoYXBweSddLFsnXHVEODNEXHVERTAyJywnbGF1Z2ggY3J5IGZ1bm55IGpveSddLFxuICBbJ1x1RDgzRVx1REQ3MicsJ3RlYXIgc21pbGUgZ3JhdGVmdWwnXSxbJ1x1RDgzRFx1REUwRCcsJ2hlYXJ0IGV5ZXMgbG92ZSddLFsnXHVEODNFXHVERDI5Jywnc3RhciBleWVzIGV4Y2l0ZWQnXSxcbiAgWydcdUQ4M0RcdURFMEUnLCdjb29sIHN1bmdsYXNzZXMnXSxbJ1x1RDgzRVx1REQxNCcsJ3RoaW5raW5nIGhtbSddLFsnXHVEODNEXHVERTA1Jywnc3dlYXQgbmVydm91cyBsYXVnaCddLFxuICBbJ1x1RDgzRFx1REUyMicsJ2NyeSBzYWQgdGVhciddLFsnXHVEODNEXHVERTI0JywnYW5ncnkgaHVmZiBmcnVzdHJhdGVkJ10sWydcdUQ4M0VcdURENzMnLCdwYXJ0eSBjZWxlYnJhdGUnXSxcbiAgWydcdUQ4M0RcdURFMzQnLCdzbGVlcCB0aXJlZCB6enonXSxbJ1x1RDgzRVx1REQyRicsJ21pbmQgYmxvd24gZXhwbG9kZSddLFsnXHVEODNFXHVERUUxJywnc2FsdXRlIHJlc3BlY3QnXSxcbiAgLy8gUGVvcGxlICYgZ2VzdHVyZXNcbiAgWydcdUQ4M0RcdURDNEInLCd3YXZlIGhlbGxvIGJ5ZSddLFsnXHVEODNEXHVEQzREJywndGh1bWJzIHVwIGdvb2Qgb2snXSxbJ1x1RDgzRFx1REM0RScsJ3RodW1icyBkb3duIGJhZCddLFxuICBbJ1x1MjcwQycsJ3ZpY3RvcnkgcGVhY2UnXSxbJ1x1RDgzRVx1REQxRCcsJ2hhbmRzaGFrZSBkZWFsJ10sWydcdUQ4M0RcdURFNEYnLCdwcmF5IHRoYW5rcyBwbGVhc2UnXSxcbiAgWydcdUQ4M0RcdURDQUEnLCdtdXNjbGUgc3Ryb25nIGZsZXgnXSxbJ1x1RDgzRFx1REM0MScsJ2V5ZSB3YXRjaCBzZWUnXSxbJ1x1RDgzRVx1RERFMCcsJ2JyYWluIG1pbmQgdGhpbmsnXSxcbiAgWydcdTI3NjQnLCdoZWFydCBsb3ZlIHJlZCddLFsnXHVEODNFXHVEREUxJywnb3JhbmdlIGhlYXJ0J10sWydcdUQ4M0RcdURDOUInLCd5ZWxsb3cgaGVhcnQnXSxcbiAgWydcdUQ4M0RcdURDOUEnLCdncmVlbiBoZWFydCddLFsnXHVEODNEXHVEQzk5JywnYmx1ZSBoZWFydCddLFsnXHVEODNEXHVEQzlDJywncHVycGxlIGhlYXJ0J10sWydcdUQ4M0RcdUREQTQnLCdibGFjayBoZWFydCddLFxuICAvLyBOYXR1cmVcbiAgWydcdUQ4M0NcdURGMzEnLCdzZWVkbGluZyBzcHJvdXQgZ3JvdyddLFsnXHVEODNDXHVERjNGJywnaGVyYiBsZWFmIGdyZWVuIG5hdHVyZSddLFsnXHVEODNDXHVERjQwJywnY2xvdmVyIGx1Y2snXSxcbiAgWydcdUQ4M0NcdURGMzgnLCdibG9zc29tIGZsb3dlciBwaW5rJ10sWydcdUQ4M0NcdURGM0EnLCdmbG93ZXIgaGliaXNjdXMnXSxbJ1x1RDgzQ1x1REYzQicsJ3N1bmZsb3dlciddLFxuICBbJ1x1RDgzQ1x1REY0MicsJ2F1dHVtbiBmYWxsIGxlYWYnXSxbJ1x1RDgzQ1x1REYwQScsJ3dhdmUgb2NlYW4gd2F0ZXIgc2VhJ10sWydcdUQ4M0RcdUREMjUnLCdmaXJlIGZsYW1lIGhvdCddLFxuICBbJ1x1Mjc0NCcsJ3Nub3dmbGFrZSBjb2xkIGljZSB3aW50ZXInXSxbJ1x1MjZBMScsJ2xpZ2h0bmluZyBib2x0IGVuZXJneSddLFsnXHVEODNDXHVERjA4JywncmFpbmJvdyddLFxuICBbJ1x1MjYwMCcsJ3N1biBzdW5ueSBicmlnaHQnXSxbJ1x1RDgzQ1x1REYxOScsJ21vb24gbmlnaHQgY3Jlc2NlbnQnXSxbJ1x1MkI1MCcsJ3N0YXIgZmF2b3JpdGUnXSxcbiAgWydcdUQ4M0NcdURGMUYnLCdnbG93aW5nIHN0YXIgc2hpbmUnXSxbJ1x1MjcyOCcsJ3NwYXJrbGVzIHNoaW5lIG1hZ2ljJ10sWydcdUQ4M0NcdURGRDQnLCdtb3VudGFpbiBwZWFrJ10sXG4gIFsnXHVEODNDXHVERjBEJywnZWFydGggZ2xvYmUgd29ybGQnXSxbJ1x1RDgzQ1x1REYxMCcsJ2dsb2JlIGludGVybmV0IHdlYiddLFxuICAvLyBGb29kICYgb2JqZWN0c1xuICBbJ1x1MjYxNScsJ2NvZmZlZSB0ZWEgaG90IGRyaW5rJ10sWydcdUQ4M0NcdURGNzUnLCd0ZWEgY3VwIGhvdCddLFsnXHVEODNDXHVERjdBJywnYmVlciBkcmluayddLFxuICBbJ1x1RDgzQ1x1REY0RScsJ2FwcGxlIGZydWl0IHJlZCddLFsnXHVEODNDXHVERjRCJywnbGVtb24geWVsbG93IHNvdXInXSxbJ1x1RDgzQ1x1REY4MicsJ2Nha2UgYmlydGhkYXknXSxcbiAgLy8gQWN0aXZpdGllcyAmIHNwb3J0c1xuICBbJ1x1RDgzQ1x1REZBRicsJ3RhcmdldCBidWxsc2V5ZSBnb2FsJ10sWydcdUQ4M0NcdURGQzYnLCd0cm9waHkgYXdhcmQgd2luJ10sWydcdUQ4M0VcdURENDcnLCdtZWRhbCBnb2xkIGZpcnN0J10sXG4gIFsnXHVEODNDXHVERkFFJywnZ2FtZSBjb250cm9sbGVyIHBsYXknXSxbJ1x1RDgzQ1x1REZBOCcsJ2FydCBwYWxldHRlIGNyZWF0aXZlIHBhaW50J10sWydcdUQ4M0NcdURGQjUnLCdtdXNpYyBub3RlIHNvbmcnXSxcbiAgWydcdUQ4M0NcdURGQUMnLCdjbGFwcGVyIGZpbG0gbW92aWUnXSxbJ1x1RDgzRFx1RENGNycsJ2NhbWVyYSBwaG90byddLFsnXHVEODNDXHVERjgxJywnZ2lmdCBwcmVzZW50J10sXG4gIFsnXHVEODNDXHVERkIyJywnZGljZSBnYW1lIHJhbmRvbSddLFsnXHVEODNFXHVEREU5JywncHV6emxlIHBpZWNlJ10sWydcdUQ4M0NcdURGQUQnLCd0aGVhdGVyIG1hc2tzJ10sXG4gIC8vIFRyYXZlbCAmIHBsYWNlc1xuICBbJ1x1RDgzRFx1REU4MCcsJ3JvY2tldCBsYXVuY2ggc3BhY2UnXSxbJ1x1MjcwOCcsJ2FpcnBsYW5lIHRyYXZlbCBmbHknXSxbJ1x1RDgzRFx1REU4MicsJ3RyYWluIHRyYXZlbCddLFxuICBbJ1x1RDgzQ1x1REZFMCcsJ2hvdXNlIGhvbWUnXSxbJ1x1RDgzQ1x1REZEOScsJ2NpdHkgYnVpbGRpbmcnXSxbJ1x1RDgzQ1x1REYwNicsJ2NpdHkgc3Vuc2V0J10sXG4gIC8vIE9iamVjdHMgJiB0b29sc1xuICBbJ1x1RDgzRFx1RENDMScsJ2ZvbGRlciBkaXJlY3RvcnknXSxbJ1x1RDgzRFx1RENDMicsJ29wZW4gZm9sZGVyJ10sWydcdUQ4M0RcdURDQzQnLCdkb2N1bWVudCBwYWdlIGZpbGUnXSxcbiAgWydcdUQ4M0RcdURDREQnLCdtZW1vIHdyaXRlIG5vdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NCJywnY2xpcGJvYXJkIGNvcHknXSxbJ1x1RDgzRFx1RENDQycsJ3B1c2hwaW4gcGluJ10sXG4gIFsnXHVEODNEXHVEQ0NEJywnbG9jYXRpb24gcGluIG1hcCddLFsnXHVEODNEXHVERDE2JywnYm9va21hcmsgc2F2ZSddLFsnXHVEODNEXHVEREMyJywnaW5kZXggZGl2aWRlcnMnXSxcbiAgWydcdUQ4M0RcdURDQzUnLCdjYWxlbmRhciBkYXRlIHNjaGVkdWxlJ10sWydcdUQ4M0RcdURERDMnLCdjYWxlbmRhciBzcGlyYWwnXSxbJ1x1MjNGMCcsJ2FsYXJtIGNsb2NrIHRpbWUgd2FrZSddLFxuICBbJ1x1RDgzRFx1REQ1MCcsJ2Nsb2NrIHRpbWUgaG91ciddLFsnXHUyM0YxJywnc3RvcHdhdGNoIHRpbWVyJ10sWydcdUQ4M0RcdURDQ0EnLCdjaGFydCBiYXIgZGF0YSddLFxuICBbJ1x1RDgzRFx1RENDOCcsJ2NoYXJ0IHVwIGdyb3d0aCB0cmVuZCddLFsnXHVEODNEXHVEQ0M5JywnY2hhcnQgZG93biBkZWNsaW5lJ10sXG4gIFsnXHVEODNEXHVEQ0ExJywnaWRlYSBsaWdodCBidWxiIGluc2lnaHQnXSxbJ1x1RDgzRFx1REQwRCcsJ3NlYXJjaCBtYWduaWZ5IHpvb20nXSxbJ1x1RDgzRFx1REQxNycsJ2xpbmsgY2hhaW4gdXJsJ10sXG4gIFsnXHVEODNEXHVEQ0UyJywnbG91ZHNwZWFrZXIgYW5ub3VuY2UnXSxbJ1x1RDgzRFx1REQxNCcsJ2JlbGwgbm90aWZpY2F0aW9uIGFsZXJ0J10sXG4gIFsnXHVEODNEXHVEQ0FDJywnc3BlZWNoIGJ1YmJsZSBjaGF0IG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENBRCcsJ3Rob3VnaHQgdGhpbmsgYnViYmxlJ10sXG4gIFsnXHVEODNEXHVEQ0RBJywnYm9va3Mgc3R1ZHkgbGlicmFyeSddLFsnXHVEODNEXHVEQ0Q2Jywnb3BlbiBib29rIHJlYWQnXSxbJ1x1RDgzRFx1RENEQycsJ3Njcm9sbCBkb2N1bWVudCddLFxuICBbJ1x1MjcwOScsJ2VudmVsb3BlIGVtYWlsIGxldHRlciddLFsnXHVEODNEXHVEQ0U3JywnZW1haWwgbWVzc2FnZSddLFsnXHVEODNEXHVEQ0U1JywnaW5ib3ggZG93bmxvYWQnXSxcbiAgWydcdUQ4M0RcdURDRTQnLCdvdXRib3ggdXBsb2FkIHNlbmQnXSxbJ1x1RDgzRFx1REREMScsJ3RyYXNoIGRlbGV0ZSByZW1vdmUnXSxcbiAgLy8gVGVjaFxuICBbJ1x1RDgzRFx1RENCQicsJ2xhcHRvcCBjb21wdXRlciBjb2RlJ10sWydcdUQ4M0RcdUREQTUnLCdkZXNrdG9wIG1vbml0b3Igc2NyZWVuJ10sWydcdUQ4M0RcdURDRjEnLCdwaG9uZSBtb2JpbGUnXSxcbiAgWydcdTIzMjgnLCdrZXlib2FyZCB0eXBlJ10sWydcdUQ4M0RcdUREQjEnLCdtb3VzZSBjdXJzb3IgY2xpY2snXSxbJ1x1RDgzRFx1RENFMScsJ3NhdGVsbGl0ZSBhbnRlbm5hIHNpZ25hbCddLFxuICBbJ1x1RDgzRFx1REQwQycsJ3BsdWcgcG93ZXIgZWxlY3RyaWMnXSxbJ1x1RDgzRFx1REQwQicsJ2JhdHRlcnkgcG93ZXIgY2hhcmdlJ10sWydcdUQ4M0RcdURDQkUnLCdmbG9wcHkgZGlzayBzYXZlJ10sXG4gIFsnXHVEODNEXHVEQ0JGJywnZGlzYyBjZCBkdmQnXSxbJ1x1RDgzRFx1RERBOCcsJ3ByaW50ZXIgcHJpbnQnXSxcbiAgLy8gU3ltYm9scyAmIHN0YXR1c1xuICBbJ1x1MjcwNScsJ2NoZWNrIGRvbmUgY29tcGxldGUgeWVzJ10sWydcdTI3NEMnLCdjcm9zcyBlcnJvciB3cm9uZyBubyBkZWxldGUnXSxcbiAgWydcdTI2QTAnLCd3YXJuaW5nIGNhdXRpb24gYWxlcnQnXSxbJ1x1Mjc1MycsJ3F1ZXN0aW9uIG1hcmsnXSxbJ1x1Mjc1NycsJ2V4Y2xhbWF0aW9uIGltcG9ydGFudCddLFxuICBbJ1x1RDgzRFx1REQxMicsJ2xvY2sgc2VjdXJlIHByaXZhdGUnXSxbJ1x1RDgzRFx1REQxMycsJ3VubG9jayBvcGVuIHB1YmxpYyddLFsnXHVEODNEXHVERDExJywna2V5IHBhc3N3b3JkIGFjY2VzcyddLFxuICBbJ1x1RDgzRFx1REVFMScsJ3NoaWVsZCBwcm90ZWN0IHNlY3VyaXR5J10sWydcdTI2OTknLCdnZWFyIHNldHRpbmdzIGNvbmZpZyddLFsnXHVEODNEXHVERDI3Jywnd3JlbmNoIHRvb2wgZml4J10sXG4gIFsnXHVEODNEXHVERDI4JywnaGFtbWVyIGJ1aWxkJ10sWydcdTI2OTcnLCdmbGFzayBjaGVtaXN0cnkgbGFiJ10sWydcdUQ4M0RcdUREMkMnLCdtaWNyb3Njb3BlIHNjaWVuY2UgcmVzZWFyY2gnXSxcbiAgWydcdUQ4M0RcdUREMkQnLCd0ZWxlc2NvcGUgc3BhY2UgYXN0cm9ub215J10sWydcdUQ4M0VcdURERUEnLCd0ZXN0IHR1YmUgZXhwZXJpbWVudCddLFxuICBbJ1x1RDgzRFx1REM4RScsJ2dlbSBkaWFtb25kIHByZWNpb3VzJ10sWydcdUQ4M0RcdURDQjAnLCdtb25leSBiYWcgcmljaCddLFsnXHVEODNEXHVEQ0IzJywnY3JlZGl0IGNhcmQgcGF5bWVudCddLFxuICBbJ1x1RDgzQ1x1REZGNycsJ2xhYmVsIHRhZyBwcmljZSddLFsnXHVEODNDXHVERjgwJywncmliYm9uIGJvdyBnaWZ0J10sXG4gIC8vIE1pc2MgdXNlZnVsXG4gIFsnXHVEODNFXHVEREVEJywnY29tcGFzcyBuYXZpZ2F0ZSBkaXJlY3Rpb24nXSxbJ1x1RDgzRFx1RERGQScsJ21hcCB3b3JsZCBuYXZpZ2F0ZSddLFxuICBbJ1x1RDgzRFx1RENFNicsJ2JveCBwYWNrYWdlIHNoaXBwaW5nJ10sWydcdUQ4M0RcdUREQzQnLCdmaWxpbmcgY2FiaW5ldCBhcmNoaXZlJ10sXG4gIFsnXHVEODNEXHVERDEwJywnbG9jayBrZXkgc2VjdXJlJ10sWydcdUQ4M0RcdURDQ0UnLCdwYXBlcmNsaXAgYXR0YWNoJ10sWydcdTI3MDInLCdzY2lzc29ycyBjdXQnXSxcbiAgWydcdUQ4M0RcdUREOEEnLCdwZW4gd3JpdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NGJywncnVsZXIgbWVhc3VyZSddLFsnXHVEODNEXHVERDA1JywnZGltIGJyaWdodG5lc3MnXSxcbiAgWydcdUQ4M0RcdUREMDYnLCdicmlnaHQgc3VuIGxpZ2h0J10sWydcdTI2N0InLCdyZWN5Y2xlIHN1c3RhaW5hYmlsaXR5J10sWydcdTI3MTQnLCdjaGVja21hcmsgZG9uZSddLFxuICBbJ1x1Mjc5NScsJ3BsdXMgYWRkJ10sWydcdTI3OTYnLCdtaW51cyByZW1vdmUnXSxbJ1x1RDgzRFx1REQwNCcsJ3JlZnJlc2ggc3luYyBsb29wJ10sXG4gIFsnXHUyM0U5JywnZmFzdCBmb3J3YXJkIHNraXAnXSxbJ1x1MjNFQScsJ3Jld2luZCBiYWNrJ10sWydcdTIzRjgnLCdwYXVzZSBzdG9wJ10sXG4gIFsnXHUyNUI2JywncGxheSBzdGFydCddLFsnXHVEODNEXHVERDAwJywnc2h1ZmZsZSByYW5kb20gbWl4J10sXG5dO1xuXG5jbGFzcyBCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJpdmF0ZSBibG9jazogQmFzZUJsb2NrLFxuICAgIHByaXZhdGUgb25TYXZlOiAoKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmluc3RhbmNlLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnVGl0bGUgbGFiZWwnKVxuICAgICAgLnNldERlc2MoJ0xlYXZlIGVtcHR5IHRvIHVzZSB0aGUgZGVmYXVsdCB0aXRsZS4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKHR5cGVvZiBkcmFmdC5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgPyBkcmFmdC5fdGl0bGVMYWJlbCA6ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdEZWZhdWx0IHRpdGxlJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX3RpdGxlTGFiZWwgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgRW1vamkgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIGNvbnN0IGVtb2ppUm93ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1yb3cnIH0pO1xuICAgIGVtb2ppUm93LmNyZWF0ZVNwYW4oeyBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsIHRleHQ6ICdUaXRsZSBlbW9qaScgfSk7XG5cbiAgICBjb25zdCBjb250cm9scyA9IGVtb2ppUm93LmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1jb250cm9scycgfSk7XG5cbiAgICBjb25zdCB0cmlnZ2VyQnRuID0gY29udHJvbHMuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktcGlja2VyLXRyaWdnZXInIH0pO1xuICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXIgPSAoKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSB0eXBlb2YgZHJhZnQuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlRW1vamkgOiAnJztcbiAgICAgIHRyaWdnZXJCdG4uZW1wdHkoKTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCAnXHVGRjBCJyB9KTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1jaGV2cm9uJywgdGV4dDogJ1x1MjVCRScgfSk7XG4gICAgfTtcbiAgICB1cGRhdGVUcmlnZ2VyKCk7XG5cbiAgICBjb25zdCBjbGVhckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci1jbGVhcicsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgIGNsZWFyQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDbGVhciBlbW9qaScpO1xuXG4gICAgY29uc3QgcGFuZWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLXBhbmVsJyB9KTtcbiAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgY29uc3Qgc2VhcmNoSW5wdXQgPSBwYW5lbC5jcmVhdGVFbCgnaW5wdXQnLCB7XG4gICAgICB0eXBlOiAndGV4dCcsXG4gICAgICBjbHM6ICdlbW9qaS1waWNrZXItc2VhcmNoJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnU2VhcmNoXHUyMDI2JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaWRFbCA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1ncmlkJyB9KTtcblxuICAgIGNvbnN0IHJlbmRlckdyaWQgPSAocXVlcnk6IHN0cmluZykgPT4ge1xuICAgICAgZ3JpZEVsLmVtcHR5KCk7XG4gICAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZCA9IHFcbiAgICAgICAgPyBFTU9KSV9QSUNLRVJfU0VULmZpbHRlcigoW2UsIGtdKSA9PiBrLmluY2x1ZGVzKHEpIHx8IGUgPT09IHEpXG4gICAgICAgIDogRU1PSklfUElDS0VSX1NFVDtcbiAgICAgIGZvciAoY29uc3QgW2Vtb2ppXSBvZiBmaWx0ZXJlZCkge1xuICAgICAgICBjb25zdCBidG4gPSBncmlkRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktYnRuJywgdGV4dDogZW1vamkgfSk7XG4gICAgICAgIGlmIChkcmFmdC5fdGl0bGVFbW9qaSA9PT0gZW1vamkpIGJ0bi5hZGRDbGFzcygnaXMtc2VsZWN0ZWQnKTtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gZW1vamk7XG4gICAgICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgc2VhcmNoSW5wdXQudmFsdWUgPSAnJztcbiAgICAgICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGdyaWRFbC5jcmVhdGVTcGFuKHsgY2xzOiAnZW1vamktcGlja2VyLWVtcHR5JywgdGV4dDogJ05vIHJlc3VsdHMnIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVuZGVyR3JpZCgnJyk7XG5cbiAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHJlbmRlckdyaWQoc2VhcmNoSW5wdXQudmFsdWUpKTtcblxuICAgIHRyaWdnZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBvcGVuID0gcGFuZWwuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9IG9wZW4gPyAnbm9uZScgOiAnYmxvY2snO1xuICAgICAgaWYgKCFvcGVuKSBzZXRUaW1lb3V0KCgpID0+IHNlYXJjaElucHV0LmZvY3VzKCksIDApO1xuICAgIH0pO1xuXG4gICAgY2xlYXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9ICcnO1xuICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICB9KTtcbiAgICAvLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIaWRlIHRpdGxlJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0Ll9oaWRlVGl0bGUgPT09IHRydWUpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll9oaWRlVGl0bGUgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gZHJhZnQ7XG4gICAgICAgICAgdGhpcy5vblNhdmUoKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG5cbiAgICBjb25zdCBociA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaHInKTtcbiAgICBoci5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdCbG9jay1zcGVjaWZpYyBzZXR0aW5nczonLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NvbmZpZ3VyZSBibG9jay4uLicpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmJsb2NrLm9wZW5TZXR0aW5ncyh0aGlzLm9uU2F2ZSk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gRWRpdCB0b2dnbGVcbiAgICBjb25zdCBlZGl0QnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1lZGl0LWJ0bicgfSk7XG4gICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgIGVkaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgICB0aGlzLmdyaWQuc2V0RWRpdE1vZGUodGhpcy5lZGl0TW9kZSk7XG4gICAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgICB0aGlzLnN5bmNBZGRCdXR0b24oKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRWRpdEJ0bihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gdGhpcy5lZGl0TW9kZSA/ICdcdTI3MTMgRG9uZScgOiAnXHUyNzBGIEVkaXQnO1xuICAgIGJ0bi50b2dnbGVDbGFzcygndG9vbGJhci1idG4tYWN0aXZlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRvb2xiYXJFbC5xdWVyeVNlbGVjdG9yKCcudG9vbGJhci1hZGQtYnRuJyk7XG4gICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgIWV4aXN0aW5nKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZWRpdE1vZGUgJiYgZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNvbnN0IEJMT0NLX0lDT05TOiBSZWNvcmQ8QmxvY2tUeXBlLCBzdHJpbmc+ID0ge1xuICAnZ3JlZXRpbmcnOiAgICAgICdcdUQ4M0RcdURDNEInLFxuICAnY2xvY2snOiAgICAgICAgICdcdUQ4M0RcdURENTAnLFxuICAnZm9sZGVyLWxpbmtzJzogICdcdUQ4M0RcdUREMTcnLFxuICAnaW5zaWdodCc6ICAgICAgICdcdUQ4M0RcdURDQTEnLFxuICAndGFnLWdyaWQnOiAgICAgICdcdUQ4M0NcdURGRjdcdUZFMEYnLFxuICAncXVvdGVzLWxpc3QnOiAgICdcdUQ4M0RcdURDQUMnLFxuICAnaW1hZ2UtZ2FsbGVyeSc6ICdcdUQ4M0RcdUREQkNcdUZFMEYnLFxuICAnZW1iZWRkZWQtbm90ZSc6ICdcdUQ4M0RcdURDQzQnLFxuICAnc3RhdGljLXRleHQnOiAgICdcdUQ4M0RcdURDREQnLFxuICAnaHRtbCc6ICAgICAgICAgICc8Lz4nLFxufTtcblxuY2xhc3MgQWRkQmxvY2tNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvblNlbGVjdDogKHR5cGU6IEJsb2NrVHlwZSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQWRkIEJsb2NrJywgY2xzOiAnYWRkLWJsb2NrLW1vZGFsLXRpdGxlJyB9KTtcblxuICAgIGNvbnN0IGdyaWQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYWRkLWJsb2NrLWdyaWQnIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYWRkLWJsb2NrLW9wdGlvbicgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1pY29uJywgdGV4dDogQkxPQ0tfSUNPTlNbZmFjdG9yeS50eXBlXSA/PyAnXHUyNUFBJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLW5hbWUnLCB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsLlxuICAvLyBSZXNwZWN0cyBfaGlkZVRpdGxlLCBfdGl0bGVMYWJlbCwgYW5kIF90aXRsZUVtb2ppIGZyb20gaW5zdGFuY2UuY29uZmlnLlxuICBwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGVsOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNmZyA9IHRoaXMuaW5zdGFuY2UuY29uZmlnO1xuICAgIGlmIChjZmcuX2hpZGVUaXRsZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgIGNvbnN0IGxhYmVsID0gKHR5cGVvZiBjZmcuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVMYWJlbC50cmltKCkpXG4gICAgICA/IGNmZy5fdGl0bGVMYWJlbC50cmltKClcbiAgICAgIDogdGl0bGU7XG4gICAgaWYgKCFsYWJlbCkgcmV0dXJuO1xuICAgIGNvbnN0IGhlYWRlciA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhlYWRlcicgfSk7XG4gICAgaWYgKHR5cGVvZiBjZmcuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVFbW9qaSkge1xuICAgICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyBjbHM6ICdibG9jay1oZWFkZXItZW1vamknLCB0ZXh0OiBjZmcuX3RpdGxlRW1vamkgfSk7XG4gICAgfVxuICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgdGV4dDogbGFiZWwgfSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBDbG9ja0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGF0ZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnY2xvY2stYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd0RhdGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dEYXRlPzogYm9vbGVhbiB9O1xuXG4gICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay10aW1lJyB9KTtcbiAgICBpZiAoc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stZGF0ZScgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IHsgc2hvd1NlY29uZHMgPSBmYWxzZSwgc2hvd0RhdGUgPSB0cnVlLCBmb3JtYXQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgc2hvd1NlY29uZHM/OiBib29sZWFuO1xuICAgICAgc2hvd0RhdGU/OiBib29sZWFuO1xuICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy50aW1lRWwpIHtcbiAgICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KGZvcm1hdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KHNob3dTZWNvbmRzID8gJ0hIOm1tOnNzJyA6ICdISDptbScpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0ZUVsICYmIHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ2RkZGQsIEQgTU1NTSBZWVlZJykpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgQ2xvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgQ2xvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgc2Vjb25kcycpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dTZWNvbmRzIGFzIGJvb2xlYW4gPz8gZmFsc2UpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93U2Vjb25kcyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGRhdGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93RGF0ZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RGF0ZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0N1c3RvbSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ09wdGlvbmFsIG1vbWVudC5qcyBmb3JtYXQgc3RyaW5nLCBlLmcuIFwiSEg6bW1cIi4gTGVhdmUgZW1wdHkgZm9yIGRlZmF1bHQuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb3JtYXQgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb3JtYXQgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgTGlua0l0ZW0ge1xuICBsYWJlbDogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIGVtb2ppPzogc3RyaW5nO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+IGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHsgdGhpcy5vbkNob29zZShmb2xkZXIpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIEZvbGRlckxpbmtzQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlbmRlclRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdmb2xkZXItbGlua3MtYmxvY2snKTtcblxuICAgIC8vIFJlLXJlbmRlciB3aGVuIHZhdWx0IGZpbGVzIGFyZSBjcmVhdGVkLCBkZWxldGVkLCBvciByZW5hbWVkIChkZWJvdW5jZWQpXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG5cbiAgICAvLyBEZWZlciBmaXJzdCByZW5kZXIgc28gdmF1bHQgaXMgZnVsbHkgaW5kZXhlZFxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHRoaXMucmVuZGVyQ29udGVudCgpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVSZW5kZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVuZGVyVGltZXIgIT09IG51bGwpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZW5kZXJUaW1lcik7XG4gICAgdGhpcy5yZW5kZXJUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMucmVuZGVyVGltZXIgPSBudWxsO1xuICAgICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gICAgfSwgMTUwKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQ29udGVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1F1aWNrIExpbmtzJywgZm9sZGVyID0gJycsIGxpbmtzID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgbGlua3M/OiBMaW5rSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgbGlzdCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rcy1saXN0JyB9KTtcblxuICAgIC8vIEF1dG8tbGlzdCBub3RlcyBmcm9tIHNlbGVjdGVkIGZvbGRlciAoc29ydGVkIGFscGhhYmV0aWNhbGx5KVxuICAgIGlmIChmb2xkZXIpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGlzZWQgPSBmb2xkZXIudHJpbSgpLnJlcGxhY2UoL1xcLyskLywgJycpO1xuXG4gICAgICBpZiAoIW5vcm1hbGlzZWQpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1ZhdWx0IHJvb3QgbGlzdGluZyBpcyBub3Qgc3VwcG9ydGVkLiBTZWxlY3QgYSBzdWJmb2xkZXIuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXNlZCk7XG5cbiAgICAgICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtub3JtYWxpc2VkfVwiIG5vdCBmb3VuZC5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcmVmaXggPSBmb2xkZXJPYmoucGF0aCArICcvJztcbiAgICAgICAgICBjb25zdCBub3RlcyA9IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKClcbiAgICAgICAgICAgIC5maWx0ZXIoZiA9PiBmLnBhdGguc3RhcnRzV2l0aChwcmVmaXgpKVxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYE5vIG5vdGVzIGluIFwiJHtmb2xkZXJPYmoucGF0aH1cIi5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYW51YWwgbGlua3NcbiAgICBmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgaWYgKGxpbmsuZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdsaW5rLWVtb2ppJywgdGV4dDogbGluay5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogbGluay5sYWJlbCB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChsaW5rLnBhdGgsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyICYmIGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ0FkZCBsaW5rcyBvciBzZWxlY3QgYSBmb2xkZXIgaW4gc2V0dGluZ3MuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwoXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgICAobmV3Q29uZmlnKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICAgICAgb25TYXZlKCk7XG4gICAgICB9LFxuICAgICkub3BlbigpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyTGlua3NTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVpY2sgTGlua3MgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQ6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0gPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuICAgIGRyYWZ0LmxpbmtzID8/PSBbXTtcbiAgICBjb25zdCBsaW5rcyA9IGRyYWZ0LmxpbmtzO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVpY2sgTGlua3MnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdBdXRvLWxpc3QgZm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdMaXN0IGFsbCBub3RlcyBmcm9tIHRoaXMgdmF1bHQgZm9sZGVyIGFzIGxpbmtzLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdlLmcuIFByb2plY3RzJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnTWFudWFsIGxpbmtzJyB9KTtcblxuICAgIGNvbnN0IGxpbmtzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuXG4gICAgY29uc3QgcmVuZGVyTGlua3MgPSAoKSA9PiB7XG4gICAgICBsaW5rc0NvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgbGlua3MuZm9yRWFjaCgobGluaywgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaW5rc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdzZXR0aW5ncy1saW5rLXJvdycgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHJvdylcbiAgICAgICAgICAuc2V0TmFtZShgTGluayAke2kgKyAxfWApXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdMYWJlbCcpLnNldFZhbHVlKGxpbmsubGFiZWwpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5sYWJlbCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignUGF0aCcpLnNldFZhbHVlKGxpbmsucGF0aCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLnBhdGggPSB2OyB9KSlcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0Vtb2ppJykuc2V0VmFsdWUobGluay5lbW9qaSA/PyAnJykub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmVtb2ppID0gdiB8fCB1bmRlZmluZWQ7IH0pKVxuICAgICAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRJY29uKCd0cmFzaCcpLnNldFRvb2x0aXAoJ1JlbW92ZScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgbGlua3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpbmtzKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0QnV0dG9uVGV4dCgnQWRkIExpbmsnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgbGlua3MucHVzaCh7IGxhYmVsOiAnJywgcGF0aDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpbmtzKCk7XG4gICAgICB9KSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSkpO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IE1TX1BFUl9EQVkgPSA4Nl80MDBfMDAwO1xuXG5leHBvcnQgY2xhc3MgSW5zaWdodEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbnNpZ2h0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBpbnNpZ2h0LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGRhaWx5U2VlZD86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjYXJkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1jYXJkJyB9KTtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBjYXJkLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBibG9jayBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpO1xuXG4gICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY2FyZC5zZXRUZXh0KGBObyBmaWxlcyBmb3VuZCB3aXRoIHRhZyAke3RhZ1NlYXJjaH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVc2UgbG9jYWwgbWlkbmlnaHQgYXMgdGhlIGRheSBpbmRleCBzbyBpdCBjaGFuZ2VzIGF0IGxvY2FsIG1pZG5pZ2h0LCBub3QgVVRDXG4gICAgY29uc3QgZGF5SW5kZXggPSBNYXRoLmZsb29yKG1vbWVudCgpLnN0YXJ0T2YoJ2RheScpLnZhbHVlT2YoKSAvIE1TX1BFUl9EQVkpO1xuICAgIGNvbnN0IGluZGV4ID0gZGFpbHlTZWVkXG4gICAgICA/IGRheUluZGV4ICUgZmlsZXMubGVuZ3RoXG4gICAgICA6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGZpbGVzLmxlbmd0aCk7XG5cbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaW5kZXhdO1xuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBjb25zdCB7IGhlYWRpbmcsIGJvZHkgfSA9IHRoaXMucGFyc2VDb250ZW50KGNvbnRlbnQsIGNhY2hlKTtcblxuICAgICAgY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LXRpdGxlJywgdGV4dDogaGVhZGluZyB8fCBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWJvZHknLCB0ZXh0OiBib2R5IH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVhZCBmaWxlOicsIGUpO1xuICAgICAgY2FyZC5zZXRUZXh0KCdFcnJvciByZWFkaW5nIGZpbGUuJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdGhlIGZpcnN0IGhlYWRpbmcgYW5kIGZpcnN0IHBhcmFncmFwaCB1c2luZyBtZXRhZGF0YUNhY2hlIG9mZnNldHMuXG4gICAqIEZhbGxzIGJhY2sgdG8gbWFudWFsIHBhcnNpbmcgb25seSBpZiBjYWNoZSBpcyB1bmF2YWlsYWJsZS5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfSB7XG4gICAgLy8gVXNlIGNhY2hlZCBoZWFkaW5nIGlmIGF2YWlsYWJsZSAoYXZvaWRzIG1hbnVhbCBwYXJzaW5nKVxuICAgIGNvbnN0IGhlYWRpbmcgPSBjYWNoZT8uaGVhZGluZ3M/LlswXT8uaGVhZGluZyA/PyAnJztcblxuICAgIC8vIFNraXAgZnJvbnRtYXR0ZXIgdXNpbmcgdGhlIGNhY2hlZCBvZmZzZXRcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuXG4gICAgLy8gRmlyc3Qgbm9uLWVtcHR5LCBub24taGVhZGluZyBsaW5lIGlzIHRoZSBib2R5XG4gICAgY29uc3QgYm9keSA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maW5kKGwgPT4gbCAmJiAhbC5zdGFydHNXaXRoKCcjJykpID8/ICcnO1xuXG4gICAgcmV0dXJuIHsgaGVhZGluZywgYm9keSB9O1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEluc2lnaHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdJbnNpZ2h0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICdEYWlseSBJbnNpZ2h0JylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdEYWlseSBzZWVkJykuc2V0RGVzYygnU2hvdyBzYW1lIG5vdGUgYWxsIGRheScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LmRhaWx5U2VlZCBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5kYWlseVNlZWQgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKlxuICogUmV0dXJucyBhbGwgbWFya2Rvd24gZmlsZXMgaW4gdGhlIHZhdWx0IHRoYXQgaGF2ZSB0aGUgZ2l2ZW4gdGFnLlxuICogYHRhZ2AgbXVzdCBpbmNsdWRlIHRoZSBsZWFkaW5nIGAjYCAoZS5nLiBgI3ZhbHVlc2ApLlxuICogSGFuZGxlcyBib3RoIGlubGluZSB0YWdzIGFuZCBZQU1MIGZyb250bWF0dGVyIHRhZ3MgKHdpdGggb3Igd2l0aG91dCBgI2ApLFxuICogYW5kIGZyb250bWF0dGVyIHRhZ3MgdGhhdCBhcmUgYSBwbGFpbiBzdHJpbmcgaW5zdGVhZCBvZiBhbiBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZpbGVzV2l0aFRhZyhhcHA6IEFwcCwgdGFnOiBzdHJpbmcpOiBURmlsZVtdIHtcbiAgcmV0dXJuIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkuZmlsdGVyKGZpbGUgPT4ge1xuICAgIGNvbnN0IGNhY2hlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgIGlmICghY2FjaGUpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGlubGluZVRhZ3MgPSBjYWNoZS50YWdzPy5tYXAodCA9PiB0LnRhZykgPz8gW107XG5cbiAgICBjb25zdCByYXdGbVRhZ3MgPSBjYWNoZS5mcm9udG1hdHRlcj8udGFncztcbiAgICBjb25zdCBmbVRhZ0FycmF5OiBzdHJpbmdbXSA9XG4gICAgICBBcnJheS5pc0FycmF5KHJhd0ZtVGFncykgPyByYXdGbVRhZ3MuZmlsdGVyKCh0KTogdCBpcyBzdHJpbmcgPT4gdHlwZW9mIHQgPT09ICdzdHJpbmcnKSA6XG4gICAgICB0eXBlb2YgcmF3Rm1UYWdzID09PSAnc3RyaW5nJyA/IFtyYXdGbVRhZ3NdIDpcbiAgICAgIFtdO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRGbVRhZ3MgPSBmbVRhZ0FycmF5Lm1hcCh0ID0+IHQuc3RhcnRzV2l0aCgnIycpID8gdCA6IGAjJHt0fWApO1xuXG4gICAgcmV0dXJuIGlubGluZVRhZ3MuaW5jbHVkZXModGFnKSB8fCBub3JtYWxpemVkRm1UYWdzLmluY2x1ZGVzKHRhZyk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBWYWx1ZUl0ZW0ge1xuICBlbW9qaTogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xuICBsaW5rPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVGFnR3JpZEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCd0YWctZ3JpZC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdWYWx1ZXMnLCBjb2x1bW5zID0gMiwgaXRlbXMgPSBbXSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgaXRlbXM/OiBWYWx1ZUl0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdyaWQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICd0YWctZ3JpZCcgfSk7XG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2NvbHVtbnN9LCAxZnIpYDtcblxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGdyaWQuc2V0VGV4dCgnTm8gaXRlbXMuIENvbmZpZ3VyZSBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndGFnLWJ0bicgfSk7XG4gICAgICBpZiAoaXRlbS5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ3RhZy1idG4tZW1vamknLCB0ZXh0OiBpdGVtLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpdGVtLmxhYmVsIH0pO1xuICAgICAgaWYgKGl0ZW0ubGluaykge1xuICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChpdGVtLmxpbmshLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnRuLnN0eWxlLmN1cnNvciA9ICdkZWZhdWx0JztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFZhbHVlc1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBWYWx1ZXNTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdWYWx1ZXMgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIGl0ZW1zPzogVmFsdWVJdGVtW107XG4gICAgfTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZHJhZnQuaXRlbXMpKSBkcmFmdC5pdGVtcyA9IFtdO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnVmFsdWVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMScsICcxJykuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ0l0ZW1zJywgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnIH0pO1xuXG4gICAgY29uc3QgbGlzdEVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ3ZhbHVlcy1pdGVtLWxpc3QnIH0pO1xuICAgIGNvbnN0IHJlbmRlckxpc3QgPSAoKSA9PiB7XG4gICAgICBsaXN0RWwuZW1wdHkoKTtcbiAgICAgIGRyYWZ0Lml0ZW1zIS5mb3JFYWNoKChpdGVtLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6ICd2YWx1ZXMtaXRlbS1yb3cnIH0pO1xuXG4gICAgICAgIGNvbnN0IGVtb2ppSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWVtb2ppJyB9KTtcbiAgICAgICAgZW1vamlJbnB1dC52YWx1ZSA9IGl0ZW0uZW1vamk7XG4gICAgICAgIGVtb2ppSW5wdXQucGxhY2Vob2xkZXIgPSAnXHVEODNEXHVERTAwJztcbiAgICAgICAgZW1vamlJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5lbW9qaSA9IGVtb2ppSW5wdXQudmFsdWU7IH0pO1xuXG4gICAgICAgIGNvbnN0IGxhYmVsSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWxhYmVsJyB9KTtcbiAgICAgICAgbGFiZWxJbnB1dC52YWx1ZSA9IGl0ZW0ubGFiZWw7XG4gICAgICAgIGxhYmVsSW5wdXQucGxhY2Vob2xkZXIgPSAnTGFiZWwnO1xuICAgICAgICBsYWJlbElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmxhYmVsID0gbGFiZWxJbnB1dC52YWx1ZTsgfSk7XG5cbiAgICAgICAgY29uc3QgbGlua0lucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1saW5rJyB9KTtcbiAgICAgICAgbGlua0lucHV0LnZhbHVlID0gaXRlbS5saW5rID8/ICcnO1xuICAgICAgICBsaW5rSW5wdXQucGxhY2Vob2xkZXIgPSAnTm90ZSBwYXRoIChvcHRpb25hbCknO1xuICAgICAgICBsaW5rSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0ubGluayA9IGxpbmtJbnB1dC52YWx1ZSB8fCB1bmRlZmluZWQ7IH0pO1xuXG4gICAgICAgIGNvbnN0IGRlbEJ0biA9IHJvdy5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd2YWx1ZXMtaXRlbS1kZWwnLCB0ZXh0OiAnXHUyNzE1JyB9KTtcbiAgICAgICAgZGVsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Lml0ZW1zIS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmVuZGVyTGlzdCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlzdCgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnKyBBZGQgaXRlbScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBkcmFmdC5pdGVtcyEucHVzaCh7IGVtb2ppOiAnJywgbGFiZWw6ICcnIH0pO1xuICAgICAgICByZW5kZXJMaXN0KCk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBPbmx5IGFzc2lnbiBzYWZlIENTUyBjb2xvciB2YWx1ZXM7IHJlamVjdCBwb3RlbnRpYWxseSBtYWxpY2lvdXMgc3RyaW5nc1xuY29uc3QgQ09MT1JfUkUgPSAvXigjWzAtOWEtZkEtRl17Myw4fXxbYS16QS1aXSt8cmdiYT9cXChbXildK1xcKXxoc2xhP1xcKFteKV0rXFwpKSQvO1xuXG50eXBlIFF1b3Rlc0NvbmZpZyA9IHtcbiAgc291cmNlPzogJ3RhZycgfCAndGV4dCc7XG4gIHRhZz86IHN0cmluZztcbiAgcXVvdGVzPzogc3RyaW5nO1xuICB0aXRsZT86IHN0cmluZztcbiAgY29sdW1ucz86IG51bWJlcjtcbiAgbWF4SXRlbXM/OiBudW1iZXI7XG59O1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgc291cmNlID0gJ3RhZycsIHRhZyA9ICcnLCBxdW90ZXMgPSAnJywgdGl0bGUgPSAnUXVvdGVzJywgY29sdW1ucyA9IDIsIG1heEl0ZW1zID0gMjAgfSA9XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyBRdW90ZXNDb25maWc7XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgY29sc0VsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGVzLWNvbHVtbnMnIH0pO1xuXG4gICAgY29uc3QgTUlOX0NPTF9XSURUSCA9IDIwMDtcbiAgICBjb25zdCB1cGRhdGVDb2xzID0gKCkgPT4ge1xuICAgICAgY29uc3QgdyA9IGNvbHNFbC5vZmZzZXRXaWR0aDtcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZSA9IHcgPiAwID8gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgTWF0aC5mbG9vcih3IC8gTUlOX0NPTF9XSURUSCkpKSA6IGNvbHVtbnM7XG4gICAgICBjb2xzRWwuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtlZmZlY3RpdmV9LCAxZnIpYDtcbiAgICB9O1xuICAgIHVwZGF0ZUNvbHMoKTtcbiAgICBjb25zdCBybyA9IG5ldyBSZXNpemVPYnNlcnZlcih1cGRhdGVDb2xzKTtcbiAgICByby5vYnNlcnZlKGNvbHNFbCk7XG4gICAgdGhpcy5yZWdpc3RlcigoKSA9PiByby5kaXNjb25uZWN0KCkpO1xuXG4gICAgaWYgKHNvdXJjZSA9PT0gJ3RleHQnKSB7XG4gICAgICB0aGlzLnJlbmRlclRleHRRdW90ZXMoY29sc0VsLCBxdW90ZXMsIG1heEl0ZW1zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBzb3VyY2UgPT09ICd0YWcnXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbHNFbC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbmRlciBxdW90ZXMgZnJvbSBwbGFpbiB0ZXh0LiBFYWNoIHF1b3RlIGlzIHNlcGFyYXRlZCBieSBgLS0tYCBvbiBpdHMgb3duIGxpbmUuXG4gICAqIE9wdGlvbmFsbHkgYSBzb3VyY2UgbGluZSBjYW4gZm9sbG93IHRoZSBxdW90ZSB0ZXh0LCBwcmVmaXhlZCB3aXRoIGBcdTIwMTRgLCBgXHUyMDEzYCwgb3IgYC0tYC5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICogICBUaGUgb25seSB3YXkgdG8gZG8gZ3JlYXQgd29yayBpcyB0byBsb3ZlIHdoYXQgeW91IGRvLlxuICAgKiAgIFx1MjAxNCBTdGV2ZSBKb2JzXG4gICAqICAgLS0tXG4gICAqICAgSW4gdGhlIG1pZGRsZSBvZiBkaWZmaWN1bHR5IGxpZXMgb3Bwb3J0dW5pdHkuXG4gICAqICAgXHUyMDE0IEFsYmVydCBFaW5zdGVpblxuICAgKi9cbiAgcHJpdmF0ZSByZW5kZXJUZXh0UXVvdGVzKGNvbHNFbDogSFRNTEVsZW1lbnQsIHJhdzogc3RyaW5nLCBtYXhJdGVtczogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCFyYXcudHJpbSgpKSB7XG4gICAgICBjb2xzRWwuc2V0VGV4dCgnQWRkIHF1b3RlcyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBibG9ja3MgPSByYXcuc3BsaXQoL1xcbi0tLVxcbi8pLm1hcChiID0+IGIudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gYmxvY2suc3BsaXQoJ1xcbicpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgaGFzU291cmNlID0gbGluZXMubGVuZ3RoID4gMSAmJiAvXihcdTIwMTR8XHUyMDEzfC0tKS8udGVzdChsYXN0TGluZSk7XG4gICAgICBjb25zdCBzb3VyY2VUZXh0ID0gaGFzU291cmNlID8gbGFzdExpbmUucmVwbGFjZSgvXihcdTIwMTR8XHUyMDEzfC0tKVxccyovLCAnJykgOiAnJztcbiAgICAgIGNvbnN0IGJvZHlMaW5lcyA9IGhhc1NvdXJjZSA/IGxpbmVzLnNsaWNlKDAsIC0xKSA6IGxpbmVzO1xuICAgICAgY29uc3QgYm9keSA9IGJvZHlMaW5lcy5qb2luKCcgJyk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG4gICAgICBpZiAoc291cmNlVGV4dCkgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBzb3VyY2VUZXh0IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBFeHRyYWN0IHRoZSBmaXJzdCBmZXcgbGluZXMgb2YgYm9keSBjb250ZW50IHVzaW5nIG1ldGFkYXRhQ2FjaGUgZnJvbnRtYXR0ZXIgb2Zmc2V0LiAqL1xuICBwcml2YXRlIGV4dHJhY3RCb2R5KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcbiAgICBjb25zdCBsaW5lcyA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSk7XG4gICAgcmV0dXJuIGxpbmVzLnNsaWNlKDAsIDMpLmpvaW4oJyAnKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgUXVvdGVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFF1b3Rlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1b3RlcyBMaXN0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyBRdW90ZXNDb25maWc7XG4gICAgZHJhZnQuc291cmNlID8/PSAndGFnJztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBTb3VyY2UgdG9nZ2xlIFx1MjAxNCBzaG93cy9oaWRlcyB0aGUgcmVsZXZhbnQgc2VjdGlvblxuICAgIGxldCB0YWdTZWN0aW9uOiBIVE1MRWxlbWVudDtcbiAgICBsZXQgdGV4dFNlY3Rpb246IEhUTUxFbGVtZW50O1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1NvdXJjZScpXG4gICAgICAuc2V0RGVzYygnUHVsbCBxdW90ZXMgZnJvbSB0YWdnZWQgbm90ZXMsIG9yIGVudGVyIHRoZW0gbWFudWFsbHkuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd0YWcnLCAnTm90ZXMgd2l0aCB0YWcnKVxuICAgICAgICAgLmFkZE9wdGlvbigndGV4dCcsICdNYW51YWwgdGV4dCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuc291cmNlID8/ICd0YWcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4ge1xuICAgICAgICAgICBkcmFmdC5zb3VyY2UgPSB2IGFzICd0YWcnIHwgJ3RleHQnO1xuICAgICAgICAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBUYWcgc2VjdGlvblxuICAgIHRhZ1NlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgIG5ldyBTZXR0aW5nKHRhZ1NlY3Rpb24pLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFRleHQgc2VjdGlvblxuICAgIHRleHRTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgIGNvbnN0IHRleHRTZXR0aW5nID0gbmV3IFNldHRpbmcodGV4dFNlY3Rpb24pXG4gICAgICAuc2V0TmFtZSgnUXVvdGVzJylcbiAgICAgIC5zZXREZXNjKCdTZXBhcmF0ZSBxdW90ZXMgd2l0aCAtLS0gb24gaXRzIG93biBsaW5lLiBBZGQgYSBzb3VyY2UgbGluZSBzdGFydGluZyB3aXRoIFx1MjAxNCAoZS5nLiBcdTIwMTQgQXV0aG9yKS4nKTtcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdjb2x1bW4nO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5hbGlnbkl0ZW1zID0gJ3N0cmV0Y2gnO1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGV4dFNldHRpbmcuc2V0dGluZ0VsLmNyZWF0ZUVsKCd0ZXh0YXJlYScpO1xuICAgIHRleHRhcmVhLnJvd3MgPSA4O1xuICAgIHRleHRhcmVhLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIHRleHRhcmVhLnN0eWxlLm1hcmdpblRvcCA9ICc4cHgnO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRGYW1pbHkgPSAndmFyKC0tZm9udC1tb25vc3BhY2UpJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LnF1b3RlcyA/PyAnJztcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQucXVvdGVzID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+XG4gICAgICBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQge1xuICAgIHRoaXMub25DaG9vc2UoZm9sZGVyKTtcbiAgfVxufVxuXG5jb25zdCBJTUFHRV9FWFRTID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy53ZWJwJywgJy5zdmcnXSk7XG5jb25zdCBWSURFT19FWFRTID0gbmV3IFNldChbJy5tcDQnLCAnLndlYm0nLCAnLm1vdicsICcubWt2J10pO1xuXG5leHBvcnQgY2xhc3MgSW1hZ2VHYWxsZXJ5QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2ltYWdlLWdhbGxlcnktYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW1hZ2VHYWxsZXJ5QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgZ2FsbGVyeS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZvbGRlciA9ICcnLCB0aXRsZSA9ICdHYWxsZXJ5JywgY29sdW1ucyA9IDMsIG1heEl0ZW1zID0gMjAgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIG1heEl0ZW1zPzogbnVtYmVyO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ2FsbGVyeSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ltYWdlLWdhbGxlcnknIH0pO1xuICAgIGdhbGxlcnkuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoYXV0by1maWxsLCBtaW5tYXgobWF4KDcwcHgsIGNhbGMoMTAwJSAvICR7Y29sdW1uc30pKSwgMWZyKSlgO1xuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBlbC5zZXRUZXh0KCdDb25maWd1cmUgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSB0ZXh0IGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdDb25maWd1cmUgSFRNTCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlC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cEIsUUFBUSx5QkFBeUIsRUFDakMsUUFBUSxzRUFBc0UsRUFDOUU7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLGNBQWMsRUFBRSxXQUFXLEVBQUUsUUFBUSxZQUFZO0FBQ2pFLGNBQU0sS0FBSyxPQUFPLFdBQVcsaUJBQWlCLENBQUM7QUFDL0MsbUJBQVcsUUFBUSxLQUFLLElBQUksVUFBVSxnQkFBZ0IsU0FBUyxHQUFHO0FBQ2hFLGNBQUksS0FBSyxnQkFBZ0IsY0FBYztBQUNyQyxrQkFBTSxLQUFLLEtBQUssT0FBTztBQUFBLFVBQ3pCO0FBQUEsUUFDRjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNKO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiRm9sZGVyU3VnZ2VzdE1vZGFsIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIl0KfQo=
