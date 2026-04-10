# Performance & Scalability Analysis

## Summary

The Homepage Blocks plugin is generally well-architected for performance. The codebase
demonstrates good practices: debounced re-renders, rAF-batched resizes, staleness guards
for async renders, and proper cleanup via Obsidian's Component lifecycle. The findings
below focus on areas where performance could degrade under edge conditions or at scale.

---

## 1. Memory Leaks & Resource Cleanup

### 1.1 PomodoroBlock module-level timerStore never evicts entries
- **Severity:** Medium
- **Impact:** Slow memory growth over long sessions if blocks are added/removed repeatedly
- **File:** `src/blocks/PomodoroBlock.ts`, lines 25-26
- **Details:** `timerStore` is a module-level `Map<string, TimerState>` keyed by block ID. Entries are added in `saveState()` but never removed -- not when the block is unloaded, not when it is deleted from the layout. Over a long Obsidian session with block additions/removals, stale entries accumulate.
- **Recommendation:** Override `onunload()` in PomodoroBlock to call `timerStore.delete(this.instance.id)`. Or, on each `render()`, prune entries whose IDs no longer appear in `plugin.layout.blocks`.

### 1.2 PomodoroBlock sharedAudioCtx never closed
- **Severity:** Low
- **Impact:** One AudioContext persists for the entire Obsidian session (~4KB native resource)
- **File:** `src/blocks/PomodoroBlock.ts`, line 26
- **Details:** `sharedAudioCtx` is created on first sound playback and never closed. AudioContexts on Chromium have a maximum limit (typically 6). While sharing a single context is the correct pattern, it should be closed when no Pomodoro blocks remain active.
- **Recommendation:** Track active PomodoroBlock count; close the AudioContext when it drops to zero. Or accept this as acceptable -- one AudioContext is unlikely to cause issues.

### 1.3 VoiceDictationBlock: stream cleanup registered multiple times
- **Severity:** Low
- **Impact:** Multiple cleanup callbacks accumulate per recording session
- **File:** `src/blocks/VoiceDictationBlock.ts`, lines 106-114 and 222
- **Details:** Each call to `startRecording()` registers a new cleanup callback via `this.register(() => stream.getTracks().forEach(t => t.stop()))` (line 222). The earlier registration at line 106 also registers cleanup for `this.mediaRecorder`. If the user records multiple times before the block is unloaded, each recording session adds another cleanup callback. The callbacks are harmless (calling `stop()` on an already-stopped track is a no-op) but they accumulate.
- **Recommendation:** Store a single cleanup function reference and replace it on each recording start, rather than appending via `this.register()`.

### 1.4 Tag cache (`tagCache`) is module-level and never cleared on plugin unload
- **Severity:** Low
- **Impact:** Cached `TFile[]` arrays hold references to file objects even after plugin is unloaded
- **File:** `src/utils/tags.ts`, line 26
- **Details:** The `tagCache` Map persists at module scope. If the plugin is disabled and re-enabled, the old cache entries remain, potentially holding stale TFile references.
- **Recommendation:** Export an `initTagCache` / `clearTagCache` function and call it from `plugin.onunload()`. Note: `clearTagCache()` already exists but is never called from anywhere in the codebase.

---

## 2. DOM Performance & Reflow

### 2.1 Forced reflow in resizeBlockToContent
- **Severity:** Medium
- **Impact:** One forced synchronous layout per auto-height block per resize cycle
- **File:** `src/GridLayout.ts`, lines 383-397
- **Details:** The method applies `hp-auto-rows` class, reads `offsetHeight` twice (content + header), removes the class, then forces a reflow with `void blockContent.offsetHeight`. While the batch scheduling (`scheduleResize`) coalesces multiple blocks into one rAF, within that rAF each block still triggers its own class-add/read/class-remove/reflow cycle. For N auto-height blocks, this is O(N) forced reflows in a single frame.
- **Recommendation:** Restructure to batch all DOM writes (add classes) first, then batch all reads, then batch all restores. This would reduce forced reflows from O(N) to O(1):
  ```
  // Phase 1: Add classes to all blocks
  for (block of batch) block.addClass('hp-auto-rows');
  // Phase 2: Read all heights (single reflow)
  for (block of batch) heights[i] = block.offsetHeight;
  // Phase 3: Remove classes
  for (block of batch) block.removeClass('hp-auto-rows');
  ```

### 2.2 getComputedStyle called per block in resizeBlockToContent
- **Severity:** Low
- **Impact:** Forces style recalculation; ~0.1ms per call
- **File:** `src/GridLayout.ts`, lines 401-406
- **Details:** `window.getComputedStyle(wrapper)` is called for each auto-height block to read padding and gap. These values are constant across blocks (set by CSS on `.homepage-block-wrapper`).
- **Recommendation:** Cache the computed padding/gap values once per resize batch (or once per render cycle) instead of computing per block.

### 2.3 GridStack full destroy/reinit on every edit mode toggle and settings save
- **Severity:** High
- **Impact:** Full DOM teardown + rebuild of all blocks; 50-200ms for a 10-block layout
- **File:** `src/GridLayout.ts`, lines 52 (`render`), 908 (`rerender`), 709-730 (`setEditMode`)
- **Details:** Every call to `rerender()` calls `render()` which calls `destroyAll()` then `initGridStack()`. This tears down all block Component instances (unloading event listeners, intervals, ResizeObservers), destroys the entire GridStack DOM, rebuilds it, and re-renders every block. This happens on:
  - Edit mode toggle (via `setEditMode`)
  - Block add/remove/duplicate/move
  - Settings save
  - Column count change
  For data-heavy blocks (QuotesList reading files, ImageGallery loading images, EmbeddedNote running MarkdownRenderer), this causes visible flicker and redundant async work.
- **Recommendation:** Consider a partial update strategy: for block add/remove, use GridStack's `addWidget`/`removeWidget` APIs instead of full destroy/rebuild. For settings changes, only re-render the affected block. The edit mode toggle specifically could toggle `staticGrid` and swap block content (compact placeholder vs real content) without destroying GridStack.

### 2.4 RecentFilesBlock sorts ALL vault files on every modify event
- **Severity:** Medium
- **Impact:** O(N log N) sort of all markdown files on every file modification
- **File:** `src/blocks/RecentFilesBlock.ts`, lines 21-31
- **Details:** The `vault.on('modify')` handler calls `this.app.vault.getMarkdownFiles().sort(...)` to check whether the modified file would appear in the top N. This sorts the entire file list just to determine if a re-render is needed. In a vault with 10,000 files, this is expensive for an event that fires frequently.
- **Recommendation:** Instead of sorting all files, compare the modified file's `stat.mtime` against the mtime of the last displayed file. If it's newer, trigger; if not, skip. This turns an O(N log N) check into O(1).

### 2.5 ImageGallery: all images loaded eagerly (no lazy loading)
- **Severity:** Medium
- **Impact:** Galleries with 100+ images load all resources at once, blocking the main thread
- **File:** `src/blocks/ImageGalleryBlock.ts`, lines 255-266
- **Details:** Comment on line 259 says "Not lazy -- we need dimensions before GridStack can measure the block height." All images are loaded eagerly and awaited via `Promise.all(imageLoadPromises)`. For large galleries (maxItems up to 200), this means 200 image loads before the block can report its height.
- **Recommendation:** For auto-height mode, use CSS `aspect-ratio` to reserve space without loading images (if aspect ratios are known or can be read from metadata). Alternatively, load only the first viewport's worth of images eagerly and lazy-load the rest. For fixed-height mode, `loading="lazy"` could be added since height is predetermined.

---

## 3. Event Handler Efficiency

### 3.1 Multiple blocks register overlapping vault event handlers
- **Severity:** Low
- **Impact:** Each block type independently listens to vault events; with many blocks, handler count scales linearly
- **File:** Multiple blocks (FolderLinks, ImageGallery, RecentFiles, EmbeddedNote, RandomNote, QuotesList)
- **Details:** If the user has 5 FolderLinks blocks and 3 ImageGallery blocks, there are 8 separate `vault.on('create')` handlers, 8 `vault.on('delete')` handlers, etc. Each handler does its own relevance check. While Obsidian's event system handles this fine for typical usage (< 20 blocks), it's architecturally wasteful.
- **Recommendation:** This is acceptable at the current scale (MAX_BLOCKS = 100, practical use ~10-20). If scaling becomes an issue, consider a centralized event dispatcher in GridLayout that filters once and notifies relevant blocks.

### 3.2 QuotesList metadataCache handler fires on any file with matching tag
- **Severity:** Low
- **Impact:** Re-renders QuotesList block even when the changed file is not currently displayed
- **File:** `src/blocks/QuotesListBlock.ts`, lines 42-47
- **Details:** The `metadataCache.on('changed')` handler triggers a re-render whenever ANY file with the configured tag changes, even if the block is showing a single daily quote from a different file. The `cacheHasTag` check is O(1) (fast), but the subsequent re-render reads all tagged files from disk.
- **Recommendation:** In single mode with dailySeed, compare the changed file against the currently displayed file and skip re-render if they differ.

### 3.3 clearTagCache is exported but never called
- **Severity:** Low
- **Impact:** Tag cache may serve stale data for up to 5 seconds after metadata changes
- **File:** `src/utils/tags.ts`, lines 41-44
- **Details:** The function `clearTagCache()` exists but is never called by any consumer. The cache relies solely on TTL (5 seconds). When `metadataCache.on('changed')` fires in QuotesList or RandomNote, the immediate call to `getFilesWithTag()` may return stale data if the cache was populated less than 5 seconds ago.
- **Recommendation:** Call `clearTagCache()` at the start of `scheduleRender` callbacks in blocks that use tag-based queries. Or invalidate the specific tag entry when `metadataCache.on('changed')` fires.

---

## 4. Rendering Performance

### 4.1 MarkdownRenderer.render called synchronously in re-render paths
- **Severity:** Low
- **Impact:** MarkdownRenderer can take 5-50ms for complex notes; blocks main thread
- **File:** `src/blocks/EmbeddedNoteBlock.ts` line 84, `src/blocks/StaticTextBlock.ts` line 46
- **Details:** Both blocks call `MarkdownRenderer.render()` which is synchronous DOM-heavy work. EmbeddedNoteBlock re-renders on every `vault.on('modify')` of the embedded file (debounced to 300ms). For a large note with many embeds, images, and code blocks, this can cause frame drops.
- **Recommendation:** Acceptable for typical use. For large notes, consider rendering into an off-screen fragment first, then swapping it in. Or increase the debounce to 500ms for the modify handler specifically.

### 4.2 Emoji picker renders full grid eagerly on open
- **Severity:** Low
- **Impact:** ~235 emoji entries rendered on each panel open; ~1-2ms
- **File:** `src/utils/emojiPicker.ts`, lines 78-97
- **Details:** `renderGrid('')` creates a button element for every emoji in `EMOJI_PICKER_SET` (exported from `emojis.ts`, 37KB). Each open/close cycle destroys and recreates all buttons. Search debounce is 100ms which is good.
- **Recommendation:** This is fast enough in practice (~200 items). If the set grows significantly, consider virtual scrolling or rendering in chunks.

---

## 5. CSS Performance

### 5.1 `container-type: size` on block wrappers forces containment
- **Severity:** Medium
- **Impact:** Every block wrapper creates a separate layout containment context
- **File:** `styles.css`, lines 112, 560, 748, 949, 1201, 3235
- **Details:** `container-type: size` (used on several blocks like clock, greeting, video-embed) establishes layout, size, and style containment. This is necessary for `@container` queries but creates rendering overhead. The homepage-view itself also has `container-type: inline-size` (line 14), and each `.homepage-block-wrapper` has `container-type: inline-size` (line 112). This means the browser maintains containment contexts at three levels: view -> wrapper -> block-specific.
- **Recommendation:** This is the correct approach for responsive container queries. The overhead is acceptable. However, blocks that don't use `@container` queries (html, spacer, bookmarks) could omit `container-type` to reduce containment overhead.

### 5.2 `backdrop-filter` on block wrappers triggers GPU compositing
- **Severity:** Low
- **Impact:** When backdrop blur is enabled, each card becomes a GPU-composited layer
- **File:** `styles.css`, lines 113-114; `src/utils/blockStyling.ts`, lines 93-99
- **Details:** `backdrop-filter: var(--hp-backdrop-blur, none)` is set on every `.homepage-block-wrapper`. When the user configures backdrop blur, this promotes the element to a compositing layer. With many blocks using blur, GPU memory usage increases.
- **Recommendation:** The default is `none` which has zero cost. The implementation correctly only sets the value when `backdropBlur > 0 && bgOpacity < 100`. This is well-handled.

### 5.3 23 uses of `color-mix()` in accent color system
- **Severity:** Low
- **Impact:** `color-mix()` is computed at style resolution time; 23 uses per accented card
- **File:** `styles.css`, lines 149-170 and surrounding
- **Details:** The accent color system derives 10+ CSS variables via `color-mix(in srgb, ...)`. These are re-evaluated whenever the browser resolves styles for accented blocks. For a page with 10 accented blocks, that is ~230 color-mix evaluations per style recalculation.
- **Recommendation:** Modern browsers handle `color-mix()` efficiently. This is the correct pattern for derived color palettes. No action needed.

### 5.4 Many transitions declared but manageable
- **Severity:** Low
- **Impact:** ~50 transition declarations across styles.css; standard CSS performance
- **File:** `styles.css` (throughout)
- **Details:** Transitions are on `opacity`, `transform`, `background`, `border-color`, and `color` -- all GPU-friendly properties. No transitions on layout-triggering properties like `width`, `height`, or `top/left` (GridStack's own animations handle those).
- **Recommendation:** Well-designed. The `transition: font-size 0.25s` declarations in the clock/greeting blocks (lines 568, 580, 587, 594, 606) do cause layout recalculation during container query breakpoint changes, but these are infrequent events.

---

## 6. Bundle & Load Performance

### 6.1 No code splitting or lazy loading
- **Severity:** Medium
- **Impact:** All 16 block types + GridStack loaded eagerly; 460KB bundle
- **File:** `esbuild.config.mjs`, `src/main.ts` lines 1-20
- **Details:** The bundle is 471KB (unminified). All block types are imported at the top of `main.ts` and registered in `registerBlocks()` during `onload()`. GridStack (~80KB minified) is also eagerly loaded. There is no dynamic import or lazy loading.
  - `emojis.ts` is 37KB of static data (emoji-keyword pairs) that is only needed when a settings modal with an emoji picker is opened.
  - `VoiceDictationBlock` depends on `MediaRecorder` and `requestUrl` for cloud APIs, used only when recording.
  - `GridStack` is used only when the homepage view is actually opened.
- **Recommendation:** For an Obsidian plugin, 471KB is acceptable (Obsidian loads plugins lazily). However, if bundle size becomes a concern:
  1. Move `emojis.ts` to a dynamic `import()` loaded on first emoji picker open.
  2. Consider lazy-loading GridStack via `import('gridstack')` in `HomepageView.onOpen()`.
  3. These are low-priority optimizations.

### 6.2 esbuild configuration is well-tuned
- **Severity:** N/A (positive finding)
- **File:** `esbuild.config.mjs`
- **Details:** Tree shaking enabled, `console.debug` stripped via `pure`, debugger statements dropped in production, source maps only in watch mode. Target is `es2022` which avoids unnecessary transpilation in Electron.

---

## 7. Tag Cache Analysis

### 7.1 O(N) scan with 5-second TTL
- **Severity:** Medium
- **Impact:** First call after TTL expiry scans all vault markdown files; O(N) where N = file count
- **File:** `src/utils/tags.ts`, lines 29-38
- **Details:** `getFilesWithTag()` calls `app.vault.getMarkdownFiles()` (returns a snapshot array) then filters through `app.metadataCache.getFileCache()` for each file. In a vault with 10,000 markdown files, this is 10,000 cache lookups. The 5-second TTL means this scan runs at most once every 5 seconds per unique tag.
- **Recommendation:** The TTL approach is reasonable for typical vaults (1,000-5,000 files). For very large vaults:
  1. Consider using `app.metadataCache.getCachedFiles()` with a tag index if Obsidian's API supports it (it currently does not expose a tag index directly).
  2. Consider a longer TTL (10-15 seconds) for the QuotesList "list" mode where real-time updates are less critical.
  3. In single/daily-seed mode, the result is deterministic for the day -- cache could persist until midnight.

### 7.2 Tag cache stores TFile references that may become stale
- **Severity:** Low
- **Impact:** If a file is deleted during the 5-second TTL window, the cached TFile object may reference a removed file
- **File:** `src/utils/tags.ts`, line 37
- **Details:** The cache stores actual `TFile` objects. If a file is deleted between cache population and consumption, callers may receive a stale reference. Consumers like QuotesList and RandomNote call `app.vault.read(file)` on cached files, which would throw if the file was deleted.
- **Recommendation:** Callers already handle read errors gracefully (try/catch). The 5-second TTL limits exposure. Acceptable as-is.

---

## 8. Auto-Height Resize Cascading

### 8.1 Potential cascade: Block A resize triggers Block B width change
- **Severity:** Medium
- **Impact:** Resize -> repack -> width change -> observeWidthForAutoHeight -> new resize request
- **File:** `src/GridLayout.ts` lines 321-365, `src/blocks/BaseBlock.ts` lines 93-111
- **Details:** The resize flow is:
  1. Block dispatches `request-auto-height` event
  2. `scheduleResize()` batches into rAF
  3. Batch processes all pending resizes
  4. After resizing, `packRows()` repacks all blocks, potentially changing positions
  5. Position changes alter block widths (due to column spanning)
  6. Width changes trigger `observeWidthForAutoHeight()` ResizeObserver callbacks
  7. Those callbacks dispatch new `request-auto-height` events
  8. Go to step 2

  The rAF batching prevents infinite loops within a single frame, but the cascade can produce 2-3 resize cycles before converging. Each cycle involves GridStack DOM updates and layout recalculation.
- **Recommendation:** The current batching design handles this reasonably. To prevent excessive cascading, consider a maximum iteration count (e.g., 3 resize cycles per render) or a dirty flag that suppresses width-triggered resizes during an active resize batch.

---

## 9. Scalability Observations

### 9.1 MAX_BLOCKS limit is 100
- **File:** `src/main.ts`, line 117
- **Details:** Layout validation caps blocks at 100. At this scale:
  - 100 blocks = 100 ResizeObservers (for blocks with `observeWidthForAutoHeight`)
  - 100 blocks = up to 300-400 vault event handlers
  - 100 blocks = 100 setInterval timers (clock, greeting, pomodoro)
  - Full rerender (destroyAll + initGridStack) would be O(100) GridStack widget operations
- **Recommendation:** 100 is a reasonable cap. Real-world usage is typically 5-20 blocks. The rerender-from-scratch approach (finding 2.3) would be the bottleneck at high block counts.

### 9.2 Block type registration is O(1) lookup
- **File:** `src/BlockRegistry.ts`
- **Details:** `BlockRegistry` uses a `Map<BlockType, BlockFactory>`, providing O(1) lookup. The registry is cleared and repopulated once during `onload()`. This is efficient.

---

## Priority Summary

| # | Finding | Severity | Effort to Fix |
|---|---------|----------|---------------|
| 2.3 | Full GridStack destroy/rebuild on every state change | High | High |
| 2.1 | Forced reflows in resizeBlockToContent batch | Medium | Medium |
| 2.4 | RecentFiles sorts all files on every modify event | Medium | Low |
| 2.5 | ImageGallery loads all images eagerly | Medium | Medium |
| 7.1 | Tag cache O(N) scan on TTL expiry | Medium | Low |
| 8.1 | Auto-height resize cascade potential | Medium | Medium |
| 5.1 | Unnecessary container-type on non-queried blocks | Medium | Low |
| 6.1 | No lazy loading (emojis.ts, GridStack) | Medium | Medium |
| 1.1 | PomodoroBlock timerStore never evicted | Medium | Low |
| 3.3 | clearTagCache exported but never called | Low | Low |
| 1.3 | VoiceDictation accumulates stream cleanup callbacks | Low | Low |
| 1.4 | Tag cache not cleared on plugin unload | Low | Low |
| 1.2 | sharedAudioCtx never closed | Low | Low |
| 3.1 | Overlapping vault event handlers across blocks | Low | High |
| 3.2 | QuotesList re-renders on irrelevant metadata changes | Low | Low |
| 4.1 | MarkdownRenderer blocks main thread | Low | Medium |
| 4.2 | Emoji picker renders full grid eagerly | Low | Medium |
