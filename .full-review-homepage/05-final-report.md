# Comprehensive Code Review Report

## Review Target

Full Obsidian plugin codebase -- Homepage Blocks plugin. 31 TypeScript source files, 1 CSS file. Composable drag-and-drop homepage using GridStack for layout, 16 block types, responsive grid, edit mode, auto-height, lightbox, voice dictation.

## Executive Summary

Homepage Blocks is a well-structured, strictly-typed codebase with strong architectural patterns (immutable layout mutations, Component lifecycle management, staleness guards for async renders). The main concerns are: (1) a critical XSS bypass in HtmlBlock's regex sanitization that could lead to RCE in Obsidian's Electron context, (2) zero automated test coverage, and (3) several resource lifecycle bugs (stream cleanup accumulation, module-level state leaks, stale config references) that degrade reliability over long sessions.

## Code Quality Score

| Category        | Score |
|-----------------|-------|
| Security        | 3/10  |
| Performance     | 7/10  |
| Maintainability | 8/10  |
| Consistency     | 9/10  |
| Resilience      | 6/10  |
| Testing         | 1/10  |
| **Overall**     | **5.5/10** |

---

## Findings by Priority

### Critical Issues (P0 -- Must Fix Immediately)

| # | Finding | Source | File |
|---|---------|--------|------|
| 1 | **HtmlBlock XSS bypass**: Single-pass regex sanitization bypassable via nested tags (`<scr<script>ipt>`), event-handler attributes on allowed tags (`<img onerror>`), `<math>` tag. Leads to RCE in Electron. | Security | `HtmlBlock.ts:25-26` |
| 2 | **Zero automated tests**: No test framework, files, scripts, or CI. All quality relies on tsc + eslint. | Testing | Project-wide |
| 3 | **No CI/CD pipeline**: No automated checks on push/PR. | DevOps | Project-wide |

### High Priority (P1 -- Fix Before Next Release)

| # | Finding | Source | File |
|---|---------|--------|------|
| 4 | API keys stored plaintext in data.json, incomplete export stripping | Security | `VoiceDictationBlock.ts`, `main.ts:633` |
| 5 | VoiceDictation folder path traversal (`..` not sanitized) | Security | `VoiceDictationBlock.ts:179-198` |
| 6 | VideoEmbed iframe sandbox nullified by `allow-same-origin + allow-scripts`; `updateIframe` skips origin check | Security | `VideoEmbedBlock.ts:436,442` |
| 7 | Pomodoro module-level state (timerStore, AudioContext) leaks across plugin lifecycle | Security/Perf | `PomodoroBlock.ts:25-26` |
| 8 | EmbeddedNote rename handler reads stale `this.instance.config` -- "File not found" flash | UI Race | `EmbeddedNoteBlock.ts:28-37` |
| 9 | EmbeddedNote grow mode never sets `data-auto-height-content` -- auto-height is a no-op | UI Race | `EmbeddedNoteBlock.ts:46-88` |
| 10 | VoiceDictation stream cleanup accumulates per recording session (memory leak) | UI Race | `VoiceDictationBlock.ts:222` |
| 11 | Full GridStack destroy/rebuild on every state change | Performance | `GridLayout.ts` |
| 12 | Layout validation/migration functions handle untrusted data with zero test coverage | Testing | `main.ts` |
| 13 | API key plaintext storage has no user-facing warning in README | Documentation | `README.md` |

### Medium Priority (P2 -- Plan for Next Sprint)

| # | Finding | Source | File |
|---|---------|--------|------|
| 14 | Tag cache never invalidated; `clearTagCache()` exists but never called | Code Audit | `tags.ts:26-38` |
| 15 | Bookmark block allows `javascript:` and custom protocol URIs | Security | `BookmarkBlock.ts:48-57` |
| 16 | RandomNote renders external URLs in img.src without validation | Security | `RandomNoteBlock.ts:135-136` |
| 17 | Forced synchronous reflows in `resizeBlockToContent` -- O(N) per batch | Performance | `GridLayout.ts:383-397` |
| 18 | RecentFilesBlock O(N log N) sort on every `vault.on('modify')` | Performance | `RecentFilesBlock.ts` |
| 19 | ImageGalleryBlock loads all images eagerly (up to 200) | Performance | `ImageGalleryBlock.ts` |
| 20 | ImageGallery + QuotesList masonry ResizeObserver accumulates across re-renders | UI Race | `ImageGalleryBlock.ts:205`, `QuotesListBlock.ts:174` |
| 21 | StaticText inline save doesn't trigger auto-height recalculation | UI Race | `StaticTextBlock.ts:82-91` |
| 22 | Auto-height resize cascade: 2-3 cycles before converging | UI Race | `GridLayout.ts:324-365` |
| 23 | `window.open()` in VideoEmbedBlock missing `noopener,noreferrer` -- blocks community plugin submission | Best Practices | `VideoEmbedBlock.ts:175,403` |
| 24 | README says 15 block types, actual is 16 (voice-dictation missing) | Documentation | `README.md` |
| 25 | CLAUDE.md omits 11 shared styling config keys | Documentation | `CLAUDE.md` |
| 26 | Responsive grid system undocumented | Documentation | `CLAUDE.md` |
| 27 | No per-block config schema interfaces | Documentation | `src/blocks/*` |
| 28 | 471KB bundle, no code splitting -- all 16 blocks + GridStack loaded eagerly | Performance | `esbuild.config.mjs` |

### Low Priority (P3 -- Track in Backlog)

| # | Finding | Source | File |
|---|---------|--------|------|
| 29 | Whisper API boundary uses `Math.random()` | Security | `VoiceDictationBlock.ts:309` |
| 30 | Error messages expose internal vault paths | Security | `EmbeddedNoteBlock.ts:66` |
| 31 | scrollIntoView after addBlock fires before GridStack settles | UI Race | `GridLayout.ts:232-241` |
| 32 | computeFitZoom reads scrollHeight before full settle | UI Race | `EditToolbar.ts:53-57` |
| 33 | `.block-empty-hint-action` and `.toolbar-col-auto-hint` CSS classes never referenced | Dead Code | `styles.css` |
| 34 | `EmojiPickerOptions` exported but only used internally | Dead Code | `emojiPicker.ts` |
| 35 | No lint script in package.json | Best Practices | `package.json` |
| 36 | No changelog | Documentation | Project-wide |
| 37 | Collapse/expand system undocumented | Documentation | `CLAUDE.md` |

---

## Findings by Category

| Category | Total | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Security | 10 | 1 | 4 | 2 | 3 |
| Performance | 6 | 0 | 1 | 4 | 1 |
| UI Race Conditions | 9 | 0 | 3 | 5 | 1 |
| Testing | 3 | 1 | 1 | 0 | 1 |
| Documentation | 8 | 0 | 1 | 4 | 3 |
| Best Practices | 2 | 0 | 0 | 1 | 1 |
| Dead Code | 3 | 0 | 0 | 1 | 2 |
| Code Quality | 2 | 0 | 0 | 1 | 1 |
| CI/CD & DevOps | 1 | 1 | 0 | 0 | 0 |
| **Total** | **44** | **3** | **10** | **18** | **13** |

---

## Recommended Action Plan

### Immediate (P0)

1. **Fix HtmlBlock sanitization** -- Replace single-pass regex with DOM-based post-sanitization walker that strips all `on*` event attributes and dangerous tags from `sanitizeHTMLToDom` output. [Small effort]

2. **Add test infrastructure** -- Install Vitest + jsdom. Write P0 tests for layout validation (~25 tests) and HTML sanitization (~15 tests). [Medium effort]

3. **Add basic CI** -- GitHub Actions workflow: `tsc --noEmit` + `eslint` + `vitest`. [Small effort]

### Before Next Release (P1)

4. **Validate VoiceDictation folder path** -- Reject `..` segments. [Small effort]
5. **Add origin check to `VideoEmbedBlock.updateIframe`** -- Same `ALLOWED_EMBED_HOSTS` check as `createIframe`. [Small effort]
6. **Fix EmbeddedNote rename stale config** -- Update `this.instance` after `saveLayout()`. [Small effort]
7. **Add `data-auto-height-content` to EmbeddedNote grow mode** -- Set attribute on content div. [Small effort]
8. **Fix VoiceDictation stream cleanup** -- Remove per-call `this.register()` at line 222. [Small effort]
9. **Clean up Pomodoro module state** -- Export `cleanupPomodoroState()`, call from `onunload()`. [Small effort]
10. **Fix `window.open` calls** -- Add `noopener,noreferrer` to VideoEmbedBlock. [Small effort]

### Next Sprint (P2)

11. **Wire `clearTagCache()`** to vault event handlers or remove dead code. [Small effort]
12. **Block dangerous protocols in BookmarkBlock** -- Reject `javascript:`, `data:`, etc. [Small effort]
13. **Add lazy loading to ImageGallery** -- `loading="lazy"` on images beyond viewport. [Small effort]
14. **Store ResizeObservers at block level** -- Disconnect on re-render instead of accumulating via `register()`. [Medium effort]
15. **Add `requestAutoHeight()` after StaticText inline save**. [Small effort]
16. **Update README** -- Fix block count, add voice-dictation, add API key warning. [Small effort]
17. **Update CLAUDE.md** -- Add missing styling keys, responsive grid docs, collapse system. [Medium effort]

---

## Review Metadata

- Review date: 2026-03-22
- Phases completed: 1 (Code Audit), 2 (Security + Performance + UI Races), 3 (Testing + Documentation), 4 (Best Practices + Dead Code), 5 (Final Report)
- Flags applied: none
- Framework: Obsidian plugin (TypeScript, GridStack)
- Agents used: code-auditor, security-auditor, ui-race-auditor, 5x general-purpose
