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
      entry.block.openSettings(() => {
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? instance : b
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      });
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
var AddBlockModal = class extends import_obsidian2.Modal {
  constructor(app, onSelect) {
    super(app);
    this.onSelect = onSelect;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Block" });
    for (const factory of BlockRegistry.getAll()) {
      const btn = contentEl.createEl("button", {
        cls: "add-block-option",
        text: factory.displayName
      });
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
  // Render the muted uppercase block header label if title is non-empty
  renderHeader(el, title) {
    if (title) {
      el.createDiv({ cls: "block-header", text: title });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBzaG93RW1vamk6IHRydWUgfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVGFnIEdyaWQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdOb3RlcycsIGNvbHVtbnM6IDIsIHNob3dFbW9qaTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDIgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBUYWdHcmlkQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3F1b3Rlcy1saXN0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1F1b3RlcyBMaXN0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnUXVvdGVzJywgY29sdW1uczogMiwgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFF1b3Rlc0xpc3RCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaW1hZ2UtZ2FsbGVyeScsXG4gICAgZGlzcGxheU5hbWU6ICdJbWFnZSBHYWxsZXJ5JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZvbGRlcjogJycsIHRpdGxlOiAnR2FsbGVyeScsIGNvbHVtbnM6IDMsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDMsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBJbWFnZUdhbGxlcnlCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnZW1iZWRkZWQtbm90ZScsXG4gICAgZGlzcGxheU5hbWU6ICdFbWJlZGRlZCBOb3RlJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZpbGVQYXRoOiAnJywgc2hvd1RpdGxlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEVtYmVkZGVkTm90ZUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdzdGF0aWMtdGV4dCcsXG4gICAgZGlzcGxheU5hbWU6ICdTdGF0aWMgVGV4dCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGNvbnRlbnQ6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFN0YXRpY1RleHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaHRtbCcsXG4gICAgZGlzcGxheU5hbWU6ICdIVE1MIEJsb2NrJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgaHRtbDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSHRtbEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgUGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIb21lcGFnZVBsdWdpbiBleHRlbmRzIFBsdWdpbiBpbXBsZW1lbnRzIElIb21lcGFnZVBsdWdpbiB7XG4gIGxheW91dDogTGF5b3V0Q29uZmlnID0gZ2V0RGVmYXVsdExheW91dCgpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZWdpc3RlckJsb2NrcygpO1xuXG4gICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIHVua25vd247XG4gICAgdGhpcy5sYXlvdXQgPSB2YWxpZGF0ZUxheW91dChyYXcpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCAobGVhZikgPT4gbmV3IEhvbWVwYWdlVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLWhvbWVwYWdlJyxcbiAgICAgIG5hbWU6ICdPcGVuIEhvbWVwYWdlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBtdXN0IGFwcGVhciBhYm92ZSB0aGUgZ3JpZCBpbiB0aGUgZmxleC1jb2x1bW4gbGF5b3V0XG4gICAgY29udGVudEVsLmluc2VydEJlZm9yZSh0aGlzLnRvb2xiYXIuZ2V0RWxlbWVudCgpLCB0aGlzLmdyaWQuZ2V0RWxlbWVudCgpKTtcblxuICAgIHRoaXMuZ3JpZC5yZW5kZXIobGF5b3V0LmJsb2NrcywgbGF5b3V0LmNvbHVtbnMpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKiBSZS1yZW5kZXIgdGhlIHZpZXcgZnJvbSBzY3JhdGNoIChlLmcuIGFmdGVyIHNldHRpbmdzIHJlc2V0KS4gKi9cbiAgYXN5bmMgcmVsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMub25PcGVuKCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzZXRJY29uIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgTGF5b3V0Q29uZmlnLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQmFzZUJsb2NrJztcblxudHlwZSBMYXlvdXRDaGFuZ2VDYWxsYmFjayA9IChsYXlvdXQ6IExheW91dENvbmZpZykgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGVmZmVjdGl2ZUNvbHVtbnMgPSAzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBvbkxheW91dENoYW5nZTogTGF5b3V0Q2hhbmdlQ2FsbGJhY2ssXG4gICkge1xuICAgIHRoaXMuZ3JpZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZ3JpZCcgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7XG4gICAgICBjb25zdCBuZXdFZmZlY3RpdmUgPSB0aGlzLmNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICAgIGlmIChuZXdFZmZlY3RpdmUgIT09IHRoaXMuZWZmZWN0aXZlQ29sdW1ucykge1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci5vYnNlcnZlKHRoaXMuZ3JpZEVsKTtcbiAgfVxuXG4gIC8qKiBFeHBvc2UgdGhlIHJvb3QgZ3JpZCBlbGVtZW50IHNvIEhvbWVwYWdlVmlldyBjYW4gcmVvcmRlciBpdCBpbiB0aGUgRE9NLiAqL1xuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy5ncmlkRWw7XG4gIH1cblxuICBwcml2YXRlIGNvbXB1dGVFZmZlY3RpdmVDb2x1bW5zKGxheW91dENvbHVtbnM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgdyA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoO1xuICAgIGlmICh3ID4gMCAmJiB3IDw9IDU0MCkgcmV0dXJuIDE7XG4gICAgaWYgKHcgPiAwICYmIHcgPD0gODQwKSByZXR1cm4gTWF0aC5taW4oMiwgbGF5b3V0Q29sdW1ucyk7XG4gICAgcmV0dXJuIGxheW91dENvbHVtbnM7XG4gIH1cblxuICByZW5kZXIoYmxvY2tzOiBCbG9ja0luc3RhbmNlW10sIGNvbHVtbnM6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2dyaWQnKTtcbiAgICB0aGlzLmdyaWRFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSG9tZXBhZ2UgYmxvY2tzJyk7XG4gICAgdGhpcy5lZmZlY3RpdmVDb2x1bW5zID0gdGhpcy5jb21wdXRlRWZmZWN0aXZlQ29sdW1ucyhjb2x1bW5zKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmdyaWRFbC5hZGRDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZ3JpZEVsLnJlbW92ZUNsYXNzKCdlZGl0LW1vZGUnKTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgZW1wdHkgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1lbXB0eS1zdGF0ZScgfSk7XG4gICAgICBlbXB0eS5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ05vIGJsb2NrcyB5ZXQuIENsaWNrIEVkaXQgdG8gYWRkIHlvdXIgZmlyc3QgYmxvY2suJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGJsb2Nrcykge1xuICAgICAgdGhpcy5yZW5kZXJCbG9jayhpbnN0YW5jZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJCbG9jayhpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldChpbnN0YW5jZS50eXBlKTtcbiAgICBpZiAoIWZhY3RvcnkpIHJldHVybjtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ibG9jay13cmFwcGVyJyB9KTtcbiAgICB3cmFwcGVyLmRhdGFzZXQuYmxvY2tJZCA9IGluc3RhbmNlLmlkO1xuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2dyaWRjZWxsJyk7XG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBmYWN0b3J5LmRpc3BsYXlOYW1lKTtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2subG9hZCgpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGJsb2NrLnJlbmRlcihjb250ZW50RWwpO1xuICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXN1bHQuY2F0Y2goZSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtIb21lcGFnZSBCbG9ja3NdIEVycm9yIHJlbmRlcmluZyBibG9jayAke2luc3RhbmNlLnR5cGV9OmAsIGUpO1xuICAgICAgICBjb250ZW50RWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGJsb2NrLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5ibG9ja3Muc2V0KGluc3RhbmNlLmlkLCB7IGJsb2NrLCB3cmFwcGVyIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseUdyaWRQb3NpdGlvbih3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBjb2xzID0gdGhpcy5lZmZlY3RpdmVDb2x1bW5zO1xuICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihpbnN0YW5jZS5jb2xTcGFuLCBjb2xzKTtcbiAgICAvLyBmbGV4LWdyb3cgcHJvcG9ydGlvbmFsIHRvIGNvbFNwYW4gc28gd3JhcHBlZCBpdGVtcyBzdHJldGNoIHRvIGZpbGwgdGhlIHJvd1xuICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjb2xTcGFuIC8gY29scykgKiAxMDA7XG4gICAgd3JhcHBlci5zdHlsZS5mbGV4ID0gYCR7Y29sU3Bhbn0gMCBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpKWA7XG4gICAgd3JhcHBlci5zdHlsZS5taW5XaWR0aCA9ICcwJztcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oYW5kbGUtYmFyJyB9KTtcblxuICAgIGNvbnN0IGhhbmRsZSA9IGJhci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1tb3ZlLWhhbmRsZScgfSk7XG4gICAgc2V0SWNvbihoYW5kbGUsICdncmlwLXZlcnRpY2FsJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlb3JkZXInKTtcbiAgICBoYW5kbGUuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlb3JkZXInKTtcblxuICAgIGNvbnN0IHNldHRpbmdzQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXNldHRpbmdzLWJ0bicgfSk7XG4gICAgc2V0SWNvbihzZXR0aW5nc0J0biwgJ3NldHRpbmdzJyk7XG4gICAgc2V0dGluZ3NCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Jsb2NrIHNldHRpbmdzJyk7XG4gICAgc2V0dGluZ3NCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ibG9ja3MuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZW50cnkpIHJldHVybjtcbiAgICAgIGVudHJ5LmJsb2NrLm9wZW5TZXR0aW5ncygoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nIH0pO1xuICAgIHNldEljb24ocmVtb3ZlQnRuLCAneCcpO1xuICAgIHJlbW92ZUJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIGJsb2NrJyk7XG4gICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBuZXcgUmVtb3ZlQmxvY2tDb25maXJtTW9kYWwodGhpcy5hcHAsICgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBpbnN0YW5jZS5pZCk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlwID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1yZXNpemUtZ3JpcCcgfSk7XG4gICAgc2V0SWNvbihncmlwLCAnbWF4aW1pemUtMicpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgZ3JpcC5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ0RyYWcgdG8gcmVzaXplJyk7XG4gICAgdGhpcy5hdHRhY2hSZXNpemVIYW5kbGVyKGdyaXAsIHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIHRoaXMuYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZTogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3QgY2xvbmUgPSB3cmFwcGVyLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNsb25lLmFkZENsYXNzKCdibG9jay1kcmFnLWNsb25lJyk7XG4gICAgICBjbG9uZS5zdHlsZS53aWR0aCA9IGAke3dyYXBwZXIub2Zmc2V0V2lkdGh9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUuaGVpZ2h0ID0gYCR7d3JhcHBlci5vZmZzZXRIZWlnaHR9cHhgO1xuICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIDIwfXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIDIwfXB4YDtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IGNsb25lO1xuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGluc3RhbmNlLmlkO1xuICAgICAgd3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY2xvbmUuc3R5bGUubGVmdCA9IGAke21lLmNsaWVudFggLSAyMH1weGA7XG4gICAgICAgIGNsb25lLnN0eWxlLnRvcCA9IGAke21lLmNsaWVudFkgLSAyMH1weGA7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5ibG9ja3MuZ2V0KHRhcmdldElkKT8ud3JhcHBlci5hZGRDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjbG9uZS5yZW1vdmUoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG4gICAgICAgIHdyYXBwZXIucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgICAgdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvckFsbCgnLmhvbWVwYWdlLWJsb2NrLXdyYXBwZXInKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnJlbW92ZUNsYXNzKCdibG9jay1kcm9wLXRhcmdldCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXRJZCA9IHRoaXMuZmluZEJsb2NrVW5kZXJDdXJzb3IobWUuY2xpZW50WCwgbWUuY2xpZW50WSwgc291cmNlSWQpO1xuICAgICAgICBpZiAodGFyZ2V0SWQpIHtcbiAgICAgICAgICB0aGlzLnN3YXBCbG9ja3Moc291cmNlSWQsIHRhcmdldElkKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hSZXNpemVIYW5kbGVyKGdyaXA6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBncmlwLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSB0aGlzLmVmZmVjdGl2ZUNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oY29sdW1ucywgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIGNvbnN0IGJhc2lzUGVyY2VudCA9IChjdXJyZW50Q29sU3BhbiAvIGNvbHVtbnMpICogMTAwO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmZsZXggPSBgJHtjdXJyZW50Q29sU3Bhbn0gMCBjYWxjKCR7YmFzaXNQZXJjZW50fSUgLSB2YXIoLS1ocC1nYXAsIDE2cHgpKWA7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBvbk1vdXNlVXAgPSAoKSA9PiB7XG4gICAgICAgIGFjLmFib3J0KCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyB7IC4uLmIsIGNvbFNwYW46IGN1cnJlbnRDb2xTcGFuIH0gOiBiLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQmxvY2tVbmRlckN1cnNvcih4OiBudW1iZXIsIHk6IG51bWJlciwgZXhjbHVkZUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IFtpZCwgeyB3cmFwcGVyIH1dIG9mIHRoaXMuYmxvY2tzKSB7XG4gICAgICBpZiAoaWQgPT09IGV4Y2x1ZGVJZCkgY29udGludWU7XG4gICAgICBjb25zdCByZWN0ID0gd3JhcHBlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICh4ID49IHJlY3QubGVmdCAmJiB4IDw9IHJlY3QucmlnaHQgJiYgeSA+PSByZWN0LnRvcCAmJiB5IDw9IHJlY3QuYm90dG9tKSB7XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKiogU3dhcCBwb3NpdGlvbnMgb2YgdHdvIGJsb2NrcyB1c2luZyBpbW11dGFibGUgdXBkYXRlcy4gKi9cbiAgcHJpdmF0ZSBzd2FwQmxvY2tzKGlkQTogc3RyaW5nLCBpZEI6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGJBID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRBKTtcbiAgICBjb25zdCBiQiA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmluZChiID0+IGIuaWQgPT09IGlkQik7XG4gICAgaWYgKCFiQSB8fCAhYkIpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgaWYgKGIuaWQgPT09IGlkQSkgcmV0dXJuIHsgLi4uYiwgY29sOiBiQi5jb2wsIHJvdzogYkIucm93LCBjb2xTcGFuOiBiQi5jb2xTcGFuLCByb3dTcGFuOiBiQi5yb3dTcGFuIH07XG4gICAgICBpZiAoYi5pZCA9PT0gaWRCKSByZXR1cm4geyAuLi5iLCBjb2w6IGJBLmNvbCwgcm93OiBiQS5yb3csIGNvbFNwYW46IGJBLmNvbFNwYW4sIHJvd1NwYW46IGJBLnJvd1NwYW4gfTtcbiAgICAgIHJldHVybiBiO1xuICAgIH0pO1xuXG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0RWRpdE1vZGUoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZWRpdE1vZGUgPSBlbmFibGVkO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIC8qKiBVcGRhdGUgY29sdW1uIGNvdW50LCBjbGFtcGluZyBlYWNoIGJsb2NrJ3MgY29sIGFuZCBjb2xTcGFuIHRvIGZpdC4gKi9cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+IHtcbiAgICAgIGNvbnN0IGNvbCA9IE1hdGgubWluKGIuY29sLCBuKTtcbiAgICAgIGNvbnN0IGNvbFNwYW4gPSBNYXRoLm1pbihiLmNvbFNwYW4sIG4gLSBjb2wgKyAxKTtcbiAgICAgIHJldHVybiB7IC4uLmIsIGNvbCwgY29sU3BhbiB9O1xuICAgIH0pO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGNvbHVtbnM6IG4sIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGZvY3VzZWQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICAgIGNvbnN0IGZvY3VzZWRCbG9ja0lkID0gKGZvY3VzZWQ/LmNsb3Nlc3QoJ1tkYXRhLWJsb2NrLWlkXScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmRhdGFzZXQuYmxvY2tJZDtcbiAgICB0aGlzLnJlbmRlcih0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyk7XG4gICAgaWYgKGZvY3VzZWRCbG9ja0lkKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1ibG9jay1pZD1cIiR7Zm9jdXNlZEJsb2NrSWR9XCJdYCk7XG4gICAgICBlbD8uZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICAvKiogVW5sb2FkIGFsbCBibG9ja3MgYW5kIGNhbmNlbCBhbnkgaW4tcHJvZ3Jlc3MgZHJhZy9yZXNpemUuICovXG4gIGRlc3Ryb3lBbGwoKTogdm9pZCB7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmU/LnJlbW92ZSgpO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG51bGw7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwucmVtb3ZlKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlbW92ZSBjb25maXJtYXRpb24gbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdSZW1vdmUgYmxvY2s/JyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdUaGlzIGJsb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBob21lcGFnZS4nIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdSZW1vdmUnKS5zZXRXYXJuaW5nKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vbkNvbmZpcm0oKTtcbiAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NhbmNlbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKSxcbiAgICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgR3JpZExheW91dCB9IGZyb20gJy4vR3JpZExheW91dCc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbGJhciB7XG4gIHByaXZhdGUgdG9vbGJhckVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0LFxuICAgIHByaXZhdGUgb25Db2x1bW5zQ2hhbmdlOiAobjogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICB0aGlzLnRvb2xiYXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogJ2hvbWVwYWdlLXRvb2xiYXInIH0pO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sYmFyJyk7XG4gICAgdGhpcy50b29sYmFyRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIHRvb2xiYXInKTtcbiAgICB0aGlzLnJlbmRlclRvb2xiYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVG9vbGJhcigpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5lbXB0eSgpO1xuXG4gICAgLy8gQ29sdW1uIGNvdW50IHNlbGVjdG9yXG4gICAgY29uc3QgY29sU2VsZWN0ID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndG9vbGJhci1jb2wtc2VsZWN0JyB9KTtcbiAgICBjb2xTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ051bWJlciBvZiBjb2x1bW5zJyk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gRWRpdCB0b2dnbGVcbiAgICBjb25zdCBlZGl0QnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1lZGl0LWJ0bicgfSk7XG4gICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgIGVkaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgICB0aGlzLmdyaWQuc2V0RWRpdE1vZGUodGhpcy5lZGl0TW9kZSk7XG4gICAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgICB0aGlzLnN5bmNBZGRCdXR0b24oKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRWRpdEJ0bihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gdGhpcy5lZGl0TW9kZSA/ICdcdTI3MTMgRG9uZScgOiAnXHUyNzBGIEVkaXQnO1xuICAgIGJ0bi50b2dnbGVDbGFzcygndG9vbGJhci1idG4tYWN0aXZlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRvb2xiYXJFbC5xdWVyeVNlbGVjdG9yKCcudG9vbGJhci1hZGQtYnRuJyk7XG4gICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgIWV4aXN0aW5nKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZWRpdE1vZGUgJiYgZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcbiAgICByZXR1cm4gdGhpcy50b29sYmFyRWw7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNsYXNzIEFkZEJsb2NrTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25TZWxlY3Q6ICh0eXBlOiBCbG9ja1R5cGUpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0FkZCBCbG9jaycgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGZhY3Rvcnkgb2YgQmxvY2tSZWdpc3RyeS5nZXRBbGwoKSkge1xuICAgICAgY29uc3QgYnRuID0gY29udGVudEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG4gICAgICAgIGNsczogJ2FkZC1ibG9jay1vcHRpb24nLFxuICAgICAgICB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lLFxuICAgICAgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMub25TZWxlY3QoZmFjdG9yeS50eXBlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEdyZWV0aW5nQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdncmVldGluZy1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd1RpbWU/OiBib29sZWFuIH07XG5cbiAgICBpZiAoc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctdGltZScgfSk7XG4gICAgfVxuICAgIHRoaXMubmFtZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctbmFtZScgfSk7XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgaG91ciA9IG5vdy5ob3VyKCk7XG4gICAgY29uc3QgeyBuYW1lID0gJ2JlbnRvcm5hdG8nLCBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgICBzaG93VGltZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGNvbnN0IHNhbHV0YXRpb24gPVxuICAgICAgaG91ciA+PSA1ICYmIGhvdXIgPCAxMiA/ICdCdW9uZ2lvcm5vJyA6XG4gICAgICBob3VyID49IDEyICYmIGhvdXIgPCAxOCA/ICdCdW9uIHBvbWVyaWdnaW8nIDpcbiAgICAgICdCdW9uYXNlcmEnO1xuXG4gICAgaWYgKHRoaXMudGltZUVsICYmIHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ0hIOm1tJykpO1xuICAgIH1cbiAgICBpZiAodGhpcy5uYW1lRWwpIHtcbiAgICAgIHRoaXMubmFtZUVsLnNldFRleHQoYCR7c2FsdXRhdGlvbn0sICR7bmFtZX1gKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEdyZWV0aW5nU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEdyZWV0aW5nU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnR3JlZXRpbmcgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdOYW1lJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0Lm5hbWUgYXMgc3RyaW5nID8/ICdiZW50b3JuYXRvJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm5hbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aW1lJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpbWUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1RpbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUJsb2NrIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFwcDogQXBwLFxuICAgIHByb3RlY3RlZCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcm90ZWN0ZWQgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBhYnN0cmFjdCByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbiAgLy8gT3ZlcnJpZGUgdG8gb3BlbiBhIHBlci1ibG9jayBzZXR0aW5ncyBtb2RhbFxuICBvcGVuU2V0dGluZ3MoX29uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge31cblxuICAvLyBSZW5kZXIgdGhlIG11dGVkIHVwcGVyY2FzZSBibG9jayBoZWFkZXIgbGFiZWwgaWYgdGl0bGUgaXMgbm9uLWVtcHR5XG4gIHByb3RlY3RlZCByZW5kZXJIZWFkZXIoZWw6IEhUTUxFbGVtZW50LCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICBlbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXInLCB0ZXh0OiB0aXRsZSB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBDbG9ja0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGF0ZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnY2xvY2stYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd0RhdGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dEYXRlPzogYm9vbGVhbiB9O1xuXG4gICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay10aW1lJyB9KTtcbiAgICBpZiAoc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stZGF0ZScgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IHsgc2hvd1NlY29uZHMgPSBmYWxzZSwgc2hvd0RhdGUgPSB0cnVlLCBmb3JtYXQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgc2hvd1NlY29uZHM/OiBib29sZWFuO1xuICAgICAgc2hvd0RhdGU/OiBib29sZWFuO1xuICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy50aW1lRWwpIHtcbiAgICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KGZvcm1hdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KHNob3dTZWNvbmRzID8gJ0hIOm1tOnNzJyA6ICdISDptbScpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0ZUVsICYmIHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ2RkZGQsIEQgTU1NTSBZWVlZJykpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgQ2xvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgQ2xvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgc2Vjb25kcycpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dTZWNvbmRzIGFzIGJvb2xlYW4gPz8gZmFsc2UpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93U2Vjb25kcyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGRhdGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93RGF0ZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RGF0ZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0N1c3RvbSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ09wdGlvbmFsIG1vbWVudC5qcyBmb3JtYXQgc3RyaW5nLCBlLmcuIFwiSEg6bW1cIi4gTGVhdmUgZW1wdHkgZm9yIGRlZmF1bHQuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb3JtYXQgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb3JtYXQgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgU3VnZ2VzdE1vZGFsLCBURmlsZSwgVEZvbGRlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIExpbmtJdGVtIHtcbiAgbGFiZWw6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBlbW9qaT86IHN0cmluZztcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEZvbGRlciBwaWNrZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclN1Z2dlc3RNb2RhbCBleHRlbmRzIFN1Z2dlc3RNb2RhbDxURm9sZGVyPiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PiBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlciwgZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuY3JlYXRlRWwoJ3NwYW4nLCB7IHRleHQ6IGZvbGRlci5wYXRoID09PSAnLycgPyAnLyAodmF1bHQgcm9vdCknIDogZm9sZGVyLnBhdGggfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyKTogdm9pZCB7IHRoaXMub25DaG9vc2UoZm9sZGVyKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjbGFzcyBGb2xkZXJMaW5rc0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSBjb250YWluZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbCA9IGVsO1xuICAgIGVsLmFkZENsYXNzKCdmb2xkZXItbGlua3MtYmxvY2snKTtcbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQ29udGVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJ1F1aWNrIExpbmtzJywgZm9sZGVyID0gJycsIGxpbmtzID0gW10gfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZm9sZGVyPzogc3RyaW5nO1xuICAgICAgbGlua3M/OiBMaW5rSXRlbVtdO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgbGlzdCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rcy1saXN0JyB9KTtcblxuICAgIC8vIEF1dG8tbGlzdCBub3RlcyBmcm9tIHNlbGVjdGVkIGZvbGRlciAoc29ydGVkIGFscGhhYmV0aWNhbGx5KVxuICAgIGlmIChmb2xkZXIpIHtcbiAgICAgIGNvbnN0IGZvbGRlck9iaiA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuICAgICAgaWYgKGZvbGRlck9iaiBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgY29uc3Qgbm90ZXMgPSBmb2xkZXJPYmouY2hpbGRyZW5cbiAgICAgICAgICAuZmlsdGVyKChjaGlsZCk6IGNoaWxkIGlzIFRGaWxlID0+IGNoaWxkIGluc3RhbmNlb2YgVEZpbGUgJiYgY2hpbGQuZXh0ZW5zaW9uID09PSAnbWQnKVxuICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSkpO1xuXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBub3Rlcykge1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZURpdih7IGNsczogJ2ZvbGRlci1saW5rLWl0ZW0nIH0pO1xuICAgICAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub3Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnTm8gbm90ZXMgaW4gdGhpcyBmb2xkZXIuJywgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IGBGb2xkZXIgXCIke2ZvbGRlcn1cIiBub3QgZm91bmQuYCwgY2xzOiAnYmxvY2stbG9hZGluZycgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFudWFsIGxpbmtzXG4gICAgZm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgIGlmIChsaW5rLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnbGluay1lbW9qaScsIHRleHQ6IGxpbmsuZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGxpbmsubGFiZWwgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobGluay5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWZvbGRlciAmJiBsaW5rcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGxpc3QuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdBZGQgbGlua3Mgb3Igc2VsZWN0IGEgZm9sZGVyIGluIHNldHRpbmdzLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRm9sZGVyTGlua3NTZXR0aW5nc01vZGFsKFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgICAgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gICAgICAgIG9uU2F2ZSgpO1xuICAgICAgfSxcbiAgICApLm9wZW4oKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IHsgdGl0bGU/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1aWNrIExpbmtzIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0OiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcbiAgICBkcmFmdC5saW5rcyA/Pz0gW107XG4gICAgY29uc3QgbGlua3MgPSBkcmFmdC5saW5rcztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1aWNrIExpbmtzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnQXV0by1saXN0IGZvbGRlcicpXG4gICAgICAuc2V0RGVzYygnTGlzdCBhbGwgbm90ZXMgZnJvbSB0aGlzIHZhdWx0IGZvbGRlciBhcyBsaW5rcy4nKVxuICAgICAgLmFkZFRleHQodCA9PiB7XG4gICAgICAgIGZvbGRlclRleHQgPSB0O1xuICAgICAgICB0LnNldFZhbHVlKGRyYWZ0LmZvbGRlciA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignZS5nLiBQcm9qZWN0cycpXG4gICAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmZvbGRlciA9IHY7IH0pO1xuICAgICAgfSlcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRJY29uKCdmb2xkZXInKS5zZXRUb29sdGlwKCdCcm93c2UgdmF1bHQgZm9sZGVycycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIG5ldyBGb2xkZXJTdWdnZXN0TW9kYWwodGhpcy5hcHAsIChmb2xkZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSBmb2xkZXIucGF0aCA9PT0gJy8nID8gJycgOiBmb2xkZXIucGF0aDtcbiAgICAgICAgICAgIGRyYWZ0LmZvbGRlciA9IHBhdGg7XG4gICAgICAgICAgICBmb2xkZXJUZXh0LnNldFZhbHVlKHBhdGgpO1xuICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ01hbnVhbCBsaW5rcycgfSk7XG5cbiAgICBjb25zdCBsaW5rc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoKTtcblxuICAgIGNvbnN0IHJlbmRlckxpbmtzID0gKCkgPT4ge1xuICAgICAgbGlua3NDb250YWluZXIuZW1wdHkoKTtcbiAgICAgIGxpbmtzLmZvckVhY2goKGxpbmssIGkpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlua3NDb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnc2V0dGluZ3MtbGluay1yb3cnIH0pO1xuICAgICAgICBuZXcgU2V0dGluZyhyb3cpXG4gICAgICAgICAgLnNldE5hbWUoYExpbmsgJHtpICsgMX1gKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignTGFiZWwnKS5zZXRWYWx1ZShsaW5rLmxhYmVsKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ubGFiZWwgPSB2OyB9KSlcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ1BhdGgnKS5zZXRWYWx1ZShsaW5rLnBhdGgpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5wYXRoID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdFbW9qaScpLnNldFZhbHVlKGxpbmsuZW1vamkgPz8gJycpLm9uQ2hhbmdlKHYgPT4geyBsaW5rc1tpXS5lbW9qaSA9IHYgfHwgdW5kZWZpbmVkOyB9KSlcbiAgICAgICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0SWNvbigndHJhc2gnKS5zZXRUb29sdGlwKCdSZW1vdmUnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgIGxpbmtzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIHJlbmRlckxpbmtzKCk7XG4gICAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICByZW5kZXJMaW5rcygpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ0FkZCBMaW5rJykub25DbGljaygoKSA9PiB7XG4gICAgICAgIGxpbmtzLnB1c2goeyBsYWJlbDogJycsIHBhdGg6ICcnIH0pO1xuICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgfSkpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PiBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5jb25zdCBNU19QRVJfREFZID0gODZfNDAwXzAwMDtcblxuZXhwb3J0IGNsYXNzIEluc2lnaHRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaW5zaWdodC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbnNpZ2h0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgaW5zaWdodC4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRhZyA9ICcnLCB0aXRsZSA9ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGFnPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBkYWlseVNlZWQ/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgY2FyZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtY2FyZCcgfSk7XG5cbiAgICBpZiAoIXRhZykge1xuICAgICAgY2FyZC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gYmxvY2sgc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhcmQuc2V0VGV4dChgTm8gZmlsZXMgZm91bmQgd2l0aCB0YWcgJHt0YWdTZWFyY2h9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVXNlIGxvY2FsIG1pZG5pZ2h0IGFzIHRoZSBkYXkgaW5kZXggc28gaXQgY2hhbmdlcyBhdCBsb2NhbCBtaWRuaWdodCwgbm90IFVUQ1xuICAgIGNvbnN0IGRheUluZGV4ID0gTWF0aC5mbG9vcihtb21lbnQoKS5zdGFydE9mKCdkYXknKS52YWx1ZU9mKCkgLyBNU19QRVJfREFZKTtcbiAgICBjb25zdCBpbmRleCA9IGRhaWx5U2VlZFxuICAgICAgPyBkYXlJbmRleCAlIGZpbGVzLmxlbmd0aFxuICAgICAgOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmaWxlcy5sZW5ndGgpO1xuXG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgY29uc3QgeyBoZWFkaW5nLCBib2R5IH0gPSB0aGlzLnBhcnNlQ29udGVudChjb250ZW50LCBjYWNoZSk7XG5cbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC10aXRsZScsIHRleHQ6IGhlYWRpbmcgfHwgZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgIGNhcmQuY3JlYXRlRGl2KHsgY2xzOiAnaW5zaWdodC1ib2R5JywgdGV4dDogYm9keSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBJbnNpZ2h0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCBlKTtcbiAgICAgIGNhcmQuc2V0VGV4dCgnRXJyb3IgcmVhZGluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRoZSBmaXJzdCBoZWFkaW5nIGFuZCBmaXJzdCBwYXJhZ3JhcGggdXNpbmcgbWV0YWRhdGFDYWNoZSBvZmZzZXRzLlxuICAgKiBGYWxscyBiYWNrIHRvIG1hbnVhbCBwYXJzaW5nIG9ubHkgaWYgY2FjaGUgaXMgdW5hdmFpbGFibGUuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQ29udGVudChjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiB7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH0ge1xuICAgIC8vIFVzZSBjYWNoZWQgaGVhZGluZyBpZiBhdmFpbGFibGUgKGF2b2lkcyBtYW51YWwgcGFyc2luZylcbiAgICBjb25zdCBoZWFkaW5nID0gY2FjaGU/LmhlYWRpbmdzPy5bMF0/LmhlYWRpbmcgPz8gJyc7XG5cbiAgICAvLyBTa2lwIGZyb250bWF0dGVyIHVzaW5nIHRoZSBjYWNoZWQgb2Zmc2V0XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcblxuICAgIC8vIEZpcnN0IG5vbi1lbXB0eSwgbm9uLWhlYWRpbmcgbGluZSBpcyB0aGUgYm9keVxuICAgIGNvbnN0IGJvZHkgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmluZChsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKSA/PyAnJztcblxuICAgIHJldHVybiB7IGhlYWRpbmcsIGJvZHkgfTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW5zaWdodFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBJbnNpZ2h0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW5zaWdodCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnRGFpbHkgSW5zaWdodCcpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnRGFpbHkgc2VlZCcpLnNldERlc2MoJ1Nob3cgc2FtZSBub3RlIGFsbCBkYXknKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5kYWlseVNlZWQgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZGFpbHlTZWVkID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIFJldHVybnMgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdCB0aGF0IGhhdmUgdGhlIGdpdmVuIHRhZy5cbiAqIGB0YWdgIG11c3QgaW5jbHVkZSB0aGUgbGVhZGluZyBgI2AgKGUuZy4gYCN2YWx1ZXNgKS5cbiAqIEhhbmRsZXMgYm90aCBpbmxpbmUgdGFncyBhbmQgWUFNTCBmcm9udG1hdHRlciB0YWdzICh3aXRoIG9yIHdpdGhvdXQgYCNgKSxcbiAqIGFuZCBmcm9udG1hdHRlciB0YWdzIHRoYXQgYXJlIGEgcGxhaW4gc3RyaW5nIGluc3RlYWQgb2YgYW4gYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlc1dpdGhUYWcoYXBwOiBBcHAsIHRhZzogc3RyaW5nKTogVEZpbGVbXSB7XG4gIHJldHVybiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcihmaWxlID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICBpZiAoIWNhY2hlKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBpbmxpbmVUYWdzID0gY2FjaGUudGFncz8ubWFwKHQgPT4gdC50YWcpID8/IFtdO1xuXG4gICAgY29uc3QgcmF3Rm1UYWdzID0gY2FjaGUuZnJvbnRtYXR0ZXI/LnRhZ3M7XG4gICAgY29uc3QgZm1UYWdBcnJheTogc3RyaW5nW10gPVxuICAgICAgQXJyYXkuaXNBcnJheShyYXdGbVRhZ3MpID8gcmF3Rm1UYWdzLmZpbHRlcigodCk6IHQgaXMgc3RyaW5nID0+IHR5cGVvZiB0ID09PSAnc3RyaW5nJykgOlxuICAgICAgdHlwZW9mIHJhd0ZtVGFncyA9PT0gJ3N0cmluZycgPyBbcmF3Rm1UYWdzXSA6XG4gICAgICBbXTtcbiAgICBjb25zdCBub3JtYWxpemVkRm1UYWdzID0gZm1UYWdBcnJheS5tYXAodCA9PiB0LnN0YXJ0c1dpdGgoJyMnKSA/IHQgOiBgIyR7dH1gKTtcblxuICAgIHJldHVybiBpbmxpbmVUYWdzLmluY2x1ZGVzKHRhZykgfHwgbm9ybWFsaXplZEZtVGFncy5pbmNsdWRlcyh0YWcpO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBUYWdHcmlkQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3RhZy1ncmlkLWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFRhZ0dyaWRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyB0YWcgZ3JpZC4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRhZyA9ICcnLCB0aXRsZSA9ICdOb3RlcycsIGNvbHVtbnMgPSAyLCBzaG93RW1vamkgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBzaG93RW1vamk/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ3JpZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3RhZy1ncmlkJyB9KTtcbiAgICBncmlkLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGdyaWQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICBjb25zdCBlbW9qaSA9IHNob3dFbW9qaSA/IChjYWNoZT8uZnJvbnRtYXR0ZXI/LmVtb2ppIGFzIHN0cmluZyA/PyAnJykgOiAnJztcblxuICAgICAgY29uc3QgYnRuID0gZ3JpZC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0YWctYnRuJyB9KTtcbiAgICAgIGlmIChlbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ3RhZy1idG4tZW1vamknLCB0ZXh0OiBlbW9qaSB9KTtcbiAgICAgIH1cbiAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgVGFnR3JpZFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBUYWdHcmlkU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnVGFnIEdyaWQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ05vdGVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBlbW9qaScpLnNldERlc2MoJ1JlYWQgXCJlbW9qaVwiIGZyb250bWF0dGVyIGZpZWxkJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0Vtb2ppIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dFbW9qaSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RmlsZXNXaXRoVGFnIH0gZnJvbSAnLi4vdXRpbHMvdGFncyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIE9ubHkgYXNzaWduIHNhZmUgQ1NTIGNvbG9yIHZhbHVlczsgcmVqZWN0IHBvdGVudGlhbGx5IG1hbGljaW91cyBzdHJpbmdzXG5jb25zdCBDT0xPUl9SRSA9IC9eKCNbMC05YS1mQS1GXXszLDh9fFthLXpBLVpdK3xyZ2JhP1xcKFteKV0rXFwpfGhzbGE/XFwoW14pXStcXCkpJC87XG5cbnR5cGUgUXVvdGVzQ29uZmlnID0ge1xuICBzb3VyY2U/OiAndGFnJyB8ICd0ZXh0JztcbiAgdGFnPzogc3RyaW5nO1xuICBxdW90ZXM/OiBzdHJpbmc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBjb2x1bW5zPzogbnVtYmVyO1xuICBtYXhJdGVtcz86IG51bWJlcjtcbn07XG5cbmV4cG9ydCBjbGFzcyBRdW90ZXNMaXN0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3F1b3Rlcy1saXN0LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFF1b3Rlc0xpc3RCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgbG9hZGluZyBxdW90ZXMuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBzb3VyY2UgPSAndGFnJywgdGFnID0gJycsIHF1b3RlcyA9ICcnLCB0aXRsZSA9ICdRdW90ZXMnLCBjb2x1bW5zID0gMiwgbWF4SXRlbXMgPSAyMCB9ID1cbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIFF1b3Rlc0NvbmZpZztcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG4gICAgY29sc0VsLnN0eWxlLmNvbHVtbkNvdW50ID0gU3RyaW5nKGNvbHVtbnMpO1xuXG4gICAgaWYgKHNvdXJjZSA9PT0gJ3RleHQnKSB7XG4gICAgICB0aGlzLnJlbmRlclRleHRRdW90ZXMoY29sc0VsLCBxdW90ZXMsIG1heEl0ZW1zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBzb3VyY2UgPT09ICd0YWcnXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbHNFbC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbmRlciBxdW90ZXMgZnJvbSBwbGFpbiB0ZXh0LiBFYWNoIHF1b3RlIGlzIHNlcGFyYXRlZCBieSBgLS0tYCBvbiBpdHMgb3duIGxpbmUuXG4gICAqIE9wdGlvbmFsbHkgYSBzb3VyY2UgbGluZSBjYW4gZm9sbG93IHRoZSBxdW90ZSB0ZXh0LCBwcmVmaXhlZCB3aXRoIGBcdTIwMTRgLCBgXHUyMDEzYCwgb3IgYC0tYC5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICogICBUaGUgb25seSB3YXkgdG8gZG8gZ3JlYXQgd29yayBpcyB0byBsb3ZlIHdoYXQgeW91IGRvLlxuICAgKiAgIFx1MjAxNCBTdGV2ZSBKb2JzXG4gICAqICAgLS0tXG4gICAqICAgSW4gdGhlIG1pZGRsZSBvZiBkaWZmaWN1bHR5IGxpZXMgb3Bwb3J0dW5pdHkuXG4gICAqICAgXHUyMDE0IEFsYmVydCBFaW5zdGVpblxuICAgKi9cbiAgcHJpdmF0ZSByZW5kZXJUZXh0UXVvdGVzKGNvbHNFbDogSFRNTEVsZW1lbnQsIHJhdzogc3RyaW5nLCBtYXhJdGVtczogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCFyYXcudHJpbSgpKSB7XG4gICAgICBjb2xzRWwuc2V0VGV4dCgnQWRkIHF1b3RlcyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBibG9ja3MgPSByYXcuc3BsaXQoL1xcbi0tLVxcbi8pLm1hcChiID0+IGIudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gYmxvY2suc3BsaXQoJ1xcbicpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdO1xuICAgICAgY29uc3QgaGFzU291cmNlID0gbGluZXMubGVuZ3RoID4gMSAmJiAvXihcdTIwMTR8XHUyMDEzfC0tKS8udGVzdChsYXN0TGluZSk7XG4gICAgICBjb25zdCBzb3VyY2VUZXh0ID0gaGFzU291cmNlID8gbGFzdExpbmUucmVwbGFjZSgvXihcdTIwMTR8XHUyMDEzfC0tKVxccyovLCAnJykgOiAnJztcbiAgICAgIGNvbnN0IGJvZHlMaW5lcyA9IGhhc1NvdXJjZSA/IGxpbmVzLnNsaWNlKDAsIC0xKSA6IGxpbmVzO1xuICAgICAgY29uc3QgYm9keSA9IGJvZHlMaW5lcy5qb2luKCcgJyk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgaXRlbS5jcmVhdGVFbCgnYmxvY2txdW90ZScsIHsgY2xzOiAncXVvdGUtY29udGVudCcsIHRleHQ6IGJvZHkgfSk7XG4gICAgICBpZiAoc291cmNlVGV4dCkgaXRlbS5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZS1zb3VyY2UnLCB0ZXh0OiBzb3VyY2VUZXh0IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBFeHRyYWN0IHRoZSBmaXJzdCBmZXcgbGluZXMgb2YgYm9keSBjb250ZW50IHVzaW5nIG1ldGFkYXRhQ2FjaGUgZnJvbnRtYXR0ZXIgb2Zmc2V0LiAqL1xuICBwcml2YXRlIGV4dHJhY3RCb2R5KGNvbnRlbnQ6IHN0cmluZywgY2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgY29uc3QgZm1FbmQgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kLm9mZnNldCA/PyAwO1xuICAgIGNvbnN0IGFmdGVyRm0gPSBjb250ZW50LnNsaWNlKGZtRW5kKTtcbiAgICBjb25zdCBsaW5lcyA9IGFmdGVyRm1cbiAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgIC5tYXAobCA9PiBsLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSk7XG4gICAgcmV0dXJuIGxpbmVzLnNsaWNlKDAsIDMpLmpvaW4oJyAnKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgUXVvdGVzU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFF1b3Rlc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1F1b3RlcyBMaXN0IFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKSBhcyBRdW90ZXNDb25maWc7XG4gICAgZHJhZnQuc291cmNlID8/PSAndGFnJztcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICAvLyBTb3VyY2UgdG9nZ2xlIFx1MjAxNCBzaG93cy9oaWRlcyB0aGUgcmVsZXZhbnQgc2VjdGlvblxuICAgIGxldCB0YWdTZWN0aW9uOiBIVE1MRWxlbWVudDtcbiAgICBsZXQgdGV4dFNlY3Rpb246IEhUTUxFbGVtZW50O1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ1NvdXJjZScpXG4gICAgICAuc2V0RGVzYygnUHVsbCBxdW90ZXMgZnJvbSB0YWdnZWQgbm90ZXMsIG9yIGVudGVyIHRoZW0gbWFudWFsbHkuJylcbiAgICAgIC5hZGREcm9wZG93bihkID0+XG4gICAgICAgIGQuYWRkT3B0aW9uKCd0YWcnLCAnTm90ZXMgd2l0aCB0YWcnKVxuICAgICAgICAgLmFkZE9wdGlvbigndGV4dCcsICdNYW51YWwgdGV4dCcpXG4gICAgICAgICAuc2V0VmFsdWUoZHJhZnQuc291cmNlID8/ICd0YWcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4ge1xuICAgICAgICAgICBkcmFmdC5zb3VyY2UgPSB2IGFzICd0YWcnIHwgJ3RleHQnO1xuICAgICAgICAgICB0YWdTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSB2ID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgICAgICAgICB0ZXh0U2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gdiA9PT0gJ3RleHQnID8gJycgOiAnbm9uZSc7XG4gICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAvLyBUYWcgc2VjdGlvblxuICAgIHRhZ1NlY3Rpb24gPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGFnU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gZHJhZnQuc291cmNlID09PSAndGFnJyA/ICcnIDogJ25vbmUnO1xuICAgIG5ldyBTZXR0aW5nKHRhZ1NlY3Rpb24pLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcblxuICAgIC8vIFRleHQgc2VjdGlvblxuICAgIHRleHRTZWN0aW9uID0gY29udGVudEVsLmNyZWF0ZURpdigpO1xuICAgIHRleHRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBkcmFmdC5zb3VyY2UgPT09ICd0ZXh0JyA/ICcnIDogJ25vbmUnO1xuICAgIGNvbnN0IHRleHRTZXR0aW5nID0gbmV3IFNldHRpbmcodGV4dFNlY3Rpb24pXG4gICAgICAuc2V0TmFtZSgnUXVvdGVzJylcbiAgICAgIC5zZXREZXNjKCdTZXBhcmF0ZSBxdW90ZXMgd2l0aCAtLS0gb24gaXRzIG93biBsaW5lLiBBZGQgYSBzb3VyY2UgbGluZSBzdGFydGluZyB3aXRoIFx1MjAxNCAoZS5nLiBcdTIwMTQgQXV0aG9yKS4nKTtcbiAgICB0ZXh0U2V0dGluZy5zZXR0aW5nRWwuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdjb2x1bW4nO1xuICAgIHRleHRTZXR0aW5nLnNldHRpbmdFbC5zdHlsZS5hbGlnbkl0ZW1zID0gJ3N0cmV0Y2gnO1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGV4dFNldHRpbmcuc2V0dGluZ0VsLmNyZWF0ZUVsKCd0ZXh0YXJlYScpO1xuICAgIHRleHRhcmVhLnJvd3MgPSA4O1xuICAgIHRleHRhcmVhLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIHRleHRhcmVhLnN0eWxlLm1hcmdpblRvcCA9ICc4cHgnO1xuICAgIHRleHRhcmVhLnN0eWxlLmZvbnRGYW1pbHkgPSAndmFyKC0tZm9udC1tb25vc3BhY2UpJztcbiAgICB0ZXh0YXJlYS5zdHlsZS5mb250U2l6ZSA9ICcxMnB4JztcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LnF1b3RlcyA/PyAnJztcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQucXVvdGVzID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+XG4gICAgICBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQge1xuICAgIHRoaXMub25DaG9vc2UoZm9sZGVyKTtcbiAgfVxufVxuXG5jb25zdCBJTUFHRV9FWFRTID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy53ZWJwJywgJy5zdmcnXSk7XG5jb25zdCBWSURFT19FWFRTID0gbmV3IFNldChbJy5tcDQnLCAnLndlYm0nLCAnLm1vdicsICcubWt2J10pO1xuXG5leHBvcnQgY2xhc3MgSW1hZ2VHYWxsZXJ5QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2ltYWdlLWdhbGxlcnktYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW1hZ2VHYWxsZXJ5QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgZ2FsbGVyeS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZvbGRlciA9ICcnLCB0aXRsZSA9ICdHYWxsZXJ5JywgY29sdW1ucyA9IDMsIG1heEl0ZW1zID0gMjAgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIG1heEl0ZW1zPzogbnVtYmVyO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ2FsbGVyeSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ltYWdlLWdhbGxlcnknIH0pO1xuICAgIGdhbGxlcnkuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoIWZvbGRlcikge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KCdDb25maWd1cmUgYSBmb2xkZXIgcGF0aCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KGBGb2xkZXIgXCIke2ZvbGRlcn1cIiBub3QgZm91bmQuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldE1lZGlhRmlsZXMoZm9sZGVyT2JqKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGV4dCA9IGAuJHtmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICBjb25zdCB3cmFwcGVyID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdnYWxsZXJ5LWl0ZW0nIH0pO1xuXG4gICAgICBpZiAoSU1BR0VfRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICBjb25zdCBpbWcgPSB3cmFwcGVyLmNyZWF0ZUVsKCdpbWcnKTtcbiAgICAgICAgaW1nLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgaW1nLmxvYWRpbmcgPSAnbGF6eSc7XG4gICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICB3cmFwcGVyLmFkZENsYXNzKCdnYWxsZXJ5LWl0ZW0tdmlkZW8nKTtcbiAgICAgICAgd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICd2aWRlby1wbGF5LW92ZXJsYXknLCB0ZXh0OiAnXHUyNUI2JyB9KTtcblxuICAgICAgICBjb25zdCB2aWRlbyA9IHdyYXBwZXIuY3JlYXRlRWwoJ3ZpZGVvJykgYXMgSFRNTFZpZGVvRWxlbWVudDtcbiAgICAgICAgdmlkZW8uc3JjID0gdGhpcy5hcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGZpbGUpO1xuICAgICAgICB2aWRlby5tdXRlZCA9IHRydWU7XG4gICAgICAgIHZpZGVvLmxvb3AgPSB0cnVlO1xuICAgICAgICB2aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgICAgICB2aWRlby5wcmVsb2FkID0gJ21ldGFkYXRhJztcblxuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7IHZvaWQgdmlkZW8ucGxheSgpOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4geyB2aWRlby5wYXVzZSgpOyB2aWRlby5jdXJyZW50VGltZSA9IDA7IH0pO1xuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TWVkaWFGaWxlcyhmb2xkZXI6IFRGb2xkZXIpOiBURmlsZVtdIHtcbiAgICBjb25zdCBmaWxlczogVEZpbGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgY29uc3QgZXh0ID0gYC4ke2NoaWxkLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkgfHwgVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICAgICAgZmlsZXMucHVzaChjaGlsZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKGZvbGRlcik7XG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbWFnZUdhbGxlcnlTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW1hZ2UgR2FsbGVyeSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnR2FsbGVyeScpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdGb2xkZXInKVxuICAgICAgLnNldERlc2MoJ1BpY2sgYSB2YXVsdCBmb2xkZXIuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdBdHRhY2htZW50cy9QaG90b3MnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKS5hZGRPcHRpb24oJzQnLCAnNCcpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDMpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgREVCT1VOQ0VfTVMgPSAzMDA7XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZE5vdGVCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZW1iZWRkZWQtbm90ZS1ibG9jaycpO1xuXG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgZmlsZS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZ2lzdGVyIHZhdWx0IGxpc3RlbmVyIG9uY2U7IGRlYm91bmNlIHJhcGlkIHNhdmVzXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAudmF1bHQub24oJ21vZGlmeScsIChtb2RGaWxlKSA9PiB7XG4gICAgICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBmaWxlUGF0aD86IHN0cmluZyB9O1xuICAgICAgICBpZiAobW9kRmlsZS5wYXRoID09PSBmaWxlUGF0aCAmJiB0aGlzLmNvbnRhaW5lckVsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQodGFyZ2V0KS5jYXRjaChlID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlLXJlbmRlciBhZnRlciBtb2RpZnk6JywgZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LCBERUJPVU5DRV9NUyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZpbGVQYXRoID0gJycsIHNob3dUaXRsZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZpbGVQYXRoPzogc3RyaW5nO1xuICAgICAgc2hvd1RpdGxlPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgIGVsLnNldFRleHQoJ0NvbmZpZ3VyZSBhIGZpbGUgcGF0aCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICBlbC5zZXRUZXh0KGBGaWxlIG5vdCBmb3VuZDogJHtmaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2hvd1RpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgZmlsZS5iYXNlbmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1iZWRkZWQtbm90ZS1jb250ZW50JyB9KTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsIGZpbGUucGF0aCwgdGhpcyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgTWFya2Rvd25SZW5kZXJlciBmYWlsZWQ6JywgZSk7XG4gICAgICBjb250ZW50RWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuJyk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBFbWJlZGRlZE5vdGVTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnRW1iZWRkZWQgTm90ZSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0ZpbGUgcGF0aCcpLnNldERlc2MoJ1ZhdWx0IHBhdGggdG8gdGhlIG5vdGUgKGUuZy4gTm90ZXMvTXlOb3RlLm1kKScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5maWxlUGF0aCBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5maWxlUGF0aCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHRpdGxlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpdGxlIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNYXJrZG93blJlbmRlcmVyLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIFN0YXRpY1RleHRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnc3RhdGljLXRleHQtYmxvY2snKTtcbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gU3RhdGljVGV4dEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgY29udGVudC4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGNvbnRlbnQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb250ZW50Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3N0YXRpYy10ZXh0LWNvbnRlbnQnIH0pO1xuXG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICBjb250ZW50RWwuc2V0VGV4dCgnQ29uZmlndXJlIHRleHQgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgJycsIHRoaXMpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFN0YXRpY1RleHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdTdGF0aWMgVGV4dCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSB0ZXh0LicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbnRlbnQnKS5zZXREZXNjKCdTdXBwb3J0cyBNYXJrZG93bi4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LmNvbnRlbnQgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMDtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuY29udGVudCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNhbml0aXplSFRNTFRvRG9tIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgSHRtbEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdodG1sLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGh0bWwgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBodG1sPzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaHRtbC1ibG9jay1jb250ZW50JyB9KTtcblxuICAgIGlmICghaHRtbCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSBIVE1MIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnRlbnRFbC5hcHBlbmRDaGlsZChzYW5pdGl6ZUhUTUxUb0RvbShodG1sKSk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEh0bWxCbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIVE1MIEJsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5zZXREZXNjKCdPcHRpb25hbCBoZWFkZXIgc2hvd24gYWJvdmUgdGhlIEhUTUwuJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnSFRNTCcpLnNldERlc2MoJ0hUTUwgaXMgc2FuaXRpemVkIGJlZm9yZSByZW5kZXJpbmcuJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5odG1sIGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTI7XG4gICAgdGV4dGFyZWEuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0Lmh0bWwgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTog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QUF1QyxFQUMvQztBQUFBLE1BQVksVUFDWCxLQUNHLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFNBQVMsT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLENBQUMsRUFDM0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sVUFBVSxPQUFPLEtBQUs7QUFDekMsY0FBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIkZvbGRlclN1Z2dlc3RNb2RhbCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSJdCn0K
