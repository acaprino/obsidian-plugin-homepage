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
  // Respects _hideTitle and _titleLabel from instance.config.
  renderHeader(el, title) {
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = typeof cfg._titleLabel === "string" && cfg._titleLabel.trim() ? cfg._titleLabel.trim() : title;
    if (label) {
      el.createDiv({ cls: "block-header", text: label });
    }
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
    this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] TagGridBlock failed to render:", e);
      el.setText("Error loading tag grid. Check console for details.");
    });
  }
  async loadAndRender(el) {
    var _a, _b;
    const { tag = "", title = "Notes", columns = 2, showEmoji = true } = this.instance.config;
    this.renderHeader(el, title);
    const grid = el.createDiv({ cls: "tag-grid" });
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    if (!tag) {
      grid.setText("Configure a tag in settings.");
      return;
    }
    const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch);
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const emoji = showEmoji ? (_b = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.emoji) != null ? _b : "" : "";
      const btn = grid.createEl("button", { cls: "tag-btn" });
      if (emoji) {
        btn.createSpan({ cls: "tag-btn-emoji", text: emoji });
      }
      btn.createSpan({ text: file.basename });
      btn.addEventListener("click", () => {
        this.app.workspace.openLinkText(file.path, "");
      });
    }
  }
  openSettings(onSave) {
    new TagGridSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var TagGridSettingsModal = class extends import_obsidian9.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Tag Grid Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian9.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.title) != null ? _a : "Notes").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.tag) != null ? _a : "").onChange((v) => {
          draft.tag = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").setValue(String((_a = draft.columns) != null ? _a : 2)).onChange((v) => {
          draft.columns = Number(v);
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Show emoji").setDesc('Read "emoji" frontmatter field').addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = draft.showEmoji) != null ? _a : true).onChange((v) => {
          draft.showEmoji = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).addButton(
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
      config: { tag: "", title: "Values", columns: 2, showEmoji: true }
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
    displayName: "Tag Grid",
    defaultConfig: { tag: "", title: "Notes", columns: 2, showEmoji: true },
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBzaG93RW1vamk6IHRydWUgfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVGFnIEdyaWQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdOb3RlcycsIGNvbHVtbnM6IDIsIHNob3dFbW9qaTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDIgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBUYWdHcmlkQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3F1b3Rlcy1saXN0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1F1b3RlcyBMaXN0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnUXVvdGVzJywgY29sdW1uczogMiwgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFF1b3Rlc0xpc3RCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaW1hZ2UtZ2FsbGVyeScsXG4gICAgZGlzcGxheU5hbWU6ICdJbWFnZSBHYWxsZXJ5JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZvbGRlcjogJycsIHRpdGxlOiAnR2FsbGVyeScsIGNvbHVtbnM6IDMsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDMsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBJbWFnZUdhbGxlcnlCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnZW1iZWRkZWQtbm90ZScsXG4gICAgZGlzcGxheU5hbWU6ICdFbWJlZGRlZCBOb3RlJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZpbGVQYXRoOiAnJywgc2hvd1RpdGxlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEVtYmVkZGVkTm90ZUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdzdGF0aWMtdGV4dCcsXG4gICAgZGlzcGxheU5hbWU6ICdTdGF0aWMgVGV4dCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGNvbnRlbnQ6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFN0YXRpY1RleHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaHRtbCcsXG4gICAgZGlzcGxheU5hbWU6ICdIVE1MIEJsb2NrJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgaHRtbDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSHRtbEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgUGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIb21lcGFnZVBsdWdpbiBleHRlbmRzIFBsdWdpbiBpbXBsZW1lbnRzIElIb21lcGFnZVBsdWdpbiB7XG4gIGxheW91dDogTGF5b3V0Q29uZmlnID0gZ2V0RGVmYXVsdExheW91dCgpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZWdpc3RlckJsb2NrcygpO1xuXG4gICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIHVua25vd247XG4gICAgdGhpcy5sYXlvdXQgPSB2YWxpZGF0ZUxheW91dChyYXcpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCAobGVhZikgPT4gbmV3IEhvbWVwYWdlVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLWhvbWVwYWdlJyxcbiAgICAgIG5hbWU6ICdPcGVuIEhvbWVwYWdlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBtdXN0IGFwcGVhciBhYm92ZSB0aGUgZ3JpZCBpbiB0aGUgZmxleC1jb2x1bW4gbGF5b3V0XG4gICAgY29udGVudEVsLmluc2VydEJlZm9yZSh0aGlzLnRvb2xiYXIuZ2V0RWxlbWVudCgpLCB0aGlzLmdyaWQuZ2V0RWxlbWVudCgpKTtcblxuICAgIHRoaXMuZ3JpZC5yZW5kZXIobGF5b3V0LmJsb2NrcywgbGF5b3V0LmNvbHVtbnMpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKiBSZS1yZW5kZXIgdGhlIHZpZXcgZnJvbSBzY3JhdGNoIChlLmcuIGFmdGVyIHNldHRpbmdzIHJlc2V0KS4gKi9cbiAgYXN5bmMgcmVsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMub25PcGVuKCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzZXRJY29uIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgTGF5b3V0Q29uZmlnLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQmFzZUJsb2NrJztcblxudHlwZSBMYXlvdXRDaGFuZ2VDYWxsYmFjayA9IChsYXlvdXQ6IExheW91dENvbmZpZykgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGVmZmVjdGl2ZUNvbHVtbnMgPSAzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBvbkxheW91dENoYW5nZTogTGF5b3V0Q2hhbmdlQ2FsbGJhY2ssXG4gICkge1xuICAgIHRoaXMuZ3JpZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZ3JpZCcgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7XG4gICAgICBjb25zdCBuZXdFZmZlY3RpdmUgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICAgIGlmIChuZXdFZmZlY3RpdmUgIT09IHRoaXMuZWZmZWN0aXZlQ29sdW1ucykge1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci5vYnNlcnZlKHRoaXMuZ3JpZEVsKTtcbiAgfVxuXG4gIC8qKiBFeHBvc2UgdGhlIHJvb3QgZ3JpZCBlbGVtZW50IHNvIEhvbWVwYWdlVmlldyBjYW4gcmVvcmRlciBpdCBpbiB0aGUgRE9NLiAqL1xuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5ncmlkRWw7XG4gIH1cblxuICBwcml2YXRlIGNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGxheW91dENvbHVtbnM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgdyA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoO1xuICAgIGlmICh3ID4gMCAmJiB3IDw9IDU0MCkgcmV0dXJuIDE7XG4gICAgaWYgKHcgPiAwICYmIHcgPD0gODQwKSByZXR1cm4gTWF0aC5taW4oMiwgbGF5b3V0Q29sdW1ucyk7XG4gICAgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gIH1cblxuICByZW5kZXIoYmxvY2tzOiBCbG9ja0luc3RhbmNlW10sIGNvbHVtbnM6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2dyaWQnKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgYmxvY2tzJyk7XG4gICAgdGhpcy5lZmZlY3RpdmVDb2x1bW5zID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhjb2x1bW5zKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgZW1wdHkgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1zdGF0ZScgfSk7XG4gICAgICBlbXB0eS5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ05vIGJsb2NrcyB5ZXQuIENsaWNrIEVkaXQgdG8gYWRkIHlvdXIgZmlyc3QgYmxvY2suJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGJsb2Nrcykge1xuICAgICAgdGhpcy5yZW5kZXJCbG9jayhpbnN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldChpbnN0YW5jZS50eXBlKTtcbiAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ibG9jay13cmFwcGVyJyB9KTtcbiAgICB3cmFwcGVyLmRhdGFzZXQuYmxvY2tJZCA9IGluc3RhbmNlLmlkO1xuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2dyaWRjZWxsJyk7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBmYWN0b3J5LmRpc3BsYXlOYW1lKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2subG9hZCgpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGJsb2NrLnJlbmRlcihjb250ZW50RWwpO1xuICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXN1bHQuY2F0Y2goZSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtIb21lcGFnZSBCbG9ja3NdIEVycm9yIHJlbmRlcmluZyBibG9jayAke2luc3RhbmNlLnR5cGV9OmAsIGUpO1xuICAgICAgICBjb250ZW50RWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGJsb2NrLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5ibG9ja3Muc2V0KGluc3RhbmNlLmlkLCB7IGJsb2NrLCB3cmFwcGVyIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseUdyaWRQb3NpdGlvbih3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBjb2xzID0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zO1xuICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihpbnN0YW5jZS5jb2xTcGFuLCBjb2xzKTtcbiAgICAvLyBmbGV4LWdyb3cgcHJvcG9ydGlvbmFsIHRvIGNvbFNwYW4gc28gd3JhcHBlZCBpdGVtcyBzdHJldGNoIHRvIGZpbGwgdGhlIHJvd1xuICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjb2xTcGFuIC8gY29scykgKiAxMDA7XG4gICAgd3JhcHBlci5zdHlsZS5mbGV4ID0gYCR7Y29sU3Bhbn0gMCBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpKWA7XG4gICAgd3JhcHBlci5zdHlsZS5taW5XaWR0aCA9ICcwJztcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oYW5kbGUtYmFyJyB9KTtcblxuICAgIGNvbnN0IGhhbmRsZSA9IGJhci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1tb3ZlLWhhbmRsZScgfSk7XG4gICAgc2V0SWNvbihoYW5kbGUsICdncmlwLXZlcnRpY2FsJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlb3JkZXInKTtcbiAgICBoYW5kbGUuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlb3JkZXInKTtcblxuICAgIGNvbnN0IHNldHRpbmdzQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXNldHRpbmdzLWJ0bicgfSk7XG4gICAgc2V0SWNvbihzZXR0aW5nc0J0biwgJ3NldHRpbmdzJyk7XG4gICAgc2V0dGluZ3NCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Jsb2NrIHNldHRpbmdzJyk7XG4gICAgc2V0dGluZ3NCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ibG9ja3MuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZW50cnkpIHJldHVybjtcbiAgICAgIGNvbnN0IG9uU2F2ZSA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PlxuICAgICAgICAgIGIuaWQgPT09IGluc3RhbmNlLmlkID8gaW5zdGFuY2UgOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcbiAgICAgIG5ldyBCbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIGluc3RhbmNlLCBlbnRyeS5ibG9jaywgb25TYXZlKS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCByZW1vdmVCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stcmVtb3ZlLWJ0bicgfSk7XG4gICAgc2V0SWNvbihyZW1vdmVCdG4sICd4Jyk7XG4gICAgcmVtb3ZlQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdSZW1vdmUgYmxvY2snKTtcbiAgICByZW1vdmVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIG5ldyBSZW1vdmVCbG9ja0NvbmZpcm1Nb2RhbCh0aGlzLmFwcCwgKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbHRlcihiID0+IGIuaWQgIT09IGluc3RhbmNlLmlkKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH0pLm9wZW4oKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaXAgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLXJlc2l6ZS1ncmlwJyB9KTtcbiAgICBzZXRJY29uKGdyaXAsICdtYXhpbWl6ZS0yJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZXNpemUnKTtcbiAgICB0aGlzLmF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcCwgd3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgdGhpcy5hdHRhY2hEcmFnSGFuZGxlcihoYW5kbGUsIHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgaGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICBjb25zdCBjbG9uZSA9IHdyYXBwZXIuY2xvbmVOb2RlKHRydWUpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgY2xvbmUuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWctY2xvbmUnKTtcbiAgICAgIGNsb25lLnN0eWxlLndpZHRoID0gYCR7d3JhcHBlci5vZmZzZXRXaWR0aH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5oZWlnaHQgPSBgJHt3cmFwcGVyLm9mZnNldEhlaWdodH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gYCR7ZS5jbGllbnRYIC0gMjB9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUudG9wID0gYCR7ZS5jbGllbnRZIC0gMjB9cHhgO1xuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG4gICAgICB0aGlzLmFjdGl2ZUNsb25lID0gY2xvbmU7XG5cbiAgICAgIGNvbnN0IHNvdXJjZUlkID0gaW5zdGFuY2UuaWQ7XG4gICAgICB3cmFwcGVyLmFkZENsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjbG9uZS5zdHlsZS5sZWZ0ID0gYCR7bWUuY2xpZW50WCAtIDIwfXB4YDtcbiAgICAgICAgY2xvbmUuc3R5bGUudG9wID0gYCR7bWUuY2xpZW50WSAtIDIwfXB4YDtcblxuICAgICAgICB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yQWxsKCcuaG9tZXBhZ2UtYmxvY2std3JhcHBlcicpLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB0YXJnZXRJZCA9IHRoaXMuZmluZEJsb2NrVW5kZXJDdXJzb3IobWUuY2xpZW50WCwgbWUuY2xpZW50WSwgc291cmNlSWQpO1xuICAgICAgICBpZiAodGFyZ2V0SWQpIHtcbiAgICAgICAgICB0aGlzLmJsb2Nrcy5nZXQodGFyZ2V0SWQpPy53cmFwcGVyLmFkZENsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlVXAgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNsb25lLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgICB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yQWxsKCcuaG9tZXBhZ2UtYmxvY2std3JhcHBlcicpLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuc3dhcEJsb2Nrcyhzb3VyY2VJZCwgdGFyZ2V0SWQpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcDogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGdyaXAuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgY29uc3QgYWMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IGFjO1xuXG4gICAgICBjb25zdCBzdGFydFggPSBlLmNsaWVudFg7XG4gICAgICBjb25zdCBzdGFydENvbFNwYW4gPSBpbnN0YW5jZS5jb2xTcGFuO1xuICAgICAgY29uc3QgY29sdW1ucyA9IHRoaXMuZWZmZWN0aXZlQ29sdW1ucztcbiAgICAgIGNvbnN0IGNvbFdpZHRoID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGggLyBjb2x1bW5zO1xuICAgICAgbGV0IGN1cnJlbnRDb2xTcGFuID0gc3RhcnRDb2xTcGFuO1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVggPSBtZS5jbGllbnRYIC0gc3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YUNvbHMgPSBNYXRoLnJvdW5kKGRlbHRhWCAvIGNvbFdpZHRoKTtcbiAgICAgICAgY3VycmVudENvbFNwYW4gPSBNYXRoLm1heCgxLCBNYXRoLm1pbihjb2x1bW5zLCBzdGFydENvbFNwYW4gKyBkZWx0YUNvbHMpKTtcbiAgICAgICAgY29uc3QgYmFzaXNQZXJjZW50ID0gKGN1cnJlbnRDb2xTcGFuIC8gY29sdW1ucykgKiAxMDA7XG4gICAgICAgIHdyYXBwZXIuc3R5bGUuZmxleCA9IGAke2N1cnJlbnRDb2xTcGFufSAwIGNhbGMoJHtiYXNpc1BlcmNlbnR9JSAtIHZhcigtLWhwLWdhcCwgMTZweCkpYDtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4gfSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRCbG9ja1VuZGVyQ3Vyc29yKHg6IG51bWJlciwgeTogbnVtYmVyLCBleGNsdWRlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgW2lkLCB7IHdyYXBwZXIgfV0gb2YgdGhpcy5ibG9ja3MpIHtcbiAgICAgIGlmIChpZCA9PT0gZXhjbHVkZUlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY3QgPSB3cmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHggPj0gcmVjdC5sZWZ0ICYmIHggPD0gcmVjdC5yaWdodCAmJiB5ID49IHJlY3QudG9wICYmIHkgPD0gcmVjdC5ib3R0b20pIHtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBTd2FwIHBvc2l0aW9ucyBvZiB0d28gYmxvY2tzIHVzaW5nIGltbXV0YWJsZSB1cGRhdGVzLiAqL1xuICBwcml2YXRlIHN3YXBCbG9ja3MoaWRBOiBzdHJpbmcsIGlkQjogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYkEgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBpZEEpO1xuICAgIGNvbnN0IGJCID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRCKTtcbiAgICBpZiAoIWJBIHx8ICFiQikgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBpZiAoYi5pZCA9PT0gaWRBKSByZXR1cm4geyAuLi5iLCBjb2w6IGJCLmNvbCwgcm93OiBiQi5yb3csIGNvbFNwYW46IGJCLmNvbFNwYW4sIHJvd1NwYW46IGJCLnJvd1NwYW4gfTtcbiAgICAgIGlmIChiLmlkID09PSBpZEIpIHJldHVybiB7IC4uLmIsIGNvbDogYkEuY29sLCByb3c6IGJBLnJvdywgY29sU3BhbjogYkEuY29sU3Bhbiwgcm93U3BhbjogYkEucm93U3BhbiB9O1xuICAgICAgcmV0dXJuIGI7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgLyoqIFVwZGF0ZSBjb2x1bW4gY291bnQsIGNsYW1waW5nIGVhY2ggYmxvY2sncyBjb2wgYW5kIGNvbFNwYW4gdG8gZml0LiAqL1xuICBzZXRDb2x1bW5zKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgY29uc3QgY29sID0gTWF0aC5taW4oYi5jb2wsIG4pO1xuICAgICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGIuY29sU3BhbiwgbiAtIGNvbCArIDEpO1xuICAgICAgcmV0dXJuIHsgLi4uYiwgY29sLCBjb2xTcGFuIH07XG4gICAgfSk7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgY29sdW1uczogbiwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgYWRkQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgaW5zdGFuY2VdO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVyZW5kZXIoKTogdm9pZCB7XG4gICAgY29uc3QgZm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgZm9jdXNlZEJsb2NrSWQgPSAoZm9jdXNlZD8uY2xvc2VzdCgnW2RhdGEtYmxvY2staWRdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uZGF0YXNldC5ibG9ja0lkO1xuICAgIHRoaXMucmVuZGVyKHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICBpZiAoZm9jdXNlZEJsb2NrSWQpIHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oYFtkYXRhLWJsb2NrLWlkPVwiJHtmb2N1c2VkQmxvY2tJZH1cIl1gKTtcbiAgICAgIGVsPy5mb2N1cygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBVbmxvYWQgYWxsIGJsb2NrcyBhbmQgY2FuY2VsIGFueSBpbi1wcm9ncmVzcyBkcmFnL3Jlc2l6ZS4gKi9cbiAgZGVzdHJveUFsbCgpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgdGhpcy5hY3RpdmVDbG9uZT8ucmVtb3ZlKCk7XG4gICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHsgYmxvY2sgfSBvZiB0aGlzLmJsb2Nrcy52YWx1ZXMoKSkge1xuICAgICAgYmxvY2sudW5sb2FkKCk7XG4gICAgfVxuICAgIHRoaXMuYmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICAvKiogRnVsbCB0ZWFyZG93bjogdW5sb2FkIGJsb2NrcyBhbmQgcmVtb3ZlIHRoZSBncmlkIGVsZW1lbnQgZnJvbSB0aGUgRE9NLiAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXI/LmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbnVsbDtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgc2V0dGluZ3MgbW9kYWwgKHRpdGxlIHNlY3Rpb24gKyBibG9jay1zcGVjaWZpYyBzZXR0aW5ncykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcml2YXRlIGJsb2NrOiBCYXNlQmxvY2ssXG4gICAgcHJpdmF0ZSBvblNhdmU6ICgpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0Jsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuaW5zdGFuY2UuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdUaXRsZSBsYWJlbCcpXG4gICAgICAuc2V0RGVzYygnTGVhdmUgZW1wdHkgdG8gdXNlIHRoZSBkZWZhdWx0IHRpdGxlLicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUodHlwZW9mIGRyYWZ0Ll90aXRsZUxhYmVsID09PSAnc3RyaW5nJyA/IGRyYWZ0Ll90aXRsZUxhYmVsIDogJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0RlZmF1bHQgdGl0bGUnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5fdGl0bGVMYWJlbCA9IHY7IH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdIaWRlIHRpdGxlJylcbiAgICAgIC5hZGRUb2dnbGUodCA9PlxuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0Ll9oaWRlVGl0bGUgPT09IHRydWUpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Ll9oaWRlVGl0bGUgPSB2OyB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gZHJhZnQ7XG4gICAgICAgICAgdGhpcy5vblNhdmUoKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG5cbiAgICBjb25zdCBociA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaHInKTtcbiAgICBoci5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdCbG9jay1zcGVjaWZpYyBzZXR0aW5nczonLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLW5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NvbmZpZ3VyZSBibG9jay4uLicpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB0aGlzLmJsb2NrLm9wZW5TZXR0aW5ncyh0aGlzLm9uU2F2ZSk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gRWRpdCB0b2dnbGVcbiAgICBjb25zdCBlZGl0QnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1lZGl0LWJ0bicgfSk7XG4gICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgIGVkaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgICB0aGlzLmdyaWQuc2V0RWRpdE1vZGUodGhpcy5lZGl0TW9kZSk7XG4gICAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgICB0aGlzLnN5bmNBZGRCdXR0b24oKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRWRpdEJ0bihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gdGhpcy5lZGl0TW9kZSA/ICdcdTI3MTMgRG9uZScgOiAnXHUyNzBGIEVkaXQnO1xuICAgIGJ0bi50b2dnbGVDbGFzcygndG9vbGJhci1idG4tYWN0aXZlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRvb2xiYXJFbC5xdWVyeVNlbGVjdG9yKCcudG9vbGJhci1hZGQtYnRuJyk7XG4gICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgIWV4aXN0aW5nKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZWRpdE1vZGUgJiYgZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNvbnN0IEJMT0NLX0lDT05TOiBSZWNvcmQ8QmxvY2tUeXBlLCBzdHJpbmc+ID0ge1xuICAnZ3JlZXRpbmcnOiAgICAgICdcdUQ4M0RcdURDNEInLFxuICAnY2xvY2snOiAgICAgICAgICdcdUQ4M0RcdURENTAnLFxuICAnZm9sZGVyLWxpbmtzJzogICdcdUQ4M0RcdUREMTcnLFxuICAnaW5zaWdodCc6ICAgICAgICdcdUQ4M0RcdURDQTEnLFxuICAndGFnLWdyaWQnOiAgICAgICdcdUQ4M0NcdURGRjdcdUZFMEYnLFxuICAncXVvdGVzLWxpc3QnOiAgICdcdUQ4M0RcdURDQUMnLFxuICAnaW1hZ2UtZ2FsbGVyeSc6ICdcdUQ4M0RcdUREQkNcdUZFMEYnLFxuICAnZW1iZWRkZWQtbm90ZSc6ICdcdUQ4M0RcdURDQzQnLFxuICAnc3RhdGljLXRleHQnOiAgICdcdUQ4M0RcdURDREQnLFxuICAnaHRtbCc6ICAgICAgICAgICc8Lz4nLFxufTtcblxuY2xhc3MgQWRkQmxvY2tNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvblNlbGVjdDogKHR5cGU6IEJsb2NrVHlwZSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQWRkIEJsb2NrJywgY2xzOiAnYWRkLWJsb2NrLW1vZGFsLXRpdGxlJyB9KTtcblxuICAgIGNvbnN0IGdyaWQgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnYWRkLWJsb2NrLWdyaWQnIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYWRkLWJsb2NrLW9wdGlvbicgfSk7XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2FkZC1ibG9jay1pY29uJywgdGV4dDogQkxPQ0tfSUNPTlNbZmFjdG9yeS50eXBlXSA/PyAnXHUyNUFBJyB9KTtcbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnYWRkLWJsb2NrLW5hbWUnLCB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsLlxuICAvLyBSZXNwZWN0cyBfaGlkZVRpdGxlIGFuZCBfdGl0bGVMYWJlbCBmcm9tIGluc3RhbmNlLmNvbmZpZy5cbiAgcHJvdGVjdGVkIHJlbmRlckhlYWRlcihlbDogSFRNTEVsZW1lbnQsIHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjZmcgPSB0aGlzLmluc3RhbmNlLmNvbmZpZztcbiAgICBpZiAoY2ZnLl9oaWRlVGl0bGUgPT09IHRydWUpIHJldHVybjtcbiAgICBjb25zdCBsYWJlbCA9ICh0eXBlb2YgY2ZnLl90aXRsZUxhYmVsID09PSAnc3RyaW5nJyAmJiBjZmcuX3RpdGxlTGFiZWwudHJpbSgpKVxuICAgICAgPyBjZmcuX3RpdGxlTGFiZWwudHJpbSgpXG4gICAgICA6IHRpdGxlO1xuICAgIGlmIChsYWJlbCkge1xuICAgICAgZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJywgdGV4dDogbGFiZWwgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRhdGVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2Nsb2NrLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dEYXRlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93RGF0ZT86IGJvb2xlYW4gfTtcblxuICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stdGltZScgfSk7XG4gICAgaWYgKHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLWRhdGUnIH0pO1xuICAgIH1cblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCB7IHNob3dTZWNvbmRzID0gZmFsc2UsIHNob3dEYXRlID0gdHJ1ZSwgZm9ybWF0ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHNob3dTZWNvbmRzPzogYm9vbGVhbjtcbiAgICAgIHNob3dEYXRlPzogYm9vbGVhbjtcbiAgICAgIGZvcm1hdD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudGltZUVsKSB7XG4gICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChmb3JtYXQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChzaG93U2Vjb25kcyA/ICdISDptbTpzcycgOiAnSEg6bW0nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmRhdGVFbCAmJiBzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwuc2V0VGV4dChub3cuZm9ybWF0KCdkZGRkLCBEIE1NTU0gWVlZWScpKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IENsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIENsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ2xvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHNlY29uZHMnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93U2Vjb25kcyBhcyBib29sZWFuID8/IGZhbHNlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1NlY29uZHMgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBkYXRlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0RhdGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0RhdGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdDdXN0b20gZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdPcHRpb25hbCBtb21lbnQuanMgZm9ybWF0IHN0cmluZywgZS5nLiBcIkhIOm1tXCIuIExlYXZlIGVtcHR5IGZvciBkZWZhdWx0LicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9ybWF0IGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9ybWF0ID0gdjsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBMaW5rSXRlbSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgZW1vamk/OiBzdHJpbmc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT4gZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQgeyB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTGlua3NCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZm9sZGVyLWxpbmtzLWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNvbnRlbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdRdWljayBMaW5rcycsIGZvbGRlciA9ICcnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG5cbiAgICAvLyBBdXRvLWxpc3Qgbm90ZXMgZnJvbSBzZWxlY3RlZCBmb2xkZXIgKHNvcnRlZCBhbHBoYWJldGljYWxseSlcbiAgICBpZiAoZm9sZGVyKSB7XG4gICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICAgIGlmIChmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgIGNvbnN0IG5vdGVzID0gZm9sZGVyT2JqLmNoaWxkcmVuXG4gICAgICAgICAgLmZpbHRlcigoY2hpbGQpOiBjaGlsZCBpcyBURmlsZSA9PiBjaGlsZCBpbnN0YW5jZW9mIFRGaWxlICYmIGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJylcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ05vIG5vdGVzIGluIHRoaXMgZm9sZGVyLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hbnVhbCBsaW5rc1xuICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICBpZiAobGluay5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2xpbmstZW1vamknLCB0ZXh0OiBsaW5rLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsaW5rLmxhYmVsIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGxpbmsucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIgJiYgbGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnQWRkIGxpbmtzIG9yIHNlbGVjdCBhIGZvbGRlciBpbiBzZXR0aW5ncy4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNhcmQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIGJsb2NrIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncy5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0eXBlb2YgdCA9PT0gJ3N0cmluZycpIDpcbiAgICAgIHR5cGVvZiByYXdGbVRhZ3MgPT09ICdzdHJpbmcnID8gW3Jhd0ZtVGFnc10gOlxuICAgICAgW107XG4gICAgY29uc3Qgbm9ybWFsaXplZEZtVGFncyA9IGZtVGFnQXJyYXkubWFwKHQgPT4gdC5zdGFydHNXaXRoKCcjJykgPyB0IDogYCMke3R9YCk7XG5cbiAgICByZXR1cm4gaW5saW5lVGFncy5pbmNsdWRlcyh0YWcpIHx8IG5vcm1hbGl6ZWRGbVRhZ3MuaW5jbHVkZXModGFnKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgVGFnR3JpZEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCd0YWctZ3JpZC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBUYWdHcmlkQmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgdGFnIGdyaWQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnTm90ZXMnLCBjb2x1bW5zID0gMiwgc2hvd0Vtb2ppID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGFnPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgc2hvd0Vtb2ppPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdyaWQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICd0YWctZ3JpZCcgfSk7XG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2NvbHVtbnN9LCAxZnIpYDtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBncmlkLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgY29uc3QgZW1vamkgPSBzaG93RW1vamkgPyAoY2FjaGU/LmZyb250bWF0dGVyPy5lbW9qaSBhcyBzdHJpbmcgPz8gJycpIDogJyc7XG5cbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndGFnLWJ0bicgfSk7XG4gICAgICBpZiAoZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICd0YWctYnRuLWVtb2ppJywgdGV4dDogZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFRhZ0dyaWRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgVGFnR3JpZFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1RhZyBHcmlkIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICdOb3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgZW1vamknKS5zZXREZXNjKCdSZWFkIFwiZW1vamlcIiBmcm9udG1hdHRlciBmaWVsZCcpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dFbW9qaSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RW1vamkgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBPbmx5IGFzc2lnbiBzYWZlIENTUyBjb2xvciB2YWx1ZXM7IHJlamVjdCBwb3RlbnRpYWxseSBtYWxpY2lvdXMgc3RyaW5nc1xuY29uc3QgQ09MT1JfUkUgPSAvXigjWzAtOWEtZkEtRl17Myw4fXxbYS16QS1aXSt8cmdiYT9cXChbXildK1xcKXxoc2xhP1xcKFteKV0rXFwpKSQvO1xuXG50eXBlIFF1b3Rlc0NvbmZpZyA9IHtcbiAgc291cmNlPzogJ3RhZycgfCAndGV4dCc7XG4gIHRhZz86IHN0cmluZztcbiAgcXVvdGVzPzogc3RyaW5nO1xuICB0aXRsZT86IHN0cmluZztcbiAgY29sdW1ucz86IG51bWJlcjtcbiAgbWF4SXRlbXM/OiBudW1iZXI7XG59O1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgc291cmNlID0gJ3RhZycsIHRhZyA9ICcnLCBxdW90ZXMgPSAnJywgdGl0bGUgPSAnUXVvdGVzJywgY29sdW1ucyA9IDIsIG1heEl0ZW1zID0gMjAgfSA9XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyBRdW90ZXNDb25maWc7XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgY29sc0VsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGVzLWNvbHVtbnMnIH0pO1xuICAgIGNvbHNFbC5zdHlsZS5jb2x1bW5Db3VudCA9IFN0cmluZyhjb2x1bW5zKTtcblxuICAgIGlmIChzb3VyY2UgPT09ICd0ZXh0Jykge1xuICAgICAgdGhpcy5yZW5kZXJUZXh0UXVvdGVzKGNvbHNFbCwgcXVvdGVzLCBtYXhJdGVtcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc291cmNlID09PSAndGFnJ1xuICAgIGlmICghdGFnKSB7XG4gICAgICBjb2xzRWwuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCkuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgLy8gUmVhZCBhbGwgZmlsZXMgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBmaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICAgIHJldHVybiB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH07XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgcmVzdWx0LnJlYXNvbik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGZpbGUsIGNvbnRlbnQsIGNhY2hlIH0gPSByZXN1bHQudmFsdWU7XG4gICAgICBjb25zdCBjb2xvciA9IGNhY2hlPy5mcm9udG1hdHRlcj8uY29sb3IgYXMgc3RyaW5nID8/ICcnO1xuICAgICAgY29uc3QgYm9keSA9IHRoaXMuZXh0cmFjdEJvZHkoY29udGVudCwgY2FjaGUpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IHF1b3RlID0gaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGNvbG9yIGJlZm9yZSBhcHBseWluZyB0byBwcmV2ZW50IENTUyBpbmplY3Rpb25cbiAgICAgIGlmIChjb2xvciAmJiBDT0xPUl9SRS50ZXN0KGNvbG9yKSkge1xuICAgICAgICBxdW90ZS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBjb2xvcjtcbiAgICAgICAgcXVvdGUuc3R5bGUuY29sb3IgPSBjb2xvcjtcbiAgICAgIH1cblxuICAgICAgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgcXVvdGVzIGZyb20gcGxhaW4gdGV4dC4gRWFjaCBxdW90ZSBpcyBzZXBhcmF0ZWQgYnkgYC0tLWAgb24gaXRzIG93biBsaW5lLlxuICAgKiBPcHRpb25hbGx5IGEgc291cmNlIGxpbmUgY2FuIGZvbGxvdyB0aGUgcXVvdGUgdGV4dCwgcHJlZml4ZWQgd2l0aCBgXHUyMDE0YCwgYFx1MjAxM2AsIG9yIGAtLWAuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqICAgVGhlIG9ubHkgd2F5IHRvIGRvIGdyZWF0IHdvcmsgaXMgdG8gbG92ZSB3aGF0IHlvdSBkby5cbiAgICogICBcdTIwMTQgU3RldmUgSm9ic1xuICAgKiAgIC0tLVxuICAgKiAgIEluIHRoZSBtaWRkbGUgb2YgZGlmZmljdWx0eSBsaWVzIG9wcG9ydHVuaXR5LlxuICAgKiAgIFx1MjAxNCBBbGJlcnQgRWluc3RlaW5cbiAgICovXG4gIHByaXZhdGUgcmVuZGVyVGV4dFF1b3Rlcyhjb2xzRWw6IEhUTUxFbGVtZW50LCByYXc6IHN0cmluZywgbWF4SXRlbXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghcmF3LnRyaW0oKSkge1xuICAgICAgY29sc0VsLnNldFRleHQoJ0FkZCBxdW90ZXMgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYmxvY2tzID0gcmF3LnNwbGl0KC9cXG4tLS1cXG4vKS5tYXAoYiA9PiBiLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLnNsaWNlKDAsIG1heEl0ZW1zKTtcblxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGJsb2NrLnNwbGl0KCdcXG4nKS5tYXAobCA9PiBsLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgY29uc3QgbGFzdExpbmUgPSBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXTtcbiAgICAgIGNvbnN0IGhhc1NvdXJjZSA9IGxpbmVzLmxlbmd0aCA+IDEgJiYgL14oXHUyMDE0fFx1MjAxM3wtLSkvLnRlc3QobGFzdExpbmUpO1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IGhhc1NvdXJjZSA/IGxhc3RMaW5lLnJlcGxhY2UoL14oXHUyMDE0fFx1MjAxM3wtLSlcXHMqLywgJycpIDogJyc7XG4gICAgICBjb25zdCBib2R5TGluZXMgPSBoYXNTb3VyY2UgPyBsaW5lcy5zbGljZSgwLCAtMSkgOiBsaW5lcztcbiAgICAgIGNvbnN0IGJvZHkgPSBib2R5TGluZXMuam9pbignICcpO1xuICAgICAgaWYgKCFib2R5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaXRlbSA9IGNvbHNFbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1pdGVtJyB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlRWwoJ2Jsb2NrcXVvdGUnLCB7IGNsczogJ3F1b3RlLWNvbnRlbnQnLCB0ZXh0OiBib2R5IH0pO1xuICAgICAgaWYgKHNvdXJjZVRleHQpIGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtc291cmNlJywgdGV4dDogc291cmNlVGV4dCB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogRXh0cmFjdCB0aGUgZmlyc3QgZmV3IGxpbmVzIG9mIGJvZHkgY29udGVudCB1c2luZyBtZXRhZGF0YUNhY2hlIGZyb250bWF0dGVyIG9mZnNldC4gKi9cbiAgcHJpdmF0ZSBleHRyYWN0Qm9keShjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiBzdHJpbmcge1xuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG4gICAgY29uc3QgbGluZXMgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKGwgPT4gbCAmJiAhbC5zdGFydHNXaXRoKCcjJykpO1xuICAgIHJldHVybiBsaW5lcy5zbGljZSgwLCAzKS5qb2luKCcgJyk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFF1b3Rlc1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBRdW90ZXNTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdW90ZXMgTGlzdCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZykgYXMgUXVvdGVzQ29uZmlnO1xuICAgIGRyYWZ0LnNvdXJjZSA/Pz0gJ3RhZyc7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdW90ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgLy8gU291cmNlIHRvZ2dsZSBcdTIwMTQgc2hvd3MvaGlkZXMgdGhlIHJlbGV2YW50IHNlY3Rpb25cbiAgICBsZXQgdGFnU2VjdGlvbjogSFRNTEVsZW1lbnQ7XG4gICAgbGV0IHRleHRTZWN0aW9uOiBIVE1MRWxlbWVudDtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdTb3VyY2UnKVxuICAgICAgLnNldERlc2MoJ1B1bGwgcXVvdGVzIGZyb20gdGFnZ2VkIG5vdGVzLCBvciBlbnRlciB0aGVtIG1hbnVhbGx5LicpXG4gICAgICAuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgICBkLmFkZE9wdGlvbigndGFnJywgJ05vdGVzIHdpdGggdGFnJylcbiAgICAgICAgIC5hZGRPcHRpb24oJ3RleHQnLCAnTWFudWFsIHRleHQnKVxuICAgICAgICAgLnNldFZhbHVlKGRyYWZ0LnNvdXJjZSA/PyAndGFnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHtcbiAgICAgICAgICAgZHJhZnQuc291cmNlID0gdiBhcyAndGFnJyB8ICd0ZXh0JztcbiAgICAgICAgICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RhZycgPyAnJyA6ICdub25lJztcbiAgICAgICAgICAgdGV4dFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHYgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgLy8gVGFnIHNlY3Rpb25cbiAgICB0YWdTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRhZ1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGRyYWZ0LnNvdXJjZSA9PT0gJ3RhZycgPyAnJyA6ICdub25lJztcbiAgICBuZXcgU2V0dGluZyh0YWdTZWN0aW9uKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBUZXh0IHNlY3Rpb25cbiAgICB0ZXh0U2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcbiAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGV4dCcgPyAnJyA6ICdub25lJztcbiAgICBjb25zdCB0ZXh0U2V0dGluZyA9IG5ldyBTZXR0aW5nKHRleHRTZWN0aW9uKVxuICAgICAgLnNldE5hbWUoJ1F1b3RlcycpXG4gICAgICAuc2V0RGVzYygnU2VwYXJhdGUgcXVvdGVzIHdpdGggLS0tIG9uIGl0cyBvd24gbGluZS4gQWRkIGEgc291cmNlIGxpbmUgc3RhcnRpbmcgd2l0aCBcdTIwMTQgKGUuZy4gXHUyMDE0IEF1dGhvcikuJyk7XG4gICAgdGV4dFNldHRpbmcuc2V0dGluZ0VsLnN0eWxlLmZsZXhEaXJlY3Rpb24gPSAnY29sdW1uJztcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuYWxpZ25JdGVtcyA9ICdzdHJldGNoJztcbiAgICBjb25zdCB0ZXh0YXJlYSA9IHRleHRTZXR0aW5nLnNldHRpbmdFbC5jcmVhdGVFbCgndGV4dGFyZWEnKTtcbiAgICB0ZXh0YXJlYS5yb3dzID0gODtcbiAgICB0ZXh0YXJlYS5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5tYXJnaW5Ub3AgPSAnOHB4JztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250RmFtaWx5ID0gJ3ZhcigtLWZvbnQtbW9ub3NwYWNlKSc7XG4gICAgdGV4dGFyZWEuc3R5bGUuZm9udFNpemUgPSAnMTJweCc7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5xdW90ZXMgPz8gJyc7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LnF1b3RlcyA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcbiAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBlbC5zZXRUZXh0KCdDb25maWd1cmUgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSB0ZXh0IGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdDb25maWd1cmUgSFRNTCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFBekI7QUFDRSxTQUFRLFlBQVksb0JBQUksSUFBNkI7QUFBQTtBQUFBLEVBRXJELFNBQVMsU0FBNkI7QUFDcEMsU0FBSyxVQUFVLElBQUksUUFBUSxNQUFNLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsSUFBSSxNQUEyQztBQUM3QyxXQUFPLEtBQUssVUFBVSxJQUFJLElBQUk7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBeUI7QUFDdkIsV0FBTyxNQUFNLEtBQUssS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN2QjtBQUNGO0FBRU8sSUFBTSxnQkFBZ0IsSUFBSSxtQkFBbUI7OztBRGY3QyxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQVd0QixZQUNFLGFBQ1EsS0FDQSxRQUNBLGdCQUNSO0FBSFE7QUFDQTtBQUNBO0FBYlYsU0FBUSxTQUFTLG9CQUFJLElBQXdEO0FBQzdFLFNBQVEsV0FBVztBQUVuQjtBQUFBLFNBQVEsd0JBQWdEO0FBRXhEO0FBQUEsU0FBUSxjQUFrQztBQUMxQyxTQUFRLGlCQUF3QztBQUNoRCxTQUFRLG1CQUFtQjtBQVF6QixTQUFLLFNBQVMsWUFBWSxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUM1RCxTQUFLLGlCQUFp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QkFBaUIsRUFDekIsUUFBUSx1Q0FBdUMsRUFDL0M7QUFBQSxNQUFZLFVBQ1gsS0FDRyxVQUFVLEtBQUssV0FBVyxFQUMxQixVQUFVLEtBQUssV0FBVyxFQUMxQixVQUFVLEtBQUssV0FBVyxFQUMxQixTQUFTLE9BQU8sS0FBSyxPQUFPLE9BQU8sT0FBTyxDQUFDLEVBQzNDLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLGFBQUssT0FBTyxPQUFPLFVBQVUsT0FBTyxLQUFLO0FBQ3pDLGNBQU0sS0FBSyxPQUFPLFdBQVcsS0FBSyxPQUFPLE1BQU07QUFBQSxNQUNqRCxDQUFDO0FBQUEsSUFDTDtBQUVGLFFBQUksMEJBQVEsV0FBVyxFQUNwQixRQUFRLHlCQUF5QixFQUNqQyxRQUFRLHNFQUFzRSxFQUM5RTtBQUFBLE1BQVUsU0FDVCxJQUFJLGNBQWMsY0FBYyxFQUFFLFdBQVcsRUFBRSxRQUFRLFlBQVk7QUFDakUsY0FBTSxLQUFLLE9BQU8sV0FBVyxpQkFBaUIsQ0FBQztBQUMvQyxtQkFBVyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEdBQUc7QUFDaEUsY0FBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3JDLGtCQUFNLEtBQUssS0FBSyxPQUFPO0FBQUEsVUFDekI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0o7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJGb2xkZXJTdWdnZXN0TW9kYWwiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
