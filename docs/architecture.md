# Architecture

This page maps the codebase of **Homepage Blocks**, an Obsidian plugin (`manifest.json`: id `homepage-blocks`, version 1.3.0, `minAppVersion` 1.8.7, `isDesktopOnly: false`).

The plugin registers one custom view, `HomepageView` (`VIEW_TYPE = 'homepage-blocks'`, `src/HomepageView.ts:6`). The view renders a GridStack 12 grid of configurable **blocks**: clock, quotes, gallery, embedded note, voice notes, and 12 more. The whole layout is one `LayoutConfig` object. It lives in memory on the plugin and is persisted to the plugin's `data.json`.

Stack:
- TypeScript (`strict`)
- the Obsidian DOM API
- `gridstack`, the only runtime dependency (`package.json:27-29`)

esbuild bundles everything into `main.js`. There is no UI framework, and nothing in `src/` references Dataview.

## Documentation set

The index, with a reading order per task, is [README.md](README.md).

| Doc | Covers |
|---|---|
| [architecture.md](architecture.md) | This page: layers, module map, dependencies, runtime objects, state, where to add code |
| [data-model.md](data-model.md) | `LayoutConfig`, `BlockInstance`, defaults, validation, migration, `data.json`, API-key encryption, and the field-level rules of export, import, copy to mobile and reset |
| [flows.md](flows.md) | Load, save, startup/open modes, render, edit mode (Done, Discard), Add Block, block settings, auto-height, responsive columns, collapse, inline edit, export/import |
| [blocks.md](blocks.md) | The 17 block types: config keys, rendering, reactivity, limits |
| [styling.md](styling.md) | `styles.css`, design tokens, shared `_` styling keys, container queries, snippet theming |
| [api/plugin.md](api/plugin.md) | `HomepagePlugin`, `IHomepagePlugin`, settings tab, persistence API |
| [api/blocks.md](api/blocks.md) | `BaseBlock`, `BlockFactory`, `BlockRegistry`, block helpers |
| [api/grid.md](api/grid.md) | `GridLayout`, `src/grid/*`, `EditToolbar`, modals |

---

## 1. Layers

Dependencies point downward. The table lists what each layer imports from the layers below it. Modules also import siblings in their own layer: `emojiPicker` → `emojis`, `loadRecovery` → `validation`, `apiKeyLayout` → `apiKeyCrypto`, `importSanitizer` → `BlockRegistry`/`blockStyling`, every block → `BaseBlock`, `GridLayout` → `grid/*`, `EditHandleBar` → `modals/*`, `HomepageView` → `EditToolbar`. Section 1.1 lists the upward edges plus two notable downward ones.

| # | Layer | Modules | Imports from |
|---|---|---|---|
| 0 | Contracts | `types.ts`, `grid/phase.ts` | `obsidian` (the `App` type) |
| 1 | Leaf helpers (import nothing outside layers 0–1) | `utils/Scheduler`, `ids`, `urls`, `dailySeed`, `responsiveGrid`, `dragReorder`, `emojis`, `emojiPicker`, `noteContent`, `grid/packing` | 0, `obsidian` (`moment`, the `CachedMetadata` type) |
| 2 | Domain and shared services | `validation`, `BlockRegistry`, `blockMeta`, `utils/loadRecovery`, `apiKeyCrypto`, `apiKeyLayout`, `importSanitizer`, `layoutReset`, `startupResolver`, `blockStyling`, `tags`, `imageCache`, `FolderSuggestModal` | 0–1, `obsidian` |
| 3 | Blocks | `blocks/BaseBlock.ts` and 17 subclasses | 0–2, `obsidian` |
| 4 | Grid and modals | `GridLayout.ts`, `grid/*` (except `packing`, `phase`), `modals/*` | 0–3, `obsidian`, `gridstack` |
| 5 | View | `HomepageView.ts`, `EditToolbar.ts` | 0–4, `obsidian` |
| 6 | Plugin shell | `main.ts`, `settings/HomepageSettingTab.ts` | everything |

### 1.1 Edges that cross the layering

- **`types.ts` → `blocks/BaseBlock`.** This import is type-only: `import type { BaseBlock }` (`src/types.ts:2`). `BlockFactory.create` uses it as its return type.
- **Blocks → `grid/AutoHeight::AUTO_HEIGHT_ATTR`.** Six blocks import only this constant: ButtonGrid, EmbeddedNote, ImageGallery, QuotesList, RandomNote and StaticText.
- **`utils/importSanitizer` → `blocks/BaseBlock::TITLE_SIZE_RE`** (`src/utils/importSanitizer.ts:4`).
- **`settings/HomepageSettingTab` → `HomepageView`.** The settings tab uses the view class for `instanceof` checks, `reload()` and live class toggles (`src/settings/HomepageSettingTab.ts:2`).
- **`main.ts` → module-level cleanup functions in two blocks:**
  - `clearPomodoroState` and `closeSharedAudioCtx` (`src/blocks/PomodoroBlock.ts:29,34`)
  - `abortActiveLightbox` (`src/blocks/ImageGalleryBlock.ts:23`)
- **Nothing under `src/` imports `main.ts`.** Blocks, the view, the grid and the settings tab reach the plugin only through `IHomepagePlugin` (`src/types.ts:105-141`). The settings tab types its host as `Plugin & IHomepagePlugin` (`src/settings/HomepageSettingTab.ts:15`). The only importer of `main.ts` is a test: `tests/utils/importSanitizer.test.ts:6` imports `registerBlocks`.

---

## 2. Module map

`src/` holds 57 files and 10,768 lines. The stylesheet `styles.css` sits at the repo root (3,846 lines) and is covered in [styling.md](styling.md).

### Plugin shell

| File | Lines | Role |
|---|---|---|
| `src/main.ts` | 540 | Contains `registerBlocks()` (`:41-207`), which registers the 17 factories. Also contains `HomepagePlugin` (`:217`), which handles load, recovery and decryption, commands, ribbon, the startup and open-when-empty hooks, the `IHomepagePlugin` accessors, and the serialized save chain. |
| `src/types.ts` | 141 | Defines `BLOCK_TYPES`, `BlockType`, `OpenMode`, `LayoutPriority`, `ResponsiveMode`, `BlockInstance`, `LayoutConfig`, `BlockFactory` and `IHomepagePlugin`. |
| `src/settings/HomepageSettingTab.ts` | 438 | The settings UI: startup (desktop and mobile), layout, display, reset, clipboard export and import, and copying the desktop layout to mobile. |

### View

| File | Lines | Role |
|---|---|---|
| `src/HomepageView.ts` | 77 | The `ItemView`. Each `onOpen` builds a new `GridLayout` and `EditToolbar` and wires `onLayoutChange` to `plugin.saveLayout`. `reload()` re-runs `onOpen`. |
| `src/EditToolbar.ts` | 271 | The pencil FAB and the edit toolbar (columns, zoom, "+ Add block", "✕ discard", "✓ done"). Holds the Discard snapshot. Defines the private `AddBlockModal` (`:241`). |
| `src/blockMeta.ts` | 21 | `BLOCK_META`: icon and description per block type, for the add-block picker. |

### Grid

| File | Lines | Role |
|---|---|---|
| `src/GridLayout.ts` | 637 | Owns the GridStack lifecycle: render and teardown, `mountBlock`, edit mode, column changes, zoom, `addBlock`, and write routing (`buildLayoutUpdate`, `:580-594`). |
| `src/grid/phase.ts` | 13 | `Phase`: a `const` object (`Destroyed` 0, `Initializing` 1, `Ready` 2) plus a type alias. It is not a TS `enum`. `LayoutPersister.persist` and the `dragstop`/`resizestop` handlers run only in `Ready`; `setEditMode`, `setColumns` and `addBlock` do nothing once `Destroyed`. The collapse toggle and the `EditHandleBar` writes do not check it. |
| `src/grid/AutoHeight.ts` | 169 | `AUTO_HEIGHT_ATTR` and `AutoHeightManager`. Measures marked content once per animation frame (rAF-batched) and calls `gridStack.update({h})`. |
| `src/grid/LayoutPersister.ts` | 148 | Reads GridStack nodes, diffs them against the active blocks, and emits the changed positions. Has a 50 ms debounced variant and re-packs the live nodes' `y`. |
| `src/grid/ResponsiveColumns.ts` | 180 | A `ResizeObserver` on `.homepage-view` that lowers the effective column count below 480, 768 and 1024 px. View mode only. |
| `src/grid/packing.ts` | 111 | Pure `packRows` (mutates in place) and `repackEditLayout` (returns a copy). |
| `src/grid/BlockWrapper.ts` | 116 | DOM builders for the card wrapper, skeleton overlay, edit-mode placeholder and empty state. |
| `src/grid/CollapseToggle.ts` | 73 | Header collapse and expand in view mode, by click, Enter or Space. Collapsing saves `collapsed: true` and `_expandedH`; expanding saves `collapsed: false` and `h` (restored from `_expandedH`). |
| `src/grid/EditHandleBar.ts` | 252 | The edit-mode handle bar: grip, up/down, duplicate, settings, remove. `swapWithNeighbor` is module-private. |

### Modals

| File | Lines | Role |
|---|---|---|
| `src/modals/BlockSettingsModal.ts` | 422 | Four tabs (Header, Body, Card, Content) over a `structuredClone` draft of the config. Save replaces the whole config. |
| `src/modals/RemoveBlockConfirmModal.ts` | 33 | The "Remove block?" confirmation. |
| `src/modals/ConfirmPresetModal.ts` | 40 | Confirms a clipboard import. Its text still says "Load preset". |

### Registry, validation, persistence policy

| File | Lines | Role |
|---|---|---|
| `src/BlockRegistry.ts` | 23 | Singleton `BlockRegistryClass` wrapping `Map<BlockType, BlockFactory>`, with `register`, `get`, `getAll` and `clear`. |
| `src/validation.ts` | 393 | `DEFAULT_LAYOUT_DATA`, `getDefaultLayout`, `validateLayout`, `validateBlocks`, `migrateBlockInstance`, `isValidBlockInstance`, the type guards, and `MAX_BLOCKS = 100`. |
| `src/utils/loadRecovery.ts` | 154 | `loadLayoutWithRecovery` and `DataFileGuard`. Copies an unusable file to `data.json.invalid[.<ms>]` and builds the load-problem Notice text. |
| `src/utils/apiKeyCrypto.ts` | 252 | The AES-GCM-256 device key in IndexedDB. Provides `encryptStringEx`, `decryptStringEx` and `isEncrypted` (prefix `enc:v1:`). |
| `src/utils/apiKeyLayout.ts` | 176 | Layout-wide key handling: `persistableLayout`, `encryptApiKeys`, `decryptApiKeys`, `unreadableKeyNotice`. |
| `src/utils/importSanitizer.ts` | 136 | The clipboard-import allowlist: declared `defaultConfig` keys, type-checked, plus the shared `_` validators. Strips `apiKey` and `customCss`. |
| `src/utils/layoutReset.ts` | 83 | `buildResetLayout`, `STARTUP_FIELDS`, `MOBILE_LAYOUT_FIELDS`. |
| `src/utils/startupResolver.ts` | 37 | Pure `resolveStartup` and `mobileStartupActive`. |
| `src/utils/blockStyling.ts` | 213 | `applyBlockStyling` maps the shared `_` keys to classes and custom properties. Also holds `STYLE_RANGES`, `clampStyle`, `HEX_COLOR_RE` and the button-grid `customCss` allowlist. |

### Block support utilities

| File | Lines | Role |
|---|---|---|
| `src/utils/tags.ts` | 110 | `cacheHasTag`, `normalizeTag`, `getFilesWithTag`, and a module-level tag→files cache with per-file invalidation. |
| `src/utils/imageCache.ts` | 187 | The `imageCache` singleton. Stores WebP thumbnail blob URLs (or the original resource URL for small images, SVGs and videos), keyed by path and checked against mtime, with at most 300 entries. |
| `src/utils/noteContent.ts` | 14 | `parseNoteInsight`: the first heading and the body text. |
| `src/utils/dailySeed.ts` | 17 | `dailyEpochDay` and `dailyIndex`, for picks that stay the same all day. |
| `src/utils/responsiveGrid.ts` | 8 | `responsiveGridColumns`: a `repeat(auto-fill, minmax(...))` column template. |
| `src/utils/dragReorder.ts` | 32 | `enableDragReorder`: HTML5 drag-and-drop reordering for lists in the settings UI. |
| `src/utils/emojiPicker.ts` | 162 | `createEmojiPicker`: a searchable emoji picker widget. |
| `src/utils/emojis.ts` | 348 | `EMOJI_PICKER_SET`: 335 `[emoji, keywords]` pairs. |
| `src/utils/FolderSuggestModal.ts` | 42 | A `SuggestModal<TFolder>` that picks a folder, the vault root included. |
| `src/utils/urls.ts` | 22 | `isDangerousUrl`: blocks the `javascript:`, `data:`, `vbscript:`, `file:` and `blob:` schemes. |
| `src/utils/ids.ts` | 9 | `newId()`: `crypto.randomUUID()`, or a `hp-…` fallback. |
| `src/utils/Scheduler.ts` | 40 | Named `window` timeouts and rAFs. Re-scheduling a name replaces the pending callback; `cancelAll()` clears everything. |

### Blocks

Every block extends `BaseBlock`, is registered in `registerBlocks()`, and has an entry in `BLOCK_META`. Details are in [blocks.md](blocks.md) and [api/blocks.md](api/blocks.md).

| File | Lines | Type | Role |
|---|---|---|---|
| `src/blocks/BaseBlock.ts` | 174 | — | Abstract `Component`. Provides `renderHeader`, `scheduleRender`, `nextGeneration`/`isStale`, `requestAutoHeight`, `observeWidthForAutoHeight`, `liveConfig`, `hasUnsavedInlineState` and `renderContentSettings`. |
| `src/blocks/GreetingBlock.ts` | 386 | `greeting` | A time-of-day salutation (51 language presets), the user's name, an emoji and the time. |
| `src/blocks/ClockBlock.ts` | 83 | `clock` | A live time line and a date line. |
| `src/blocks/FolderLinksBlock.ts` | 292 | `folder-links` | Buttons for the files under a folder or glob, plus manual links. |
| `src/blocks/ButtonGridBlock.ts` | 147 | `button-grid` | A grid of emoji and label buttons that open vault links. The only block type whose config keeps `customCss` (`migrateBlockInstance` deletes it from the others). |
| `src/blocks/QuotesListBlock.ts` | 501 | `quotes-list` | Quotes from tagged notes or pasted text, shown as a list or (with `maxItems: 1`) a single quote picked daily or at random. |
| `src/blocks/ImageGalleryBlock.ts` | 493 | `image-gallery` | A grid or masonry view of the images and videos in a folder, with a lightbox (a module singleton). |
| `src/blocks/EmbeddedNoteBlock.ts` | 149 | `embedded-note` | One file rendered as Markdown. Follows renames through `updateBlockConfig`. |
| `src/blocks/StaticTextBlock.ts` | 148 | `static-text` | Markdown stored in the block's config, with an inline pencil editor. |
| `src/blocks/HtmlBlock.ts` | 146 | `html` | User HTML. It is sanitized inline, or rendered in a sandboxed iframe with a CSP when it contains `<style>`. |
| `src/blocks/VideoEmbedBlock.ts` | 168 | `video-embed` | A YouTube, Vimeo or Dailymotion iframe. |
| `src/blocks/BookmarkBlock.ts` | 129 | `bookmarks` | Link cards that open external http(s) URLs or vault paths. |
| `src/blocks/RecentFilesBlock.ts` | 114 | `recent-files` | Markdown files sorted by modification time. |
| `src/blocks/PomodoroBlock.ts` | 459 | `pomodoro` | A work and break timer. The timer store and the `AudioContext` are module-level. |
| `src/blocks/SpacerBlock.ts` | 7 | `spacer` | An empty cell. |
| `src/blocks/RandomNoteBlock.ts` | 285 | `random-note` | A random or daily note carrying a tag, with cover, title and preview. |
| `src/blocks/VoiceDictationBlock.ts` | 682 | `voice-dictation` | Records audio, transcribes it with OpenAI Whisper or Google Gemini, and saves a note. Includes a private `VoiceConsentModal` (`:634`). |
| `src/blocks/VaultSearchBlock.ts` | 265 | `vault-search` | Searches note names. The results dropdown is attached to the document body. |

---

## 3. Dependency graph

These are the main module-level imports, from the `import` statements in `src/`. Edges into `types.ts` are omitted; most modules have one.

```mermaid
flowchart TD
  main["main.ts<br/>HomepagePlugin + registerBlocks"]
  settings["settings/HomepageSettingTab"]
  view["HomepageView"]
  toolbar["EditToolbar"]
  grid["GridLayout"]
  gridmods["grid/*<br/>AutoHeight · LayoutPersister · ResponsiveColumns<br/>EditHandleBar · CollapseToggle · BlockWrapper<br/>packing · phase"]
  modals["modals/*<br/>BlockSettingsModal · RemoveBlockConfirmModal<br/>ConfirmPresetModal"]
  registry["BlockRegistry"]
  meta["blockMeta"]
  base["blocks/BaseBlock"]
  blocks["blocks/* (17 types)"]
  validation["validation"]
  loadrec["utils/loadRecovery"]
  keylayout["utils/apiKeyLayout"]
  crypto["utils/apiKeyCrypto"]
  startup["utils/startupResolver"]
  reset["utils/layoutReset"]
  sanitizer["utils/importSanitizer"]
  styling["utils/blockStyling"]
  tags["utils/tags"]
  imgcache["utils/imageCache"]
  sched["utils/Scheduler"]
  types["types.ts"]
  gs[("gridstack")]

  main --> view
  main --> settings
  main --> registry
  main --> blocks
  main --> validation
  main --> loadrec
  main --> keylayout
  main --> crypto
  main --> startup
  main --> tags
  main --> imgcache

  settings --> view
  settings --> validation
  settings --> reset
  settings --> sanitizer
  settings --> modals

  view --> grid
  view --> toolbar
  toolbar --> grid
  toolbar --> registry
  toolbar --> meta

  grid --> gridmods
  grid --> registry
  grid --> base
  grid --> sched
  grid --> gs
  gridmods --> modals
  gridmods --> registry
  gridmods --> styling
  gridmods --> sched
  gridmods --> gs
  modals --> registry
  modals --> base
  modals --> styling

  blocks --> base
  blocks --> tags
  blocks --> imgcache
  blocks --> crypto
  blocks -.->|AUTO_HEIGHT_ATTR| gridmods

  sanitizer --> registry
  sanitizer --> styling
  sanitizer -.->|TITLE_SIZE_RE| base
  keylayout --> crypto
  loadrec --> validation
  types -.->|import type| base
```

Notes:
- `EditHandleBar` is the only grid module that opens modals: `BlockSettingsModal` and `RemoveBlockConfirmModal` (`src/grid/EditHandleBar.ts:7-8`). It also creates a temporary block through the registry so the settings modal can render its Content tab.
- `BlockWrapper` is the only grid module that calls `applyBlockStyling` (`src/grid/BlockWrapper.ts:29`). The settings preview also calls it (`src/modals/BlockSettingsModal.ts:85`).
- The block-to-utility edges are specific:
  - `tags`: QuotesList and RandomNote.
  - `imageCache`: ImageGallery.
  - `apiKeyCrypto` (`isEncrypted` only): VoiceDictation.
  - `FolderSuggestModal`: FolderLinks, ImageGallery and VoiceDictation.
  - `emojiPicker`: Greeting, FolderLinks, ButtonGrid, and `BlockSettingsModal`.

---

## 4. Runtime object graph

```mermaid
flowchart TD
  P["HomepagePlugin — 1 per plugin load<br/>layout · savePromise · dataGuard"]
  ST["HomepageSettingTab — 1"]
  V["HomepageView — 0..n leaves of 'homepage-blocks'"]
  G["GridLayout — new on every onOpen/reload"]
  T["EditToolbar — new on every onOpen/reload"]
  AM["AddBlockModal — 0..1"]
  S["Scheduler<br/>anim · initSettle · autoHeight · sync · skeleton-n"]
  AH["AutoHeightManager"]
  RC["ResponsiveColumnsManager<br/>ResizeObserver on .homepage-view"]
  LP["LayoutPersister"]
  GS["GridStack — new on every render<br/>null in the empty state"]
  BM["blocks: Map&lt;id, {block, wrapper}&gt;"]
  B["BaseBlock subclass — 1 per BlockInstance<br/>view mode only, null in edit mode"]
  M["BlockSettingsModal / RemoveBlockConfirmModal<br/>(opened from EditHandleBar)"]

  P -->|registerView factory| V
  P -->|addSettingTab| ST
  V --> G
  V --> T
  T -->|grid reference| G
  T --> AM
  G --> S
  G --> AH
  G --> RC
  G --> LP
  G --> GS
  G --> BM
  BM --> B
  G -.->|edit mode| M
  B -.->|"plugin: IHomepagePlugin"| P
  G -.->|"plugin: IHomepagePlugin"| P
  ST -.->|"reload(), class toggles"| V
```

### 4.1 Ownership and lifetimes

| Object | Created by | Lifetime | Holds |
|---|---|---|---|
| `HomepagePlugin` | Obsidian | Plugin load → unload | `layout` (in-memory authority), `savePromise`, `saveErrorNotified`, `dataGuard` (`src/main.ts:218, 420-422`) |
| `HomepageView` | `registerView` factory (`src/main.ts:262`) | One per leaf. `openHomepage` reveals an existing leaf instead of creating a second one (`src/main.ts:514-518`), but the commands iterate over every leaf (`:270-294`). | `grid`, `toolbar` (`src/HomepageView.ts:9-10`). The class defines no `getState`/`setState`. |
| `GridLayout` | `HomepageView.onOpen` (`:39`) | Until the next `onOpen`, `reload()` or `onClose` | GridStack, managers, the `blocks` map, `editMode`, `effectiveColumns`/`canonicalColumns`, `phase` (`src/GridLayout.ts:26-44`) |
| `EditToolbar` | `HomepageView.onOpen` (`:41-47`) | Same as `GridLayout` | `editMode`, `zoomScale`, `blocksSnapshot`, `openModal`, `destroyed` (`src/EditToolbar.ts:9-14, 162-164`) |
| Managers (`AutoHeightManager`, `ResponsiveColumnsManager`, `LayoutPersister`) | `GridLayout` constructor (`:60-65`) | Same as `GridLayout`. Each one keeps `host = this` and re-reads the host's fields on every call. | The auto-height pending queue; the `ResizeObserver` |
| `GridStack` | `initGridStack` (`src/GridLayout.ts:371-385`) | One `render()`. Destroyed in `teardown()` (`:319-323`). | The live node positions. During a drag these, not the layout, are the source of truth until `LayoutPersister` reads them back. |
| Block instances | `mountBlock` → `factory.create` (`src/GridLayout.ts:494`) | One `render()`. They are loaded with `block.load()` (`:496`) and unloaded with `block.unload()` in `teardown` (`:315`). They are **not** `addChild`ed to the view or the plugin. | A render-time `instance` snapshot, the header container, timers, vault listeners |
| Temporary settings block | `EditHandleBar` settings button (`src/grid/EditHandleBar.ts:106-114`) | While `BlockSettingsModal` is open. It is never `load()`ed. | Used only for `renderContentSettings` |
| Body-level DOM | The lightbox (`src/blocks/ImageGalleryBlock.ts:45`) and the vault-search dropdown (`src/blocks/VaultSearchBlock.ts:62`) | The lightbox lives until it is closed, the owning block unloads, or the plugin unloads. The dropdown lives as long as its block. | These elements sit outside `.homepage-view`, so view-scoped CSS tokens do not reach them (see [styling.md](styling.md)). |

Consequences of this object graph:

- **Every render recreates every block.** A render runs on `onOpen`/`reload()`, on entering or leaving edit mode, and through `rerender()` after a column change, an added block, a duplicate, a move up/down, a block-settings save, or removing the last block. A drag, a resize or a collapse persists without re-rendering.
  - Per-instance state is lost each time, for example RandomNote's daily cache.
  - State that must survive a render lives in module singletons (Pomodoro `timerStore`) or in the layout. Pomodoro's unload still deletes the store entry of a timer that is not running, so a paused timer resets on every render ([blocks.md](blocks.md), `pomodoro`).
- **Edit mode holds no block instances.** `mountBlock` renders placeholders (`src/GridLayout.ts:489-492`). While editing, block timers, vault listeners and live content are all stopped.
- **External rerenders are deferred while a block holds unsaved inline UI.** `rerender()` returns early if any block's `hasUnsavedInlineState()` is true (`src/GridLayout.ts:292-301`). `setEditMode` renders directly and bypasses this guard (`:211-218`).

### 4.2 Render pipeline (summary)

The full sequence is in [flows.md](flows.md).

1. `HomepageView.onOpen` → `GridLayout.render(activeBlocks(), activeColumns(), isInitial=true)` (`src/HomepageView.ts:53`).
2. `render` calls `teardown()` and sets `phase = Ready`. With zero blocks it calls `renderEmptyState` and stops there. Otherwise it calls `initGridStack` (`src/GridLayout.ts:134-160`).
3. `initGridStack` sets `phase = Initializing`, builds the widgets and optionally calls `packRows`. It then runs `GridStack.init` (with `cellHeight: 80`, `margin: 8`, `float: true`, `staticGrid: !editMode`) and `load`, and calls `mountBlock` for each block. After that it registers the `dragstart`/`dragstop`/`resizestop` handlers, runs `ResponsiveColumnsManager.setup`, and a rAF (`initSettle`) sets `phase = Ready` (`:333-452`).
4. `mountBlock` builds the wrapper (`buildBlockWrapper` → `applyBlockStyling`).
   - In view mode it continues with `factory.create`, `setHeaderContainer`, `load()`, `render(contentEl)`, and then, for an auto-height block, an auto-height request.
   - In edit mode it continues with `renderCompactPlaceholder` and `attachEditHandleBar`.
   - `attachCollapseToggle` runs in both modes (`:463-551`).

---

## 5. Where state lives

### 5.1 Persistent

| Store | Key / path | Contents | Written by | Read by |
|---|---|---|---|---|
| `data.json` in the plugin folder (`<manifest.dir>/data.json`, `src/main.ts:234-236`) | — | One `LayoutConfig` with 21 fields. `apiKey` values are `enc:v1:<iv>:<ct>` ciphertext wherever encryption succeeded. | Only `Plugin.saveData`, inside the `saveLayout` chain (`src/main.ts:424-458`) | `loadData()` at `onload` (`:235`), and `readPriorLayout()` before an encrypting save (`:467-474`). On the recovery path, `loadLayoutWithRecovery` re-reads it through `vault.adapter.read` when `loadData()` returned `undefined`, and `backupDataFile` reads it to make the copy (`src/utils/loadRecovery.ts:48-49, 88`). |
| `data.json.invalid`, `data.json.invalid.<ms>` | Next to `data.json` | A verbatim copy of an unreadable or unusable `data.json` | `backupDataFile` (`src/utils/loadRecovery.ts:81-104`) | Nothing; kept for the user. Covered by `.gitignore` (`data.json.invalid*`). |
| IndexedDB | database `homepage-blocks-kv`, store `keys`, record `apiKeyDeviceKey` (`src/utils/apiKeyCrypto.ts:31-33`) | The non-extractable AES-GCM-256 `CryptoKey` for this device | `loadDeviceKey` on first use | `encryptStringEx` / `decryptStringEx`. The database name has no vault component. |
| localStorage through `App.loadLocalStorage` / `saveLocalStorage` (vault-scoped, per device; needs Obsidian 1.8.7) | `hp-unreadable-api-keys` (`src/main.ts:215`) | Ids of blocks whose key this device was already told it cannot read | `announceUnreadableKeys` (`src/main.ts:350-367`) | Same |
| Same | `hp-voice-consent` (`src/blocks/VoiceDictationBlock.ts:6`) | `{whisper?: true, gemini?: true}` | `setConsent` | `hasConsent`, checked at each recording start; the consent modal appears only when it returns false |
| Obsidian workspace | — | The leaf with view type `homepage-blocks` | Obsidian | Obsidian. The view restores nothing else, because it has no view state. |

Behaviour of `data.json` worth knowing:
- **Resaved on launch.** `onload` calls `saveLayout` whenever `decryptApiKeys` reports `stable` (`src/main.ts:258-260`). The file is therefore rewritten in normalized form on each such start, unless `DataFileGuard` is holding writes back.
- **Loaded into the layout only once.** There is no `onExternalSettingsChange` in `src/`. A `data.json` that a sync service replaces while the plugin runs is overwritten by the next save of the in-memory layout. (`readPriorLayout` re-reads the file, but only to keep stored ciphertext during an encrypting save.)
- **Writes are held while a broken file lacks a backup.** `DataFileGuard.allowWrite()` retries the backup before each write and lets writes through once the copy exists or the file is gone (`src/utils/loadRecovery.ts:113-136`).
- **The disk copy is re-encrypted on every save when needed.** `persistableLayout` returns the layout unchanged when no plaintext key exists. On a device that decrypted its own key, memory holds plaintext, so every save reads `data.json` and re-encrypts the key with a fresh IV (`src/utils/apiKeyLayout.ts:16-37`). The comments at `src/main.ts:436-438` and `src/utils/apiKeyLayout.ts:25-27` say that drags skip this step, which is only true when no readable key is in memory.

Details are in [data-model.md](data-model.md).

### 5.2 In memory

| State | Owner | Notes |
|---|---|---|
| `plugin.layout` | `HomepagePlugin` | The authority for the running session. `saveLayout` assigns it **synchronously** before queuing the write (`src/main.ts:425`), so memory always leads the disk. It holds plaintext `apiKey` wherever this device can decrypt. |
| Save queue | `HomepagePlugin.savePromise` (`src/main.ts:420`) | Writes run one at a time, in call order. Each queued write writes the layout object it was given. The chain swallows errors, reporting them with a Notice once until the next success, so `saveLayout` never rejects. |
| Active slice | `activeBlocks()`, `activeColumns()`, `activeLayoutPriority()` (`src/main.ts:371-385`) | `mobileBlocks`/`mobileColumns` when `Platform.isMobile && responsiveMode === 'separate'`, otherwise `blocks`/`columns`. |
| Startup slice | `activeOpenOnStartup()` … `activePin()` (`src/main.ts:394-416`) | Delegates to `resolveStartup`. It is gated on `separateStartup`, not on `responsiveMode`. |
| Render snapshot | `BaseBlock.instance` | Fixed at render time: never updated, though not `Object.freeze`d. After a block writes its own config with `updateBlockConfig`, read it back through `liveConfig()` (`src/blocks/BaseBlock.ts:48-50`). |
| Live grid positions | GridStack nodes | Copied into the layout by `LayoutPersister.persist()` on `dragstop`/`resizestop` (edit mode only), on a column change and on edit-mode exit (both only while editing), on edit-mode entry and on teardown (both only when a debounced `sync` persist is pending), and on debounced auto-height. The `EditHandleBar` remove handler also reads the compacted nodes itself. |
| Edit session | `EditToolbar.blocksSnapshot` | A `structuredClone` of `activeBlocks()` taken on entering edit mode (`src/EditToolbar.ts:53`). Discard writes it back. It is lost if the view reloads or closes during an edit. |
| DOM state | Classes on `.homepage-view`, the grid and the wrappers | For example `homepage-no-scrollbar`, `edit-mode`, `hp-single-column` and `block-collapsed`. See [styling.md](styling.md). |

### 5.3 Module singletons

Module state survives view reloads. Several singletons also survive a plugin disable and enable in the same renderer, which is why `onload` re-arms some of them.

| Singleton | Declared | Reset / cleanup |
|---|---|---|
| `BlockRegistry` (factory map) | `src/BlockRegistry.ts:23` | `BlockRegistry.clear()` at the start of `registerBlocks()` (`src/main.ts:42`). Not cleared on unload. |
| `imageCache` (`ImageCacheStore`: entries, pending work, `disposed`) | `src/utils/imageCache.ts:28,187` | `imageCache.reset()` in `onload` (`src/main.ts:226`); `imageCache.destroy()` in `onunload` (`:335`) |
| `tagCache` and `listenersInstalled` | `src/utils/tags.ts:33-34` | `installTagCacheListeners` (`onload`, `src/main.ts:230`) clears `tagCache`; its `plugin.register` cleanup clears it again and resets `listenersInstalled`. `getFilesWithTag` returns the cached array by reference. |
| `timerStore` and `sharedAudioCtx` (Pomodoro) | `src/blocks/PomodoroBlock.ts:25-26` | `clearPomodoroState()` and `closeSharedAudioCtx()` in `onunload` (`src/main.ts:336-337`) |
| `activeLightbox` (one lightbox across all galleries) | `src/blocks/ImageGalleryBlock.ts:17` | `abortActiveLightbox()` in `onunload` (`src/main.ts:338`) and before each open |
| `cachedKey` (device `CryptoKey`) | `src/utils/apiKeyCrypto.ts:36` | `_resetDeviceKeyCache()` in `onunload` (`src/main.ts:342`). The IndexedDB record stays. |
| `skeletonSeq` (skeleton timer name counter) | `src/grid/BlockWrapper.ts:61` | Never reset; it is only a name counter. |

---

## 6. The write funnel

Every layout change reaches disk through `HomepagePlugin.saveLayout`. No other code calls `saveData`. The write paths are traced in [flows.md](flows.md).

```mermaid
flowchart LR
  subgraph callers
    LP["LayoutPersister.persist<br/>(drag/resize/flush)"]
    EH["EditHandleBar<br/>(duplicate/settings/remove/move)"]
    GL["GridLayout<br/>(edit exit repack, setColumns, addBlock)"]
    CT["CollapseToggle"]
    ET["EditToolbar.discardChanges"]
    UB["plugin.updateBlockConfig<br/>(StaticText, EmbeddedNote)"]
    STG["HomepageSettingTab"]
  end
  LP --> EM["GridLayout.emitLayout / onLayoutChange<br/>(buildLayoutUpdate routes blocks/mobileBlocks)"]
  EH --> EM
  GL --> EM
  EM --> HV["HomepageView onLayoutChange<br/>plugin.layout = l"]
  HV --> SL["plugin.saveLayout(l)<br/>this.layout = l (sync)"]
  CT --> SL
  ET --> SL
  UB --> SAB["saveActiveBlocks"] --> SL
  STG --> SL
  SL --> Q["savePromise chain"] --> DG["DataFileGuard.allowWrite"] --> PL["persistableLayout<br/>(encrypt apiKey into a copy)"] --> SD["Plugin.saveData"]
```

Rules this design depends on (see [api/plugin.md](api/plugin.md)):
- **Never mutate a `BlockInstance` or the layout in place.** Build new arrays and objects, then save. `buildLayoutUpdate` spreads the current `plugin.layout` and replaces only the active slice (`src/GridLayout.ts:580-594`).
- **Read through the `active*()` accessors; route grid writes through `buildLayoutUpdate`.** `updateBlockConfig` patches only the **active** platform array (`src/main.ts:490-510`).
- **A block writes its own config only through `plugin.updateBlockConfig`.** It must then re-read the config with `liveConfig()`. The `StaticTextBlock` inline editor is the reference implementation (`src/blocks/StaticTextBlock.ts:119-135`).

---

## 7. Build, test, lint

| Command | Effect |
|---|---|
| `npm run build` | esbuild bundles `src/main.ts` into `main.js` at the repo root: CJS, `es2022`, `obsidian`/`electron`/Node builtins external, `gridstack` bundled, no sourcemap, `drop: ['debugger']` (`esbuild.config.mjs:6-20`). |
| `npm run dev` | The same build in watch mode, with inline sourcemaps and without `drop` or `pure`. It also writes `main.js`. |
| `npx tsc --noEmit` | Type-checks `src/**/*.ts` only (`tsconfig.json:13`). Tests are not type-checked. |
| `npm test` / `npm run test:watch` | Runs Vitest in `happy-dom`. `obsidian` is aliased to `tests/__mocks__/obsidian.ts`. The setup file (`tests/setup.ts`) installs `fake-indexeddb` and the DOM helpers in `tests/obsidian-dom.ts` (`vitest.config.ts:5-17`). |
| `npx eslint src` | Lints `src/`. There is no lint script. `tests/**` cannot be parsed by the typed config, and `npx eslint .` fails on `esbuild.config.mjs`. |

Things to know before running these:
- **`main.js` is build output that is tracked in git.** The repository sits inside a vault's `.obsidian/plugins/` folder, so a build or a `dev` watch replaces the plugin that Obsidian loads from here.
- **The `pure` list does not remove console calls inside functions.** It lists `console.debug/log/info/trace` (`esbuild.config.mjs:18`), but without `minify` esbuild only annotates a call inside a function with `/* @__PURE__ */` and keeps it; tree shaking drops only unused top-level ones. `src/` currently contains no such calls.
- **The CSS is not bundled.** GridStack's core CSS is pasted at the top of `styles.css` (`styles.css:1-2`).

---

## 8. Where to add code

| Task | Touch | Notes |
|---|---|---|
| **New block type** | 1. `src/blocks/MyBlock.ts` (extends `BaseBlock`)<br>2. `BLOCK_TYPES` in `src/types.ts:4-10`<br>3. `registerBlocks()` in `src/main.ts:41-207`<br>4. `BLOCK_META` in `src/blockMeta.ts`<br>5. CSS in `styles.css`<br>6. Optionally `DEFAULT_LAYOUT_DATA` in `src/validation.ts:24-109` | `defaultConfig` must declare every key the block reads. It seeds new blocks and is the import allowlist. For auto-height, set `autoHeight: true` on the factory, set `AUTO_HEIGHT_ATTR` on the measured element, and add a branch to `GridLayout.shouldAutoHeight` (`src/GridLayout.ts:116-127`) only if a `heightMode` opts out. See [api/blocks.md](api/blocks.md). |
| **Block-specific setting** | The block's `renderContentSettings(body, draft)` and its factory `defaultConfig` | Mutate `draft` in place; `BlockSettingsModal` owns Save and Cancel. Keys must not start with `_`. |
| **Block that edits its own config in place** | `plugin.updateBlockConfig`, `liveConfig()`, `hasUnsavedInlineState()` | Follow the `StaticTextBlock` pattern. |
| **Live vault reactivity in a block** | `this.registerEvent(...)` + `this.scheduleRender(ms, fn)` + `nextGeneration()`/`isStale()` | Set `this.containerEl = el` in `render`, or `scheduleRender` and `requestAutoHeight` do nothing. For tags, use `getFilesWithTag`/`cacheHasTag` from `src/utils/tags.ts`, and do not mutate the returned array. |
| **New shared `_` styling key** | 1. The tab renderer in `src/modals/BlockSettingsModal.ts` (`renderHeaderTab`/`renderBodyTab`/`renderCardTab`, `:136-398`)<br>2. `applyBlockStyling` (`src/utils/blockStyling.ts:83`)<br>3. `STYLE_RANGES` (`:13-23`) if the key is numeric<br>4. `SHARED_VALIDATORS` (`src/utils/importSanitizer.ts:41-63`)<br>5. CSS | Keys under `_` apply to every block type. See [styling.md](styling.md). |
| **New `LayoutConfig` field** | 1. `src/types.ts::LayoutConfig`<br>2. `DEFAULT_LAYOUT_DATA`<br>3. `validateLayout`: parse the field **and** add it to the returned object literal (`src/validation.ts:385-392`), or it is dropped on the resave that follows every load<br>4. The settings tab<br>5. `STARTUP_FIELDS`/`MOBILE_LAYOUT_FIELDS` (`src/utils/layoutReset.ts`) if a reset must preserve it | A per-platform startup field also needs an `IHomepagePlugin` accessor and a `resolveStartup` branch. Export and import carry the whole layout automatically. |
| **Migrate an old config or position format** | `migrateBlockInstance` (`src/validation.ts:131-222`) | This runs on every load and every import, so it must be idempotent. Add a case to `tests/validation.test.ts`. |
| **New command or ribbon action** | `HomepagePlugin.onload` (`src/main.ts:264-298`) | Actions on the view go through a `HomepageView` method that delegates to `EditToolbar` or `GridLayout`. `toggle-edit-mode` and `add-block` apply to every homepage leaf; `open-homepage` reuses an existing leaf. |
| **New grid behaviour** | A new `src/grid/X.ts` that exports an `XHost` interface plus a manager or function | `GridLayout` satisfies host interfaces structurally and passes `this` (`src/GridLayout.ts:60-65`). Use named `GridLayout.scheduler` keys for timers so `teardown()` cancels them. Gate persistence on `Phase.Ready`. See [api/grid.md](api/grid.md). |
| **New module-level singleton** | The module itself, plus `HomepagePlugin.onunload` (`src/main.ts:334-343`) and, if needed, a re-arm in `onload` | Module state outlives views and can outlive a plugin reload in the same renderer. |
| **New settings-tab control** | `src/settings/HomepageSettingTab.ts` | Save with `plugin.saveLayout({...plugin.layout, field})`. Call `reloadOpenHomepages()` or toggle view classes when open views must reflect the change. |
| **Tests** | `tests/<area>/X.test.ts` | Extend `tests/__mocks__/obsidian.ts` and `tests/obsidian-dom.ts` when code touches Obsidian APIs they do not cover. For example, global `activeDocument`, global `createEl`, `el.createSvg` and `el.appendText` are not provided. |

DOM rules for new code come from CLAUDE.md. `eslint-plugin-obsidianmd` checks some of them, and only on `src/`:
- no `innerHTML` or `eval`
- no bare `document`, `setTimeout` or `requestAnimationFrame`: use `el.doc`/`el.win`, `activeDocument` and `window.*` timers
- `console.warn`/`console.error` messages are prefixed `[Homepage Blocks]` (a convention; no rule checks it)
