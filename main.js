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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVmFsdWVzJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnVmFsdWVzJywgY29sdW1uczogMiwgaXRlbXM6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMiB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFRhZ0dyaWRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgIGRpc3BsYXlOYW1lOiAnUXVvdGVzIExpc3QnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgUXVvdGVzTGlzdEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbWFnZS1nYWxsZXJ5JyxcbiAgICBkaXNwbGF5TmFtZTogJ0ltYWdlIEdhbGxlcnknLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMywgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEltYWdlR2FsbGVyeUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdlbWJlZGRlZC1ub3RlJyxcbiAgICBkaXNwbGF5TmFtZTogJ0VtYmVkZGVkIE5vdGUnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZmlsZVBhdGg6ICcnLCBzaG93VGl0bGU6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgRW1iZWRkZWROb3RlQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3N0YXRpYy10ZXh0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1N0YXRpYyBUZXh0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgY29udGVudDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgU3RhdGljVGV4dEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdodG1sJyxcbiAgICBkaXNwbGF5TmFtZTogJ0hUTUwgQmxvY2snLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBodG1sOiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBIdG1sQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEhvbWVwYWdlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIGltcGxlbWVudHMgSUhvbWVwYWdlUGx1Z2luIHtcbiAgbGF5b3V0OiBMYXlvdXRDb25maWcgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJlZ2lzdGVyQmxvY2tzKCk7XG5cbiAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCkgYXMgdW5rbm93bjtcbiAgICB0aGlzLmxheW91dCA9IHZhbGlkYXRlTGF5b3V0KHJhdyk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmKSA9PiBuZXcgSG9tZXBhZ2VWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4taG9tZXBhZ2UnLFxuICAgICAgbmFtZTogJ09wZW4gSG9tZXBhZ2UnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHsgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpOyB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdob21lJywgJ09wZW4gSG9tZXBhZ2UnLCAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSk7XG5cbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEhvbWVwYWdlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMubGF5b3V0Lm9wZW5PblN0YXJ0dXApIHtcbiAgICAgICAgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb251bmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZUxheW91dChsYXlvdXQ6IExheW91dENvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGF5b3V0ID0gbGF5b3V0O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEobGF5b3V0KTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5Ib21lcGFnZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyB0YWIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEhvbWVwYWdlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IEhvbWVwYWdlUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSG9tZXBhZ2UgQmxvY2tzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ09wZW4gb24gc3RhcnR1cCcpXG4gICAgICAuc2V0RGVzYygnQXV0b21hdGljYWxseSBvcGVuIHRoZSBob21lcGFnZSB3aGVuIE9ic2lkaWFuIHN0YXJ0cy4nKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRGVmYXVsdCBjb2x1bW5zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZCBsYXlvdXQuJylcbiAgICAgIC5hZGREcm9wZG93bihkcm9wID0+XG4gICAgICAgIGRyb3BcbiAgICAgICAgICAuYWRkT3B0aW9uKCcyJywgJzIgY29sdW1ucycpXG4gICAgICAgICAgLmFkZE9wdGlvbignMycsICczIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzQnLCAnNCBjb2x1bW5zJylcbiAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyA9IE51bWJlcih2YWx1ZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUmVzZXQgdG8gZGVmYXVsdCBsYXlvdXQnKVxuICAgICAgLnNldERlc2MoJ1Jlc3RvcmUgYWxsIGJsb2NrcyB0byB0aGUgb3JpZ2luYWwgZGVmYXVsdCBsYXlvdXQuIENhbm5vdCBiZSB1bmRvbmUuJylcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZXNldCBsYXlvdXQnKS5zZXRXYXJuaW5nKCkub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChnZXREZWZhdWx0TGF5b3V0KCkpO1xuICAgICAgICAgIGZvciAoY29uc3QgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkpIHtcbiAgICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgICAgYXdhaXQgbGVhZi52aWV3LnJlbG9hZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBJSG9tZXBhZ2VQbHVnaW4sIExheW91dENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5pbXBvcnQgeyBFZGl0VG9vbGJhciB9IGZyb20gJy4vRWRpdFRvb2xiYXInO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFID0gJ2hvbWVwYWdlLWJsb2Nrcyc7XG5cbmV4cG9ydCBjbGFzcyBIb21lcGFnZVZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRvb2xiYXI6IEVkaXRUb29sYmFyIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIFZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gJ0hvbWVwYWdlJzsgfVxuICBnZXRJY29uKCk6IHN0cmluZyB7IHJldHVybiAnaG9tZSc7IH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gRnVsbCB0ZWFyZG93bjogdW5sb2FkcyBibG9ja3MgQU5EIHJlbW92ZXMgdGhlIGdyaWQgRE9NIGVsZW1lbnRcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcblxuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcygnaG9tZXBhZ2UtdmlldycpO1xuXG4gICAgY29uc3QgbGF5b3V0OiBMYXlvdXRDb25maWcgPSB0aGlzLnBsdWdpbi5sYXlvdXQ7XG5cbiAgICBjb25zdCBvbkxheW91dENoYW5nZSA9IChuZXdMYXlvdXQ6IExheW91dENvbmZpZykgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0ID0gbmV3TGF5b3V0O1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KG5ld0xheW91dCk7XG4gICAgfTtcblxuICAgIHRoaXMuZ3JpZCA9IG5ldyBHcmlkTGF5b3V0KGNvbnRlbnRFbCwgdGhpcy5hcHAsIHRoaXMucGx1Z2luLCBvbkxheW91dENoYW5nZSk7XG5cbiAgICB0aGlzLnRvb2xiYXIgPSBuZXcgRWRpdFRvb2xiYXIoXG4gICAgICBjb250ZW50RWwsXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgdGhpcy5ncmlkLFxuICAgICAgKGNvbHVtbnMpID0+IHsgdGhpcy5ncmlkPy5zZXRDb2x1bW5zKGNvbHVtbnMpOyB9LFxuICAgICk7XG5cbiAgICAvLyBUb29sYmFyIG11c3QgYXBwZWFyIGFib3ZlIHRoZSBncmlkIGluIHRoZSBmbGV4LWNvbHVtbiBsYXlvdXRcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuXG4gICAgdGhpcy5ncmlkLnJlbmRlcihsYXlvdXQuYmxvY2tzLCBsYXlvdXQuY29sdW1ucyk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZ3JpZD8uZGVzdHJveSgpO1xuICAgIHRoaXMudG9vbGJhcj8uZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZWZmZWN0aXZlQ29sdW1ucyA9IDM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0VmZmVjdGl2ZSA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnModGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgICAgaWYgKG5ld0VmZmVjdGl2ZSAhPT0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5ncmlkRWwpO1xuICB9XG5cbiAgLyoqIEV4cG9zZSB0aGUgcm9vdCBncmlkIGVsZW1lbnQgc28gSG9tZXBhZ2VWaWV3IGNhbiByZW9yZGVyIGl0IGluIHRoZSBET00uICovXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmdyaWRFbDtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMobGF5b3V0Q29sdW1uczogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCB3ID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGg7XG4gICAgaWYgKHcgPiAwICYmIHcgPD0gNTQwKSByZXR1cm4gMTtcbiAgICBpZiAodyA+IDAgJiYgdyA8PSA4NDApIHJldHVybiBNYXRoLm1pbigyLCBsYXlvdXRDb2x1bW5zKTtcbiAgICByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwuZW1wdHkoKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZCcpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSBibG9ja3MnKTtcbiAgICB0aGlzLmVmZmVjdGl2ZUNvbHVtbnMgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGNvbHVtbnMpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmFkZENsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ncmlkRWwucmVtb3ZlQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH1cblxuICAgIGlmIChibG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eSA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWVtcHR5LXN0YXRlJyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnTm8gYmxvY2tzIHlldC4gQ2xpY2sgRWRpdCB0byBhZGQgeW91ciBmaXJzdCBibG9jay4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgYmxvY2tzKSB7XG4gICAgICB0aGlzLnJlbmRlckJsb2NrKGluc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KGluc3RhbmNlLnR5cGUpO1xuICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZGNlbGwnKTtcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGZhY3RvcnkuZGlzcGxheU5hbWUpO1xuICAgIHRoaXMuYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlciwgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIC8vIEhlYWRlciB6b25lIFx1MjAxNCBhbHdheXMgdmlzaWJsZTsgaG91c2VzIHRpdGxlICsgY29sbGFwc2UgY2hldnJvblxuICAgIGNvbnN0IGhlYWRlclpvbmUgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhlYWRlci16b25lJyB9KTtcbiAgICBjb25zdCBjaGV2cm9uID0gaGVhZGVyWm9uZS5jcmVhdGVTcGFuKHsgY2xzOiAnYmxvY2stY29sbGFwc2UtY2hldnJvbicgfSk7XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2suc2V0SGVhZGVyQ29udGFpbmVyKGhlYWRlclpvbmUpO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5jb2xsYXBzZWQpIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWNvbGxhcHNlZCcpO1xuXG4gICAgaGVhZGVyWm9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgaXNOb3dDb2xsYXBzZWQgPSAhd3JhcHBlci5oYXNDbGFzcygnYmxvY2stY29sbGFwc2VkJyk7XG4gICAgICB3cmFwcGVyLnRvZ2dsZUNsYXNzKCdibG9jay1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjaGV2cm9uLnRvZ2dsZUNsYXNzKCdpcy1jb2xsYXBzZWQnLCBpc05vd0NvbGxhcHNlZCk7XG4gICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgIGIuaWQgPT09IGluc3RhbmNlLmlkID8geyAuLi5iLCBjb2xsYXBzZWQ6IGlzTm93Q29sbGFwc2VkIH0gOiBiLFxuICAgICAgKTtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoaW5zdGFuY2UuY29sbGFwc2VkKSBjaGV2cm9uLmFkZENsYXNzKCdpcy1jb2xsYXBzZWQnKTtcblxuICAgIHRoaXMuYmxvY2tzLnNldChpbnN0YW5jZS5pZCwgeyBibG9jaywgd3JhcHBlciB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgY29scyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oaW5zdGFuY2UuY29sU3BhbiwgY29scyk7XG4gICAgLy8gZmxleC1ncm93IHByb3BvcnRpb25hbCB0byBjb2xTcGFuIHNvIHdyYXBwZWQgaXRlbXMgc3RyZXRjaCB0byBmaWxsIHRoZSByb3dcbiAgICBjb25zdCBiYXNpc1BlcmNlbnQgPSAoY29sU3BhbiAvIGNvbHMpICogMTAwO1xuICAgIHdyYXBwZXIuc3R5bGUuZmxleCA9IGAke2NvbFNwYW59IDAgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSlgO1xuICAgIHdyYXBwZXIuc3R5bGUubWluV2lkdGggPSAnMCc7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBjb25zdCBvblNhdmUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG4gICAgICBuZXcgQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCBpbnN0YW5jZSwgZW50cnkuYmxvY2ssIG9uU2F2ZSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlwID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1yZXNpemUtZ3JpcCcgfSk7XG4gICAgc2V0SWNvbihncmlwLCAnbWF4aW1pemUtMicpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgdGhpcy5hdHRhY2hSZXNpemVIYW5kbGVyKGdyaXAsIHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIHRoaXMuYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZTogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3QgY2xvbmUgPSB3cmFwcGVyLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIDIwfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGluc3RhbmNlLmlkO1xuICAgICAgd3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke21lLmNsaWVudFggLSAyMH1weGA7XG4gICAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke21lLmNsaWVudFkgLSAyMH1weGA7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5ibG9ja3MuZ2V0KHRhcmdldElkKT8ud3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjbG9uZS5yZW1vdmUoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG4gICAgICAgIHdyYXBwZXIucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXRJZCA9IHRoaXMuZmluZEJsb2NrVW5kZXJDdXJzb3IobWUuY2xpZW50WCwgbWUuY2xpZW50WSwgc291cmNlSWQpO1xuICAgICAgICBpZiAodGFyZ2V0SWQpIHtcbiAgICAgICAgICB0aGlzLnN3YXBCbG9ja3Moc291cmNlSWQsIHRhcmdldElkKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjdXJyZW50Q29sU3BhbiAvIGNvbHVtbnMpICogMTAwO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMCBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpKWA7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlVXAgPSAoKSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbFNwYW46IGN1cnJlbnRDb2xTcGFuIH0gOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQmxvY2tVbmRlckN1cnNvcih4OiBudW1iZXIsIHk6IG51bWJlciwgZXhjbHVkZUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IFtpZCwgeyB3cmFwcGVyIH1dIG9mIHRoaXMuYmxvY2tzKSB7XG4gICAgICBpZiAoaWQgPT09IGV4Y2x1ZGVJZCkgY29udGludWU7XG4gICAgICBjb25zdCByZWN0ID0gd3JhcHBlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKiogU3dhcCBwb3NpdGlvbnMgb2YgdHdvIGJsb2NrcyB1c2luZyBpbW11dGFibGUgdXBkYXRlcy4gKi9cbiAgcHJpdmF0ZSBzd2FwQmxvY2tzKGlkQTogc3RyaW5nLCBpZEI6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGJBID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRBKTtcbiAgICBjb25zdCBiQiA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmluZChiID0+IGIuaWQgPT09IGlkQik7XG4gICAgaWYgKCFiQSB8fCAhYkIpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgaWYgKGIuaWQgPT09IGlkQSkgcmV0dXJuIHsgLi4uYiwgY29sOiBiQi5jb2wsIHJvdzogYkIucm93LCBjb2xTcGFuOiBiQi5jb2xTcGFuLCByb3dTcGFuOiBiQi5yb3dTcGFuIH07XG4gICAgICBpZiAoYi5pZCA9PT0gaWRCKSByZXR1cm4geyAuLi5iLCBjb2w6IGJBLmNvbCwgcm93OiBiQS5yb3csIGNvbFNwYW46IGJBLmNvbFNwYW4sIHJvd1NwYW46IGJBLnJvd1NwYW4gfTtcbiAgICAgIHJldHVybiBiO1xuICAgIH0pO1xuXG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0RWRpdE1vZGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZWRpdE1vZGUgPSBlbmFibGVkO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGUgY29sdW1uIGNvdW50LCBjbGFtcGluZyBlYWNoIGJsb2NrJ3MgY29sIGFuZCBjb2xTcGFuIHRvIGZpdC4gKi9cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGNvbnN0IGNvbCA9IE1hdGgubWluKGIuY29sLCBuKTtcbiAgICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihiLmNvbFNwYW4sIG4gLSBjb2wgKyAxKTtcbiAgICAgIHJldHVybiB7IC4uLmIsIGNvbCwgY29sU3BhbiB9O1xuICAgIH0pO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGNvbHVtbnM6IG4sIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGZvY3VzZWQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGZvY3VzZWRCbG9ja0lkID0gKGZvY3VzZWQ/LmNsb3Nlc3QoJ1tkYXRhLWJsb2NrLWlkXScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuYmxvY2tJZDtcbiAgICB0aGlzLnJlbmRlcih0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG4gICAgaWYgKGZvY3VzZWRCbG9ja0lkKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1ibG9jay1pZD1cIiR7Zm9jdXNlZEJsb2NrSWR9XCJdYCk7XG4gICAgICBlbD8uZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICAvKiogVW5sb2FkIGFsbCBibG9ja3MgYW5kIGNhbmNlbCBhbnkgaW4tcHJvZ3Jlc3MgZHJhZy9yZXNpemUuICovXG4gIGRlc3Ryb3lBbGwoKTogdm9pZCB7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmU/LnJlbW92ZSgpO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG51bGw7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIHNldHRpbmdzIG1vZGFsICh0aXRsZSBzZWN0aW9uICsgYmxvY2stc3BlY2lmaWMgc2V0dGluZ3MpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vLyBbZW1vamksIHNlYXJjaCBrZXl3b3Jkc10gXHUyMDE0IDE3MCBtb3N0IGNvbW1vbi91c2VmdWxcbmNvbnN0IEVNT0pJX1BJQ0tFUl9TRVQ6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgLy8gU21pbGV5cyAmIGVtb3Rpb25cbiAgWydcdUQ4M0RcdURFMDAnLCdoYXBweSBzbWlsZSBncmluJ10sWydcdUQ4M0RcdURFMEEnLCdzbWlsZSBibHVzaCBoYXBweSddLFsnXHVEODNEXHVERTAyJywnbGF1Z2ggY3J5IGZ1bm55IGpveSddLFxuICBbJ1x1RDgzRVx1REQ3MicsJ3RlYXIgc21pbGUgZ3JhdGVmdWwnXSxbJ1x1RDgzRFx1REUwRCcsJ2hlYXJ0IGV5ZXMgbG92ZSddLFsnXHVEODNFXHVERDI5Jywnc3RhciBleWVzIGV4Y2l0ZWQnXSxcbiAgWydcdUQ4M0RcdURFMEUnLCdjb29sIHN1bmdsYXNzZXMnXSxbJ1x1RDgzRVx1REQxNCcsJ3RoaW5raW5nIGhtbSddLFsnXHVEODNEXHVERTA1Jywnc3dlYXQgbmVydm91cyBsYXVnaCddLFxuICBbJ1x1RDgzRFx1REUyMicsJ2NyeSBzYWQgdGVhciddLFsnXHVEODNEXHVERTI0JywnYW5ncnkgaHVmZiBmcnVzdHJhdGVkJ10sWydcdUQ4M0VcdURENzMnLCdwYXJ0eSBjZWxlYnJhdGUnXSxcbiAgWydcdUQ4M0RcdURFMzQnLCdzbGVlcCB0aXJlZCB6enonXSxbJ1x1RDgzRVx1REQyRicsJ21pbmQgYmxvd24gZXhwbG9kZSddLFsnXHVEODNFXHVERUUxJywnc2FsdXRlIHJlc3BlY3QnXSxcbiAgLy8gUGVvcGxlICYgZ2VzdHVyZXNcbiAgWydcdUQ4M0RcdURDNEInLCd3YXZlIGhlbGxvIGJ5ZSddLFsnXHVEODNEXHVEQzREJywndGh1bWJzIHVwIGdvb2Qgb2snXSxbJ1x1RDgzRFx1REM0RScsJ3RodW1icyBkb3duIGJhZCddLFxuICBbJ1x1MjcwQycsJ3ZpY3RvcnkgcGVhY2UnXSxbJ1x1RDgzRVx1REQxRCcsJ2hhbmRzaGFrZSBkZWFsJ10sWydcdUQ4M0RcdURFNEYnLCdwcmF5IHRoYW5rcyBwbGVhc2UnXSxcbiAgWydcdUQ4M0RcdURDQUEnLCdtdXNjbGUgc3Ryb25nIGZsZXgnXSxbJ1x1RDgzRFx1REM0MScsJ2V5ZSB3YXRjaCBzZWUnXSxbJ1x1RDgzRVx1RERFMCcsJ2JyYWluIG1pbmQgdGhpbmsnXSxcbiAgWydcdTI3NjQnLCdoZWFydCBsb3ZlIHJlZCddLFsnXHVEODNFXHVEREUxJywnb3JhbmdlIGhlYXJ0J10sWydcdUQ4M0RcdURDOUInLCd5ZWxsb3cgaGVhcnQnXSxcbiAgWydcdUQ4M0RcdURDOUEnLCdncmVlbiBoZWFydCddLFsnXHVEODNEXHVEQzk5JywnYmx1ZSBoZWFydCddLFsnXHVEODNEXHVEQzlDJywncHVycGxlIGhlYXJ0J10sWydcdUQ4M0RcdUREQTQnLCdibGFjayBoZWFydCddLFxuICAvLyBOYXR1cmVcbiAgWydcdUQ4M0NcdURGMzEnLCdzZWVkbGluZyBzcHJvdXQgZ3JvdyddLFsnXHVEODNDXHVERjNGJywnaGVyYiBsZWFmIGdyZWVuIG5hdHVyZSddLFsnXHVEODNDXHVERjQwJywnY2xvdmVyIGx1Y2snXSxcbiAgWydcdUQ4M0NcdURGMzgnLCdibG9zc29tIGZsb3dlciBwaW5rJ10sWydcdUQ4M0NcdURGM0EnLCdmbG93ZXIgaGliaXNjdXMnXSxbJ1x1RDgzQ1x1REYzQicsJ3N1bmZsb3dlciddLFxuICBbJ1x1RDgzQ1x1REY0MicsJ2F1dHVtbiBmYWxsIGxlYWYnXSxbJ1x1RDgzQ1x1REYwQScsJ3dhdmUgb2NlYW4gd2F0ZXIgc2VhJ10sWydcdUQ4M0RcdUREMjUnLCdmaXJlIGZsYW1lIGhvdCddLFxuICBbJ1x1Mjc0NCcsJ3Nub3dmbGFrZSBjb2xkIGljZSB3aW50ZXInXSxbJ1x1MjZBMScsJ2xpZ2h0bmluZyBib2x0IGVuZXJneSddLFsnXHVEODNDXHVERjA4JywncmFpbmJvdyddLFxuICBbJ1x1MjYwMCcsJ3N1biBzdW5ueSBicmlnaHQnXSxbJ1x1RDgzQ1x1REYxOScsJ21vb24gbmlnaHQgY3Jlc2NlbnQnXSxbJ1x1MkI1MCcsJ3N0YXIgZmF2b3JpdGUnXSxcbiAgWydcdUQ4M0NcdURGMUYnLCdnbG93aW5nIHN0YXIgc2hpbmUnXSxbJ1x1MjcyOCcsJ3NwYXJrbGVzIHNoaW5lIG1hZ2ljJ10sWydcdUQ4M0NcdURGRDQnLCdtb3VudGFpbiBwZWFrJ10sXG4gIFsnXHVEODNDXHVERjBEJywnZWFydGggZ2xvYmUgd29ybGQnXSxbJ1x1RDgzQ1x1REYxMCcsJ2dsb2JlIGludGVybmV0IHdlYiddLFxuICAvLyBGb29kICYgb2JqZWN0c1xuICBbJ1x1MjYxNScsJ2NvZmZlZSB0ZWEgaG90IGRyaW5rJ10sWydcdUQ4M0NcdURGNzUnLCd0ZWEgY3VwIGhvdCddLFsnXHVEODNDXHVERjdBJywnYmVlciBkcmluayddLFxuICBbJ1x1RDgzQ1x1REY0RScsJ2FwcGxlIGZydWl0IHJlZCddLFsnXHVEODNDXHVERjRCJywnbGVtb24geWVsbG93IHNvdXInXSxbJ1x1RDgzQ1x1REY4MicsJ2Nha2UgYmlydGhkYXknXSxcbiAgLy8gQWN0aXZpdGllcyAmIHNwb3J0c1xuICBbJ1x1RDgzQ1x1REZBRicsJ3RhcmdldCBidWxsc2V5ZSBnb2FsJ10sWydcdUQ4M0NcdURGQzYnLCd0cm9waHkgYXdhcmQgd2luJ10sWydcdUQ4M0VcdURENDcnLCdtZWRhbCBnb2xkIGZpcnN0J10sXG4gIFsnXHVEODNDXHVERkFFJywnZ2FtZSBjb250cm9sbGVyIHBsYXknXSxbJ1x1RDgzQ1x1REZBOCcsJ2FydCBwYWxldHRlIGNyZWF0aXZlIHBhaW50J10sWydcdUQ4M0NcdURGQjUnLCdtdXNpYyBub3RlIHNvbmcnXSxcbiAgWydcdUQ4M0NcdURGQUMnLCdjbGFwcGVyIGZpbG0gbW92aWUnXSxbJ1x1RDgzRFx1RENGNycsJ2NhbWVyYSBwaG90byddLFsnXHVEODNDXHVERjgxJywnZ2lmdCBwcmVzZW50J10sXG4gIFsnXHVEODNDXHVERkIyJywnZGljZSBnYW1lIHJhbmRvbSddLFsnXHVEODNFXHVEREU5JywncHV6emxlIHBpZWNlJ10sWydcdUQ4M0NcdURGQUQnLCd0aGVhdGVyIG1hc2tzJ10sXG4gIC8vIFRyYXZlbCAmIHBsYWNlc1xuICBbJ1x1RDgzRFx1REU4MCcsJ3JvY2tldCBsYXVuY2ggc3BhY2UnXSxbJ1x1MjcwOCcsJ2FpcnBsYW5lIHRyYXZlbCBmbHknXSxbJ1x1RDgzRFx1REU4MicsJ3RyYWluIHRyYXZlbCddLFxuICBbJ1x1RDgzQ1x1REZFMCcsJ2hvdXNlIGhvbWUnXSxbJ1x1RDgzQ1x1REZEOScsJ2NpdHkgYnVpbGRpbmcnXSxbJ1x1RDgzQ1x1REYwNicsJ2NpdHkgc3Vuc2V0J10sXG4gIC8vIE9iamVjdHMgJiB0b29sc1xuICBbJ1x1RDgzRFx1RENDMScsJ2ZvbGRlciBkaXJlY3RvcnknXSxbJ1x1RDgzRFx1RENDMicsJ29wZW4gZm9sZGVyJ10sWydcdUQ4M0RcdURDQzQnLCdkb2N1bWVudCBwYWdlIGZpbGUnXSxcbiAgWydcdUQ4M0RcdURDREQnLCdtZW1vIHdyaXRlIG5vdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NCJywnY2xpcGJvYXJkIGNvcHknXSxbJ1x1RDgzRFx1RENDQycsJ3B1c2hwaW4gcGluJ10sXG4gIFsnXHVEODNEXHVEQ0NEJywnbG9jYXRpb24gcGluIG1hcCddLFsnXHVEODNEXHVERDE2JywnYm9va21hcmsgc2F2ZSddLFsnXHVEODNEXHVEREMyJywnaW5kZXggZGl2aWRlcnMnXSxcbiAgWydcdUQ4M0RcdURDQzUnLCdjYWxlbmRhciBkYXRlIHNjaGVkdWxlJ10sWydcdUQ4M0RcdURERDMnLCdjYWxlbmRhciBzcGlyYWwnXSxbJ1x1MjNGMCcsJ2FsYXJtIGNsb2NrIHRpbWUgd2FrZSddLFxuICBbJ1x1RDgzRFx1REQ1MCcsJ2Nsb2NrIHRpbWUgaG91ciddLFsnXHUyM0YxJywnc3RvcHdhdGNoIHRpbWVyJ10sWydcdUQ4M0RcdURDQ0EnLCdjaGFydCBiYXIgZGF0YSddLFxuICBbJ1x1RDgzRFx1RENDOCcsJ2NoYXJ0IHVwIGdyb3d0aCB0cmVuZCddLFsnXHVEODNEXHVEQ0M5JywnY2hhcnQgZG93biBkZWNsaW5lJ10sXG4gIFsnXHVEODNEXHVEQ0ExJywnaWRlYSBsaWdodCBidWxiIGluc2lnaHQnXSxbJ1x1RDgzRFx1REQwRCcsJ3NlYXJjaCBtYWduaWZ5IHpvb20nXSxbJ1x1RDgzRFx1REQxNycsJ2xpbmsgY2hhaW4gdXJsJ10sXG4gIFsnXHVEODNEXHVEQ0UyJywnbG91ZHNwZWFrZXIgYW5ub3VuY2UnXSxbJ1x1RDgzRFx1REQxNCcsJ2JlbGwgbm90aWZpY2F0aW9uIGFsZXJ0J10sXG4gIFsnXHVEODNEXHVEQ0FDJywnc3BlZWNoIGJ1YmJsZSBjaGF0IG1lc3NhZ2UnXSxbJ1x1RDgzRFx1RENBRCcsJ3Rob3VnaHQgdGhpbmsgYnViYmxlJ10sXG4gIFsnXHVEODNEXHVEQ0RBJywnYm9va3Mgc3R1ZHkgbGlicmFyeSddLFsnXHVEODNEXHVEQ0Q2Jywnb3BlbiBib29rIHJlYWQnXSxbJ1x1RDgzRFx1RENEQycsJ3Njcm9sbCBkb2N1bWVudCddLFxuICBbJ1x1MjcwOScsJ2VudmVsb3BlIGVtYWlsIGxldHRlciddLFsnXHVEODNEXHVEQ0U3JywnZW1haWwgbWVzc2FnZSddLFsnXHVEODNEXHVEQ0U1JywnaW5ib3ggZG93bmxvYWQnXSxcbiAgWydcdUQ4M0RcdURDRTQnLCdvdXRib3ggdXBsb2FkIHNlbmQnXSxbJ1x1RDgzRFx1REREMScsJ3RyYXNoIGRlbGV0ZSByZW1vdmUnXSxcbiAgLy8gVGVjaFxuICBbJ1x1RDgzRFx1RENCQicsJ2xhcHRvcCBjb21wdXRlciBjb2RlJ10sWydcdUQ4M0RcdUREQTUnLCdkZXNrdG9wIG1vbml0b3Igc2NyZWVuJ10sWydcdUQ4M0RcdURDRjEnLCdwaG9uZSBtb2JpbGUnXSxcbiAgWydcdTIzMjgnLCdrZXlib2FyZCB0eXBlJ10sWydcdUQ4M0RcdUREQjEnLCdtb3VzZSBjdXJzb3IgY2xpY2snXSxbJ1x1RDgzRFx1RENFMScsJ3NhdGVsbGl0ZSBhbnRlbm5hIHNpZ25hbCddLFxuICBbJ1x1RDgzRFx1REQwQycsJ3BsdWcgcG93ZXIgZWxlY3RyaWMnXSxbJ1x1RDgzRFx1REQwQicsJ2JhdHRlcnkgcG93ZXIgY2hhcmdlJ10sWydcdUQ4M0RcdURDQkUnLCdmbG9wcHkgZGlzayBzYXZlJ10sXG4gIFsnXHVEODNEXHVEQ0JGJywnZGlzYyBjZCBkdmQnXSxbJ1x1RDgzRFx1RERBOCcsJ3ByaW50ZXIgcHJpbnQnXSxcbiAgLy8gU3ltYm9scyAmIHN0YXR1c1xuICBbJ1x1MjcwNScsJ2NoZWNrIGRvbmUgY29tcGxldGUgeWVzJ10sWydcdTI3NEMnLCdjcm9zcyBlcnJvciB3cm9uZyBubyBkZWxldGUnXSxcbiAgWydcdTI2QTAnLCd3YXJuaW5nIGNhdXRpb24gYWxlcnQnXSxbJ1x1Mjc1MycsJ3F1ZXN0aW9uIG1hcmsnXSxbJ1x1Mjc1NycsJ2V4Y2xhbWF0aW9uIGltcG9ydGFudCddLFxuICBbJ1x1RDgzRFx1REQxMicsJ2xvY2sgc2VjdXJlIHByaXZhdGUnXSxbJ1x1RDgzRFx1REQxMycsJ3VubG9jayBvcGVuIHB1YmxpYyddLFsnXHVEODNEXHVERDExJywna2V5IHBhc3N3b3JkIGFjY2VzcyddLFxuICBbJ1x1RDgzRFx1REVFMScsJ3NoaWVsZCBwcm90ZWN0IHNlY3VyaXR5J10sWydcdTI2OTknLCdnZWFyIHNldHRpbmdzIGNvbmZpZyddLFsnXHVEODNEXHVERDI3Jywnd3JlbmNoIHRvb2wgZml4J10sXG4gIFsnXHVEODNEXHVERDI4JywnaGFtbWVyIGJ1aWxkJ10sWydcdTI2OTcnLCdmbGFzayBjaGVtaXN0cnkgbGFiJ10sWydcdUQ4M0RcdUREMkMnLCdtaWNyb3Njb3BlIHNjaWVuY2UgcmVzZWFyY2gnXSxcbiAgWydcdUQ4M0RcdUREMkQnLCd0ZWxlc2NvcGUgc3BhY2UgYXN0cm9ub215J10sWydcdUQ4M0VcdURERUEnLCd0ZXN0IHR1YmUgZXhwZXJpbWVudCddLFxuICBbJ1x1RDgzRFx1REM4RScsJ2dlbSBkaWFtb25kIHByZWNpb3VzJ10sWydcdUQ4M0RcdURDQjAnLCdtb25leSBiYWcgcmljaCddLFsnXHVEODNEXHVEQ0IzJywnY3JlZGl0IGNhcmQgcGF5bWVudCddLFxuICBbJ1x1RDgzQ1x1REZGNycsJ2xhYmVsIHRhZyBwcmljZSddLFsnXHVEODNDXHVERjgwJywncmliYm9uIGJvdyBnaWZ0J10sXG4gIC8vIE1pc2MgdXNlZnVsXG4gIFsnXHVEODNFXHVEREVEJywnY29tcGFzcyBuYXZpZ2F0ZSBkaXJlY3Rpb24nXSxbJ1x1RDgzRFx1RERGQScsJ21hcCB3b3JsZCBuYXZpZ2F0ZSddLFxuICBbJ1x1RDgzRFx1RENFNicsJ2JveCBwYWNrYWdlIHNoaXBwaW5nJ10sWydcdUQ4M0RcdUREQzQnLCdmaWxpbmcgY2FiaW5ldCBhcmNoaXZlJ10sXG4gIFsnXHVEODNEXHVERDEwJywnbG9jayBrZXkgc2VjdXJlJ10sWydcdUQ4M0RcdURDQ0UnLCdwYXBlcmNsaXAgYXR0YWNoJ10sWydcdTI3MDInLCdzY2lzc29ycyBjdXQnXSxcbiAgWydcdUQ4M0RcdUREOEEnLCdwZW4gd3JpdGUgZWRpdCddLFsnXHVEODNEXHVEQ0NGJywncnVsZXIgbWVhc3VyZSddLFsnXHVEODNEXHVERDA1JywnZGltIGJyaWdodG5lc3MnXSxcbiAgWydcdUQ4M0RcdUREMDYnLCdicmlnaHQgc3VuIGxpZ2h0J10sWydcdTI2N0InLCdyZWN5Y2xlIHN1c3RhaW5hYmlsaXR5J10sWydcdTI3MTQnLCdjaGVja21hcmsgZG9uZSddLFxuICBbJ1x1Mjc5NScsJ3BsdXMgYWRkJ10sWydcdTI3OTYnLCdtaW51cyByZW1vdmUnXSxbJ1x1RDgzRFx1REQwNCcsJ3JlZnJlc2ggc3luYyBsb29wJ10sXG4gIFsnXHUyM0U5JywnZmFzdCBmb3J3YXJkIHNraXAnXSxbJ1x1MjNFQScsJ3Jld2luZCBiYWNrJ10sWydcdTIzRjgnLCdwYXVzZSBzdG9wJ10sXG4gIFsnXHUyNUI2JywncGxheSBzdGFydCddLFsnXHVEODNEXHVERDAwJywnc2h1ZmZsZSByYW5kb20gbWl4J10sXG5dO1xuXG5jbGFzcyBCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJpdmF0ZSBibG9jazogQmFzZUJsb2NrLFxuICAgIHByaXZhdGUgb25TYXZlOiAoKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmluc3RhbmNlLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnVGl0bGUgbGFiZWwnKVxuICAgICAgLnNldERlc2MoJ0xlYXZlIGVtcHR5IHRvIHVzZSB0aGUgZGVmYXVsdCB0aXRsZS4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKHR5cGVvZiBkcmFmdC5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgPyBkcmFmdC5fdGl0bGVMYWJlbCA6ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdEZWZhdWx0IHRpdGxlJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX3RpdGxlTGFiZWwgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgRW1vamkgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIGNvbnN0IGVtb2ppUm93ID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1yb3cnIH0pO1xuICAgIGVtb2ppUm93LmNyZWF0ZVNwYW4oeyBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsIHRleHQ6ICdUaXRsZSBlbW9qaScgfSk7XG5cbiAgICBjb25zdCBjb250cm9scyA9IGVtb2ppUm93LmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1jb250cm9scycgfSk7XG5cbiAgICBjb25zdCB0cmlnZ2VyQnRuID0gY29udHJvbHMuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktcGlja2VyLXRyaWdnZXInIH0pO1xuICAgIGNvbnN0IHVwZGF0ZVRyaWdnZXIgPSAoKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSB0eXBlb2YgZHJhZnQuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlRW1vamkgOiAnJztcbiAgICAgIHRyaWdnZXJCdG4uZW1wdHkoKTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCAnXHVGRjBCJyB9KTtcbiAgICAgIHRyaWdnZXJCdG4uY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1jaGV2cm9uJywgdGV4dDogJ1x1MjVCRScgfSk7XG4gICAgfTtcbiAgICB1cGRhdGVUcmlnZ2VyKCk7XG5cbiAgICBjb25zdCBjbGVhckJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci1jbGVhcicsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgIGNsZWFyQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDbGVhciBlbW9qaScpO1xuXG4gICAgY29uc3QgcGFuZWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLXBhbmVsJyB9KTtcbiAgICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgY29uc3Qgc2VhcmNoSW5wdXQgPSBwYW5lbC5jcmVhdGVFbCgnaW5wdXQnLCB7XG4gICAgICB0eXBlOiAndGV4dCcsXG4gICAgICBjbHM6ICdlbW9qaS1waWNrZXItc2VhcmNoJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnU2VhcmNoXHUyMDI2JyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaWRFbCA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogJ2Vtb2ppLXBpY2tlci1ncmlkJyB9KTtcblxuICAgIGNvbnN0IHJlbmRlckdyaWQgPSAocXVlcnk6IHN0cmluZykgPT4ge1xuICAgICAgZ3JpZEVsLmVtcHR5KCk7XG4gICAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICBjb25zdCBmaWx0ZXJlZCA9IHFcbiAgICAgICAgPyBFTU9KSV9QSUNLRVJfU0VULmZpbHRlcigoW2UsIGtdKSA9PiBrLmluY2x1ZGVzKHEpIHx8IGUgPT09IHEpXG4gICAgICAgIDogRU1PSklfUElDS0VSX1NFVDtcbiAgICAgIGZvciAoY29uc3QgW2Vtb2ppXSBvZiBmaWx0ZXJlZCkge1xuICAgICAgICBjb25zdCBidG4gPSBncmlkRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZW1vamktYnRuJywgdGV4dDogZW1vamkgfSk7XG4gICAgICAgIGlmIChkcmFmdC5fdGl0bGVFbW9qaSA9PT0gZW1vamkpIGJ0bi5hZGRDbGFzcygnaXMtc2VsZWN0ZWQnKTtcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gZW1vamk7XG4gICAgICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgICAgIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgc2VhcmNoSW5wdXQudmFsdWUgPSAnJztcbiAgICAgICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGdyaWRFbC5jcmVhdGVTcGFuKHsgY2xzOiAnZW1vamktcGlja2VyLWVtcHR5JywgdGV4dDogJ05vIHJlc3VsdHMnIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVuZGVyR3JpZCgnJyk7XG5cbiAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHJlbmRlckdyaWQoc2VhcmNoSW5wdXQudmFsdWUpKTtcblxuICAgIHRyaWdnZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBvcGVuID0gcGFuZWwuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9IG9wZW4gPyAnbm9uZScgOiAnYmxvY2snO1xuICAgICAgaWYgKCFvcGVuKSBzZXRUaW1lb3V0KCgpID0+IHNlYXJjaElucHV0LmZvY3VzKCksIDApO1xuICAgIH0pO1xuXG4gICAgY2xlYXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9ICcnO1xuICAgICAgdXBkYXRlVHJpZ2dlcigpO1xuICAgICAgcGFuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHNlYXJjaElucHV0LnZhbHVlID0gJyc7XG4gICAgICByZW5kZXJHcmlkKCcnKTtcbiAgICB9KTtcbiAgICAvLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIaWRlIHRpdGxlJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0Ll9oaWRlVGl0bGUgPT09IHRydWUpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll9oaWRlVGl0bGUgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gZHJhZnQ7XG4gICAgICAgICAgdGhpcy5vblNhdmUoKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG5cbiAgICBjb25zdCBociA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaHInKTtcbiAgICBoci5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdCbG9jay1zcGVjaWZpYyBzZXR0aW5nczonLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NvbmZpZ3VyZSBibG9jay4uLicpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmJsb2NrLm9wZW5TZXR0aW5ncyh0aGlzLm9uU2F2ZSk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gRWRpdCB0b2dnbGVcbiAgICBjb25zdCBlZGl0QnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1lZGl0LWJ0bicgfSk7XG4gICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgIGVkaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgICB0aGlzLmdyaWQuc2V0RWRpdE1vZGUodGhpcy5lZGl0TW9kZSk7XG4gICAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgICB0aGlzLnN5bmNBZGRCdXR0b24oKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRWRpdEJ0bihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gdGhpcy5lZGl0TW9kZSA/ICdcdTI3MTMgRG9uZScgOiAnXHUyNzBGIEVkaXQnO1xuICAgIGJ0bi50b2dnbGVDbGFzcygndG9vbGJhci1idG4tYWN0aXZlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRvb2xiYXJFbC5xdWVyeVNlbGVjdG9yKCcudG9vbGJhci1hZGQtYnRuJyk7XG4gICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgIWV4aXN0aW5nKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZWRpdE1vZGUgJiYgZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNvbnN0IEJMT0NLX0lDT05TOiBSZWNvcmQ8QmxvY2tUeXBlLCBzdHJpbmc+ID0ge1xuICAnZ3JlZXRpbmcnOiAgICAgICdcdUQ4M0RcdURDNEInLFxuICAnY2xvY2snOiAgICAgICAgICdcdUQ4M0RcdURENTAnLFxuICAnZm9sZGVyLWxpbmtzJzogICdcdUQ4M0RcdUREMTcnLFxuICAnaW5zaWdodCc6ICAgICAgICdcdUQ4M0RcdURDQTEnLFxuICAndGFnLWdyaWQnOiAgICAgICdcdUQ4M0NcdURGRjdcdUZFMEYnLFxuICAncXVvdGVzLWxpc3QnOiAgICdcdUQ4M0RcdURDQUMnLFxuICAnaW1hZ2UtZ2FsbGVyeSc6ICdcdUQ4M0RcdUREQkNcdUZFMEYnLFxuICAnZW1iZWRkZWQtbm90ZSc6ICdcdUQ4M0RcdURDQzQnLFxuICAnc3RhdGljLXRleHQnOiAgICdcdUQ4M0RcdURDREQnLFxuICAnaHRtbCc6ICAgICAgICAgICc8Lz4nLFxufTtcblxuY2xhc3MgQWRkQmxvY2tNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvblNlbGVjdDogKHR5cGU6IEJsb2NrVHlwZSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQWRkIEJsb2NrJywgY2xzOiAnYWRkLWJsb2NrLW1vZGFsLXRpdGxlJyB9KTtcblxuICAgIGNvbnN0IGdyaWQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYWRkLWJsb2NrLWdyaWQnIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYWRkLWJsb2NrLW9wdGlvbicgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1pY29uJywgdGV4dDogQkxPQ0tfSUNPTlNbZmFjdG9yeS50eXBlXSA/PyAnXHUyNUFBJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLW5hbWUnLCB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIHByaXZhdGUgX2hlYWRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgYXBwOiBBcHAsXG4gICAgcHJvdGVjdGVkIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlLFxuICAgIHByb3RlY3RlZCBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGFic3RyYWN0IHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxuICAvLyBPdmVycmlkZSB0byBvcGVuIGEgcGVyLWJsb2NrIHNldHRpbmdzIG1vZGFsXG4gIG9wZW5TZXR0aW5ncyhfb25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7fVxuXG4gIC8vIENhbGxlZCBieSBHcmlkTGF5b3V0IHRvIHJlZGlyZWN0IHJlbmRlckhlYWRlciBvdXRwdXQgb3V0c2lkZSBibG9jay1jb250ZW50LlxuICBzZXRIZWFkZXJDb250YWluZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5faGVhZGVyQ29udGFpbmVyID0gZWw7XG4gIH1cblxuICAvLyBSZW5kZXIgdGhlIG11dGVkIHVwcGVyY2FzZSBibG9jayBoZWFkZXIgbGFiZWwuXG4gIC8vIFJlc3BlY3RzIF9oaWRlVGl0bGUsIF90aXRsZUxhYmVsLCBhbmQgX3RpdGxlRW1vamkgZnJvbSBpbnN0YW5jZS5jb25maWcuXG4gIC8vIFJlbmRlcnMgaW50byB0aGUgaGVhZGVyIGNvbnRhaW5lciBzZXQgYnkgR3JpZExheW91dCAoaWYgYW55KSwgZWxzZSBmYWxscyBiYWNrIHRvIGVsLlxuICBwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGVsOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNmZyA9IHRoaXMuaW5zdGFuY2UuY29uZmlnO1xuICAgIGlmIChjZmcuX2hpZGVUaXRsZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgIGNvbnN0IGxhYmVsID0gKHR5cGVvZiBjZmcuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnICYmIGNmZy5fdGl0bGVMYWJlbC50cmltKCkpXG4gICAgICA/IGNmZy5fdGl0bGVMYWJlbC50cmltKClcbiAgICAgIDogdGl0bGU7XG4gICAgaWYgKCFsYWJlbCkgcmV0dXJuO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuX2hlYWRlckNvbnRhaW5lciA/PyBlbDtcbiAgICBjb25zdCBoZWFkZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJyB9KTtcbiAgICBpZiAodHlwZW9mIGNmZy5fdGl0bGVFbW9qaSA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUVtb2ppKSB7XG4gICAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWhlYWRlci1lbW9qaScsIHRleHQ6IGNmZy5fdGl0bGVFbW9qaSB9KTtcbiAgICB9XG4gICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIENsb2NrQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkYXRlRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdjbG9jay1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93RGF0ZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd0RhdGU/OiBib29sZWFuIH07XG5cbiAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLXRpbWUnIH0pO1xuICAgIGlmIChzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay1kYXRlJyB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgeyBzaG93U2Vjb25kcyA9IGZhbHNlLCBzaG93RGF0ZSA9IHRydWUsIGZvcm1hdCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBzaG93U2Vjb25kcz86IGJvb2xlYW47XG4gICAgICBzaG93RGF0ZT86IGJvb2xlYW47XG4gICAgICBmb3JtYXQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnRpbWVFbCkge1xuICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoZm9ybWF0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoc2hvd1NlY29uZHMgPyAnSEg6bW06c3MnIDogJ0hIOm1tJykpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5kYXRlRWwgJiYgc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsLnNldFRleHQobm93LmZvcm1hdCgnZGRkZCwgRCBNTU1NIFlZWVknKSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBDbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBDbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Nsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBzZWNvbmRzJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1NlY29uZHMgYXMgYm9vbGVhbiA/PyBmYWxzZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dTZWNvbmRzID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgZGF0ZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dEYXRlIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dEYXRlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnQ3VzdG9tIGZvcm1hdCcpXG4gICAgICAuc2V0RGVzYygnT3B0aW9uYWwgbW9tZW50LmpzIGZvcm1hdCBzdHJpbmcsIGUuZy4gXCJISDptbVwiLiBMZWF2ZSBlbXB0eSBmb3IgZGVmYXVsdC4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0LmZvcm1hdCBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZvcm1hdCA9IHY7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBMaW5rSXRlbSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgZW1vamk/OiBzdHJpbmc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT4gZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQgeyB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTGlua3NCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVuZGVyVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2ZvbGRlci1saW5rcy1ibG9jaycpO1xuXG4gICAgLy8gUmUtcmVuZGVyIHdoZW4gdmF1bHQgZmlsZXMgYXJlIGNyZWF0ZWQsIGRlbGV0ZWQsIG9yIHJlbmFtZWQgKGRlYm91bmNlZClcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2NyZWF0ZScsICgpID0+IHRoaXMuc2NoZWR1bGVSZW5kZXIoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignZGVsZXRlJywgKCkgPT4gdGhpcy5zY2hlZHVsZVJlbmRlcigpKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCAoKSA9PiB0aGlzLnNjaGVkdWxlUmVuZGVyKCkpKTtcblxuICAgIC8vIERlZmVyIGZpcnN0IHJlbmRlciBzbyB2YXVsdCBpcyBmdWxseSBpbmRleGVkXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4gdGhpcy5yZW5kZXJDb250ZW50KCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVJlbmRlcigpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5yZW5kZXJUaW1lciAhPT0gbnVsbCkgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJlbmRlclRpbWVyKTtcbiAgICB0aGlzLnJlbmRlclRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5yZW5kZXJUaW1lciA9IG51bGw7XG4gICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICB9LCAxNTApO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDb250ZW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5jb250YWluZXJFbDtcbiAgICBpZiAoIWVsKSByZXR1cm47XG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnUXVpY2sgTGlua3MnLCBmb2xkZXIgPSAnJywgbGlua3MgPSBbXSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICBsaW5rcz86IExpbmtJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBsaXN0ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmtzLWxpc3QnIH0pO1xuXG4gICAgLy8gQXV0by1saXN0IG5vdGVzIGZyb20gc2VsZWN0ZWQgZm9sZGVyIChzb3J0ZWQgYWxwaGFiZXRpY2FsbHkpXG4gICAgaWYgKGZvbGRlcikge1xuICAgICAgY29uc3Qgbm9ybWFsaXNlZCA9IGZvbGRlci50cmltKCkucmVwbGFjZSgvXFwvKyQvLCAnJyk7XG5cbiAgICAgIGlmICghbm9ybWFsaXNlZCkge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnVmF1bHQgcm9vdCBsaXN0aW5nIGlzIG5vdCBzdXBwb3J0ZWQuIFNlbGVjdCBhIHN1YmZvbGRlci4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGZvbGRlck9iaiA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChub3JtYWxpc2VkKTtcblxuICAgICAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IGBGb2xkZXIgXCIke25vcm1hbGlzZWR9XCIgbm90IGZvdW5kLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGZvbGRlck9iai5wYXRoICsgJy8nO1xuICAgICAgICAgIGNvbnN0IG5vdGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKVxuICAgICAgICAgICAgLmZpbHRlcihmID0+IGYucGF0aC5zdGFydHNXaXRoKHByZWZpeCkpXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcblxuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBub3Rlcykge1xuICAgICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICAgICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICAgICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgTm8gbm90ZXMgaW4gXCIke2ZvbGRlck9iai5wYXRofVwiLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hbnVhbCBsaW5rc1xuICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICBpZiAobGluay5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2xpbmstZW1vamknLCB0ZXh0OiBsaW5rLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsaW5rLmxhYmVsIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGxpbmsucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIgJiYgbGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnQWRkIGxpbmtzIG9yIHNlbGVjdCBhIGZvbGRlciBpbiBzZXR0aW5ncy4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNhcmQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIGJsb2NrIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncy5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0eXBlb2YgdCA9PT0gJ3N0cmluZycpIDpcbiAgICAgIHR5cGVvZiByYXdGbVRhZ3MgPT09ICdzdHJpbmcnID8gW3Jhd0ZtVGFnc10gOlxuICAgICAgW107XG4gICAgY29uc3Qgbm9ybWFsaXplZEZtVGFncyA9IGZtVGFnQXJyYXkubWFwKHQgPT4gdC5zdGFydHNXaXRoKCcjJykgPyB0IDogYCMke3R9YCk7XG5cbiAgICByZXR1cm4gaW5saW5lVGFncy5pbmNsdWRlcyh0YWcpIHx8IG5vcm1hbGl6ZWRGbVRhZ3MuaW5jbHVkZXModGFnKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIFZhbHVlSXRlbSB7XG4gIGVtb2ppOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGxpbms/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUYWdHcmlkQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3RhZy1ncmlkLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1ZhbHVlcycsIGNvbHVtbnMgPSAyLCBpdGVtcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBpdGVtcz86IFZhbHVlSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ3JpZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3RhZy1ncmlkJyB9KTtcbiAgICBncmlkLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZ3JpZC5zZXRUZXh0KCdObyBpdGVtcy4gQ29uZmlndXJlIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0YWctYnRuJyB9KTtcbiAgICAgIGlmIChpdGVtLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAndGFnLWJ0bi1lbW9qaScsIHRleHQ6IGl0ZW0uZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGl0ZW0ubGFiZWwgfSk7XG4gICAgICBpZiAoaXRlbS5saW5rKSB7XG4gICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGl0ZW0ubGluayEsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidG4uc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgVmFsdWVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFZhbHVlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1ZhbHVlcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZykgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgaXRlbXM/OiBWYWx1ZUl0ZW1bXTtcbiAgICB9O1xuICAgIGlmICghQXJyYXkuaXNBcnJheShkcmFmdC5pdGVtcykpIGRyYWZ0Lml0ZW1zID0gW107XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdWYWx1ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcxJywgJzEnKS5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnSXRlbXMnLCBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScgfSk7XG5cbiAgICBjb25zdCBsaXN0RWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAndmFsdWVzLWl0ZW0tbGlzdCcgfSk7XG4gICAgY29uc3QgcmVuZGVyTGlzdCA9ICgpID0+IHtcbiAgICAgIGxpc3RFbC5lbXB0eSgpO1xuICAgICAgZHJhZnQuaXRlbXMhLmZvckVhY2goKGl0ZW0sIGkpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogJ3ZhbHVlcy1pdGVtLXJvdycgfSk7XG5cbiAgICAgICAgY29uc3QgZW1vamlJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tZW1vamknIH0pO1xuICAgICAgICBlbW9qaUlucHV0LnZhbHVlID0gaXRlbS5lbW9qaTtcbiAgICAgICAgZW1vamlJbnB1dC5wbGFjZWhvbGRlciA9ICdcdUQ4M0RcdURFMDAnO1xuICAgICAgICBlbW9qaUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmVtb2ppID0gZW1vamlJbnB1dC52YWx1ZTsgfSk7XG5cbiAgICAgICAgY29uc3QgbGFiZWxJbnB1dCA9IHJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IHR5cGU6ICd0ZXh0JywgY2xzOiAndmFsdWVzLWl0ZW0tbGFiZWwnIH0pO1xuICAgICAgICBsYWJlbElucHV0LnZhbHVlID0gaXRlbS5sYWJlbDtcbiAgICAgICAgbGFiZWxJbnB1dC5wbGFjZWhvbGRlciA9ICdMYWJlbCc7XG4gICAgICAgIGxhYmVsSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0ubGFiZWwgPSBsYWJlbElucHV0LnZhbHVlOyB9KTtcblxuICAgICAgICBjb25zdCBsaW5rSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWxpbmsnIH0pO1xuICAgICAgICBsaW5rSW5wdXQudmFsdWUgPSBpdGVtLmxpbmsgPz8gJyc7XG4gICAgICAgIGxpbmtJbnB1dC5wbGFjZWhvbGRlciA9ICdOb3RlIHBhdGggKG9wdGlvbmFsKSc7XG4gICAgICAgIGxpbmtJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5saW5rID0gbGlua0lucHV0LnZhbHVlIHx8IHVuZGVmaW5lZDsgfSk7XG5cbiAgICAgICAgY29uc3QgZGVsQnRuID0gcm93LmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3ZhbHVlcy1pdGVtLWRlbCcsIHRleHQ6ICdcdTI3MTUnIH0pO1xuICAgICAgICBkZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgZHJhZnQuaXRlbXMhLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZW5kZXJMaXN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICByZW5kZXJMaXN0KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCcrIEFkZCBpdGVtJykub25DbGljaygoKSA9PiB7XG4gICAgICAgIGRyYWZ0Lml0ZW1zIS5wdXNoKHsgZW1vamk6ICcnLCBsYWJlbDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpc3QoKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25TYXZlKGRyYWZ0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIE9ubHkgYXNzaWduIHNhZmUgQ1NTIGNvbG9yIHZhbHVlczsgcmVqZWN0IHBvdGVudGlhbGx5IG1hbGljaW91cyBzdHJpbmdzXG5jb25zdCBDT0xPUl9SRSA9IC9eKCNbMC05YS1mQS1GXXszLDh9fFthLXpBLVpdK3xyZ2JhP1xcKFteKV0rXFwpfGhzbGE/XFwoW14pXStcXCkpJC87XG5cbnR5cGUgUXVvdGVzQ29uZmlnID0ge1xuICBzb3VyY2U/OiAndGFnJyB8ICd0ZXh0JztcbiAgdGFnPzogc3RyaW5nO1xuICBxdW90ZXM/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBjb2x1bW5zPzogbnVtYmVyO1xuICBtYXhJdGVtcz86IG51bWJlcjtcbn07XG5cbmV4cG9ydCBjbGFzcyBRdW90ZXNMaXN0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3F1b3Rlcy1saXN0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFF1b3Rlc0xpc3RCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBxdW90ZXMuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBzb3VyY2UgPSAndGFnJywgdGFnID0gJycsIHF1b3RlcyA9ICcnLCB0aXRsZSA9ICdRdW90ZXMnLCBjb2x1bW5zID0gMiwgbWF4SXRlbXMgPSAyMCB9ID1cbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIFF1b3Rlc0NvbmZpZztcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG5cbiAgICBjb25zdCBNSU5fQ09MX1dJRFRIID0gMjAwO1xuICAgIGNvbnN0IHVwZGF0ZUNvbHMgPSAoKSA9PiB7XG4gICAgICBjb25zdCB3ID0gY29sc0VsLm9mZnNldFdpZHRoO1xuICAgICAgY29uc3QgZWZmZWN0aXZlID0gdyA+IDAgPyBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBNYXRoLmZsb29yKHcgLyBNSU5fQ09MX1dJRFRIKSkpIDogY29sdW1ucztcbiAgICAgIGNvbHNFbC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2VmZmVjdGl2ZX0sIDFmcilgO1xuICAgIH07XG4gICAgdXBkYXRlQ29scygpO1xuICAgIGNvbnN0IHJvID0gbmV3IFJlc2l6ZU9ic2VydmVyKHVwZGF0ZUNvbHMpO1xuICAgIHJvLm9ic2VydmUoY29sc0VsKTtcbiAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IHJvLmRpc2Nvbm5lY3QoKSk7XG5cbiAgICBpZiAoc291cmNlID09PSAndGV4dCcpIHtcbiAgICAgIHRoaXMucmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWwsIHF1b3RlcywgbWF4SXRlbXMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHNvdXJjZSA9PT0gJ3RhZydcbiAgICBpZiAoIXRhZykge1xuICAgICAgY29sc0VsLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpLnNsaWNlKDAsIG1heEl0ZW1zKTtcblxuICAgIC8vIFJlYWQgYWxsIGZpbGVzIGluIHBhcmFsbGVsIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2VcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgZmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgICByZXR1cm4geyBmaWxlLCBjb250ZW50LCBjYWNoZSB9O1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAncmVqZWN0ZWQnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFF1b3Rlc0xpc3RCbG9jayBmYWlsZWQgdG8gcmVhZCBmaWxlOicsIHJlc3VsdC5yZWFzb24pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBmaWxlLCBjb250ZW50LCBjYWNoZSB9ID0gcmVzdWx0LnZhbHVlO1xuICAgICAgY29uc3QgY29sb3IgPSBjYWNoZT8uZnJvbnRtYXR0ZXI/LmNvbG9yIGFzIHN0cmluZyA/PyAnJztcbiAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLmV4dHJhY3RCb2R5KGNvbnRlbnQsIGNhY2hlKTtcbiAgICAgIGlmICghYm9keSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGl0ZW0gPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtaXRlbScgfSk7XG4gICAgICBjb25zdCBxdW90ZSA9IGl0ZW0uY3JlYXRlRWwoJ2Jsb2NrcXVvdGUnLCB7IGNsczogJ3F1b3RlLWNvbnRlbnQnLCB0ZXh0OiBib2R5IH0pO1xuXG4gICAgICAvLyBWYWxpZGF0ZSBjb2xvciBiZWZvcmUgYXBwbHlpbmcgdG8gcHJldmVudCBDU1MgaW5qZWN0aW9uXG4gICAgICBpZiAoY29sb3IgJiYgQ09MT1JfUkUudGVzdChjb2xvcikpIHtcbiAgICAgICAgcXVvdGUuc3R5bGUuYm9yZGVyTGVmdENvbG9yID0gY29sb3I7XG4gICAgICAgIHF1b3RlLnN0eWxlLmNvbG9yID0gY29sb3I7XG4gICAgICB9XG5cbiAgICAgIGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtc291cmNlJywgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVuZGVyIHF1b3RlcyBmcm9tIHBsYWluIHRleHQuIEVhY2ggcXVvdGUgaXMgc2VwYXJhdGVkIGJ5IGAtLS1gIG9uIGl0cyBvd24gbGluZS5cbiAgICogT3B0aW9uYWxseSBhIHNvdXJjZSBsaW5lIGNhbiBmb2xsb3cgdGhlIHF1b3RlIHRleHQsIHByZWZpeGVkIHdpdGggYFx1MjAxNGAsIGBcdTIwMTNgLCBvciBgLS1gLlxuICAgKlxuICAgKiBFeGFtcGxlOlxuICAgKiAgIFRoZSBvbmx5IHdheSB0byBkbyBncmVhdCB3b3JrIGlzIHRvIGxvdmUgd2hhdCB5b3UgZG8uXG4gICAqICAgXHUyMDE0IFN0ZXZlIEpvYnNcbiAgICogICAtLS1cbiAgICogICBJbiB0aGUgbWlkZGxlIG9mIGRpZmZpY3VsdHkgbGllcyBvcHBvcnR1bml0eS5cbiAgICogICBcdTIwMTQgQWxiZXJ0IEVpbnN0ZWluXG4gICAqL1xuICBwcml2YXRlIHJlbmRlclRleHRRdW90ZXMoY29sc0VsOiBIVE1MRWxlbWVudCwgcmF3OiBzdHJpbmcsIG1heEl0ZW1zOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAoIXJhdy50cmltKCkpIHtcbiAgICAgIGNvbHNFbC5zZXRUZXh0KCdBZGQgcXVvdGVzIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJsb2NrcyA9IHJhdy5zcGxpdCgvXFxuLS0tXFxuLykubWFwKGIgPT4gYi50cmltKCkpLmZpbHRlcihCb29sZWFuKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuICAgICAgY29uc3QgbGluZXMgPSBibG9jay5zcGxpdCgnXFxuJykubWFwKGwgPT4gbC50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGNvbnN0IGxhc3RMaW5lID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV07XG4gICAgICBjb25zdCBoYXNTb3VyY2UgPSBsaW5lcy5sZW5ndGggPiAxICYmIC9eKFx1MjAxNHxcdTIwMTN8LS0pLy50ZXN0KGxhc3RMaW5lKTtcbiAgICAgIGNvbnN0IHNvdXJjZVRleHQgPSBoYXNTb3VyY2UgPyBsYXN0TGluZS5yZXBsYWNlKC9eKFx1MjAxNHxcdTIwMTN8LS0pXFxzKi8sICcnKSA6ICcnO1xuICAgICAgY29uc3QgYm9keUxpbmVzID0gaGFzU291cmNlID8gbGluZXMuc2xpY2UoMCwgLTEpIDogbGluZXM7XG4gICAgICBjb25zdCBib2R5ID0gYm9keUxpbmVzLmpvaW4oJyAnKTtcbiAgICAgIGlmICghYm9keSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGl0ZW0gPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtaXRlbScgfSk7XG4gICAgICBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcbiAgICAgIGlmIChzb3VyY2VUZXh0KSBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IHNvdXJjZVRleHQgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEV4dHJhY3QgdGhlIGZpcnN0IGZldyBsaW5lcyBvZiBib2R5IGNvbnRlbnQgdXNpbmcgbWV0YWRhdGFDYWNoZSBmcm9udG1hdHRlciBvZmZzZXQuICovXG4gIHByaXZhdGUgZXh0cmFjdEJvZHkoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuICAgIGNvbnN0IGxpbmVzID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2UoMCwgMykuam9pbignICcpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBRdW90ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgUXVvdGVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVvdGVzIExpc3QgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpIGFzIFF1b3Rlc0NvbmZpZztcbiAgICBkcmFmdC5zb3VyY2UgPz89ICd0YWcnO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVvdGVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFNvdXJjZSB0b2dnbGUgXHUyMDE0IHNob3dzL2hpZGVzIHRoZSByZWxldmFudCBzZWN0aW9uXG4gICAgbGV0IHRhZ1NlY3Rpb246IEhUTUxFbGVtZW50O1xuICAgIGxldCB0ZXh0U2VjdGlvbjogSFRNTEVsZW1lbnQ7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnU291cmNlJylcbiAgICAgIC5zZXREZXNjKCdQdWxsIHF1b3RlcyBmcm9tIHRhZ2dlZCBub3Rlcywgb3IgZW50ZXIgdGhlbSBtYW51YWxseS4nKVxuICAgICAgLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgICAgZC5hZGRPcHRpb24oJ3RhZycsICdOb3RlcyB3aXRoIHRhZycpXG4gICAgICAgICAuYWRkT3B0aW9uKCd0ZXh0JywgJ01hbnVhbCB0ZXh0JylcbiAgICAgICAgIC5zZXRWYWx1ZShkcmFmdC5zb3VyY2UgPz8gJ3RhZycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7XG4gICAgICAgICAgIGRyYWZ0LnNvdXJjZSA9IHYgYXMgJ3RhZycgfCAndGV4dCc7XG4gICAgICAgICAgIHRhZ1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHYgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGV4dCcgPyAnJyA6ICdub25lJztcbiAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIC8vIFRhZyBzZWN0aW9uXG4gICAgdGFnU2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcbiAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0YWcnID8gJycgOiAnbm9uZSc7XG4gICAgbmV3IFNldHRpbmcodGFnU2VjdGlvbikuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgLy8gVGV4dCBzZWN0aW9uXG4gICAgdGV4dFNlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGV4dFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGRyYWZ0LnNvdXJjZSA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgY29uc3QgdGV4dFNldHRpbmcgPSBuZXcgU2V0dGluZyh0ZXh0U2VjdGlvbilcbiAgICAgIC5zZXROYW1lKCdRdW90ZXMnKVxuICAgICAgLnNldERlc2MoJ1NlcGFyYXRlIHF1b3RlcyB3aXRoIC0tLSBvbiBpdHMgb3duIGxpbmUuIEFkZCBhIHNvdXJjZSBsaW5lIHN0YXJ0aW5nIHdpdGggXHUyMDE0IChlLmcuIFx1MjAxNCBBdXRob3IpLicpO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5mbGV4RGlyZWN0aW9uID0gJ2NvbHVtbic7XG4gICAgdGV4dFNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmFsaWduSXRlbXMgPSAnc3RyZXRjaCc7XG4gICAgY29uc3QgdGV4dGFyZWEgPSB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuY3JlYXRlRWwoJ3RleHRhcmVhJyk7XG4gICAgdGV4dGFyZWEucm93cyA9IDg7XG4gICAgdGV4dGFyZWEuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgdGV4dGFyZWEuc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XG4gICAgdGV4dGFyZWEuc3R5bGUuZm9udEZhbWlseSA9ICd2YXIoLS1mb250LW1vbm9zcGFjZSknO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRTaXplID0gJzEycHgnO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQucXVvdGVzID8/ICcnO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5xdW90ZXMgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURmlsZSwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gXHUyNTAwXHUyNTAwIEZvbGRlciBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclN1Z2dlc3RNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxURm9sZGVyPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT5cbiAgICAgIGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpLFxuICAgICk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlciwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGZvbGRlci5wYXRoID09PSAnLycgPyAnLyAodmF1bHQgcm9vdCknIDogZm9sZGVyLnBhdGggfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyKTogdm9pZCB7XG4gICAgdGhpcy5vbkNob29zZShmb2xkZXIpO1xuICB9XG59XG5cbmNvbnN0IElNQUdFX0VYVFMgPSBuZXcgU2V0KFsnLnBuZycsICcuanBnJywgJy5qcGVnJywgJy5naWYnLCAnLndlYnAnLCAnLnN2ZyddKTtcbmNvbnN0IFZJREVPX0VYVFMgPSBuZXcgU2V0KFsnLm1wNCcsICcud2VibScsICcubW92JywgJy5ta3YnXSk7XG5cbmV4cG9ydCBjbGFzcyBJbWFnZUdhbGxlcnlCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaW1hZ2UtZ2FsbGVyeS1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbWFnZUdhbGxlcnlCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBnYWxsZXJ5LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgZm9sZGVyID0gJycsIHRpdGxlID0gJ0dhbGxlcnknLCBjb2x1bW5zID0gMywgbWF4SXRlbXMgPSAyMCwgbGF5b3V0ID0gJ2dyaWQnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICAgIGxheW91dD86ICdncmlkJyB8ICdtYXNvbnJ5JztcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcblxuICAgIGlmIChsYXlvdXQgPT09ICdtYXNvbnJ5Jykge1xuICAgICAgZ2FsbGVyeS5hZGRDbGFzcygnbWFzb25yeS1sYXlvdXQnKTtcbiAgICAgIGNvbnN0IHVwZGF0ZUNvbHMgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHcgPSBnYWxsZXJ5Lm9mZnNldFdpZHRoO1xuICAgICAgICBjb25zdCBlZmZlY3RpdmUgPSB3ID4gMCA/IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIE1hdGguZmxvb3IodyAvIDEwMCkpKSA6IGNvbHVtbnM7XG4gICAgICAgIGdhbGxlcnkuc3R5bGUuY29sdW1ucyA9IFN0cmluZyhlZmZlY3RpdmUpO1xuICAgICAgfTtcbiAgICAgIHVwZGF0ZUNvbHMoKTtcbiAgICAgIGNvbnN0IHJvID0gbmV3IFJlc2l6ZU9ic2VydmVyKHVwZGF0ZUNvbHMpO1xuICAgICAgcm8ub2JzZXJ2ZShnYWxsZXJ5KTtcbiAgICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcm8uZGlzY29ubmVjdCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2FsbGVyeS5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdChhdXRvLWZpbGwsIG1pbm1heChtYXgoNzBweCwgY2FsYygxMDAlIC8gJHtjb2x1bW5zfSkpLCAxZnIpKWA7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdMYXlvdXQnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignZ3JpZCcsICdHcmlkJykuYWRkT3B0aW9uKCdtYXNvbnJ5JywgJ01hc29ucnknKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubGF5b3V0ID8/ICdncmlkJykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5sYXlvdXQgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpLmFkZE9wdGlvbignNCcsICc0JylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMykpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5jb25zdCBERUJPVU5DRV9NUyA9IDMwMDtcblxuZXhwb3J0IGNsYXNzIEVtYmVkZGVkTm90ZUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkZWJvdW5jZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdlbWJlZGRlZC1ub3RlLWJsb2NrJyk7XG5cbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuXG4gICAgLy8gUmVnaXN0ZXIgdmF1bHQgbGlzdGVuZXIgb25jZTsgZGVib3VuY2UgcmFwaWQgc2F2ZXNcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC52YXVsdC5vbignbW9kaWZ5JywgKG1vZEZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IGZpbGVQYXRoPzogc3RyaW5nIH07XG4gICAgICAgIGlmIChtb2RGaWxlLnBhdGggPT09IGZpbGVQYXRoICYmIHRoaXMuY29udGFpbmVyRWwpIHtcbiAgICAgICAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ29udGVudCh0YXJnZXQpLmNhdGNoKGUgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmUtcmVuZGVyIGFmdGVyIG1vZGlmeTonLCBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIERFQk9VTkNFX01TKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJywgc2hvd1RpdGxlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgZmlsZVBhdGg/OiBzdHJpbmc7XG4gICAgICBzaG93VGl0bGU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgaWYgKCFmaWxlUGF0aCkge1xuICAgICAgZWwuc2V0VGV4dCgnQ29uZmlndXJlIGEgZmlsZSBwYXRoIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIGVsLnNldFRleHQoYEZpbGUgbm90IGZvdW5kOiAke2ZpbGVQYXRofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaG93VGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCBmaWxlLmJhc2VuYW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdlbWJlZGRlZC1ub3RlLWNvbnRlbnQnIH0pO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgZmlsZS5wYXRoLCB0aGlzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBNYXJrZG93blJlbmRlcmVyIGZhaWxlZDonLCBlKTtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBFbWJlZGRlZE5vdGVTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdFbWJlZGRlZCBOb3RlIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRmlsZSBwYXRoJykuc2V0RGVzYygnVmF1bHQgcGF0aCB0byB0aGUgbm90ZSAoZS5nLiBOb3Rlcy9NeU5vdGUubWQpJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LmZpbGVQYXRoIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZpbGVQYXRoID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGl0bGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93VGl0bGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1hcmtkb3duUmVuZGVyZXIsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgU3RhdGljVGV4dEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdzdGF0aWMtdGV4dC1ibG9jaycpO1xuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBTdGF0aWNUZXh0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBjb250ZW50LicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJDb250ZW50KGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGl0bGUgPSAnJywgY29udGVudCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbnRlbnQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnc3RhdGljLXRleHQtY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdDb25maWd1cmUgdGV4dCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCAnJywgdGhpcyk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFN0YXRpY1RleHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N0YXRpYyBUZXh0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5zZXREZXNjKCdPcHRpb25hbCBoZWFkZXIgc2hvd24gYWJvdmUgdGhlIHRleHQuJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29udGVudCcpLnNldERlc2MoJ1N1cHBvcnRzIE1hcmtkb3duLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuY29udGVudCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEwO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5jb250ZW50ID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgc2FuaXRpemVIVE1MVG9Eb20gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBIdG1sQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2h0bWwtYmxvY2snKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnJywgaHRtbCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGh0bWw/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdodG1sLWJsb2NrLWNvbnRlbnQnIH0pO1xuXG4gICAgaWYgKCFodG1sKSB7XG4gICAgICBjb250ZW50RWwuc2V0VGV4dCgnQ29uZmlndXJlIEhUTUwgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29udGVudEVsLmFwcGVuZENoaWxkKHNhbml0aXplSFRNTFRvRG9tKGh0bWwpKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEh0bWxCbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hUTUwgQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgSFRNTC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdIVE1MJykuc2V0RGVzYygnSFRNTCBpcyBzYW5pdGl6ZWQgYmVmb3JlIHJlbmRlcmluZy4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0Lmh0bWwgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMjtcbiAgICB0ZXh0YXJlYS5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuaHRtbCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHko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LFlBQVk7QUFDakUsY0FBTSxLQUFLLE9BQU8sV0FBVyxpQkFBaUIsQ0FBQztBQUMvQyxtQkFBVyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEdBQUc7QUFDaEUsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGtCQUFNLEtBQUssS0FBSyxPQUFPO0FBQUEsVUFDekI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJGb2xkZXJTdWdnZXN0TW9kYWwiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
