# Block API

This is the interface reference for block authors. It covers `BaseBlock`, `BlockFactory` and its `defaultConfig` contract, `BlockRegistry` and `BLOCK_META`, and ends with a step-by-step guide to adding a block type. It describes the code on branch `xray-remediation` after the X-ray fixes of 2026-10-10. Where a comment or `CLAUDE.md` says something else, the code is what is documented here, and the differences are listed at the end.

Related docs:

- [../architecture.md](../architecture.md): layers, module map, ownership.
- [../data-model.md](../data-model.md): `BlockInstance`, `LayoutConfig`, validation, migration.
- [../flows.md](../flows.md): load, save, import/export, settings flows.
- [../blocks.md](../blocks.md): what each of the 17 blocks does, including its config keys.
- [../styling.md](../styling.md): the shared `_` styling keys and CSS conventions.
- [plugin.md](plugin.md): `IHomepagePlugin` and the persistence chain.
- [grid.md](grid.md): `GridLayout`, `AutoHeightManager`, `LayoutPersister`.

---

## At a glance

| Piece | Where | Role |
|---|---|---|
| `BaseBlock` | `src/blocks/BaseBlock.ts:7` | Abstract base class for every block. Extends Obsidian `Component` |
| `BlockFactory` | `src/types.ts:90-103` | Describes one block type: name, default config, default size, auto-height flag, constructor |
| `registerBlocks()` | `src/main.ts:41-207` | Registers the 17 factories. Exported so tests can register the real ones |
| `BlockRegistry` | `src/BlockRegistry.ts:3-23` | Singleton `Map<BlockType, BlockFactory>` |
| `BLOCK_META` | `src/blockMeta.ts:3-21` | Icon and description per type, for the Add Block picker |
| `BLOCK_TYPES` | `src/types.ts:4-10` | The closed list of type ids. `BlockType` is derived from it (`:12`) |
| `AUTO_HEIGHT_ATTR` | `src/grid/AutoHeight.ts:13` | `'data-auto-height-content'`, the marker on the element whose height is measured |
| `sanitizeImportedConfig` | `src/utils/importSanitizer.ts:78-121` | Clipboard-import filter driven by `defaultConfig` |
| `CONFIG_RANGES`, `rangedNumber` | `src/utils/configRanges.ts:10-36` | Bounds of numeric block settings, clamped at import and where blocks read them |

```mermaid
flowchart LR
  T["BLOCK_TYPES<br/>types.ts"] --> F["BlockFactory<br/>registerBlocks() in main.ts"]
  T --> M["BLOCK_META<br/>blockMeta.ts"]
  F --> R["BlockRegistry"]
  R --> A["AddBlockModal<br/>(EditToolbar)"]
  M --> A
  R --> G["GridLayout.mountBlock<br/>factory.create + render"]
  R --> E["EditHandleBar settings button<br/>(temp block for Content tab)"]
  R --> S["BlockSettingsModal<br/>(displayName for heading)"]
  R --> I["importSanitizer<br/>defaultConfig allowlist"]
  R --> H["GridLayout.shouldAutoHeight<br/>factory.autoHeight"]
  G --> B["BaseBlock subclass"]
  E --> B
  S -->|renderContentSettings| B
```

---

## Block lifecycle

### Mounting

`GridLayout.mountBlock` (`src/GridLayout.ts:470-558`) builds the wrapper DOM and then, in view mode only, runs the steps below. In edit mode no block object is created. The grid draws a placeholder instead (`renderCompactPlaceholder`, `src/grid/BlockWrapper.ts:75-95`) and stores `block: null` (`src/GridLayout.ts:496-499`).

```mermaid
sequenceDiagram
  participant G as GridLayout.mountBlock
  participant F as BlockFactory
  participant B as Block (BaseBlock)
  participant A as AutoHeightManager
  G->>G: buildBlockWrapper(): wrapper, header zone, .block-content
  G->>F: create(app, instance, plugin)
  F-->>G: block
  G->>B: setHeaderContainer(headerZone)
  G->>B: load()
  opt shouldAutoHeight(instance)
    G->>G: listen for 'request-auto-height' on the grid item
  end
  opt initial render
    G->>G: createSkeleton(wrapper)
  end
  G->>B: render(contentEl)
  alt returns a Promise
    B-->>G: resolves
    G->>G: removeSkeleton
    G->>A: request (if auto-height)
  else returns void
    G->>G: remove skeleton
    G->>A: request (if auto-height)
  end
```

Cites: create `:501`, `setHeaderContainer` `:502`, `load()` `:503`, listener `:510-517`, skeleton `:519`, render `:524-529`, async branch `:530-542`, sync branch `:543-547`.

`el`, the element passed to `render`, is the wrapper's `.block-content` (`src/grid/BlockWrapper.ts:47`). The wrapper also carries:

- the classes `homepage-block-wrapper hp-block-<type>` (`:20`)
- the shared styling from `applyBlockStyling(wrapper, instance.config)` (`:29`)
- a header zone `.block-header-zone.hp-header-empty` holding the collapse chevron (`:36-43`)
- an optional `.block-header-divider` when `_showDivider === true` (`:44-46`)

### When a block object is created and destroyed

A block object lives for one mount. `render(el)` is called once per object. Every grid render first calls `teardown()`, which calls `unload()` on every block (`src/GridLayout.ts:321-323`), and then mounts new objects. These paths re-mount:

| Trigger | Path |
|---|---|
| View opened, or reloaded: by the settings tab (responsive mode, columns, compact layout, copy-to-mobile, reset, import: `src/settings/HomepageSettingTab.ts:69,292,364,452`), by another homepage view whose edit session ended (`EditSessionHooks.ended`), or by a `data.json` written by another device (`onExternalSettingsChange` → `reload(true)`) | `HomepageView.onOpen` / `reload` (`src/HomepageView.ts:25-65`, `:100-109`). `reload` ends an open edit session as Done first |
| Edit mode entered or left | `GridLayout.setEditMode` → `render` (`src/GridLayout.ts:222`) |
| Add block (toolbar, empty-state button, or the `add-block` command, which also works in view mode) | `GridLayout.addBlock` → `render`, directly (`:284-295`) |
| Column change, settings Save, duplicate, move up/down, removing the last block | `rerender` via `setColumns` (`:255`) or `EditHandleBar` → `triggerRerender` (`src/grid/EditHandleBar.ts:88,104,173,251`) |

These do **not** re-mount: `plugin.updateBlockConfig`, `plugin.saveLayout`, `plugin.followRename`, and responsive column changes. `ResponsiveColumnsManager` updates GridStack nodes in place (`src/grid/ResponsiveColumns.ts:106-211`).

Consequences:

- State kept on `this` (caches, the selected tab, timers) is lost on every re-mount. State that must survive, such as the Pomodoro timer, lives at module level and is keyed by block id (`src/blocks/PomodoroBlock.ts:17-22`).
- Register vault events, intervals and cleanups in `render()`, not in a function that runs again on every re-render, where they pile up until unload. QuotesList registers its column-observer cleanup in `render` for this reason (`src/blocks/QuotesListBlock.ts:72-73`).

### Render errors and the skeleton

- **Throw handling.** A synchronous throw from `render` is caught and turned into a rejected promise, so it takes the same path as a failed async render (`src/GridLayout.ts:520-529`). A rejection logs `[Homepage Blocks] Error rendering block <type>:` and replaces the content with the text `Error rendering block. Check console for details.` (`:538-542`).
- **Own error UI.** Blocks should catch their own errors and call `renderErrorHint` for a styled message (as `src/blocks/EmbeddedNoteBlock.ts:50-53` does). GridLayout's text is the fallback.
- **Skeleton.** It is created only on the initial render (`:519`). For an async render it stays until the promise settles (`:535`, `:539`), so a slow `render()` promise keeps the card covered. Resolve the promise when the first useful paint is done, not after background work.

---

## BaseBlock

`export abstract class BaseBlock extends Component` (`src/blocks/BaseBlock.ts:7`).

### Constructor and fields

`constructor(protected app: App, protected instance: BlockInstance, protected plugin: IHomepagePlugin)` (`:17-23`).

| Field | Visibility | Meaning |
|---|---|---|
| `app` | protected | Obsidian `App` |
| `instance` | protected | The `BlockInstance` this object was mounted from. It is a **snapshot**: it is never updated after mount. See [Reading config](#reading-config-instance-versus-liveconfig) |
| `plugin` | protected | `IHomepagePlugin` (`src/types.ts:105-141`). Blocks today use only `activeBlocks()` and `updateBlockConfig()`, plus `saveActiveBlocks()` in StaticText's `onunload` (`src/blocks/StaticTextBlock.ts:29`). See [plugin.md](plugin.md) |
| `containerEl` | protected, `HTMLElement \| null` | Set it to `el` in `render()`. Until it is set, a scheduled `fn` never runs and `requestAutoHeight` dispatches nothing, so the requests `observeWidthForAutoHeight` makes are dropped too (`:15`, `:134-135`, `:158`) |
| `_headerContainer`, `_scheduleTimer`, `_renderGen`, `_widthObserver`, `_widthRafId` | private | Internal state for the helpers below (`:8-12`) |

`TITLE_SIZE_RE = /^h[1-6]$/` is exported from the same file (`:5`). `BlockSettingsModal` and `importSanitizer` use it too.

### Member reference

| Member | Kind | You… | Summary | Line |
|---|---|---|---|---|
| `render(el)` | abstract, `void \| Promise<void>` | implement | Build the block into `.block-content` | `:25` |
| `renderContentSettings(body, draft)` | public, default no-op | override | Block-specific controls for the settings modal's Content tab | `:30` |
| `hasUnsavedInlineState()` | public, default `false` | override | Return `true` while unsaved inline UI would be lost by a re-mount | `:38-40` |
| `liveConfig()` | protected | call | The block's config as the layout holds it now | `:48-50` |
| `setHeaderContainer(el)` | public | don't call | GridLayout points header output at the header zone | `:53-55` |
| `renderHeader(el, title)` | protected | call | Render or remove the header label | `:60-81` |
| `renderErrorHint(el, message)` | protected | call | Empty `el` and show a ⚠ error state | `:89-94` |
| `scheduleRender(delayMs, fn)` | protected | call | Debounced re-render, then an auto-height request; a failure shows an error hint | `:130-154` |
| `requestAutoHeight()` | protected | call | Ask the grid to re-measure this block | `:157-159` |
| `observeWidthForAutoHeight(el)` | protected | call | Re-measure when `el` changes width | `:167-185` |
| `nextGeneration()` | protected | call | Start a render generation; returns its number | `:188-190` |
| `isStale(gen)` | protected | call | `true` once a newer generation has started | `:193-195` |
| `onunload()` | public | override with `super.onunload()` | Clears the schedule timer and the width observer | `:197-207` |

Inherited from `Component` and used by blocks: `registerEvent`, `registerInterval`, `registerDomEvent`, `register`. Use them for everything that must stop when the block unloads. Raw `setInterval` and `vault.on` are forbidden by `CLAUDE.md`.

### `render(el)`

- `el` is `.block-content`. CSS makes it a grid, `display: grid; grid-template-rows: 1fr`, and by default every direct child gets `overflow: hidden; min-height: 0` (`styles.css:2495-2505`). Some blocks override this for their children, for example greeting (`styles.css:2529-2532`), and the scrolling height modes of embedded-note, quotes-list and image-gallery restore `overflow-y: auto` on their scroll element (`styles.css:2507-2515`).
- **Sync or async.**
  - Return a promise when there is async work. GridLayout then waits for it before removing the skeleton and measuring auto-height.
  - A sync render is queued for measurement as soon as it returns; the measurement runs in the next animation frame (`src/GridLayout.ts:543-547`, `src/grid/AutoHeight.ts:54-57`). Content written later is not re-measured unless the block asks for it. StaticText returns `void` and renders Markdown asynchronously, so its first measurement can come before the Markdown is in place (`src/blocks/StaticTextBlock.ts:36-41`).
- **Error handling.** Catch your own errors: `.catch(e => { console.error('[Homepage Blocks] …', e); this.renderErrorHint(el, '…'); })`.
- **Re-renders.** GridLayout never empties `el` for you on a re-render. The function passed to `scheduleRender` must call `el.empty()` itself. Classes added to `el` stay across re-renders, so toggle config-dependent classes rather than adding them (`src/blocks/EmbeddedNoteBlock.ts:66`).

### Headers: `renderHeader(el, title)`

The header renders into the header zone, outside `.block-content`, whenever GridLayout has set one (`src/blocks/BaseBlock.ts:62`). Behaviour, in order:

1. Reads `this.instance.config`, the snapshot, not `liveConfig()` (`:61`).
2. Label = `_titleLabel.trim()` when that is a non-blank string, otherwise `title` (`:63-65`).
3. Removes any `.block-header` left from an earlier render (`:69`). `el.empty()` does not reach the header zone.
4. Toggles `hp-header-empty` on the zone to `!show`, where `show = _showTitle !== false && !!label` (`:66`, `:72`). CSS collapses an empty zone to zero height (`styles.css:2437-2443`).
5. When shown, it adds the class `block-header-<hN>` if `_titleSize` matches `TITLE_SIZE_RE` (`:74-76`), prepends `span.block-header-emoji` when `_titleEmoji` is set (`:77-79`), then the label span (`:80`).

Rules:

- **Call it on every render path, before any early return.** A path that skips it leaves the previous header in place. EmbeddedNote therefore calls it in its no-path and missing-file branches too, with the title `'Embedded note'`, so a deleted note's name does not stay in the header (`src/blocks/EmbeddedNoteBlock.ts:68-82`).
- **Blocks that never call it get no header.** Their `_titleLabel`, `_titleEmoji` and `_titleSize` have no effect in view mode, and `_showTitle` only affects whether a collapsed block is drawn collapsed (`src/grid/BlockWrapper.ts:23`, `src/grid/CollapseToggle.ts:25`). Today that is `greeting`, `clock` and `spacer`. The edit-mode placeholder still shows `_titleLabel` or `displayName` (`src/grid/BlockWrapper.ts:82-89`).
- **Choose `title` deliberately.** It is the view-mode default. It is not `displayName` and not the `_titleLabel` seeded by `defaultConfig`, and today these drift apart. FolderLinks, for instance, has displayName and seeded label `Quick links` but falls back to the header `Folder links` (`src/main.ts:68-69`, `src/blocks/FolderLinksBlock.ts:112`).

### Empty and error states

- **`renderErrorHint(el, message)`** empties `el` and renders `div.block-empty-hint.block-error-hint > div.block-empty-hint-icon (⚠) + div.block-empty-hint-text` (`src/blocks/BaseBlock.ts:89-94`). The header zone is untouched.
- **Empty states.** Blocks build the same structure by hand, without `block-error-hint`: a `block-empty-hint` div holding an emoji icon div and a text div (`src/blocks/StaticTextBlock.ts:74-78`). The styles are at `styles.css:530-559`.

### Reading config: `instance` versus `liveConfig()`

`this.instance` is the object the block was mounted from. Layout writes replace block objects and never mutate them (`src/main.ts:592-594`), so after `plugin.updateBlockConfig` the layout holds a new object and `this.instance.config` still holds the old values.

`liveConfig()` returns `plugin.activeBlocks().find(b => b.id === instance.id)?.config ?? instance.config` (`src/blocks/BaseBlock.ts:48-50`).

| Situation | Read from |
|---|---|
| Values that only change through the settings modal. Save re-mounts the grid, so the snapshot is current | `this.instance.config` is fine |
| Values the block patches itself with `updateBlockConfig` (StaticText's `content`), or that the plugin patches without a re-mount (EmbeddedNote's `filePath`, rewritten by `followRename`) | `liveConfig()`, after the patch promise resolves |
| Values read inside long-lived handlers (vault events, intervals) that a patch may have changed | `liveConfig()` inside the handler (`src/blocks/EmbeddedNoteBlock.ts:17-19`) |

Both return a config object the layout holds, or held at mount, not a copy. Treat it as read-only: never mutate `config` or anything inside it in place.

`liveConfig()` searches only the active platform array (`mobileBlocks` when `Platform.isMobile` is true, phones and tablets alike, and the layout is in Separate mode; otherwise `blocks`; `src/main.ts:379-385`). When the id is not there, for example because the block was just removed, it falls back to the snapshot.

### Saving your own config: the inline-edit contract

To persist a change from view mode, call `plugin.updateBlockConfig(id, patch)`. The contract, from `src/types.ts:111-120` and `src/main.ts:570-597`:

1. It waits for the saves already queued (`:566`).
2. It reads the in-memory layout. If the id is gone from the active array, it logs `[Homepage Blocks] updateBlockConfig: block <id> no longer exists; config patch dropped` and resolves without writing (`:571-577`).
3. Otherwise it shallow-merges `{ ...b.config, ...patch }` into a new block object, then calls `saveActiveBlocks` → `saveLayout` (`:578-582`).
4. `saveLayout` sets `plugin.layout` synchronously and resolves once its queued write has run, or has been held back by the data-file guard. It never rejects: a failed write is logged and shows a Notice, once until a later save succeeds (`:432-467`).
5. **The grid is not re-rendered, and `this.instance` is not updated.** The block re-renders itself from `liveConfig()` once the promise resolves.
6. Only the active platform array is patched. In Separate mode the other array holds its own blocks under different ids (copy-to-mobile mints new ids, `src/settings/HomepageSettingTab.ts:289`), and a copy of this block there keeps its old value. A change that must reach both arrays belongs in the plugin, as `followRename` does for renamed notes (`src/main.ts:472-486`).

Do not build a blocks array yourself and call `saveLayout`. A blocks array read earlier can overwrite a drag that landed in between (`src/main.ts:570-576`).

The reference implementation is StaticText's pencil editor (`src/blocks/StaticTextBlock.ts:86-158`):

```mermaid
sequenceDiagram
  participant U as User
  participant B as StaticTextBlock
  participant P as plugin
  participant G as GridLayout.rerender
  U->>B: click pencil
  B->>B: inlineEditActive = true
  Note over B,G: hasUnsavedInlineState() is true, so rerender() returns early
  U->>B: Save (or Ctrl/Cmd+Enter)
  B->>B: disable textarea and buttons
  B->>P: updateBlockConfig(id, { content })
  P-->>B: resolves after the write
  B->>B: finally: inlineEditActive = false
  B->>B: renderContent(el) reads liveConfig()
  B->>B: requestAutoHeight()
```

Rules taken from it:

- Set the unsaved flag when the editor opens and clear it only once the save has landed (`.finally`, `:133`). Until then an external `rerender()` cannot wipe the editor.
- Lock the inputs while the save is in flight (`:124-126`), so text typed meanwhile is not lost and Cancel cannot claim to undo a save already under way.
- Re-render from `liveConfig()`, never from `this.instance` (`:50`, `:87`).
- Cancel clears the flag and re-renders from `liveConfig()` (`:139-143`).
- A re-render that fails after Save or Cancel shows the block's error hint (`showRenderFailure`, `:43-46`, `:136`, `:142`).

### Re-rendering: `scheduleRender`, `nextGeneration`, `isStale`

`scheduleRender(delayMs, fn)` (`src/blocks/BaseBlock.ts:130-154`):

- **Debounce.** There is one timer per block object. A new call clears the pending one, so the last `fn` wins. RandomNote's two triggers with different delays share this timer (`src/blocks/RandomNoteBlock.ts:31-32`).
- **Connection check.** When the timer fires it does nothing unless `containerEl?.isConnected`. It then calls `fn(containerEl)`.
- **After `fn`.** A sync `fn` is followed by `requestAutoHeight()` straight away. An async `fn` gets it after it resolves.
- **Failures.** A synchronous throw from `fn` and a rejection of its promise take the same path (`:136-149`): the error is logged as `` [Homepage Blocks] <ClassName> re-render failed: `` and `renderErrorHint(el, 'Couldn’t refresh this block — check the console for details.')` replaces the content. No auto-height request follows.
- **Unload.** The pending timer is cleared (`:198-201`).

`nextGeneration()` / `isStale(gen)` (`src/blocks/BaseBlock.ts:188-195`) is a per-object counter. Use it in every async render:

```ts
private async renderContent(el: HTMLElement): Promise<void> {
  const gen = this.nextGeneration();      // first line of every (re-)render
  el.empty();
  const data = await fetchData();         // any await…
  if (this.isStale(gen)) return;          // …is followed by this, before touching the DOM
  el.createDiv({ text: data });
}
```

A stale check placed after the last DOM write does nothing. StaticText's check at `src/blocks/StaticTextBlock.ts:83` is one.

The scheduled path shows a generic hint. Put the try/catch and `renderErrorHint` inside the content function when scheduled re-renders should show the block's own message.

### Auto-height helpers

A block opts in when **both** of these hold:

1. **Factory flag.** Its factory has `autoHeight: true`.
2. **Marked element.** Its DOM has an element carrying `AUTO_HEIGHT_ATTR` (`'data-auto-height-content'`, `src/grid/AutoHeight.ts:13`).

`GridLayout.shouldAutoHeight(instance)` (`src/GridLayout.ts:118-129`) returns `false` without the flag, then applies these per-type opt-outs:

| Type | Auto-height when |
|---|---|
| `image-gallery` | `heightMode !== 'fixed'` |
| `quotes-list` | `heightMode !== 'wrap'` |
| `static-text` | `heightMode !== 'fixed'` |
| `embedded-note` | `heightMode === 'grow'` |
| any other flagged type (`button-grid`, `random-note`) | always |

How a request travels:

```mermaid
flowchart TD
  A["requestAutoHeight()<br/>scheduleRender completion<br/>observeWidthForAutoHeight"] -->|"CustomEvent 'request-auto-height', bubbles, from containerEl"| L["listener on the grid item<br/>(attached at mount only if shouldAutoHeight)"]
  L --> R["re-read live instance;<br/>stop unless shouldAutoHeight(live)"]
  M["GridLayout after first render<br/>ResponsiveColumns narrow (2+ columns) or restore"] --> Q
  R --> Q["AutoHeightManager.request<br/>one rAF batch"]
  Q --> X{"single column,<br/>collapsed, no marker,<br/>or offsetHeight 0?"}
  X -->|yes| N["no change"]
  X -->|no| U["rows = max(1, ceil(total / cellHeight))<br/>gridStack.update(h) if rows changed"]
  U -->|"any block resized"| P["repack all nodes;<br/>debounced persist (x/y/w only for auto-height and collapsed blocks)"]
```

Details:

- **Listener lifetime.** The listener is attached at mount only when `shouldAutoHeight(instance)` is true, and it re-checks the live instance on every event (`src/GridLayout.ts:504-517`). A block mounted as not-auto-height ignores requests until it is re-mounted.
- **What is measured.** `measureAndResize` takes the **first** `[data-auto-height-content]` in the grid item (`src/grid/AutoHeight.ts:115`). Mark exactly one element, and one whose height is its content's. Do not mark `el` when CSS makes it fill the cell: its height is then the cell's, and each measurement adds the padding again and grows the block by a row. RandomNote marks its inner card `.random-note-body` for this reason (`src/blocks/RandomNoteBlock.ts:125-130`).
- **Formula.** Header-zone height + wrapper padding + content height + gaps + 2 × margin + 4 px, divided by the cell height and rounded up, with a minimum of 1 row (`src/grid/AutoHeight.ts:131-158`). The block can grow or shrink.
- **No-ops.**
  - Single-column mode, where CSS sizes the blocks (`:66-69`).
  - Collapsed blocks (`:112-113`).
  - A missing marker or header zone, or a marker whose `offsetHeight` is 0 (`:117`, `:140`).
- **Persistence.** For auto-height blocks `LayoutPersister` writes only `x/y/w`, never `h`, and in a narrowed (responsive) layout it writes nothing for them (`src/grid/LayoutPersister.ts:94-120`). The same rule covers a collapsed block, whose node is drawn at a display height, except in edit mode with a visible title (`nodeShowsStoredHeight`, `:31-34`). The stored `h` is whatever another path last wrote: `defaultSize.h` at creation, the last persisted height from a period when the block was not auto-height, or, when the block is expanded after a collapse, its `_expandedH`, the GridStack height read when it was collapsed (`src/grid/CollapseToggle.ts:63-78`). Expanding uses `_expandedH` only when it is a number ≥ 1, and the block's `h` otherwise.
- **Edit mode.** Auto-height blocks are drawn at 2 rows (`src/GridLayout.ts:19`, `:360`), and their vertical resize handles are hidden (`styles.css:2569-2573`).

`requestAutoHeight()` (`src/blocks/BaseBlock.ts:157-159`) dispatches the event from `containerEl`. Call it after content changes outside `scheduleRender`, as StaticText does after an inline save. It does nothing while `containerEl` is null.

`observeWidthForAutoHeight(el)` (`:167-185`):

- **One observer per block.** Calling it again disconnects the previous observer, so it is safe to call on every render with a fresh element.
- **What triggers a request.** It dispatches when the observed width is `> 0` and differs from the last width seen, throttled to one request per animation frame. `prevWidth` starts at 0, so the first non-zero callback also dispatches (`:173-182`).
- **Cleanup.** The observer is disconnected in `BaseBlock.onunload` (`:202-206`), not through `register()`.
- **When to use it.** Use it when content reflows with width: wrapping text, grids, multi-column lists. ButtonGrid, ImageGallery, QuotesList and RandomNote call it.

### Content settings: `renderContentSettings(body, draft)`

The shared `BlockSettingsModal` has four tabs: Header, Body, Card and Content. The first three edit the shared `_` keys (see [../styling.md](../styling.md)). The Content tab calls `block.renderContentSettings(body, draft)` (`src/modals/BlockSettingsModal.ts:401-412`).

- **Draft.** `draft` is `structuredClone(instance.config)` (`:51`). Mutate it in place. Shared and block keys live in the same object.
- **Save.** Save replaces the block's whole `config` with the draft (`src/grid/EditHandleBar.ts:99-104`), then re-mounts the grid. Before that, `commit()` resets `_accentColor` to `''` unless it held a colour when the modal opened or one was picked since, and resets `_gradientStart` and `_gradientEnd` to `''` unless both held valid hex colours when the modal opened or a gradient colour was set since (`src/modals/BlockSettingsModal.ts:55-58`, `:414-419`).
- **Cancel.** Cancel, Esc or X discard the draft.
- **Runs repeatedly.** It runs **each time the Content tab is shown**: `switchTab` empties the tab body and calls it again (`:121-134`). Build every control from `draft`, and keep no settings state on `this`.
- **Temporary block.** It runs on a **temporary block**. The settings button exists only on the edit-mode handle bar (`src/GridLayout.ts:555-557`), and edit mode stores `block: null` (`:499`). The handle bar therefore creates one with `factory.create(...)` (`src/grid/EditHandleBar.ts:106-113`) and calls `unload()` on it when the modal closes (`:117-131`). This object:
  - was never `load()`ed and never rendered, so `containerEl` is null and there is no header container;
  - must not register events or intervals;
  - must not depend on state that `render()` sets up.
- **No validation.** Nothing validates what you write into the draft. Clamp in the control handlers, and also coerce again at render, with `rangedNumber` for a key in `CONFIG_RANGES` (see [defaultConfig](#the-defaultconfig-contract)).
- **Unsetting a key.** `delete draft.key` unsets it, and the block falls back to its built-in default.
- **Empty body.** If `body` stays empty, the modal shows "This block has no content settings." (`src/modals/BlockSettingsModal.ts:406-411`).
- **Helpers.** Reusable controls: `createEmojiPicker` (`src/utils/emojiPicker.ts`), `FolderSuggestModal` (`src/utils/FolderSuggestModal.ts`), `enableDragReorder` (`src/utils/dragReorder.ts`). Usage examples are in [../blocks.md](../blocks.md).

### Unsaved inline state: `hasUnsavedInlineState()`

- **What it guards.** `GridLayout.rerender()` returns early while any live block returns `true` (`src/GridLayout.ts:299-308`). Its callers (`setColumns`, the `EditHandleBar` actions) run in edit mode, where there are no live blocks, unless keyboard focus reaches the hidden toolbar's controls in view mode ([grid.md](grid.md) §19).
- **What it does not guard.** It does **not** stop:
  - `setEditMode`, which renders directly (`:222`);
  - `addBlock`, which also renders directly, so the `add-block` command always draws the new block (`:291-294`);
  - `HomepageView.reload` / `onOpen`;
  - the view closing.
  
  The block is unloaded on those paths. StaticText saves an open draft from its `onunload`; other unsaved inline state, such as VaultSearch's typed query, is lost.
- **Current overrides.** StaticText returns `true` while its editor is open. VaultSearch returns `true` while the trimmed query is non-empty (`src/blocks/VaultSearchBlock.ts:36-38`).

### Cleanup

- `BaseBlock.onunload` clears the `scheduleRender` timer and the width observer (`src/blocks/BaseBlock.ts:197-207`). A subclass that overrides `onunload` must call `super.onunload()`, as ImageGallery does (`src/blocks/ImageGalleryBlock.ts:228-229`).
- Everything registered through `registerEvent`, `registerInterval`, `registerDomEvent` or `register` is released by `unload()`.
- DOM appended outside `el` (overlays or dropdowns on `el.doc.body`) must be removed through `register(() => node.remove())`, as VaultSearch does (`src/blocks/VaultSearchBlock.ts:65-71`).
- A timer the block starts and restarts itself (VoiceDictation's elapsed timer and "Saved" flash) keeps one handle, cleared before each restart and in a single `register` cleanup, rather than one `registerInterval` or `register` call per use, which piles up until unload (`src/blocks/VoiceDictationBlock.ts:134-138`, `:268-298`).
- For popout-window safety, `CLAUDE.md` requires `el.doc` / `el.win` / `activeDocument` instead of the bare `document`, and `window.setTimeout` / `window.requestAnimationFrame` / `window.cancelAnimationFrame` for timers. Window-level listeners go on the block's own window: VaultSearch adds its scroll and resize listeners to `inputEl.win` and removes them from that window (`src/blocks/VaultSearchBlock.ts:245-261`).

---

## BlockFactory

```ts
export interface BlockFactory {                                   // src/types.ts:90-103
  type: BlockType;
  displayName: string;
  defaultConfig: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  autoHeight?: boolean;
  create(app: App, instance: BlockInstance, plugin: IHomepagePlugin): BaseBlock;
}
```

| Field | Used by | Notes |
|---|---|---|
| `type` | registry key; the `hp-block-<type>` wrapper class; the placeholder label | Must be a member of `BLOCK_TYPES` (compile-time) |
| `displayName` | Add Block picker (`src/EditToolbar.ts:311`); settings modal heading `Block settings — <displayName>` and preview default (`src/modals/BlockSettingsModal.ts:53,60`); edit-mode placeholder header (`src/grid/BlockWrapper.ts:82-84`) | Not the view-mode header; that is the `title` passed to `renderHeader` |
| `defaultConfig` | New blocks; clipboard-import allowlist and type check | See the next section |
| `defaultSize` | New blocks: `w = min(defaultSize.w, activeColumns())`, `h = defaultSize.h` (`src/EditToolbar.ts:232-233`) | In grid rows of 80 px and columns |
| `autoHeight` | `GridLayout.shouldAutoHeight` (`src/GridLayout.ts:120`), and through it measurement, persistence and edit-mode sizing | Needs a marked element too |
| `create` | `GridLayout.mountBlock` (view mode), `EditHandleBar` (temporary settings block) | Construct only; no DOM work, since the object may never be rendered |

### The `defaultConfig` contract

`defaultConfig` declares **every config key the block reads**, each with its default. A key with no default of its own is declared as `undefined` (`src/main.ts:36-40`, `src/types.ts:93-97`). It serves three purposes:

1. **Seed for new blocks.** The Add Block picker creates `config: structuredClone(factory.defaultConfig)`, a **deep** copy (`src/EditToolbar.ts:235`).
   - Array and object defaults (`links: []`, `items: []`) are the new block's own, not shared with the factory.
   - Keys declared `undefined` exist in memory but are not written to `data.json`, since JSON serialization omits `undefined` values.
2. **Import allowlist.** `sanitizeImportedConfig(type, config)` (`src/utils/importSanitizer.ts:78-121`) keeps a key that does not start with `_` only when the factory declares it as an own property **and** the imported value matches the declared default's type (`:113-117`). Anything else is stripped and counted in the import summary. A type with no registered factory has no declared keys, so all its non-`_` keys are stripped (`:82`).
3. **Type check** (`matchesDeclaredType`, `:19-28`):

| Declared default | Accepted import value |
|---|---|
| `undefined` or `null` | any string, number or boolean |
| array | any array; **elements are not checked** |
| object | a non-null, non-array object |
| number | a finite number |
| string / boolean | same `typeof` |

**Numeric ranges.** A declared number that passes the type check is also rounded and clamped to its range in `CONFIG_RANGES` (`src/utils/configRanges.ts:10-21`), when the type and key have one (`clampConfigNumber`, `:24-29`, applied at `src/utils/importSanitizer.ts:114`). The table lists the ranges the settings controls offer, for `button-grid`, `bookmarks`, `quotes-list`, `image-gallery`, `recent-files` and `pomodoro`. A key without an entry passes unchanged; the lookup is an own-property check, so `__proto__` finds no range.

What the contract does **not** cover:

- **Other checks.** No enum membership, no string length, no array element shapes for block keys, and no range for a number that has no `CONFIG_RANGES` entry.
- **Load path.** The load path does not type-check config. `isValidBlockInstance` only requires `config` to be a non-array object (`src/validation.ts:225-237`), and `migrateBlockInstance` rewrites a few legacy keys, caps a numeric `button-grid` `columns` at 3 and drops `customCss` from other types (`:131-222`).

So `render` and `renderContentSettings` must treat every config value as `unknown` and coerce it. Existing blocks do this in three ways:

- **Read a ranged number.** `rangedNumber(type, config, key, fallback)` (`src/utils/configRanges.ts:31-36`) returns the value clamped to its `CONFIG_RANGES` entry when it is a finite number, and `fallback` otherwise. QuotesList, RecentFiles and Pomodoro read their numeric settings this way (`src/blocks/QuotesListBlock.ts:106-107`, `src/blocks/RecentFilesBlock.ts:44`, `src/blocks/PomodoroBlock.ts:142-151`). A new numeric setting with a settings range gets an entry in `CONFIG_RANGES` and is read with `rangedNumber`, so import and render agree on the bounds.
- **Clamp numbers.** `Math.max(1, Math.min(3, Math.floor(Number(columns) || 2)))` (`src/blocks/ButtonGridBlock.ts:28`).
- **Check enums against a table.** `clockStyle in CLOCK_STYLES` (`src/blocks/ClockBlock.ts:25`). The `in` operator also accepts inherited names such as `toString`; an own-property check (`Object.prototype.hasOwnProperty.call`, as `importSanitizer` does at `src/utils/importSanitizer.ts:8`) or a `Set` of values (`src/blocks/FolderLinksBlock.ts:21`, `:109`) is stricter.

Special keys:

- **Always stripped.** `apiKey` and `customCss` are stripped on import whether declared or not (`src/utils/importSanitizer.ts:11`, `:87-90`), and export deletes both (`src/settings/HomepageSettingTab.ts:382-390`). `voice-dictation` declares `apiKey: ''` so new blocks carry the slot. `button-grid` leaves `customCss` undeclared on purpose (`src/main.ts:78-80`).
- **Active content.** `static-text` `content`, `html` `html`, and `voice-dictation` `noteTemplate` and `folder` are rendered as Markdown or HTML, or written into new notes. The import confirmation lists their non-empty values, and "Import without content" resets them to their factory defaults (`ACTIVE_CONTENT_KEYS`, `findActiveContent`, `withoutActiveContent`, `src/utils/importSanitizer.ts:140-183`). A new key of that kind belongs in `ACTIVE_CONTENT_KEYS`.
- **`_` keys are not governed by `defaultConfig`.** On import they go through `SHARED_VALIDATORS` (`src/utils/importSanitizer.ts:42-64`). An unknown `_` key is kept if its value is a primitive and stripped otherwise (`:100-110`).
  - Block-specific keys must therefore **not** start with `_` (`src/types.ts:43-48`). Such a key would skip the declared-type check and be treated as shared styling.
  - A factory may still list `_` keys in `defaultConfig` to seed shared styling. Several seed `_titleLabel`. `spacer` seeds `_showTitle`, `_showBorder`, `_showBackground` and `_showHeaderAccent`, all `false` (`src/main.ts:172`).
- **Secrets.** Name a secret field `apiKey`. Encryption at rest is keyed on that field name for any block type (`src/utils/apiKeyLayout.ts:6-22`, `:48-93`), and the key is decrypted into memory on load (`decryptApiKeys`, `:114-152`, which returns a new layout and leaves its input untouched).
  - A key this device cannot decrypt stays ciphertext in memory. Test it with `isEncrypted(apiKey)` and treat a match as "no usable key", never sending it (`src/blocks/VoiceDictationBlock.ts:175-183`, `:336-339`).
  - There is one `apiKey` per block.
  - Duplicate copies it (`src/grid/EditHandleBar.ts:80-84`). Copy-to-mobile blanks it (`src/settings/HomepageSettingTab.ts:290`).
  - The unreadable-key Notice names "the voice notes API key" (`src/main.ts:368`), and the transient-failure Notice names the "voice API key" (`src/main.ts:269`), so a second block type with `apiKey` would get misleading messages.

Keep the factory default and the block's own fallback identical. A block created from the default layout, or edited by hand, lacks keys and gets the fallback instead. Current drift:

| Block | Key | Factory default | Block fallback |
|---|---|---|---|
| greeting | `name` | `'World'` (`src/main.ts:48`) | `'bentornato'` (`src/blocks/GreetingBlock.ts:198,218`) |
| folder-links | header label | `_titleLabel: 'Quick links'` (`src/main.ts:69`) | `renderHeader(el, 'Folder links')` (`src/blocks/FolderLinksBlock.ts:112`) |
| button-grid | header label | `_titleLabel: 'Button grid'` (`src/main.ts:80`) | `renderHeader(el, 'Buttons')` (`src/blocks/ButtonGridBlock.ts:25`) |

`tests/utils/importSanitizer.test.ts:89-166` runs the sanitizer against the production factories (`registerBlocks()`) and checks that exported settings survive a round trip. Add a row there for every new block.

### Registered factories

These are registered in this order, which is also the order of the Add Block picker (`src/main.ts:44-206`). Keys marked \* are declared `undefined`. Behaviour of each block: [../blocks.md](../blocks.md).

| type | Class | displayName | defaultSize (w×h) | autoHeight | Calls `renderHeader` | Declared keys |
|---|---|---|---|---|---|---|
| `greeting` | `GreetingBlock` | Greeting | 1×3 | – | no | `name, showTime, showEmoji, emojiMode, emojiMorning*, emojiAfternoon*, emojiEvening*, emojiNight*, emojiPool, emojiDailySeed, salutationMode, salutationPreset, salutMorning*, salutAfternoon*, salutEvening*` |
| `clock` | `ClockBlock` | Clock / date | 1×3 | – | no | `showSeconds, showDate, clockStyle, format` |
| `folder-links` | `FolderLinksBlock` | Quick links | 1×3 | – | yes | `_titleLabel, folder, links, folderEmoji, linkAlign` |
| `button-grid` | `ButtonGridBlock` | Button grid | 1×5 | yes (always) | yes | `_titleLabel, columns, items` (+ `customCss`, read but undeclared) |
| `quotes-list` | `QuotesListBlock` | Quotes | 2×3 | yes (not `wrap`) | yes | `source, tag, quotes, _titleLabel, columns, maxItems, quoteStyle, fontStyle, customFont, dailySeed, showNoteTitle, heightMode, textAlign, verticalAlign, showAccentBar` |
| `image-gallery` | `ImageGalleryBlock` | Image gallery | 3×3 | yes (not `fixed`) | yes | `folder, _titleLabel, columns, maxItems, layout, heightMode` |
| `embedded-note` | `EmbeddedNoteBlock` | Embedded note | 1×3 | yes (`grow` only) | only when `showTitle` and the file exists | `filePath, showTitle, heightMode` |
| `static-text` | `StaticTextBlock` | Static text | 1×3 | yes (not `fixed`) | yes | `content, heightMode` |
| `html` | `HtmlBlock` | HTML block | 1×3 | – | yes | `html` |
| `video-embed` | `VideoEmbedBlock` | Video embed | 2×4 | – | yes | `url, shuffleOnLoad` |
| `bookmarks` | `BookmarkBlock` | Bookmarks | 2×3 | – | yes | `_titleLabel, items, columns, showDescriptions` |
| `recent-files` | `RecentFilesBlock` | Recent files | 1×4 | – | yes | `_titleLabel, maxItems, showTimestamp, excludeFolders` |
| `pomodoro` | `PomodoroBlock` | Pomodoro timer | 1×4 | – | yes | `_titleLabel, workMinutes, breakMinutes, longBreakMinutes, sessionsBeforeLong, soundType, autoStartCycle` |
| `spacer` | `SpacerBlock` | Spacer | 1×2 | – | no | `_showTitle, _showBorder, _showBackground, _showHeaderAccent` |
| `random-note` | `RandomNoteBlock` | Random note | 1×4 | yes (always) | yes | `_titleLabel, tag, dailySeed, imageProperty, titleProperty, showImage, showPreview` |
| `voice-dictation` | `VoiceDictationBlock` | Voice notes | 2×3 | – | yes | `folder, triggerMode, provider, apiKey, model, language, noteTemplate` |
| `vault-search` | `VaultSearchBlock` | Vault Search | 2×2 | – | yes | `placeholder` |

---

## BlockRegistry

`src/BlockRegistry.ts`, exported as the singleton `BlockRegistry` (`:23`).

| Method | Behaviour | Line |
|---|---|---|
| `register(factory)` | `Map.set` by `factory.type`. A second registration of the same type silently replaces the first | `:6-8` |
| `get(type)` | The factory, or `undefined` | `:10-12` |
| `getAll()` | All factories in insertion order | `:14-16` |
| `clear()` | Empties the map | `:18-20` |

- **Population.** `registerBlocks()` calls `clear()` first (`src/main.ts:42`) and runs at the start of `onload` (`src/main.ts:234`).
- **Consumers.**
  - `GridLayout.shouldAutoHeight` and `mountBlock` (`src/GridLayout.ts:119`, `:493`)
  - `EditHandleBar`'s settings button (`src/grid/EditHandleBar.ts:109`)
  - `BlockSettingsModal` (`src/modals/BlockSettingsModal.ts:52`)
  - `AddBlockModal` (`src/EditToolbar.ts:221`, `:298`)
  - `sanitizeImportedConfig` and `withoutActiveContent` (`src/utils/importSanitizer.ts:82`, `:177`); `findActiveContent` reads `displayName` for the confirmation list (`:164`)
- **Missing factory.** A block whose type has no factory is silently skipped at mount: the wrapper is already built, but it gets no content, no collapse toggle and, in edit mode, no placeholder or handle bar (`src/GridLayout.ts:493-494`).
- **Tests.** Tests that need real factories call `registerBlocks()` (`tests/utils/importSanitizer.test.ts:90`). Tests with stubs call `BlockRegistry.clear()` and then `register(stub)` (`tests/EditToolbar.test.ts:12-18`, `:48-55`).

## BLOCK_META

`export const BLOCK_META: Record<BlockType, { icon: string; desc: string }>` (`src/blockMeta.ts:3-21`).

- **Compile-time completeness.** The `Record<BlockType, …>` type makes an entry mandatory for every member of `BLOCK_TYPES`: a missing one is a `tsc` error.
- **Only consumer.** `AddBlockModal` (`src/EditToolbar.ts:286-320`). Search matches the query against `` `${displayName} ${type} ${desc}` ``, lower-cased (`:296-304`). Each row shows `icon`, `displayName` and `desc`, with `'▪'` as the icon fallback (`:306-315`).
- **Not used elsewhere.** It appears in no other UI: not the settings modal, not the placeholder.

---

## Who writes a block's config

| Path | Code | Result |
|---|---|---|
| Add block | `src/EditToolbar.ts:214-238` | `structuredClone(defaultConfig)`, a deep copy |
| Settings Save | `src/grid/EditHandleBar.ts:99-105` | The whole draft replaces `config`; grid re-mounts |
| Block self-patch | `src/main.ts:577-597` | `{ ...config, ...patch }` on the active platform array; no re-mount |
| Note renamed | `src/main.ts:472-486` | `filePath` of every `embedded-note` block naming the old path, in both arrays and in an open session's Discard snapshot; no re-mount |
| Duplicate | `src/grid/EditHandleBar.ts:77-88` | `structuredClone` of the current block (including `apiKey`), new id |
| Import | `src/utils/importSanitizer.ts:123-138` | Each block's `config` filtered by `defaultConfig` and the shared validators, numbers clamped to `CONFIG_RANGES`; with "Import without content", the active-content keys reset to their defaults (`:173-183`) |
| Copy desktop to mobile | `src/settings/HomepageSettingTab.ts:282-295` | `fitBlocksToColumns`: clones with new ids, widths and `x` fitted to the mobile columns and packed so no blocks overlap; `apiKey` set to `''` where present |
| Load | `src/validation.ts:131-237` | Legacy keys migrated, `button-grid` `columns` above 3 capped at 3, `customCss` dropped from other types (`:198-208`); `config` must be an object; other values unchecked |

Full flows: [../flows.md](../flows.md).

---

## Adding a new block type

The steps use a hypothetical `note-stats` block, which shows a note's word count and headings. The example exercises every contract above; it is not in the repository.

### 1. Add the type id

Append the id to `BLOCK_TYPES` (`src/types.ts:4-10`). `BlockType`, the validator's allowed set (`src/validation.ts:118`) and the `BLOCK_META` key type all derive from it. Until you finish step 4, `tsc` reports the missing `BLOCK_META` entry.

```ts
export const BLOCK_TYPES = [
  // …existing ids…
  'voice-dictation', 'vault-search', 'note-stats',
] as const;
```

A type id is permanent. `data.json` stores it, and a block whose type is not in `BLOCK_TYPES` is dropped on load: the file is copied to `data.json.invalid` (`data.json.invalid.<ms>` when that name is taken) and the user gets a Notice (`src/utils/loadRecovery.ts:54-63`, `:81-104`; `src/main.ts:252-259`; see [../data-model.md](../data-model.md)). To rename a type, keep accepting the old id through `migrateBlockInstance`, as `tag-grid` → `button-grid` does (`src/validation.ts:148`).

### 2. Write the block class

Create `src/blocks/NoteStatsBlock.ts`:

```ts
import { Setting, TFile } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { AUTO_HEIGHT_ATTR } from '../grid/AutoHeight';

const DEBOUNCE_MS = 300;
const DEFAULT_MAX_HEADINGS = 10;

export class NoteStatsBlock extends BaseBlock {
  render(el: HTMLElement): Promise<void> {
    this.containerEl = el;                        // enables scheduleRender / requestAutoHeight
    el.addClass('note-stats-block');

    // render() runs once per block object: register listeners here only.
    const trigger = () => this.scheduleRender(DEBOUNCE_MS, e => this.renderContent(e));
    this.registerEvent(this.app.vault.on('modify', f => {
      if (f.path === this.liveConfig().filePath) trigger();
    }));

    return this.renderContent(el);                // returned: skeleton + measurement wait for it
  }

  private async renderContent(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const cfg = this.liveConfig();
    // Every value is unknown: import checks only the JSON type, load checks nothing.
    const filePath = typeof cfg.filePath === 'string' ? cfg.filePath : '';
    const showHeadings = cfg.showHeadings !== false;
    const max = Math.max(1, Math.min(50, Math.floor(Number(cfg.maxHeadings)) || DEFAULT_MAX_HEADINGS));

    el.empty();
    this.renderHeader(el, 'Note stats');          // on every path, before any early return
    const body = el.createDiv({ cls: 'note-stats-body' });
    body.setAttribute(AUTO_HEIGHT_ATTR, '');      // the one measured element
    this.observeWidthForAutoHeight(body);         // headings wrap when the block narrows

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      const hint = body.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4CA}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No note selected. Set a note path in settings.' });
      return;
    }

    try {
      const text = await this.app.vault.read(file);
      if (this.isStale(gen)) return;              // a newer render owns el now
      const words = text.split(/\s+/).filter(Boolean).length;
      body.createDiv({ cls: 'note-stats-summary', text: `${words} words` });
      if (showHeadings) {
        const list = body.createEl('ul', { cls: 'note-stats-headings' });
        const headings = this.app.metadataCache.getFileCache(file)?.headings ?? [];
        for (const h of headings.slice(0, max)) list.createEl('li', { text: h.heading });
      }
    } catch (e) {
      // Inside the content function, so scheduled re-renders show the hint too.
      console.error('[Homepage Blocks] NoteStatsBlock failed to render:', e);
      if (!this.isStale(gen)) this.renderErrorHint(el, 'Couldn’t read this note.');
    }
  }

  // Runs on a temporary, never-rendered block, once per Content-tab visit:
  // read and write `draft` only.
  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    new Setting(body).setName('Note path').addText(t => t
      .setValue(typeof draft.filePath === 'string' ? draft.filePath : '')
      .onChange(v => { draft.filePath = v.trim(); }));
    new Setting(body).setName('Show headings').addToggle(t => t
      .setValue(draft.showHeadings !== false)
      .onChange(v => { draft.showHeadings = v; }));
    new Setting(body).setName('Headings shown').setDesc('1 to 50. Leave empty for 10.').addText(t => t
      .setPlaceholder(String(DEFAULT_MAX_HEADINGS))
      .setValue(typeof draft.maxHeadings === 'number' ? String(draft.maxHeadings) : '')
      .onChange(v => {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) draft.maxHeadings = Math.max(1, Math.min(50, n));
        else delete draft.maxHeadings;            // unset: the block falls back to 10
      }));
  }
}
```

Conventions this follows (`CLAUDE.md`, "What NOT to Do"):

- Build DOM with the Obsidian helpers (`createDiv`, `createEl`, `setText`). Never use `innerHTML`.
- Prefix `console.warn` / `console.error` messages with `[Homepage Blocks]`. Production builds strip `console.log` / `debug` / `info` / `trace` (`esbuild.config.mjs:18`).
- `@typescript-eslint/no-floating-promises` is an error (`eslint.config.mjs:43`): `void` or `.catch` every promise you don't return.
- `obsidianmd/no-static-styles-assignment` and `obsidianmd/ui/sentence-case` cannot be disabled by comment (`eslint.config.mjs:21-25`). Style through classes or `style.setProperty('--hp-…')` custom properties, and write UI strings in sentence case.

### 3. Register the factory

In `registerBlocks()` (`src/main.ts:41-207`):

```ts
import { NoteStatsBlock } from './blocks/NoteStatsBlock';
// …
BlockRegistry.register({
  type: 'note-stats',
  displayName: 'Note stats',
  // Every key the block reads. maxHeadings has no default of its own (the block falls back to 10).
  defaultConfig: { filePath: '', showHeadings: true, maxHeadings: undefined },
  defaultSize: { w: 1, h: 3 },
  autoHeight: true,
  create: (app, instance, plugin) => new NoteStatsBlock(app, instance, plugin),
});
```

- **Undeclared keys.** A key the block reads but does not declare is stripped from every clipboard import.
- **`undefined` declarations.** A key declared `undefined` accepts any string, number or boolean on import. That is why the block coerces `maxHeadings` with `Number()`.
- **Numeric ranges.** To have an import clamp `maxHeadings` to the 1–50 the settings offer, add `'note-stats': { maxHeadings: { min: 1, max: 50 } }` to `CONFIG_RANGES` (`src/utils/configRanges.ts:10-21`) and read it with `rangedNumber('note-stats', cfg, 'maxHeadings', DEFAULT_MAX_HEADINGS)` instead of the inline clamp. With `maxHeadings` declared `undefined`, an imported number is clamped, but a string still passes the type check unchanged; `rangedNumber` returns the fallback for it at read.
- **Picker order.** Registration order is the order shown in the picker.

### 4. Add `BLOCK_META`

```ts
'note-stats': { icon: '\u{1F4CA}', desc: 'Word count and headings of one note' },
```

### 5. Wire auto-height (only if the content can outgrow its cell)

Two things are required, and one is optional:

- **Required:** `autoHeight: true` on the factory (step 3).
- **Required:** exactly one `AUTO_HEIGHT_ATTR` element per render (step 2).
- **Optional:** `observeWidthForAutoHeight` when the content reflows with width.

If the block has a height mode that turns auto-height off, add a branch to `GridLayout.shouldAutoHeight` (`src/GridLayout.ts:118-129`). Also leave the marker off in that mode, as StaticText does (`src/blocks/StaticTextBlock.ts:70-72`).

Do not rely on the stored `h` of an auto-height block: layout persists never update it (see [Auto-height helpers](#auto-height-helpers)).

### 6. Save config from view mode (only if needed)

If the block edits its own config outside the settings modal, follow [the inline-edit contract](#saving-your-own-config-the-inline-edit-contract):

1. Call `updateBlockConfig`.
2. Re-render from `liveConfig()` after it resolves.
3. Report `hasUnsavedInlineState()` while unsaved UI is open.

### 7. Add CSS

Add the styles to `styles.css` at the repo root, using Obsidian variables (`--text-muted`, `--background-secondary`, `--color-accent` …).

- **Wrapper hook.** The wrapper class `hp-block-<type>` lets you target the card without `:has()` (`src/grid/BlockWrapper.ts:18-20`).
- **Accent colour.** `--block-accent` is set on the wrapper when `_accentColor` holds a valid hex colour (`src/utils/blockStyling.ts:109-114`).

Conventions: [../styling.md](../styling.md).

```css
/* ── Note stats ─────────────────────────────── */
.note-stats-summary { color: var(--text-muted); }
.note-stats-headings { margin: 4px 0 0; padding-inline-start: 1.2em; }
```

### 8. Optional: default layout and migrations

- **Default layout.** To ship the block in the default layout, add an entry to `DEFAULT_LAYOUT_DATA` (`src/validation.ts:24-109`). Use a fixed id that matches `/^[a-zA-Z0-9_-]+$/`.
- **Renamed keys.** Migrate a renamed config key in `migrateBlockInstance` (`src/validation.ts:131-222`). The migration must be idempotent: delete the legacy key after reading it, and write the new key only while it is unset.

### 9. Test

Tests use vitest with happy-dom. `obsidian` is aliased to `tests/__mocks__/obsidian.ts` (`vitest.config.ts`), and `tests/setup.ts` installs the Obsidian DOM helpers and fake IndexedDB.

- **Mock `Component`.**
  - It mirrors Obsidian's lifecycle: `load()` runs `onload()` once; `unload()` does nothing unless the component was loaded, then unloads the children, runs the `register()` callbacks in reverse order and calls `onunload()` last. Call `block.load()` before `render()`, as `GridLayout.mountBlock` does, or `unload()` skips `onunload()`.
  - `registerEvent` is a no-op; `registerInterval` returns the id and clears the interval on unload; `registerDomEvent` adds the listener (`tests/__mocks__/obsidian.ts:64-95`).
- **Plugin double.** Pass a plugin double that implements what the block calls. `tests/blocks/StaticTextBlock.test.ts:8-30` has one with the real `updateBlockConfig` contract.
- **Auto-height in tests.** happy-dom never lays out, so its `ResizeObserver` never reports a width. Capture the callback and call it by hand (`tests/blocks/ButtonGridBlock.test.ts:6-22`).
- **Import round trip.** Add the type to the round-trip table in `tests/utils/importSanitizer.test.ts:123-134`.

```ts
it('shows the empty hint without a note', async () => {
  const instance: BlockInstance = { id: 'n1', type: 'note-stats', x: 0, y: 0, w: 1, h: 3, config: {} };
  const plugin = { activeBlocks: () => [instance] } as unknown as IHomepagePlugin;
  const app = { vault: { on: () => ({}), getAbstractFileByPath: () => null } } as unknown as App;
  const el = document.body.createDiv();
  await new NoteStatsBlock(app, instance, plugin).render(el);
  expect(el.querySelector('.block-empty-hint')).toBeTruthy();
});
```

### 10. Verify

```bash
npx tsc --noEmit     # zero errors required (strict: true)
npm test             # vitest run
npx eslint src       # obsidianmd rules; there is no npm lint script
```

`npm run build` writes the bundle to `main.js` at the repo root (`esbuild.config.mjs:19`). When the repo sits in a vault's plugins folder, that file is the plugin Obsidian loads.

### Checklist

| # | File | Change |
|---|---|---|
| 1 | `src/types.ts` | Id appended to `BLOCK_TYPES` |
| 2 | `src/blocks/<Name>Block.ts` | Class extending `BaseBlock` |
| 3 | `src/main.ts` | Import and `BlockRegistry.register({...})` in `registerBlocks()`; every read key declared |
| 4 | `src/blockMeta.ts` | Icon and description |
| 5 | `src/GridLayout.ts` | `shouldAutoHeight` branch, only for a `heightMode` opt-out |
| 6 | `styles.css` | Block styles |
| 7 | `src/validation.ts` | Optional default-layout entry; migrations for renamed keys or types |
| 8 | `tests/` | Block test; import round-trip row |
| 9 | `CLAUDE.md`, `docs/` | Block count (17 today), type list, auto-height list, Live Reactivity list |

---

## Pitfalls in the current code

Verified in code. Avoid repeating them in new blocks.

- **Only the first marker is measured.** While StaticText's inline editor is open, the hidden `.static-text-content` (`display: none` through `hp-hidden`, `styles.css:3812`) is the first `[data-auto-height-content]` in document order. It measures 0, so the editor is not measured (`src/blocks/StaticTextBlock.ts:69-72`, `:92-101`; derived from the code, not tested).
- **`renderHeader` reads the snapshot.** A block that changes its own `_` keys through `updateBlockConfig` would not see the new header until a re-mount (`src/blocks/BaseBlock.ts:61`).
- **Self-patches reach only the active platform array** (`src/main.ts:585-596`). A block-owned value that must follow a vault change in both arrays needs a plugin-level handler, as `followRename` is for EmbeddedNote's `filePath` (`src/main.ts:472-486`).
- **Content settings run on an unloaded object.** Anything registered from `renderContentSettings` is tied to a component that never ran `load()` (`src/grid/EditHandleBar.ts:106-131`).

## Where comments and `CLAUDE.md` disagree with the code

| Claim | Code |
|---|---|
| `BaseBlock.ts:165` docstring: `observeWidthForAutoHeight` cleanup "is registered automatically via `this.register()`" | Cleanup is in `BaseBlock.onunload` (`:202-206`), as `CLAUDE.md` says; overriding `onunload` without `super.onunload()` leaks the observer |
| `BaseBlock.ts:173`: "0 skips the initial observe() callback" | The first callback with a non-zero width dispatches a request (`:174-182`) |
| `BaseBlock.ts:58`: `renderHeader` respects `_showTitle`, `_titleLabel`, `_titleEmoji` | It also applies `_titleSize` (`:74-76`) |
| `src/types.ts:100`: "GridLayout persists height specially" for auto-height blocks | `LayoutPersister` never writes their `h`, only `x/y/w` (`src/grid/LayoutPersister.ts:94-120`); while a block is auto-height, the only grid path that sets its `h` is expanding it after a collapse (`src/grid/CollapseToggle.ts:71-78`) |
| `CLAUDE.md` Lightbox: "ownership is scoped per block instance (`myLightboxAc`) to prevent cross-instance interference" | Per-instance ownership (`myLightboxAc`, `src/blocks/ImageGalleryBlock.ts:211`, `:228-237`) only decides which block closes it on unload; the lightbox itself is a module-level singleton, `activeLightbox` (`:17`), so opening one closes any other (`:39`) |
