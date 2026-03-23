# Phase 2: Security & Performance Review

## Security Findings

Full details in `02a-security.md`.

### Critical (1)
- **CRITICAL-001**: HtmlBlock regex sanitization bypassable via nested tags, event-handler attributes on allowed tags, `<math>` tag -- XSS leading to RCE in Electron context (`HtmlBlock.ts:25-26`)

### High (4)
- **HIGH-001**: API keys stored plaintext in data.json, incomplete export stripping (`VoiceDictationBlock.ts:24,333,377`, `main.ts:633`)
- **HIGH-002**: VoiceDictation folder path traversal -- `..` segments not sanitized (`VoiceDictationBlock.ts:179-198`)
- **HIGH-003**: VideoEmbed iframe `allow-same-origin + allow-scripts` nullifies sandbox; `updateIframe` skips origin check (`VideoEmbedBlock.ts:436,442`)
- **HIGH-004**: Pomodoro module-level state leak across plugin lifecycle (`PomodoroBlock.ts:25-26`)

### Medium (5)
- **MEDIUM-001**: Tag cache never invalidated, stale TFile references for up to 5s (`tags.ts:26-38`)
- **MEDIUM-002**: VoiceDictation accumulates stream cleanup registrations (`VoiceDictationBlock.ts:222`)
- **MEDIUM-003**: EmbeddedNote rename handler creates stale config reference (`EmbeddedNoteBlock.ts:28-38`)
- **MEDIUM-004**: Bookmark block allows `javascript:` and custom protocol URIs (`BookmarkBlock.ts:48-57`)
- **MEDIUM-005**: RandomNote renders external URLs in img.src without validation (`RandomNoteBlock.ts:135-136`)

### Low (3)
- **LOW-001**: Whisper API boundary uses `Math.random()` (`VoiceDictationBlock.ts:309`)
- **LOW-002**: Error messages expose internal vault paths (`EmbeddedNoteBlock.ts:66`, `ImageGalleryBlock.ts:222`)
- **LOW-003**: ImageGallery module-level lightbox state cross-instance risk (`ImageGalleryBlock.ts:15-18`)

**Security Score: 3/10**

---

## Performance Findings

Full details in `02b-performance.md`.

### High (1)
- Full GridStack destroy/rebuild on every state change (edit toggle, add/remove, settings save) -- full DOM teardown and re-render of all blocks

### Medium (7)
- Forced synchronous reflows in `resizeBlockToContent` -- O(N) reflows per batch (`GridLayout.ts:383-397`)
- RecentFilesBlock O(N log N) sort on every `vault.on('modify')` before debounce
- ImageGalleryBlock loads all images eagerly (up to 200), no lazy loading
- Tag cache O(N) full-vault scan on TTL expiry (`tags.ts`)
- Auto-height resize cascading: 2-3 cycles before converging
- Unnecessary `container-type` on blocks not using `@container` queries
- 471KB bundle loads all 16 block types + GridStack eagerly, no code splitting

### Low (6)
- PomodoroBlock `timerStore` never evicts entries
- VoiceDictation stream cleanup callback accumulation
- `clearTagCache()` exported but never called
- Tag cache not cleared on plugin unload
- Overlapping vault event handlers across block instances
- QuotesList re-renders on unrelated metadata changes

---

## UI Race Condition Findings

Full details in `02c-ui-races.md`.

### High (3)
- **HIGH-001**: EmbeddedNote rename handler reads stale `this.instance.config` -- shows "File not found" until next rerender (`EmbeddedNoteBlock.ts:28-37`)
- **HIGH-002**: EmbeddedNote grow mode never sets `data-auto-height-content` -- auto-height is a no-op (`EmbeddedNoteBlock.ts:46-88`)
- **HIGH-003**: VoiceDictation stream cleanup accumulates per recording session (`VoiceDictationBlock.ts:222`)

### Medium (5)
- **MEDIUM-004**: scrollIntoView after addBlock fires before GridStack layout settles (`GridLayout.ts:232-241`)
- **MEDIUM-005**: ImageGallery masonry ResizeObserver accumulates across re-renders (`ImageGalleryBlock.ts:205-207`)
- **MEDIUM-006**: QuotesList ResizeObserver accumulates across re-renders (`QuotesListBlock.ts:174-176`)
- **MEDIUM-007**: Auto-height resize cascade: block A resize triggers block B width change (`GridLayout.ts:324-365`)
- **MEDIUM-008**: StaticText inline save doesn't trigger auto-height recalculation (`StaticTextBlock.ts:82-91`)

### Low (1)
- **LOW-009**: computeFitZoom reads scrollHeight before GridStack fully settles (`EditToolbar.ts:53-57`)

---

## Distributed Flow Findings

N/A -- single-module scope.

---

## Critical Issues for Phase 3 Context

1. HtmlBlock XSS bypass (CRITICAL) -- needs security test coverage
2. EmbeddedNote rename stale config -- needs regression test
3. EmbeddedNote grow mode missing `data-auto-height-content` -- needs integration test
4. VoiceDictation stream cleanup accumulation -- needs lifecycle test
5. Full GridStack rebuild on every state change -- performance test opportunity
