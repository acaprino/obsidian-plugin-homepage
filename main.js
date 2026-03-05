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
    const fmTagArray = Array.isArray(rawFmTags) ? rawFmTags : typeof rawFmTags === "string" ? [rawFmTags] : [];
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGxpbmtzOiBbXSB9LFxuICAgIH0sXG4gICAgLy8gUm93IDJcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtaW5zaWdodCcsXG4gICAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgICBjb2w6IDEsIHJvdzogMiwgY29sU3BhbjogMiwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ0RhaWx5IEluc2lnaHQnLCBkYWlseVNlZWQ6IHRydWUgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC10YWctZ3JpZCcsXG4gICAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgICAgY29sOiAzLCByb3c6IDIsIGNvbFNwYW46IDEsIHJvd1NwYW46IDIsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdWYWx1ZXMnLCBjb2x1bW5zOiAyLCBzaG93RW1vamk6IHRydWUgfSxcbiAgICB9LFxuICAgIC8vIFJvdyAzXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LXF1b3RlcycsXG4gICAgICB0eXBlOiAncXVvdGVzLWxpc3QnLFxuICAgICAgY29sOiAxLCByb3c6IDMsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdRdW90ZXMnLCBjb2x1bW5zOiAyLCBtYXhJdGVtczogMjAgfSxcbiAgICB9LFxuICAgIC8vIFJvdyA0XG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWdhbGxlcnknLFxuICAgICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgICAgY29sOiAxLCByb3c6IDQsIGNvbFNwYW46IDMsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgZm9sZGVyOiAnJywgdGl0bGU6ICdHYWxsZXJ5JywgY29sdW1uczogMywgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBSZXR1cm5zIGEgZGVlcCBjbG9uZSBvZiB0aGUgZGVmYXVsdCBsYXlvdXQsIHNhZmUgdG8gbXV0YXRlLiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdExheW91dCgpOiBMYXlvdXRDb25maWcge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lKERFRkFVTFRfTEFZT1VUX0RBVEEpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgTGF5b3V0IHZhbGlkYXRpb24gLyBtaWdyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFZBTElEX0JMT0NLX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgJ2dyZWV0aW5nJywgJ2ZvbGRlci1saW5rcycsICdpbnNpZ2h0JywgJ3RhZy1ncmlkJyxcbiAgJ3F1b3Rlcy1saXN0JywgJ2ltYWdlLWdhbGxlcnknLCAnY2xvY2snLCAnZW1iZWRkZWQtbm90ZScsXG4gICdzdGF0aWMtdGV4dCcsICdodG1sJyxcbl0pO1xuXG5mdW5jdGlvbiBpc1ZhbGlkQmxvY2tJbnN0YW5jZShiOiB1bmtub3duKTogYiBpcyBCbG9ja0luc3RhbmNlIHtcbiAgaWYgKCFiIHx8IHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBibG9jayA9IGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGJsb2NrLmlkID09PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBibG9jay50eXBlID09PSAnc3RyaW5nJyAmJiBWQUxJRF9CTE9DS19UWVBFUy5oYXMoYmxvY2sudHlwZSkgJiZcbiAgICB0eXBlb2YgYmxvY2suY29sID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2wgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3cgPT09ICdudW1iZXInICYmIGJsb2NrLnJvdyA+PSAxICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbFNwYW4gPT09ICdudW1iZXInICYmIGJsb2NrLmNvbFNwYW4gPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5yb3dTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3dTcGFuID49IDEgJiZcbiAgICBibG9jay5jb25maWcgIT09IG51bGwgJiYgdHlwZW9mIGJsb2NrLmNvbmZpZyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoYmxvY2suY29uZmlnKVxuICApO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBkYXRhIGxvYWRlZCBmcm9tIGRpc2suXG4gKiBJbnZhbGlkIGZpZWxkcyBhcmUgcmVwbGFjZWQgd2l0aCBkZWZhdWx0cy5cbiAqIEludmFsaWQgYmxvY2sgZW50cmllcyBhcmUgZHJvcHBlZC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQocmF3OiB1bmtub3duKTogTGF5b3V0Q29uZmlnIHtcbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0TGF5b3V0KCk7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZmF1bHRzO1xuXG4gIGNvbnN0IHIgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGNvbnN0IGNvbHVtbnMgPSB0eXBlb2Ygci5jb2x1bW5zID09PSAnbnVtYmVyJyAmJiBbMiwgMywgNF0uaW5jbHVkZXMoci5jb2x1bW5zKVxuICAgID8gci5jb2x1bW5zXG4gICAgOiBkZWZhdWx0cy5jb2x1bW5zO1xuICBjb25zdCBvcGVuT25TdGFydHVwID0gdHlwZW9mIHIub3Blbk9uU3RhcnR1cCA9PT0gJ2Jvb2xlYW4nXG4gICAgPyByLm9wZW5PblN0YXJ0dXBcbiAgICA6IGRlZmF1bHRzLm9wZW5PblN0YXJ0dXA7XG4gIGNvbnN0IGJsb2NrcyA9IEFycmF5LmlzQXJyYXkoci5ibG9ja3MpXG4gICAgPyByLmJsb2Nrcy5maWx0ZXIoaXNWYWxpZEJsb2NrSW5zdGFuY2UpXG4gICAgOiBkZWZhdWx0cy5ibG9ja3M7XG5cbiAgcmV0dXJuIHsgY29sdW1ucywgb3Blbk9uU3RhcnR1cCwgYmxvY2tzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBCbG9jayByZWdpc3RyYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQmxvY2tzKCk6IHZvaWQge1xuICBCbG9ja1JlZ2lzdHJ5LmNsZWFyKCk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2dyZWV0aW5nJyxcbiAgICBkaXNwbGF5TmFtZTogJ0dyZWV0aW5nJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IG5hbWU6ICdXb3JsZCcsIHNob3dUaW1lOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEdyZWV0aW5nQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2Nsb2NrJyxcbiAgICBkaXNwbGF5TmFtZTogJ0Nsb2NrIC8gRGF0ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IENsb2NrQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ZvbGRlci1saW5rcycsXG4gICAgZGlzcGxheU5hbWU6ICdGb2xkZXIgTGlua3MnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICdRdWljayBMaW5rcycsIGZvbGRlcjogJycsIGxpbmtzOiBbXSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBGb2xkZXJMaW5rc0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdpbnNpZ2h0JyxcbiAgICBkaXNwbGF5TmFtZTogJ0RhaWx5IEluc2lnaHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEluc2lnaHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAndGFnLWdyaWQnLFxuICAgIGRpc3BsYXlOYW1lOiAnVGFnIEdyaWQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdOb3RlcycsIGNvbHVtbnM6IDIsIHNob3dFbW9qaTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDIgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBUYWdHcmlkQmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3F1b3Rlcy1saXN0JyxcbiAgICBkaXNwbGF5TmFtZTogJ1F1b3RlcyBMaXN0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnUXVvdGVzJywgY29sdW1uczogMiwgbWF4SXRlbXM6IDIwIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMiwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFF1b3Rlc0xpc3RCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaW1hZ2UtZ2FsbGVyeScsXG4gICAgZGlzcGxheU5hbWU6ICdJbWFnZSBHYWxsZXJ5JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZvbGRlcjogJycsIHRpdGxlOiAnR2FsbGVyeScsIGNvbHVtbnM6IDMsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDMsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBJbWFnZUdhbGxlcnlCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnZW1iZWRkZWQtbm90ZScsXG4gICAgZGlzcGxheU5hbWU6ICdFbWJlZGRlZCBOb3RlJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IGZpbGVQYXRoOiAnJywgc2hvd1RpdGxlOiB0cnVlIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEVtYmVkZGVkTm90ZUJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdzdGF0aWMtdGV4dCcsXG4gICAgZGlzcGxheU5hbWU6ICdTdGF0aWMgVGV4dCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGNvbnRlbnQ6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IFN0YXRpY1RleHRCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaHRtbCcsXG4gICAgZGlzcGxheU5hbWU6ICdIVE1MIEJsb2NrJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnJywgaHRtbDogJycgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSHRtbEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgUGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBIb21lcGFnZVBsdWdpbiBleHRlbmRzIFBsdWdpbiBpbXBsZW1lbnRzIElIb21lcGFnZVBsdWdpbiB7XG4gIGxheW91dDogTGF5b3V0Q29uZmlnID0gZ2V0RGVmYXVsdExheW91dCgpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZWdpc3RlckJsb2NrcygpO1xuXG4gICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIHVua25vd247XG4gICAgdGhpcy5sYXlvdXQgPSB2YWxpZGF0ZUxheW91dChyYXcpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCAobGVhZikgPT4gbmV3IEhvbWVwYWdlVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLWhvbWVwYWdlJyxcbiAgICAgIG5hbWU6ICdPcGVuIEhvbWVwYWdlJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTsgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbignaG9tZScsICdPcGVuIEhvbWVwYWdlJywgKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBIb21lcGFnZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmxheW91dC5vcGVuT25TdGFydHVwKSB7XG4gICAgICAgIHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVMYXlvdXQobGF5b3V0OiBMYXlvdXRDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxheW91dCA9IGxheW91dDtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKGxheW91dCk7XG4gIH1cblxuICBhc3luYyBvcGVuSG9tZXBhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgdGFiIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hvbWVwYWdlIEJsb2NrcycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdPcGVuIG9uIHN0YXJ0dXAnKVxuICAgICAgLnNldERlc2MoJ0F1dG9tYXRpY2FsbHkgb3BlbiB0aGUgaG9tZXBhZ2Ugd2hlbiBPYnNpZGlhbiBzdGFydHMuJylcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQub3Blbk9uU3RhcnR1cCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgY29sdW1ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQgbGF5b3V0LicpXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcCA9PlxuICAgICAgICBkcm9wXG4gICAgICAgICAgLmFkZE9wdGlvbignMicsICcyIGNvbHVtbnMnKVxuICAgICAgICAgIC5hZGRPcHRpb24oJzMnLCAnMyBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCc0JywgJzQgY29sdW1ucycpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Jlc2V0IHRvIGRlZmF1bHQgbGF5b3V0JylcbiAgICAgIC5zZXREZXNjKCdSZXN0b3JlIGFsbCBibG9ja3MgdG8gdGhlIG9yaWdpbmFsIGRlZmF1bHQgbGF5b3V0LiBDYW5ub3QgYmUgdW5kb25lLicpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVzZXQgbGF5b3V0Jykuc2V0V2FybmluZygpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQoZ2V0RGVmYXVsdExheW91dCgpKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpKSB7XG4gICAgICAgICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgSG9tZXBhZ2VWaWV3KSB7XG4gICAgICAgICAgICAgIGF3YWl0IGxlYWYudmlldy5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgSUhvbWVwYWdlUGx1Z2luLCBMYXlvdXRDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuaW1wb3J0IHsgRWRpdFRvb2xiYXIgfSBmcm9tICcuL0VkaXRUb29sYmFyJztcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRSA9ICdob21lcGFnZS1ibG9ja3MnO1xuXG5leHBvcnQgY2xhc3MgSG9tZXBhZ2VWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0b29sYmFyOiBFZGl0VG9vbGJhciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuICdIb21lcGFnZSc7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gJ2hvbWUnOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEZ1bGwgdGVhcmRvd246IHVubG9hZHMgYmxvY2tzIEFORCByZW1vdmVzIHRoZSBncmlkIERPTSBlbGVtZW50XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoJ2hvbWVwYWdlLXZpZXcnKTtcblxuICAgIGNvbnN0IGxheW91dDogTGF5b3V0Q29uZmlnID0gdGhpcy5wbHVnaW4ubGF5b3V0O1xuXG4gICAgY29uc3Qgb25MYXlvdXRDaGFuZ2UgPSAobmV3TGF5b3V0OiBMYXlvdXRDb25maWcpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLmxheW91dCA9IG5ld0xheW91dDtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dChuZXdMYXlvdXQpO1xuICAgIH07XG5cbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZExheW91dChjb250ZW50RWwsIHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgb25MYXlvdXRDaGFuZ2UpO1xuXG4gICAgdGhpcy50b29sYmFyID0gbmV3IEVkaXRUb29sYmFyKFxuICAgICAgY29udGVudEVsLFxuICAgICAgdGhpcy5hcHAsXG4gICAgICB0aGlzLnBsdWdpbixcbiAgICAgIHRoaXMuZ3JpZCxcbiAgICAgIChjb2x1bW5zKSA9PiB7IHRoaXMuZ3JpZD8uc2V0Q29sdW1ucyhjb2x1bW5zKTsgfSxcbiAgICApO1xuXG4gICAgLy8gVG9vbGJhciBtdXN0IGFwcGVhciBhYm92ZSB0aGUgZ3JpZCBpbiB0aGUgZmxleC1jb2x1bW4gbGF5b3V0XG4gICAgY29udGVudEVsLmluc2VydEJlZm9yZSh0aGlzLnRvb2xiYXIuZ2V0RWxlbWVudCgpLCB0aGlzLmdyaWQuZ2V0RWxlbWVudCgpKTtcblxuICAgIHRoaXMuZ3JpZC5yZW5kZXIobGF5b3V0LmJsb2NrcywgbGF5b3V0LmNvbHVtbnMpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmdyaWQ/LmRlc3Ryb3koKTtcbiAgICB0aGlzLnRvb2xiYXI/LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKiBSZS1yZW5kZXIgdGhlIHZpZXcgZnJvbSBzY3JhdGNoIChlLmcuIGFmdGVyIHNldHRpbmdzIHJlc2V0KS4gKi9cbiAgYXN5bmMgcmVsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMub25PcGVuKCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzZXRJY29uIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgTGF5b3V0Q29uZmlnLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IEJsb2NrUmVnaXN0cnkgfSBmcm9tICcuL0Jsb2NrUmVnaXN0cnknO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQmFzZUJsb2NrJztcblxudHlwZSBMYXlvdXRDaGFuZ2VDYWxsYmFjayA9IChsYXlvdXQ6IExheW91dENvbmZpZykgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcml2YXRlIGdyaWRFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgYmxvY2tzID0gbmV3IE1hcDxzdHJpbmcsIHsgYmxvY2s6IEJhc2VCbG9jazsgd3JhcHBlcjogSFRNTEVsZW1lbnQgfT4oKTtcbiAgcHJpdmF0ZSBlZGl0TW9kZSA9IGZhbHNlO1xuICAvKiogQWJvcnRDb250cm9sbGVyIGZvciB0aGUgY3VycmVudGx5IGFjdGl2ZSBkcmFnIG9yIHJlc2l6ZSBvcGVyYXRpb24uICovXG4gIHByaXZhdGUgYWN0aXZlQWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbiAgLyoqIERyYWcgY2xvbmUgYXBwZW5kZWQgdG8gZG9jdW1lbnQuYm9keTsgdHJhY2tlZCBzbyB3ZSBjYW4gcmVtb3ZlIGl0IG9uIGVhcmx5IHRlYXJkb3duLiAqL1xuICBwcml2YXRlIGFjdGl2ZUNsb25lOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcbiAgICBwcml2YXRlIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICAgcHJpdmF0ZSBvbkxheW91dENoYW5nZTogTGF5b3V0Q2hhbmdlQ2FsbGJhY2ssXG4gICkge1xuICAgIHRoaXMuZ3JpZEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZ3JpZCcgfSk7XG4gIH1cblxuICAvKiogRXhwb3NlIHRoZSByb290IGdyaWQgZWxlbWVudCBzbyBIb21lcGFnZVZpZXcgY2FuIHJlb3JkZXIgaXQgaW4gdGhlIERPTS4gKi9cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZ3JpZEVsO1xuICB9XG5cbiAgcmVuZGVyKGJsb2NrczogQmxvY2tJbnN0YW5jZVtdLCBjb2x1bW5zOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xuICAgIHRoaXMuZ3JpZEVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdncmlkJyk7XG4gICAgdGhpcy5ncmlkRWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hvbWVwYWdlIGJsb2NrcycpO1xuICAgIHRoaXMuZ3JpZEVsLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIG1pbm1heCgwLCAxZnIpKWA7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmdyaWRFbC5yZW1vdmVDbGFzcygnZWRpdC1tb2RlJyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IGVtcHR5ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtZW1wdHktc3RhdGUnIH0pO1xuICAgICAgZW1wdHkuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6ICdObyBibG9ja3MgeWV0LiBDbGljayBFZGl0IHRvIGFkZCB5b3VyIGZpcnN0IGJsb2NrLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBibG9ja3MpIHtcbiAgICAgIHRoaXMucmVuZGVyQmxvY2soaW5zdGFuY2UpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQoaW5zdGFuY2UudHlwZSk7XG4gICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtYmxvY2std3JhcHBlcicgfSk7XG4gICAgd3JhcHBlci5kYXRhc2V0LmJsb2NrSWQgPSBpbnN0YW5jZS5pZDtcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdncmlkY2VsbCcpO1xuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgZmFjdG9yeS5kaXNwbGF5TmFtZSk7XG4gICAgdGhpcy5hcHBseUdyaWRQb3NpdGlvbih3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5hdHRhY2hFZGl0SGFuZGxlcyh3cmFwcGVyLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1jb250ZW50JyB9KTtcbiAgICBjb25zdCBibG9jayA9IGZhY3RvcnkuY3JlYXRlKHRoaXMuYXBwLCBpbnN0YW5jZSwgdGhpcy5wbHVnaW4pO1xuICAgIGJsb2NrLmxvYWQoKTtcbiAgICBjb25zdCByZXN1bHQgPSBibG9jay5yZW5kZXIoY29udGVudEVsKTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmVzdWx0LmNhdGNoKGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbSG9tZXBhZ2UgQmxvY2tzXSBFcnJvciByZW5kZXJpbmcgYmxvY2sgJHtpbnN0YW5jZS50eXBlfTpgLCBlKTtcbiAgICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBibG9jay4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuYmxvY2tzLnNldChpbnN0YW5jZS5pZCwgeyBibG9jaywgd3JhcHBlciB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlHcmlkUG9zaXRpb24od3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgd3JhcHBlci5zdHlsZS5ncmlkQ29sdW1uID0gYCR7aW5zdGFuY2UuY29sfSAvIHNwYW4gJHtpbnN0YW5jZS5jb2xTcGFufWA7XG4gICAgd3JhcHBlci5zdHlsZS5ncmlkUm93ID0gYCR7aW5zdGFuY2Uucm93fSAvIHNwYW4gJHtpbnN0YW5jZS5yb3dTcGFufWA7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGNvbnN0IGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGFuZGxlLWJhcicgfSk7XG5cbiAgICBjb25zdCBoYW5kbGUgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stbW92ZS1oYW5kbGUnIH0pO1xuICAgIHNldEljb24oaGFuZGxlLCAnZ3JpcC12ZXJ0aWNhbCcpO1xuICAgIGhhbmRsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRHJhZyB0byByZW9yZGVyJyk7XG4gICAgaGFuZGxlLnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnRHJhZyB0byByZW9yZGVyJyk7XG5cbiAgICBjb25zdCBzZXR0aW5nc0J0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1zZXR0aW5ncy1idG4nIH0pO1xuICAgIHNldEljb24oc2V0dGluZ3NCdG4sICdzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdCbG9jayBzZXR0aW5ncycpO1xuICAgIHNldHRpbmdzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYmxvY2tzLmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWVudHJ5KSByZXR1cm47XG4gICAgICBlbnRyeS5ibG9jay5vcGVuU2V0dGluZ3MoKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdCbG9ja3MgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLm1hcChiID0+XG4gICAgICAgICAgYi5pZCA9PT0gaW5zdGFuY2UuaWQgPyBpbnN0YW5jZSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICdibG9jay1yZW1vdmUtYnRuJyB9KTtcbiAgICBzZXRJY29uKHJlbW92ZUJ0biwgJ3gnKTtcbiAgICByZW1vdmVCdG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1JlbW92ZSBibG9jaycpO1xuICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgbmV3IFJlbW92ZUJsb2NrQ29uZmlybU1vZGFsKHRoaXMuYXBwLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICAgICAgdGhpcy5yZXJlbmRlcigpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnIH0pO1xuICAgIHNldEljb24oZ3JpcCwgJ21heGltaXplLTInKTtcbiAgICBncmlwLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIGdyaXAuc2V0QXR0cmlidXRlKCd0aXRsZScsICdEcmFnIHRvIHJlc2l6ZScpO1xuICAgIHRoaXMuYXR0YWNoUmVzaXplSGFuZGxlcihncmlwLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG5cbiAgICB0aGlzLmF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZSwgd3JhcHBlciwgaW5zdGFuY2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBhdHRhY2hEcmFnSGFuZGxlcihoYW5kbGU6IEhUTUxFbGVtZW50LCB3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IGNsb25lID0gd3JhcHBlci5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBjbG9uZS5hZGRDbGFzcygnYmxvY2stZHJhZy1jbG9uZScpO1xuICAgICAgY2xvbmUuc3R5bGUud2lkdGggPSBgJHt3cmFwcGVyLm9mZnNldFdpZHRofXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmhlaWdodCA9IGAke3dyYXBwZXIub2Zmc2V0SGVpZ2h0fXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHtlLmNsaWVudFggLSAyMH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHtlLmNsaWVudFkgLSAyMH1weGA7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBjbG9uZTtcblxuICAgICAgY29uc3Qgc291cmNlSWQgPSBpbnN0YW5jZS5pZDtcbiAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHttZS5jbGllbnRYIC0gMjB9cHhgO1xuICAgICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHttZS5jbGllbnRZIC0gMjB9cHhgO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldCh0YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgY2xvbmUucmVtb3ZlKCk7XG4gICAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuICAgICAgICB3cmFwcGVyLnJlbW92ZUNsYXNzKCdibG9jay1kcmFnZ2luZycpO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0aGlzLmZpbmRCbG9ja1VuZGVyQ3Vyc29yKG1lLmNsaWVudFgsIG1lLmNsaWVudFksIHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKHRhcmdldElkKSB7XG4gICAgICAgICAgdGhpcy5zd2FwQmxvY2tzKHNvdXJjZUlkLCB0YXJnZXRJZCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlLCB7IHNpZ25hbDogYWMuc2lnbmFsIH0pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoUmVzaXplSGFuZGxlcihncmlwOiBIVE1MRWxlbWVudCwgd3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgZ3JpcC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IHN0YXJ0WCA9IGUuY2xpZW50WDtcbiAgICAgIGNvbnN0IHN0YXJ0Q29sU3BhbiA9IGluc3RhbmNlLmNvbFNwYW47XG4gICAgICBjb25zdCBjb2x1bW5zID0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnM7XG4gICAgICBjb25zdCBjb2xXaWR0aCA9IHRoaXMuZ3JpZEVsLm9mZnNldFdpZHRoIC8gY29sdW1ucztcbiAgICAgIGxldCBjdXJyZW50Q29sU3BhbiA9IHN0YXJ0Q29sU3BhbjtcblxuICAgICAgY29uc3Qgb25Nb3VzZU1vdmUgPSAobWU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFYID0gbWUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgY29uc3QgZGVsdGFDb2xzID0gTWF0aC5yb3VuZChkZWx0YVggLyBjb2xXaWR0aCk7XG4gICAgICAgIGNvbnN0IG1heCA9IGNvbHVtbnMgLSBpbnN0YW5jZS5jb2wgKyAxO1xuICAgICAgICBjdXJyZW50Q29sU3BhbiA9IE1hdGgubWF4KDEsIE1hdGgubWluKG1heCwgc3RhcnRDb2xTcGFuICsgZGVsdGFDb2xzKSk7XG4gICAgICAgIHdyYXBwZXIuc3R5bGUuZ3JpZENvbHVtbiA9IGAke2luc3RhbmNlLmNvbH0gLyBzcGFuICR7Y3VycmVudENvbFNwYW59YDtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9ICgpID0+IHtcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4gfSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRCbG9ja1VuZGVyQ3Vyc29yKHg6IG51bWJlciwgeTogbnVtYmVyLCBleGNsdWRlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgW2lkLCB7IHdyYXBwZXIgfV0gb2YgdGhpcy5ibG9ja3MpIHtcbiAgICAgIGlmIChpZCA9PT0gZXhjbHVkZUlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY3QgPSB3cmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHggPj0gcmVjdC5sZWZ0ICYmIHggPD0gcmVjdC5yaWdodCAmJiB5ID49IHJlY3QudG9wICYmIHkgPD0gcmVjdC5ib3R0b20pIHtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBTd2FwIHBvc2l0aW9ucyBvZiB0d28gYmxvY2tzIHVzaW5nIGltbXV0YWJsZSB1cGRhdGVzLiAqL1xuICBwcml2YXRlIHN3YXBCbG9ja3MoaWRBOiBzdHJpbmcsIGlkQjogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYkEgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBpZEEpO1xuICAgIGNvbnN0IGJCID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRCKTtcbiAgICBpZiAoIWJBIHx8ICFiQikgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBpZiAoYi5pZCA9PT0gaWRBKSByZXR1cm4geyAuLi5iLCBjb2w6IGJCLmNvbCwgcm93OiBiQi5yb3csIGNvbFNwYW46IGJCLmNvbFNwYW4sIHJvd1NwYW46IGJCLnJvd1NwYW4gfTtcbiAgICAgIGlmIChiLmlkID09PSBpZEIpIHJldHVybiB7IC4uLmIsIGNvbDogYkEuY29sLCByb3c6IGJBLnJvdywgY29sU3BhbjogYkEuY29sU3Bhbiwgcm93U3BhbjogYkEucm93U3BhbiB9O1xuICAgICAgcmV0dXJuIGI7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgLyoqIFVwZGF0ZSBjb2x1bW4gY291bnQsIGNsYW1waW5nIGVhY2ggYmxvY2sncyBjb2wgYW5kIGNvbFNwYW4gdG8gZml0LiAqL1xuICBzZXRDb2x1bW5zKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT4ge1xuICAgICAgY29uc3QgY29sID0gTWF0aC5taW4oYi5jb2wsIG4pO1xuICAgICAgY29uc3QgY29sU3BhbiA9IE1hdGgubWluKGIuY29sU3BhbiwgbiAtIGNvbCArIDEpO1xuICAgICAgcmV0dXJuIHsgLi4uYiwgY29sLCBjb2xTcGFuIH07XG4gICAgfSk7XG4gICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgY29sdW1uczogbiwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgYWRkQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBuZXdCbG9ja3MgPSBbLi4udGhpcy5wbHVnaW4ubGF5b3V0LmJsb2NrcywgaW5zdGFuY2VdO1xuICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVyZW5kZXIoKTogdm9pZCB7XG4gICAgY29uc3QgZm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgZm9jdXNlZEJsb2NrSWQgPSAoZm9jdXNlZD8uY2xvc2VzdCgnW2RhdGEtYmxvY2staWRdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uZGF0YXNldC5ibG9ja0lkO1xuICAgIHRoaXMucmVuZGVyKHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgICBpZiAoZm9jdXNlZEJsb2NrSWQpIHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5ncmlkRWwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oYFtkYXRhLWJsb2NrLWlkPVwiJHtmb2N1c2VkQmxvY2tJZH1cIl1gKTtcbiAgICAgIGVsPy5mb2N1cygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBVbmxvYWQgYWxsIGJsb2NrcyBhbmQgY2FuY2VsIGFueSBpbi1wcm9ncmVzcyBkcmFnL3Jlc2l6ZS4gKi9cbiAgZGVzdHJveUFsbCgpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgdGhpcy5hY3RpdmVDbG9uZT8ucmVtb3ZlKCk7XG4gICAgdGhpcy5hY3RpdmVDbG9uZSA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHsgYmxvY2sgfSBvZiB0aGlzLmJsb2Nrcy52YWx1ZXMoKSkge1xuICAgICAgYmxvY2sudW5sb2FkKCk7XG4gICAgfVxuICAgIHRoaXMuYmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICAvKiogRnVsbCB0ZWFyZG93bjogdW5sb2FkIGJsb2NrcyBhbmQgcmVtb3ZlIHRoZSBncmlkIGVsZW1lbnQgZnJvbSB0aGUgRE9NLiAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveUFsbCgpO1xuICAgIHRoaXMuZ3JpZEVsLnJlbW92ZSgpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBSZW1vdmUgY29uZmlybWF0aW9uIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBSZW1vdmVCbG9ja0NvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgb25Db25maXJtOiAoKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUmVtb3ZlIGJsb2NrPycgfSk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnVGhpcyBibG9jayB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgaG9tZXBhZ2UuJyB9KTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnUmVtb3ZlJykuc2V0V2FybmluZygpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRoaXMub25Db25maXJtKCk7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDYW5jZWwnKS5vbkNsaWNrKCgpID0+IHRoaXMuY2xvc2UoKSksXG4gICAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEJsb2NrRmFjdG9yeSwgQmxvY2tUeXBlIH0gZnJvbSAnLi90eXBlcyc7XG5cbmNsYXNzIEJsb2NrUmVnaXN0cnlDbGFzcyB7XG4gIHByaXZhdGUgZmFjdG9yaWVzID0gbmV3IE1hcDxCbG9ja1R5cGUsIEJsb2NrRmFjdG9yeT4oKTtcblxuICByZWdpc3RlcihmYWN0b3J5OiBCbG9ja0ZhY3RvcnkpOiB2b2lkIHtcbiAgICB0aGlzLmZhY3Rvcmllcy5zZXQoZmFjdG9yeS50eXBlLCBmYWN0b3J5KTtcbiAgfVxuXG4gIGdldCh0eXBlOiBCbG9ja1R5cGUpOiBCbG9ja0ZhY3RvcnkgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmZhY3Rvcmllcy5nZXQodHlwZSk7XG4gIH1cblxuICBnZXRBbGwoKTogQmxvY2tGYWN0b3J5W10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZmFjdG9yaWVzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLmNsZWFyKCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IEJsb2NrUmVnaXN0cnkgPSBuZXcgQmxvY2tSZWdpc3RyeUNsYXNzKCk7XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIEJsb2NrVHlwZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBCbG9ja1JlZ2lzdHJ5IH0gZnJvbSAnLi9CbG9ja1JlZ2lzdHJ5JztcbmltcG9ydCB7IEdyaWRMYXlvdXQgfSBmcm9tICcuL0dyaWRMYXlvdXQnO1xuXG5leHBvcnQgY2xhc3MgRWRpdFRvb2xiYXIge1xuICBwcml2YXRlIHRvb2xiYXJFbDogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdE1vZGUgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG4gICAgcHJpdmF0ZSBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICAgIHByaXZhdGUgZ3JpZDogR3JpZExheW91dCxcbiAgICBwcml2YXRlIG9uQ29sdW1uc0NoYW5nZTogKG46IG51bWJlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgdGhpcy50b29sYmFyRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS10b29sYmFyJyB9KTtcbiAgICB0aGlzLnRvb2xiYXJFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAndG9vbGJhcicpO1xuICAgIHRoaXMudG9vbGJhckVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIb21lcGFnZSB0b29sYmFyJyk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgY29sU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOdW1iZXIgb2YgY29sdW1ucycpO1xuICAgIFsyLCAzLCA0XS5mb3JFYWNoKG4gPT4ge1xuICAgICAgY29uc3Qgb3B0ID0gY29sU2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHZhbHVlOiBTdHJpbmcobiksIHRleHQ6IGAke259IGNvbGAgfSk7XG4gICAgICBpZiAobiA9PT0gdGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgfSk7XG4gICAgY29sU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgIHRoaXMub25Db2x1bW5zQ2hhbmdlKE51bWJlcihjb2xTZWxlY3QudmFsdWUpKTtcbiAgICB9KTtcblxuICAgIC8vIEVkaXQgdG9nZ2xlXG4gICAgY29uc3QgZWRpdEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItZWRpdC1idG4nIH0pO1xuICAgIHRoaXMudXBkYXRlRWRpdEJ0bihlZGl0QnRuKTtcbiAgICBlZGl0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgdGhpcy5lZGl0TW9kZSA9ICF0aGlzLmVkaXRNb2RlO1xuICAgICAgdGhpcy5ncmlkLnNldEVkaXRNb2RlKHRoaXMuZWRpdE1vZGUpO1xuICAgICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgICAgdGhpcy5zeW5jQWRkQnV0dG9uKCk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5lZGl0TW9kZSkge1xuICAgICAgdGhpcy5hcHBlbmRBZGRCdXR0b24oKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUVkaXRCdG4oYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IHRoaXMuZWRpdE1vZGUgPyAnXHUyNzEzIERvbmUnIDogJ1x1MjcwRiBFZGl0JztcbiAgICBidG4udG9nZ2xlQ2xhc3MoJ3Rvb2xiYXItYnRuLWFjdGl2ZScsIHRoaXMuZWRpdE1vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzeW5jQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50b29sYmFyRWwucXVlcnlTZWxlY3RvcignLnRvb2xiYXItYWRkLWJ0bicpO1xuICAgIGlmICh0aGlzLmVkaXRNb2RlICYmICFleGlzdGluZykge1xuICAgICAgdGhpcy5hcHBlbmRBZGRCdXR0b24oKTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmVkaXRNb2RlICYmIGV4aXN0aW5nKSB7XG4gICAgICBleGlzdGluZy5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZEFkZEJ1dHRvbigpOiB2b2lkIHtcbiAgICBjb25zdCBhZGRCdG4gPSB0aGlzLnRvb2xiYXJFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyBjbHM6ICd0b29sYmFyLWFkZC1idG4nLCB0ZXh0OiAnKyBBZGQgQmxvY2snIH0pO1xuICAgIGFkZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIG5ldyBBZGRCbG9ja01vZGFsKHRoaXMuYXBwLCAodHlwZSkgPT4ge1xuICAgICAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQodHlwZSk7XG4gICAgICAgIGlmICghZmFjdG9yeSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1heFJvdyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MucmVkdWNlKFxuICAgICAgICAgIChtYXgsIGIpID0+IE1hdGgubWF4KG1heCwgYi5yb3cgKyBiLnJvd1NwYW4gLSAxKSwgMCxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSA9IHtcbiAgICAgICAgICBpZDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIGNvbDogMSxcbiAgICAgICAgICByb3c6IG1heFJvdyArIDEsXG4gICAgICAgICAgY29sU3BhbjogTWF0aC5taW4oZmFjdG9yeS5kZWZhdWx0U2l6ZS5jb2xTcGFuLCB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyksXG4gICAgICAgICAgcm93U3BhbjogZmFjdG9yeS5kZWZhdWx0U2l6ZS5yb3dTcGFuLFxuICAgICAgICAgIGNvbmZpZzogeyAuLi5mYWN0b3J5LmRlZmF1bHRDb25maWcgfSxcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdyaWQuYWRkQmxvY2soaW5zdGFuY2UpO1xuICAgICAgfSkub3BlbigpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0RWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMudG9vbGJhckVsO1xuICB9XG5cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xiYXJFbC5yZW1vdmUoKTtcbiAgfVxufVxuXG5jbGFzcyBBZGRCbG9ja01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIG9uU2VsZWN0OiAodHlwZTogQmxvY2tUeXBlKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBZGQgQmxvY2snIH0pO1xuXG4gICAgZm9yIChjb25zdCBmYWN0b3J5IG9mIEJsb2NrUmVnaXN0cnkuZ2V0QWxsKCkpIHtcbiAgICAgIGNvbnN0IGJ0biA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuICAgICAgICBjbHM6ICdhZGQtYmxvY2stb3B0aW9uJyxcbiAgICAgICAgdGV4dDogZmFjdG9yeS5kaXNwbGF5TmFtZSxcbiAgICAgIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2VsZWN0KGZhY3RvcnkudHlwZSk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBHcmVldGluZ0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbmFtZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnZ3JlZXRpbmctYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dUaW1lPzogYm9vbGVhbiB9O1xuXG4gICAgaWYgKHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLXRpbWUnIH0pO1xuICAgIH1cbiAgICB0aGlzLm5hbWVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2dyZWV0aW5nLW5hbWUnIH0pO1xuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IGhvdXIgPSBub3cuaG91cigpO1xuICAgIGNvbnN0IHsgbmFtZSA9ICdiZW50b3JuYXRvJywgc2hvd1RpbWUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBuYW1lPzogc3RyaW5nO1xuICAgICAgc2hvd1RpbWU/OiBib29sZWFuO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWx1dGF0aW9uID1cbiAgICAgIGhvdXIgPj0gNSAmJiBob3VyIDwgMTIgPyAnQnVvbmdpb3JubycgOlxuICAgICAgaG91ciA+PSAxMiAmJiBob3VyIDwgMTggPyAnQnVvbiBwb21lcmlnZ2lvJyA6XG4gICAgICAnQnVvbmFzZXJhJztcblxuICAgIGlmICh0aGlzLnRpbWVFbCAmJiBzaG93VGltZSkge1xuICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KCdISDptbScpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubmFtZUVsKSB7XG4gICAgICB0aGlzLm5hbWVFbC5zZXRUZXh0KGAke3NhbHV0YXRpb259LCAke25hbWV9YCk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBHcmVldGluZ1NldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAobmV3Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IG5ld0NvbmZpZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBHcmVldGluZ1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0dyZWV0aW5nIFNldHRpbmdzJyB9KTtcblxuICAgIGNvbnN0IGRyYWZ0ID0gc3RydWN0dXJlZENsb25lKHRoaXMuY29uZmlnKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnTmFtZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5uYW1lIGFzIHN0cmluZyA/PyAnYmVudG9ybmF0bycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5uYW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgdGltZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaW1lIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LnNob3dUaW1lID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCbG9jayBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhcHA6IEFwcCxcbiAgICBwcm90ZWN0ZWQgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UsXG4gICAgcHJvdGVjdGVkIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgYWJzdHJhY3QgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4gIC8vIE92ZXJyaWRlIHRvIG9wZW4gYSBwZXItYmxvY2sgc2V0dGluZ3MgbW9kYWxcbiAgb3BlblNldHRpbmdzKF9vblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHt9XG5cbiAgLy8gUmVuZGVyIHRoZSBtdXRlZCB1cHBlcmNhc2UgYmxvY2sgaGVhZGVyIGxhYmVsIGlmIHRpdGxlIGlzIG5vbi1lbXB0eVxuICBwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGVsOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aXRsZSkge1xuICAgICAgZWwuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2staGVhZGVyJywgdGV4dDogdGl0bGUgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgdGltZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRhdGVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2Nsb2NrLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHNob3dEYXRlID0gdHJ1ZSB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyBzaG93RGF0ZT86IGJvb2xlYW4gfTtcblxuICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stdGltZScgfSk7XG4gICAgaWYgKHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2Nsb2NrLWRhdGUnIH0pO1xuICAgIH1cblxuICAgIHRoaXMudGljaygpO1xuICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDEwMDApKTtcbiAgfVxuXG4gIHByaXZhdGUgdGljaygpOiB2b2lkIHtcbiAgICBjb25zdCBub3cgPSBtb21lbnQoKTtcbiAgICBjb25zdCB7IHNob3dTZWNvbmRzID0gZmFsc2UsIHNob3dEYXRlID0gdHJ1ZSwgZm9ybWF0ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHNob3dTZWNvbmRzPzogYm9vbGVhbjtcbiAgICAgIHNob3dEYXRlPzogYm9vbGVhbjtcbiAgICAgIGZvcm1hdD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudGltZUVsKSB7XG4gICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChmb3JtYXQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGltZUVsLnNldFRleHQobm93LmZvcm1hdChzaG93U2Vjb25kcyA/ICdISDptbTpzcycgOiAnSEg6bW0nKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmRhdGVFbCAmJiBzaG93RGF0ZSkge1xuICAgICAgdGhpcy5kYXRlRWwuc2V0VGV4dChub3cuZm9ybWF0KCdkZGRkLCBEIE1NTU0gWVlZWScpKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IENsb2NrU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIENsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ2xvY2sgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IHNlY29uZHMnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93U2Vjb25kcyBhcyBib29sZWFuID8/IGZhbHNlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd1NlY29uZHMgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyBkYXRlJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuc2hvd0RhdGUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0RhdGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5zZXROYW1lKCdDdXN0b20gZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdPcHRpb25hbCBtb21lbnQuanMgZm9ybWF0IHN0cmluZywgZS5nLiBcIkhIOm1tXCIuIExlYXZlIGVtcHR5IGZvciBkZWZhdWx0LicpXG4gICAgICAuYWRkVGV4dCh0ID0+XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9ybWF0IGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9ybWF0ID0gdjsgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIFN1Z2dlc3RNb2RhbCwgVEZpbGUsIFRGb2xkZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmludGVyZmFjZSBMaW5rSXRlbSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgZW1vamk/OiBzdHJpbmc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGb2xkZXIgcGlja2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJTdWdnZXN0TW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8VEZvbGRlcj4ge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcignVHlwZSB0byBzZWFyY2ggdmF1bHQgZm9sZGVyc1x1MjAyNicpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBbGxGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG4gICAgY29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG4gICAgY29uc3QgcmVjdXJzZSA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICBmb2xkZXJzLnB1c2goZik7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikgcmVjdXJzZShjaGlsZCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWN1cnNlKHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gICAgcmV0dXJuIGZvbGRlcnM7XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhxdWVyeTogc3RyaW5nKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxGb2xkZXJzKCkuZmlsdGVyKGYgPT4gZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiBmb2xkZXIucGF0aCA9PT0gJy8nID8gJy8gKHZhdWx0IHJvb3QpJyA6IGZvbGRlci5wYXRoIH0pO1xuICB9XG5cbiAgb25DaG9vc2VTdWdnZXN0aW9uKGZvbGRlcjogVEZvbGRlcik6IHZvaWQgeyB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEJsb2NrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTGlua3NCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuY29udGFpbmVyRWwgPSBlbDtcbiAgICBlbC5hZGRDbGFzcygnZm9sZGVyLWxpbmtzLWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNvbnRlbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBlbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICdRdWljayBMaW5rcycsIGZvbGRlciA9ICcnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGZvbGRlcj86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG5cbiAgICAvLyBBdXRvLWxpc3Qgbm90ZXMgZnJvbSBzZWxlY3RlZCBmb2xkZXIgKHNvcnRlZCBhbHBoYWJldGljYWxseSlcbiAgICBpZiAoZm9sZGVyKSB7XG4gICAgICBjb25zdCBmb2xkZXJPYmogPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcbiAgICAgIGlmIChmb2xkZXJPYmogaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgIGNvbnN0IG5vdGVzID0gZm9sZGVyT2JqLmNoaWxkcmVuXG4gICAgICAgICAgLmZpbHRlcigoY2hpbGQpOiBjaGlsZCBpcyBURmlsZSA9PiBjaGlsZCBpbnN0YW5jZW9mIFRGaWxlICYmIGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJylcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygbm90ZXMpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCAnJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGlzdC5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ05vIG5vdGVzIGluIHRoaXMgZm9sZGVyLicsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiBgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmAsIGNsczogJ2Jsb2NrLWxvYWRpbmcnIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hbnVhbCBsaW5rc1xuICAgIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRGl2KHsgY2xzOiAnZm9sZGVyLWxpbmstaXRlbScgfSk7XG4gICAgICBjb25zdCBidG4gPSBpdGVtLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2ZvbGRlci1saW5rLWJ0bicgfSk7XG4gICAgICBpZiAobGluay5lbW9qaSkge1xuICAgICAgICBidG4uY3JlYXRlU3Bhbih7IGNsczogJ2xpbmstZW1vamknLCB0ZXh0OiBsaW5rLmVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsaW5rLmxhYmVsIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGxpbmsucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFmb2xkZXIgJiYgbGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBsaXN0LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnQWRkIGxpbmtzIG9yIHNlbGVjdCBhIGZvbGRlciBpbiBzZXR0aW5ncy4nLCBjbHM6ICdibG9jay1sb2FkaW5nJyB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSxcbiAgICAgIChuZXdDb25maWcpID0+IHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICAgICAgICBvblNhdmUoKTtcbiAgICAgIH0sXG4gICAgKS5vcGVuKCk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJMaW5rc1NldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdRdWljayBMaW5rcyBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdDogeyB0aXRsZT86IHN0cmluZzsgZm9sZGVyPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG4gICAgZHJhZnQubGlua3MgPz89IFtdO1xuICAgIGNvbnN0IGxpbmtzID0gZHJhZnQubGlua3M7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlID8/ICdRdWljayBMaW5rcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBsZXQgZm9sZGVyVGV4dDogaW1wb3J0KCdvYnNpZGlhbicpLlRleHRDb21wb25lbnQ7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0F1dG8tbGlzdCBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0xpc3QgYWxsIG5vdGVzIGZyb20gdGhpcyB2YXVsdCBmb2xkZXIgYXMgbGlua3MuJylcbiAgICAgIC5hZGRUZXh0KHQgPT4ge1xuICAgICAgICBmb2xkZXJUZXh0ID0gdDtcbiAgICAgICAgdC5zZXRWYWx1ZShkcmFmdC5mb2xkZXIgPz8gJycpXG4gICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ2UuZy4gUHJvamVjdHMnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5mb2xkZXIgPSB2OyB9KTtcbiAgICAgIH0pXG4gICAgICAuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgICBidG4uc2V0SWNvbignZm9sZGVyJykuc2V0VG9vbHRpcCgnQnJvd3NlIHZhdWx0IGZvbGRlcnMnKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICBuZXcgRm9sZGVyU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCAoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gZm9sZGVyLnBhdGggPT09ICcvJyA/ICcnIDogZm9sZGVyLnBhdGg7XG4gICAgICAgICAgICBkcmFmdC5mb2xkZXIgPSBwYXRoO1xuICAgICAgICAgICAgZm9sZGVyVGV4dC5zZXRWYWx1ZShwYXRoKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdNYW51YWwgbGlua3MnIH0pO1xuXG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNhcmQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIGJsb2NrIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncyA6XG4gICAgICB0eXBlb2YgcmF3Rm1UYWdzID09PSAnc3RyaW5nJyA/IFtyYXdGbVRhZ3NdIDpcbiAgICAgIFtdO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRGbVRhZ3MgPSBmbVRhZ0FycmF5Lm1hcCh0ID0+IHQuc3RhcnRzV2l0aCgnIycpID8gdCA6IGAjJHt0fWApO1xuXG4gICAgcmV0dXJuIGlubGluZVRhZ3MuaW5jbHVkZXModGFnKSB8fCBub3JtYWxpemVkRm1UYWdzLmluY2x1ZGVzKHRhZyk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIFRhZ0dyaWRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygndGFnLWdyaWQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gVGFnR3JpZEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHRhZyBncmlkLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ05vdGVzJywgY29sdW1ucyA9IDIsIHNob3dFbW9qaSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIHNob3dFbW9qaT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBncmlkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAndGFnLWdyaWQnIH0pO1xuICAgIGdyaWQuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoIXRhZykge1xuICAgICAgZ3JpZC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgIGNvbnN0IGVtb2ppID0gc2hvd0Vtb2ppID8gKGNhY2hlPy5mcm9udG1hdHRlcj8uZW1vamkgYXMgc3RyaW5nID8/ICcnKSA6ICcnO1xuXG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3RhZy1idG4nIH0pO1xuICAgICAgaWYgKGVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAndGFnLWJ0bi1lbW9qaScsIHRleHQ6IGVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBUYWdHcmlkU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFRhZ0dyaWRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdUYWcgR3JpZCBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRpdGxlIGFzIHN0cmluZyA/PyAnTm90ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGVtb2ppJykuc2V0RGVzYygnUmVhZCBcImVtb2ppXCIgZnJvbnRtYXR0ZXIgZmllbGQnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC5zaG93RW1vamkgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuc2hvd0Vtb2ppID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gT25seSBhc3NpZ24gc2FmZSBDU1MgY29sb3IgdmFsdWVzOyByZWplY3QgcG90ZW50aWFsbHkgbWFsaWNpb3VzIHN0cmluZ3NcbmNvbnN0IENPTE9SX1JFID0gL14oI1swLTlhLWZBLUZdezMsOH18W2EtekEtWl0rfHJnYmE/XFwoW14pXStcXCl8aHNsYT9cXChbXildK1xcKSkkLztcblxuZXhwb3J0IGNsYXNzIFF1b3Rlc0xpc3RCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygncXVvdGVzLWxpc3QtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHF1b3Rlcy4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRhZyA9ICcnLCB0aXRsZSA9ICdRdW90ZXMnLCBjb2x1bW5zID0gMiwgbWF4SXRlbXMgPSAyMCB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGFnPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgbWF4SXRlbXM/OiBudW1iZXI7XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG4gICAgY29sc0VsLnN0eWxlLmNvbHVtbkNvdW50ID0gU3RyaW5nKGNvbHVtbnMpO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbHNFbC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEV4dHJhY3QgdGhlIGZpcnN0IGZldyBsaW5lcyBvZiBib2R5IGNvbnRlbnQgdXNpbmcgbWV0YWRhdGFDYWNoZSBmcm9udG1hdHRlciBvZmZzZXQuICovXG4gIHByaXZhdGUgZXh0cmFjdEJvZHkoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuICAgIGNvbnN0IGxpbmVzID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2UoMCwgMykuam9pbignICcpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBRdW90ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgUXVvdGVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVvdGVzIExpc3QgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyhkcmFmdC5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcbiAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgZHJhZnQuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcoZHJhZnQuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0LmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKGRyYWZ0Lm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IGRyYWZ0Lm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBlbC5zZXRUZXh0KCdDb25maWd1cmUgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKGRyYWZ0LnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUoZHJhZnQpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSB0ZXh0IGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29uc3QgZHJhZnQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5jb25maWcpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoZHJhZnQudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgZHJhZnQudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBkcmFmdC5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IGRyYWZ0LmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKGRyYWZ0KTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBzYW5pdGl6ZUhUTUxUb0RvbSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEh0bWxCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnaHRtbC1ibG9jaycpO1xuXG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBodG1sID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgaHRtbD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICB0aGlzLnJlbmRlckhlYWRlcihlbCwgdGl0bGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2h0bWwtYmxvY2stY29udGVudCcgfSk7XG5cbiAgICBpZiAoIWh0bWwpIHtcbiAgICAgIGNvbnRlbnRFbC5zZXRUZXh0KCdDb25maWd1cmUgSFRNTCBpbiBzZXR0aW5ncy4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb250ZW50RWwuYXBwZW5kQ2hpbGQoc2FuaXRpemVIVE1MVG9Eb20oaHRtbCkpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBjb25zdCBkcmFmdCA9IHN0cnVjdHVyZWRDbG9uZSh0aGlzLmNvbmZpZyk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShkcmFmdC50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyBkcmFmdC50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdIVE1MIGlzIHNhbml0aXplZCBiZWZvcmUgcmVuZGVyaW5nLicpO1xuICAgIGNvbnN0IHRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKCd0ZXh0YXJlYScsIHsgY2xzOiAnc3RhdGljLXRleHQtc2V0dGluZ3MtdGV4dGFyZWEnIH0pO1xuICAgIHRleHRhcmVhLnZhbHVlID0gZHJhZnQuaHRtbCBhcyBzdHJpbmcgPz8gJyc7XG4gICAgdGV4dGFyZWEucm93cyA9IDEyO1xuICAgIHRleHRhcmVhLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4geyBkcmFmdC5odG1sID0gdGV4dGFyZWEudmFsdWU7IH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZShkcmFmdCk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxvQkFBdUQ7OztBQ0F2RCxJQUFBQyxtQkFBd0M7OztBQ0F4QyxzQkFBNkM7OztBQ0U3QyxJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFBekI7QUFDRSxTQUFRLFlBQVksb0JBQUksSUFBNkI7QUFBQTtBQUFBLEVBRXJELFNBQVMsU0FBNkI7QUFDcEMsU0FBSyxVQUFVLElBQUksUUFBUSxNQUFNLE9BQU87QUFBQSxFQUMxQztBQUFBLEVBRUEsSUFBSSxNQUEyQztBQUM3QyxXQUFPLEtBQUssVUFBVSxJQUFJLElBQUk7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBeUI7QUFDdkIsV0FBTyxNQUFNLEtBQUssS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFFQSxRQUFjO0FBQ1osU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN2QjtBQUNGO0FBRU8sSUFBTSxnQkFBZ0IsSUFBSSxtQkFBbUI7OztBRGY3QyxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQVN0QixZQUNFLGFBQ1EsS0FDQSxRQUNBLGdCQUNSO0FBSFE7QUFDQTtBQUNBO0FBWFYsU0FBUSxTQUFTLG9CQUFJLElBQXdEO0FBQzdFLFNBQVEsV0FBVztBQUVuQjtBQUFBLFNBQVEsd0JB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V0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIkZvbGRlclN1Z2dlc3RNb2RhbCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSJdCn0K
