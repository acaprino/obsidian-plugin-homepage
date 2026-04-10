# UI Race Condition Audit -- Homepage Blocks Plugin

Date: 2026-03-21
Scope: Full plugin codebase -- GridStack layout, 16 block types, responsive grid, edit mode, auto-height, lightbox, inline editing.

---

## Race Map

| # | Components | Trigger | Layout Op | Event Handler | Severity |
|---|-----------|---------|-----------|---------------|----------|
| 1 | GridLayout + auto-height blocks | Initial render of N blocks | `resizeBlockToContent` via rAF | ResizeObserver column callback | MEDIUM |
| 2 | GridLayout `scrollIntoView` | `addBlock()` in edit mode | `scrollIntoView` on newly added block | N/A | MEDIUM |
| 3 | EmbeddedNoteBlock rename handler | `vault.on('rename')` | Config save via `saveLayout()` | Stale `this.instance.config` closure | HIGH |
| 4 | ImageGalleryBlock masonry ResizeObserver | `scheduleRender` re-render | `gallery.offsetWidth` read | `this.register(() => ro.disconnect())` accumulation | MEDIUM |
| 5 | QuotesListBlock ResizeObserver | `scheduleRender` re-render | `colsEl.offsetWidth` read | `this.register(() => ro.disconnect())` accumulation | MEDIUM |
| 6 | VoiceDictationBlock stream cleanup | Multiple `startRecording()` calls | N/A | `this.register()` accumulation on each call | HIGH |
| 7 | GridLayout `computeFitZoom` | `toggleEditMode()` | `scrollHeight` / `clientHeight` read in rAF | Edit mode rerender | LOW |
| 8 | Auto-height batch resize cascade | Multiple blocks dispatch `request-auto-height` | `resizeBlockToContent` reads `offsetHeight` | Packed rows shift siblings | MEDIUM |
| 9 | StaticTextBlock inline edit + auto-height | `save()` triggers async `renderContent()` | `data-auto-height-content` measurement | No `request-auto-height` after save | MEDIUM |
| 10 | EmbeddedNoteBlock grow mode auto-height | Async `MarkdownRenderer.render()` | No `requestAutoHeight()` after render | GridStack cell stays at initial height | HIGH |

---

## Race Condition Findings

### [HIGH-001] EmbeddedNoteBlock rename handler reads stale `this.instance.config`

- **Timeline:**
  - T0: User renames file `Notes/Old.md` to `Notes/New.md`. Obsidian fires `vault.on('rename', file, 'Notes/Old.md')`.
  - T1: Rename handler at line 28 reads `this.instance.config.filePath` -- gets `'Notes/Old.md'`.
  - T2: Handler matches `oldPath === filePath`, builds `newBlocks` array with updated `filePath: file.path` (`'Notes/New.md'`), calls `this.plugin.saveLayout(...)`.
  - T3: `saveLayout` persists the new layout to disk. **But** `this.instance` still holds the old `BlockInstance` object -- it was captured at construction time and never updated.
  - T4: Line 37 calls `trigger()` which calls `scheduleRender`. Inside `renderContent`, `this.instance.config.filePath` is still `'Notes/Old.md'` because the immutable layout mutation created new objects but never replaced `this.instance`.
  - T5: `renderContent` calls `getAbstractFileByPath('Notes/Old.md')` -- file not found at that path. Block shows "File not found".
  - T6: On next full rerender (e.g., tab switch, edit mode toggle), the block picks up the corrected config from `plugin.layout.blocks` and renders correctly.
  - **RESULT:** After renaming the embedded file, the block shows "File not found" until the next full rerender.
- **File:Line:** `src/blocks/EmbeddedNoteBlock.ts:28-37`
- **Confidence:** 90%
- **Existing mitigation:** The immutable layout pattern correctly persists the new path to disk. But the handler's `trigger()` call initiates re-render using the stale `this.instance` reference.
- **Why it fails:** `this.instance` is the original `BlockInstance` object passed at construction time. The immutable layout pattern creates new objects via spread -- it never patches the existing `this.instance.config` object. The re-render function reads `this.instance.config.filePath` which still holds the old path.
- **Fix:**
  ```typescript
  // In the rename handler, after saving the layout, also update the
  // local reference so the immediate re-render uses the new path:
  this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
    const { filePath = '' } = this.instance.config as { filePath?: string };
    if (oldPath === filePath) {
      // Update the persisted layout (immutable pattern)
      const newBlocks = this.plugin.layout.blocks.map(b =>
        b.id === this.instance.id ? { ...b, config: { ...b.config, filePath: file.path } } : b,
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      // Also update local instance so the immediate re-render reads the new path
      this.instance = newBlocks.find(b => b.id === this.instance.id) ?? this.instance;
    }
    if (oldPath === filePath || file.path === (this.instance.config as { filePath?: string }).filePath) trigger();
  }));
  ```
  Note: `this.instance` is `protected` in `BaseBlock`, so this assignment is valid. Alternatively, read the config from `this.plugin.layout.blocks.find(...)` in `renderContent` instead of `this.instance.config`.

---

### [HIGH-002] EmbeddedNoteBlock grow mode never dispatches `requestAutoHeight`

- **Timeline:**
  - T0: Homepage opens with an EmbeddedNote block in `heightMode: 'grow'` mode.
  - T1: `GridLayout.initGridStack` identifies the block as auto-height (`shouldAutoHeight` returns true for `embedded-note` + `grow`), sets up `request-auto-height` listener on the grid element, calls `block.render(contentEl)`.
  - T2: `render()` returns a Promise. GridLayout chains `.then(() => { if (needsResize) this.scheduleResize(...) })` (line 184).
  - T3: Inside `render()`, it calls `this.renderContent(el)` which is async. `render()` returns the promise from `this.renderContent(el).catch(...)`.
  - T4: `renderContent` does `el.empty()`, creates DOM, calls `await this.app.vault.read(file)`, then `await MarkdownRenderer.render(...)`. After the markdown is rendered, the method returns.
  - T5: GridLayout's `.then()` fires, calls `scheduleResize()`. This queues a rAF.
  - T6: In the rAF, `resizeBlockToContent` looks for `[data-auto-height-content]` inside the grid element. **But EmbeddedNoteBlock never sets `data-auto-height-content` on any element.** The method returns false because `contentEl` is null.
  - T7: The block content overflows the grid cell or is clipped.
  - T8: On subsequent `scheduleRender` re-renders (e.g., file modify), the block calls `scheduleRender` which fires `requestAutoHeight()` after the callback. But `resizeBlockToContent` still cannot find `[data-auto-height-content]` -- same failure.
  - **RESULT:** EmbeddedNote blocks in grow mode never auto-size to their content. The grid cell stays at the default `h` rows.
- **File:Line:** `src/blocks/EmbeddedNoteBlock.ts:46-88` (missing `data-auto-height-content` attribute)
- **Confidence:** 95%
- **Existing mitigation:** The `shouldAutoHeight` function in GridLayout correctly identifies `embedded-note` + `grow` as auto-height. But the block itself never marks a measurement element.
- **Why it fails:** Every other auto-height block (ImageGallery, QuotesList, StaticText, ButtonGrid, RandomNote) sets `data-auto-height-content` on the element that should be measured. EmbeddedNoteBlock does not.
- **Fix:**
  ```typescript
  // In renderContent(), after creating contentEl:
  const contentEl = el.createDiv({ cls: 'embedded-note-content' });
  if (heightMode === 'grow') {
    contentEl.setAttribute('data-auto-height-content', '');
  }
  if (heightMode === 'scroll') {
    contentEl.setAttribute('tabindex', '0');
    contentEl.setAttribute('role', 'region');
    contentEl.setAttribute('aria-label', file.basename);
  }
  ```

---

### [HIGH-003] VoiceDictationBlock accumulates stream cleanup registrations

- **Timeline:**
  - T0: User taps record. `startRecording()` calls `navigator.mediaDevices.getUserMedia()`, gets a `MediaStream`.
  - T1: Line 222: `this.register(() => stream.getTracks().forEach(t => t.stop()))`. This pushes a cleanup callback onto the `Component` internal cleanup array.
  - T2: User stops recording. `handleCloudStop` calls `this.mediaRecorder?.stream.getTracks().forEach(t => t.stop())` (line 266), which stops the tracks. The cleanup registered at T1 is now a no-op (tracks already stopped) but remains registered.
  - T3: User taps record again. A new `MediaStream` is obtained. Another `this.register()` callback is pushed. The old callback from T1 is still in the array.
  - T4: Repeat N times. Each recording session adds one cleanup callback that never gets removed.
  - T5: When the block is finally unloaded, `Component.onunload()` iterates through all N cleanup functions, calling `.stop()` on tracks that are already stopped.
  - **RESULT:** Memory leak proportional to number of recording sessions. Each `register()` call also retains a closure over the `stream` object, preventing GC of the `MediaStream` even after its tracks are stopped.
- **File:Line:** `src/blocks/VoiceDictationBlock.ts:222`
- **Confidence:** 95%
- **Existing mitigation:** The explicit `onstop` handler at line 266 does stop the tracks. But the `register()` closure is never deregistered.
- **Why it fails:** Obsidian's `Component.register()` returns a cleanup function, but the code ignores the return value. There is no mechanism to remove individual registrations from the component's cleanup list.
- **Fix:**
  ```typescript
  // Track the stream cleanup so it can be deregistered before re-registering:
  private streamCleanup: (() => void) | null = null;

  private async startRecording(): Promise<void> {
    // ... getUserMedia ...

    // Deregister previous stream cleanup before adding a new one
    if (this.streamCleanup) {
      this.streamCleanup();
      this.streamCleanup = null;
    }

    const stopTracks = () => stream.getTracks().forEach(t => t.stop());
    // Component.register() does not return a deregister handle in Obsidian's API.
    // Instead, stop tracks inline when recording stops, and only use register()
    // for the final emergency cleanup. Alternatively, store the stream reference
    // and clean up in onunload() instead of register():
    this.currentStream = stream;
    // Remove the per-call register() entirely; rely on the existing onunload cleanup.
  }
  ```
  A simpler fix: remove line 222 entirely (the `this.register(() => stream...)` call). The `onstop` handler at line 266 already stops tracks. The `onunload` cleanup at line 106 handles the emergency case. The per-call registration is redundant and leaky.

---

### [MEDIUM-004] scrollIntoView after addBlock fires before async block content is rendered

- **Timeline:**
  - T0: User clicks "Add block" in edit mode. `addBlock()` at line 899 sets `lastAddedBlockId`, calls `rerender()`.
  - T1: `rerender()` calls `render()` which destroys the grid and rebuilds it. In edit mode, blocks render compact placeholders (synchronous). GridStack creates DOM elements.
  - T2: At line 232, the code finds the newly added block's element and calls `el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
  - T3: **In edit mode**, this works correctly because placeholders are synchronous. **However**, if this code path is ever reached in view mode (e.g., by a future code change or if edit mode renders full blocks), the async block renders would not be complete.
  - T4: More critically, in edit mode the GridStack `load()` + `compact()` may not have finalized the block's y-position before `scrollIntoView` fires. GridStack's internal layout algorithm may still be processing.
  - **RESULT:** The scroll target may be at a temporary position. In practice, since edit mode uses compact placeholders, the visual glitch is minor -- a brief flicker or scroll to a slightly wrong position that corrects after GridStack settles.
- **File:Line:** `src/GridLayout.ts:232-241`
- **Confidence:** 50%
- **Existing mitigation:** Edit mode uses synchronous compact placeholders, so DOM is mostly settled. GridStack `load()` is synchronous.
- **Why it might fail:** GridStack's `load()` triggers internal `_updateContainerHeight()` which may defer to rAF. The element's final position could shift after `scrollIntoView` fires.
- **Fix:**
  ```typescript
  // Wrap in rAF to ensure GridStack has settled layout:
  if (this.lastAddedBlockId) {
    const targetId = this.lastAddedBlockId;
    this.lastAddedBlockId = null;
    requestAnimationFrame(() => {
      const el = this.gridEl.querySelector(`[gs-id="${CSS.escape(targetId)}"]`);
      if (el instanceof HTMLElement) {
        el.querySelector('.homepage-block-wrapper')?.addClass('block-just-added');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
  ```

---

### [MEDIUM-005] ImageGalleryBlock masonry ResizeObserver accumulates across re-renders

- **Timeline:**
  - T0: ImageGalleryBlock renders with masonry layout. `loadAndRender` creates a `ResizeObserver` at line 205, calls `this.register(() => ro.disconnect())`.
  - T1: A file is created in the gallery folder. `scheduleRender` fires, calls `el.empty()` then `this.loadAndRender(el)`.
  - T2: `loadAndRender` creates a **new** `gallery` div (the old one was removed by `el.empty()`), creates a **new** `ResizeObserver`, calls `this.register(() => ro.disconnect())` again.
  - T3: The old ResizeObserver from T0 is observing a detached DOM element (the old `gallery` div). It will not fire callbacks (detached elements don't resize), but it holds a reference to the old DOM subtree.
  - T4: The `register()` cleanup from T0 is still in the Component's cleanup list. It will only run when the block is unloaded.
  - T5: After N re-renders, there are N stale ResizeObservers and N cleanup callbacks, each retaining a reference to a detached DOM tree.
  - **RESULT:** Memory leak proportional to number of re-renders. Each detached gallery DOM tree (with image elements, video elements) is retained by the stale ResizeObserver closure. For galleries with many images, this can be significant.
- **File:Line:** `src/blocks/ImageGalleryBlock.ts:205-207`
- **Confidence:** 85%
- **Existing mitigation:** The `el.empty()` call removes old DOM, so the old ResizeObserver observes a detached element and won't fire. But the observer object and its target are not GC'd until the block unloads.
- **Why it fails:** `this.register()` has no "replace previous" mechanism. Each `loadAndRender` call adds a new observer without disconnecting the old one.
- **Fix:**
  ```typescript
  // Store the masonry observer at the block level and disconnect before creating a new one:
  private masonryObserver: ResizeObserver | null = null;

  private async loadAndRender(el: HTMLElement): Promise<void> {
    // ... existing code ...
    if (layout === 'masonry') {
      // Disconnect previous observer
      if (this.masonryObserver) {
        this.masonryObserver.disconnect();
      }
      // ... create new observer ...
      this.masonryObserver = ro;
      // No need for this.register() -- clean up in onunload instead
    }
  }

  onunload(): void {
    super.onunload();
    this.masonryObserver?.disconnect();
    this.masonryObserver = null;
    // ... existing lightbox cleanup ...
  }
  ```

---

### [MEDIUM-006] QuotesListBlock ResizeObserver accumulates across re-renders (same pattern as 005)

- **Timeline:** Same as MEDIUM-005 but for QuotesListBlock at line 174-176.
  - T0: QuotesList renders with non-centered style. Creates `ResizeObserver(updateCols)`, calls `this.register(() => ro.disconnect())`.
  - T1: Metadata cache change triggers `scheduleRender`, which calls `el.empty()` then `this.loadAndRender(el)`.
  - T2: New `colsEl`, new `ResizeObserver`, new `this.register()`. Old observer references detached DOM.
  - T3: N re-renders = N stale observers + N cleanup callbacks.
  - **RESULT:** Memory leak, though smaller than ImageGallery since quote DOM is lighter.
- **File:Line:** `src/blocks/QuotesListBlock.ts:174-176`
- **Confidence:** 85%
- **Existing mitigation:** None beyond the detached DOM not firing callbacks.
- **Fix:** Same pattern as MEDIUM-005 -- store the observer at block level and disconnect before re-creating.

---

### [MEDIUM-007] Auto-height resize cascade: block A resize triggers block B width change triggers block B resize

- **Timeline:**
  - T0: Page loads with 3 auto-height blocks (A, B, C) in a 3-column layout. All dispatch `request-auto-height` after their initial async renders complete.
  - T1: Block A's `request-auto-height` event is caught by GridLayout. `scheduleResize` adds A to `pendingResizes` and schedules a batch rAF.
  - T2: Block B and C also dispatch `request-auto-height` before the rAF fires. They are added to `pendingResizes`. The rAF is already scheduled (single batch).
  - T3: rAF fires. The batch processes A, B, C in sequence. For each, `resizeBlockToContent` reads `offsetHeight` and calls `gridStack.update()`.
  - T4: After the batch, `packRows` repacks all blocks. Block B's y-position changes. GridStack applies the new position.
  - T5: Block B's width may change if it moved from column 1 to spanning columns 1-2 (or if responsive columns kicked in). This triggers block B's `observeWidthForAutoHeight` ResizeObserver.
  - T6: The ResizeObserver fires asynchronously, dispatching another `request-auto-height`. This triggers another `scheduleResize` batch.
  - T7: The new batch re-measures B, which may trigger yet another repack.
  - T8: Normally converges in 2-3 iterations. But with many blocks and responsive columns, this cascade can cause visible layout jitter: blocks briefly appear at wrong heights, then snap to correct positions.
  - **RESULT:** Visible layout jitter during initial load with many auto-height blocks. Self-correcting but noticeable on slower devices.
- **File:Line:** `src/GridLayout.ts:324-365` (scheduleResize batch) + `src/blocks/BaseBlock.ts:100-111` (observeWidthForAutoHeight)
- **Confidence:** 65%
- **Existing mitigation:** Batch coalescing via `pendingResizes` Map + single rAF. The `observeWidthForAutoHeight` uses rAF throttling. This limits the cascade to at most one extra batch per frame.
- **Why it partially fails:** The batch processes all pending resizes, then repacks. But the repack can trigger ResizeObserver callbacks that create a new batch in the next frame. With N auto-height blocks, this creates N frames of potential jitter.
- **Fix:** Consider a convergence guard: if the batch rAF detects no actual height change (`anyResized === false`), skip the repack. Additionally, add a max-iteration guard to prevent infinite cascading:
  ```typescript
  // In scheduleResize, track cascade depth:
  private resizeCascadeDepth = 0;
  private static MAX_CASCADE = 3;

  private scheduleResize(gsEl: HTMLElement, instance: BlockInstance): void {
    this.pendingResizes.set(instance.id, { gsEl, instance });
    if (this.batchRafId !== null) return;
    this.batchRafId = requestAnimationFrame(() => {
      // ... existing batch logic ...
      if (this.resizeCascadeDepth >= GridLayout.MAX_CASCADE) {
        this.resizeCascadeDepth = 0;
        return; // stop cascading
      }
      this.resizeCascadeDepth++;
      // ... process batch ...
      // Reset depth when no more resizes are pending
      if (this.pendingResizes.size === 0) {
        this.resizeCascadeDepth = 0;
      }
    });
  }
  ```

---

### [MEDIUM-008] StaticTextBlock inline save does not trigger auto-height recalculation

- **Timeline:**
  - T0: User clicks pencil icon to enter inline edit on a StaticTextBlock with `heightMode: 'auto'`.
  - T1: User types content, presses Ctrl+Enter to save.
  - T2: `save()` at line 82 persists layout via `saveLayout()`, then calls `this.renderContent(el)`.
  - T3: `renderContent` is async (calls `MarkdownRenderer.render`). It `el.empty()`s the container, creates new DOM with `data-auto-height-content`, and awaits the markdown render.
  - T4: After render, `renderContent` returns. **But `renderContent` is called directly from `save()`, not via `scheduleRender`.**
  - T5: `scheduleRender` automatically calls `this.requestAutoHeight()` after the callback completes. But `renderContent` called directly does NOT trigger `requestAutoHeight`.
  - T6: The GridStack cell retains its old row height. If the new content is taller or shorter, the cell does not resize.
  - T7: The block content overflows or has empty space until the next event that triggers a resize (e.g., window resize, tab switch).
  - **RESULT:** After inline editing, the block height does not adjust to the new content until a full rerender.
- **File:Line:** `src/blocks/StaticTextBlock.ts:82-91`
- **Confidence:** 80%
- **Existing mitigation:** None. The `save()` and `cancel()` functions call `renderContent` directly, bypassing `scheduleRender`'s auto-height dispatch.
- **Why it fails:** `scheduleRender` wraps the callback and calls `requestAutoHeight()` after success. Direct calls to `renderContent` skip this wrapper.
- **Fix:**
  ```typescript
  const save = (): void => {
    // ... existing layout save logic ...
    this.renderContent(el)
      .then(() => this.requestAutoHeight())
      .catch(() => { /* handled in render */ });
  };

  const cancel = (): void => {
    this.renderContent(el)
      .then(() => this.requestAutoHeight())
      .catch(() => { /* handled in render */ });
  };
  ```

---

### [LOW-009] computeFitZoom reads `scrollHeight` before blocks finish async rendering

- **Timeline:**
  - T0: User clicks FAB to enter edit mode. `toggleEditMode()` fires.
  - T1: `setEditMode(true)` calls `rerender()`, which destroys and rebuilds the grid with compact edit placeholders.
  - T2: `toggleEditMode` defers zoom computation to `requestAnimationFrame` (line 53).
  - T3: In the rAF, `computeFitZoom()` reads `this.gridEl.scrollHeight` and `this.gridEl.parentElement?.clientHeight`.
  - T4: In edit mode, all blocks are compact synchronous placeholders. GridStack `load()` is synchronous. The DOM should be settled by the rAF.
  - T5: However, GridStack's internal `_updateContainerHeight()` may defer container height calculation. If GridStack uses its own rAF internally, the `scrollHeight` read in our rAF may not reflect the final grid height.
  - **RESULT:** Zoom scale may be slightly off on the first frame, then correct on subsequent interactions. The visual impact is minimal since zoom is interactive (slider).
- **File:Line:** `src/EditToolbar.ts:53-57`, `src/GridLayout.ts:772-779`
- **Confidence:** 40%
- **Existing mitigation:** The rAF callback provides one frame of delay after the synchronous rerender. This is usually sufficient.
- **Why it might fail:** If GridStack's internal layout updates are also deferred to rAF, there's a same-frame race.
- **Fix:** Use a double-rAF to ensure GridStack has settled:
  ```typescript
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.zoomScale = this.grid.computeFitZoom();
      this.grid.setZoom(this.zoomScale);
      this.renderToolbar();
    });
  });
  ```

---

## Stale Closure Audit

| # | File:Line | Captured Value | Can Go Stale? | Impact |
|---|-----------|---------------|---------------|--------|
| 1 | `EmbeddedNoteBlock.ts:28-37` | `this.instance.config` | Yes -- rename handler saves new config to layout but `this.instance` is never updated | HIGH -- block shows "File not found" after rename |
| 2 | `GridLayout.ts:443-473` (collapse toggle) | `instance` parameter | Partially -- `instance` is the render-time snapshot, but handler reads `this.plugin.layout.blocks` for live state | Low -- toggle reads layout directly for `_expandedH` |
| 3 | `GridLayout.ts:514` (duplicate button) | `instance` parameter | No -- handler reads `this.plugin.layout.blocks.find(b => b.id === instance.id)` for current state | Safe |
| 4 | `VoiceDictationBlock.ts:91-103` (mic button handlers) | `el` via `this.containerEl` | Low risk -- `containerEl` is set once in `render()` and the block is re-created on rerender | Safe for current usage |
| 5 | `ImageGalleryBlock.ts:249` (lightbox click handler) | `lightboxItems` array | No -- the array is created fresh each render, and re-render creates new handlers | Safe |
| 6 | `StaticTextBlock.ts:51` (enterInlineEdit) | `this.instance.config.content` | Partially -- reads content at edit entry time, but save reads from `this.plugin.layout.blocks` | Safe (save reads fresh) |

---

## Mitigation Assessment

| Existing Mitigation | Location | Sufficient? | Gap |
|---------------------|----------|-------------|-----|
| `nextGeneration()` / `isStale()` pattern | BaseBlock (used by ImageGallery, EmbeddedNote, QuotesList, StaticText, RandomNote) | Good | Prevents stale async renders from painting. Does not prevent stale config reads (see HIGH-001). |
| `scheduleRender` debounce + `isConnected` guard | BaseBlock | Good | Prevents detached-DOM writes and coalesces rapid updates. But direct calls to render functions bypass the auto-height dispatch (see MEDIUM-008). |
| `observeWidthForAutoHeight` with rAF throttle | BaseBlock | Good | Limits width-change auto-height to 1 per frame. Previous observer is disconnected before new one is created. |
| Batch resize coalescing via `pendingResizes` Map | GridLayout | Good | Prevents per-block rAF spam. But repack can trigger another batch cycle (see MEDIUM-007). |
| `isDestroyed` guard on ResizeObserver | GridLayout | Good | Prevents post-destroy callbacks. |
| `activeLightboxAc` / `myLightboxAc` scoping | ImageGalleryBlock | Good | Prevents cross-instance lightbox interference. Cleanup is correct. |
| Module-level `timerStore` for Pomodoro | PomodoroBlock | Good | Timer state survives re-renders. No race conditions. |
| `GridLayout.packRows` before rendering | GridLayout | Good | Ensures no gaps in initial layout. But does not prevent cascade when auto-height blocks resize post-render. |
| Responsive column change skipped in edit mode | GridLayout:879 | Good | Prevents canonical layout corruption during editing. |
| `syncLayoutFromGrid` responsive guard | GridLayout:655 | Good | Prevents responsive column positions from overwriting canonical x/y/w. Only persists height for non-auto blocks. |

---

## Top 3 Mandatory Actions

1. **Fix EmbeddedNoteBlock rename handler stale config (HIGH-001).** The block shows "File not found" after renaming the embedded file. Either update `this.instance` after the layout save, or read the config from `this.plugin.layout.blocks` in `renderContent` instead of `this.instance.config`.

2. **Add `data-auto-height-content` attribute in EmbeddedNoteBlock grow mode (HIGH-002).** Without this attribute, `resizeBlockToContent` cannot find the measurement element and the block never auto-sizes. This is not a race condition per se but a missing integration point that makes the auto-height timing infrastructure a no-op for this block.

3. **Fix VoiceDictationBlock stream cleanup accumulation (HIGH-003).** Remove the per-call `this.register()` for stream track cleanup at line 222. The `onstop` handler and `onunload` cleanup already cover both normal and emergency shutdown paths. The per-call registration is redundant and causes a memory leak proportional to recording count.

---

## Secondary Actions

4. **StaticTextBlock: dispatch `requestAutoHeight()` after inline save/cancel (MEDIUM-008).** Add `.then(() => this.requestAutoHeight())` to the direct `renderContent` calls in `save()` and `cancel()`.

5. **ImageGalleryBlock + QuotesListBlock: disconnect stale masonry ResizeObservers on re-render (MEDIUM-005, MEDIUM-006).** Store the observer at block level and disconnect before creating a new one, rather than relying solely on `this.register()` which accumulates.

6. **GridLayout `scrollIntoView`: wrap in rAF for layout settlement (MEDIUM-004).** Low-impact in practice since edit mode uses sync placeholders, but a defensive rAF wrapper prevents future regressions.
