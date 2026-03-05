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
var import_obsidian14 = require("obsidian");

// src/HomepageView.ts
var import_obsidian2 = require("obsidian");

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
  render(blocks, columns) {
    this.destroyAll();
    this.gridEl.empty();
    this.gridEl.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    if (this.editMode) this.gridEl.addClass("edit-mode");
    for (const instance of blocks) {
      this.renderBlock(instance);
    }
  }
  renderBlock(instance) {
    const factory = BlockRegistry.get(instance.type);
    if (!factory) return;
    const wrapper = this.gridEl.createDiv({ cls: "homepage-block-wrapper" });
    wrapper.dataset.blockId = instance.id;
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
    handle.setText("\u283F");
    const settingsBtn = bar.createEl("button", { cls: "block-settings-btn", text: "\u2699" });
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
    const removeBtn = bar.createEl("button", { cls: "block-remove-btn", text: "\xD7" });
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newBlocks = this.plugin.layout.blocks.filter((b) => b.id !== instance.id);
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
    });
    const grip = wrapper.createDiv({ cls: "block-resize-grip", text: "\u22BF" });
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
  setColumns(n) {
    this.onLayoutChange({ ...this.plugin.layout, columns: n });
    this.rerender();
  }
  addBlock(instance) {
    const newBlocks = [...this.plugin.layout.blocks, instance];
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  rerender() {
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
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

// src/EditToolbar.ts
var import_obsidian = require("obsidian");
var EditToolbar = class {
  constructor(containerEl, app, plugin, grid, onColumnsChange) {
    this.app = app;
    this.plugin = plugin;
    this.grid = grid;
    this.onColumnsChange = onColumnsChange;
    this.editMode = false;
    this.toolbarEl = containerEl.createDiv({ cls: "homepage-toolbar" });
    this.renderToolbar();
  }
  renderToolbar() {
    this.toolbarEl.empty();
    const colSelect = this.toolbarEl.createEl("select", { cls: "toolbar-col-select" });
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
  destroy() {
    this.toolbarEl.remove();
  }
};
var AddBlockModal = class extends import_obsidian.Modal {
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
var HomepageView = class extends import_obsidian2.ItemView {
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
        this.plugin.layout.columns = columns;
        void this.plugin.saveLayout(this.plugin.layout);
        (_a2 = this.grid) == null ? void 0 : _a2.setColumns(columns);
      }
    );
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
var import_obsidian4 = require("obsidian");

// src/blocks/BaseBlock.ts
var import_obsidian3 = require("obsidian");
var BaseBlock = class extends import_obsidian3.Component {
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
    const now = (0, import_obsidian4.moment)();
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
var GreetingSettingsModal = class extends import_obsidian4.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Greeting Settings" });
    new import_obsidian4.Setting(contentEl).setName("Name").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.name) != null ? _a : "bentornato").onChange((v) => {
          this.config.name = v;
        });
      }
    );
    new import_obsidian4.Setting(contentEl).setName("Show time").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.showTime) != null ? _a : true).onChange((v) => {
          this.config.showTime = v;
        });
      }
    );
    new import_obsidian4.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ClockBlock.ts
var import_obsidian5 = require("obsidian");
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
    const now = (0, import_obsidian5.moment)();
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
var ClockSettingsModal = class extends import_obsidian5.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Clock Settings" });
    new import_obsidian5.Setting(contentEl).setName("Show seconds").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.showSeconds) != null ? _a : false).onChange((v) => {
          this.config.showSeconds = v;
        });
      }
    );
    new import_obsidian5.Setting(contentEl).setName("Show date").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.showDate) != null ? _a : true).onChange((v) => {
          this.config.showDate = v;
        });
      }
    );
    new import_obsidian5.Setting(contentEl).setName("Custom format").setDesc('Optional moment.js format string, e.g. "HH:mm". Leave empty for default.').addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.format) != null ? _a : "").onChange((v) => {
          this.config.format = v;
        });
      }
    );
    new import_obsidian5.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/FolderLinksBlock.ts
var import_obsidian6 = require("obsidian");
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
    const { title = "Links", links = [] } = this.instance.config;
    this.renderHeader(el, title);
    const list = el.createDiv({ cls: "folder-links-list" });
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
var FolderLinksSettingsModal = class extends import_obsidian6.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Folder Links Settings" });
    new import_obsidian6.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = this.config.title) != null ? _a2 : "Links").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    contentEl.createEl("h3", { text: "Links" });
    const links = ((_a = this.config.links) != null ? _a : []).map((l) => ({ ...l }));
    const linksContainer = contentEl.createDiv();
    const renderLinks = () => {
      linksContainer.empty();
      links.forEach((link, i) => {
        const row = linksContainer.createDiv({ cls: "settings-link-row" });
        new import_obsidian6.Setting(row).setName(`Link ${i + 1}`).addText((t) => t.setPlaceholder("Label").setValue(link.label).onChange((v) => {
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
    new import_obsidian6.Setting(contentEl).addButton((btn) => btn.setButtonText("Add Link").onClick(() => {
      links.push({ label: "", path: "" });
      renderLinks();
    })).addButton((btn) => btn.setButtonText("Save").setCta().onClick(() => {
      this.config.links = links;
      this.onSave(this.config);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/InsightBlock.ts
var import_obsidian7 = require("obsidian");

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
    const dayIndex = Math.floor((0, import_obsidian7.moment)().startOf("day").valueOf() / MS_PER_DAY);
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
var InsightSettingsModal = class extends import_obsidian7.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Insight Settings" });
    new import_obsidian7.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.title) != null ? _a : "Daily Insight").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    new import_obsidian7.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.tag) != null ? _a : "").onChange((v) => {
          this.config.tag = v;
        });
      }
    );
    new import_obsidian7.Setting(contentEl).setName("Daily seed").setDesc("Show same note all day").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.dailySeed) != null ? _a : true).onChange((v) => {
          this.config.dailySeed = v;
        });
      }
    );
    new import_obsidian7.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/TagGridBlock.ts
var import_obsidian8 = require("obsidian");
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
var TagGridSettingsModal = class extends import_obsidian8.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Tag Grid Settings" });
    new import_obsidian8.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.title) != null ? _a : "Notes").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.tag) != null ? _a : "").onChange((v) => {
          this.config.tag = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").setValue(String((_a = this.config.columns) != null ? _a : 2)).onChange((v) => {
          this.config.columns = Number(v);
        });
      }
    );
    new import_obsidian8.Setting(contentEl).setName("Show emoji").setDesc('Read "emoji" frontmatter field').addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.showEmoji) != null ? _a : true).onChange((v) => {
          this.config.showEmoji = v;
        });
      }
    );
    new import_obsidian8.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/QuotesListBlock.ts
var import_obsidian9 = require("obsidian");
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
var QuotesSettingsModal = class extends import_obsidian9.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Quotes List Settings" });
    new import_obsidian9.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.title) != null ? _a : "Quotes").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Tag").setDesc("Without # prefix").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.tag) != null ? _a : "").onChange((v) => {
          this.config.tag = v;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").setValue(String((_a = this.config.columns) != null ? _a : 2)).onChange((v) => {
          this.config.columns = Number(v);
        });
      }
    );
    new import_obsidian9.Setting(contentEl).setName("Max items").addText(
      (t) => {
        var _a;
        return t.setValue(String((_a = this.config.maxItems) != null ? _a : 20)).onChange((v) => {
          this.config.maxItems = parseInt(v) || 20;
        });
      }
    );
    new import_obsidian9.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ImageGalleryBlock.ts
var import_obsidian10 = require("obsidian");
var FolderSuggestModal = class extends import_obsidian10.SuggestModal {
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
        if (child instanceof import_obsidian10.TFolder) recurse(child);
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
    if (!(folderObj instanceof import_obsidian10.TFolder)) {
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
        if (child instanceof import_obsidian10.TFile) {
          const ext = `.${child.extension.toLowerCase()}`;
          if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
            files.push(child);
          }
        } else if (child instanceof import_obsidian10.TFolder) {
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
var ImageGallerySettingsModal = class extends import_obsidian10.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Image Gallery Settings" });
    new import_obsidian10.Setting(contentEl).setName("Block title").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.title) != null ? _a : "Gallery").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    let folderText;
    new import_obsidian10.Setting(contentEl).setName("Folder").setDesc("Pick a vault folder.").addText((t) => {
      var _a;
      folderText = t;
      t.setValue((_a = this.config.folder) != null ? _a : "").setPlaceholder("Attachments/Photos").onChange((v) => {
        this.config.folder = v;
      });
    }).addButton(
      (btn) => btn.setIcon("folder").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal(this.app, (folder) => {
          const path = folder.path === "/" ? "" : folder.path;
          this.config.folder = path;
          folderText.setValue(path);
        }).open();
      })
    );
    new import_obsidian10.Setting(contentEl).setName("Columns").addDropdown(
      (d) => {
        var _a;
        return d.addOption("2", "2").addOption("3", "3").addOption("4", "4").setValue(String((_a = this.config.columns) != null ? _a : 3)).onChange((v) => {
          this.config.columns = Number(v);
        });
      }
    );
    new import_obsidian10.Setting(contentEl).setName("Max items").addText(
      (t) => {
        var _a;
        return t.setValue(String((_a = this.config.maxItems) != null ? _a : 20)).onChange((v) => {
          this.config.maxItems = parseInt(v) || 20;
        });
      }
    );
    new import_obsidian10.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/EmbeddedNoteBlock.ts
var import_obsidian11 = require("obsidian");
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
    if (!(file instanceof import_obsidian11.TFile)) {
      el.setText(`File not found: ${filePath}`);
      return;
    }
    if (showTitle) {
      this.renderHeader(el, file.basename);
    }
    const contentEl = el.createDiv({ cls: "embedded-note-content" });
    try {
      const content = await this.app.vault.read(file);
      await import_obsidian11.MarkdownRenderer.render(this.app, content, contentEl, file.path, this);
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
var EmbeddedNoteSettingsModal = class extends import_obsidian11.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Embedded Note Settings" });
    new import_obsidian11.Setting(contentEl).setName("File path").setDesc("Vault path to the note (e.g. Notes/MyNote.md)").addText(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.filePath) != null ? _a : "").onChange((v) => {
          this.config.filePath = v;
        });
      }
    );
    new import_obsidian11.Setting(contentEl).setName("Show title").addToggle(
      (t) => {
        var _a;
        return t.setValue((_a = this.config.showTitle) != null ? _a : true).onChange((v) => {
          this.config.showTitle = v;
        });
      }
    );
    new import_obsidian11.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/StaticTextBlock.ts
var import_obsidian12 = require("obsidian");
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
    await import_obsidian12.MarkdownRenderer.render(this.app, content, contentEl, "", this);
  }
  openSettings(onSave) {
    new StaticTextSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var StaticTextSettingsModal = class extends import_obsidian12.Modal {
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
    new import_obsidian12.Setting(contentEl).setName("Block title").setDesc("Optional header shown above the text.").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = this.config.title) != null ? _a2 : "").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    new import_obsidian12.Setting(contentEl).setName("Content").setDesc("Supports Markdown.");
    const textarea = contentEl.createEl("textarea", { cls: "static-text-settings-textarea" });
    textarea.value = (_a = this.config.content) != null ? _a : "";
    textarea.rows = 10;
    textarea.addEventListener("input", () => {
      this.config.content = textarea.value;
    });
    new import_obsidian12.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/HtmlBlock.ts
var import_obsidian13 = require("obsidian");
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
    contentEl.innerHTML = html;
  }
  openSettings(onSave) {
    new HtmlBlockSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
  }
};
var HtmlBlockSettingsModal = class extends import_obsidian13.Modal {
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
    new import_obsidian13.Setting(contentEl).setName("Block title").setDesc("Optional header shown above the HTML.").addText(
      (t) => {
        var _a2;
        return t.setValue((_a2 = this.config.title) != null ? _a2 : "").onChange((v) => {
          this.config.title = v;
        });
      }
    );
    new import_obsidian13.Setting(contentEl).setName("HTML").setDesc("Raw HTML rendered directly in the block.");
    const textarea = contentEl.createEl("textarea", { cls: "static-text-settings-textarea" });
    textarea.value = (_a = this.config.html) != null ? _a : "";
    textarea.rows = 12;
    textarea.setAttribute("spellcheck", "false");
    textarea.addEventListener("input", () => {
      this.config.html = textarea.value;
    });
    new import_obsidian13.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(this.config);
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
      config: { title: "Dataviews", links: [] }
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
    defaultConfig: { title: "Links", links: [] },
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
var HomepagePlugin = class extends import_obsidian14.Plugin {
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
var HomepageSettingTab = class extends import_obsidian14.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Homepage Blocks" });
    new import_obsidian14.Setting(containerEl).setName("Open on startup").setDesc("Automatically open the homepage when Obsidian starts.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.openOnStartup).onChange(async (value) => {
        this.plugin.layout.openOnStartup = value;
        await this.plugin.saveLayout(this.plugin.layout);
      })
    );
    new import_obsidian14.Setting(containerEl).setName("Default columns").setDesc("Number of columns in the grid layout.").addDropdown(
      (drop) => drop.addOption("2", "2 columns").addOption("3", "3 columns").addOption("4", "4 columns").setValue(String(this.plugin.layout.columns)).onChange(async (value) => {
        this.plugin.layout.columns = Number(value);
        await this.plugin.saveLayout(this.plugin.layout);
      })
    );
    new import_obsidian14.Setting(containerEl).setName("Reset to default layout").setDesc("Restore all blocks to the original default layout. Cannot be undone.").addButton(
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL0hvbWVwYWdlVmlldy50cyIsICJzcmMvQmxvY2tSZWdpc3RyeS50cyIsICJzcmMvR3JpZExheW91dC50cyIsICJzcmMvRWRpdFRvb2xiYXIudHMiLCAic3JjL2Jsb2Nrcy9HcmVldGluZ0Jsb2NrLnRzIiwgInNyYy9ibG9ja3MvQmFzZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvQ2xvY2tCbG9jay50cyIsICJzcmMvYmxvY2tzL0ZvbGRlckxpbmtzQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbnNpZ2h0QmxvY2sudHMiLCAic3JjL3V0aWxzL3RhZ3MudHMiLCAic3JjL2Jsb2Nrcy9UYWdHcmlkQmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9RdW90ZXNMaXN0QmxvY2sudHMiLCAic3JjL2Jsb2Nrcy9JbWFnZUdhbGxlcnlCbG9jay50cyIsICJzcmMvYmxvY2tzL0VtYmVkZGVkTm90ZUJsb2NrLnRzIiwgInNyYy9ibG9ja3MvU3RhdGljVGV4dEJsb2NrLnRzIiwgInNyYy9ibG9ja3MvSHRtbEJsb2NrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFZJRVdfVFlQRSwgSG9tZXBhZ2VWaWV3IH0gZnJvbSAnLi9Ib21lcGFnZVZpZXcnO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgQmxvY2tUeXBlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmVldGluZ0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvR3JlZXRpbmdCbG9jayc7XG5pbXBvcnQgeyBDbG9ja0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvQ2xvY2tCbG9jayc7XG5pbXBvcnQgeyBGb2xkZXJMaW5rc0Jsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRm9sZGVyTGlua3NCbG9jayc7XG5pbXBvcnQgeyBJbnNpZ2h0QmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9JbnNpZ2h0QmxvY2snO1xuaW1wb3J0IHsgVGFnR3JpZEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvVGFnR3JpZEJsb2NrJztcbmltcG9ydCB7IFF1b3Rlc0xpc3RCbG9jayB9IGZyb20gJy4vYmxvY2tzL1F1b3Rlc0xpc3RCbG9jayc7XG5pbXBvcnQgeyBJbWFnZUdhbGxlcnlCbG9jayB9IGZyb20gJy4vYmxvY2tzL0ltYWdlR2FsbGVyeUJsb2NrJztcbmltcG9ydCB7IEVtYmVkZGVkTm90ZUJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvRW1iZWRkZWROb3RlQmxvY2snO1xuaW1wb3J0IHsgU3RhdGljVGV4dEJsb2NrIH0gZnJvbSAnLi9ibG9ja3MvU3RhdGljVGV4dEJsb2NrJztcbmltcG9ydCB7IEh0bWxCbG9jayB9IGZyb20gJy4vYmxvY2tzL0h0bWxCbG9jayc7XG5cbi8vIFx1MjUwMFx1MjUwMCBEZWZhdWx0IGxheW91dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEltbXV0YWJsZSB0ZW1wbGF0ZS4gQWx3YXlzIGNsb25lIHZpYSBnZXREZWZhdWx0TGF5b3V0KCkuICovXG5jb25zdCBERUZBVUxUX0xBWU9VVF9EQVRBOiBMYXlvdXRDb25maWcgPSB7XG4gIGNvbHVtbnM6IDMsXG4gIG9wZW5PblN0YXJ0dXA6IGZhbHNlLFxuICBibG9ja3M6IFtcbiAgICAvLyBSb3cgMVxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1zdGF0aWMtdGV4dCcsXG4gICAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgICAgY29sOiAxLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWNsb2NrJyxcbiAgICAgIHR5cGU6ICdjbG9jaycsXG4gICAgICBjb2w6IDIsIHJvdzogMSwgY29sU3BhbjogMSwgcm93U3BhbjogMSxcbiAgICAgIGNvbmZpZzogeyBzaG93U2Vjb25kczogZmFsc2UsIHNob3dEYXRlOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtZm9sZGVyLWxpbmtzJyxcbiAgICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgICAgY29sOiAzLCByb3c6IDEsIGNvbFNwYW46IDEsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGl0bGU6ICdEYXRhdmlld3MnLCBsaW5rczogW10gfSxcbiAgICB9LFxuICAgIC8vIFJvdyAyXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0LWluc2lnaHQnLFxuICAgICAgdHlwZTogJ2luc2lnaHQnLFxuICAgICAgY29sOiAxLCByb3c6IDIsIGNvbFNwYW46IDIsIHJvd1NwYW46IDEsXG4gICAgICBjb25maWc6IHsgdGFnOiAnJywgdGl0bGU6ICdEYWlseSBJbnNpZ2h0JywgZGFpbHlTZWVkOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlZmF1bHQtdGFnLWdyaWQnLFxuICAgICAgdHlwZTogJ3RhZy1ncmlkJyxcbiAgICAgIGNvbDogMywgcm93OiAyLCBjb2xTcGFuOiAxLCByb3dTcGFuOiAyLFxuICAgICAgY29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnVmFsdWVzJywgY29sdW1uczogMiwgc2hvd0Vtb2ppOiB0cnVlIH0sXG4gICAgfSxcbiAgICAvLyBSb3cgM1xuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1xdW90ZXMnLFxuICAgICAgdHlwZTogJ3F1b3Rlcy1saXN0JyxcbiAgICAgIGNvbDogMSwgcm93OiAzLCBjb2xTcGFuOiAyLCByb3dTcGFuOiAxLFxuICAgICAgY29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnUXVvdGVzJywgY29sdW1uczogMiwgbWF4SXRlbXM6IDIwIH0sXG4gICAgfSxcbiAgICAvLyBSb3cgNFxuICAgIHtcbiAgICAgIGlkOiAnZGVmYXVsdC1nYWxsZXJ5JyxcbiAgICAgIHR5cGU6ICdpbWFnZS1nYWxsZXJ5JyxcbiAgICAgIGNvbDogMSwgcm93OiA0LCBjb2xTcGFuOiAzLCByb3dTcGFuOiAxLFxuICAgICAgY29uZmlnOiB7IGZvbGRlcjogJycsIHRpdGxlOiAnR2FsbGVyeScsIGNvbHVtbnM6IDMsIG1heEl0ZW1zOiAyMCB9LFxuICAgIH0sXG4gIF0sXG59O1xuXG4vKiogUmV0dXJucyBhIGRlZXAgY2xvbmUgb2YgdGhlIGRlZmF1bHQgbGF5b3V0LCBzYWZlIHRvIG11dGF0ZS4gKi9cbmZ1bmN0aW9uIGdldERlZmF1bHRMYXlvdXQoKTogTGF5b3V0Q29uZmlnIHtcbiAgcmV0dXJuIHN0cnVjdHVyZWRDbG9uZShERUZBVUxUX0xBWU9VVF9EQVRBKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIExheW91dCB2YWxpZGF0aW9uIC8gbWlncmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBWQUxJRF9CTE9DS19UWVBFUyA9IG5ldyBTZXQ8c3RyaW5nPihbXG4gICdncmVldGluZycsICdmb2xkZXItbGlua3MnLCAnaW5zaWdodCcsICd0YWctZ3JpZCcsXG4gICdxdW90ZXMtbGlzdCcsICdpbWFnZS1nYWxsZXJ5JywgJ2Nsb2NrJywgJ2VtYmVkZGVkLW5vdGUnLFxuICAnc3RhdGljLXRleHQnLCAnaHRtbCcsXG5dKTtcblxuZnVuY3Rpb24gaXNWYWxpZEJsb2NrSW5zdGFuY2UoYjogdW5rbm93bik6IGIgaXMgQmxvY2tJbnN0YW5jZSB7XG4gIGlmICghYiB8fCB0eXBlb2YgYiAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgYmxvY2sgPSBiIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBibG9jay5pZCA9PT0gJ3N0cmluZycgJiZcbiAgICB0eXBlb2YgYmxvY2sudHlwZSA9PT0gJ3N0cmluZycgJiYgVkFMSURfQkxPQ0tfVFlQRVMuaGFzKGJsb2NrLnR5cGUpICYmXG4gICAgdHlwZW9mIGJsb2NrLmNvbCA9PT0gJ251bWJlcicgJiYgYmxvY2suY29sID49IDEgJiZcbiAgICB0eXBlb2YgYmxvY2sucm93ID09PSAnbnVtYmVyJyAmJiBibG9jay5yb3cgPj0gMSAmJlxuICAgIHR5cGVvZiBibG9jay5jb2xTcGFuID09PSAnbnVtYmVyJyAmJiBibG9jay5jb2xTcGFuID49IDEgJiZcbiAgICB0eXBlb2YgYmxvY2sucm93U3BhbiA9PT0gJ251bWJlcicgJiYgYmxvY2sucm93U3BhbiA+PSAxICYmXG4gICAgYmxvY2suY29uZmlnICE9PSBudWxsICYmIHR5cGVvZiBibG9jay5jb25maWcgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KGJsb2NrLmNvbmZpZylcbiAgKTtcbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSBhbmQgc2FuaXRpemUgZGF0YSBsb2FkZWQgZnJvbSBkaXNrLlxuICogSW52YWxpZCBmaWVsZHMgYXJlIHJlcGxhY2VkIHdpdGggZGVmYXVsdHMuXG4gKiBJbnZhbGlkIGJsb2NrIGVudHJpZXMgYXJlIGRyb3BwZWQuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlTGF5b3V0KHJhdzogdW5rbm93bik6IExheW91dENvbmZpZyB7XG4gIGNvbnN0IGRlZmF1bHRzID0gZ2V0RGVmYXVsdExheW91dCgpO1xuICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHJhdykpIHJldHVybiBkZWZhdWx0cztcblxuICBjb25zdCByID0gcmF3IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBjb25zdCBjb2x1bW5zID0gdHlwZW9mIHIuY29sdW1ucyA9PT0gJ251bWJlcicgJiYgWzIsIDMsIDRdLmluY2x1ZGVzKHIuY29sdW1ucylcbiAgICA/IHIuY29sdW1uc1xuICAgIDogZGVmYXVsdHMuY29sdW1ucztcbiAgY29uc3Qgb3Blbk9uU3RhcnR1cCA9IHR5cGVvZiByLm9wZW5PblN0YXJ0dXAgPT09ICdib29sZWFuJ1xuICAgID8gci5vcGVuT25TdGFydHVwXG4gICAgOiBkZWZhdWx0cy5vcGVuT25TdGFydHVwO1xuICBjb25zdCBibG9ja3MgPSBBcnJheS5pc0FycmF5KHIuYmxvY2tzKVxuICAgID8gci5ibG9ja3MuZmlsdGVyKGlzVmFsaWRCbG9ja0luc3RhbmNlKVxuICAgIDogZGVmYXVsdHMuYmxvY2tzO1xuXG4gIHJldHVybiB7IGNvbHVtbnMsIG9wZW5PblN0YXJ0dXAsIGJsb2NrcyB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgQmxvY2sgcmVnaXN0cmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiByZWdpc3RlckJsb2NrcygpOiB2b2lkIHtcbiAgQmxvY2tSZWdpc3RyeS5jbGVhcigpO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdncmVldGluZycsXG4gICAgZGlzcGxheU5hbWU6ICdHcmVldGluZycsXG4gICAgZGVmYXVsdENvbmZpZzogeyBuYW1lOiAnV29ybGQnLCBzaG93VGltZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBHcmVldGluZ0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdjbG9jaycsXG4gICAgZGlzcGxheU5hbWU6ICdDbG9jayAvIERhdGUnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgc2hvd1NlY29uZHM6IGZhbHNlLCBzaG93RGF0ZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBDbG9ja0Jsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdmb2xkZXItbGlua3MnLFxuICAgIGRpc3BsYXlOYW1lOiAnRm9sZGVyIExpbmtzJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRpdGxlOiAnTGlua3MnLCBsaW5rczogW10gfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgRm9sZGVyTGlua3NCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnaW5zaWdodCcsXG4gICAgZGlzcGxheU5hbWU6ICdEYWlseSBJbnNpZ2h0JyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZDogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBJbnNpZ2h0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ3RhZy1ncmlkJyxcbiAgICBkaXNwbGF5TmFtZTogJ1RhZyBHcmlkJyxcbiAgICBkZWZhdWx0Q29uZmlnOiB7IHRhZzogJycsIHRpdGxlOiAnTm90ZXMnLCBjb2x1bW5zOiAyLCBzaG93RW1vamk6IHRydWUgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAxLCByb3dTcGFuOiAyIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgVGFnR3JpZEJsb2NrKGFwcCwgaW5zdGFuY2UsIHBsdWdpbiksXG4gIH0pO1xuXG4gIEJsb2NrUmVnaXN0cnkucmVnaXN0ZXIoe1xuICAgIHR5cGU6ICdxdW90ZXMtbGlzdCcsXG4gICAgZGlzcGxheU5hbWU6ICdRdW90ZXMgTGlzdCcsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0YWc6ICcnLCB0aXRsZTogJ1F1b3RlcycsIGNvbHVtbnM6IDIsIG1heEl0ZW1zOiAyMCB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDIsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBRdW90ZXNMaXN0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2ltYWdlLWdhbGxlcnknLFxuICAgIGRpc3BsYXlOYW1lOiAnSW1hZ2UgR2FsbGVyeScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmb2xkZXI6ICcnLCB0aXRsZTogJ0dhbGxlcnknLCBjb2x1bW5zOiAzLCBtYXhJdGVtczogMjAgfSxcbiAgICBkZWZhdWx0U2l6ZTogeyBjb2xTcGFuOiAzLCByb3dTcGFuOiAxIH0sXG4gICAgY3JlYXRlOiAoYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSA9PiBuZXcgSW1hZ2VHYWxsZXJ5QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2VtYmVkZGVkLW5vdGUnLFxuICAgIGRpc3BsYXlOYW1lOiAnRW1iZWRkZWQgTm90ZScsXG4gICAgZGVmYXVsdENvbmZpZzogeyBmaWxlUGF0aDogJycsIHNob3dUaXRsZTogdHJ1ZSB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBFbWJlZGRlZE5vdGVCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcblxuICBCbG9ja1JlZ2lzdHJ5LnJlZ2lzdGVyKHtcbiAgICB0eXBlOiAnc3RhdGljLXRleHQnLFxuICAgIGRpc3BsYXlOYW1lOiAnU3RhdGljIFRleHQnLFxuICAgIGRlZmF1bHRDb25maWc6IHsgdGl0bGU6ICcnLCBjb250ZW50OiAnJyB9LFxuICAgIGRlZmF1bHRTaXplOiB7IGNvbFNwYW46IDEsIHJvd1NwYW46IDEgfSxcbiAgICBjcmVhdGU6IChhcHAsIGluc3RhbmNlLCBwbHVnaW4pID0+IG5ldyBTdGF0aWNUZXh0QmxvY2soYXBwLCBpbnN0YW5jZSwgcGx1Z2luKSxcbiAgfSk7XG5cbiAgQmxvY2tSZWdpc3RyeS5yZWdpc3Rlcih7XG4gICAgdHlwZTogJ2h0bWwnLFxuICAgIGRpc3BsYXlOYW1lOiAnSFRNTCBCbG9jaycsXG4gICAgZGVmYXVsdENvbmZpZzogeyB0aXRsZTogJycsIGh0bWw6ICcnIH0sXG4gICAgZGVmYXVsdFNpemU6IHsgY29sU3BhbjogMSwgcm93U3BhbjogMSB9LFxuICAgIGNyZWF0ZTogKGFwcCwgaW5zdGFuY2UsIHBsdWdpbikgPT4gbmV3IEh0bWxCbG9jayhhcHAsIGluc3RhbmNlLCBwbHVnaW4pLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZXBhZ2VQbHVnaW4gZXh0ZW5kcyBQbHVnaW4gaW1wbGVtZW50cyBJSG9tZXBhZ2VQbHVnaW4ge1xuICBsYXlvdXQ6IExheW91dENvbmZpZyA9IGdldERlZmF1bHRMYXlvdXQoKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmVnaXN0ZXJCbG9ja3MoKTtcblxuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyB1bmtub3duO1xuICAgIHRoaXMubGF5b3V0ID0gdmFsaWRhdGVMYXlvdXQocmF3KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgKGxlYWYpID0+IG5ldyBIb21lcGFnZVZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi1ob21lcGFnZScsXG4gICAgICBuYW1lOiAnT3BlbiBIb21lcGFnZScsXG4gICAgICBjYWxsYmFjazogKCkgPT4geyB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7IH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oJ2hvbWUnLCAnT3BlbiBIb21lcGFnZScsICgpID0+IHsgdm9pZCB0aGlzLm9wZW5Ib21lcGFnZSgpOyB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSG9tZXBhZ2VTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5sYXlvdXQub3Blbk9uU3RhcnR1cCkge1xuICAgICAgICB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbnVubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7XG4gIH1cblxuICBhc3luYyBzYXZlTGF5b3V0KGxheW91dDogTGF5b3V0Q29uZmlnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5sYXlvdXQgPSBsYXlvdXQ7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YShsYXlvdXQpO1xuICB9XG5cbiAgYXN5bmMgb3BlbkhvbWVwYWdlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcbiAgICBjb25zdCBleGlzdGluZyA9IHdvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKTtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgd29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBsZWFmID0gd29ya3NwYWNlLmdldExlYWYoJ3RhYicpO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgd29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzIHRhYiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgSG9tZXBhZ2VTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogSG9tZXBhZ2VQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdIb21lcGFnZSBCbG9ja3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnT3BlbiBvbiBzdGFydHVwJylcbiAgICAgIC5zZXREZXNjKCdBdXRvbWF0aWNhbGx5IG9wZW4gdGhlIGhvbWVwYWdlIHdoZW4gT2JzaWRpYW4gc3RhcnRzLicpXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4ubGF5b3V0Lm9wZW5PblN0YXJ0dXApXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ubGF5b3V0Lm9wZW5PblN0YXJ0dXAgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQodGhpcy5wbHVnaW4ubGF5b3V0KTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdEZWZhdWx0IGNvbHVtbnMnKVxuICAgICAgLnNldERlc2MoJ051bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkIGxheW91dC4nKVxuICAgICAgLmFkZERyb3Bkb3duKGRyb3AgPT5cbiAgICAgICAgZHJvcFxuICAgICAgICAgIC5hZGRPcHRpb24oJzInLCAnMiBjb2x1bW5zJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCczJywgJzMgY29sdW1ucycpXG4gICAgICAgICAgLmFkZE9wdGlvbignNCcsICc0IGNvbHVtbnMnKVxuICAgICAgICAgIC5zZXRWYWx1ZShTdHJpbmcodGhpcy5wbHVnaW4ubGF5b3V0LmNvbHVtbnMpKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zID0gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVMYXlvdXQodGhpcy5wbHVnaW4ubGF5b3V0KTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdSZXNldCB0byBkZWZhdWx0IGxheW91dCcpXG4gICAgICAuc2V0RGVzYygnUmVzdG9yZSBhbGwgYmxvY2tzIHRvIHRoZSBvcmlnaW5hbCBkZWZhdWx0IGxheW91dC4gQ2Fubm90IGJlIHVuZG9uZS4nKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1Jlc2V0IGxheW91dCcpLnNldFdhcm5pbmcoKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlTGF5b3V0KGdldERlZmF1bHRMYXlvdXQoKSk7XG4gICAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKSkge1xuICAgICAgICAgICAgaWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIEhvbWVwYWdlVmlldykge1xuICAgICAgICAgICAgICBhd2FpdCBsZWFmLnZpZXcucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IElIb21lcGFnZVBsdWdpbiwgTGF5b3V0Q29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcbmltcG9ydCB7IEVkaXRUb29sYmFyIH0gZnJvbSAnLi9FZGl0VG9vbGJhcic7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnaG9tZXBhZ2UtYmxvY2tzJztcblxuZXhwb3J0IGNsYXNzIEhvbWVwYWdlVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSBncmlkOiBHcmlkTGF5b3V0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdG9vbGJhcjogRWRpdFRvb2xiYXIgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHBsdWdpbjogSUhvbWVwYWdlUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gVklFV19UWVBFOyB9XG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7IHJldHVybiAnSG9tZXBhZ2UnOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuICdob21lJzsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBGdWxsIHRlYXJkb3duOiB1bmxvYWRzIGJsb2NrcyBBTkQgcmVtb3ZlcyB0aGUgZ3JpZCBET00gZWxlbWVudFxuICAgIHRoaXMuZ3JpZD8uZGVzdHJveSgpO1xuICAgIHRoaXMudG9vbGJhcj8uZGVzdHJveSgpO1xuXG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmFkZENsYXNzKCdob21lcGFnZS12aWV3Jyk7XG5cbiAgICBjb25zdCBsYXlvdXQ6IExheW91dENvbmZpZyA9IHRoaXMucGx1Z2luLmxheW91dDtcblxuICAgIGNvbnN0IG9uTGF5b3V0Q2hhbmdlID0gKG5ld0xheW91dDogTGF5b3V0Q29uZmlnKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5sYXlvdXQgPSBuZXdMYXlvdXQ7XG4gICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmVMYXlvdXQobmV3TGF5b3V0KTtcbiAgICB9O1xuXG4gICAgdGhpcy5ncmlkID0gbmV3IEdyaWRMYXlvdXQoY29udGVudEVsLCB0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIG9uTGF5b3V0Q2hhbmdlKTtcblxuICAgIHRoaXMudG9vbGJhciA9IG5ldyBFZGl0VG9vbGJhcihcbiAgICAgIGNvbnRlbnRFbCxcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5wbHVnaW4sXG4gICAgICB0aGlzLmdyaWQsXG4gICAgICAoY29sdW1ucykgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucyA9IGNvbHVtbnM7XG4gICAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2F2ZUxheW91dCh0aGlzLnBsdWdpbi5sYXlvdXQpO1xuICAgICAgICB0aGlzLmdyaWQ/LnNldENvbHVtbnMoY29sdW1ucyk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB0aGlzLmdyaWQucmVuZGVyKGxheW91dC5ibG9ja3MsIGxheW91dC5jb2x1bW5zKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5ncmlkPy5kZXN0cm95KCk7XG4gICAgdGhpcy50b29sYmFyPy5kZXN0cm95KCk7XG4gIH1cblxuICAvKiogUmUtcmVuZGVyIHRoZSB2aWV3IGZyb20gc2NyYXRjaCAoZS5nLiBhZnRlciBzZXR0aW5ncyByZXNldCkuICovXG4gIGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLm9uT3BlbigpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQmxvY2tGYWN0b3J5LCBCbG9ja1R5cGUgfSBmcm9tICcuL3R5cGVzJztcblxuY2xhc3MgQmxvY2tSZWdpc3RyeUNsYXNzIHtcbiAgcHJpdmF0ZSBmYWN0b3JpZXMgPSBuZXcgTWFwPEJsb2NrVHlwZSwgQmxvY2tGYWN0b3J5PigpO1xuXG4gIHJlZ2lzdGVyKGZhY3Rvcnk6IEJsb2NrRmFjdG9yeSk6IHZvaWQge1xuICAgIHRoaXMuZmFjdG9yaWVzLnNldChmYWN0b3J5LnR5cGUsIGZhY3RvcnkpO1xuICB9XG5cbiAgZ2V0KHR5cGU6IEJsb2NrVHlwZSk6IEJsb2NrRmFjdG9yeSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZmFjdG9yaWVzLmdldCh0eXBlKTtcbiAgfVxuXG4gIGdldEFsbCgpOiBCbG9ja0ZhY3RvcnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWN0b3JpZXMudmFsdWVzKCkpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5mYWN0b3JpZXMuY2xlYXIoKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgQmxvY2tSZWdpc3RyeSA9IG5ldyBCbG9ja1JlZ2lzdHJ5Q2xhc3MoKTtcbiIsICJpbXBvcnQgeyBBcHAgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBMYXlvdXRDb25maWcsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL2Jsb2Nrcy9CYXNlQmxvY2snO1xuXG50eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKGxheW91dDogTGF5b3V0Q29uZmlnKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByaXZhdGUgZ3JpZEVsOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBibG9ja3MgPSBuZXcgTWFwPHN0cmluZywgeyBibG9jazogQmFzZUJsb2NrOyB3cmFwcGVyOiBIVE1MRWxlbWVudCB9PigpO1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG4gIC8qKiBBYm9ydENvbnRyb2xsZXIgZm9yIHRoZSBjdXJyZW50bHkgYWN0aXZlIGRyYWcgb3IgcmVzaXplIG9wZXJhdGlvbi4gKi9cbiAgcHJpdmF0ZSBhY3RpdmVBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAvKiogRHJhZyBjbG9uZSBhcHBlbmRlZCB0byBkb2N1bWVudC5ib2R5OyB0cmFja2VkIHNvIHdlIGNhbiByZW1vdmUgaXQgb24gZWFybHkgdGVhcmRvd24uICovXG4gIHByaXZhdGUgYWN0aXZlQ2xvbmU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIG9uTGF5b3V0Q2hhbmdlOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayxcbiAgKSB7XG4gICAgdGhpcy5ncmlkRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6ICdob21lcGFnZS1ncmlkJyB9KTtcbiAgfVxuXG4gIHJlbmRlcihibG9ja3M6IEJsb2NrSW5zdGFuY2VbXSwgY29sdW1uczogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5kZXN0cm95QWxsKCk7XG4gICAgdGhpcy5ncmlkRWwuZW1wdHkoKTtcbiAgICB0aGlzLmdyaWRFbC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gYHJlcGVhdCgke2NvbHVtbnN9LCAxZnIpYDtcbiAgICBpZiAodGhpcy5lZGl0TW9kZSkgdGhpcy5ncmlkRWwuYWRkQ2xhc3MoJ2VkaXQtbW9kZScpO1xuXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBibG9ja3MpIHtcbiAgICAgIHRoaXMucmVuZGVyQmxvY2soaW5zdGFuY2UpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQmxvY2soaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICBjb25zdCBmYWN0b3J5ID0gQmxvY2tSZWdpc3RyeS5nZXQoaW5zdGFuY2UudHlwZSk7XG4gICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtYmxvY2std3JhcHBlcicgfSk7XG4gICAgd3JhcHBlci5kYXRhc2V0LmJsb2NrSWQgPSBpbnN0YW5jZS5pZDtcbiAgICB0aGlzLmFwcGx5R3JpZFBvc2l0aW9uKHdyYXBwZXIsIGluc3RhbmNlKTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmF0dGFjaEVkaXRIYW5kbGVzKHdyYXBwZXIsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogJ2Jsb2NrLWNvbnRlbnQnIH0pO1xuICAgIGNvbnN0IGJsb2NrID0gZmFjdG9yeS5jcmVhdGUodGhpcy5hcHAsIGluc3RhbmNlLCB0aGlzLnBsdWdpbik7XG4gICAgYmxvY2subG9hZCgpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGJsb2NrLnJlbmRlcihjb250ZW50RWwpO1xuICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXN1bHQuY2F0Y2goZSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtIb21lcGFnZSBCbG9ja3NdIEVycm9yIHJlbmRlcmluZyBibG9jayAke2luc3RhbmNlLnR5cGV9OmAsIGUpO1xuICAgICAgICBjb250ZW50RWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGJsb2NrLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5ibG9ja3Muc2V0KGluc3RhbmNlLmlkLCB7IGJsb2NrLCB3cmFwcGVyIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseUdyaWRQb3NpdGlvbih3cmFwcGVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IEJsb2NrSW5zdGFuY2UpOiB2b2lkIHtcbiAgICB3cmFwcGVyLnN0eWxlLmdyaWRDb2x1bW4gPSBgJHtpbnN0YW5jZS5jb2x9IC8gc3BhbiAke2luc3RhbmNlLmNvbFNwYW59YDtcbiAgICB3cmFwcGVyLnN0eWxlLmdyaWRSb3cgPSBgJHtpbnN0YW5jZS5yb3d9IC8gc3BhbiAke2luc3RhbmNlLnJvd1NwYW59YDtcbiAgfVxuXG4gIHByaXZhdGUgYXR0YWNoRWRpdEhhbmRsZXMod3JhcHBlcjogSFRNTEVsZW1lbnQsIGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oYW5kbGUtYmFyJyB9KTtcblxuICAgIGNvbnN0IGhhbmRsZSA9IGJhci5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1tb3ZlLWhhbmRsZScgfSk7XG4gICAgaGFuZGxlLnNldFRleHQoJ1x1MjgzRicpO1xuXG4gICAgY29uc3Qgc2V0dGluZ3NCdG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnYmxvY2stc2V0dGluZ3MtYnRuJywgdGV4dDogJ1x1MjY5OScgfSk7XG4gICAgc2V0dGluZ3NCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ibG9ja3MuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZW50cnkpIHJldHVybjtcbiAgICAgIGVudHJ5LmJsb2NrLm9wZW5TZXR0aW5ncygoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IGluc3RhbmNlIDogYixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ2Jsb2NrLXJlbW92ZS1idG4nLCB0ZXh0OiAnXHUwMEQ3JyB9KTtcbiAgICByZW1vdmVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MuZmlsdGVyKGIgPT4gYi5pZCAhPT0gaW5zdGFuY2UuaWQpO1xuICAgICAgdGhpcy5vbkxheW91dENoYW5nZSh7IC4uLnRoaXMucGx1Z2luLmxheW91dCwgYmxvY2tzOiBuZXdCbG9ja3MgfSk7XG4gICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICAvLyBSZXNpemUgZ3JpcCAoYWJzb2x1dGUgcG9zaXRpb25lZCB2aWEgQ1NTLCBib3R0b20tcmlnaHQpXG4gICAgY29uc3QgZ3JpcCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAnYmxvY2stcmVzaXplLWdyaXAnLCB0ZXh0OiAnXHUyMkJGJyB9KTtcbiAgICB0aGlzLmF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcCwgd3JhcHBlciwgaW5zdGFuY2UpO1xuXG4gICAgLy8gRHJhZyBoYW5kbGVyIG9uIHRoZSBicmFpbGxlIGhhbmRsZVxuICAgIHRoaXMuYXR0YWNoRHJhZ0hhbmRsZXIoaGFuZGxlLCB3cmFwcGVyLCBpbnN0YW5jZSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaERyYWdIYW5kbGVyKGhhbmRsZTogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAvLyBDYW5jZWwgYW55IHByZXZpb3VzIG9wZXJhdGlvblxuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICBjb25zdCBhYyA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIHRoaXMuYWN0aXZlQWJvcnRDb250cm9sbGVyID0gYWM7XG5cbiAgICAgIGNvbnN0IGNsb25lID0gd3JhcHBlci5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBjbG9uZS5hZGRDbGFzcygnYmxvY2stZHJhZy1jbG9uZScpO1xuICAgICAgY2xvbmUuc3R5bGUud2lkdGggPSBgJHt3cmFwcGVyLm9mZnNldFdpZHRofXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmhlaWdodCA9IGAke3dyYXBwZXIub2Zmc2V0SGVpZ2h0fXB4YDtcbiAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHtlLmNsaWVudFggLSAyMH1weGA7XG4gICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHtlLmNsaWVudFkgLSAyMH1weGA7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBjbG9uZTtcblxuICAgICAgY29uc3Qgc291cmNlSWQgPSBpbnN0YW5jZS5pZDtcbiAgICAgIHdyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyYWdnaW5nJyk7XG5cbiAgICAgIGNvbnN0IG9uTW91c2VNb3ZlID0gKG1lOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGNsb25lLnN0eWxlLmxlZnQgPSBgJHttZS5jbGllbnRYIC0gMjB9cHhgO1xuICAgICAgICBjbG9uZS5zdHlsZS50b3AgPSBgJHttZS5jbGllbnRZIC0gMjB9cHhgO1xuXG4gICAgICAgIHRoaXMuZ3JpZEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5ob21lcGFnZS1ibG9jay13cmFwcGVyJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5yZW1vdmVDbGFzcygnYmxvY2stZHJvcC10YXJnZXQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLmdldCh0YXJnZXRJZCk/LndyYXBwZXIuYWRkQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IG9uTW91c2VVcCA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAvLyBBYm9ydGluZyB0aGUgY29udHJvbGxlciByZW1vdmVzIGJvdGggbGlzdGVuZXJzIGF1dG9tYXRpY2FsbHlcbiAgICAgICAgYWMuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgICAgIGNsb25lLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUNsb25lID0gbnVsbDtcbiAgICAgICAgd3JhcHBlci5yZW1vdmVDbGFzcygnYmxvY2stZHJhZ2dpbmcnKTtcblxuICAgICAgICB0aGlzLmdyaWRFbC5xdWVyeVNlbGVjdG9yQWxsKCcuaG9tZXBhZ2UtYmxvY2std3JhcHBlcicpLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkucmVtb3ZlQ2xhc3MoJ2Jsb2NrLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldElkID0gdGhpcy5maW5kQmxvY2tVbmRlckN1cnNvcihtZS5jbGllbnRYLCBtZS5jbGllbnRZLCBzb3VyY2VJZCk7XG4gICAgICAgIGlmICh0YXJnZXRJZCkge1xuICAgICAgICAgIHRoaXMuc3dhcEJsb2Nrcyhzb3VyY2VJZCwgdGFyZ2V0SWQpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGF0dGFjaFJlc2l6ZUhhbmRsZXIoZ3JpcDogSFRNTEVsZW1lbnQsIHdyYXBwZXI6IEhUTUxFbGVtZW50LCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSk6IHZvaWQge1xuICAgIGdyaXAuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIC8vIENhbmNlbCBhbnkgcHJldmlvdXMgb3BlcmF0aW9uXG4gICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcbiAgICAgIGNvbnN0IGFjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBhYztcblxuICAgICAgY29uc3Qgc3RhcnRYID0gZS5jbGllbnRYO1xuICAgICAgY29uc3Qgc3RhcnRDb2xTcGFuID0gaW5zdGFuY2UuY29sU3BhbjtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucztcbiAgICAgIGNvbnN0IGNvbFdpZHRoID0gdGhpcy5ncmlkRWwub2Zmc2V0V2lkdGggLyBjb2x1bW5zO1xuICAgICAgbGV0IGN1cnJlbnRDb2xTcGFuID0gc3RhcnRDb2xTcGFuO1xuXG4gICAgICBjb25zdCBvbk1vdXNlTW92ZSA9IChtZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVggPSBtZS5jbGllbnRYIC0gc3RhcnRYO1xuICAgICAgICBjb25zdCBkZWx0YUNvbHMgPSBNYXRoLnJvdW5kKGRlbHRhWCAvIGNvbFdpZHRoKTtcbiAgICAgICAgY29uc3QgbWF4ID0gY29sdW1ucyAtIGluc3RhbmNlLmNvbCArIDE7XG4gICAgICAgIGN1cnJlbnRDb2xTcGFuID0gTWF0aC5tYXgoMSwgTWF0aC5taW4obWF4LCBzdGFydENvbFNwYW4gKyBkZWx0YUNvbHMpKTtcbiAgICAgICAgLy8gVmlzdWFsIGZlZWRiYWNrIG9ubHkgXHUyMDE0IGluc3RhbmNlIGlzIG5vdCBtdXRhdGVkIHVudGlsIG1vdXNldXBcbiAgICAgICAgd3JhcHBlci5zdHlsZS5ncmlkQ29sdW1uID0gYCR7aW5zdGFuY2UuY29sfSAvIHNwYW4gJHtjdXJyZW50Q29sU3Bhbn1gO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgb25Nb3VzZVVwID0gKCkgPT4ge1xuICAgICAgICBhYy5hYm9ydCgpO1xuICAgICAgICB0aGlzLmFjdGl2ZUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cbiAgICAgICAgLy8gQ29tbWl0IHZpYSBpbW11dGFibGUgdXBkYXRlXG4gICAgICAgIGNvbnN0IG5ld0Jsb2NrcyA9IHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MubWFwKGIgPT5cbiAgICAgICAgICBiLmlkID09PSBpbnN0YW5jZS5pZCA/IHsgLi4uYiwgY29sU3BhbjogY3VycmVudENvbFNwYW4gfSA6IGIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMub25MYXlvdXRDaGFuZ2UoeyAuLi50aGlzLnBsdWdpbi5sYXlvdXQsIGJsb2NrczogbmV3QmxvY2tzIH0pO1xuICAgICAgICB0aGlzLnJlcmVuZGVyKCk7XG4gICAgICB9O1xuXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSwgeyBzaWduYWw6IGFjLnNpZ25hbCB9KTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXAsIHsgc2lnbmFsOiBhYy5zaWduYWwgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGZpbmRCbG9ja1VuZGVyQ3Vyc29yKHg6IG51bWJlciwgeTogbnVtYmVyLCBleGNsdWRlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGZvciAoY29uc3QgW2lkLCB7IHdyYXBwZXIgfV0gb2YgdGhpcy5ibG9ja3MpIHtcbiAgICAgIGlmIChpZCA9PT0gZXhjbHVkZUlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY3QgPSB3cmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHggPj0gcmVjdC5sZWZ0ICYmIHggPD0gcmVjdC5yaWdodCAmJiB5ID49IHJlY3QudG9wICYmIHkgPD0gcmVjdC5ib3R0b20pIHtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBTd2FwIHBvc2l0aW9ucyBvZiB0d28gYmxvY2tzIHVzaW5nIGltbXV0YWJsZSB1cGRhdGVzLiAqL1xuICBwcml2YXRlIHN3YXBCbG9ja3MoaWRBOiBzdHJpbmcsIGlkQjogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYkEgPSB0aGlzLnBsdWdpbi5sYXlvdXQuYmxvY2tzLmZpbmQoYiA9PiBiLmlkID09PSBpZEEpO1xuICAgIGNvbnN0IGJCID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5maW5kKGIgPT4gYi5pZCA9PT0gaWRCKTtcbiAgICBpZiAoIWJBIHx8ICFiQikgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3QmxvY2tzID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5tYXAoYiA9PiB7XG4gICAgICBpZiAoYi5pZCA9PT0gaWRBKSByZXR1cm4geyAuLi5iLCBjb2w6IGJCLmNvbCwgcm93OiBiQi5yb3csIGNvbFNwYW46IGJCLmNvbFNwYW4sIHJvd1NwYW46IGJCLnJvd1NwYW4gfTtcbiAgICAgIGlmIChiLmlkID09PSBpZEIpIHJldHVybiB7IC4uLmIsIGNvbDogYkEuY29sLCByb3c6IGJBLnJvdywgY29sU3BhbjogYkEuY29sU3Bhbiwgcm93U3BhbjogYkEucm93U3BhbiB9O1xuICAgICAgcmV0dXJuIGI7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0TW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5lZGl0TW9kZSA9IGVuYWJsZWQ7XG4gICAgdGhpcy5yZXJlbmRlcigpO1xuICB9XG5cbiAgc2V0Q29sdW1ucyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBjb2x1bW5zOiBuIH0pO1xuICAgIHRoaXMucmVyZW5kZXIoKTtcbiAgfVxuXG4gIGFkZEJsb2NrKGluc3RhbmNlOiBCbG9ja0luc3RhbmNlKTogdm9pZCB7XG4gICAgY29uc3QgbmV3QmxvY2tzID0gWy4uLnRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIGluc3RhbmNlXTtcbiAgICB0aGlzLm9uTGF5b3V0Q2hhbmdlKHsgLi4udGhpcy5wbHVnaW4ubGF5b3V0LCBibG9ja3M6IG5ld0Jsb2NrcyB9KTtcbiAgICB0aGlzLnJlcmVuZGVyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlcmVuZGVyKCk6IHZvaWQge1xuICAgIHRoaXMucmVuZGVyKHRoaXMucGx1Z2luLmxheW91dC5ibG9ja3MsIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKTtcbiAgfVxuXG4gIC8qKiBVbmxvYWQgYWxsIGJsb2NrcyBhbmQgY2FuY2VsIGFueSBpbi1wcm9ncmVzcyBkcmFnL3Jlc2l6ZS4gKi9cbiAgZGVzdHJveUFsbCgpOiB2b2lkIHtcbiAgICAvLyBBYm9ydCBhbnkgaW4tcHJvZ3Jlc3MgZHJhZy9yZXNpemUgYW5kIGNsZWFuIHVwIG9ycGhhbmVkIGNsb25lXG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgdGhpcy5hY3RpdmVBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmU/LnJlbW92ZSgpO1xuICAgIHRoaXMuYWN0aXZlQ2xvbmUgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCB7IGJsb2NrIH0gb2YgdGhpcy5ibG9ja3MudmFsdWVzKCkpIHtcbiAgICAgIGJsb2NrLnVubG9hZCgpO1xuICAgIH1cbiAgICB0aGlzLmJsb2Nrcy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEZ1bGwgdGVhcmRvd246IHVubG9hZCBibG9ja3MgYW5kIHJlbW92ZSB0aGUgZ3JpZCBlbGVtZW50IGZyb20gdGhlIERPTS4gKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLmRlc3Ryb3lBbGwoKTtcbiAgICB0aGlzLmdyaWRFbC5yZW1vdmUoKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBCbG9ja1R5cGUsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQmxvY2tSZWdpc3RyeSB9IGZyb20gJy4vQmxvY2tSZWdpc3RyeSc7XG5pbXBvcnQgeyBHcmlkTGF5b3V0IH0gZnJvbSAnLi9HcmlkTGF5b3V0JztcblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sYmFyIHtcbiAgcHJpdmF0ZSB0b29sYmFyRWw6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVkaXRNb2RlID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuICAgIHByaXZhdGUgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBwbHVnaW46IElIb21lcGFnZVBsdWdpbixcbiAgICBwcml2YXRlIGdyaWQ6IEdyaWRMYXlvdXQsXG4gICAgcHJpdmF0ZSBvbkNvbHVtbnNDaGFuZ2U6IChuOiBudW1iZXIpID0+IHZvaWQsXG4gICkge1xuICAgIHRoaXMudG9vbGJhckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiAnaG9tZXBhZ2UtdG9vbGJhcicgfSk7XG4gICAgdGhpcy5yZW5kZXJUb29sYmFyKCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRvb2xiYXIoKTogdm9pZCB7XG4gICAgdGhpcy50b29sYmFyRWwuZW1wdHkoKTtcblxuICAgIC8vIENvbHVtbiBjb3VudCBzZWxlY3RvclxuICAgIGNvbnN0IGNvbFNlbGVjdCA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdzZWxlY3QnLCB7IGNsczogJ3Rvb2xiYXItY29sLXNlbGVjdCcgfSk7XG4gICAgWzIsIDMsIDRdLmZvckVhY2gobiA9PiB7XG4gICAgICBjb25zdCBvcHQgPSBjb2xTZWxlY3QuY3JlYXRlRWwoJ29wdGlvbicsIHsgdmFsdWU6IFN0cmluZyhuKSwgdGV4dDogYCR7bn0gY29sYCB9KTtcbiAgICAgIGlmIChuID09PSB0aGlzLnBsdWdpbi5sYXlvdXQuY29sdW1ucykgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb2xTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgdGhpcy5vbkNvbHVtbnNDaGFuZ2UoTnVtYmVyKGNvbFNlbGVjdC52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gRWRpdCB0b2dnbGVcbiAgICBjb25zdCBlZGl0QnRuID0gdGhpcy50b29sYmFyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAndG9vbGJhci1lZGl0LWJ0bicgfSk7XG4gICAgdGhpcy51cGRhdGVFZGl0QnRuKGVkaXRCdG4pO1xuICAgIGVkaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICB0aGlzLmVkaXRNb2RlID0gIXRoaXMuZWRpdE1vZGU7XG4gICAgICB0aGlzLmdyaWQuc2V0RWRpdE1vZGUodGhpcy5lZGl0TW9kZSk7XG4gICAgICB0aGlzLnVwZGF0ZUVkaXRCdG4oZWRpdEJ0bik7XG4gICAgICB0aGlzLnN5bmNBZGRCdXR0b24oKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmVkaXRNb2RlKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRWRpdEJ0bihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gdGhpcy5lZGl0TW9kZSA/ICdcdTI3MTMgRG9uZScgOiAnXHUyNzBGIEVkaXQnO1xuICAgIGJ0bi50b2dnbGVDbGFzcygndG9vbGJhci1idG4tYWN0aXZlJywgdGhpcy5lZGl0TW9kZSk7XG4gIH1cblxuICBwcml2YXRlIHN5bmNBZGRCdXR0b24oKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRvb2xiYXJFbC5xdWVyeVNlbGVjdG9yKCcudG9vbGJhci1hZGQtYnRuJyk7XG4gICAgaWYgKHRoaXMuZWRpdE1vZGUgJiYgIWV4aXN0aW5nKSB7XG4gICAgICB0aGlzLmFwcGVuZEFkZEJ1dHRvbigpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZWRpdE1vZGUgJiYgZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kQWRkQnV0dG9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGFkZEJ0biA9IHRoaXMudG9vbGJhckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3Rvb2xiYXItYWRkLWJ0bicsIHRleHQ6ICcrIEFkZCBCbG9jaycgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbmV3IEFkZEJsb2NrTW9kYWwodGhpcy5hcHAsICh0eXBlKSA9PiB7XG4gICAgICAgIGNvbnN0IGZhY3RvcnkgPSBCbG9ja1JlZ2lzdHJ5LmdldCh0eXBlKTtcbiAgICAgICAgaWYgKCFmYWN0b3J5KSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWF4Um93ID0gdGhpcy5wbHVnaW4ubGF5b3V0LmJsb2Nrcy5yZWR1Y2UoXG4gICAgICAgICAgKG1heCwgYikgPT4gTWF0aC5tYXgobWF4LCBiLnJvdyArIGIucm93U3BhbiAtIDEpLCAwLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlOiBCbG9ja0luc3RhbmNlID0ge1xuICAgICAgICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIHJvdzogbWF4Um93ICsgMSxcbiAgICAgICAgICBjb2xTcGFuOiBNYXRoLm1pbihmYWN0b3J5LmRlZmF1bHRTaXplLmNvbFNwYW4sIHRoaXMucGx1Z2luLmxheW91dC5jb2x1bW5zKSxcbiAgICAgICAgICByb3dTcGFuOiBmYWN0b3J5LmRlZmF1bHRTaXplLnJvd1NwYW4sXG4gICAgICAgICAgY29uZmlnOiB7IC4uLmZhY3RvcnkuZGVmYXVsdENvbmZpZyB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ3JpZC5hZGRCbG9jayhpbnN0YW5jZSk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMudG9vbGJhckVsLnJlbW92ZSgpO1xuICB9XG59XG5cbmNsYXNzIEFkZEJsb2NrTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgb25TZWxlY3Q6ICh0eXBlOiBCbG9ja1R5cGUpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0FkZCBCbG9jaycgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGZhY3Rvcnkgb2YgQmxvY2tSZWdpc3RyeS5nZXRBbGwoKSkge1xuICAgICAgY29uc3QgYnRuID0gY29udGVudEVsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG4gICAgICAgIGNsczogJ2FkZC1ibG9jay1vcHRpb24nLFxuICAgICAgICB0ZXh0OiBmYWN0b3J5LmRpc3BsYXlOYW1lLFxuICAgICAgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMub25TZWxlY3QoZmFjdG9yeS50eXBlKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcsIG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIEdyZWV0aW5nQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIHRpbWVFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBuYW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdncmVldGluZy1ibG9jaycpO1xuXG4gICAgY29uc3QgeyBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgc2hvd1RpbWU/OiBib29sZWFuIH07XG5cbiAgICBpZiAoc2hvd1RpbWUpIHtcbiAgICAgIHRoaXMudGltZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctdGltZScgfSk7XG4gICAgfVxuICAgIHRoaXMubmFtZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnZ3JlZXRpbmctbmFtZScgfSk7XG5cbiAgICB0aGlzLnRpY2soKTtcbiAgICB0aGlzLnJlZ2lzdGVySW50ZXJ2YWwod2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAxMDAwKSk7XG4gIH1cblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gbW9tZW50KCk7XG4gICAgY29uc3QgaG91ciA9IG5vdy5ob3VyKCk7XG4gICAgY29uc3QgeyBuYW1lID0gJ2JlbnRvcm5hdG8nLCBzaG93VGltZSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgICBzaG93VGltZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGNvbnN0IHNhbHV0YXRpb24gPVxuICAgICAgaG91ciA+PSA1ICYmIGhvdXIgPCAxMiA/ICdCdW9uZ2lvcm5vJyA6XG4gICAgICBob3VyID49IDEyICYmIGhvdXIgPCAxOCA/ICdCdW9uIHBvbWVyaWdnaW8nIDpcbiAgICAgICdCdW9uYXNlcmEnO1xuXG4gICAgaWYgKHRoaXMudGltZUVsICYmIHNob3dUaW1lKSB7XG4gICAgICB0aGlzLnRpbWVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ0hIOm1tJykpO1xuICAgIH1cbiAgICBpZiAodGhpcy5uYW1lRWwpIHtcbiAgICAgIHRoaXMubmFtZUVsLnNldFRleHQoYCR7c2FsdXRhdGlvbn0sICR7bmFtZX1gKTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEdyZWV0aW5nU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChuZXdDb25maWcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEdyZWV0aW5nU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnR3JlZXRpbmcgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdOYW1lJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKHRoaXMuY29uZmlnLm5hbWUgYXMgc3RyaW5nID8/ICdiZW50b3JuYXRvJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLm5hbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aW1lJykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcuc2hvd1RpbWUgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcuc2hvd1RpbWUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUodGhpcy5jb25maWcpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUJsb2NrIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFwcDogQXBwLFxuICAgIHByb3RlY3RlZCBpbnN0YW5jZTogQmxvY2tJbnN0YW5jZSxcbiAgICBwcm90ZWN0ZWQgcGx1Z2luOiBJSG9tZXBhZ2VQbHVnaW4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBhYnN0cmFjdCByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbiAgLy8gT3ZlcnJpZGUgdG8gb3BlbiBhIHBlci1ibG9jayBzZXR0aW5ncyBtb2RhbFxuICBvcGVuU2V0dGluZ3MoX29uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge31cblxuICAvLyBSZW5kZXIgdGhlIG11dGVkIHVwcGVyY2FzZSBibG9jayBoZWFkZXIgbGFiZWwgaWYgdGl0bGUgaXMgbm9uLWVtcHR5XG4gIHByb3RlY3RlZCByZW5kZXJIZWFkZXIoZWw6IEhUTUxFbGVtZW50LCB0aXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICBlbC5jcmVhdGVEaXYoeyBjbHM6ICdibG9jay1oZWFkZXInLCB0ZXh0OiB0aXRsZSB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBDbG9ja0Jsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcHJpdmF0ZSB0aW1lRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZGF0ZUVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygnY2xvY2stYmxvY2snKTtcblxuICAgIGNvbnN0IHsgc2hvd0RhdGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7IHNob3dEYXRlPzogYm9vbGVhbiB9O1xuXG4gICAgdGhpcy50aW1lRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdjbG9jay10aW1lJyB9KTtcbiAgICBpZiAoc2hvd0RhdGUpIHtcbiAgICAgIHRoaXMuZGF0ZUVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnY2xvY2stZGF0ZScgfSk7XG4gICAgfVxuXG4gICAgdGhpcy50aWNrKCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMTAwMCkpO1xuICB9XG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IG1vbWVudCgpO1xuICAgIGNvbnN0IHsgc2hvd1NlY29uZHMgPSBmYWxzZSwgc2hvd0RhdGUgPSB0cnVlLCBmb3JtYXQgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgc2hvd1NlY29uZHM/OiBib29sZWFuO1xuICAgICAgc2hvd0RhdGU/OiBib29sZWFuO1xuICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy50aW1lRWwpIHtcbiAgICAgIGlmIChmb3JtYXQpIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KGZvcm1hdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50aW1lRWwuc2V0VGV4dChub3cuZm9ybWF0KHNob3dTZWNvbmRzID8gJ0hIOm1tOnNzJyA6ICdISDptbScpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0ZUVsICYmIHNob3dEYXRlKSB7XG4gICAgICB0aGlzLmRhdGVFbC5zZXRUZXh0KG5vdy5mb3JtYXQoJ2RkZGQsIEQgTU1NTSBZWVlZJykpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgQ2xvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKG5ld0NvbmZpZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgQ2xvY2tTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdDbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ1Nob3cgc2Vjb25kcycpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKHRoaXMuY29uZmlnLnNob3dTZWNvbmRzIGFzIGJvb2xlYW4gPz8gZmFsc2UpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy5zaG93U2Vjb25kcyA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGRhdGUnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy5zaG93RGF0ZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy5zaG93RGF0ZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoJ0N1c3RvbSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ09wdGlvbmFsIG1vbWVudC5qcyBmb3JtYXQgc3RyaW5nLCBlLmcuIFwiSEg6bW1cIi4gTGVhdmUgZW1wdHkgZm9yIGRlZmF1bHQuJylcbiAgICAgIC5hZGRUZXh0KHQgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy5mb3JtYXQgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy5mb3JtYXQgPSB2OyB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZSh0aGlzLmNvbmZpZyk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEJsb2NrSW5zdGFuY2UsIElIb21lcGFnZVBsdWdpbiB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuaW50ZXJmYWNlIExpbmtJdGVtIHtcbiAgbGFiZWw6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBlbW9qaT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEZvbGRlckxpbmtzQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2ZvbGRlci1saW5rcy1ibG9jaycpO1xuICAgIHRoaXMucmVuZGVyQ29udGVudCgpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDb250ZW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5jb250YWluZXJFbDtcbiAgICBpZiAoIWVsKSByZXR1cm47XG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGNvbnN0IHsgdGl0bGUgPSAnTGlua3MnLCBsaW5rcyA9IFtdIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGxpbmtzPzogTGlua0l0ZW1bXTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGlua3MtbGlzdCcgfSk7XG4gICAgZm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVEaXYoeyBjbHM6ICdmb2xkZXItbGluay1pdGVtJyB9KTtcbiAgICAgIGNvbnN0IGJ0biA9IGl0ZW0uY3JlYXRlRWwoJ2J1dHRvbicsIHsgY2xzOiAnZm9sZGVyLWxpbmstYnRuJyB9KTtcbiAgICAgIGlmIChsaW5rLmVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAnbGluay1lbW9qaScsIHRleHQ6IGxpbmsuZW1vamkgfSk7XG4gICAgICB9XG4gICAgICBidG4uY3JlYXRlU3Bhbih7IHRleHQ6IGxpbmsubGFiZWwgfSk7XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobGluay5wYXRoLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbChcbiAgICAgIHRoaXMuYXBwLFxuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgYXMgeyB0aXRsZT86IHN0cmluZzsgbGlua3M/OiBMaW5rSXRlbVtdIH0sXG4gICAgICAobmV3Q29uZmlnKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gbmV3Q29uZmlnIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgICB0aGlzLnJlbmRlckNvbnRlbnQoKTtcbiAgICAgICAgb25TYXZlKCk7XG4gICAgICB9LFxuICAgICkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEZvbGRlckxpbmtzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IHsgdGl0bGU/OiBzdHJpbmc7IGxpbmtzPzogTGlua0l0ZW1bXSB9LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY29uZmlnOiB7IHRpdGxlPzogc3RyaW5nOyBsaW5rcz86IExpbmtJdGVtW10gfSkgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnRm9sZGVyIExpbmtzIFNldHRpbmdzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQmxvY2sgdGl0bGUnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcudGl0bGUgPz8gJ0xpbmtzJylcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLnRpdGxlID0gdjsgfSksXG4gICAgKTtcblxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdMaW5rcycgfSk7XG5cbiAgICBjb25zdCBsaW5rczogTGlua0l0ZW1bXSA9ICh0aGlzLmNvbmZpZy5saW5rcyA/PyBbXSkubWFwKGwgPT4gKHsgLi4ubCB9KSk7XG4gICAgY29uc3QgbGlua3NDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG5cbiAgICBjb25zdCByZW5kZXJMaW5rcyA9ICgpID0+IHtcbiAgICAgIGxpbmtzQ29udGFpbmVyLmVtcHR5KCk7XG4gICAgICBsaW5rcy5mb3JFYWNoKChsaW5rLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGxpbmtzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3NldHRpbmdzLWxpbmstcm93JyB9KTtcbiAgICAgICAgbmV3IFNldHRpbmcocm93KVxuICAgICAgICAgIC5zZXROYW1lKGBMaW5rICR7aSArIDF9YClcbiAgICAgICAgICAuYWRkVGV4dCh0ID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xhYmVsJykuc2V0VmFsdWUobGluay5sYWJlbCkub25DaGFuZ2UodiA9PiB7IGxpbmtzW2ldLmxhYmVsID0gdjsgfSkpXG4gICAgICAgICAgLmFkZFRleHQodCA9PiB0LnNldFBsYWNlaG9sZGVyKCdQYXRoJykuc2V0VmFsdWUobGluay5wYXRoKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0ucGF0aCA9IHY7IH0pKVxuICAgICAgICAgIC5hZGRUZXh0KHQgPT4gdC5zZXRQbGFjZWhvbGRlcignRW1vamknKS5zZXRWYWx1ZShsaW5rLmVtb2ppID8/ICcnKS5vbkNoYW5nZSh2ID0+IHsgbGlua3NbaV0uZW1vamkgPSB2IHx8IHVuZGVmaW5lZDsgfSkpXG4gICAgICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEljb24oJ3RyYXNoJykuc2V0VG9vbHRpcCgnUmVtb3ZlJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBsaW5rcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICByZW5kZXJMaW5rcygpO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyTGlua3MoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oYnRuID0+IGJ0bi5zZXRCdXR0b25UZXh0KCdBZGQgTGluaycpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICBsaW5rcy5wdXNoKHsgbGFiZWw6ICcnLCBwYXRoOiAnJyB9KTtcbiAgICAgICAgcmVuZGVyTGlua3MoKTtcbiAgICAgIH0pKVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT4gYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5jb25maWcubGlua3MgPSBsaW5rcztcbiAgICAgICAgdGhpcy5vblNhdmUodGhpcy5jb25maWcpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgTW9kYWwsIFNldHRpbmcsIFRGaWxlLCBtb21lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuY29uc3QgTVNfUEVSX0RBWSA9IDg2XzQwMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBJbnNpZ2h0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ2luc2lnaHQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGluc2lnaHQuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0YWcgPSAnJywgdGl0bGUgPSAnRGFpbHkgSW5zaWdodCcsIGRhaWx5U2VlZCA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGFpbHlTZWVkPzogYm9vbGVhbjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGNhcmQgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbnNpZ2h0LWNhcmQnIH0pO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNhcmQuc2V0VGV4dCgnQ29uZmlndXJlIGEgdGFnIGluIGJsb2NrIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ1NlYXJjaCA9IHRhZy5zdGFydHNXaXRoKCcjJykgPyB0YWcgOiBgIyR7dGFnfWA7XG4gICAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1dpdGhUYWcodGhpcy5hcHAsIHRhZ1NlYXJjaCk7XG5cbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYXJkLnNldFRleHQoYE5vIGZpbGVzIGZvdW5kIHdpdGggdGFnICR7dGFnU2VhcmNofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFVzZSBsb2NhbCBtaWRuaWdodCBhcyB0aGUgZGF5IGluZGV4IHNvIGl0IGNoYW5nZXMgYXQgbG9jYWwgbWlkbmlnaHQsIG5vdCBVVENcbiAgICBjb25zdCBkYXlJbmRleCA9IE1hdGguZmxvb3IobW9tZW50KCkuc3RhcnRPZignZGF5JykudmFsdWVPZigpIC8gTVNfUEVSX0RBWSk7XG4gICAgY29uc3QgaW5kZXggPSBkYWlseVNlZWRcbiAgICAgID8gZGF5SW5kZXggJSBmaWxlcy5sZW5ndGhcbiAgICAgIDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHsgaGVhZGluZywgYm9keSB9ID0gdGhpcy5wYXJzZUNvbnRlbnQoY29udGVudCwgY2FjaGUpO1xuXG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtdGl0bGUnLCB0ZXh0OiBoZWFkaW5nIHx8IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogJ2luc2lnaHQtYm9keScsIHRleHQ6IGJvZHkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gSW5zaWdodEJsb2NrIGZhaWxlZCB0byByZWFkIGZpbGU6JywgZSk7XG4gICAgICBjYXJkLnNldFRleHQoJ0Vycm9yIHJlYWRpbmcgZmlsZS4nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgZmlyc3QgaGVhZGluZyBhbmQgZmlyc3QgcGFyYWdyYXBoIHVzaW5nIG1ldGFkYXRhQ2FjaGUgb2Zmc2V0cy5cbiAgICogRmFsbHMgYmFjayB0byBtYW51YWwgcGFyc2luZyBvbmx5IGlmIGNhY2hlIGlzIHVuYXZhaWxhYmxlLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogeyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9IHtcbiAgICAvLyBVc2UgY2FjaGVkIGhlYWRpbmcgaWYgYXZhaWxhYmxlIChhdm9pZHMgbWFudWFsIHBhcnNpbmcpXG4gICAgY29uc3QgaGVhZGluZyA9IGNhY2hlPy5oZWFkaW5ncz8uWzBdPy5oZWFkaW5nID8/ICcnO1xuXG4gICAgLy8gU2tpcCBmcm9udG1hdHRlciB1c2luZyB0aGUgY2FjaGVkIG9mZnNldFxuICAgIGNvbnN0IGZtRW5kID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZC5vZmZzZXQgPz8gMDtcbiAgICBjb25zdCBhZnRlckZtID0gY29udGVudC5zbGljZShmbUVuZCk7XG5cbiAgICAvLyBGaXJzdCBub24tZW1wdHksIG5vbi1oZWFkaW5nIGxpbmUgaXMgdGhlIGJvZHlcbiAgICBjb25zdCBib2R5ID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbmQobCA9PiBsICYmICFsLnN0YXJ0c1dpdGgoJyMnKSkgPz8gJyc7XG5cbiAgICByZXR1cm4geyBoZWFkaW5nLCBib2R5IH07XG4gIH1cblxuICBvcGVuU2V0dGluZ3Mob25TYXZlOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgbmV3IEluc2lnaHRTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSW5zaWdodFNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0luc2lnaHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50aXRsZSBhcyBzdHJpbmcgPz8gJ0RhaWx5IEluc2lnaHQnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0RhaWx5IHNlZWQnKS5zZXREZXNjKCdTaG93IHNhbWUgbm90ZSBhbGwgZGF5JykuYWRkVG9nZ2xlKHQgPT5cbiAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcuZGFpbHlTZWVkIGFzIGJvb2xlYW4gPz8gdHJ1ZSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLmRhaWx5U2VlZCA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZSh0aGlzLmNvbmZpZyk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiBSZXR1cm5zIGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHQgdGhhdCBoYXZlIHRoZSBnaXZlbiB0YWcuXG4gKiBgdGFnYCBtdXN0IGluY2x1ZGUgdGhlIGxlYWRpbmcgYCNgIChlLmcuIGAjdmFsdWVzYCkuXG4gKiBIYW5kbGVzIGJvdGggaW5saW5lIHRhZ3MgYW5kIFlBTUwgZnJvbnRtYXR0ZXIgdGFncyAod2l0aCBvciB3aXRob3V0IGAjYCksXG4gKiBhbmQgZnJvbnRtYXR0ZXIgdGFncyB0aGF0IGFyZSBhIHBsYWluIHN0cmluZyBpbnN0ZWFkIG9mIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmlsZXNXaXRoVGFnKGFwcDogQXBwLCB0YWc6IHN0cmluZyk6IFRGaWxlW10ge1xuICByZXR1cm4gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoZmlsZSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgaW5saW5lVGFncyA9IGNhY2hlLnRhZ3M/Lm1hcCh0ID0+IHQudGFnKSA/PyBbXTtcblxuICAgIGNvbnN0IHJhd0ZtVGFncyA9IGNhY2hlLmZyb250bWF0dGVyPy50YWdzO1xuICAgIGNvbnN0IGZtVGFnQXJyYXk6IHN0cmluZ1tdID1cbiAgICAgIEFycmF5LmlzQXJyYXkocmF3Rm1UYWdzKSA/IHJhd0ZtVGFncyA6XG4gICAgICB0eXBlb2YgcmF3Rm1UYWdzID09PSAnc3RyaW5nJyA/IFtyYXdGbVRhZ3NdIDpcbiAgICAgIFtdO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRGbVRhZ3MgPSBmbVRhZ0FycmF5Lm1hcCh0ID0+IHQuc3RhcnRzV2l0aCgnIycpID8gdCA6IGAjJHt0fWApO1xuXG4gICAgcmV0dXJuIGlubGluZVRhZ3MuaW5jbHVkZXModGFnKSB8fCBub3JtYWxpemVkRm1UYWdzLmluY2x1ZGVzKHRhZyk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IEFwcCwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuZXhwb3J0IGNsYXNzIFRhZ0dyaWRCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygndGFnLWdyaWQtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gVGFnR3JpZEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHRhZyBncmlkLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kUmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdGFnID0gJycsIHRpdGxlID0gJ05vdGVzJywgY29sdW1ucyA9IDIsIHNob3dFbW9qaSA9IHRydWUgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRhZz86IHN0cmluZztcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29sdW1ucz86IG51bWJlcjtcbiAgICAgIHNob3dFbW9qaT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBncmlkID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAndGFnLWdyaWQnIH0pO1xuICAgIGdyaWQuc3R5bGUuZ3JpZFRlbXBsYXRlQ29sdW1ucyA9IGByZXBlYXQoJHtjb2x1bW5zfSwgMWZyKWA7XG5cbiAgICBpZiAoIXRhZykge1xuICAgICAgZ3JpZC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKTtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgIGNvbnN0IGVtb2ppID0gc2hvd0Vtb2ppID8gKGNhY2hlPy5mcm9udG1hdHRlcj8uZW1vamkgYXMgc3RyaW5nID8/ICcnKSA6ICcnO1xuXG4gICAgICBjb25zdCBidG4gPSBncmlkLmNyZWF0ZUVsKCdidXR0b24nLCB7IGNsczogJ3RhZy1idG4nIH0pO1xuICAgICAgaWYgKGVtb2ppKSB7XG4gICAgICAgIGJ0bi5jcmVhdGVTcGFuKHsgY2xzOiAndGFnLWJ0bi1lbW9qaScsIHRleHQ6IGVtb2ppIH0pO1xuICAgICAgfVxuICAgICAgYnRuLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlLmJhc2VuYW1lIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBUYWdHcmlkU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIFRhZ0dyaWRTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIGNvbmZpZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgcHJpdmF0ZSBvblNhdmU6IChjZmc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdUYWcgR3JpZCBTZXR0aW5ncycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKHRoaXMuY29uZmlnLnRpdGxlIGFzIHN0cmluZyA/PyAnTm90ZXMnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnVGFnJykuc2V0RGVzYygnV2l0aG91dCAjIHByZWZpeCcpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50YWcgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGFnID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0NvbHVtbnMnKS5hZGREcm9wZG93bihkID0+XG4gICAgICBkLmFkZE9wdGlvbignMicsICcyJykuYWRkT3B0aW9uKCczJywgJzMnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcodGhpcy5jb25maWcuY29sdW1ucyA/PyAyKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdTaG93IGVtb2ppJykuc2V0RGVzYygnUmVhZCBcImVtb2ppXCIgZnJvbnRtYXR0ZXIgZmllbGQnKS5hZGRUb2dnbGUodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy5zaG93RW1vamkgYXMgYm9vbGVhbiA/PyB0cnVlKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcuc2hvd0Vtb2ppID0gdjsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKHRoaXMuY29uZmlnKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBNb2RhbCwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRGaWxlc1dpdGhUYWcgfSBmcm9tICcuLi91dGlscy90YWdzJztcbmltcG9ydCB7IEJhc2VCbG9jayB9IGZyb20gJy4vQmFzZUJsb2NrJztcblxuLy8gT25seSBhc3NpZ24gc2FmZSBDU1MgY29sb3IgdmFsdWVzOyByZWplY3QgcG90ZW50aWFsbHkgbWFsaWNpb3VzIHN0cmluZ3NcbmNvbnN0IENPTE9SX1JFID0gL14oI1swLTlhLWZBLUZdezMsOH18W2EtekEtWl0rfHJnYmE/XFwoW14pXStcXCl8aHNsYT9cXChbXildK1xcKSkkLztcblxuZXhwb3J0IGNsYXNzIFF1b3Rlc0xpc3RCbG9jayBleHRlbmRzIEJhc2VCbG9jayB7XG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5hZGRDbGFzcygncXVvdGVzLWxpc3QtYmxvY2snKTtcbiAgICB0aGlzLmxvYWRBbmRSZW5kZXIoZWwpLmNhdGNoKGUgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcignW0hvbWVwYWdlIEJsb2Nrc10gUXVvdGVzTGlzdEJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIHF1b3Rlcy4gQ2hlY2sgY29uc29sZSBmb3IgZGV0YWlscy4nKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZEFuZFJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHRhZyA9ICcnLCB0aXRsZSA9ICdRdW90ZXMnLCBjb2x1bW5zID0gMiwgbWF4SXRlbXMgPSAyMCB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGFnPzogc3RyaW5nO1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBjb2x1bW5zPzogbnVtYmVyO1xuICAgICAgbWF4SXRlbXM/OiBudW1iZXI7XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG5cbiAgICBjb25zdCBjb2xzRWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdxdW90ZXMtY29sdW1ucycgfSk7XG4gICAgY29sc0VsLnN0eWxlLmNvbHVtbkNvdW50ID0gU3RyaW5nKGNvbHVtbnMpO1xuXG4gICAgaWYgKCF0YWcpIHtcbiAgICAgIGNvbHNFbC5zZXRUZXh0KCdDb25maWd1cmUgYSB0YWcgaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFnU2VhcmNoID0gdGFnLnN0YXJ0c1dpdGgoJyMnKSA/IHRhZyA6IGAjJHt0YWd9YDtcbiAgICBjb25zdCBmaWxlcyA9IGdldEZpbGVzV2l0aFRhZyh0aGlzLmFwcCwgdGFnU2VhcmNoKS5zbGljZSgwLCBtYXhJdGVtcyk7XG5cbiAgICAvLyBSZWFkIGFsbCBmaWxlcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIGZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHsgZmlsZSwgY29udGVudCwgY2FjaGUgfTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBRdW90ZXNMaXN0QmxvY2sgZmFpbGVkIHRvIHJlYWQgZmlsZTonLCByZXN1bHQucmVhc29uKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZmlsZSwgY29udGVudCwgY2FjaGUgfSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIGNvbnN0IGNvbG9yID0gY2FjaGU/LmZyb250bWF0dGVyPy5jb2xvciBhcyBzdHJpbmcgPz8gJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGhpcy5leHRyYWN0Qm9keShjb250ZW50LCBjYWNoZSk7XG4gICAgICBpZiAoIWJvZHkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBpdGVtID0gY29sc0VsLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLWl0ZW0nIH0pO1xuICAgICAgY29uc3QgcXVvdGUgPSBpdGVtLmNyZWF0ZUVsKCdibG9ja3F1b3RlJywgeyBjbHM6ICdxdW90ZS1jb250ZW50JywgdGV4dDogYm9keSB9KTtcblxuICAgICAgLy8gVmFsaWRhdGUgY29sb3IgYmVmb3JlIGFwcGx5aW5nIHRvIHByZXZlbnQgQ1NTIGluamVjdGlvblxuICAgICAgaWYgKGNvbG9yICYmIENPTE9SX1JFLnRlc3QoY29sb3IpKSB7XG4gICAgICAgIHF1b3RlLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IGNvbG9yO1xuICAgICAgICBxdW90ZS5zdHlsZS5jb2xvciA9IGNvbG9yO1xuICAgICAgfVxuXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogJ3F1b3RlLXNvdXJjZScsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEV4dHJhY3QgdGhlIGZpcnN0IGZldyBsaW5lcyBvZiBib2R5IGNvbnRlbnQgdXNpbmcgbWV0YWRhdGFDYWNoZSBmcm9udG1hdHRlciBvZmZzZXQuICovXG4gIHByaXZhdGUgZXh0cmFjdEJvZHkoY29udGVudDogc3RyaW5nLCBjYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBmbUVuZCA9IGNhY2hlPy5mcm9udG1hdHRlclBvc2l0aW9uPy5lbmQub2Zmc2V0ID8/IDA7XG4gICAgY29uc3QgYWZ0ZXJGbSA9IGNvbnRlbnQuc2xpY2UoZm1FbmQpO1xuICAgIGNvbnN0IGxpbmVzID0gYWZ0ZXJGbVxuICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwgJiYgIWwuc3RhcnRzV2l0aCgnIycpKTtcbiAgICByZXR1cm4gbGluZXMuc2xpY2UoMCwgMykuam9pbignICcpO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBRdW90ZXNTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgUXVvdGVzU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnUXVvdGVzIExpc3QgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50aXRsZSBhcyBzdHJpbmcgPz8gJ1F1b3RlcycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy50aXRsZSA9IHY7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdUYWcnKS5zZXREZXNjKCdXaXRob3V0ICMgcHJlZml4JykuYWRkVGV4dCh0ID0+XG4gICAgICB0LnNldFZhbHVlKHRoaXMuY29uZmlnLnRhZyBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy50YWcgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnQ29sdW1ucycpLmFkZERyb3Bkb3duKGQgPT5cbiAgICAgIGQuYWRkT3B0aW9uKCcyJywgJzInKS5hZGRPcHRpb24oJzMnLCAnMycpXG4gICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLmNvbmZpZy5jb2x1bW5zID8/IDIpKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcuY29sdW1ucyA9IE51bWJlcih2KTsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ01heCBpdGVtcycpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZShTdHJpbmcodGhpcy5jb25maWcubWF4SXRlbXMgPz8gMjApKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcubWF4SXRlbXMgPSBwYXJzZUludCh2KSB8fCAyMDsgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKHRoaXMuY29uZmlnKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBTdWdnZXN0TW9kYWwsIFRGaWxlLCBURm9sZGVyIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9sZGVyIHBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPFRGb2xkZXI+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBvbkNob29zZTogKGZvbGRlcjogVEZvbGRlcikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKCdUeXBlIHRvIHNlYXJjaCB2YXVsdCBmb2xkZXJzXHUyMDI2Jyk7XG4gIH1cblxuICBwcml2YXRlIGdldEFsbEZvbGRlcnMoKTogVEZvbGRlcltdIHtcbiAgICBjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvbGRlcnMucHVzaChmKTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSByZWN1cnNlKGNoaWxkKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlY3Vyc2UodGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgICByZXR1cm4gZm9sZGVycztcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURm9sZGVyW10ge1xuICAgIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEFsbEZvbGRlcnMoKS5maWx0ZXIoZiA9PlxuICAgICAgZi5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oZm9sZGVyOiBURm9sZGVyLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbCgnc3BhbicsIHsgdGV4dDogZm9sZGVyLnBhdGggPT09ICcvJyA/ICcvICh2YXVsdCByb290KScgOiBmb2xkZXIucGF0aCB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihmb2xkZXI6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICB0aGlzLm9uQ2hvb3NlKGZvbGRlcik7XG4gIH1cbn1cblxuY29uc3QgSU1BR0VfRVhUUyA9IG5ldyBTZXQoWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcud2VicCcsICcuc3ZnJ10pO1xuY29uc3QgVklERU9fRVhUUyA9IG5ldyBTZXQoWycubXA0JywgJy53ZWJtJywgJy5tb3YnLCAnLm1rdiddKTtcblxuZXhwb3J0IGNsYXNzIEltYWdlR2FsbGVyeUJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdpbWFnZS1nYWxsZXJ5LWJsb2NrJyk7XG4gICAgdGhpcy5sb2FkQW5kUmVuZGVyKGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEltYWdlR2FsbGVyeUJsb2NrIGZhaWxlZCB0byByZW5kZXI6JywgZSk7XG4gICAgICBlbC5zZXRUZXh0KCdFcnJvciBsb2FkaW5nIGdhbGxlcnkuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRBbmRSZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmb2xkZXIgPSAnJywgdGl0bGUgPSAnR2FsbGVyeScsIGNvbHVtbnMgPSAzLCBtYXhJdGVtcyA9IDIwIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmb2xkZXI/OiBzdHJpbmc7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIGNvbHVtbnM/OiBudW1iZXI7XG4gICAgICBtYXhJdGVtcz86IG51bWJlcjtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcblxuICAgIGNvbnN0IGdhbGxlcnkgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdpbWFnZS1nYWxsZXJ5JyB9KTtcbiAgICBnYWxsZXJ5LnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnMgPSBgcmVwZWF0KCR7Y29sdW1uc30sIDFmcilgO1xuXG4gICAgaWYgKCFmb2xkZXIpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dCgnQ29uZmlndXJlIGEgZm9sZGVyIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZGVyT2JqID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG4gICAgaWYgKCEoZm9sZGVyT2JqIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcbiAgICAgIGdhbGxlcnkuc2V0VGV4dChgRm9sZGVyIFwiJHtmb2xkZXJ9XCIgbm90IGZvdW5kLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRNZWRpYUZpbGVzKGZvbGRlck9iaikuc2xpY2UoMCwgbWF4SXRlbXMpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBleHQgPSBgLiR7ZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgY29uc3Qgd3JhcHBlciA9IGdhbGxlcnkuY3JlYXRlRGl2KHsgY2xzOiAnZ2FsbGVyeS1pdGVtJyB9KTtcblxuICAgICAgaWYgKElNQUdFX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgY29uc3QgaW1nID0gd3JhcHBlci5jcmVhdGVFbCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSB0aGlzLmFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZmlsZSk7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2xhenknO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgd3JhcHBlci5hZGRDbGFzcygnZ2FsbGVyeS1pdGVtLXZpZGVvJyk7XG4gICAgICAgIHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiAndmlkZW8tcGxheS1vdmVybGF5JywgdGV4dDogJ1x1MjVCNicgfSk7XG5cbiAgICAgICAgY29uc3QgdmlkZW8gPSB3cmFwcGVyLmNyZWF0ZUVsKCd2aWRlbycpIGFzIEhUTUxWaWRlb0VsZW1lbnQ7XG4gICAgICAgIHZpZGVvLnNyYyA9IHRoaXMuYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmaWxlKTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb29wID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICAgICAgdmlkZW8ucHJlbG9hZCA9ICdtZXRhZGF0YSc7XG5cbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4geyB2b2lkIHZpZGVvLnBsYXkoKTsgfSk7XG4gICAgICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHsgdmlkZW8ucGF1c2UoKTsgdmlkZW8uY3VycmVudFRpbWUgPSAwOyB9KTtcbiAgICAgICAgd3JhcHBlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgJycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldE1lZGlhRmlsZXMoZm9sZGVyOiBURm9sZGVyKTogVEZpbGVbXSB7XG4gICAgY29uc3QgZmlsZXM6IFRGaWxlW10gPSBbXTtcbiAgICBjb25zdCByZWN1cnNlID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGAuJHtjaGlsZC5leHRlbnNpb24udG9Mb3dlckNhc2UoKX1gO1xuICAgICAgICAgIGlmIChJTUFHRV9FWFRTLmhhcyhleHQpIHx8IFZJREVPX0VYVFMuaGFzKGV4dCkpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICByZWN1cnNlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgcmVjdXJzZShmb2xkZXIpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgSW1hZ2VHYWxsZXJ5U2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEltYWdlR2FsbGVyeVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ltYWdlIEdhbGxlcnkgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50aXRsZSBhcyBzdHJpbmcgPz8gJ0dhbGxlcnknKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIGxldCBmb2xkZXJUZXh0OiBpbXBvcnQoJ29ic2lkaWFuJykuVGV4dENvbXBvbmVudDtcbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZSgnRm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdQaWNrIGEgdmF1bHQgZm9sZGVyLicpXG4gICAgICAuYWRkVGV4dCh0ID0+IHtcbiAgICAgICAgZm9sZGVyVGV4dCA9IHQ7XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcuZm9sZGVyIGFzIHN0cmluZyA/PyAnJylcbiAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQXR0YWNobWVudHMvUGhvdG9zJylcbiAgICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcuZm9sZGVyID0gdjsgfSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgICAgYnRuLnNldEljb24oJ2ZvbGRlcicpLnNldFRvb2x0aXAoJ0Jyb3dzZSB2YXVsdCBmb2xkZXJzJykub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgbmV3IEZvbGRlclN1Z2dlc3RNb2RhbCh0aGlzLmFwcCwgKGZvbGRlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlci5wYXRoID09PSAnLycgPyAnJyA6IGZvbGRlci5wYXRoO1xuICAgICAgICAgICAgdGhpcy5jb25maWcuZm9sZGVyID0gcGF0aDtcbiAgICAgICAgICAgIGZvbGRlclRleHQuc2V0VmFsdWUocGF0aCk7XG4gICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb2x1bW5zJykuYWRkRHJvcGRvd24oZCA9PlxuICAgICAgZC5hZGRPcHRpb24oJzInLCAnMicpLmFkZE9wdGlvbignMycsICczJykuYWRkT3B0aW9uKCc0JywgJzQnKVxuICAgICAgIC5zZXRWYWx1ZShTdHJpbmcodGhpcy5jb25maWcuY29sdW1ucyA/PyAzKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLmNvbHVtbnMgPSBOdW1iZXIodik7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdNYXggaXRlbXMnKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHRoaXMuY29uZmlnLm1heEl0ZW1zID8/IDIwKSlcbiAgICAgICAub25DaGFuZ2UodiA9PiB7IHRoaXMuY29uZmlnLm1heEl0ZW1zID0gcGFyc2VJbnQodikgfHwgMjA7IH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5hZGRCdXR0b24oYnRuID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZScpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB0aGlzLm9uU2F2ZSh0aGlzLmNvbmZpZyk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmNvbnN0IERFQk9VTkNFX01TID0gMzAwO1xuXG5leHBvcnQgY2xhc3MgRW1iZWRkZWROb3RlQmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICBwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlYm91bmNlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIHJlbmRlcihlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsID0gZWw7XG4gICAgZWwuYWRkQ2xhc3MoJ2VtYmVkZGVkLW5vdGUtYmxvY2snKTtcblxuICAgIHRoaXMucmVuZGVyQ29udGVudChlbCkuY2F0Y2goZSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbSG9tZXBhZ2UgQmxvY2tzXSBFbWJlZGRlZE5vdGVCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGZpbGUuIENoZWNrIGNvbnNvbGUgZm9yIGRldGFpbHMuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciB2YXVsdCBsaXN0ZW5lciBvbmNlOyBkZWJvdW5jZSByYXBpZCBzYXZlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAobW9kRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB7IGZpbGVQYXRoID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHsgZmlsZVBhdGg/OiBzdHJpbmcgfTtcbiAgICAgICAgaWYgKG1vZEZpbGUucGF0aCA9PT0gZmlsZVBhdGggJiYgdGhpcy5jb250YWluZXJFbCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlYm91bmNlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5kZWJvdW5jZVRpbWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5jb250YWluZXJFbDtcbiAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmRlYm91bmNlVGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJDb250ZW50KHRhcmdldCkuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIGZhaWxlZCB0byByZS1yZW5kZXIgYWZ0ZXIgbW9kaWZ5OicsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgREVCT1VOQ0VfTVMpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGVib3VuY2VUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmRlYm91bmNlVGltZXIpO1xuICAgICAgdGhpcy5kZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyBmaWxlUGF0aCA9ICcnLCBzaG93VGl0bGUgPSB0cnVlIH0gPSB0aGlzLmluc3RhbmNlLmNvbmZpZyBhcyB7XG4gICAgICBmaWxlUGF0aD86IHN0cmluZztcbiAgICAgIHNob3dUaXRsZT86IGJvb2xlYW47XG4gICAgfTtcblxuICAgIGVsLmVtcHR5KCk7XG5cbiAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICBlbC5zZXRUZXh0KCdDb25maWd1cmUgYSBmaWxlIHBhdGggaW4gc2V0dGluZ3MuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgZWwuc2V0VGV4dChgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNob3dUaXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIGZpbGUuYmFzZW5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2VtYmVkZGVkLW5vdGUtY29udGVudCcgfSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY29udGVudCwgY29udGVudEVsLCBmaWxlLnBhdGgsIHRoaXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIEVtYmVkZGVkTm90ZUJsb2NrIE1hcmtkb3duUmVuZGVyZXIgZmFpbGVkOicsIGUpO1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0Vycm9yIHJlbmRlcmluZyBmaWxlLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgRW1iZWRkZWROb3RlU2V0dGluZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5pbnN0YW5jZS5jb25maWcsIChjZmcpID0+IHtcbiAgICAgIHRoaXMuaW5zdGFuY2UuY29uZmlnID0gY2ZnO1xuICAgICAgb25TYXZlKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG59XG5cbmNsYXNzIEVtYmVkZGVkTm90ZVNldHRpbmdzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBwcml2YXRlIG9uU2F2ZTogKGNmZzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0VtYmVkZGVkIE5vdGUgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdGaWxlIHBhdGgnKS5zZXREZXNjKCdWYXVsdCBwYXRoIHRvIHRoZSBub3RlIChlLmcuIE5vdGVzL015Tm90ZS5tZCknKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcuZmlsZVBhdGggYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcuZmlsZVBhdGggPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZSgnU2hvdyB0aXRsZScpLmFkZFRvZ2dsZSh0ID0+XG4gICAgICB0LnNldFZhbHVlKHRoaXMuY29uZmlnLnNob3dUaXRsZSBhcyBib29sZWFuID8/IHRydWUpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy5zaG93VGl0bGUgPSB2OyB9KSxcbiAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuYWRkQnV0dG9uKGJ0biA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1NhdmUnKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblNhdmUodGhpcy5jb25maWcpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTW9kYWwsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBCbG9ja0luc3RhbmNlLCBJSG9tZXBhZ2VQbHVnaW4gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQmxvY2sgfSBmcm9tICcuL0Jhc2VCbG9jayc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNUZXh0QmxvY2sgZXh0ZW5kcyBCYXNlQmxvY2sge1xuICByZW5kZXIoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgZWwuYWRkQ2xhc3MoJ3N0YXRpYy10ZXh0LWJsb2NrJyk7XG4gICAgdGhpcy5yZW5kZXJDb250ZW50KGVsKS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tIb21lcGFnZSBCbG9ja3NdIFN0YXRpY1RleHRCbG9jayBmYWlsZWQgdG8gcmVuZGVyOicsIGUpO1xuICAgICAgZWwuc2V0VGV4dCgnRXJyb3IgcmVuZGVyaW5nIGNvbnRlbnQuJyk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckNvbnRlbnQoZWw6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0aXRsZSA9ICcnLCBjb250ZW50ID0gJycgfSA9IHRoaXMuaW5zdGFuY2UuY29uZmlnIGFzIHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgY29udGVudD86IHN0cmluZztcbiAgICB9O1xuXG4gICAgZWwuZW1wdHkoKTtcblxuICAgIGlmICh0aXRsZSkge1xuICAgICAgdGhpcy5yZW5kZXJIZWFkZXIoZWwsIHRpdGxlKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50RWwgPSBlbC5jcmVhdGVEaXYoeyBjbHM6ICdzdGF0aWMtdGV4dC1jb250ZW50JyB9KTtcblxuICAgIGlmICghY29udGVudCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSB0ZXh0IGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBjb250ZW50LCBjb250ZW50RWwsICcnLCB0aGlzKTtcbiAgfVxuXG4gIG9wZW5TZXR0aW5ncyhvblNhdmU6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBuZXcgU3RhdGljVGV4dFNldHRpbmdzTW9kYWwodGhpcy5hcHAsIHRoaXMuaW5zdGFuY2UuY29uZmlnLCAoY2ZnKSA9PiB7XG4gICAgICB0aGlzLmluc3RhbmNlLmNvbmZpZyA9IGNmZztcbiAgICAgIG9uU2F2ZSgpO1xuICAgIH0pLm9wZW4oKTtcbiAgfVxufVxuXG5jbGFzcyBTdGF0aWNUZXh0U2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3RhdGljIFRleHQgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdCbG9jayB0aXRsZScpLnNldERlc2MoJ09wdGlvbmFsIGhlYWRlciBzaG93biBhYm92ZSB0aGUgdGV4dC4nKS5hZGRUZXh0KHQgPT5cbiAgICAgIHQuc2V0VmFsdWUodGhpcy5jb25maWcudGl0bGUgYXMgc3RyaW5nID8/ICcnKVxuICAgICAgIC5vbkNoYW5nZSh2ID0+IHsgdGhpcy5jb25maWcudGl0bGUgPSB2OyB9KSxcbiAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKCdDb250ZW50Jykuc2V0RGVzYygnU3VwcG9ydHMgTWFya2Rvd24uJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSB0aGlzLmNvbmZpZy5jb250ZW50IGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTA7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IHRoaXMuY29uZmlnLmNvbnRlbnQgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKHRoaXMuY29uZmlnKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiIsICJpbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQmxvY2tJbnN0YW5jZSwgSUhvbWVwYWdlUGx1Z2luIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUJsb2NrIH0gZnJvbSAnLi9CYXNlQmxvY2snO1xuXG5leHBvcnQgY2xhc3MgSHRtbEJsb2NrIGV4dGVuZHMgQmFzZUJsb2NrIHtcbiAgcmVuZGVyKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmFkZENsYXNzKCdodG1sLWJsb2NrJyk7XG5cbiAgICBjb25zdCB7IHRpdGxlID0gJycsIGh0bWwgPSAnJyB9ID0gdGhpcy5pbnN0YW5jZS5jb25maWcgYXMge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBodG1sPzogc3RyaW5nO1xuICAgIH07XG5cbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIHRoaXMucmVuZGVySGVhZGVyKGVsLCB0aXRsZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudEVsID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaHRtbC1ibG9jay1jb250ZW50JyB9KTtcblxuICAgIGlmICghaHRtbCkge1xuICAgICAgY29udGVudEVsLnNldFRleHQoJ0NvbmZpZ3VyZSBIVE1MIGluIHNldHRpbmdzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnRlbnRFbC5pbm5lckhUTUwgPSBodG1sO1xuICB9XG5cbiAgb3BlblNldHRpbmdzKG9uU2F2ZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIG5ldyBIdG1sQmxvY2tTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLmluc3RhbmNlLmNvbmZpZywgKGNmZykgPT4ge1xuICAgICAgdGhpcy5pbnN0YW5jZS5jb25maWcgPSBjZmc7XG4gICAgICBvblNhdmUoKTtcbiAgICB9KS5vcGVuKCk7XG4gIH1cbn1cblxuY2xhc3MgSHRtbEJsb2NrU2V0dGluZ3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgIHByaXZhdGUgb25TYXZlOiAoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnSFRNTCBCbG9jayBTZXR0aW5ncycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0Jsb2NrIHRpdGxlJykuc2V0RGVzYygnT3B0aW9uYWwgaGVhZGVyIHNob3duIGFib3ZlIHRoZSBIVE1MLicpLmFkZFRleHQodCA9PlxuICAgICAgdC5zZXRWYWx1ZSh0aGlzLmNvbmZpZy50aXRsZSBhcyBzdHJpbmcgPz8gJycpXG4gICAgICAgLm9uQ2hhbmdlKHYgPT4geyB0aGlzLmNvbmZpZy50aXRsZSA9IHY7IH0pLFxuICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoJ0hUTUwnKS5zZXREZXNjKCdSYXcgSFRNTCByZW5kZXJlZCBkaXJlY3RseSBpbiB0aGUgYmxvY2suJyk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3RleHRhcmVhJywgeyBjbHM6ICdzdGF0aWMtdGV4dC1zZXR0aW5ncy10ZXh0YXJlYScgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSB0aGlzLmNvbmZpZy5odG1sIGFzIHN0cmluZyA/PyAnJztcbiAgICB0ZXh0YXJlYS5yb3dzID0gMTI7XG4gICAgdGV4dGFyZWEuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XG4gICAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7IHRoaXMuY29uZmlnLmh0bWwgPSB0ZXh0YXJlYS52YWx1ZTsgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpLmFkZEJ1dHRvbihidG4gPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHRoaXMub25TYXZlKHRoaXMuY29uZmlnKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG9CQUF1RDs7O0FDQXZELElBQUFDLG1CQUF3Qzs7O0FDRXhDLElBQU0scUJBQU4sTUFBeUI7QUFBQSxFQUF6QjtBQUNFLFNBQVEsWUFBWSxvQkFBSSxJQUE2QjtBQUFBO0FBQUEsRUFFckQsU0FBUyxTQUE2QjtBQUNwQyxTQUFLLFVBQVUsSUFBSSxRQUFRLE1BQU0sT0FBTztBQUFBLEVBQzFDO0FBQUEsRUFFQSxJQUFJLE1BQTJDO0FBQzdDLFdBQU8sS0FBSyxVQUFVLElBQUksSUFBSTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxTQUF5QjtBQUN2QixXQUFPLE1BQU0sS0FBSyxLQUFLLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDM0M7QUFBQSxFQUVBLFFBQWM7QUFDWixTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZCO0FBQ0Y7QUFFTyxJQUFNLGdCQUFnQixJQUFJLG1CQUFtQjs7O0FDZjdDLElBQU0sYUFBTixNQUFpQjtBQUFBLEVBU3RCLFlBQ0Us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QUNHLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFVBQVUsS0FBSyxXQUFXLEVBQzFCLFNBQVMsT0FBTyxLQUFLLE9BQU8sT0FBTyxPQUFPLENBQUMsRUFDM0MsU0FBUyxPQUFPLFVBQVU7QUFDekIsYUFBSyxPQUFPLE9BQU8sVUFBVSxPQUFPLEtBQUs7QUFDekMsY0FBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLE9BQU8sTUFBTTtBQUFBLE1BQ2pELENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSwwQkFBUSxXQUFXLEVBQ3BCLFFBQVEseUJBQXlCLEVBQ2pDLFFBQVEsc0VBQXNFLEVBQzlFO0FBQUEsTUFBVSxTQUNULElBQUksY0FBYyxjQUFjLEVBQUUsV0FBVyxFQUFFLFFBQVEsWUFBWTtBQUNqRSxjQUFNLEtBQUssT0FBTyxXQUFXLGlCQUFpQixDQUFDO0FBQy9DLG1CQUFXLFFBQVEsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUNoRSxjQUFJLEtBQUssZ0JBQWdCLGNBQWM7QUFDckMsa0JBQU0sS0FBSyxLQUFLLE9BQU87QUFBQSxVQUN6QjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDSjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiXQp9Cg==
