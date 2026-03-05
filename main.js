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
    this.gridEl = containerEl.createDiv({ cls: "homepage-grid" });
  }
  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement() {
    return this.gridEl;
  }
  render(blocks, columns) {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.setAttribute("role", "grid");
    this.gridEl.setAttribute("aria-label", "Homepage blocks");
    this.gridEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
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
    wrapper.style.gridColumn = `${instance.col} / span ${instance.colSpan}`;
    wrapper.style.gridRow = `${instance.row} / span ${instance.rowSpan}`;
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
      const columns = this.plugin.layout.columns;
      const colWidth = this.gridEl.offsetWidth / columns;
      let currentColSpan = startColSpan;
      const onMouseMove = (me) => {
        const deltaX = me.clientX - startX;
        const deltaCols = Math.round(deltaX / colWidth);
        const max = columns - instance.col + 1;
        currentColSpan = Math.max(1, Math.min(max, startColSpan + deltaCols));
        wrapper.style.gridColumn = `${instance.col} / span ${currentColSpan}`;
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
    const { tag = "", title = "Quotes", columns = 2, maxItems = 20 } = this.instance.config;
    this.renderHeader(el, title);
    const colsEl = el.createDiv({ cls: "quotes-columns" });
    colsEl.style.columnCount = String(columns);
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
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Quotes List Settings" });
    const draft = structuredClone(this.config);
    new import_obsidian10.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.title) != null ? _a : "Quotes").onChange((v) => {
          draft.title = v;
        });
      }
    );
    new import_obsidian10.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = draft.tag) != null ? _a : "").onChange((v) => {
          draft.tag = v;
        });
      }
    );
    new import_obsidian10.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").setValue(String((_a = draft.columns) != null ? _a : 2)).onChange((v) => {
          draft.columns = Number(v);
        });
      }
    );
    new import_obsidian10.Setting(contentEl).setName("Max items").addText(
      (t) => {
        var _a;
        return t.setValue(String((_a = draft.maxItems) != null ? _a : 20)).onChange((v) => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBzaG93RW1vamk6IHRydWUgfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVGFnIEdyaWQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdOb3RlcycsIGNvbHVtbnM6IDIsIHNob3dFbW9qaTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDIgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBUYWdHcmlkQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3F1b3Rlcy1saXN0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1F1b3RlcyBMaXN0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnUXVvdGVzJywgY29sdW1uczogMiwgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFF1b3Rlc0xpc3RCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaW1hZ2UtZ2FsbGVyeScsXG4gICAgZGlzcGxheU5hbWU6ICdJbWFnZSBHYWxsZXJ5JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZvbGRlcjogJycsIHRpdGxlOiAnR2FsbGVyeScsIGNvbHVtbnM6IDMsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDMsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBJbWFnZUdhbGxlcnlCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnZW1iZWRkZWQtbm90ZScsXG4gICAgZGlzcGxheU5hbWU6ICdFbWJlZGRlZCBOb3RlJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZpbGVQYXRoOiAnJywgc2hvd1RpdGxlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEVtYmVkZGVkTm90ZUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdzdGF0aWMtdGV4dCcsXG4gICAgZGlzcGxheU5hbWU6ICdTdGF0aWMgVGV4dCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGNvbnRlbnQ6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFN0YXRpY1RleHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaHRtbCcsXG4gICAgZGlzcGxheU5hbWU6ICdIVE1MIEJsb2NrJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgaHRtbDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSHRtbEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgUGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIb21lcGFnZVBsdWdpbiBleHRlbmRzIFBsdWdpbiBpbXBsZW1lbnRzIElIb21lcGFnZVBsdWdpbiB7XG4gIGxheW91dDogTGF5b3V0Q29uZmlnID0gZ2V0RGVmYXVsdExheW91dCgpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZWdpc3RlckJsb2NrcygpO1xuXG4gICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIHVua25vd247XG4gICAgdGhpcy5sYXlvdXQgPSB2YWxpZGF0ZUxheW91dChyYXcpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCAobGVhZikgPT4gbmV3IEhvbWVwYWdlVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLWhvbWVwYWdlJyxcbiAgICAgIG5hbWU6ICdPcGVuIEhvbWVwYWdlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBtdXN0IGFwcGVhciBhYm92ZSB0aGUgZ3JpZCBpbiB0aGUgZmxleC1jb2x1bW4gbGF5b3V0XG4gICAgY29udGVudEVsLmluc2VydEJlZm9yZSh0aGlzLnRvb2xiYXIuZ2V0RWxlbWVudCgpLCB0aGlzLmdyaWQuZ2V0RWxlbWVudCgpKTtcblxuICAgIHRoaXMuZ3JpZC5yZW5kZXIobGF5b3V0LmJsb2NrcywgbGF5b3V0LmNvbHVtbnMpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKiBSZS1yZW5kZXIgdGhlIHZpZXcgZnJvbSBzY3JhdGNoIChlLmcuIGFmdGVyIHNldHRpbmdzIHJlc2V0KS4gKi9cbiAgYXN5bmMgcmVsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMub25PcGVuKCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzZXRJY29uIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgTGF5b3V0Q29uZmlnLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQmFzZUJsb2NrJztcblxudHlwZSBMYXlvdXRDaGFuZ2VDYWxsYmFjayA9IChsYXlvdXQ6IExheW91dENvbmZpZykgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBvbkxheW91dENoYW5nZTogTGF5b3V0Q2hhbmdlQ2FsbGJhY2ssXG4gICkge1xuICAgIHRoaXMuZ3JpZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZ3JpZCcgfSk7XG4gIH1cblxuICAvKiogRXhwb3NlIHRoZSByb290IGdyaWQgZWxlbWVudCBzbyBIb21lcGFnZVZpZXcgY2FuIHJlb3JkZXIgaXQgaW4gdGhlIERPTS4gKi9cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZ3JpZEVsO1xuICB9XG5cbiAgcmVuZGVyKGJsb2NrczogQmxvY2tJbnN0YW5jZVtdLCBjb2x1bW5zOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdncmlkJyk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIGJsb2NrcycpO1xuICAgIHRoaXMuZ3JpZEVsLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIG1pbm1heCgwLCAxZnIpKWA7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmdyaWRFbC5yZW1vdmVDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktc3RhdGUnIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdObyBibG9ja3MgeWV0LiBDbGljayBFZGl0IHRvIGFkZCB5b3VyIGZpcnN0IGJsb2NrLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBibG9ja3MpIHtcbiAgICAgIHRoaXMucmVuZGVyQmxvY2soaW5zdGFuY2UpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQoaW5zdGFuY2UudHlwZSk7XG4gICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtYmxvY2std3JhcHBlcicgfSk7XG4gICAgd3JhcHBlci5kYXRhc2V0LmJsb2NrSWQgPSBpbnN0YW5jZS5pZDtcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdncmlkY2VsbCcpO1xuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgZmFjdG9yeS5kaXNwbGF5TmFtZSk7XG4gICAgdGhpcy5hcHBseUdyaWRQb3NpdGlvbih3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5hdHRhY2hFZGl0SGFuZGxlcyh3cmFwcGVyLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1jb250ZW50JyB9KTtcbiAgICBjb25zdCBibG9jayA9IGZhY3RvcnkuY3JlYXRlKHRoaXMuYXBwLCBpbnN0YW5jZSwgdGhpcy5wbHVnaW4pO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuYmxvY2tzLnNldChpbnN0YW5jZS5pZCwgeyBibG9jaywgd3JhcHBlciB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgd3JhcHBlci5zdHlsZS5ncmlkQ29sdW1uID0gYCR7aW5zdGFuY2UuY29sfSAvIHNwYW4gJHtpbnN0YW5jZS5jb2xTcGFufWA7XG4gICAgd3JhcHBlci5zdHlsZS5ncmlkUm93ID0gYCR7aW5zdGFuY2Uucm93fSAvIHNwYW4gJHtpbnN0YW5jZS5yb3dTcGFufWA7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBlbnRyeS5ibG9jay5vcGVuU2V0dGluZ3MoKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyBpbnN0YW5jZSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1yZW1vdmUtYnRuJyB9KTtcbiAgICBzZXRJY29uKHJlbW92ZUJ0biwgJ3gnKTtcbiAgICByZW1vdmVCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1JlbW92ZSBibG9jaycpO1xuICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgbmV3IFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsKHRoaXMuYXBwLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnIH0pO1xuICAgIHNldEljb24oZ3JpcCwgJ21heGltaXplLTInKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIHRoaXMuYXR0YWNoUmVzaXplSGFuZGxlcihncmlwLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICB0aGlzLmF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZSwgd3JhcHBlciwgaW5zdGFuY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hEcmFnSGFuZGxlcihoYW5kbGU6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IGNsb25lID0gd3JhcHBlci5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBjbG9uZS5hZGRDbGFzcygnYmxvY2stZHJhZy1jbG9uZScpO1xuICAgICAgY2xvbmUuc3R5bGUud2lkdGggPSBgJHt3cmFwcGVyLm9mZnNldFdpZHRofXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmhlaWdodCA9IGAke3dyYXBwZXIub2Zmc2V0SGVpZ2h0fXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHtlLmNsaWVudFggLSAyMH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHtlLmNsaWVudFkgLSAyMH1weGA7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBjbG9uZTtcblxuICAgICAgY29uc3Qgc291cmNlSWQgPSBpbnN0YW5jZS5pZDtcbiAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHttZS5jbGllbnRYIC0gMjB9cHhgO1xuICAgICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHttZS5jbGllbnRZIC0gMjB9cHhgO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldCh0YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY2xvbmUucmVtb3ZlKCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuICAgICAgICB3cmFwcGVyLnJlbW92ZUNsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5zd2FwQmxvY2tzKHNvdXJjZUlkLCB0YXJnZXRJZCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoUmVzaXplSGFuZGxlcihncmlwOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgZ3JpcC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IHN0YXJ0WCA9IGUuY2xpZW50WDtcbiAgICAgIGNvbnN0IHN0YXJ0Q29sU3BhbiA9IGluc3RhbmNlLmNvbFNwYW47XG4gICAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGNvbnN0IG1heCA9IGNvbHVtbnMgLSBpbnN0YW5jZS5jb2wgKyAxO1xuICAgICAgICBjdXJyZW50Q29sU3BhbiA9IE1hdGgubWF4KDEsIE1hdGgubWluKG1heCwgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIHdyYXBwZXIuc3R5bGUuZ3JpZENvbHVtbiA9IGAke2luc3RhbmNlLmNvbH0gLyBzcGFuICR7Y3VycmVudENvbFNwYW59YDtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4gfSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRCbG9ja1VuZGVyQ3Vyc29yKHg6IG51bWJlciwgeTogbnVtYmVyLCBleGNsdWRlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgW2lkLCB7IHdyYXBwZXIgfV0gb2YgdGhpcy5ibG9ja3MpIHtcbiAgICAgIGlmIChpZCA9PT0gZXhjbHVkZUlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY3QgPSB3cmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHggPj0gcmVjdC5sZWZ0ICYmIHggPD0gcmVjdC5yaWdodCAmJiB5ID49IHJlY3QudG9wICYmIHkgPD0gcmVjdC5ib3R0b20pIHtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBTd2FwIHBvc2l0aW9ucyBvZiB0d28gYmxvY2tzIHVzaW5nIGltbXV0YWJsZSB1cGRhdGVzLiAqL1xuICBwcml2YXRlIHN3YXBCbG9ja3MoaWRBOiBzdHJpbmcsIGlkQjogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYkEgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBpZEEpO1xuICAgIGNvbnN0IGJCID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRCKTtcbiAgICBpZiAoIWJBIHx8ICFiQikgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBpZiAoYi5pZCA9PT0gaWRBKSByZXR1cm4geyAuLi5iLCBjb2w6IGJCLmNvbCwgcm93OiBiQi5yb3csIGNvbFNwYW46IGJCLmNvbFNwYW4sIHJvd1NwYW46IGJCLnJvd1NwYW4gfTtcbiAgICAgIGlmIChiLmlkID09PSBpZEIpIHJldHVybiB7IC4uLmIsIGNvbDogYkEuY29sLCByb3c6IGJBLnJvdywgY29sU3BhbjogYkEuY29sU3Bhbiwgcm93U3BhbjogYkEucm93U3BhbiB9O1xuICAgICAgcmV0dXJuIGI7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgLyoqIFVwZGF0ZSBjb2x1bW4gY291bnQsIGNsYW1waW5nIGVhY2ggYmxvY2sncyBjb2wgYW5kIGNvbFNwYW4gdG8gZml0LiAqL1xuICBzZXRDb2x1bW5zKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgY29uc3QgY29sID0gTWF0aC5taW4oYi5jb2wsIG4pO1xuICAgICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGIuY29sU3BhbiwgbiAtIGNvbCArIDEpO1xuICAgICAgcmV0dXJuIHsgLi4uYiwgY29sLCBjb2xTcGFuIH07XG4gICAgfSk7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgY29sdW1uczogbiwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgYWRkQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgaW5zdGFuY2VdO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVyZW5kZXIoKTogdm9pZCB7XG4gICAgY29uc3QgZm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgZm9jdXNlZEJsb2NrSWQgPSAoZm9jdXNlZD8uY2xvc2VzdCgnW2RhdGEtYmxvY2staWRdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uZGF0YXNldC5ibG9ja0lkO1xuICAgIHRoaXMucmVuZGVyKHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICBpZiAoZm9jdXNlZEJsb2NrSWQpIHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oYFtkYXRhLWJsb2NrLWlkPVwiJHtmb2N1c2VkQmxvY2tJZH1cIl1gKTtcbiAgICAgIGVsPy5mb2N1cygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBVbmxvYWQgYWxsIGJsb2NrcyBhbmQgY2FuY2VsIGFueSBpbi1wcm9ncmVzcyBkcmFnL3Jlc2l6ZS4gKi9cbiAgZGVzdHJveUFsbCgpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgdGhpcy5hY3RpdmVDbG9uZT8ucmVtb3ZlKCk7XG4gICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHsgYmxvY2sgfSBvZiB0aGlzLmJsb2Nrcy52YWx1ZXMoKSkge1xuICAgICAgYmxvY2sudW5sb2FkKCk7XG4gICAgfVxuICAgIHRoaXMuYmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICAvKiogRnVsbCB0ZWFyZG93bjogdW5sb2FkIGJsb2NrcyBhbmQgcmVtb3ZlIHRoZSBncmlkIGVsZW1lbnQgZnJvbSB0aGUgRE9NLiAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLnJlbW92ZSgpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBSZW1vdmUgY29uZmlybWF0aW9uIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBSZW1vdmVCbG9ja0NvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25Db25maXJtOiAoKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUmVtb3ZlIGJsb2NrPycgfSk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnVGhpcyBibG9jayB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgaG9tZXBhZ2UuJyB9KTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVtb3ZlJykuc2V0V2FybmluZygpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25Db25maXJtKCk7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEJsb2NrRmFjdG9yeSwgQmxvY2tUeXBlIH0gZnJvbSAnLi90eXBlcyc7XG5cbmNsYXNzIEJsb2NrUmVnaXN0cnlDbGFzcyB7XG4gIHByaXZhdGUgZmFjdG9yaWVzID0gbmV3IE1hcDxCbG9ja1R5cGUsIEJsb2NrRmFjdG9yeT4oKTtcblxuICByZWdpc3RlcihmYWN0b3J5OiBCbG9ja0ZhY3RvcnkpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5zZXQoZmFjdG9yeS50eXBlLCBmYWN0b3J5KTtcbiAgfVxuXG4gIGdldCh0eXBlOiBCbG9ja1R5cGUpOiBCbG9ja0ZhY3RvcnkgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmZhY3Rvcmllcy5nZXQodHlwZSk7XG4gIH1cblxuICBnZXRBbGwoKTogQmxvY2tGYWN0b3J5W10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZmFjdG9yaWVzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLmNsZWFyKCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IEJsb2NrUmVnaXN0cnkgPSBuZXcgQmxvY2tSZWdpc3RyeUNsYXNzKCk7XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIEJsb2NrVHlwZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBCbG9ja1JlZ2lzdHJ5IH0gZnJvbSAnLi9CbG9ja1JlZ2lzdHJ5JztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuXG5leHBvcnQgY2xhc3MgRWRpdFRvb2xiYXIge1xuICBwcml2YXRlIHRvb2xiYXJFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG4gICAgcHJpdmF0ZSBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICAgIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCxcbiAgICBwcml2YXRlIG9uQ29sdW1uc0NoYW5nZTogKG46IG51bWJlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgdGhpcy50b29sYmFyRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS10b29sYmFyJyB9KTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAndG9vbGJhcicpO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSB0b29sYmFyJyk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgY29sU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOdW1iZXIgb2YgY29sdW1ucycpO1xuICAgIFsyLCAzLCA0XS5mb3JFYWNoKG4gPT4ge1xuICAgICAgY29uc3Qgb3B0ID0gY29sU2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHZhbHVlOiBTdHJpbmcobiksIHRleHQ6IGAke259IGNvbGAgfSk7XG4gICAgICBpZiAobiA9PT0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgfSk7XG4gICAgY29sU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMub25Db2x1bW5zQ2hhbmdlKE51bWJlcihjb2xTZWxlY3QudmFsdWUpKTtcbiAgICB9KTtcblxuICAgIC8vIEVkaXQgdG9nZ2xlXG4gICAgY29uc3QgZWRpdEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItZWRpdC1idG4nIH0pO1xuICAgIHRoaXMudXBkYXRlRWRpdEJ0bihlZGl0QnRuKTtcbiAgICBlZGl0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgdGhpcy5lZGl0TW9kZSA9ICF0aGlzLmVkaXRNb2RlO1xuICAgICAgdGhpcy5ncmlkLnNldEVkaXRNb2RlKHRoaXMuZWRpdE1vZGUpO1xuICAgICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgICAgdGhpcy5zeW5jQWRkQnV0dG9uKCk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5hcHBlbmRBZGRCdXR0b24oKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUVkaXRCdG4oYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IHRoaXMuZWRpdE1vZGUgPyAnXHUyNzEzIERvbmUnIDogJ1x1MjcwRiBFZGl0JztcbiAgICBidG4udG9nZ2xlQ2xhc3MoJ3Rvb2xiYXItYnRuLWFjdGl2ZScsIHRoaXMuZWRpdE1vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzeW5jQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50b29sYmFyRWwucXVlcnlTZWxlY3RvcignLnRvb2xiYXItYWRkLWJ0bicpO1xuICAgIGlmICh0aGlzLmVkaXRNb2RlICYmICFleGlzdGluZykge1xuICAgICAgdGhpcy5hcHBlbmRBZGRCdXR0b24oKTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmVkaXRNb2RlICYmIGV4aXN0aW5nKSB7XG4gICAgICBleGlzdGluZy5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZEFkZEJ1dHRvbigpOiB2b2lkIHtcbiAgICBjb25zdCBhZGRCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWFkZC1idG4nLCB0ZXh0OiAnKyBBZGQgQmxvY2snIH0pO1xuICAgIGFkZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIG5ldyBBZGRCbG9ja01vZGFsKHRoaXMuYXBwLCAodHlwZSkgPT4ge1xuICAgICAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQodHlwZSk7XG4gICAgICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1heFJvdyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MucmVkdWNlKFxuICAgICAgICAgIChtYXgsIGIpID0+IE1hdGgubWF4KG1heCwgYi5yb3cgKyBiLnJvd1NwYW4gLSAxKSwgMCxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSA9IHtcbiAgICAgICAgICBpZDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIGNvbDogMSxcbiAgICAgICAgICByb3c6IG1heFJvdyArIDEsXG4gICAgICAgICAgY29sU3BhbjogTWF0aC5taW4oZmFjdG9yeS5kZWZhdWx0U2l6ZS5jb2xTcGFuLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyksXG4gICAgICAgICAgcm93U3BhbjogZmFjdG9yeS5kZWZhdWx0U2l6ZS5yb3dTcGFuLFxuICAgICAgICAgIGNvbmZpZzogeyAuLi5mYWN0b3J5LmRlZmF1bHRDb25maWcgfSxcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdyaWQuYWRkQmxvY2soaW5zdGFuY2UpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMudG9vbGJhckVsO1xuICB9XG5cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG5jbGFzcyBBZGRCbG9ja01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uU2VsZWN0OiAodHlwZTogQmxvY2tUeXBlKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBZGQgQmxvY2snIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuICAgICAgICBjbHM6ICdhZGQtYmxvY2stb3B0aW9uJyxcbiAgICAgICAgdGV4dDogZmFjdG9yeS5kaXNwbGF5TmFtZSxcbiAgICAgIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsIGlmIHRpdGxlIGlzIG5vbi1lbXB0eVxuICBwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGVsOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aXRsZSkge1xuICAgICAgZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJywgdGV4dDogdGl0bGUgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRhdGVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2Nsb2NrLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dEYXRlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93RGF0ZT86IGJvb2xlYW4gfTtcblxuICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stdGltZScgfSk7XG4gICAgaWYgKHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLWRhdGUnIH0pO1xuICAgIH1cblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCB7IHNob3dTZWNvbmRzID0gZmFsc2UsIHNob3dEYXRlID0gdHJ1ZSwgZm9ybWF0ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHNob3dTZWNvbmRzPzogYm9vbGVhbjtcbiAgICAgIHNob3dEYXRlPzogYm9vbGVhbjtcbiAgICAgIGZvcm1hdD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudGltZUVsKSB7XG4gICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChmb3JtYXQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChzaG93U2Vjb25kcyA/ICdISDptbTpzcycgOiAnSEg6bW0nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmRhdGVFbCAmJiBzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwuc2V0VGV4dChub3cuZm9ybWF0KCdkZGRkLCBEIE1NTU0gWVlZWScpKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IENsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIENsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ2xvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHNlY29uZHMnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93U2Vjb25kcyBhcyBib29sZWFuID8/IGZhbHNlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1NlY29uZHMgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBkYXRlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0RhdGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0RhdGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdDdXN0b20gZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdPcHRpb25hbCBtb21lbnQuanMgZm9ybWF0IHN0cmluZywgZS5nLiBcIkhIOm1tXCIuIExlYXZlIGVtcHR5IGZvciBkZWZhdWx0LicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9ybWF0IGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9ybWF0ID0gdjsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBMaW5rSXRlbSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgZW1vamk/OiBzdHJpbmc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT4gZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQgeyB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTGlua3NCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZm9sZGVyLWxpbmtzLWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNvbnRlbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdRdWljayBMaW5rcycsIGZvbGRlciA9ICcnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG5cbiAgICAvLyBBdXRvLWxpc3Qgbm90ZXMgZnJvbSBzZWxlY3RlZCBmb2xkZXIgKHNvcnRlZCBhbHBoYWJldGljYWxseSlcbiAgICBpZiAoZm9sZGVyKSB7XG4gICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICAgIGlmIChmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgIGNvbnN0IG5vdGVzID0gZm9sZGVyT2JqLmNoaWxkcmVuXG4gICAgICAgICAgLmZpbHRlcigoY2hpbGQpOiBjaGlsZCBpcyBURmlsZSA9PiBjaGlsZCBpbnN0YW5jZW9mIFRGaWxlICYmIGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJylcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ05vIG5vdGVzIGluIHRoaXMgZm9sZGVyLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hbnVhbCBsaW5rc1xuICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICBpZiAobGluay5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2xpbmstZW1vamknLCB0ZXh0OiBsaW5rLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsaW5rLmxhYmVsIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGxpbmsucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIgJiYgbGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnQWRkIGxpbmtzIG9yIHNlbGVjdCBhIGZvbGRlciBpbiBzZXR0aW5ncy4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNhcmQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIGJsb2NrIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncy5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0eXBlb2YgdCA9PT0gJ3N0cmluZycpIDpcbiAgICAgIHR5cGVvZiByYXdGbVRhZ3MgPT09ICdzdHJpbmcnID8gW3Jhd0ZtVGFnc10gOlxuICAgICAgW107XG4gICAgY29uc3Qgbm9ybWFsaXplZEZtVGFncyA9IGZtVGFnQXJyYXkubWFwKHQgPT4gdC5zdGFydHNXaXRoKCcjJykgPyB0IDogYCMke3R9YCk7XG5cbiAgICByZXR1cm4gaW5saW5lVGFncy5pbmNsdWRlcyh0YWcpIHx8IG5vcm1hbGl6ZWRGbVRhZ3MuaW5jbHVkZXModGFnKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgVGFnR3JpZEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCd0YWctZ3JpZC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBUYWdHcmlkQmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgdGFnIGdyaWQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnTm90ZXMnLCBjb2x1bW5zID0gMiwgc2hvd0Vtb2ppID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGFnPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgc2hvd0Vtb2ppPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdyaWQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICd0YWctZ3JpZCcgfSk7XG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2NvbHVtbnN9LCAxZnIpYDtcblxuICAgIGlmICghdGFnKSB7XG4gICAgICBncmlkLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgY29uc3QgZW1vamkgPSBzaG93RW1vamkgPyAoY2FjaGU/LmZyb250bWF0dGVyPy5lbW9qaSBhcyBzdHJpbmcgPz8gJycpIDogJyc7XG5cbiAgICAgIGNvbnN0IGJ0biA9IGdyaWQuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndGFnLWJ0bicgfSk7XG4gICAgICBpZiAoZW1vamkpIHtcbiAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyBjbHM6ICd0YWctYnRuLWVtb2ppJywgdGV4dDogZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFRhZ0dyaWRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgVGFnR3JpZFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1RhZyBHcmlkIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICdOb3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgZW1vamknKS5zZXREZXNjKCdSZWFkIFwiZW1vamlcIiBmcm9udG1hdHRlciBmaWVsZCcpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dFbW9qaSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93RW1vamkgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldEZpbGVzV2l0aFRhZyB9IGZyb20gJy4uL3V0aWxzL3RhZ3MnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBPbmx5IGFzc2lnbiBzYWZlIENTUyBjb2xvciB2YWx1ZXM7IHJlamVjdCBwb3RlbnRpYWxseSBtYWxpY2lvdXMgc3RyaW5nc1xuY29uc3QgQ09MT1JfUkUgPSAvXigjWzAtOWEtZkEtRl17Myw4fXxbYS16QS1aXSt8cmdiYT9cXChbXildK1xcKXxoc2xhP1xcKFteKV0rXFwpKSQvO1xuXG5leHBvcnQgY2xhc3MgUXVvdGVzTGlzdEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdxdW90ZXMtbGlzdC1ibG9jaycpO1xuICAgIHRoaXMubG9hZEFuZFJlbmRlcihlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgcXVvdGVzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ1F1b3RlcycsIGNvbHVtbnMgPSAyLCBtYXhJdGVtcyA9IDIwIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0YWc/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNvbHNFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3F1b3Rlcy1jb2x1bW5zJyB9KTtcbiAgICBjb2xzRWwuc3R5bGUuY29sdW1uQ291bnQgPSBTdHJpbmcoY29sdW1ucyk7XG5cbiAgICBpZiAoIXRhZykge1xuICAgICAgY29sc0VsLnNldFRleHQoJ0NvbmZpZ3VyZSBhIHRhZyBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0YWdTZWFyY2ggPSB0YWcuc3RhcnRzV2l0aCgnIycpID8gdGFnIDogYCMke3RhZ31gO1xuICAgIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNXaXRoVGFnKHRoaXMuYXBwLCB0YWdTZWFyY2gpLnNsaWNlKDAsIG1heEl0ZW1zKTtcblxuICAgIC8vIFJlYWQgYWxsIGZpbGVzIGluIHBhcmFsbGVsIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2VcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgZmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgICByZXR1cm4geyBmaWxlLCBjb250ZW50LCBjYWNoZSB9O1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAncmVqZWN0ZWQnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFF1b3Rlc0xpc3RCbG9jayBmYWlsZWQgdG8gcmVhZCBmaWxlOicsIHJlc3VsdC5yZWFzb24pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBmaWxlLCBjb250ZW50LCBjYWNoZSB9ID0gcmVzdWx0LnZhbHVlO1xuICAgICAgY29uc3QgY29sb3IgPSBjYWNoZT8uZnJvbnRtYXR0ZXI/LmNvbG9yIGFzIHN0cmluZyA/PyAnJztcbiAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLmV4dHJhY3RCb2R5KGNvbnRlbnQsIGNhY2hlKTtcbiAgICAgIGlmICghYm9keSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGl0ZW0gPSBjb2xzRWwuY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtaXRlbScgfSk7XG4gICAgICBjb25zdCBxdW90ZSA9IGl0ZW0uY3JlYXRlRWwoJ2Jsb2NrcXVvdGUnLCB7IGNsczogJ3F1b3RlLWNvbnRlbnQnLCB0ZXh0OiBib2R5IH0pO1xuXG4gICAgICAvLyBWYWxpZGF0ZSBjb2xvciBiZWZvcmUgYXBwbHlpbmcgdG8gcHJldmVudCBDU1MgaW5qZWN0aW9uXG4gICAgICBpZiAoY29sb3IgJiYgQ09MT1JfUkUudGVzdChjb2xvcikpIHtcbiAgICAgICAgcXVvdGUuc3R5bGUuYm9yZGVyTGVmdENvbG9yID0gY29sb3I7XG4gICAgICAgIHF1b3RlLnN0eWxlLmNvbG9yID0gY29sb3I7XG4gICAgICB9XG5cbiAgICAgIGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiAncXVvdGUtc291cmNlJywgdGV4dDogZmlsZS5iYXNlbmFtZSB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogRXh0cmFjdCB0aGUgZmlyc3QgZmV3IGxpbmVzIG9mIGJvZHkgY29udGVudCB1c2luZyBtZXRhZGF0YUNhY2hlIGZyb250bWF0dGVyIG9mZnNldC4gKi9cbiAgcHJpdmF0ZSBleHRyYWN0Qm9keShjb250ZW50OiBzdHJpbmcsIGNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwpOiBzdHJpbmcge1xuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG4gICAgY29uc3QgbGluZXMgPSBhZnRlckZtXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAubWFwKGwgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKGwgPT4gbCAmJiAhbC5zdGFydHNXaXRoKCcjJykpO1xuICAgIHJldHVybiBsaW5lcy5zbGljZSgwLCAzKS5qb2luKCcgJyk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IFF1b3Rlc1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBRdW90ZXNTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdW90ZXMgTGlzdCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnUXVvdGVzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1RhZycpLnNldERlc2MoJ1dpdGhvdXQgIyBwcmVmaXgnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGFnIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRhZyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJylcbiAgICAgICAuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0LmNvbHVtbnMgPz8gMikpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5jb2x1bW5zID0gTnVtYmVyKHYpOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTWF4IGl0ZW1zJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKFN0cmluZyhkcmFmdC5tYXhJdGVtcyA/PyAyMCkpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5tYXhJdGVtcyA9IHBhcnNlSW50KHYpIHx8IDIwOyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uQ2hvb3NlOiAoZm9sZGVyOiBURm9sZGVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoJ1R5cGUgdG8gc2VhcmNoIHZhdWx0IGZvbGRlcnNcdTIwMjYnKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QWxsRm9sZGVycygpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9sZGVycy5wdXNoKGYpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZSh0aGlzLmFwcC52YXVsdC5nZXRSb290KCkpO1xuICAgIHJldHVybiBmb2xkZXJzO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgcSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsRm9sZGVycygpLmZpbHRlcihmID0+XG4gICAgICBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQge1xuICAgIHRoaXMub25DaG9vc2UoZm9sZGVyKTtcbiAgfVxufVxuXG5jb25zdCBJTUFHRV9FWFRTID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy53ZWJwJywgJy5zdmcnXSk7XG5jb25zdCBWSURFT19FWFRTID0gbmV3IFNldChbJy5tcDQnLCAnLndlYm0nLCAnLm1vdicsICcubWt2J10pO1xuXG5leHBvcnQgY2xhc3MgSW1hZ2VHYWxsZXJ5QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2ltYWdlLWdhbGxlcnktYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW1hZ2VHYWxsZXJ5QmxvY2sgZmFpbGVkIHRvIHJlbmRlcjonLCBlKTtcbiAgICAgIGVsLnNldFRleHQoJ0Vycm9yIGxvYWRpbmcgZ2FsbGVyeS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZvbGRlciA9ICcnLCB0aXRsZSA9ICdHYWxsZXJ5JywgY29sdW1ucyA9IDMsIG1heEl0ZW1zID0gMjAgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIG1heEl0ZW1zPzogbnVtYmVyO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuXG4gICAgY29uc3QgZ2FsbGVyeSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2ltYWdlLWdhbGxlcnknIH0pO1xuICAgIGdhbGxlcnkuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoIWZvbGRlcikge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KCdDb25maWd1cmUgYSBmb2xkZXIgcGF0aCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICBpZiAoIShmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuICAgICAgZ2FsbGVyeS5zZXRUZXh0KGBGb2xkZXIgXCIke2ZvbGRlcn1cIiBub3QgZm91bmQuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldE1lZGlhRmlsZXMoZm9sZGVyT2JqKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGV4dCA9IGAuJHtmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICBjb25zdCB3cmFwcGVyID0gZ2FsbGVyeS5jcmVhdGVEaXYoeyBjbHM6ICdnYWxsZXJ5LWl0ZW0nIH0pO1xuXG4gICAgICBpZiAoSU1BR0VfRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICBjb25zdCBpbWcgPSB3cmFwcGVyLmNyZWF0ZUVsKCdpbWcnKTtcbiAgICAgICAgaW1nLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgaW1nLmxvYWRpbmcgPSAnbGF6eSc7XG4gICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICB3cmFwcGVyLmFkZENsYXNzKCdnYWxsZXJ5LWl0ZW0tdmlkZW8nKTtcbiAgICAgICAgd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICd2aWRlby1wbGF5LW92ZXJsYXknLCB0ZXh0OiAnXHUyNUI2JyB9KTtcblxuICAgICAgICBjb25zdCB2aWRlbyA9IHdyYXBwZXIuY3JlYXRlRWwoJ3ZpZGVvJykgYXMgSFRNTFZpZGVvRWxlbWVudDtcbiAgICAgICAgdmlkZW8uc3JjID0gdGhpcy5hcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGZpbGUpO1xuICAgICAgICB2aWRlby5tdXRlZCA9IHRydWU7XG4gICAgICAgIHZpZGVvLmxvb3AgPSB0cnVlO1xuICAgICAgICB2aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgICAgICB2aWRlby5wcmVsb2FkID0gJ21ldGFkYXRhJztcblxuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7IHZvaWQgdmlkZW8ucGxheSgpOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4geyB2aWRlby5wYXVzZSgpOyB2aWRlby5jdXJyZW50VGltZSA9IDA7IH0pO1xuICAgICAgICB3cmFwcGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TWVkaWFGaWxlcyhmb2xkZXI6IFRGb2xkZXIpOiBURmlsZVtdIHtcbiAgICBjb25zdCBmaWxlczogVEZpbGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlY3Vyc2UgPSAoZjogVEZvbGRlcikgPT4ge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBmLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgY29uc3QgZXh0ID0gYC4ke2NoaWxkLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkgfHwgVklERU9fRVhUUy5oYXMoZXh0KSkge1xuICAgICAgICAgICAgZmlsZXMucHVzaChjaGlsZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgIHJlY3Vyc2UoY2hpbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKGZvbGRlcik7XG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBJbWFnZUdhbGxlcnlTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSW1hZ2UgR2FsbGVyeSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnR2FsbGVyeScpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbGV0IGZvbGRlclRleHQ6IGltcG9ydCgnb2JzaWRpYW4nKS5UZXh0Q29tcG9uZW50O1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdGb2xkZXInKVxuICAgICAgLnNldERlc2MoJ1BpY2sgYSB2YXVsdCBmb2xkZXIuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdBdHRhY2htZW50cy9QaG90b3MnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKS5hZGRPcHRpb24oJzQnLCAnNCcpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDMpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBURmlsZSwgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgREVCT1VOQ0VfTVMgPSAzMDA7XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZE5vdGVCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGVib3VuY2VUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZW1iZWRkZWQtbm90ZS1ibG9jaycpO1xuXG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgZmlsZS4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZ2lzdGVyIHZhdWx0IGxpc3RlbmVyIG9uY2U7IGRlYm91bmNlIHJhcGlkIHNhdmVzXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAudmF1bHQub24oJ21vZGlmeScsIChtb2RGaWxlKSA9PiB7XG4gICAgICAgIGNvbnN0IHsgZmlsZVBhdGggPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBmaWxlUGF0aD86IHN0cmluZyB9O1xuICAgICAgICBpZiAobW9kRmlsZS5wYXRoID09PSBmaWxlUGF0aCAmJiB0aGlzLmNvbnRhaW5lckVsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQodGFyZ2V0KS5jYXRjaChlID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgZmFpbGVkIHRvIHJlLXJlbmRlciBhZnRlciBtb2RpZnk6JywgZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LCBERUJPVU5DRV9NUyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5kZWJvdW5jZVRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZGVib3VuY2VUaW1lcik7XG4gICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IGZpbGVQYXRoID0gJycsIHNob3dUaXRsZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIGZpbGVQYXRoPzogc3RyaW5nO1xuICAgICAgc2hvd1RpdGxlPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICghZmlsZVBhdGgpIHtcbiAgICAgIGVsLnNldFRleHQoJ0NvbmZpZ3VyZSBhIGZpbGUgcGF0aCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICBlbC5zZXRUZXh0KGBGaWxlIG5vdCBmb3VuZDogJHtmaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2hvd1RpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgZmlsZS5iYXNlbmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZW1iZWRkZWQtbm90ZS1jb250ZW50JyB9KTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsIGZpbGUucGF0aCwgdGhpcyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gRW1iZWRkZWROb3RlQmxvY2sgTWFya2Rvd25SZW5kZXJlciBmYWlsZWQ6JywgZSk7XG4gICAgICBjb250ZW50RWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuJyk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBFbWJlZGRlZE5vdGVTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnRW1iZWRkZWQgTm90ZSBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0ZpbGUgcGF0aCcpLnNldERlc2MoJ1ZhdWx0IHBhdGggdG8gdGhlIG5vdGUgKGUuZy4gTm90ZXMvTXlOb3RlLm1kKScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5maWxlUGF0aCBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5maWxlUGF0aCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHRpdGxlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd1RpdGxlIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNYXJrZG93blJlbmRlcmVyLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIFN0YXRpY1RleHRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnc3RhdGljLXRleHQtYmxvY2snKTtcbiAgICB0aGlzLnJlbmRlckNvbnRlbnQoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gU3RhdGljVGV4dEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciByZW5kZXJpbmcgY29udGVudC4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGVudChlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGNvbnRlbnQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb250ZW50Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ3N0YXRpYy10ZXh0LWNvbnRlbnQnIH0pO1xuXG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICBjb250ZW50RWwuc2V0VGV4dCgnQ29uZmlndXJlIHRleHQgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNvbnRlbnQsIGNvbnRlbnRFbCwgJycsIHRoaXMpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFN0YXRpY1RleHRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdTdGF0aWMgVGV4dCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSB0ZXh0LicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbnRlbnQnKS5zZXREZXNjKCdTdXBwb3J0cyBNYXJrZG93bi4nKTtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndGV4dGFyZWEnLCB7IGNsczogJ3N0YXRpYy10ZXh0LXNldHRpbmdzLXRleHRhcmVhJyB9KTtcbiAgICB0ZXh0YXJlYS52YWx1ZSA9IGRyYWZ0LmNvbnRlbnQgYXMgc3RyaW5nID8/ICcnO1xuICAgIHRleHRhcmVhLnJvd3MgPSAxMDtcbiAgICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgZHJhZnQuY29udGVudCA9IHRleHRhcmVhLnZhbHVlOyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIHNhbml0aXplSFRNTFRvRG9tIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgSHRtbEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdodG1sLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGh0bWwgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBodG1sPzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaHRtbC1ibG9jay1jb250ZW50JyB9KTtcblxuICAgIGlmICghaHRtbCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSBIVE1MIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnRlbnRFbC5hcHBlbmRDaGlsZChzYW5pdGl6ZUhUTUxUb0RvbShodG1sKSk7XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEh0bWxCbG9ja1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIVE1MIEJsb2NrIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5zZXREZXNjKCdPcHRpb25hbCBoZWFkZXIgc2hvd24gYWJvdmUgdGhlIEhUTUwuJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnSFRNTCcpLnNldERlc2MoJ0hUTUwgaXMgc2FuaXRpemVkIGJlZm9yZSByZW5kZXJpbmcuJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5odG1sIGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTI7XG4gICAgdGV4dGFyZWEuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0Lmh0bWwgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG9CQUF1RDs7O0FDQXZELElBQUFDLG1CQUF3Qzs7O0FDQXhDLHNCQUE2Qzs7O0FDRTdDLElBQU0scUJBQU4sTUFBeUI7QUFBQSxFQUF6QjtBQUNFLFNBQVEsWUFBWSxvQkFBSSxJQUE2QjtBQUFBO0FBQUEsRUFFckQsU0FBUyxTQUE2QjtBQUNwQyxTQUFLLFVBQVUsSUFBSSxRQUFRLE1BQU0sT0FBTztBQUFBLEVBQzFDO0FBQUEsRUFFQSxJQUFJLE1BQTJDO0FBQzdDLFdBQU8sS0FBSyxVQUFVLElBQUksSUFBSTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxTQUF5QjtBQUN2QixXQUFPLE1BQU0sS0FBSyxLQUFLLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDM0M7QUFBQSxFQUVBLFFBQWM7QUFDWixTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZCO0FBQ0Y7QUFFTyxJQUFNLGdCQUFnQixJQUFJLG1CQUFtQjs7O0FEZjdDLElBQU0sYUFBTixNQUFpQjtBQUFBLEVBU3RCLFlBQ0UsYUFDUSxLQUNBLFFBQ0EsZ0JBQ1I7QUFIUTtBQUNBO0FBQ0E7QUFYVixTQUFRLFNB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QU8sQ0FBQyxFQUMzQyxTQUFTLE9BQU8sVUFBVTtBQUN6QixhQUFLLE9BQU8sT0FBTyxVQUFVLE9BQU8sS0FBSztBQUN6QyxjQUFNLEtBQUssT0FBTyxXQUFXLEtBQUssT0FBTyxNQUFNO0FBQUEsTUFDakQsQ0FBQztBQUFBLElBQ0w7QUFFRixRQUFJLDBCQUFRLFdBQVcsRUFDcEIsUUFBUSx5QkFBeUIsRUFDakMsUUFBUSxzRUFBc0UsRUFDOUU7QUFBQSxNQUFVLFNBQ1QsSUFBSSxjQUFjLGNBQWMsRUFBRSxXQUFXLEVBQUUsUUFBUSxZQUFZO0FBQ2pFLGNBQU0sS0FBSyxPQUFPLFdBQVcsaUJBQWlCLENBQUM7QUFDL0MsbUJBQVcsUUFBUSxLQUFLLElBQUksVUFBVSxnQkFBZ0IsU0FBUyxHQUFHO0FBQ2hFLGNBQUksS0FBSyxnQkFBZ0IsY0FBYztBQUNyQyxrQkFBTSxLQUFLLEtBQUssT0FBTztBQUFBLFVBQ3pCO0FBQUEsUUFDRjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNKO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiRm9sZGVyU3VnZ2VzdE1vZGFsIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIl0KfQo=
