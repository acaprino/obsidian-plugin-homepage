# Architecture

This page maps the codebase of **Homepage Blocks**, an Obsidian plugin (`manifest.json`: id `homepage-blocks`, version 1.4.0, `minAppVersion` 1.8.7, `isDesktopOnly: false`).

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
| [flows.md](flows.md) | Load, save, startup/open modes, render, edit mode (Done, Discard, one session at a time), Add Block, block settings, auto-height, responsive columns, collapse, inline edit, export/import, external `data.json` changes |
| [blocks.md](blocks.md) | The 17 block types: config keys, rendering, reactivity, limits |
| [styling.md](styling.md) | `styles.css`, design tokens, shared `_` styling keys, container queries, snippet theming |
| [api/plugin.md](api/plugin.md) | `HomepagePlugin`, `IHomepagePlugin`, settings tab, persistence API |
| [api/blocks.md](api/blocks.md) | `BaseBlock`, `BlockFactory`, `BlockRegistry`, block helpers |
| [api/grid.md](api/grid.md) | `GridLayout`, `src/grid/*`, `EditToolbar`, modals |

---

## 1. Layers

Dependencies point downward. The table lists what each layer imports from the layers below it. Modules also import siblings in their own layer: `emojiPicker` → `emojis`, `openTarget` → `urls`, `loadRecovery` → `validation`, `apiKeyLayout` → `apiKeyCrypto`, `blockStyling` → `accentContrast`, `importSanitizer` → `BlockRegistry`/`blockStyling`/`configRanges`, every block → `BaseBlock`, `GridLayout` → `grid/*`, `EditHandleBar` → `modals/*` and `grid/blockLimit`, `HomepageView` → `EditToolbar`. Section 1.1 lists the upward edges plus two notable downward ones.

| # | Layer | Modules | Imports from |
|---|---|---|---|
| 0 | Contracts | `types.ts`, `grid/phase.ts` | `obsidian` (the `App` type) |
| 1 | Leaf helpers (import nothing outside layers 0–1) | `utils/Scheduler`, `ids`, `urls`, `openTarget`, `folderPath`, `pathRename`, `accentContrast`, `dailySeed`, `responsiveGrid`, `dragReorder`, `emojis`, `emojiPicker`, `noteContent`, `configRanges`, `voiceNote`, `voiceProviders`, `timeout`, `pomodoroTimer`, `grid/packing`, `grid/domOrder` | 0, `obsidian` (`moment`, `normalizePath`, `parseLinktext`, `Keymap`, `Notice`, the `CachedMetadata` and `TFile` types) |
| 2 | Domain and shared services | `validation`, `BlockRegistry`, `blockMeta`, `utils/loadRecovery`, `apiKeyCrypto`, `apiKeyLayout`, `importSanitizer`, `layoutReset` (imports `grid/packing`), `startupResolver`, `blockStyling`, `tags`, `imageCache`, `FolderSuggestModal` | 0–1, `obsidian` |
| 3 | Blocks | `blocks/BaseBlock.ts` and 17 subclasses | 0–2, `obsidian` |
| 4 | Grid and modals | `GridLayout.ts`, `grid/*` (except `packing`, `domOrder`, `phase`), `modals/*` | 0–3, `obsidian`, `gridstack` |
| 5 | View | `HomepageView.ts`, `EditToolbar.ts` | 0–4, `obsidian` |
| 6 | Plugin shell | `main.ts`, `settings/HomepageSettingTab.ts` | everything |

### 1.1 Edges that cross the layering

- **`types.ts` → `blocks/BaseBlock`.** This import is type-only: `import type { BaseBlock }` (`src/types.ts:2`). `BlockFactory.create` uses it as its return type.
- **Blocks → `grid/AutoHeight::AUTO_HEIGHT_ATTR`.** Six blocks import only this constant: ButtonGrid, EmbeddedNote, ImageGallery, QuotesList, RandomNote and StaticText.
- **`utils/importSanitizer` → `blocks/BaseBlock::TITLE_SIZE_RE`** (`src/utils/importSanitizer.ts:4`).
- **`settings/HomepageSettingTab` → `HomepageView`.** The settings tab uses the view class for `instanceof` checks, `finishEditing()`, `reload()` and live class toggles (`src/settings/HomepageSettingTab.ts:2, 59-63`).
- **`utils/layoutReset` → `grid/packing::packRows`** (`src/utils/layoutReset.ts:2`): `fitBlocksToColumns` packs the copies it makes for Copy to mobile and a phone reset.
- **`grid/blockLimit` → `validation::MAX_BLOCKS`** (`src/grid/blockLimit.ts:3`): `canAddBlock`, called by `GridLayout.addBlock` and the Duplicate button, refuses a block past the limit that the next load would drop.
- **Blocks and grid → `blockMeta::blockTitle`.** Every block with a header, `BlockWrapper.renderCompactPlaceholder` and `BlockSettingsModal` read the default title from one table (`src/blockMeta.ts:29-51`).
- **`main.ts` → module-level cleanup functions in two blocks:**
  - `clearPomodoroState` and `closeSharedAudioCtx` (`src/blocks/PomodoroBlock.ts:26,31`)
  - `abortActiveLightbox` (`src/blocks/ImageGalleryBlock.ts:23`)
- **Nothing under `src/` imports `main.ts`.** Blocks, the view, the grid and the settings tab reach the plugin only through `IHomepagePlugin` (`src/types.ts:105-141`). The settings tab types its host as `Plugin & IHomepagePlugin` (`src/settings/HomepageSettingTab.ts:15`). The only importer of `main.ts` is a test: `tests/utils/importSanitizer.test.ts:6` imports `registerBlocks`.

---

## 2. Module map

`src/` holds 69 files and 12,801 lines. The stylesheet `styles.css` sits at the repo root (4,039 lines) and is covered in [styling.md](styling.md).

### Plugin shell

| File | Lines | Role |
|---|---|---|
| `src/main.ts` | 661 | Contains `registerBlocks()` (`:42-208`), which registers the 17 factories, `commandTarget` (`:219-223`), which picks the homepage a command acts on, and `homepageCommand` (`:229-236`), the `checkCallback` that offers a command only while a homepage is open. Also contains `HomepagePlugin` (`:244`), which handles load, recovery and decryption, commands, ribbon, the startup and open-when-empty hooks, the `IHomepagePlugin` accessors, the serialized save chain, `followRename` for renamed files and folders (`:494-510`, through `utils/pathRename.ts`) and `onExternalSettingsChange` for a `data.json` changed by another device (`:532-564`). |
| `src/types.ts` | 154 | Defines `BLOCK_TYPES`, `BlockType`, `OpenMode`, `LayoutPriority`, `ResponsiveMode`, `BlockInstance`, `PreservedData`, `LayoutConfig`, `BlockFactory` and `IHomepagePlugin`. |
| `src/settings/HomepageSettingTab.ts` | 472 | The settings UI: startup (desktop and mobile), layout, display (under its own heading), reset, clipboard export and import, and copying the desktop layout to mobile. Reset and Copy to mobile ask first (`ConfirmActionModal`). A layout setting goes through `applyLayoutChange`, which ends open edit sessions (`finishEditSessions`) and reloads the open homepages. |

### View

| File | Lines | Role |
|---|---|---|
| `src/HomepageView.ts` | 120 | The `ItemView`. Each `onOpen` builds a new `GridLayout` and `EditToolbar`, wires `onLayoutChange` to `plugin.saveLayout`, and passes the toolbar the `EditSessionHooks` that allow one edit session across views and reload the other views when it ends. `reload(fromSync)` ends an edit session as Done, then re-runs `onOpen`. |
| `src/EditToolbar.ts` | 334 | The pencil FAB and the edit toolbar (columns, zoom, "+ Add block", "✕ discard", "✓ done"). The hidden toolbar is `inert`, and a redraw keeps the focused control. Exports `EditSessionHooks`. Holds the Discard snapshot of the blocks and the column count. Defines the private `AddBlockModal` (`:300`). |
| `src/blockMeta.ts` | 51 | `BLOCK_META`: icon and description per block type, for the add-block picker. `blockTitle(type)` (`:49`): the default header title, `''` for Clock, Greeting and Spacer. |

### Grid

| File | Lines | Role |
|---|---|---|
| `src/GridLayout.ts` | 740 | Owns the GridStack lifecycle: render and teardown, `mountBlock`, edit mode, column changes, zoom (kept across edit-mode re-renders), `addBlock`, write routing (`buildLayoutUpdate`, `:677`), and `holdDerivedPersist` (`:719`), which stops a grid redrawn after a sync from saving the positions it measures. A re-render restores the scroll position and the focused control (`captureViewState`); in a pop-out window the grid stays static (`inPopout`). |
| `src/grid/phase.ts` | 13 | `Phase`: a `const` object (`Destroyed` 0, `Initializing` 1, `Ready` 2) plus a type alias. It is not a TS `enum`. `LayoutPersister.persist` and the `dragstop`/`resizestop` handlers run only in `Ready`; `setEditMode`, `setColumns` and `addBlock` do nothing once `Destroyed`. The collapse toggle and the `EditHandleBar` writes do not check it. |
| `src/grid/AutoHeight.ts` | 169 | `AUTO_HEIGHT_ATTR` and `AutoHeightManager`. Measures marked content once per animation frame (rAF-batched) and calls `gridStack.update({h})`. |
| `src/grid/LayoutPersister.ts` | 162 | Reads GridStack nodes, diffs them against the active blocks, and emits the changed positions. Keeps the stored `h` of auto-height blocks and of collapsed blocks drawn at a display height (`nodeShowsStoredHeight`). Has a 50 ms debounced variant and re-packs the live nodes' `y`. |
| `src/grid/ResponsiveColumns.ts` | 211 | A `ResizeObserver` on `.homepage-view` that lowers the effective column count below 480, 768 and 1024 px, and asks auto-height blocks to measure again after narrowing. View mode only. |
| `src/grid/packing.ts` | 111 | Pure `packRows` (mutates in place) and `repackEditLayout` (returns a copy). |
| `src/grid/domOrder.ts` | 36 | `orderChildren`: puts grid items in order by moving only those out of place (a longest increasing run stays), so iframes in the others do not reload. Used by `initGridStack` and the single-column reorder. |
| `src/grid/blockLimit.ts` | 13 | `canAddBlock`: false, with a Notice, once a homepage holds `MAX_BLOCKS` blocks. |
| `src/grid/BlockWrapper.ts` | 119 | DOM builders for the card wrapper, skeleton overlay, edit-mode placeholder and empty state. The header zone gets no role or Tab stop here; `BaseBlock.renderHeader` makes it a toggle when it draws a header. |
| `src/grid/CollapseToggle.ts` | 99 | Header collapse and expand in view mode, by click, Enter or Space, only on a zone that draws a header (`role="button"`). `isCollapsible` keeps a stored-collapsed Clock, Greeting or Spacer (no header to expand it) drawn expanded; `viewModeHeight` gives the rows a block is drawn at. Collapsing saves `collapsed: true` and `_expandedH`; expanding saves `collapsed: false` and `h`, restored from `_expandedH` when it is a number ≥ 1. |
| `src/grid/EditHandleBar.ts` | 254 | The edit-mode handle bar: grip, up/down, duplicate (refused past the block limit), settings, remove. `swapWithNeighbor` is module-private. |

### Modals

| File | Lines | Role |
|---|---|---|
| `src/modals/BlockSettingsModal.ts` | 439 | Four tabs (Header, Body, Card, Content) over a `structuredClone` draft of the config. Save replaces the whole config. The Header tab has no title controls for a block without a header (`blockTitle` is `''`). |
| `src/modals/RemoveBlockConfirmModal.ts` | 33 | The "Remove block?" confirmation. |
| `src/modals/ConfirmActionModal.ts` | 38 | The confirmation before Reset layout and Copy to mobile, naming the layout replaced. Cancel comes first and takes the focus. |
| `src/modals/ConfirmImportModal.ts` | 55 | Confirms a clipboard import. Lists the imported active content (`findActiveContent`) and offers "Import all", "Import without content" and "Cancel" (`ImportChoice`). |

### Registry, validation, persistence policy

| File | Lines | Role |
|---|---|---|
| `src/BlockRegistry.ts` | 23 | Singleton `BlockRegistryClass` wrapping `Map<BlockType, BlockFactory>`, with `register`, `get`, `getAll` and `clear`. |
| `src/validation.ts` | 471 | `DEFAULT_LAYOUT_DATA`, `getDefaultLayout`, `validateLayout`, `validateBlocks` (which rebuilds each block from its known fields and keeps only a well-formed `collapsed`/`_expandedH`), `migrateBlockInstance`, `isValidBlockInstance`, the type guards, and `MAX_BLOCKS = 100`. Blocks of a type still unknown after migration (except a retired type, `insight`, which is dropped) and unknown top-level fields, which a newer version wrote, go to `layout.preserved` (`readPreserved`), and `toStoredLayout` (`:462`) puts them back for the save. |
| `src/utils/loadRecovery.ts` | 163 | `loadLayoutWithRecovery` and `DataFileGuard`. Copies an unusable file to `data.json.invalid[.<ms>]` and builds the load-problem Notice text, which counts the blocks past `MAX_BLOCKS` with the invalid ones. `newerVersionMessage` is the load Notice for preserved blocks. Used at load and by `onExternalSettingsChange`. |
| `src/utils/apiKeyCrypto.ts` | 280 | The AES-GCM-256 device key in IndexedDB, loaded once even under parallel first use (`inflightKey`). Provides `encryptStringEx`, `decryptStringEx` and `isEncrypted` (prefix `enc:v1:`), and a per-session memo of the ciphertext this device made or read for each plaintext (`knownCiphertextFor`, `rememberCiphertext`). |
| `src/utils/apiKeyLayout.ts` | 196 | Layout-wide key handling: `persistableLayout` (reuses the memoised ciphertext of an unchanged key, `withKnownCiphertext`), `encryptApiKeys`, `decryptApiKeys` (returns a new layout), `unreadableKeyNotice`. |
| `src/utils/importSanitizer.ts` | 220 | The clipboard-import allowlist: declared `defaultConfig` keys, type-checked (a key declared `undefined` takes only a string) and clamped to `CONFIG_RANGES`, plus the shared `_` validators. Strips `apiKey`, `customCss` and `preserved`. `findActiveContent` and `withoutActiveContent` serve the import confirmation; besides the text keys they cover Bookmarks, Button grid and Quick links targets whose scheme is not http(s) (`LINK_LISTS`). |
| `src/utils/configRanges.ts` | 36 | `CONFIG_RANGES`, `clampConfigNumber`, `rangedNumber`: the bounds of numeric block settings, applied at import and where blocks read them. |
| `src/utils/layoutReset.ts` | 77 | `buildResetLayout`, `fitBlocksToColumns`, `DESKTOP_LAYOUT_FIELDS`, `MOBILE_LAYOUT_FIELDS`, and `dropPreserved`, which clears the preserved blocks of the half a Reset or Copy to mobile replaces. |
| `src/utils/startupResolver.ts` | 37 | Pure `resolveStartup` and `mobileStartupActive`. |
| `src/utils/blockStyling.ts` | 211 | `applyBlockStyling` maps the shared `_` keys to classes and custom properties, the accent text-colour classes included (from `accentContrast`). Also holds `STYLE_RANGES`, `clampStyle`, `HEX_COLOR_RE` and the button-grid `customCss` allowlist. |
| `src/utils/accentContrast.ts` | 107 | `accentColors(accent, pct, opaque, theme, headerAccent)` and `contrastRatio`: the card background mixed as the stylesheet mixes it (`color-mix(in srgb)`) against Obsidian's default theme colours, and the text colours with the better WCAG contrast in each theme. The title is measured against the header zone (`headerBg`, the accent at 22% over the card) while the header accent is on. |

### Block support utilities

| File | Lines | Role |
|---|---|---|
| `src/utils/tags.ts` | 111 | `cacheHasTag` (as Obsidian's tag search: `getAllTags`, any letter case, nested tags), `normalizeTag`, `getFilesWithTag` (returns a copy), and a module-level tag→files cache, keyed by the lower-cased tag, with per-file invalidation. |
| `src/utils/imageCache.ts` | 242 | The `imageCache` singleton. Stores WebP thumbnail blob URLs (or the original resource URL for small images, SVGs and videos), keyed by path and checked against mtime, with at most 600 entries evicted least recently used first. Galleries `retain` and `release` the URLs they show; a blob URL that leaves the cache while shown is revoked on its last release. |
| `src/utils/noteContent.ts` | 130 | The one note-text extractor, `noteBlocks`: a note's paragraphs as Obsidian shows them, without frontmatter, code, math, comments, tables, inline fields, block ids, markers and leading tags, links reduced to their text. On top of it, `parseNoteInsight` (a leading heading only, and the body), `noteQuote` (the first paragraph, capped at 280 characters, and its "— Author" line) and `notePreview`. |
| `src/utils/voiceNote.ts` | 86 | `sanitizeVoiceFolder` (path-escape stripping, `null` for a `..` segment), `uniqueFilePath` (a number added while the name exists) and `buildNoteContent` (the note template, used only when `{{transcript}}` sits in plain text). |
| `src/utils/voiceProviders.ts` | 67 | The transcription models per provider (`PROVIDER_MODELS`, `DEFAULT_MODELS`: `gpt-transcribe`, `gemini-3.8-flash`), `effectiveModel` (an empty or retired id falls back to the default), `PROVIDER_MAX_BYTES` (the send limit: 25,000,000 bytes OpenAI, 14,500,000 Gemini), `PROVIDER_STOP_BYTES` (where recording stops, below it: 23,000,000 and 13,000,000, since the recorder still delivers a last chunk) and `geminiEmptyReason`. |
| `src/utils/timeout.ts` | 16 | `withTimeout` and `RequestTimeoutError`: stop awaiting a promise after a delay (120 s for the transcription requests). |
| `src/utils/pomodoroTimer.ts` | 77 | The pure Pomodoro model: `PomodoroState` anchored to the clock (`endsAt`), `initialState`, `startOrPause`, `skip`, `advance`, `remainingMs`. |
| `src/utils/dailySeed.ts` | 23 | `dailyEpochDay` (from the local date's calendar fields, so a clock change neither repeats nor skips a day) and `dailyIndex`, for picks that stay the same all day. |
| `src/utils/responsiveGrid.ts` | 10 | `responsiveGridColumns`: a `repeat(auto-fill, minmax(...))` column template whose track minimum leaves room for the gaps. |
| `src/utils/dragReorder.ts` | 45 | `enableDragReorder`: drag-and-drop reordering for lists in the settings UI; the grip is a button that also moves its row with Alt+Arrow up/down. |
| `src/utils/emojiPicker.ts` | 174 | `createEmojiPicker`: a searchable emoji picker widget. Escape closes only its panel. |
| `src/utils/emojis.ts` | 348 | `EMOJI_PICKER_SET`: 335 `[emoji, keywords]` pairs. |
| `src/utils/FolderSuggestModal.ts` | 45 | A `SuggestModal<TFolder>` that picks a folder; `{ includeRoot: false }` leaves the vault root out (Gallery, Quick links). |
| `src/utils/folderPath.ts` | 15 | `normalizeFolderPath` (a typed folder trimmed, without slashes around it, `''` for the root) and `isInFolder` (letter case aside). |
| `src/utils/openTarget.ts` | 83 | How blocks open things: `openFile` (a `TFile` the block holds, through `getLeaf(...).openFile`), `openNoteLink` (a typed link, only when it resolves), `openLinkTarget` (a Bookmarks or Button grid value: a URL of any non-dangerous scheme externally, a schemeless domain as https, else a note), `onOpenClick` (click and middle click) and `cleanLinkText`. Ctrl/Cmd or a middle click opens a new tab. |
| `src/utils/pathRename.ts` | 102 | `renamePath`, `renameLink` and `followRenameInBlock`: the config paths a file or folder rename rewrites, per block type. A typed link keeps its brackets, heading and alias; one typed by bare name follows only when the old name no longer resolves (the `resolves` callback). Used by `HomepagePlugin.followRename`. |
| `src/utils/urls.ts` | 22 | `isDangerousUrl`: blocks the `javascript:`, `data:`, `vbscript:`, `file:` and `blob:` schemes. |
| `src/utils/ids.ts` | 9 | `newId()`: `crypto.randomUUID()`, or a `hp-…` fallback. |
| `src/utils/Scheduler.ts` | 40 | Named `window` timeouts and rAFs. Re-scheduling a name replaces the pending callback; `cancelAll()` clears everything. |

### Blocks

Every block extends `BaseBlock`, is registered in `registerBlocks()`, and has an entry in `BLOCK_META`. Details are in [blocks.md](blocks.md) and [api/blocks.md](api/blocks.md).

| File | Lines | Type | Role |
|---|---|---|---|
| `src/blocks/BaseBlock.ts` | 267 | — | Abstract `Component`. Provides `renderHeader` (which also makes the header zone the collapse toggle while it draws a header), `scheduleRender` (with an error hint when a re-render fails), `nextGeneration`/`isStale`, `requestAutoHeight`, `observeWidthForAutoHeight`, `observeSizeForAutoHeight`, `onDayChange`, `liveConfig`, `hasUnsavedInlineState` and `renderContentSettings`. |
| `src/blocks/GreetingBlock.ts` | 411 | `greeting` | A time-of-day salutation (51 language presets, the app language by default), the user's name, an emoji and the time. |
| `src/blocks/ClockBlock.ts` | 81 | `clock` | A live time line and a date line, ticking every second. |
| `src/blocks/FolderLinksBlock.ts` | 285 | `folder-links` | Buttons for the files under a folder or glob, plus manual links. |
| `src/blocks/ButtonGridBlock.ts` | 143 | `button-grid` | A grid of emoji and label buttons that open notes or URLs (`openLinkTarget`). The only block type whose config keeps `customCss` (`migrateBlockInstance` deletes it from the others). |
| `src/blocks/QuotesListBlock.ts` | 516 | `quotes-list` | Quotes from tagged notes or pasted text, shown as a list or (with `maxItems: 1`) a single quote picked daily or at random. |
| `src/blocks/ImageGalleryBlock.ts` | 533 | `image-gallery` | A grid or masonry view of the images and videos in a folder, with a lightbox (a module singleton). |
| `src/blocks/EmbeddedNoteBlock.ts` | 158 | `embedded-note` | One file rendered as Markdown. Renames are followed by `HomepagePlugin.followRename`; the block re-renders from `liveConfig()` and falls back to `updateBlockConfig` when the plugin missed one. |
| `src/blocks/StaticTextBlock.ts` | 181 | `static-text` | Markdown stored in the block's config, with an inline pencil editor. |
| `src/blocks/HtmlBlock.ts` | 201 | `html` | User HTML. It is sanitized inline (without styles, media or non-http(s) links, in a paint-contained box), or rendered in a sandboxed iframe with a CSP when it contains `<style>`. |
| `src/blocks/VideoEmbedBlock.ts` | 178 | `video-embed` | A YouTube, Vimeo or Dailymotion iframe. |
| `src/blocks/BookmarkBlock.ts` | 114 | `bookmarks` | Link cards that open URLs of any non-dangerous scheme externally, or vault notes (`openLinkTarget`). |
| `src/blocks/RecentFilesBlock.ts` | 128 | `recent-files` | Markdown files sorted by modification time, with relative times rewritten every minute. |
| `src/blocks/PomodoroBlock.ts` | 380 | `pomodoro` | A work and break timer on the wall clock (`utils/pomodoroTimer.ts`). The timer store and the `AudioContext` are module-level; a paused or running timer survives unmounts. |
| `src/blocks/SpacerBlock.ts` | 7 | `spacer` | An empty cell. |
| `src/blocks/RandomNoteBlock.ts` | 268 | `random-note` | A random or daily note carrying a tag, with cover, title and preview. |
| `src/blocks/VoiceDictationBlock.ts` | 897 | `voice-dictation` | Records audio, transcribes it with OpenAI Whisper or Google Gemini (models and size caps from `utils/voiceProviders.ts`, 120 s timeout), and saves a note through `utils/voiceNote.ts`; a failed transcription keeps the audio and a note that embeds it. Includes a private `VoiceConsentModal` (`:849`). |
| `src/blocks/VaultSearchBlock.ts` | 303 | `vault-search` | Searches note names, as a combobox with a listbox of results and a live result count. The results dropdown is attached to the block's own document body and follows the input in that window. |

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
  gridmods["grid/*<br/>AutoHeight · LayoutPersister · ResponsiveColumns<br/>EditHandleBar · CollapseToggle · BlockWrapper<br/>packing · domOrder · blockLimit · phase"]
  modals["modals/*<br/>BlockSettingsModal · RemoveBlockConfirmModal<br/>ConfirmImportModal · ConfirmActionModal"]
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
  ranges["utils/configRanges"]
  styling["utils/blockStyling"]
  tags["utils/tags"]
  imgcache["utils/imageCache"]
  opentarget["utils/openTarget"]
  rename["utils/pathRename"]
  accent["utils/accentContrast"]
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
  main --> rename

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
  gridmods --> meta
  gridmods --> sched
  gridmods --> gs
  gridmods -.->|MAX_BLOCKS| validation
  modals --> registry
  modals --> base
  modals --> styling
  modals --> meta

  blocks --> base
  blocks --> meta
  blocks --> tags
  blocks --> imgcache
  blocks --> crypto
  blocks --> opentarget
  blocks -.->|AUTO_HEIGHT_ATTR| gridmods
  styling --> accent

  sanitizer --> registry
  sanitizer --> ranges
  blocks --> ranges
  reset -.->|packRows| gridmods
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
  - `blockMeta` (`blockTitle`): every block that draws a header.
  - `tags`: QuotesList and RandomNote. `noteContent`: QuotesList and RandomNote.
  - `imageCache`: ImageGallery.
  - `openTarget`: Bookmarks and ButtonGrid (`openLinkTarget`), FolderLinks (`openFile`, `openNoteLink`), RecentFiles, RandomNote and VaultSearch (`openFile`).
  - `folderPath`: FolderLinks, ImageGallery and RecentFiles.
  - `apiKeyCrypto` (`isEncrypted` only): VoiceDictation.
  - `configRanges` (`rangedNumber`): Pomodoro, QuotesList and RecentFiles.
  - `voiceNote`, `voiceProviders` and `timeout`: VoiceDictation. `pomodoroTimer`: Pomodoro.
  - `dailySeed`: BaseBlock (`onDayChange`), Greeting, QuotesList and RandomNote.
  - `FolderSuggestModal`: FolderLinks, ImageGallery and VoiceDictation.
  - `emojiPicker`: Greeting, FolderLinks, ButtonGrid, and `BlockSettingsModal`.

---

## 4. Runtime object graph

```mermaid
flowchart TD
  P["HomepagePlugin — 1 per plugin load<br/>layout · savePromise · dataGuard · lastWrittenJson"]
  ST["HomepageSettingTab — 1"]
  V["HomepageView — 0..n leaves of 'homepage-blocks'"]
  G["GridLayout — new on every onOpen/reload"]
  T["EditToolbar — new on every onOpen/reload"]
  AM["AddBlockModal — 0..1"]
  S["Scheduler<br/>anim · initSettle · autoHeight · sync · skeleton-n · skeleton-cap-id"]
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
  ST -.->|"finishEditing(), reload(), class toggles"| V
  P -.->|"commands (commandTarget), followRename,<br/>reload(true) after a sync"| V
  T -.->|"EditSessionHooks: one session;<br/>reload the other views when it ends"| V
```

### 4.1 Ownership and lifetimes

| Object | Created by | Lifetime | Holds |
|---|---|---|---|
| `HomepagePlugin` | Obsidian | Plugin load → unload | `layout` (in-memory authority), `savePromise`, `saveErrorNotified`, `dataGuard`, `lastWrittenJson` (what the last save wrote, so `onExternalSettingsChange` can skip it) (`src/main.ts:231, 428-430, 492`) |
| `HomepageView` | `registerView` factory (`src/main.ts:279`) | One per leaf. `openHomepage` reveals an existing leaf instead of creating a second one (`src/main.ts:601-605`). The commands act on one view, picked by `commandTarget` (`:218-222, 287-297, 373-375`). Only one view edits at a time. | `grid`, `toolbar`, `syncReload` (`src/HomepageView.ts:9-12`). The class defines no `getState`/`setState`. |
| `GridLayout` | `HomepageView.onOpen` (`:41`) | Until the next `onOpen`, `reload()` or `onClose` | GridStack, managers, the `blocks` map, `editMode`, `effectiveColumns`/`canonicalColumns`, `phase`, `derivedPersistHeld` (`src/GridLayout.ts:26-46`) |
| `EditToolbar` | `HomepageView.onOpen` (`:47-57`) | Same as `GridLayout` | `editMode`, `zoomScale`, `blocksSnapshot`, `columnsSnapshot`, the `EditSessionHooks`, `openModal`, `destroyed` (`src/EditToolbar.ts:19-24, 32, 204-206`) |
| Managers (`AutoHeightManager`, `ResponsiveColumnsManager`, `LayoutPersister`) | `GridLayout` constructor (`:62-67`) | Same as `GridLayout`. Each one keeps `host = this` and re-reads the host's fields on every call. | The auto-height pending queue; the `ResizeObserver` |
| `GridStack` | `initGridStack` (`src/GridLayout.ts:378-392`) | One `render()`. Destroyed in `teardown()` (`:326-330`). | The live node positions. During a drag these, not the layout, are the source of truth until `LayoutPersister` reads them back. |
| Block instances | `mountBlock` → `factory.create` (`src/GridLayout.ts:501`) | One `render()`. They are loaded with `block.load()` (`:503`) and unloaded with `block.unload()` in `teardown` (`:322`). They are **not** `addChild`ed to the view or the plugin. | A render-time `instance` snapshot, the header container, timers, vault listeners |
| Temporary settings block | `EditHandleBar` settings button (`src/grid/EditHandleBar.ts:106-114`) | While `BlockSettingsModal` is open. It is never `load()`ed. | Used only for `renderContentSettings` |
| Body-level DOM | The lightbox (`src/blocks/ImageGalleryBlock.ts:45`) and the vault-search dropdown (`src/blocks/VaultSearchBlock.ts:65`), each on the body of its block's own document | The lightbox lives until it is closed, the owning block unloads, or the plugin unloads. The dropdown lives as long as its block. | These elements sit outside `.homepage-view`, so view-scoped CSS tokens do not reach them (see [styling.md](styling.md)). |

Consequences of this object graph:

- **Every render recreates every block.** A render runs on `onOpen`/`reload()`, on entering or leaving edit mode, after an added block, and through `rerender()` after a column change, a duplicate, a move up/down, a block-settings save, or removing the last block. A drag, a resize or a collapse persists without re-rendering.
  - Per-instance state is lost each time, for example RandomNote's daily cache.
  - State that must survive a render lives in module singletons (Pomodoro `timerStore`) or in the layout. Pomodoro keeps a paused or running timer in the store across unmounts and drops only an idle one (`src/blocks/PomodoroBlock.ts:133-136`); a running phase is anchored to the clock, so it keeps counting while no block is mounted ([blocks.md](blocks.md), `pomodoro`).
- **Edit mode holds no block instances.** `mountBlock` renders placeholders (`src/GridLayout.ts:496-499`). While editing, block timers, vault listeners and live content are all stopped.
- **External rerenders are deferred while a block holds unsaved inline UI.** `rerender()` returns early if any block's `hasUnsavedInlineState()` is true (`src/GridLayout.ts:299-308`). `setEditMode` and `addBlock` render directly and bypass this guard (`:215-222, 284-295`); an open Static Text draft is saved as its block unloads.

### 4.2 Render pipeline (summary)

The full sequence is in [flows.md](flows.md).

1. `HomepageView.onOpen` → `GridLayout.render(activeBlocks(), activeColumns(), isInitial=true)` (`src/HomepageView.ts:63`).
2. `render` captures the scroll positions and the focused control (`captureViewState`, not on the initial render), calls `teardown()` and sets `phase = Ready`. With zero blocks it calls `renderEmptyState` and stops there. Otherwise it calls `initGridStack`, re-applies the edit-mode zoom and restores the view state (`src/GridLayout.ts:141-172`).
3. `initGridStack` sets `phase = Initializing`, builds the widgets and optionally calls `packRows`. It then runs `GridStack.init` (with `cellHeight: 80`, `margin: 8`, `float: true`, `staticGrid: !editMode || inPopout()`) and `load`, and calls `mountBlock` for each block. After that it registers the `dragstart`/`dragstop`/`resizestop` handlers, runs `ResponsiveColumnsManager.setup`, and a rAF (`initSettle`) sets `phase = Ready` (`:340-459`).
4. `mountBlock` builds the wrapper (`buildBlockWrapper` → `applyBlockStyling`). On the initial render it also covers the card with a skeleton, removed once the block has drawn and at the latest after 300 ms (`SKELETON_MAX_MS`).
   - In view mode it continues with `factory.create`, `setHeaderContainer`, `load()`, `render(contentEl)`, and then, for an auto-height block, an auto-height request.
   - In edit mode it continues with `renderCompactPlaceholder` and `attachEditHandleBar`.
   - `attachCollapseToggle` runs in both modes (`:470-558`).

---

## 5. Where state lives

### 5.1 Persistent

| Store | Key / path | Contents | Written by | Read by |
|---|---|---|---|---|
| `data.json` in the plugin folder (`<manifest.dir>/data.json`, `dataFilePath`, `src/main.ts:489-492`) | — | One `LayoutConfig` with 21 fields, as `toStoredLayout` writes it: any blocks of unknown types and unknown top-level fields a newer version wrote are kept in place (`LayoutConfig.preserved` in memory). `apiKey` values are `enc:v1:<iv>:<ct>` ciphertext wherever encryption succeeded. | Only `Plugin.saveData`, inside the `saveLayout` chain (`src/main.ts:450-486`) | `loadData()` at `onload` (`:252`) and in `onExternalSettingsChange` (`:512`), and `readPriorLayout()` before an encrypting save (`:540-547`). On the recovery path, `loadLayoutWithRecovery` re-reads it through `vault.adapter.read` when `loadData()` returned `undefined`, and `backupDataFile` reads it to make the copy (`src/utils/loadRecovery.ts:48-49, 88`). |
| `data.json.invalid`, `data.json.invalid.<ms>` | Next to `data.json` | A verbatim copy of an unreadable or unusable `data.json` | `backupDataFile` (`src/utils/loadRecovery.ts:81-104`) | Nothing; kept for the user. Covered by `.gitignore` (`data.json.invalid*`). |
| IndexedDB | database `homepage-blocks-kv`, store `keys`, record `apiKeyDeviceKey` (`src/utils/apiKeyCrypto.ts:31-33`) | The non-extractable AES-GCM-256 `CryptoKey` for this device | `loadDeviceKey` on first use | `encryptStringEx` / `decryptStringEx`. The database name has no vault component. |
| localStorage through `App.loadLocalStorage` / `saveLocalStorage` (vault-scoped, per device; needs Obsidian 1.8.7) | `hp-unreadable-api-keys` (`src/main.ts:228`) | Ids of blocks whose key this device was already told it cannot read | `announceUnreadableKeys` (`src/main.ts:353-370`) | Same |
| Same | `hp-voice-consent` (`src/blocks/VoiceDictationBlock.ts:8`) | `{whisper?: boolean, gemini?: boolean}` | `setConsent` (true) and `forgetConsent` (false, the **Forget** button in block settings) (`:36-51`) | `hasConsent`, checked at each recording start and by the block settings; the consent modal appears only when it returns false |
| Obsidian workspace | — | The leaf with view type `homepage-blocks` | Obsidian | Obsidian. The view restores nothing else, because it has no view state. |

Behaviour of `data.json` worth knowing:
- **Resaved on launch.** `onload` calls `saveLayout` whenever `decryptApiKeys` reports `stable` (`src/main.ts:275-277`). The file is therefore rewritten in normalized form on each such start, unless `DataFileGuard` is holding writes back.
- **Reloaded when another device changes it.** Obsidian calls `onExternalSettingsChange` when `data.json` changes on disk from outside (`src/main.ts:513-545`). It waits for the save chain, ignores a deleted file and this device's own last write (`lastWrittenJson`, set after each `saveData`, `:449`), and runs `loadLayoutWithRecovery`: an unusable file is backed up as at load, and the loaded layout stays. While a homepage is in edit mode it changes nothing and shows a Notice. Otherwise it decrypts the keys, replaces `plugin.layout` and calls `reload(true)` on every homepage view. A view reloaded this way holds back the positions its grid measures until the next edit-mode switch (`GridLayout.holdDerivedPersist`), so two running devices with different pane widths do not keep rewriting each other's file. Flow: [flows.md](flows.md) §12.
- **Writes are held while a broken file lacks a backup.** `DataFileGuard.allowWrite()` retries the backup before each write and lets writes through once the copy exists or the file is gone (`src/utils/loadRecovery.ts:113-136`).
- **An unchanged key keeps its ciphertext.** On a device that decrypted its own key, memory holds plaintext. `persistableLayout` first swaps each plaintext key for the ciphertext this device already made or read for it in this session (`withKnownCiphertext`, `src/utils/apiKeyLayout.ts:31-58`), so a drag or an auto-height save neither reads `data.json` nor changes the stored key. Only a key with no known ciphertext, a new one, is encrypted with a fresh IV after a read of the prior file. The memo is cleared with the device key at unload.
- **Data of a newer version survives.** A well-formed block of a type this version does not know, and a top-level field it does not know, are kept in `layout.preserved` at load and written back by every save, so an older version on a synced device does not delete them; a load Notice says how many blocks are kept and not shown (`newerVersionMessage`). A type is judged after migration, so a legacy type still migrates, and a retired type (`insight`) is dropped like an invalid block. Export and import leave the preserved data out; Reset and Copy to mobile clear the preserved blocks of the half they replace (`dropPreserved`).

Details are in [data-model.md](data-model.md).

### 5.2 In memory

| State | Owner | Notes |
|---|---|---|
| `plugin.layout` | `HomepagePlugin` | The authority for the running session. `saveLayout` assigns it **synchronously** before queuing the write (`src/main.ts:436`), so memory always leads the disk. `onExternalSettingsChange` replaces it with the layout another device wrote (`:529`). It holds plaintext `apiKey` wherever this device can decrypt. |
| Save queue | `HomepagePlugin.savePromise` (`src/main.ts:428`) | Writes run one at a time, in call order. Each queued write writes the layout object it was given. The chain swallows errors, reporting them with a Notice once until the next success, so `saveLayout` never rejects. |
| Active slice | `activeBlocks()`, `activeColumns()`, `activeLayoutPriority()` (`src/main.ts:379-393`) | `mobileBlocks`/`mobileColumns` when `Platform.isMobile && responsiveMode === 'separate'`, otherwise `blocks`/`columns`. |
| Startup slice | `activeOpenOnStartup()` … `activePin()` (`src/main.ts:402-424`) | Delegates to `resolveStartup`. It is gated on `separateStartup`, not on `responsiveMode`. |
| Render snapshot | `BaseBlock.instance` | Fixed at render time: never updated, though not `Object.freeze`d. After a block writes its own config with `updateBlockConfig`, read it back through `liveConfig()` (`src/blocks/BaseBlock.ts:48-50`). |
| Live grid positions | GridStack nodes | Copied into the layout by `LayoutPersister.persist()` on `dragstop`/`resizestop` (edit mode only), on a column change and on edit-mode exit (both only while editing), on edit-mode entry and on teardown (both only when a debounced `sync` persist is pending), and on debounced auto-height. The `EditHandleBar` remove handler also reads the compacted nodes itself. |
| Edit session | `EditToolbar.blocksSnapshot`, `columnsSnapshot` | A `structuredClone` of `activeBlocks()` and the active column count, taken on entering edit mode, after `grid.setEditMode(true)` (`src/EditToolbar.ts:69-70`). Discard writes both back. `followRename` and `updateBlockConfig` (a view-mode config save still queued when the session started) rewrite the block snapshot of an open session (`HomepageView.mapEditSnapshot` → `EditToolbar.mapSnapshot`, `src/main.ts:499, 618`). A `reload()` ends the session as Done first; closing the tab ends it without Done or Discard and keeps what the session already saved. One view edits at a time (`EditSessionHooks`). |
| DOM state | Classes on `.homepage-view`, the grid and the wrappers | For example `homepage-no-scrollbar`, `edit-mode`, `hp-single-column` and `block-collapsed`. See [styling.md](styling.md). |

### 5.3 Module singletons

Module state survives view reloads. Several singletons also survive a plugin disable and enable in the same renderer, which is why `onload` re-arms some of them.

| Singleton | Declared | Reset / cleanup |
|---|---|---|
| `BlockRegistry` (factory map) | `src/BlockRegistry.ts:23` | `BlockRegistry.clear()` at the start of `registerBlocks()` (`src/main.ts:42`). Not cleared on unload. |
| `imageCache` (`ImageCacheStore`: entries, pending work, `disposed`, per-URL `refs`, `orphans`) | `src/utils/imageCache.ts:31,242` | `imageCache.reset()` in `onload` (`src/main.ts:239`); `imageCache.destroy()` in `onunload` (`:338`) revokes every blob URL, orphans included, and clears the refs |
| `tagCache` and `listenersInstalled` | `src/utils/tags.ts:33-34` | `installTagCacheListeners` (`onload`, `src/main.ts:243`) clears `tagCache`; its `plugin.register` cleanup clears it again and resets `listenersInstalled`. `getFilesWithTag` returns a copy of the cached array (`:103-111`). |
| `timerStore` and `sharedAudioCtx` (Pomodoro) | `src/blocks/PomodoroBlock.ts:22-23` | `clearPomodoroState()` and `closeSharedAudioCtx()` in `onunload` (`src/main.ts:339-340`). A block's unload drops only an idle entry. |
| `activeLightbox` (one lightbox across all galleries) | `src/blocks/ImageGalleryBlock.ts:17` | `abortActiveLightbox()` in `onunload` (`src/main.ts:341`) and before each open |
| `cachedKey` (device `CryptoKey`), `inflightKey` (the device-key load in progress, shared by parallel callers) and `knownCiphertext` (plaintext → the ciphertext this device last made or read for it) | `src/utils/apiKeyCrypto.ts:36-45` | `inflightKey` clears itself when the load settles. `_resetDeviceKeyCache()` in `onunload` (`src/main.ts:361`) clears all three. The IndexedDB record stays. |
| `skeletonSeq` (skeleton timer name counter) | `src/grid/BlockWrapper.ts:62` | Never reset; it is only a name counter. |
| `listSeq` (ids of the Vault search result lists) | `src/blocks/VaultSearchBlock.ts:15` | Never reset; it is only an id counter. |

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
    UB["plugin.updateBlockConfig<br/>(StaticText, EmbeddedNote fallback)"]
    FR["plugin.followRename<br/>(renamed file or folder)"]
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
  FR --> SL
  STG --> SL
  SL --> Q["savePromise chain"] --> DG["DataFileGuard.allowWrite"] --> PL["persistableLayout<br/>(encrypt apiKey into a copy)"] --> TS["toStoredLayout<br/>(put preserved data back)"] --> SD["Plugin.saveData"] --> LW["lastWrittenJson"]
```

One path changes `plugin.layout` without a save: `onExternalSettingsChange` assigns the layout another device wrote, which is already on disk (`src/main.ts:532-539`).

Rules this design depends on (see [api/plugin.md](api/plugin.md)):
- **Never mutate a `BlockInstance` or the layout in place.** Build new arrays and objects, then save. `buildLayoutUpdate` spreads the current `plugin.layout` and replaces only the active slice (`src/GridLayout.ts:587-601`).
- **Read through the `active*()` accessors; route grid writes through `buildLayoutUpdate`.** `updateBlockConfig` patches only the **active** platform array (`src/main.ts:577-597`). A change that must reach both arrays, such as a renamed note or folder, is written by the plugin itself (`followRename`, `:494-510`).
- **A block writes its own config only through `plugin.updateBlockConfig`.** It must then re-read the config with `liveConfig()`. The `StaticTextBlock` inline editor is the reference implementation (`src/blocks/StaticTextBlock.ts:121-143`).

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
| **New block type** | 1. `src/blocks/MyBlock.ts` (extends `BaseBlock`)<br>2. `BLOCK_TYPES` in `src/types.ts:4-10`<br>3. `registerBlocks()` in `src/main.ts:42-208`<br>4. `BLOCK_META` and `BLOCK_TITLES` in `src/blockMeta.ts`<br>5. CSS in `styles.css`<br>6. Optionally `DEFAULT_LAYOUT_DATA` in `src/validation.ts:24-104` | `defaultConfig` must declare every key the block reads. It seeds new blocks and is the import allowlist. The header title comes from `blockTitle(type)`; files and links open through `src/utils/openTarget.ts`. For auto-height, set `autoHeight: true` on the factory, set `AUTO_HEIGHT_ATTR` on the measured element, and add a branch to `GridLayout.shouldAutoHeight` (`src/GridLayout.ts:123-134`) only if a `heightMode` opts out. See [api/blocks.md](api/blocks.md). |
| **Block-specific setting** | The block's `renderContentSettings(body, draft)`, its factory `defaultConfig`, and for a number with a settings range `CONFIG_RANGES` (`src/utils/configRanges.ts:10-21`) | Mutate `draft` in place; `BlockSettingsModal` owns Save and Cancel. Keys must not start with `_`. Read a ranged number with `rangedNumber(type, config, key, fallback)`, so a value out of range (hand-edited, from an old version or a crafted import) is clamped where it is used. |
| **Block that edits its own config in place** | `plugin.updateBlockConfig`, `liveConfig()`, `hasUnsavedInlineState()` | Follow the `StaticTextBlock` pattern. |
| **Live vault reactivity in a block** | `this.registerEvent(...)` + `this.scheduleRender(ms, fn)` + `nextGeneration()`/`isStale()` | Set `this.containerEl = el` in `render`, or `scheduleRender` and `requestAutoHeight` do nothing. For tags, use `getFilesWithTag`/`cacheHasTag` from `src/utils/tags.ts`, and do not mutate the returned array. |
| **New shared `_` styling key** | 1. The tab renderer in `src/modals/BlockSettingsModal.ts` (`renderHeaderTab`/`renderBodyTab`/`renderCardTab`, `:136-398`)<br>2. `applyBlockStyling` (`src/utils/blockStyling.ts:83`)<br>3. `STYLE_RANGES` (`:13-23`) if the key is numeric<br>4. `SHARED_VALIDATORS` (`src/utils/importSanitizer.ts:42-64`)<br>5. CSS | Keys under `_` apply to every block type. See [styling.md](styling.md). |
| **New `LayoutConfig` field** | 1. `src/types.ts::LayoutConfig`<br>2. `DEFAULT_LAYOUT_DATA`<br>3. `validateLayout`: parse the field **and** add it to the returned object literal (`src/validation.ts:420-427`), or it is dropped on the resave that follows every load (a field left out of `DEFAULT_LAYOUT_DATA` is instead taken for a newer version's and carried in `preserved`, never read)<br>4. The settings tab; a field that shapes the grid saves through `applyLayoutChange`<br>5. `DESKTOP_LAYOUT_FIELDS`/`MOBILE_LAYOUT_FIELDS` (`src/utils/layoutReset.ts`) only if a reset must replace it; every other field survives a reset | A per-platform startup field also needs an `IHomepagePlugin` accessor and a `resolveStartup` branch. Export and import carry the whole layout automatically. |
| **Migrate an old config or position format** | `migrateBlockInstance` (`src/validation.ts:131-222`) | This runs on every load and every import, so it must be idempotent. Add a case to `tests/validation.test.ts`. |
| **New command or ribbon action** | `HomepagePlugin.onload` (`src/main.ts:297-315`) | Actions on the view go through a `HomepageView` method that delegates to `EditToolbar` or `GridLayout`. `toggle-edit-mode` and `add-block` act on one homepage, picked by `commandTarget` (`:219-223`): the active one, else the one being edited, else the first; Add block goes to the one being edited. They are registered with `checkCallback: homepageCommand(target, run)` (`:229-236`), so the palette lists them only while a homepage is open. `open-homepage` reuses an existing leaf. |
| **New grid behaviour** | A new `src/grid/X.ts` that exports an `XHost` interface plus a manager or function | `GridLayout` satisfies host interfaces structurally and passes `this` (`src/GridLayout.ts:62-67`). Use named `GridLayout.scheduler` keys for timers so `teardown()` cancels them. Gate persistence on `Phase.Ready`. See [api/grid.md](api/grid.md). |
| **New module-level singleton** | The module itself, plus `HomepagePlugin.onunload` (`src/main.ts:353-362`) and, if needed, a re-arm in `onload` | Module state outlives views and can outlive a plugin reload in the same renderer. |
| **New settings-tab control** | `src/settings/HomepageSettingTab.ts` | A setting that shapes the grid saves with `applyLayoutChange(patch)`, which ends open edit sessions, saves and reloads the open homepages (`:65-70`). A display-only setting saves with `plugin.saveLayout({...plugin.layout, field})` and toggles view classes. An action that replaces the layout asks first (`ConfirmActionModal`, as Reset and Copy to mobile do) and calls `finishEditSessions()` before it writes. |
| **Tests** | `tests/<area>/X.test.ts` | Extend `tests/__mocks__/obsidian.ts` and `tests/obsidian-dom.ts` when code touches Obsidian APIs they do not cover. The shim provides `el.appendText`, `el.createSvg`, the global `createEl` and the `activeDocument`/`activeWindow` globals (`tests/obsidian-dom.ts:84-121`). |

DOM rules for new code come from CLAUDE.md. `eslint-plugin-obsidianmd` checks some of them, and only on `src/`:
- no `innerHTML` or `eval`
- no bare `document`, `setTimeout` or `requestAnimationFrame`: use `el.doc`/`el.win`, `activeDocument` and `window.*` timers
- `console.warn`/`console.error` messages are prefixed `[Homepage Blocks]` (a convention; no rule checks it)
