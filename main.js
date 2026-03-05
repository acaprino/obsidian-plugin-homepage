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
  "\u{1F4C1}",
  "\u{1F4C2}",
  "\u{1F4C4}",
  "\u{1F4DD}",
  "\u{1F4CB}",
  "\u{1F4CC}",
  "\u{1F4CD}",
  "\u{1F516}",
  "\u{1F5C2}",
  "\u{1F5C3}",
  "\u{1F4A1}",
  "\u{1F50D}",
  "\u{1F50E}",
  "\u{1F517}",
  "\u2B50",
  "\u{1F31F}",
  "\u2728",
  "\u{1F3AF}",
  "\u{1F680}",
  "\u{1F3E0}",
  "\u{1F33F}",
  "\u{1F331}",
  "\u{1F338}",
  "\u{1F30A}",
  "\u{1F525}",
  "\u2744",
  "\u{1F319}",
  "\u2600",
  "\u{1F308}",
  "\u26A1",
  "\u{1F4AC}",
  "\u{1F4AD}",
  "\u{1F5E3}",
  "\u{1F4E2}",
  "\u{1F4E3}",
  "\u{1F514}",
  "\u{1F515}",
  "\u{1F4C5}",
  "\u{1F4C6}",
  "\u{1F5D3}",
  "\u2705",
  "\u2611",
  "\u274C",
  "\u26A0",
  "\u{1F512}",
  "\u{1F513}",
  "\u{1F511}",
  "\u{1F6E1}",
  "\u2699",
  "\u{1F527}",
  "\u{1F3A8}",
  "\u{1F5BC}",
  "\u{1F3B5}",
  "\u{1F3AC}",
  "\u{1F4F7}",
  "\u{1F3AE}",
  "\u{1F9E9}",
  "\u{1F48E}",
  "\u{1F3C6}",
  "\u{1F381}",
  "\u{1F4BB}",
  "\u{1F4F1}",
  "\u{1F5A5}",
  "\u2328",
  "\u{1F5B1}",
  "\u{1F4E1}",
  "\u{1F9E0}",
  "\u{1F4AA}",
  "\u{1F441}",
  "\u{1F44B}",
  "\u{1F43E}",
  "\u{1F98B}",
  "\u{1F33A}",
  "\u{1F340}",
  "\u{1F319}",
  "\u{1F3D4}",
  "\u{1F306}",
  "\u{1F30D}",
  "\u2708",
  "\u{1F682}"
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
    const emojiSetting = new import_obsidian.Setting(contentEl).setName("Title emoji").setDesc("Prepended to the title label.");
    const previewSpan = emojiSetting.controlEl.createSpan({ cls: "emoji-picker-preview" });
    const updatePreview = () => {
      previewSpan.setText(typeof draft._titleEmoji === "string" ? draft._titleEmoji : "");
    };
    updatePreview();
    emojiSetting.controlEl.createEl("button", { cls: "emoji-picker-clear", text: "\u2715" }).addEventListener("click", () => {
      draft._titleEmoji = "";
      updatePreview();
      gridEl.querySelectorAll(".emoji-btn.is-selected").forEach((b) => b.removeClass("is-selected"));
    });
    const gridEl = contentEl.createDiv({ cls: "emoji-picker-grid" });
    for (const emoji of EMOJI_PICKER_SET) {
      const btn = gridEl.createEl("button", { cls: "emoji-btn", text: emoji });
      if (draft._titleEmoji === emoji) btn.addClass("is-selected");
      btn.addEventListener("click", () => {
        draft._titleEmoji = emoji;
        updatePreview();
        gridEl.querySelectorAll(".emoji-btn.is-selected").forEach((b) => b.removeClass("is-selected"));
        btn.addClass("is-selected");
      });
    }
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
  }
  render(el) {
    this.containerEl = el;
    el.addClass("folder-links-block");
    this.renderContent();
  }
  renderContent() {
    const el = this.containerEl;
    if (!el) return;
    el.empty();
    const { title = "Quick Links", folder = "", links = [] } = this.instance.config;
    this.renderHeader(el, title);
    const list = el.createDiv({ cls: "folder-links-list" });
    if (folder) {
      const folderObj = this.app.vault.getAbstractFileByPath(folder);
      if (folderObj instanceof import_obsidian7.TFolder) {
        const notes = folderObj.children.filter((child) => child instanceof import_obsidian7.TFile && child.extension === "md").sort((a, b) => a.basename.localeCompare(b.basename));
        for (const file of notes) {
          const item = list.createDiv({ cls: "folder-link-item" });
          const btn = item.createEl("button", { cls: "folder-link-btn" });
          btn.createSpan({ text: file.basename });
          btn.addEventListener("click", () => {
            this.app.workspace.openLinkText(file.path, "");
          });
        }
        if (notes.length === 0) {
          list.createEl("p", { text: "No notes in this folder.", cls: "block-loading" });
        }
      } else {
        list.createEl("p", { text: `Folder "${folder}" not found.`, cls: "block-loading" });
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
    colsEl.style.columnCount = String(columns);
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
    gallery.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBpdGVtczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVmFsdWVzJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnVmFsdWVzJywgY29sdW1uczogMiwgaXRlbXM6IFtdIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMiB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFRhZ0dyaWRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgIGRpc3BsYXlOYW1lOiAnUXVvdGVzIExpc3QnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAyLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgUXVvdGVzTGlzdEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbWFnZS1nYWxsZXJ5JyxcbiAgICBkaXNwbGF5TmFtZTogJ0ltYWdlIEdhbGxlcnknLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMywgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEltYWdlR2FsbGVyeUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdlbWJlZGRlZC1ub3RlJyxcbiAgICBkaXNwbGF5TmFtZTogJ0VtYmVkZGVkIE5vdGUnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgZmlsZVBhdGg6ICcnLCBzaG93VGl0bGU6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgRW1iZWRkZWROb3RlQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3N0YXRpYy10ZXh0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1N0YXRpYyBUZXh0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgY29udGVudDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgU3RhdGljVGV4dEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdodG1sJyxcbiAgICBkaXNwbGF5TmFtZTogJ0hUTUwgQmxvY2snLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBodG1sOiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBIdG1sQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEhvbWVwYWdlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIGltcGxlbWVudHMgSUhvbWVwYWdlUGx1Z2luIHtcbiAgbGF5b3V0OiBMYXlvdXRDb25maWcgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJlZ2lzdGVyQmxvY2tzKCk7XG5cbiAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCkgYXMgdW5rbm93bjtcbiAgICB0aGlzLmxheW91dCA9IHZhbGlkYXRlTGF5b3V0KHJhdyk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmKSA9PiBuZXcgSG9tZXBhZ2VWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4taG9tZXBhZ2UnLFxuICAgICAgbmFtZTogJ09wZW4gSG9tZXBhZ2UnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHsgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpOyB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdob21lJywgJ09wZW4gSG9tZXBhZ2UnLCAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSk7XG5cbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEhvbWVwYWdlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMubGF5b3V0Lm9wZW5PblN0YXJ0dXApIHtcbiAgICAgICAgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb251bmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZUxheW91dChsYXlvdXQ6IExheW91dENvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGF5b3V0ID0gbGF5b3V0O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEobGF5b3V0KTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5Ib21lcGFnZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyB0YWIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEhvbWVwYWdlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IEhvbWVwYWdlUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSG9tZXBhZ2UgQmxvY2tzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ09wZW4gb24gc3RhcnR1cCcpXG4gICAgICAuc2V0RGVzYygnQXV0b21hdGljYWxseSBvcGVuIHRoZSBob21lcGFnZSB3aGVuIE9ic2lkaWFuIHN0YXJ0cy4nKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxheW91dC5vcGVuT25TdGFydHVwID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRGVmYXVsdCBjb2x1bW5zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZCBsYXlvdXQuJylcbiAgICAgIC5hZGREcm9wZG93bihkcm9wID0+XG4gICAgICAgIGRyb3BcbiAgICAgICAgICAuYWRkT3B0aW9uKCcyJywgJzIgY29sdW1ucycpXG4gICAgICAgICAgLmFkZE9wdGlvbignMycsICczIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzQnLCAnNCBjb2x1bW5zJylcbiAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyA9IE51bWJlcih2YWx1ZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KHRoaXMucGx1Z2luLmxheW91dCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUmVzZXQgdG8gZGVmYXVsdCBsYXlvdXQnKVxuICAgICAgLnNldERlc2MoJ1Jlc3RvcmUgYWxsIGJsb2NrcyB0byB0aGUgb3JpZ2luYWwgZGVmYXVsdCBsYXlvdXQuIENhbm5vdCBiZSB1bmRvbmUuJylcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZXNldCBsYXlvdXQnKS5zZXRXYXJuaW5nKCkub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChnZXREZWZhdWx0TGF5b3V0KCkpO1xuICAgICAgICAgIGZvciAoY29uc3QgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkpIHtcbiAgICAgICAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBIb21lcGFnZVZpZXcpIHtcbiAgICAgICAgICAgICAgYXdhaXQgbGVhZi52aWV3LnJlbG9hZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBJSG9tZXBhZ2VQbHVnaW4sIExheW91dENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5pbXBvcnQgeyBFZGl0VG9vbGJhciB9IGZyb20gJy4vRWRpdFRvb2xiYXInO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFID0gJ2hvbWVwYWdlLWJsb2Nrcyc7XG5cbmV4cG9ydCBjbGFzcyBIb21lcGFnZVZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRvb2xiYXI6IEVkaXRUb29sYmFyIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIFZJRVdfVFlQRTsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gJ0hvbWVwYWdlJzsgfVxuICBnZXRJY29uKCk6IHN0cmluZyB7IHJldHVybiAnaG9tZSc7IH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gRnVsbCB0ZWFyZG93bjogdW5sb2FkcyBibG9ja3MgQU5EIHJlbW92ZXMgdGhlIGdyaWQgRE9NIGVsZW1lbnRcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcblxuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcygnaG9tZXBhZ2UtdmlldycpO1xuXG4gICAgY29uc3QgbGF5b3V0OiBMYXlvdXRDb25maWcgPSB0aGlzLnBsdWdpbi5sYXlvdXQ7XG5cbiAgICBjb25zdCBvbkxheW91dENoYW5nZSA9IChuZXdMYXlvdXQ6IExheW91dENvbmZpZykgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0ID0gbmV3TGF5b3V0O1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KG5ld0xheW91dCk7XG4gICAgfTtcblxuICAgIHRoaXMuZ3JpZCA9IG5ldyBHcmlkTGF5b3V0KGNvbnRlbnRFbCwgdGhpcy5hcHAsIHRoaXMucGx1Z2luLCBvbkxheW91dENoYW5nZSk7XG5cbiAgICB0aGlzLnRvb2xiYXIgPSBuZXcgRWRpdFRvb2xiYXIoXG4gICAgICBjb250ZW50RWwsXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgdGhpcy5ncmlkLFxuICAgICAgKGNvbHVtbnMpID0+IHsgdGhpcy5ncmlkPy5zZXRDb2x1bW5zKGNvbHVtbnMpOyB9LFxuICAgICk7XG5cbiAgICAvLyBUb29sYmFyIG11c3QgYXBwZWFyIGFib3ZlIHRoZSBncmlkIGluIHRoZSBmbGV4LWNvbHVtbiBsYXlvdXRcbiAgICBjb250ZW50RWwuaW5zZXJ0QmVmb3JlKHRoaXMudG9vbGJhci5nZXRFbGVtZW50KCksIHRoaXMuZ3JpZC5nZXRFbGVtZW50KCkpO1xuXG4gICAgdGhpcy5ncmlkLnJlbmRlcihsYXlvdXQuYmxvY2tzLCBsYXlvdXQuY29sdW1ucyk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZ3JpZD8uZGVzdHJveSgpO1xuICAgIHRoaXMudG9vbGJhcj8uZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqIFJlLXJlbmRlciB0aGUgdmlldyBmcm9tIHNjcmF0Y2ggKGUuZy4gYWZ0ZXIgc2V0dGluZ3MgcmVzZXQpLiAqL1xuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5vbk9wZW4oKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNldEljb24gfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZWZmZWN0aXZlQ29sdW1ucyA9IDM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IG5ld0VmZmVjdGl2ZSA9IHRoaXMuY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnModGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgICAgaWYgKG5ld0VmZmVjdGl2ZSAhPT0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5ncmlkRWwpO1xuICB9XG5cbiAgLyoqIEV4cG9zZSB0aGUgcm9vdCBncmlkIGVsZW1lbnQgc28gSG9tZXBhZ2VWaWV3IGNhbiByZW9yZGVyIGl0IGluIHRoZSBET00uICovXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmdyaWRFbDtcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZUVmZmVjdGl2ZUNvbHVtbnMobGF5b3V0Q29sdW1uczogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCB3ID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGg7XG4gICAgaWYgKHcgPiAwICYmIHcgPD0gNTQwKSByZXR1cm4gMTtcbiAgICBpZiAodyA+IDAgJiYgdyA8PSA4NDApIHJldHVybiBNYXRoLm1pbigyLCBsYXlvdXRDb2x1bW5zKTtcbiAgICByZXR1cm4gbGF5b3V0Q29sdW1ucztcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwuZW1wdHkoKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZCcpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSBibG9ja3MnKTtcbiAgICB0aGlzLmVmZmVjdGl2ZUNvbHVtbnMgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGNvbHVtbnMpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuZ3JpZEVsLmFkZENsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ncmlkRWwucmVtb3ZlQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH1cblxuICAgIGlmIChibG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eSA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWVtcHR5LXN0YXRlJyB9KTtcbiAgICAgIGVtcHR5LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnTm8gYmxvY2tzIHlldC4gQ2xpY2sgRWRpdCB0byBhZGQgeW91ciBmaXJzdCBibG9jay4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgYmxvY2tzKSB7XG4gICAgICB0aGlzLnJlbmRlckJsb2NrKGluc3RhbmNlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KGluc3RhbmNlLnR5cGUpO1xuICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLWJsb2NrLXdyYXBwZXInIH0pO1xuICAgIHdyYXBwZXIuZGF0YXNldC5ibG9ja0lkID0gaW5zdGFuY2UuaWQ7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZ3JpZGNlbGwnKTtcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGZhY3RvcnkuZGlzcGxheU5hbWUpO1xuICAgIHRoaXMuYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlciwgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stY29udGVudCcgfSk7XG4gICAgY29uc3QgYmxvY2sgPSBmYWN0b3J5LmNyZWF0ZSh0aGlzLmFwcCwgaW5zdGFuY2UsIHRoaXMucGx1Z2luKTtcbiAgICBibG9jay5sb2FkKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYmxvY2sucmVuZGVyKGNvbnRlbnRFbCk7XG4gICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJlc3VsdC5jYXRjaChlID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0hvbWVwYWdlIEJsb2Nrc10gRXJyb3IgcmVuZGVyaW5nIGJsb2NrICR7aW5zdGFuY2UudHlwZX06YCwgZSk7XG4gICAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgYmxvY2suIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLmJsb2Nrcy5zZXQoaW5zdGFuY2UuaWQsIHsgYmxvY2ssIHdyYXBwZXIgfSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGNvbHMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGluc3RhbmNlLmNvbFNwYW4sIGNvbHMpO1xuICAgIC8vIGZsZXgtZ3JvdyBwcm9wb3J0aW9uYWwgdG8gY29sU3BhbiBzbyB3cmFwcGVkIGl0ZW1zIHN0cmV0Y2ggdG8gZmlsbCB0aGUgcm93XG4gICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGNvbFNwYW4gLyBjb2xzKSAqIDEwMDtcbiAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjb2xTcGFufSAwIGNhbGMoJHtiYXNpc1BlcmNlbnR9JSAtIHZhcigtLWhwLWdhcCwgMTZweCkpYDtcbiAgICB3cmFwcGVyLnN0eWxlLm1pbldpZHRoID0gJzAnO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hFZGl0SGFuZGxlcyh3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBiYXIgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWhhbmRsZS1iYXInIH0pO1xuXG4gICAgY29uc3QgaGFuZGxlID0gYmFyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLW1vdmUtaGFuZGxlJyB9KTtcbiAgICBzZXRJY29uKGhhbmRsZSwgJ2dyaXAtdmVydGljYWwnKTtcbiAgICBoYW5kbGUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVvcmRlcicpO1xuXG4gICAgY29uc3Qgc2V0dGluZ3NCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stc2V0dGluZ3MtYnRuJyB9KTtcbiAgICBzZXRJY29uKHNldHRpbmdzQnRuLCAnc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQmxvY2sgc2V0dGluZ3MnKTtcbiAgICBzZXR0aW5nc0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmJsb2Nrcy5nZXQoaW5zdGFuY2UuaWQpO1xuICAgICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuICAgICAgY29uc3Qgb25TYXZlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyBpbnN0YW5jZSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuICAgICAgbmV3IEJsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgaW5zdGFuY2UsIGVudHJ5LmJsb2NrLCBvblNhdmUpLm9wZW4oKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1yZW1vdmUtYnRuJyB9KTtcbiAgICBzZXRJY29uKHJlbW92ZUJ0biwgJ3gnKTtcbiAgICByZW1vdmVCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1JlbW92ZSBibG9jaycpO1xuICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgbmV3IFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsKHRoaXMuYXBwLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnIH0pO1xuICAgIHNldEljb24oZ3JpcCwgJ21heGltaXplLTInKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIHRoaXMuYXR0YWNoUmVzaXplSGFuZGxlcihncmlwLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICB0aGlzLmF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZSwgd3JhcHBlciwgaW5zdGFuY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hEcmFnSGFuZGxlcihoYW5kbGU6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IGNsb25lID0gd3JhcHBlci5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBjbG9uZS5hZGRDbGFzcygnYmxvY2stZHJhZy1jbG9uZScpO1xuICAgICAgY2xvbmUuc3R5bGUud2lkdGggPSBgJHt3cmFwcGVyLm9mZnNldFdpZHRofXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmhlaWdodCA9IGAke3dyYXBwZXIub2Zmc2V0SGVpZ2h0fXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHtlLmNsaWVudFggLSAyMH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHtlLmNsaWVudFkgLSAyMH1weGA7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBjbG9uZTtcblxuICAgICAgY29uc3Qgc291cmNlSWQgPSBpbnN0YW5jZS5pZDtcbiAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHttZS5jbGllbnRYIC0gMjB9cHhgO1xuICAgICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHttZS5jbGllbnRZIC0gMjB9cHhgO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldCh0YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY2xvbmUucmVtb3ZlKCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuICAgICAgICB3cmFwcGVyLnJlbW92ZUNsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5zd2FwQmxvY2tzKHNvdXJjZUlkLCB0YXJnZXRJZCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoUmVzaXplSGFuZGxlcihncmlwOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgZ3JpcC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IHN0YXJ0WCA9IGUuY2xpZW50WDtcbiAgICAgIGNvbnN0IHN0YXJ0Q29sU3BhbiA9IGluc3RhbmNlLmNvbFNwYW47XG4gICAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zO1xuICAgICAgY29uc3QgY29sV2lkdGggPSB0aGlzLmdyaWRFbC5vZmZzZXRXaWR0aCAvIGNvbHVtbnM7XG4gICAgICBsZXQgY3VycmVudENvbFNwYW4gPSBzdGFydENvbFNwYW47XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGRlbHRhWCA9IG1lLmNsaWVudFggLSBzdGFydFg7XG4gICAgICAgIGNvbnN0IGRlbHRhQ29scyA9IE1hdGgucm91bmQoZGVsdGFYIC8gY29sV2lkdGgpO1xuICAgICAgICBjdXJyZW50Q29sU3BhbiA9IE1hdGgubWF4KDEsIE1hdGgubWluKGNvbHVtbnMsIHN0YXJ0Q29sU3BhbiArIGRlbHRhQ29scykpO1xuICAgICAgICBjb25zdCBiYXNpc1BlcmNlbnQgPSAoY3VycmVudENvbFNwYW4gLyBjb2x1bW5zKSAqIDEwMDtcbiAgICAgICAgd3JhcHBlci5zdHlsZS5mbGV4ID0gYCR7Y3VycmVudENvbFNwYW59IDAgY2FsYygke2Jhc2lzUGVyY2VudH0lIC0gdmFyKC0taHAtZ2FwLCAxNnB4KSlgO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PlxuICAgICAgICAgIGIuaWQgPT09IGluc3RhbmNlLmlkID8geyAuLi5iLCBjb2xTcGFuOiBjdXJyZW50Q29sU3BhbiB9IDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZEJsb2NrVW5kZXJDdXJzb3IoeDogbnVtYmVyLCB5OiBudW1iZXIsIGV4Y2x1ZGVJZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgZm9yIChjb25zdCBbaWQsIHsgd3JhcHBlciB9XSBvZiB0aGlzLmJsb2Nrcykge1xuICAgICAgaWYgKGlkID09PSBleGNsdWRlSWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcmVjdCA9IHdyYXBwZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBpZiAoeCA+PSByZWN0LmxlZnQgJiYgeCA8PSByZWN0LnJpZ2h0ICYmIHkgPj0gcmVjdC50b3AgJiYgeSA8PSByZWN0LmJvdHRvbSkge1xuICAgICAgICByZXR1cm4gaWQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqIFN3YXAgcG9zaXRpb25zIG9mIHR3byBibG9ja3MgdXNpbmcgaW1tdXRhYmxlIHVwZGF0ZXMuICovXG4gIHByaXZhdGUgc3dhcEJsb2NrcyhpZEE6IHN0cmluZywgaWRCOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBiQSA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmluZChiID0+IGIuaWQgPT09IGlkQSk7XG4gICAgY29uc3QgYkIgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBpZEIpO1xuICAgIGlmICghYkEgfHwgIWJCKSByZXR1cm47XG5cbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGlmIChiLmlkID09PSBpZEEpIHJldHVybiB7IC4uLmIsIGNvbDogYkIuY29sLCByb3c6IGJCLnJvdywgY29sU3BhbjogYkIuY29sU3Bhbiwgcm93U3BhbjogYkIucm93U3BhbiB9O1xuICAgICAgaWYgKGIuaWQgPT09IGlkQikgcmV0dXJuIHsgLi4uYiwgY29sOiBiQS5jb2wsIHJvdzogYkEucm93LCBjb2xTcGFuOiBiQS5jb2xTcGFuLCByb3dTcGFuOiBiQS5yb3dTcGFuIH07XG4gICAgICByZXR1cm4gYjtcbiAgICB9KTtcblxuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHNldEVkaXRNb2RlKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLmVkaXRNb2RlID0gZW5hYmxlZDtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICAvKiogVXBkYXRlIGNvbHVtbiBjb3VudCwgY2xhbXBpbmcgZWFjaCBibG9jaydzIGNvbCBhbmQgY29sU3BhbiB0byBmaXQuICovXG4gIHNldENvbHVtbnMobjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBjb25zdCBjb2wgPSBNYXRoLm1pbihiLmNvbCwgbik7XG4gICAgICBjb25zdCBjb2xTcGFuID0gTWF0aC5taW4oYi5jb2xTcGFuLCBuIC0gY29sICsgMSk7XG4gICAgICByZXR1cm4geyAuLi5iLCBjb2wsIGNvbFNwYW4gfTtcbiAgICB9KTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBjb2x1bW5zOiBuLCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBhZGRCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IFsuLi50aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCBpbnN0YW5jZV07XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXJlbmRlcigpOiB2b2lkIHtcbiAgICBjb25zdCBmb2N1c2VkID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICBjb25zdCBmb2N1c2VkQmxvY2tJZCA9IChmb2N1c2VkPy5jbG9zZXN0KCdbZGF0YS1ibG9jay1pZF0nKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5kYXRhc2V0LmJsb2NrSWQ7XG4gICAgdGhpcy5yZW5kZXIodGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpO1xuICAgIGlmIChmb2N1c2VkQmxvY2tJZCkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgW2RhdGEtYmxvY2staWQ9XCIke2ZvY3VzZWRCbG9ja0lkfVwiXWApO1xuICAgICAgZWw/LmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFVubG9hZCBhbGwgYmxvY2tzIGFuZCBjYW5jZWwgYW55IGluLXByb2dyZXNzIGRyYWcvcmVzaXplLiAqL1xuICBkZXN0cm95QWxsKCk6IHZvaWQge1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZUNsb25lPy5yZW1vdmUoKTtcbiAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcblxuICAgIGZvciAoY29uc3QgeyBibG9jayB9IG9mIHRoaXMuYmxvY2tzLnZhbHVlcygpKSB7XG4gICAgICBibG9jay51bmxvYWQoKTtcbiAgICB9XG4gICAgdGhpcy5ibG9ja3MuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKiBGdWxsIHRlYXJkb3duOiB1bmxvYWQgYmxvY2tzIGFuZCByZW1vdmUgdGhlIGdyaWQgZWxlbWVudCBmcm9tIHRoZSBET00uICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBudWxsO1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLnJlbW92ZSgpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBzZXR0aW5ncyBtb2RhbCAodGl0bGUgc2VjdGlvbiArIGJsb2NrLXNwZWNpZmljIHNldHRpbmdzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3QgRU1PSklfUElDS0VSX1NFVCA9IFtcbiAgJ1x1RDgzRFx1RENDMScsJ1x1RDgzRFx1RENDMicsJ1x1RDgzRFx1RENDNCcsJ1x1RDgzRFx1RENERCcsJ1x1RDgzRFx1RENDQicsJ1x1RDgzRFx1RENDQycsJ1x1RDgzRFx1RENDRCcsJ1x1RDgzRFx1REQxNicsJ1x1RDgzRFx1RERDMicsJ1x1RDgzRFx1RERDMycsXG4gICdcdUQ4M0RcdURDQTEnLCdcdUQ4M0RcdUREMEQnLCdcdUQ4M0RcdUREMEUnLCdcdUQ4M0RcdUREMTcnLCdcdTJCNTAnLCdcdUQ4M0NcdURGMUYnLCdcdTI3MjgnLCdcdUQ4M0NcdURGQUYnLCdcdUQ4M0RcdURFODAnLCdcdUQ4M0NcdURGRTAnLFxuICAnXHVEODNDXHVERjNGJywnXHVEODNDXHVERjMxJywnXHVEODNDXHVERjM4JywnXHVEODNDXHVERjBBJywnXHVEODNEXHVERDI1JywnXHUyNzQ0JywnXHVEODNDXHVERjE5JywnXHUyNjAwJywnXHVEODNDXHVERjA4JywnXHUyNkExJyxcbiAgJ1x1RDgzRFx1RENBQycsJ1x1RDgzRFx1RENBRCcsJ1x1RDgzRFx1RERFMycsJ1x1RDgzRFx1RENFMicsJ1x1RDgzRFx1RENFMycsJ1x1RDgzRFx1REQxNCcsJ1x1RDgzRFx1REQxNScsJ1x1RDgzRFx1RENDNScsJ1x1RDgzRFx1RENDNicsJ1x1RDgzRFx1REREMycsXG4gICdcdTI3MDUnLCdcdTI2MTEnLCdcdTI3NEMnLCdcdTI2QTAnLCdcdUQ4M0RcdUREMTInLCdcdUQ4M0RcdUREMTMnLCdcdUQ4M0RcdUREMTEnLCdcdUQ4M0RcdURFRTEnLCdcdTI2OTknLCdcdUQ4M0RcdUREMjcnLFxuICAnXHVEODNDXHVERkE4JywnXHVEODNEXHVEREJDJywnXHVEODNDXHVERkI1JywnXHVEODNDXHVERkFDJywnXHVEODNEXHVEQ0Y3JywnXHVEODNDXHVERkFFJywnXHVEODNFXHVEREU5JywnXHVEODNEXHVEQzhFJywnXHVEODNDXHVERkM2JywnXHVEODNDXHVERjgxJyxcbiAgJ1x1RDgzRFx1RENCQicsJ1x1RDgzRFx1RENGMScsJ1x1RDgzRFx1RERBNScsJ1x1MjMyOCcsJ1x1RDgzRFx1RERCMScsJ1x1RDgzRFx1RENFMScsJ1x1RDgzRVx1RERFMCcsJ1x1RDgzRFx1RENBQScsJ1x1RDgzRFx1REM0MScsJ1x1RDgzRFx1REM0QicsXG4gICdcdUQ4M0RcdURDM0UnLCdcdUQ4M0VcdUREOEInLCdcdUQ4M0NcdURGM0EnLCdcdUQ4M0NcdURGNDAnLCdcdUQ4M0NcdURGMTknLCdcdUQ4M0NcdURGRDQnLCdcdUQ4M0NcdURGMDYnLCdcdUQ4M0NcdURGMEQnLCdcdTI3MDgnLCdcdUQ4M0RcdURFODInLFxuXTtcblxuY2xhc3MgQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlLFxuICAgIHByaXZhdGUgYmxvY2s6IEJhc2VCbG9jayxcbiAgICBwcml2YXRlIG9uU2F2ZTogKCkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQmxvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5pbnN0YW5jZS5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1RpdGxlIGxhYmVsJylcbiAgICAgIC5zZXREZXNjKCdMZWF2ZSBlbXB0eSB0byB1c2UgdGhlIGRlZmF1bHQgdGl0bGUuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0eXBlb2YgZHJhZnQuX3RpdGxlTGFiZWwgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlTGFiZWwgOiAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignRGVmYXVsdCB0aXRsZScpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll90aXRsZUxhYmVsID0gdjsgfSksXG4gICAgICApO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIEVtb2ppIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBlbW9qaVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnVGl0bGUgZW1vamknKVxuICAgICAgLnNldERlc2MoJ1ByZXBlbmRlZCB0byB0aGUgdGl0bGUgbGFiZWwuJyk7XG5cbiAgICBjb25zdCBwcmV2aWV3U3BhbiA9IGVtb2ppU2V0dGluZy5jb250cm9sRWwuY3JlYXRlU3Bhbih7IGNsczogJ2Vtb2ppLXBpY2tlci1wcmV2aWV3JyB9KTtcbiAgICBjb25zdCB1cGRhdGVQcmV2aWV3ID0gKCkgPT4ge1xuICAgICAgcHJldmlld1NwYW4uc2V0VGV4dCh0eXBlb2YgZHJhZnQuX3RpdGxlRW1vamkgPT09ICdzdHJpbmcnID8gZHJhZnQuX3RpdGxlRW1vamkgOiAnJyk7XG4gICAgfTtcbiAgICB1cGRhdGVQcmV2aWV3KCk7XG5cbiAgICBlbW9qaVNldHRpbmcuY29udHJvbEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLXBpY2tlci1jbGVhcicsIHRleHQ6ICdcdTI3MTUnIH0pXG4gICAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGRyYWZ0Ll90aXRsZUVtb2ppID0gJyc7XG4gICAgICAgIHVwZGF0ZVByZXZpZXcoKTtcbiAgICAgICAgZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCcuZW1vamktYnRuLmlzLXNlbGVjdGVkJylcbiAgICAgICAgICAuZm9yRWFjaChiID0+IGIucmVtb3ZlQ2xhc3MoJ2lzLXNlbGVjdGVkJykpO1xuICAgICAgfSk7XG5cbiAgICBjb25zdCBncmlkRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1vamktcGlja2VyLWdyaWQnIH0pO1xuICAgIGZvciAoY29uc3QgZW1vamkgb2YgRU1PSklfUElDS0VSX1NFVCkge1xuICAgICAgY29uc3QgYnRuID0gZ3JpZEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Vtb2ppLWJ0bicsIHRleHQ6IGVtb2ppIH0pO1xuICAgICAgaWYgKGRyYWZ0Ll90aXRsZUVtb2ppID09PSBlbW9qaSkgYnRuLmFkZENsYXNzKCdpcy1zZWxlY3RlZCcpO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkcmFmdC5fdGl0bGVFbW9qaSA9IGVtb2ppO1xuICAgICAgICB1cGRhdGVQcmV2aWV3KCk7XG4gICAgICAgIGdyaWRFbC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PignLmVtb2ppLWJ0bi5pcy1zZWxlY3RlZCcpXG4gICAgICAgICAgLmZvckVhY2goYiA9PiBiLnJlbW92ZUNsYXNzKCdpcy1zZWxlY3RlZCcpKTtcbiAgICAgICAgYnRuLmFkZENsYXNzKCdpcy1zZWxlY3RlZCcpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0hpZGUgdGl0bGUnKVxuICAgICAgLmFkZFRvZ2dsZSh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuX2hpZGVUaXRsZSA9PT0gdHJ1ZSlcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuX2hpZGVUaXRsZSA9IHY7IH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBkcmFmdDtcbiAgICAgICAgICB0aGlzLm9uU2F2ZSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcblxuICAgIGNvbnN0IGhyID0gY29udGVudEVsLmNyZWF0ZUVsKCdocicpO1xuICAgIGhyLnN0eWxlLm1hcmdpbiA9ICcxNnB4IDAnO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywge1xuICAgICAgdGV4dDogJ0Jsb2NrLXNwZWNpZmljIHNldHRpbmdzOicsXG4gICAgICBjbHM6ICdzZXR0aW5nLWl0ZW0tbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ29uZmlndXJlIGJsb2NrLi4uJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIHRoaXMuYmxvY2sub3BlblNldHRpbmdzKHRoaXMub25TYXZlKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUmVtb3ZlIGNvbmZpcm1hdGlvbiBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1JlbW92ZSBibG9jaz8nIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ1RoaXMgYmxvY2sgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGhvbWVwYWdlLicgfSk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1JlbW92ZScpLnNldFdhcm5pbmcoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9uQ29uZmlybSgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnQ2FuY2VsJykub25DbGljaygoKSA9PiB0aGlzLmNsb3NlKCkpLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBCbG9ja0ZhY3RvcnksIEJsb2NrVHlwZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5jbGFzcyBCbG9ja1JlZ2lzdHJ5Q2xhc3Mge1xuICBwcml2YXRlIGZhY3RvcmllcyA9IG5ldyBNYXA8QmxvY2tUeXBlLCBCbG9ja0ZhY3Rvcnk+KCk7XG5cbiAgcmVnaXN0ZXIoZmFjdG9yeTogQmxvY2tGYWN0b3J5KTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuc2V0KGZhY3RvcnkudHlwZSwgZmFjdG9yeSk7XG4gIH1cblxuICBnZXQodHlwZTogQmxvY2tUeXBlKTogQmxvY2tGYWN0b3J5IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5mYWN0b3JpZXMuZ2V0KHR5cGUpO1xuICB9XG5cbiAgZ2V0QWxsKCk6IEJsb2NrRmFjdG9yeVtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmZhY3Rvcmllcy52YWx1ZXMoKSk7XG4gIH1cblxuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5jbGVhcigpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBCbG9ja1JlZ2lzdHJ5ID0gbmV3IEJsb2NrUmVnaXN0cnlDbGFzcygpO1xuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBCbG9ja1R5cGUsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sYmFyIHtcbiAgcHJpdmF0ZSB0b29sYmFyRWw6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQsXG4gICAgcHJpdmF0ZSBvbkNvbHVtbnNDaGFuZ2U6IChuOiBudW1iZXIpID0+IHZvaWQsXG4gICkge1xuICAgIHRoaXMudG9vbGJhckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtdG9vbGJhcicgfSk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3Rvb2xiYXInKTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgdG9vbGJhcicpO1xuICAgIHRoaXMucmVuZGVyVG9vbGJhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJUb29sYmFyKCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLmVtcHR5KCk7XG5cbiAgICAvLyBDb2x1bW4gY291bnQgc2VsZWN0b3JcbiAgICBjb25zdCBjb2xTZWxlY3QgPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnc2VsZWN0JywgeyBjbHM6ICd0b29sYmFyLWNvbC1zZWxlY3QnIH0pO1xuICAgIGNvbFNlbGVjdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTnVtYmVyIG9mIGNvbHVtbnMnKTtcbiAgICBbMiwgMywgNF0uZm9yRWFjaChuID0+IHtcbiAgICAgIGNvbnN0IG9wdCA9IGNvbFNlbGVjdC5jcmVhdGVFbCgnb3B0aW9uJywgeyB2YWx1ZTogU3RyaW5nKG4pLCB0ZXh0OiBgJHtufSBjb2xgIH0pO1xuICAgICAgaWYgKG4gPT09IHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgIH0pO1xuICAgIGNvbFNlbGVjdC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICB0aGlzLm9uQ29sdW1uc0NoYW5nZShOdW1iZXIoY29sU2VsZWN0LnZhbHVlKSk7XG4gICAgfSk7XG5cbiAgICAvLyBFZGl0IHRvZ2dsZVxuICAgIGNvbnN0IGVkaXRCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWVkaXQtYnRuJyB9KTtcbiAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgZWRpdEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIHRoaXMuZWRpdE1vZGUgPSAhdGhpcy5lZGl0TW9kZTtcbiAgICAgIHRoaXMuZ3JpZC5zZXRFZGl0TW9kZSh0aGlzLmVkaXRNb2RlKTtcbiAgICAgIHRoaXMudXBkYXRlRWRpdEJ0bihlZGl0QnRuKTtcbiAgICAgIHRoaXMuc3luY0FkZEJ1dHRvbigpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZWRpdE1vZGUpIHtcbiAgICAgIHRoaXMuYXBwZW5kQWRkQnV0dG9uKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVFZGl0QnRuKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiB2b2lkIHtcbiAgICBidG4udGV4dENvbnRlbnQgPSB0aGlzLmVkaXRNb2RlID8gJ1x1MjcxMyBEb25lJyA6ICdcdTI3MEYgRWRpdCc7XG4gICAgYnRuLnRvZ2dsZUNsYXNzKCd0b29sYmFyLWJ0bi1hY3RpdmUnLCB0aGlzLmVkaXRNb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY0FkZEJ1dHRvbigpOiB2b2lkIHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudG9vbGJhckVsLnF1ZXJ5U2VsZWN0b3IoJy50b29sYmFyLWFkZC1idG4nKTtcbiAgICBpZiAodGhpcy5lZGl0TW9kZSAmJiAhZXhpc3RpbmcpIHtcbiAgICAgIHRoaXMuYXBwZW5kQWRkQnV0dG9uKCk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5lZGl0TW9kZSAmJiBleGlzdGluZykge1xuICAgICAgZXhpc3RpbmcucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmRBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgYWRkQnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1hZGQtYnRuJywgdGV4dDogJysgQWRkIEJsb2NrJyB9KTtcbiAgICBhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBuZXcgQWRkQmxvY2tNb2RhbCh0aGlzLmFwcCwgKHR5cGUpID0+IHtcbiAgICAgICAgY29uc3QgZmFjdG9yeSA9IEJsb2NrUmVnaXN0cnkuZ2V0KHR5cGUpO1xuICAgICAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtYXhSb3cgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLnJlZHVjZShcbiAgICAgICAgICAobWF4LCBiKSA9PiBNYXRoLm1heChtYXgsIGIucm93ICsgYi5yb3dTcGFuIC0gMSksIDAsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UgPSB7XG4gICAgICAgICAgaWQ6IGNyeXB0by5yYW5kb21VVUlEKCksXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBjb2w6IDEsXG4gICAgICAgICAgcm93OiBtYXhSb3cgKyAxLFxuICAgICAgICAgIGNvbFNwYW46IE1hdGgubWluKGZhY3RvcnkuZGVmYXVsdFNpemUuY29sU3BhbiwgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpLFxuICAgICAgICAgIHJvd1NwYW46IGZhY3RvcnkuZGVmYXVsdFNpemUucm93U3BhbixcbiAgICAgICAgICBjb25maWc6IHsgLi4uZmFjdG9yeS5kZWZhdWx0Q29uZmlnIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5ncmlkLmFkZEJsb2NrKGluc3RhbmNlKTtcbiAgICAgIH0pLm9wZW4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLnRvb2xiYXJFbDtcbiAgfVxuXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuY29uc3QgQkxPQ0tfSUNPTlM6IFJlY29yZDxCbG9ja1R5cGUsIHN0cmluZz4gPSB7XG4gICdncmVldGluZyc6ICAgICAgJ1x1RDgzRFx1REM0QicsXG4gICdjbG9jayc6ICAgICAgICAgJ1x1RDgzRFx1REQ1MCcsXG4gICdmb2xkZXItbGlua3MnOiAgJ1x1RDgzRFx1REQxNycsXG4gICdpbnNpZ2h0JzogICAgICAgJ1x1RDgzRFx1RENBMScsXG4gICd0YWctZ3JpZCc6ICAgICAgJ1x1RDgzQ1x1REZGN1x1RkUwRicsXG4gICdxdW90ZXMtbGlzdCc6ICAgJ1x1RDgzRFx1RENBQycsXG4gICdpbWFnZS1nYWxsZXJ5JzogJ1x1RDgzRFx1RERCQ1x1RkUwRicsXG4gICdlbWJlZGRlZC1ub3RlJzogJ1x1RDgzRFx1RENDNCcsXG4gICdzdGF0aWMtdGV4dCc6ICAgJ1x1RDgzRFx1RENERCcsXG4gICdodG1sJzogICAgICAgICAgJzwvPicsXG59O1xuXG5jbGFzcyBBZGRCbG9ja01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uU2VsZWN0OiAodHlwZTogQmxvY2tUeXBlKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBZGQgQmxvY2snLCBjbHM6ICdhZGQtYmxvY2stbW9kYWwtdGl0bGUnIH0pO1xuXG4gICAgY29uc3QgZ3JpZCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdhZGQtYmxvY2stZ3JpZCcgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGZhY3Rvcnkgb2YgQmxvY2tSZWdpc3RyeS5nZXRBbGwoKSkge1xuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdhZGQtYmxvY2stb3B0aW9uJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLWljb24nLCB0ZXh0OiBCTE9DS19JQ09OU1tmYWN0b3J5LnR5cGVdID8/ICdcdTI1QUEnIH0pO1xuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdhZGQtYmxvY2stbmFtZScsIHRleHQ6IGZhY3RvcnkuZGlzcGxheU5hbWUgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMub25TZWxlY3QoZmFjdG9yeS50eXBlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEdyZWV0aW5nQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdncmVldGluZy1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd1RpbWU/OiBib29sZWFuIH07XG5cbiAgICBpZiAoc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctdGltZScgfSk7XG4gICAgfVxuICAgIHRoaXMubmFtZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctbmFtZScgfSk7XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgaG91ciA9IG5vdy5ob3VyKCk7XG4gICAgY29uc3QgeyBuYW1lID0gJ2JlbnRvcm5hdG8nLCBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgICBzaG93VGltZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGNvbnN0IHNhbHV0YXRpb24gPVxuICAgICAgaG91ciA+PSA1ICYmIGhvdXIgPCAxMiA/ICdCdW9uZ2lvcm5vJyA6XG4gICAgICBob3VyID49IDEyICYmIGhvdXIgPCAxOCA/ICdCdW9uIHBvbWVyaWdnaW8nIDpcbiAgICAgICdCdW9uYXNlcmEnO1xuXG4gICAgaWYgKHRoaXMudGltZUVsICYmIHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ0hIOm1tJykpO1xuICAgIH1cbiAgICBpZiAodGhpcy5uYW1lRWwpIHtcbiAgICAgIHRoaXMubmFtZUVsLnNldFRleHQoYCR7c2FsdXRhdGlvbn0sICR7bmFtZX1gKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEdyZWV0aW5nU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEdyZWV0aW5nU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnR3JlZXRpbmcgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdOYW1lJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0Lm5hbWUgYXMgc3RyaW5nID8/ICdiZW50b3JuYXRvJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm5hbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aW1lJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpbWUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUJsb2NrIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFwcDogQXBwLFxuICAgIHByb3RlY3RlZCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcm90ZWN0ZWQgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBhYnN0cmFjdCByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbiAgLy8gT3ZlcnJpZGUgdG8gb3BlbiBhIHBlci1ibG9jayBzZXR0aW5ncyBtb2RhbFxuICBvcGVuU2V0dGluZ3MoX29uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge31cblxuICAvLyBSZW5kZXIgdGhlIG11dGVkIHVwcGVyY2FzZSBibG9jayBoZWFkZXIgbGFiZWwuXG4gIC8vIFJlc3BlY3RzIF9oaWRlVGl0bGUsIF90aXRsZUxhYmVsLCBhbmQgX3RpdGxlRW1vamkgZnJvbSBpbnN0YW5jZS5jb25maWcuXG4gIHByb3RlY3RlZCByZW5kZXJIZWFkZXIoZWw6IEhUTUxFbGVtZW50LCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY2ZnID0gdGhpcy5pbnN0YW5jZS5jb25maWc7XG4gICAgaWYgKGNmZy5faGlkZVRpdGxlID09PSB0cnVlKSByZXR1cm47XG4gICAgY29uc3QgbGFiZWwgPSAodHlwZW9mIGNmZy5fdGl0bGVMYWJlbCA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUxhYmVsLnRyaW0oKSlcbiAgICAgID8gY2ZnLl90aXRsZUxhYmVsLnRyaW0oKVxuICAgICAgOiB0aXRsZTtcbiAgICBpZiAoIWxhYmVsKSByZXR1cm47XG4gICAgY29uc3QgaGVhZGVyID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJyB9KTtcbiAgICBpZiAodHlwZW9mIGNmZy5fdGl0bGVFbW9qaSA9PT0gJ3N0cmluZycgJiYgY2ZnLl90aXRsZUVtb2ppKSB7XG4gICAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IGNsczogJ2Jsb2NrLWhlYWRlci1lbW9qaScsIHRleHQ6IGNmZy5fdGl0bGVFbW9qaSB9KTtcbiAgICB9XG4gICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIENsb2NrQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkYXRlRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdjbG9jay1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93RGF0ZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd0RhdGU/OiBib29sZWFuIH07XG5cbiAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLXRpbWUnIH0pO1xuICAgIGlmIChzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay1kYXRlJyB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgeyBzaG93U2Vjb25kcyA9IGZhbHNlLCBzaG93RGF0ZSA9IHRydWUsIGZvcm1hdCA9ICcnIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBzaG93U2Vjb25kcz86IGJvb2xlYW47XG4gICAgICBzaG93RGF0ZT86IGJvb2xlYW47XG4gICAgICBmb3JtYXQ/OiBzdHJpbmc7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnRpbWVFbCkge1xuICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoZm9ybWF0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoc2hvd1NlY29uZHMgPyAnSEg6bW06c3MnIDogJ0hIOm1tJykpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5kYXRlRWwgJiYgc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsLnNldFRleHQobm93LmZvcm1hdCgnZGRkZCwgRCBNTU1NIFlZWVknKSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBDbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBDbG9ja1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Nsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBzZWNvbmRzJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1NlY29uZHMgYXMgYm9vbGVhbiA/PyBmYWxzZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dTZWNvbmRzID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgZGF0ZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dEYXRlIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dEYXRlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnQ3VzdG9tIGZvcm1hdCcpXG4gICAgICAuc2V0RGVzYygnT3B0aW9uYWwgbW9tZW50LmpzIGZvcm1hdCBzdHJpbmcsIGUuZy4gXCJISDptbVwiLiBMZWF2ZSBlbXB0eSBmb3IgZGVmYXVsdC4nKVxuICAgICAgLmFkZFRleHQodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0LmZvcm1hdCBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZvcm1hdCA9IHY7IH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5pbnRlcmZhY2UgTGlua0l0ZW0ge1xuICBsYWJlbDogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIGVtb2ppPzogc3RyaW5nO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25DaG9vc2U6IChmb2xkZXI6IFRGb2xkZXIpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+IGYucGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHsgdGhpcy5vbkNob29zZShmb2xkZXIpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIEZvbGRlckxpbmtzQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2ZvbGRlci1saW5rcy1ibG9jaycpO1xuICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDb250ZW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5jb250YWluZXJFbDtcbiAgICBpZiAoIWVsKSByZXR1cm47XG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnUXVpY2sgTGlua3MnLCBmb2xkZXIgPSAnJywgbGlua3MgPSBbXSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICBsaW5rcz86IExpbmtJdGVtW107XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBsaXN0ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmtzLWxpc3QnIH0pO1xuXG4gICAgLy8gQXV0by1saXN0IG5vdGVzIGZyb20gc2VsZWN0ZWQgZm9sZGVyIChzb3J0ZWQgYWxwaGFiZXRpY2FsbHkpXG4gICAgaWYgKGZvbGRlcikge1xuICAgICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgICBpZiAoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICBjb25zdCBub3RlcyA9IGZvbGRlck9iai5jaGlsZHJlblxuICAgICAgICAgIC5maWx0ZXIoKGNoaWxkKTogY2hpbGQgaXMgVEZpbGUgPT4gY2hpbGQgaW5zdGFuY2VvZiBURmlsZSAmJiBjaGlsZC5leHRlbnNpb24gPT09ICdtZCcpXG4gICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIG5vdGVzKSB7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdObyBub3RlcyBpbiB0aGlzIGZvbGRlci4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogYEZvbGRlciBcIiR7Zm9sZGVyfVwiIG5vdCBmb3VuZC5gLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYW51YWwgbGlua3NcbiAgICBmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgYnRuID0gaXRlbS5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdmb2xkZXItbGluay1idG4nIH0pO1xuICAgICAgaWYgKGxpbmsuZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICdsaW5rLWVtb2ppJywgdGV4dDogbGluay5lbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogbGluay5sYWJlbCB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChsaW5rLnBhdGgsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICghZm9sZGVyICYmIGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ0FkZCBsaW5rcyBvciBzZWxlY3QgYSBmb2xkZXIgaW4gc2V0dGluZ3MuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwoXG4gICAgICB0aGlzLmFwcCxcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgICAobmV3Q29uZmlnKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICAgICAgb25TYXZlKCk7XG4gICAgICB9LFxuICAgICkub3BlbigpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBTZXR0aW5ncyBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyTGlua3NTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVpY2sgTGlua3MgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQ6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0gPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuICAgIGRyYWZ0LmxpbmtzID8/PSBbXTtcbiAgICBjb25zdCBsaW5rcyA9IGRyYWZ0LmxpbmtzO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnUXVpY2sgTGlua3MnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdBdXRvLWxpc3QgZm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdMaXN0IGFsbCBub3RlcyBmcm9tIHRoaXMgdmF1bHQgZm9sZGVyIGFzIGxpbmtzLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdlLmcuIFByb2plY3RzJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnTWFudWFsIGxpbmtzJyB9KTtcblxuICAgIGNvbnN0IGxpbmtzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuXG4gICAgY29uc3QgcmVuZGVyTGlua3MgPSAoKSA9PiB7XG4gICAgICBsaW5rc0NvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgbGlua3MuZm9yRWFjaCgobGluaywgaSkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBsaW5rc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdzZXR0aW5ncy1saW5rLXJvdycgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHJvdylcbiAgICAgICAgICAuc2V0TmFtZShgTGluayAke2kgKyAxfWApXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdMYWJlbCcpLnNldFZhbHVlKGxpbmsubGFiZWwpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5sYWJlbCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignUGF0aCcpLnNldFZhbHVlKGxpbmsucGF0aCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLnBhdGggPSB2OyB9KSlcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0Vtb2ppJykuc2V0VmFsdWUobGluay5lbW9qaSA/PyAnJykub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmVtb2ppID0gdiB8fCB1bmRlZmluZWQ7IH0pKVxuICAgICAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRJY29uKCd0cmFzaCcpLnNldFRvb2x0aXAoJ1JlbW92ZScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgbGlua3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckxpbmtzKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0QnV0dG9uVGV4dCgnQWRkIExpbmsnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgbGlua3MucHVzaCh7IGxhYmVsOiAnJywgcGF0aDogJycgfSk7XG4gICAgICAgIHJlbmRlckxpbmtzKCk7XG4gICAgICB9KSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSkpO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IE1TX1BFUl9EQVkgPSA4Nl80MDBfMDAwO1xuXG5leHBvcnQgY2xhc3MgSW5zaWdodEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbnNpZ2h0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBpbnNpZ2h0LiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGRhaWx5U2VlZD86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjYXJkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1jYXJkJyB9KTtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBjYXJkLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBibG9jayBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpO1xuXG4gICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY2FyZC5zZXRUZXh0KGBObyBmaWxlcyBmb3VuZCB3aXRoIHRhZyAke3RhZ1NlYXJjaH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVc2UgbG9jYWwgbWlkbmlnaHQgYXMgdGhlIGRheSBpbmRleCBzbyBpdCBjaGFuZ2VzIGF0IGxvY2FsIG1pZG5pZ2h0LCBub3QgVVRDXG4gICAgY29uc3QgZGF5SW5kZXggPSBNYXRoLmZsb29yKG1vbWVudCgpLnN0YXJ0T2YoJ2RheScpLnZhbHVlT2YoKSAvIE1TX1BFUl9EQVkpO1xuICAgIGNvbnN0IGluZGV4ID0gZGFpbHlTZWVkXG4gICAgICA/IGRheUluZGV4ICUgZmlsZXMubGVuZ3RoXG4gICAgICA6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGZpbGVzLmxlbmd0aCk7XG5cbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaW5kZXhdO1xuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBjb25zdCB7IGhlYWRpbmcsIGJvZHkgfSA9IHRoaXMucGFyc2VDb250ZW50KGNvbnRlbnQsIGNhY2hlKTtcblxuICAgICAgY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LXRpdGxlJywgdGV4dDogaGVhZGluZyB8fCBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgY2FyZC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWJvZHknLCB0ZXh0OiBib2R5IH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEluc2lnaHRCbG9jayBmYWlsZWQgdG8gcmVhZCBmaWxlOicsIGUpO1xuICAgICAgY2FyZC5zZXRUZXh0KCdFcnJvciByZWFkaW5nIGZpbGUuJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdGhlIGZpcnN0IGhlYWRpbmcgYW5kIGZpcnN0IHBhcmFncmFwaCB1c2luZyBtZXRhZGF0YUNhY2hlIG9mZnNldHMuXG4gICAqIEZhbGxzIGJhY2sgdG8gbWFudWFsIHBhcnNpbmcgb25seSBpZiBjYWNoZSBpcyB1bmF2YWlsYWJsZS5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfSB7XG4gICAgLy8gVXNlIGNhY2hlZCBoZWFkaW5nIGlmIGF2YWlsYWJsZSAoYXZvaWRzIG1hbnVhbCBwYXJzaW5nKVxuICAgIGNvbnN0IGhlYWRpbmcgPSBjYWNoZT8uaGVhZGluZ3M/LlswXT8uaGVhZGluZyA/PyAnJztcblxuICAgIC8vIFNraXAgZnJvbnRtYXR0ZXIgdXNpbmcgdGhlIGNhY2hlZCBvZmZzZXRcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuXG4gICAgLy8gRmlyc3Qgbm9uLWVtcHR5LCBub24taGVhZGluZyBsaW5lIGlzIHRoZSBib2R5XG4gICAgY29uc3QgYm9keSA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maW5kKGwgPT4gbCAmJiAhbC5zdGFydHNXaXRoKCcjJykpID8/ICcnO1xuXG4gICAgcmV0dXJuIHsgaGVhZGluZywgYm9keSB9O1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEluc2lnaHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdJbnNpZ2h0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICdEYWlseSBJbnNpZ2h0JylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdEYWlseSBzZWVkJykuc2V0RGVzYygnU2hvdyBzYW1lIG5vdGUgYWxsIGRheScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LmRhaWx5U2VlZCBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5kYWlseVNlZWQgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKlxuICogUmV0dXJucyBhbGwgbWFya2Rvd24gZmlsZXMgaW4gdGhlIHZhdWx0IHRoYXQgaGF2ZSB0aGUgZ2l2ZW4gdGFnLlxuICogYHRhZ2AgbXVzdCBpbmNsdWRlIHRoZSBsZWFkaW5nIGAjYCAoZS5nLiBgI3ZhbHVlc2ApLlxuICogSGFuZGxlcyBib3RoIGlubGluZSB0YWdzIGFuZCBZQU1MIGZyb250bWF0dGVyIHRhZ3MgKHdpdGggb3Igd2l0aG91dCBgI2ApLFxuICogYW5kIGZyb250bWF0dGVyIHRhZ3MgdGhhdCBhcmUgYSBwbGFpbiBzdHJpbmcgaW5zdGVhZCBvZiBhbiBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZpbGVzV2l0aFRhZyhhcHA6IEFwcCwgdGFnOiBzdHJpbmcpOiBURmlsZVtdIHtcbiAgcmV0dXJuIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkuZmlsdGVyKGZpbGUgPT4ge1xuICAgIGNvbnN0IGNhY2hlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgIGlmICghY2FjaGUpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGlubGluZVRhZ3MgPSBjYWNoZS50YWdzPy5tYXAodCA9PiB0LnRhZykgPz8gW107XG5cbiAgICBjb25zdCByYXdGbVRhZ3MgPSBjYWNoZS5mcm9udG1hdHRlcj8udGFncztcbiAgICBjb25zdCBmbVRhZ0FycmF5OiBzdHJpbmdbXSA9XG4gICAgICBBcnJheS5pc0FycmF5KHJhd0ZtVGFncykgPyByYXdGbVRhZ3MuZmlsdGVyKCh0KTogdCBpcyBzdHJpbmcgPT4gdHlwZW9mIHQgPT09ICdzdHJpbmcnKSA6XG4gICAgICB0eXBlb2YgcmF3Rm1UYWdzID09PSAnc3RyaW5nJyA/IFtyYXdGbVRhZ3NdIDpcbiAgICAgIFtdO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRGbVRhZ3MgPSBmbVRhZ0FycmF5Lm1hcCh0ID0+IHQuc3RhcnRzV2l0aCgnIycpID8gdCA6IGAjJHt0fWApO1xuXG4gICAgcmV0dXJuIGlubGluZVRhZ3MuaW5jbHVkZXModGFnKSB8fCBub3JtYWxpemVkRm1UYWdzLmluY2x1ZGVzKHRhZyk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBWYWx1ZUl0ZW0ge1xuICBlbW9qaTogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xuICBsaW5rPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVGFnR3JpZEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCd0YWctZ3JpZC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdWYWx1ZXMnLCBjb2x1bW5zID0gMiwgaXRlbXMgPSBbXSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgaXRlbXM/OiBWYWx1ZUl0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdyaWQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICd0YWctZ3JpZCcgfSk7XG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2NvbHVtbnN9LCAxZnIpYDtcblxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGdyaWQuc2V0VGV4dCgnTm8gaXRlbXMuIENvbmZpZ3VyZSBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndGFnLWJ0bicgfSk7XG4gICAgICBpZiAoaXRlbS5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ3RhZy1idG4tZW1vamknLCB0ZXh0OiBpdGVtLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpdGVtLmxhYmVsIH0pO1xuICAgICAgaWYgKGl0ZW0ubGluaykge1xuICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChpdGVtLmxpbmshLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnRuLnN0eWxlLmN1cnNvciA9ICdkZWZhdWx0JztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFZhbHVlc1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBWYWx1ZXNTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdWYWx1ZXMgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIGl0ZW1zPzogVmFsdWVJdGVtW107XG4gICAgfTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZHJhZnQuaXRlbXMpKSBkcmFmdC5pdGVtcyA9IFtdO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSA/PyAnVmFsdWVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMScsICcxJykuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ0l0ZW1zJywgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnIH0pO1xuXG4gICAgY29uc3QgbGlzdEVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ3ZhbHVlcy1pdGVtLWxpc3QnIH0pO1xuICAgIGNvbnN0IHJlbmRlckxpc3QgPSAoKSA9PiB7XG4gICAgICBsaXN0RWwuZW1wdHkoKTtcbiAgICAgIGRyYWZ0Lml0ZW1zIS5mb3JFYWNoKChpdGVtLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6ICd2YWx1ZXMtaXRlbS1yb3cnIH0pO1xuXG4gICAgICAgIGNvbnN0IGVtb2ppSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWVtb2ppJyB9KTtcbiAgICAgICAgZW1vamlJbnB1dC52YWx1ZSA9IGl0ZW0uZW1vamk7XG4gICAgICAgIGVtb2ppSW5wdXQucGxhY2Vob2xkZXIgPSAnXHVEODNEXHVERTAwJztcbiAgICAgICAgZW1vamlJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgaXRlbS5lbW9qaSA9IGVtb2ppSW5wdXQudmFsdWU7IH0pO1xuXG4gICAgICAgIGNvbnN0IGxhYmVsSW5wdXQgPSByb3cuY3JlYXRlRWwoJ2lucHV0JywgeyB0eXBlOiAndGV4dCcsIGNsczogJ3ZhbHVlcy1pdGVtLWxhYmVsJyB9KTtcbiAgICAgICAgbGFiZWxJbnB1dC52YWx1ZSA9IGl0ZW0ubGFiZWw7XG4gICAgICAgIGxhYmVsSW5wdXQucGxhY2Vob2xkZXIgPSAnTGFiZWwnO1xuICAgICAgICBsYWJlbElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBpdGVtLmxhYmVsID0gbGFiZWxJbnB1dC52YWx1ZTsgfSk7XG5cbiAgICAgICAgY29uc3QgbGlua0lucHV0ID0gcm93LmNyZWF0ZUVsKCdpbnB1dCcsIHsgdHlwZTogJ3RleHQnLCBjbHM6ICd2YWx1ZXMtaXRlbS1saW5rJyB9KTtcbiAgICAgICAgbGlua0lucHV0LnZhbHVlID0gaXRlbS5saW5rID8/ICcnO1xuICAgICAgICBsaW5rSW5wdXQucGxhY2Vob2xkZXIgPSAnTm90ZSBwYXRoIChvcHRpb25hbCknO1xuICAgICAgICBsaW5rSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGl0ZW0ubGluayA9IGxpbmtJbnB1dC52YWx1ZSB8fCB1bmRlZmluZWQ7IH0pO1xuXG4gICAgICAgIGNvbnN0IGRlbEJ0biA9IHJvdy5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd2YWx1ZXMtaXRlbS1kZWwnLCB0ZXh0OiAnXHUyNzE1JyB9KTtcbiAgICAgICAgZGVsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRyYWZ0Lml0ZW1zIS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmVuZGVyTGlzdCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlzdCgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnKyBBZGQgaXRlbScpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBkcmFmdC5pdGVtcyEucHVzaCh7IGVtb2ppOiAnJywgbGFiZWw6ICcnIH0pO1xuICAgICAgICByZW5kZXJMaXN0KCk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBPbmx5IGFzc2lnbiBzYWZlIENTUyBjb2xvciB2YWx1ZXM7IHJlamVjdCBwb3RlbnRpYWxseSBtYWxpY2lvdXMgc3RyaW5nc1xuY29uc3QgQ09MT1JfUkUgPSAvXigjWzAtOWEtZkEtRl17Myw4fXxbYS16QS1aXSt8cmdiYT9cXChbXildK1xcKXxoc2xhP1xcKFteKV0rXFwpKSQvO1xuXG50eXBlIFF1b3Rlc0NvbmZpZyA9IHtcbiAgc291cmNlPzogJ3RhZycgfCAndGV4dCc7XG4gIHRhZz86IHN0cmluZztcbiAgcXVvdGVzPzogc3RyaW5nO1xuICB0aXRsZT86IHN0cmluZztcbiAgY29sdW1ucz86IG51bWJlcjtcbiAgbWF4SXRlbXM/OiBudW1iZXI7XG59O1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgc291cmNlID0gJ3RhZycsIHRhZyA9ICcnLCBxdW90ZXMgPSAnJywgdGl0bGUgPSAnUXVvdGVzJywgY29sdW1ucyA9IDIsIG1heEl0ZW1zID0gMjAgfSA9XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyBRdW90ZXNDb25maWc7XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgY29sc0VsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGVzLWNvbHVtbnMnIH0pO1xuICAgIGNvbHNFbC5zdHlsZS5jb2x1bW5Db3VudCA9IFN0cmluZyhjb2x1bW5zKTtcblxuICAgIGlmIChzb3VyY2UgPT09ICd0ZXh0Jykge1xuICAgICAgdGhpcy5yZW5kZXJUZXh0UXVvdGVzKGNvbHNFbCwgcXVvdGVzLCBtYXhJdGVtcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc291cmNlID09PSAndGFnJ1xuICAgIGlmICghdGFnKSB7XG4gICAgICBjb2xzRWwuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCkuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgLy8gUmVhZCBhbGwgZmlsZXMgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBmaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICAgIHJldHVybiB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH07XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgcmVzdWx0LnJlYXNvbik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH0gPSByZXN1bHQudmFsdWU7XG4gICAgICBjb25zdCBjb2xvciA9IGNhY2hlPy5mcm9udG1hdHRlcj8uY29sb3IgYXMgc3RyaW5nID8/ICcnO1xuICAgICAgY29uc3QgYm9keSA9IHRoaXMuZXh0cmFjdEJvZHkoY29udGVudCwgY2FjaGUpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IHF1b3RlID0gaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGNvbG9yIGJlZm9yZSBhcHBseWluZyB0byBwcmV2ZW50IENTUyBpbmplY3Rpb25cbiAgICAgIGlmIChjb2xvciAmJiBDT0xPUl9SRS50ZXN0KGNvbG9yKSkge1xuICAgICAgICBxdW90ZS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBjb2xvcjtcbiAgICAgICAgcXVvdGUuc3R5bGUuY29sb3IgPSBjb2xvcjtcbiAgICAgIH1cblxuICAgICAgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgcXVvdGVzIGZyb20gcGxhaW4gdGV4dC4gRWFjaCBxdW90ZSBpcyBzZXBhcmF0ZWQgYnkgYC0tLWAgb24gaXRzIG93biBsaW5lLlxuICAgKiBPcHRpb25hbGx5IGEgc291cmNlIGxpbmUgY2FuIGZvbGxvdyB0aGUgcXVvdGUgdGV4dCwgcHJlZml4ZWQgd2l0aCBgXHUyMDE0YCwgYFx1MjAxM2AsIG9yIGAtLWAuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqICAgVGhlIG9ubHkgd2F5IHRvIGRvIGdyZWF0IHdvcmsgaXMgdG8gbG92ZSB3aGF0IHlvdSBkby5cbiAgICogICBcdTIwMTQgU3RldmUgSm9ic1xuICAgKiAgIC0tLVxuICAgKiAgIEluIHRoZSBtaWRkbGUgb2YgZGlmZmljdWx0eSBsaWVzIG9wcG9ydHVuaXR5LlxuICAgKiAgIFx1MjAxNCBBbGJlcnQgRWluc3RlaW5cbiAgICovXG4gIHByaXZhdGUgcmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWw6IEhUTUxFbGVtZW50LCByYXc6IHN0cmluZywgbWF4SXRlbXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghcmF3LnRyaW0oKSkge1xuICAgICAgY29sc0VsLnNldFRleHQoJ0FkZCBxdW90ZXMgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYmxvY2tzID0gcmF3LnNwbGl0KC9cXG4tLS1cXG4vKS5tYXAoYiA9PiBiLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLnNsaWNlKDAsIG1heEl0ZW1zKTtcblxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGJsb2NrLnNwbGl0KCdcXG4nKS5tYXAobCA9PiBsLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgY29uc3QgbGFzdExpbmUgPSBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXTtcbiAgICAgIGNvbnN0IGhhc1NvdXJjZSA9IGxpbmVzLmxlbmd0aCA+IDEgJiYgL14oXHUyMDE0fFx1MjAxM3wtLSkvLnRlc3QobGFzdExpbmUpO1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IGhhc1NvdXJjZSA/IGxhc3RMaW5lLnJlcGxhY2UoL14oXHUyMDE0fFx1MjAxM3wtLSlcXHMqLywgJycpIDogJyc7XG4gICAgICBjb25zdCBib2R5TGluZXMgPSBoYXNTb3VyY2UgPyBsaW5lcy5zbGljZSgwLCAtMSkgOiBsaW5lcztcbiAgICAgIGNvbnN0IGJvZHkgPSBib2R5TGluZXMuam9pbignICcpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlRWwoJ2Jsb2NrcXVvdGUnLCB7IGNsczogJ3F1b3RlLWNvbnRlbnQnLCB0ZXh0OiBib2R5IH0pO1xuICAgICAgaWYgKHNvdXJjZVRleHQpIGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtc291cmNlJywgdGV4dDogc291cmNlVGV4dCB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogRXh0cmFjdCB0aGUgZmlyc3QgZmV3IGxpbmVzIG9mIGJvZHkgY29udGVudCB1c2luZyBtZXRhZGF0YUNhY2hlIGZyb250bWF0dGVyIG9mZnNldC4gKi9cbiAgcHJpdmF0ZSBleHRyYWN0Qm9keShjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiBzdHJpbmcge1xuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG4gICAgY29uc3QgbGluZXMgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKGwgPT4gbCAmJiAhbC5zdGFydHNXaXRoKCcjJykpO1xuICAgIHJldHVybiBsaW5lcy5zbGljZSgwLCAzKS5qb2luKCcgJyk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFF1b3Rlc1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBRdW90ZXNTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdW90ZXMgTGlzdCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZykgYXMgUXVvdGVzQ29uZmlnO1xuICAgIGRyYWZ0LnNvdXJjZSA/Pz0gJ3RhZyc7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdW90ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgLy8gU291cmNlIHRvZ2dsZSBcdTIwMTQgc2hvd3MvaGlkZXMgdGhlIHJlbGV2YW50IHNlY3Rpb25cbiAgICBsZXQgdGFnU2VjdGlvbjogSFRNTEVsZW1lbnQ7XG4gICAgbGV0IHRleHRTZWN0aW9uOiBIVE1MRWxlbWVudDtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdTb3VyY2UnKVxuICAgICAgLnNldERlc2MoJ1B1bGwgcXVvdGVzIGZyb20gdGFnZ2VkIG5vdGVzLCBvciBlbnRlciB0aGVtIG1hbnVhbGx5LicpXG4gICAgICAuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgICBkLmFkZE9wdGlvbigndGFnJywgJ05vdGVzIHdpdGggdGFnJylcbiAgICAgICAgIC5hZGRPcHRpb24oJ3RleHQnLCAnTWFudWFsIHRleHQnKVxuICAgICAgICAgLnNldFZhbHVlKGRyYWZ0LnNvdXJjZSA/PyAndGFnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHtcbiAgICAgICAgICAgZHJhZnQuc291cmNlID0gdiBhcyAndGFnJyB8ICd0ZXh0JztcbiAgICAgICAgICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RhZycgPyAnJyA6ICdub25lJztcbiAgICAgICAgICAgdGV4dFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHYgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgLy8gVGFnIHNlY3Rpb25cbiAgICB0YWdTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRhZ1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGRyYWZ0LnNvdXJjZSA9PT0gJ3RhZycgPyAnJyA6ICdub25lJztcbiAgICBuZXcgU2V0dGluZyh0YWdTZWN0aW9uKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBUZXh0IHNlY3Rpb25cbiAgICB0ZXh0U2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcbiAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGV4dCcgPyAnJyA6ICdub25lJztcbiAgICBjb25zdCB0ZXh0U2V0dGluZyA9IG5ldyBTZXR0aW5nKHRleHRTZWN0aW9uKVxuICAgICAgLnNldE5hbWUoJ1F1b3RlcycpXG4gICAgICAuc2V0RGVzYygnU2VwYXJhdGUgcXVvdGVzIHdpdGggLS0tIG9uIGl0cyBvd24gbGluZS4gQWRkIGEgc291cmNlIGxpbmUgc3RhcnRpbmcgd2l0aCBcdTIwMTQgKGUuZy4gXHUyMDE0IEF1dGhvcikuJyk7XG4gICAgdGV4dFNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmZsZXhEaXJlY3Rpb24gPSAnY29sdW1uJztcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuYWxpZ25JdGVtcyA9ICdzdHJldGNoJztcbiAgICBjb25zdCB0ZXh0YXJlYSA9IHRleHRTZXR0aW5nLnNldHRpbmdFbC5jcmVhdGVFbCgndGV4dGFyZWEnKTtcbiAgICB0ZXh0YXJlYS5yb3dzID0gODtcbiAgICB0ZXh0YXJlYS5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5tYXJnaW5Ub3AgPSAnOHB4JztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250RmFtaWx5ID0gJ3ZhcigtLWZvbnQtbW9ub3NwYWNlKSc7XG4gICAgdGV4dGFyZWEuc3R5bGUuZm9udFNpemUgPSAnMTJweCc7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5xdW90ZXMgPz8gJyc7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LnF1b3RlcyA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcbiAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBlbC5zZXRUZXh0KCdDb25maWd1cmUgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSB0ZXh0IGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdDb25maWd1cmUgSFRNTCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFBekI7QUFDRSxTQUFRLFlBQVksb0JBQUksSUFBNkI7QUFBQTtBQUFBLEVBRXJELFNBQVMsU0FBNkI7QUFDcEMsU0FBSyxVQUFVLElBQUksUUFBUSxNQUFNLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsSUFBSSxNQUEyQztBQUM3QyxXQUFPLEtBQUssVUFBVSxJQUFJLElBQUk7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBeUI7QUFDdkIsV0FBTyxNQUFNLEtBQUssS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN2QjtBQUNGO0FBRU8sSUFBTSxnQkFBZ0IsSUFBSSxtQkFBbUI7OztBRGY3QyxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQVd0QixZQUNFLGFBQ1EsS0FDQSxRQUNBLGdCQUNSO0FBSFE7QUFDQTtBQUNBO0FBYlYsU0FBUSxTQUFTLG9CQUFJLElBQXdEO0FBQzdFLFNBQVEsV0FBVztBQUVuQjtBQUFBLFNBQVEsd0JBQWdEO0FBRXhEO0FBQUEsU0FBUSxjQUFrQztBQUMxQyxTQUFRLGlCQUF3QztBQUNoRCxTQUFRLG1CQUFtQjtB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O0FBQUEsRUFDN0M7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUMzQztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBSztBQUFBLEVBQzNDO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFDN0M7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUN4QztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQzdDO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFDNUM7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFDOUM7QUFFQSxJQUFNLHFCQUFOLGNBQWlDLHNCQUFNO0FBQUEsRUFDckMsWUFDRSxLQUNRLFVBQ0EsT0FDQSxRQUNSO0FBQ0EsVUFBTSxHQUFHO0FBSkQ7QUFDQTtBQUNBO0FBQUEsRUFHVjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUs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LHNFQUFzRSxFQUM5RTtBQUFBLE1BQVUsU0FDVCxJQUFJLGNBQWMsY0FBYyxFQUFFLFdBQVcsRUFBRSxRQUFRLFlBQVk7QUFDakUsY0FBTSxLQUFLLE9BQU8sV0FBVyxpQkFBaUIsQ0FBQztBQUMvQyxtQkFBVyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEdBQUc7QUFDaEUsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGtCQUFNLEtBQUssS0FBSyxPQUFPO0FBQUEsVUFDekI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJGb2xkZXJTdWdnZXN0TW9kYWwiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
