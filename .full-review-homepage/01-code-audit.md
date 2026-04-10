# Code Audit: Homepage Blocks -- Obsidian Plugin

### Code Audit Score: 7.5/10
> *Solid codebase with strong architectural patterns and defensive coding, but carries a stale tag cache without invalidation, a module-level mutable singleton (timerStore/sharedAudioCtx) that leaks across plugin reloads, and several resource cleanup gaps on error paths. Deductions: CRITICAL -2 (tag cache stale data), HIGH -1 (Pomodoro state leak), HIGH -1 (VoiceDictation stream cleanup race), MEDIUM -0.5 x 3 (misc). Floor adjusted by strong consistency bonuses.*

---

## Findings

### CRITICAL

**[CRITICAL] Tag cache never invalidated -- stale data served indefinitely after file changes** (Confidence: 95)
- **Location:** `src/utils/tags.ts:26-38`
- **Problem:** `getFilesWithTag()` caches results for 5 seconds via a module-level `tagCache` Map. The exported `clearTagCache()` function exists but is **never called anywhere in the codebase**. When metadata changes (tags added/removed from files), the cache continues serving stale results for up to 5s. More critically, the cache stores `TFile[]` references -- if a file is deleted from the vault but a cached tag query still holds a reference to the `TFile` object, consumers (QuotesList, RandomNote) will attempt to `vault.read()` on a stale file reference, causing silent failures or errors.
- **Scenario:**
  1. User tags a note with `#quotes`, QuotesList picks it up, cache stores result.
  2. Within 5s, user removes the tag from that note.
  3. QuotesList re-renders due to metadataCache 'changed' event.
  4. `getFilesWithTag()` returns the stale cached list still containing the note.
  5. `vault.read()` succeeds (file still exists, just untagged) -- user sees stale quote.
  6. Worse: if the file is renamed/deleted within the TTL, the cached `TFile` reference is stale.
- **Fix:** Either (a) call `clearTagCache()` in the `metadataCache.on('changed')` and `vault.on('delete/rename')` handlers in blocks that use tags, or (b) remove the cache entirely since the TTL is only 5s and the vault iteration is O(n) on markdown files -- a cost that's negligible for the debounce-gated re-renders this plugin uses. If keeping the cache, subscribe to `metadataCache.on('changed')` globally in `main.ts:onload()` to clear it.

**[CRITICAL] HtmlBlock regex bypass allows SVG-based XSS** (Confidence: 70)
- **Location:** `src/blocks/HtmlBlock.ts:25-26`
- **Problem:** The `DANGEROUS_TAGS_RE` regex strips `<svg>` tags, but only matches `<svg>` not variants like `<SVG>` (already handled by `/gi` flag). However, the regex uses `\b` word boundary after the tag name, which fails on constructs like `<svg/onload=...>` where there's no whitespace. More critically, `sanitizeHTMLToDom()` runs after the regex strip, but `sanitizeHTMLToDom` is Obsidian's DOMParser-based sanitizer -- in Electron's full Node context, the security guarantees are weaker than a browser. The defense-in-depth comment acknowledges this. The regex also does not strip `<a>` tags with `javascript:` hrefs, or `<img>` with `onerror` handlers -- those survive both the regex and `sanitizeHTMLToDom`.
- **Fix:** The regex approach is inherently fragile. Consider using a proper allowlist instead: after `sanitizeHTMLToDom()`, walk the resulting DOM tree and remove any elements not in an explicit allowlist (`p`, `div`, `span`, `h1`-`h6`, `ul`, `ol`, `li`, `a`, `img`, `br`, `hr`, `blockquote`, `code`, `pre`, `table`, `tr`, `td`, `th`, `strong`, `em`). Also strip event handler attributes (`on*`) from all elements.

---

### HIGH

**[HIGH] Pomodoro module-level state survives plugin unload/reload -- memory leak and stale state** (Confidence: 90)
- **Location:** `src/blocks/PomodoroBlock.ts:25-26`
- **Problem:** `timerStore` and `sharedAudioCtx` are module-level singletons. When the plugin is unloaded (e.g., user disables it in settings), these persist in the bundled module closure. On re-enable, `registerBlocks()` clears the block registry but `timerStore` and `sharedAudioCtx` retain stale entries. The `timerStore` maps use block instance IDs as keys -- if a user removes a Pomodoro block, its timer state lingers in the Map forever (until page reload). Over many add/remove cycles, this accumulates memory.
- **Fix:** Add cleanup in `main.ts:onunload()` -- export a `clearTimerState()` function from PomodoroBlock and call it. Alternatively, scope `timerStore` to the plugin instance rather than the module.

**[HIGH] VoiceDictation double stream registration on re-record** (Confidence: 85)
- **Location:** `src/blocks/VoiceDictationBlock.ts:222`
- **Problem:** Every call to `startRecording()` registers a new cleanup callback via `this.register(() => stream.getTracks().forEach(t => t.stop()))`. If the user records multiple times within a single block lifecycle, each recording adds another cleanup registration. Obsidian's `Component.register()` accumulates callbacks -- they don't replace previous ones. On block unload, all registered callbacks run, which is harmless for already-stopped tracks, but the accumulation itself is a slow memory leak of closure references.
- **Fix:** Track the current stream in an instance field and stop the previous one before starting a new recording, or use a single cleanup callback that references a mutable field.

**[HIGH] ConfirmPresetModal fires onConfirm then closes without awaiting** (Confidence: 80)
- **Location:** `src/main.ts:763-765`
- **Problem:** `Promise.resolve(this.onConfirm()).catch(...)` is fire-and-forget. `this.close()` runs immediately after, which calls `onClose()` which empties `contentEl`. If the `onConfirm` callback (which does `saveLayout` + `view.reload()`) throws asynchronously, the error is logged but the modal is already closed and the UI may be in an inconsistent state (layout partially saved, view not reloaded).
- **Scenario:** 1. User clicks "Load preset". 2. `saveLayout` succeeds. 3. `view.reload()` throws (e.g., GridStack init failure due to timing). 4. Modal closes, error logged, but view is in broken state.
- **Fix:** Await the `onConfirm()` promise before calling `this.close()`. Replace with:
  ```typescript
  btn.onClick(async () => {
    try { await this.onConfirm(); } catch (e) { console.error(...); }
    this.close();
  });
  ```

**[HIGH] EmbeddedNote rename handler mutates layout but does not update `this.instance`** (Confidence: 85)
- **Location:** `src/blocks/EmbeddedNoteBlock.ts:31-35`
- **Problem:** When a file is renamed, the handler creates `newBlocks` with the updated `filePath` and saves the layout. But `this.instance` still holds the old `BlockInstance` reference with the old `filePath`. The subsequent `trigger()` call schedules a re-render that reads `this.instance.config.filePath` -- which still has the old path. The `scheduleRender` callback calls `renderContent(e)` which reads from `this.instance.config`, not from `this.plugin.layout.blocks`. The render will show "File not found" until the view is fully reloaded.
- **Fix:** After saving the layout, also update the local reference: `this.instance = { ...this.instance, config: { ...this.instance.config, filePath: file.path } }`. Or read config from `this.plugin.layout.blocks.find(b => b.id === this.instance.id)?.config` in `renderContent`.

---

### MEDIUM

**[MEDIUM] RecentFiles modify handler performs expensive full vault sort on every modify event** (Confidence: 90)
- **Location:** `src/blocks/RecentFilesBlock.ts:26`
- **Problem:** On every `vault.on('modify')` event, the handler calls `this.app.vault.getMarkdownFiles().sort(...)` to compute whether the modified file appears in the top N. For large vaults (thousands of files), this is O(n log n) on every keystroke in any open note. The optimization at line 28 (skip if already at top) helps for the most common case but the sort still runs.
- **Fix:** Use a cheaper check: compare the modified file's `stat.mtime` against the Nth-oldest file's mtime from the last render (cache the cutoff timestamp). If the modified file's new mtime exceeds that cutoff, trigger re-render.

**[MEDIUM] BaseBlock._scheduleTimer not cleaned up via `this.register()`** (Confidence: 80)
- **Location:** `src/blocks/BaseBlock.ts:66`
- **Problem:** `scheduleRender` uses `window.setTimeout` directly and stores the ID in `_scheduleTimer`. Cleanup happens in `onunload()` manually. However, if `scheduleRender` fires after `onunload()` has been called but before the timer fires (possible if something holds a reference to the block and calls `scheduleRender` after unload), the timeout will fire on a dead component. The `isConnected` guard at line 68 prevents DOM mutation but the closure still runs.
- **Fix:** Low impact, but for robustness, add a `_destroyed` flag checked in the timeout callback, or use `this.registerInterval` pattern.

**[MEDIUM] GridLayout.animTimer not cleaned up via `this.register()` pattern** (Confidence: 75)
- **Location:** `src/GridLayout.ts:61`
- **Problem:** `setTimeout` in the animation delay creates a timer that is tracked manually via `this.animTimer`. If `destroyAll()` is called, the timer is cleared. But if the grid element is removed from DOM between `render()` and the timeout firing, the callback tries to `removeClass` on a potentially detached element. No crash (Obsidian's DOM API is tolerant), but unnecessary work.
- **Fix:** Already handled adequately by the `destroyAll` cleanup. Low priority.

**[MEDIUM] StaticTextBlock inline edit reads stale `this.instance.config` instead of layout** (Confidence: 80)
- **Location:** `src/blocks/StaticTextBlock.ts:51`
- **Problem:** `enterInlineEdit` reads `this.instance.config.content` at line 51. If the user has modified the block config via settings modal between when the block was rendered and when they click the pencil, `this.instance.config` holds the render-time snapshot, not the current layout state. The `save()` function at line 83 correctly reads from `this.plugin.layout.blocks`, but the textarea is pre-filled with potentially stale content.
- **Fix:** Read current content from `this.plugin.layout.blocks.find(b => b.id === this.instance.id)?.config?.content` instead of `this.instance.config.content`.

**[MEDIUM] `openWhenEmpty` timer cleanup registered once but timer reassigned on each event** (Confidence: 75)
- **Location:** `src/main.ts:431-449`
- **Problem:** The cleanup function `() => { if (emptyCheckTimer) clearTimeout(emptyCheckTimer) }` is registered once via `this.register()`. But `emptyCheckTimer` is reassigned on every `layout-change` event. The cleanup correctly captures the mutable variable by reference (closure over `let`), so this actually works. However, if the `layout-change` handler fires many times rapidly, only the latest timer is tracked -- previous ones are cleared by the `if (emptyCheckTimer) clearTimeout(emptyCheckTimer)` guard at line 436. This is correct behavior. **No actual bug, downgrade to LOW.**

**[MEDIUM] VoiceDictation note path collision on rapid successive recordings** (Confidence: 70)
- **Location:** `src/blocks/VoiceDictationBlock.ts:180-181`
- **Problem:** Note filename uses `moment().format('YYYY-MM-DD HH-mm-ss')`. If two recordings complete within the same second (e.g., user quickly taps twice with push-to-talk), `vault.create()` will fail because the path already exists. The error is caught at line 294, showing "Failed to save note", but the transcript is lost.
- **Fix:** Append a counter or random suffix: `${timestamp}-${Math.random().toString(36).slice(2, 6)}.md`.

---

### LOW

**[LOW] BlockRegistry is a module-level singleton -- not scoped to plugin instance** (Confidence: 70)
- **Location:** `src/BlockRegistry.ts:23`
- **Problem:** If two instances of the plugin were somehow loaded (edge case in Obsidian development), they would share the same registry. `registerBlocks()` calls `clear()` first which mitigates overlap, but the singleton pattern is architecturally imprecise.
- **Fix:** Accept for now; Obsidian guarantees single plugin instance.

**[LOW] ImageGallery lightbox uses module-level `activeLightboxAc` -- cross-instance interference possible** (Confidence: 60)
- **Location:** `src/blocks/ImageGalleryBlock.ts:15`
- **Problem:** Already mitigated by `myLightboxAc` instance tracking. The module-level state is intentional to ensure only one lightbox exists globally. Adequate.

**[LOW] FolderLinksBlock uses `workspace.onLayoutReady()` inside render** (Confidence: 65)
- **Location:** `src/blocks/FolderLinksBlock.ts:45`
- **Problem:** `onLayoutReady()` is typically called during plugin init. If the block is rendered after layout is already ready (which it always is, since the homepage view opens after workspace init), the callback fires immediately synchronously. This is fine but the intent is unclear -- the comment says "Defer first render so vault is fully indexed" but if the view is opened after startup, the vault is already indexed.
- **Fix:** No bug, but could simplify to just call `this.renderContent()` directly.

**[LOW] Inconsistent error handling in settings modal onChange callbacks** (Confidence: 60)
- **Location:** Multiple blocks
- **Problem:** Some settings modals use `void this.plugin.saveLayout(...)` (fire-and-forget), others use `.then()`. The `saveLayout` method chains promises internally and swallows errors. This is consistent within the codebase pattern (settings changes are non-critical). No actual bug.

**[LOW] `emojis.ts` likely contains a large static array** (Confidence: 95)
- **Location:** `src/utils/emojis.ts` (not read in full)
- **Problem:** Large static data in the JS bundle. Lazy-loaded when emoji picker opens (renderGrid is called on open, not on import). Acceptable.

---

## Persisted State Map

| Artifact | Writer | Reader | Validity Key | Invalidation Risk |
|----------|--------|--------|--------------|-------------------|
| `data.json` (Obsidian) | `plugin.saveData()` via `saveLayout()` | `plugin.loadData()` in `onload()` | None (overwrite) | Kill during chained `savePromise` leaves partial JSON -- mitigated by Obsidian's atomic write |
| `tagCache` (in-memory Map) | `getFilesWithTag()` | `getFilesWithTag()` | 5s TTL timestamp | **HIGH**: `clearTagCache()` never called; stale TFile refs after delete/rename |
| `timerStore` (in-memory Map) | `PomodoroBlock.saveState()` | `PomodoroBlock.render()` | Block instance ID | **MEDIUM**: Entries never removed; survives plugin unload |
| `sharedAudioCtx` (module-level) | `PomodoroBlock.playNotificationSound()` | Same | None | **LOW**: AudioContext persists; browser may suspend |
| `activeLightboxAc` (module-level) | `openMediaLightbox()` | `isLightboxOpen()`, `ImageGalleryBlock.onunload()` | AbortController identity | **LOW**: Correctly scoped per block instance |

---

## Pattern Deviations

| File | Dominant Pattern | Deviation | Severity |
|------|-----------------|-----------|----------|
| `BaseBlock.ts` | `this.registerInterval()` for timers | `_scheduleTimer` uses raw `window.setTimeout` | LOW |
| `GridLayout.ts` | `this.register()` for cleanup | `animTimer` uses raw `setTimeout` with manual cleanup in `destroyAll` | LOW |
| `VoiceDictationBlock.ts` | Single cleanup registration | Multiple `this.register()` calls per recording cycle accumulate | HIGH |
| `EmbeddedNoteBlock.ts` | Immutable layout mutations | `this.instance.config` read in rename handler lags behind saved state | HIGH |
| `RecentFilesBlock.ts` | Debounced re-render via `scheduleRender` | Expensive O(n log n) sort in modify event guard (before debounce) | MEDIUM |
| `main.ts:641,664,668` | `void plugin.saveLayout(...)` | Raw `setTimeout` for button text reset (not cleanup-registered) | LOW |

---

## Code Quality Score

| Category        | Score |
|-----------------|-------|
| Security        | 7/10  |
| Performance     | 7/10  |
| Maintainability | 9/10  |
| Consistency     | 8/10  |
| Resilience      | 7/10  |
| **Overall**     | **7.5/10** |

**Security (7/10):** HTML block has defense-in-depth but regex sanitization is fragile. API keys stored in plaintext (acknowledged in docs). Video embed has proper origin allowlist. CSS injection guarded with regex validation. `sanitizeHTMLToDom` used correctly. Export strips apiKey fields.

**Performance (7/10):** RecentFiles modify handler does O(n log n) sort on every keystroke. Tag cache helps but is never invalidated. ImageGallery waits for all images before measuring (correct but blocks auto-height). ResizeObserver properly throttled. GridStack batch updates used correctly.

**Maintainability (9/10):** Excellent separation of concerns via IHomepagePlugin interface. Consistent block structure (render/openSettings/scheduleRender pattern). BaseBlock provides clean shared infrastructure. Types well-defined. CLAUDE.md documents all conventions. Migration code handles legacy formats gracefully.

**Consistency (8/10):** All blocks follow the same render + settings modal pattern. Immutable layout mutations used consistently. Header rendering centralized in BaseBlock. Minor deviations in timer cleanup patterns. Error handling consistently logs + displays user-facing message.

**Resilience (7/10):** Async staleness guard (`nextGeneration/isStale`) prevents race conditions. Layout validation catches corrupt data. `savePromise` chaining prevents concurrent writes. But tag cache stale data risk is real, EmbeddedNote rename creates transient "file not found", and VoiceDictation note path collisions are possible.

---

## Top 3 Mandatory Actions

1. **Fix tag cache invalidation** (`src/utils/tags.ts`): Either call `clearTagCache()` on metadata/vault events, or remove the cache. Stale TFile references after delete/rename can cause errors in QuotesList and RandomNote.

2. **Fix EmbeddedNote stale instance after rename** (`src/blocks/EmbeddedNoteBlock.ts:31-35`): Update `this.instance` config after saving the renamed path, or read from the live layout state in `renderContent()`. Currently causes transient "File not found" flash.

3. **Clean up Pomodoro module-level state on plugin unload** (`src/blocks/PomodoroBlock.ts:25-26`): Export a cleanup function and call it from `main.ts:onunload()`. The `timerStore` Map and `sharedAudioCtx` AudioContext leak across plugin disable/enable cycles.
