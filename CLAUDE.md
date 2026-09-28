# Homepage Blocks -- Obsidian Plugin

Composable, drag-and-drop homepage for Obsidian.
TypeScript + Obsidian DOM API. GridStack for layout. No Dataview.

## Entry Points

- `src/main.ts` -- plugin lifecycle, block registration (`registerBlocks()`, exported so tests can register the real factories), commands, ribbon, settings tab wiring, layout persistence funnel (`saveLayout`/`updateBlockConfig`)
- `src/HomepageView.ts` -- `ItemView` subclass (`VIEW_TYPE = 'homepage-blocks'`), mounts grid + toolbar
- `src/GridLayout.ts` -- GridStack lifecycle wrapper: init/teardown, render, edit-mode placeholders, zoom, empty/skeleton state, drag/resize sync, `buildLayoutUpdate` write-routing. Delegates to `src/grid/*` managers
- `src/grid/` -- extracted GridStack concerns: `AutoHeight.ts` (`AUTO_HEIGHT_ATTR`, `AutoHeightManager`), `LayoutPersister.ts` (read/diff/write positions), `EditHandleBar.ts` (`attachEditHandleBar`, `swapWithNeighbor`), `CollapseToggle.ts` (`attachCollapseToggle`), `ResponsiveColumns.ts` (`ResponsiveColumnsManager`), `BlockWrapper.ts` (`buildBlockWrapper`/`createSkeleton`/`removeSkeleton`/`renderCompactPlaceholder`/`renderEmptyState` -- pure DOM builders), `packing.ts` (`packRows`/`repackEditLayout`, pure + unit-tested), `phase.ts` (`Phase` const object + union type). Each manager depends on a narrow `<Name>Host` interface that GridLayout implements (re-read at call time), never on GridLayout itself
- `src/modals/` -- `BlockSettingsModal.ts` (shared `_`-prefixed styling settings), `RemoveBlockConfirmModal.ts`, `ConfirmPresetModal.ts`
- `src/settings/HomepageSettingTab.ts` -- settings UI: startup/layout/display sections, export/import, reset, copy-to-mobile
- `src/EditToolbar.ts` -- floating edit FAB, toolbar (column picker, zoom slider, add-block modal), Discard snapshot/restore, `AddBlockModal`
- `src/blockMeta.ts` -- `BLOCK_META` (icon + description per block type, for the add-block modal)
- `src/types.ts` -- `BlockType`, `BlockInstance`, `LayoutConfig`, `BlockFactory`, `IHomepagePlugin`
- `src/validation.ts` -- `validateLayout`, `validateBlocks` (ID dedup + clamp), `migrateBlockInstance` (idempotent), `getDefaultLayout`
- `src/BlockRegistry.ts` -- the `BlockRegistry` singleton (class `BlockRegistryClass`, unexported) wrapping `Map<BlockType, BlockFactory>`
- `src/blocks/BaseBlock.ts` -- abstract base extending `Component`; `renderContentSettings`, `hasUnsavedInlineState`, `liveConfig`, `scheduleRender`, `renderErrorHint`, auto-height helpers
- `src/utils/` -- one helper concern per file (full list, one line each: `docs/architecture.md` §2 Module map). Non-obvious ones: `apiKeyCrypto.ts` + `apiKeyLayout.ts` (API keys at rest, see What NOT to Do), `loadRecovery.ts` (see Layout Persistence), `importSanitizer.ts` (clipboard-import allowlist, see Block Types), `blockStyling.ts` (`applyBlockStyling`; `STYLE_RANGES`/`clampStyle`, the one range table for numeric `_` keys), `tags.ts` (`getFilesWithTag`/`cacheHasTag`/`normalizeTag`, per-file cache invalidation), `layoutReset.ts` (`buildResetLayout`, `MOBILE_LAYOUT_FIELDS`, `STARTUP_FIELDS`), `startupResolver.ts` (`resolveStartup`, `mobileStartupActive` -- pure), `urls.ts` (`isDangerousUrl` navigation gate), `Scheduler.ts` (named timers/rAF), `noteContent.ts` (`parseNoteInsight`, QuotesList)
- `src/blocks/` -- one file per block type (17 total)
- `styles.css` -- all styles at repo root

## Block Types (17)

`greeting`, `clock`, `folder-links`, `button-grid`, `quotes-list`, `image-gallery`, `embedded-note`, `static-text`, `html`, `video-embed`, `bookmarks`, `recent-files`, `pomodoro`, `spacer`, `random-note`, `voice-dictation`, `vault-search`

Each defined in `BLOCK_TYPES` array in `src/types.ts` and registered in `registerBlocks()` in `src/main.ts`.

Each factory's `defaultConfig` declares every config key its block reads (a key with no default of its own as `undefined`, which never reaches `data.json`): it seeds new blocks and is the clipboard-import allowlist, which also type-checks imported values against these defaults. An undeclared key is stripped on import. `customCss` (button-grid) is the one deliberate exception: like `apiKey`, it never travels through export/import.

## Build

```bash
npm run build          # esbuild -> main.js (root)
npm run dev            # watch mode
npx tsc --noEmit       # type-check src/ (tests are not type-checked) -- run after every .ts change
npx eslint src         # lint (obsidianmd rules; no-floating-promises -> prefix an intentionally un-awaited promise with `void`)
```

`strict: true` is enabled. Always confirm zero tsc errors before finishing. Every `eslint-disable` comment needs a description; `obsidianmd/no-static-styles-assignment` and `obsidianmd/ui/sentence-case` may not be disabled.

This repository is the installed plugin folder of a live vault: `npm run build` / `npm run dev` overwrite the `main.js` Obsidian is running, and `data.json` at the repo root (plus its `data.json.invalid*` backups) is the user's live layout -- never read, edit, or commit it. Run a build only when asked.

### Release
A release commit bumps `version` in `manifest.json` and `package.json`, adds a `versions.json` entry (version -> `minAppVersion`), commits the rebuilt `main.js` (tracked in git), and uses the message `release: X.Y.Z -- <summary>`.

## Dependencies

- **Runtime:** `gridstack` (grid layout engine) -- the only runtime dependency
- **Dev:** `obsidian`, `typescript`, `esbuild`, `@types/node`, `eslint`, `eslint-plugin-obsidianmd`, `typescript-eslint`, `@typescript-eslint/parser`, `@eslint/js`, `@eslint-community/eslint-plugin-eslint-comments`, `globals`; tests via `vitest`, `happy-dom`, `fake-indexeddb`
- esbuild bundles to CJS (`main.js`), externalizes `obsidian`, `electron`, and Node builtins (via `node:module`'s `builtinModules`)
- **Tests:** `npm test` (`vitest run`; `npm run test:watch` to watch). `vitest.config.ts` runs `tests/**/*.test.ts` under happy-dom, aliases `obsidian` to the hand-written mock `tests/__mocks__/obsidian.ts` (an Obsidian API newly used by code under test must be added there), and loads `tests/setup.ts` (fake-indexeddb + the `tests/obsidian-dom.ts` HTMLElement shim). Test files mirror `src/`: `src/<dir>/<Name>.ts` -> `tests/<dir>/<Name>.test.ts`, root modules at the `tests/` top level. `importSanitizer` tests run against the real factories via `registerBlocks()`. The mock mirrors the host behaviour the code depends on: `Component.unload()` does nothing unless `load()` ran, and calls `onunload()` last (so a test mounts a block with `load()` then `render()`, as `GridLayout` does), `Modal.close()` runs `onClose` synchronously except on phones, `SuggestModal.selectSuggestion` closes before it reports the pick, `ToggleComponent.setValue` fires `onChange`

## Test-Suite Rules

1. Search before writing: before creating any test file, locate the existing test file for the target source file and extend it. Creating a parallel test file for an already-tested source file is forbidden.
2. One test file per source file, mirroring the source path (for example `src/foo/bar.py` maps to `tests/unit/foo/test_bar.py`), following this project's established convention.
3. Keep test layers explicit (unit, integration, e2e), each in its own directory with a runtime budget. A new test goes in the lowest layer that can express the behavior.
4. Test behavior through public interfaces, never implementation details. A refactor that preserves behavior must not break tests.
5. Never mark a test skipped (`.skip`, `xfail`, `@Disabled`, or equivalent) to make CI pass. Fix it, or quarantine it with a tracked reason.
6. Never weaken an assertion to make a failing test pass. A failing assertion is a signal about the code, not an obstacle in the test.
7. When deleting a feature, delete its tests in the same commit.

## Architecture

### IHomepagePlugin Interface
`types.ts` defines `IHomepagePlugin` to break circular deps. Blocks and views depend on the interface, never the concrete `HomepagePlugin` class.

### LayoutConfig
`LayoutConfig` in `types.ts` holds global layout state:
- `columns` -- grid column count (2-5)
- `layoutPriority` -- fill direction; the union holds only `'row'` (packing is always row-group-aware). `'column'` is a reserved extension point: the `priority` params threaded through `packing.ts`/`GridLayout`/`LayoutPersister` are intentionally ignored; do not delete that plumbing without a plan to drop the reserved value
- `responsiveMode` -- `'unified'` (single adaptive layout) or `'separate'` (independent desktop + mobile)
- `mobileColumns` -- grid column count on mobile (1-3), used when `responsiveMode` is `'separate'`
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
- `compactLayout` -- remove vertical gaps between blocks in view mode (default `true`); when `false`, the initial y-packing is skipped, but `AutoHeightManager` still row-packs and persists every block after an auto-height change, so gaps survive only until an auto-height block changes height
- `hoverHighlight` -- subtly lift blocks on hover and reveal the collapse toggle (default `true`)
- `blocks` -- array of `BlockInstance` (desktop blocks, or the only blocks when `responsiveMode` is `'unified'`)

Adding a field: declare it in `types.ts`, give it a default in `DEFAULT_LAYOUT_DATA`, and read it in `validateLayout` (which rebuilds the layout field by field: an unlisted field is dropped at the next load, since the validated layout is re-saved on every load; `validateLayout` must stay idempotent). If a layout reset must preserve it, add it to `STARTUP_FIELDS` or `MOBILE_LAYOUT_FIELDS` in `src/utils/layoutReset.ts`.

### Layout Model (GridStack coordinates)
`BlockInstance` uses `{ x, y, w, h }` -- 0-indexed column/row position and span. Old `col/row/colSpan/rowSpan` fields are auto-migrated in `migrateBlockInstance()`. Optional `collapsed` and `_expandedH` (the height to restore on expand) are written by `src/grid/CollapseToggle.ts`. Collapsing leaves `h` at the expanded height, so the rows a block is drawn at in view mode come from `viewModeHeight(instance)` (same file), never from `h` directly.

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

`IHomepagePlugin` exposes three write methods, all on the serialized `savePromise` chain:
- `saveLayout(layout)` -- write a full `LayoutConfig` (re-encrypts `apiKey` fields)
- `saveActiveBlocks(blocks)` -- convenience: routes `blocks` to `mobileBlocks`/`blocks` via `isMobileActive()`, then `saveLayout`
- `updateBlockConfig(id, patch)` -- awaits the chain, then patches one block's `config` and saves (so a config patch can't clobber an in-flight positional save)

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
- `renderContentSettings(body, draft)` -- override to render block-specific settings into `body`; mutate `draft` in place (the shared `BlockSettingsModal` owns commit/cancel). In edit mode the modal gets a temporary, never-rendered block from the factory (unloaded on close), so this must not rely on state set in `render()`
- `hasUnsavedInlineState()` -- override to return `true` while the block holds unsaved inline UI state (e.g. StaticText's pencil editor, VaultSearch's typed query); `GridLayout.rerender()` skips external rerenders while any block returns `true`
- `scheduleRender(delayMs, fn)` -- debounced re-render with `isConnected` guard
- `nextGeneration()` / `isStale(gen)` -- async staleness check (prevents race conditions when a newer render supersedes an older one)
- `containerEl` -- set by subclass in `render()` to enable `scheduleRender`
- `liveConfig()` -- the block's config as the layout holds it now. `this.instance` is the render-time snapshot: `plugin.updateBlockConfig` replaces the block's objects and never updates it, so a block that saves its own config reads it back through `liveConfig()` once the save resolves (see Inline Edit Pattern)
- `openLinksOnClick(el, sourcePath)` -- makes `[[links]]` in `MarkdownRenderer.render` output open on click (left, middle, Ctrl), as reading view does; the static render wires no link handling of its own
- `setHeaderContainer(el)` -- called by GridLayout to redirect header output to `block-header-zone` (outside `block-content`)
- `requestAutoHeight()` -- dispatches `request-auto-height` CustomEvent (bubbles) so GridLayout recalculates the block's row height
- `observeWidthForAutoHeight(el)` -- ResizeObserver that dispatches `requestAutoHeight()` when element width changes, rAF-throttled. Used by blocks whose content reflows on resize (ButtonGrid, ImageGallery, QuotesList, RandomNote). Disconnected in `BaseBlock.onunload()`, so a subclass that overrides `onunload()` must call `super.onunload()`.

### Auto-Height
Blocks whose content reflows beyond their grid cell set `autoHeight: true` on their `BlockFactory` in `registerBlocks()` AND set the `data-auto-height-content` attribute (constant `AUTO_HEIGHT_ATTR`, exported from `src/grid/AutoHeight.ts`) on the measurement element inside `render(el)`. `AutoHeightManager.measureAndResize()` reads its `offsetHeight` and calls `gridStack.update()`. `GridLayout.shouldAutoHeight()` reads the factory flag, then applies the per-type `heightMode` opt-outs (image-gallery and static-text `fixed`, quotes-list `wrap`, embedded-note anything but `grow`).

### Live Reactivity
Data-driven blocks watch vault events via `this.registerEvent()` and re-render through `scheduleRender()`:
- `vault.on('create')` -- FolderLinks, ImageGallery, RecentFiles
- `vault.on('delete')` -- FolderLinks, ImageGallery, RecentFiles, EmbeddedNote, RandomNote, QuotesList
- `vault.on('rename')` -- FolderLinks, ImageGallery, RecentFiles, EmbeddedNote, RandomNote
- `vault.on('modify')` -- EmbeddedNote, ImageGallery, RecentFiles
- `metadataCache.on('changed')` -- RandomNote, QuotesList (only when cache matches configured tag)

### Edit Mode
In edit mode, GridLayout renders compact symbolic placeholders (block type + size) instead of full block content. Settings and removal are handled via `block-handle-bar` controls. GridStack's `staticGrid` is toggled for drag/resize.

### Block Settings Flow
`BlockSettingsModal` (`src/modals/BlockSettingsModal.ts`) provides shared settings on its Header / Body / Card tabs (_titleLabel, _titleEmoji, _showTitle, _titleSize, _showDivider, _titleGap, _showHeaderAccent, _cardPadding, _showBackground, _bgOpacity, _backdropBlur, _gradientStart, _gradientEnd, _gradientAngle, _accentColor, _accentIntensity, _showBorder, _borderWidth, _borderStyle, _borderRadius, _elevation). The `_show*` visibility flags default to shown -- only `_showX === false` hides -- except `_showDivider`, which shows only when `true`. Numeric ranges come from `STYLE_RANGES` in `src/utils/blockStyling.ts`, shared by the sliders, the render clamps and the import validators. The Content tab renders the block's own settings by calling `block.renderContentSettings(body, draft)`. Save replaces the block's whole `config` with the draft (shared and block-specific keys together). Keys starting with `_` are reserved for these shared settings; block-specific config keys must not start with `_`. A new shared key needs its control in `BlockSettingsModal`, its rendering in `applyBlockStyling` (plus a `STYLE_RANGES` entry if numeric), and a validator in `SHARED_VALIDATORS` (`src/utils/importSanitizer.ts`).

### Lightbox
`ImageGalleryBlock` opens a full-screen lightbox overlay on click. Implemented as plain DOM on `activeDocument.body` (popout-safe) with `role="dialog"` + `aria-modal`. Supports arrow key navigation, swipe gestures on touch, prev/next buttons, and close via click/Escape. Focus moves into the overlay on open, Tab is trapped within it, and focus is restored to the opener on close. Lightbox ownership is scoped per block instance (`myLightboxAc`) to prevent cross-instance interference.

### Inline Edit Pattern
`StaticTextBlock` has a pencil button in view mode that opens an inline textarea editor directly within the block DOM. On save it calls `plugin.updateBlockConfig(id, patch)`, awaits it, and only then re-renders, reading the content through `this.liveConfig()` -- never `this.instance.config`, the render-time snapshot, which still holds the pre-save value. `hasUnsavedInlineState()` stays `true` until the save has landed, which holds off external rerenders. A teardown that bypasses that guard (entering edit mode, a reload from settings, closing the tab) unloads the block with the editor open: `onunload` then saves the draft through `saveActiveBlocks`, which updates the layout synchronously, unless the stored text changed meanwhile (Reset, Import). `EditToolbar` takes its Discard snapshot after `grid.setEditMode(true)` so that the saved draft is in it. Use this pattern for blocks where in-place editing is important. `EmbeddedNoteBlock` uses the same save-then-`liveConfig()` pattern without an editor: when its note is renamed it saves the new `filePath` via `updateBlockConfig` and re-renders from `liveConfig()`.

## Layout Persistence

- `plugin.saveLayout(layout)` sets `plugin.layout` synchronously, then on the serialized chain checks `DataFileGuard` and writes `persistableLayout(layout)` (a copy with `apiKey`s encrypted) via `this.saveData`
- Loaded in `onload()` via `loadLayoutWithRecovery(await this.loadData(), dataPath, adapter)` (`src/utils/loadRecovery.ts`), which runs `validateLayout` (validates every field, migrates old formats, clamps positions, drops blocks that fail the schema, a non-object `config` included). When `data.json` is unreadable, not an object, has a non-array `blocks`/`mobileBlocks`, or loses blocks, the file is copied verbatim to `data.json.invalid` (`.<ms>` suffix when taken); until that copy exists `DataFileGuard` holds back every `saveLayout` write. How a missing file (`null`) is told from an unreadable one (`undefined`): `loadRecovery.ts` and `docs/data-model.md` §7
- `getDefaultLayout()` returns `structuredClone` of template -- never mutate the template

## Adding a New Block Type

1. Create `src/blocks/MyBlock.ts` extending `BaseBlock`:
   - Implement `render(el)` (sync or async)
   - Async renders: `.catch(e => { console.error('[Homepage Blocks] MyBlock failed to render:', e); this.renderErrorHint(el, '...'); })`
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
   Declare every config key the block reads in `defaultConfig` (a key with no default of its own as `undefined`); an undeclared key is stripped on import
4. Add entry to `BLOCK_META` in `src/blockMeta.ts` (icon + description for add-block modal)
5. If auto-height is needed, set `autoHeight: true` on the factory (step 3) and mark the measured element (step 1); add a branch to `GridLayout.shouldAutoHeight()` in `src/GridLayout.ts` only when the block has a `heightMode` that opts out
6. Add CSS in `styles.css` using Obsidian CSS variables (`--background-secondary`, `--text-muted`, `--color-accent`, etc.)
7. Optionally add a default entry in `DEFAULT_LAYOUT_DATA` in `src/validation.ts`

## Key Obsidian APIs

| API | Used in |
|-----|---------|
| `app.vault.getMarkdownFiles()` | tags.ts, EmbeddedNote, RecentFiles, VaultSearch |
| `app.vault.read(file)` | QuotesList, EmbeddedNote, RandomNote |
| `app.vault.getAbstractFileByPath(path)` | FolderLinks, ImageGallery, EmbeddedNote, RandomNote, VoiceDictation |
| `app.vault.getResourcePath(file)` | utils/imageCache.ts (ImageGallery images/videos), RandomNote |
| `app.vault.getRoot()` | FolderSuggestModal, FolderLinks |
| `app.metadataCache.getFileCache(file)` | QuotesList, RandomNote, tags.ts |
| `app.workspace.openLinkText(path, '')` | FolderLinks, ButtonGrid, Bookmarks, RecentFiles, RandomNote, VaultSearch -- always `''` as source path; only `BaseBlock.openLinksOnClick` passes the path the Markdown was rendered from |
| `MarkdownRenderer.render(app, md, el, path, component)` | EmbeddedNote, StaticText -- renders DOM only; call `this.openLinksOnClick(el, path)` on the same element or its links do nothing when clicked |
| `sanitizeHTMLToDom(html)` | HtmlBlock |
| `moment` (from `'obsidian'`) | Greeting, Clock, RecentFiles, VoiceDictation, utils/dailySeed.ts (used by QuotesList, RandomNote) |
| `SuggestModal<T>` | FolderSuggestModal (FolderLinks, ImageGallery), AddBlockModal (EditToolbar) |
| `AbstractInputSuggest<T>` | FileSuggest (EmbeddedNote) |
| `requestUrl` (from `'obsidian'`) | VoiceDictation (Whisper/Gemini API calls) |
| `app.loadLocalStorage` / `app.saveLocalStorage` | main.ts (unreadable-key record), VoiceDictation (consent) |

## Working Principles

### 1. Think Before Coding
State assumptions explicitly. Ask when uncertain.
Present tradeoffs; don't pick silently.
- Read related code before editing; understand the call sites
- Isolate the root cause; don't patch symptoms
- Surface unknowns instead of guessing

### 2. Simplicity First
Minimum code that solves the problem.
No speculative features or abstractions.
- One responsibility per function or module
- Delete code when it stops paying rent
- Prefer composition over premature inheritance

### 3. Surgical Changes
Touch only what the task requires.
Match existing style. Clean up only your own orphans.
- No drive-by refactors outside the task scope
- Preserve public APIs unless the task requires a change
- Keep diffs small and reviewable

### 4. Goal-Driven Execution
Define success criteria, then loop until verified.
Transform "do X" into "X passes test Y".
- Write tests against behavior, not internals (evergreen tests)
- Verify with real evidence: run the code, read the output
- Stop when the criteria are met; don't gold-plate

### 5. Centralize Shared Logic
Route external calls (HTTP clients, broker APIs, LLM/embedding providers, payment gateways, DB access) and cross-cutting concerns (config, auth, logging) through a single utility, client, or facade module. Apply DRY and Single Source of Truth: one change, one place. Before adding a new call site, check whether an existing client/wrapper already exists and extend it instead of duplicating.

## What NOT to Do

- Do not use `innerHTML` or `eval` -- use Obsidian DOM API (`createEl`, `createDiv`, `setText`) or `sanitizeHTMLToDom`
- Do not mutate `BlockInstance` in place -- always produce new objects via spread, then `saveLayout()`
- Do not call `loadData()`/`saveData()` from blocks -- go through `plugin.saveLayout()`
- Do not duplicate tag filtering logic -- use `getFilesWithTag` / `cacheHasTag` from `src/utils/tags.ts`
- Do not inline block headers -- use `this.renderHeader(el, title)` from BaseBlock
- Do not use raw `setInterval`/`vault.on` -- use `this.registerInterval()` / `this.registerEvent()`
- Do not use bare `document`, `setTimeout`, `clearTimeout`, `requestAnimationFrame`, or `cancelAnimationFrame` (ObsidianReviewBot popout-window rules). Use `el.doc`/`el.win` when an element is in scope, `activeDocument` otherwise, `window.setTimeout`/`window.requestAnimationFrame`/`window.cancelAnimationFrame` for timers, global `createEl(...)`/`createSvg(...)` for detached elements, and `el.createSpan(...)` over `el.createEl('span', ...)`. The test shim in `tests/obsidian-dom.ts` polyfills `doc`/`win`
- Do not use `window.localStorage` directly -- use `app.loadLocalStorage(key)` / `app.saveLocalStorage(key, value)` (vault-scoped, per device; ObsidianReviewBot rule; needs `minAppVersion` >= 1.8.7), wrapped in try/catch as in `main.ts`
- Do not add unnecessary runtime npm dependencies
- Do not leave module-level state (outside a `Component`) unreleased -- release it in `HomepagePlugin.onunload` (as `imageCache.destroy`, `clearPomodoroState`, `closeSharedAudioCtx`, `abortActiveLightbox`, `_resetDeviceKeyCache` do) and re-arm it in `onload` if needed (`imageCache.reset()`)
- Do not leave `console.debug`/`log`/`info`/`trace` in `src/`: esbuild marks them `pure` in production builds, but the build does not minify, so a call inside a function survives into `main.js` (only unused top-level calls are dropped). `console.warn` and `console.error` are retained; prefix their messages with `[Homepage Blocks]` and do NOT include raw third-party response bodies that may echo user content
- API keys in `data.json` are **encrypted at rest** (AES-GCM-256 via `apiKeyCrypto.ts`, with a non-extractable per-device key in IndexedDB; layout-wide helpers in `apiKeyLayout.ts`); `saveLayout` re-encrypts on every write, `onload` decrypts to plaintext in memory. The in-memory `plugin.layout` holds plaintext wherever this device can decrypt (blocks read `config.apiKey` directly). A key it cannot decrypt (saved on another device, or the key store is temporarily unavailable) stays ciphertext in memory and round-trips unchanged, so the device that saved it keeps it through sync: never clear such a key on load, and treat an `isEncrypted(apiKey)` value in a block as "no usable key on this device" (never send it). Refuse-to-downgrade logic never overwrites stored ciphertext with plaintext when WebCrypto is unavailable. Layout export and import strip `apiKey`. There is one `apiKey` slot per block: entering a key on another device replaces it for every device sharing that block
- Do not read a block's own saved config from `this.instance` after `plugin.updateBlockConfig` -- it is the render-time snapshot; use `this.liveConfig()` once the save resolves
