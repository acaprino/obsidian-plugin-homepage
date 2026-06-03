# Homepage Blocks -- Obsidian Plugin

Composable, drag-and-drop homepage for Obsidian.
TypeScript + Obsidian DOM API. GridStack for layout. No Dataview.

## Entry Points

- `src/main.ts` -- plugin lifecycle, block registration (`registerBlocks()`), commands, ribbon, settings tab wiring, API-key encrypt/decrypt orchestration, layout persistence funnel (`saveLayout`/`updateBlockConfig`), corrupted-data stash
- `src/HomepageView.ts` -- `ItemView` subclass (`VIEW_TYPE = 'homepage-blocks'`), mounts grid + toolbar
- `src/GridLayout.ts` -- GridStack lifecycle wrapper: init/teardown, render, edit-mode placeholders, zoom, empty/skeleton state, drag/resize sync, `buildLayoutUpdate` write-routing. Delegates to `src/grid/*` managers
- `src/grid/` -- extracted GridStack concerns: `AutoHeight.ts` (`AUTO_HEIGHT_ATTR`, `AutoHeightManager`), `LayoutPersister.ts` (read/diff/write positions), `EditHandleBar.ts` (`attachEditHandleBar`, `swapWithNeighbor`), `CollapseToggle.ts` (`attachCollapseToggle`), `ResponsiveColumns.ts` (`ResponsiveColumnsManager`), `packing.ts` (`packRows`/`repackEditLayout`, pure + unit-tested), `phase.ts` (`Phase` enum)
- `src/modals/` -- `BlockSettingsModal.ts` (shared `_`-prefixed styling settings), `RemoveBlockConfirmModal.ts`, `ConfirmPresetModal.ts`
- `src/settings/HomepageSettingTab.ts` -- settings UI: startup/layout/display sections, export/import, reset, copy-to-mobile
- `src/EditToolbar.ts` -- floating edit FAB, toolbar (column picker, zoom slider, add-block modal), Discard snapshot/restore, `AddBlockModal`
- `src/blockMeta.ts` -- `BLOCK_META` (icon + description per block type, for the add-block modal)
- `src/types.ts` -- `BlockType`, `BlockInstance`, `LayoutConfig`, `BlockFactory`, `IHomepagePlugin`
- `src/validation.ts` -- `validateLayout`, `validateBlocks` (ID dedup + clamp), `migrateBlockInstance` (idempotent), `getDefaultLayout`
- `src/BlockRegistry.ts` -- singleton `BlockRegistryClass` wrapping `Map<BlockType, BlockFactory>`
- `src/blocks/BaseBlock.ts` -- abstract base extending `Component`; `renderContentSettings`, `hasUnsavedInlineState`, `scheduleRender`, auto-height helpers
- `src/utils/` -- `tags.ts` (getFilesWithTag, cacheHasTag), `apiKeyCrypto.ts` (AES-GCM at rest), `importSanitizer.ts` (`_`-key validator table), `Scheduler.ts` (named timers/rAF), `imageCache.ts`, `emojiPicker.ts`, `blockStyling.ts` (applyBlockStyling), `responsiveGrid.ts` (intra-block CSS grid columns), `dailySeed.ts`, `ids.ts`, `emojis.ts`, `FolderSuggestModal.ts`, `noteContent.ts` (parseNoteInsight, used by QuotesList)
- `src/blocks/` -- one file per block type (17 total)
- `styles.css` -- all styles at repo root

## Block Types (17)

`greeting`, `clock`, `folder-links`, `button-grid`, `quotes-list`, `image-gallery`, `embedded-note`, `static-text`, `html`, `video-embed`, `bookmarks`, `recent-files`, `pomodoro`, `spacer`, `random-note`, `voice-dictation`, `vault-search`

Each defined in `BLOCK_TYPES` array in `src/types.ts` and registered in `registerBlocks()` in `src/main.ts`.

Blocks whose content reflows beyond their grid cell (auto-height) set `autoHeight: true` on their `BlockFactory` in `registerBlocks()` AND set `data-auto-height-content` on the measurement element inside `render(el)`. `GridLayout.shouldAutoHeight` reads the factory flag.

## Build

```bash
npm run build          # esbuild -> main.js (root)
npm run dev            # watch mode
npx tsc --noEmit       # type-check (run after every .ts change)
```

`strict: true` is enabled. Always confirm zero tsc errors before finishing.

## Dependencies

- **Runtime:** `gridstack` (grid layout engine) -- the only runtime dependency
- **Dev:** `obsidian`, `typescript`, `esbuild`, `@types/node`, `builtin-modules`, `eslint`, `eslint-plugin-obsidianmd`, `typescript-eslint`, `@eslint/js`, `globals`; tests via `vitest`, `happy-dom`, `fake-indexeddb`
- esbuild bundles to CJS (`main.js`), externalizes `obsidian` and `electron`
- **Tests:** `npm test` (`vitest run`) -- unit tests under `tests/` cover validation, migration, import sanitizer, crypto, packing, Scheduler, blockStyling, dailySeed, ids

## Architecture

### IHomepagePlugin Interface
`types.ts` defines `IHomepagePlugin` to break circular deps. Blocks and views depend on the interface, never the concrete `HomepagePlugin` class.

### LayoutConfig
`LayoutConfig` in `types.ts` holds global layout state:
- `columns` -- grid column count (2–5)
- `layoutPriority` -- fill direction. Currently a single-value union (`'row'`); `'column'` is a reserved extension point not yet implemented (packing is always row-group-aware)
- `responsiveMode` -- `'unified'` (single adaptive layout) or `'separate'` (independent desktop + mobile)
- `mobileColumns` -- grid column count on mobile (1–3), used when `responsiveMode` is `'separate'`
- `mobileLayoutPriority` -- fill direction on mobile, used when `responsiveMode` is `'separate'`
- `mobileBlocks` -- block array for mobile, used when `responsiveMode` is `'separate'`
- `openOnStartup` -- auto-open homepage on Obsidian launch
- `openMode` -- how homepage opens on startup (`'replace-all'`, `'replace-last'`, `'retain'`)
- `manualOpenMode` -- how homepage opens from ribbon/command (same `OpenMode` values)
- `openWhenEmpty` -- open homepage when no other tabs are open
- `pin` -- prevent the homepage tab from being closed
- `separateStartup` -- when `true`, mobile devices use the `mobile*` startup overrides below instead of the desktop startup settings (default `false`). Independent of `responsiveMode` (gated on `Platform.isMobile` only), so startup behaviour can diverge per platform even with a unified layout
- `mobileOpenOnStartup` / `mobileOpenMode` / `mobileManualOpenMode` / `mobileOpenWhenEmpty` / `mobilePin` -- per-platform startup overrides applied on mobile when `separateStartup` is `true`. Validation defaults each to the resolved desktop value (so old `data.json` mirrors desktop until diverged)
- `showScrollbar` -- show the homepage scroll bar (default `true`; `false` hides it)
- `compactLayout` -- remove vertical gaps between blocks in view mode (default `true`); when `false`, y-packing is skipped so intentional gaps survive
- `hoverHighlight` -- subtly lift blocks on hover and reveal the collapse toggle (default `true`)
- `blocks` -- array of `BlockInstance` (desktop blocks, or the only blocks when `responsiveMode` is `'unified'`)

### Layout Model (GridStack coordinates)
`BlockInstance` uses `{ x, y, w, h }` -- 0-indexed column/row position and span. Old `col/row/colSpan/rowSpan` fields are auto-migrated in `migrateBlockInstance()`.

### Immutable Layout Mutations
Never mutate `BlockInstance` objects in place. Use the platform-aware helpers:
```typescript
// Read: always use activeBlocks() / activeColumns() / activeLayoutPriority()
const newBlocks = this.plugin.activeBlocks().map(b =>
  b.id === id ? { ...b, ...changes } : b,
);
// Write (in GridLayout): use buildLayoutUpdate() to route to correct field
this.onLayoutChange(this.buildLayoutUpdate(newBlocks));
// Write (elsewhere): use plugin.saveLayout() with the full layout
void this.plugin.saveLayout(this.buildLayoutUpdate(newBlocks));
```
`buildLayoutUpdate()` in `GridLayout` routes blocks to `mobileBlocks` or `blocks`
(and columns to `mobileColumns` or `columns`) based on `plugin.isMobileActive()`.

### Responsive Mode
`IHomepagePlugin` exposes platform-aware accessors:
- `isMobileActive()` -- true when `Platform.isMobile && responsiveMode === 'separate'`
- `activeBlocks()` -- returns `mobileBlocks` or `blocks`
- `activeColumns()` -- returns `mobileColumns` or `columns`
- `activeLayoutPriority()` -- returns `mobileLayoutPriority` or `layoutPriority`

All grid/toolbar code uses these accessors instead of reading `layout.blocks` directly.

### Per-Platform Startup
Startup behaviour is gated separately from layout via `separateStartup` (NOT `responsiveMode`). `IHomepagePlugin` exposes a parallel accessor set:
- `isMobileStartupActive()` -- true when `Platform.isMobile && separateStartup`
- `activeOpenOnStartup()` / `activeOpenMode()` / `activeManualOpenMode()` / `activeOpenWhenEmpty()` / `activePin()` -- each returns the `mobile*` override when `isMobileStartupActive()`, else the desktop value

All startup sites in `main.ts` (onLayoutReady, the open-when-empty `layout-change` handler, the open-homepage command + ribbon, and `openHomepage`'s pin) read through these accessors -- never `layout.openOnStartup` etc. directly. The settings tab (`renderStartupControls(root, mobile)`) reads the raw fields because it renders both halves explicitly.

### BaseBlock (`src/blocks/BaseBlock.ts`)
- Extends Obsidian `Component` -- use `this.registerInterval()`, `this.registerEvent()`, `this.register()` for auto-cleanup. Never raw `setInterval`/`vault.on`.
- `render(el)` -- abstract, sync or async
- `renderHeader(el, title)` -- renders muted header label. Respects `_showTitle` (default `true`; `false` hides), `_titleLabel`, `_titleEmoji`, `_titleSize` from config. Always use this, never inline header DOM.
- `renderContentSettings(body, draft)` -- override to render block-specific settings into `body`; mutate `draft` in place (the shared `BlockSettingsModal` owns commit/cancel). Replaces the old `openSettings` pattern
- `hasUnsavedInlineState()` -- override to return `true` while the block holds unsaved inline UI state (e.g. StaticText's pencil editor, VaultSearch's typed query); `GridLayout.rerender()` skips external rerenders while any block returns `true`
- `scheduleRender(delayMs, fn)` -- debounced re-render with `isConnected` guard
- `nextGeneration()` / `isStale(gen)` -- async staleness check (prevents race conditions when a newer render supersedes an older one)
- `containerEl` -- set by subclass in `render()` to enable `scheduleRender`
- `setHeaderContainer(el)` -- called by GridLayout to redirect header output to `block-header-zone` (outside `block-content`)
- `requestAutoHeight()` -- dispatches `request-auto-height` CustomEvent (bubbles) so GridLayout recalculates the block's row height
- `observeWidthForAutoHeight(el)` -- ResizeObserver that dispatches `requestAutoHeight()` when element width changes, rAF-throttled. Used by blocks whose content reflows on resize (ImageGallery, QuotesList). Cleanup auto-registered via `this.register()`.

### Auto-Height
Blocks that expand beyond their grid cell set the `data-auto-height-content` attribute (constant `AUTO_HEIGHT_ATTR`, exported from `src/grid/AutoHeight.ts`) on the measurement element. `AutoHeightManager.measureAndResize()` (in `src/grid/AutoHeight.ts`) reads its `offsetHeight` and calls `gridStack.update()`. Controlled per block by `GridLayout.shouldAutoHeight()` which checks `heightMode` config. Currently used by: `image-gallery`, `quotes-list` (extend mode), `embedded-note` (grow mode), `static-text`, `button-grid`, `random-note`.

### Live Reactivity
Data-driven blocks watch vault events via `this.registerEvent()` and re-render through `scheduleRender()`:
- `vault.on('create')` -- FolderLinks, ImageGallery, RecentFiles
- `vault.on('delete')` -- FolderLinks, ImageGallery, RecentFiles, EmbeddedNote, RandomNote, QuotesList
- `vault.on('rename')` -- FolderLinks, ImageGallery, RecentFiles, EmbeddedNote, RandomNote
- `vault.on('modify')` -- EmbeddedNote, RecentFiles
- `metadataCache.on('changed')` -- RandomNote, QuotesList (only when cache matches configured tag)

### Edit Mode
In edit mode, GridLayout renders compact symbolic placeholders (block type + size) instead of full block content. Settings and removal are handled via `block-handle-bar` controls. GridStack's `staticGrid` is toggled for drag/resize.

### Block Settings Flow
`BlockSettingsModal` (`src/modals/BlockSettingsModal.ts`) provides shared settings (_titleLabel, _titleEmoji, _showTitle, _titleSize, _showDivider, _showBorder, _showBackground, _showHeaderAccent, _cardPadding, _accentColor). All `_show*` visibility flags default to shown -- only `_showX === false` hides. The modal renders the block's own settings inline by calling `block.renderContentSettings(body, draft)`. Shared `_`-prefixed config keys are merged with block-specific config on save.

### Lightbox
`ImageGalleryBlock` opens a full-screen lightbox overlay on click. Implemented as plain DOM on `document.body` with `role="dialog"` + `aria-modal`. Supports arrow key navigation, swipe gestures on touch, prev/next buttons, and close via click/Escape. Focus moves into the overlay on open, Tab is trapped within it, and focus is restored to the opener on close. Lightbox ownership is scoped per block instance (`myLightboxAc`) to prevent cross-instance interference.

### Inline Edit Pattern
`StaticTextBlock` has a pencil button in view mode that opens an inline textarea editor directly within the block DOM. On save it mutates layout via `plugin.saveLayout()` and re-renders. Use this pattern for blocks where in-place editing is important.

## Layout Persistence

- `plugin.saveLayout(layout)` -> `this.saveData(layout)` (Obsidian handles file)
- Loaded in `onload()` via `validateLayout(await this.loadData())` -- validates every field, migrates old formats, clamps positions
- `getDefaultLayout()` returns `structuredClone` of template -- never mutate the template

## Adding a New Block Type

1. Create `src/blocks/MyBlock.ts` extending `BaseBlock`:
   - Implement `render(el)` (sync or async)
   - Async renders: `.catch(e => { console.error(...); el.setText('...'); })`
   - Use `this.renderHeader(el, title)` for block label
   - Use `this.registerInterval` / `this.registerEvent` / `this.register` for cleanup
   - For live data: set `this.containerEl = el` and use `scheduleRender()` + `nextGeneration()`/`isStale()`
   - For auto-height: set the `data-auto-height-content` attribute (`AUTO_HEIGHT_ATTR` from `src/grid/AutoHeight.ts`) on the measurement element, and call `this.observeWidthForAutoHeight(el)` if content reflows on width changes
   - Override `renderContentSettings(body, draft)` for block-specific settings (mutate `draft` in place); override `hasUnsavedInlineState()` if the block holds transient unsaved UI state
2. Add the type literal to `BLOCK_TYPES` array in `src/types.ts`
3. Register in `src/main.ts` -> `registerBlocks()`:
   ```typescript
   BlockRegistry.register({
     type: 'my-block',
     displayName: 'My Block',
     defaultConfig: { ... },
     defaultSize: { w: 1, h: 3 },
     create: (app, instance, plugin) => new MyBlock(app, instance, plugin),
   });
   ```
4. Add entry to `BLOCK_META` in `src/blockMeta.ts` (icon + description for add-block modal)
5. If auto-height is needed, add the type to `GridLayout.shouldAutoHeight()` in `src/GridLayout.ts`
6. Add CSS in `styles.css` using Obsidian CSS variables (`--background-secondary`, `--text-muted`, `--color-accent`, etc.)
7. Optionally add a default entry in `DEFAULT_LAYOUT_DATA` in `main.ts`

## Key Obsidian APIs

| API | Used in |
|-----|---------|
| `app.vault.getMarkdownFiles()` | tags.ts, EmbeddedNote, RecentFiles |
| `app.vault.read(file)` | QuotesList, EmbeddedNote, RandomNote |
| `app.vault.getAbstractFileByPath(path)` | FolderLinks, ImageGallery, EmbeddedNote, RandomNote |
| `app.vault.getResourcePath(file)` | ImageGallery (images/videos), RandomNote |
| `app.vault.getRoot()` | FolderSuggestModal |
| `app.metadataCache.getFileCache(file)` | QuotesList, RandomNote, tags.ts |
| `app.workspace.openLinkText(path, '')` | FolderLinks, ButtonGrid, Bookmarks, RecentFiles, RandomNote -- always `''` as source path |
| `MarkdownRenderer.render(app, md, el, path, component)` | EmbeddedNote, StaticText |
| `sanitizeHTMLToDom(html)` | HtmlBlock |
| `moment` (from `'obsidian'`) | Greeting, Clock, QuotesList, RecentFiles, RandomNote |
| `SuggestModal<T>` | FolderSuggestModal (FolderLinks, ImageGallery) |
| `AbstractInputSuggest<T>` | FileSuggest (EmbeddedNote) |
| `requestUrl` (from `'obsidian'`) | VoiceDictation (Whisper/Gemini API calls) |

## What NOT to Do

- Do not use `innerHTML` or `eval` -- use Obsidian DOM API (`createEl`, `createDiv`, `setText`) or `sanitizeHTMLToDom`
- Do not mutate `BlockInstance` in place -- always produce new objects via spread, then `saveLayout()`
- Do not call `loadData()`/`saveData()` from blocks -- go through `plugin.saveLayout()`
- Do not duplicate tag filtering logic -- use `getFilesWithTag` / `cacheHasTag` from `src/utils/tags.ts`
- Do not inline block headers -- use `this.renderHeader(el, title)` from BaseBlock
- Do not use raw `setInterval`/`vault.on` -- use `this.registerInterval()` / `this.registerEvent()`
- Do not add unnecessary runtime npm dependencies
- esbuild marks `console.debug`, `console.log`, `console.info`, and `console.trace` as `pure` in production builds and removes them. `console.warn` and `console.error` are retained; prefix their messages with `[Homepage Blocks]` and do NOT include raw third-party response bodies that may echo user content
- Do not store secrets in block config -- API keys in `data.json` are plaintext. Layout export strips `apiKey` fields but the on-disk storage is unencrypted
