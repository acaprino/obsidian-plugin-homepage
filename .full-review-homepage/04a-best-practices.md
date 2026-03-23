# 04a -- Best Practices Review

## Executive Summary

The Homepage Blocks plugin demonstrates strong adherence to Obsidian plugin development standards. TypeScript strict mode passes cleanly (zero `tsc` errors), ESLint with the `eslint-plugin-obsidianmd` recommended rules reports zero violations, and there are no uses of `innerHTML`, `eval`, `outerHTML`, `insertAdjacentHTML`, or `document.write` in the source. The codebase follows Obsidian conventions for Component lifecycle, DOM manipulation, and layout persistence. This section catalogs remaining areas for improvement.

---

## 1. TypeScript Idioms & Strict Mode

### 1.1 Zero `tsc` Errors -- PASS

`npx tsc --noEmit` completes with zero errors. `strict: true` is enabled in `tsconfig.json`.

### 1.2 Zero `as any` / `@ts-ignore` / `@ts-expect-error` -- PASS

No type-escape hatches found anywhere in the source.

### 1.3 Type Assertions via `as Record<string, unknown>`

The plugin uses `as Record<string, unknown>` for `instance.config` and `as { ... }` destructuring patterns throughout the blocks. This is the pragmatic choice given that `BlockInstance.config` is typed as `Record<string, unknown>`. Each block defines its own local interface (e.g., `VoiceDictationConfig`, `QuotesConfig`, `BookmarkConfig`) and casts accordingly.

**Observation**: These casts are safe because the block itself controls what it writes, and the config is validated on load. No change needed, but a discriminated-union approach (typed config per block type) could be explored in a future major refactor.

### 1.4 Modern TypeScript Features -- Well Utilized

- `structuredClone()` used throughout for deep cloning (no lodash).
- `as const` for `BLOCK_TYPES` array to derive the `BlockType` union.
- `satisfies` not used but not needed -- type assertions are minimal.
- `??` (nullish coalescing) and `?.` (optional chaining) used consistently.
- `using` (explicit resource management) not adopted -- acceptable given Obsidian's Component lifecycle pattern handles resource cleanup.
- Numeric separators (`86_400_000`) used for readability.

### 1.5 `textContent` Assignment

One instance found in `GridLayout.ts:303`:
```ts
label.textContent = `${node.w ?? 1}\u00D7${node.h ?? 1}`;
```
This is safe (plain text, no HTML injection), but for consistency with the rest of the codebase that uses Obsidian's `setText()`, it could be migrated. **Severity: Trivial**.

---

## 2. Obsidian Plugin Patterns

### 2.1 Component Lifecycle -- PASS

- `BaseBlock` extends `Component` correctly.
- All blocks use `this.registerInterval()`, `this.registerEvent()`, and `this.register()` for cleanup.
- `VoiceDictationBlock` correctly registers stream cleanup with `this.register(() => stream.getTracks().forEach(t => t.stop()))`.
- `PomodoroBlock` uses `this.registerDomEvent()` for button clicks.
- `VideoEmbedBlock` uses `this.registerDomEvent()` for iframe load events and `this.register()` for `window.removeEventListener`.

### 2.2 Vault API Usage -- PASS

- `app.vault.getMarkdownFiles()`, `app.vault.read()`, `app.vault.getAbstractFileByPath()`, `app.vault.getResourcePath()` used correctly.
- `app.metadataCache.getFileCache()`, `app.metadataCache.getFirstLinkpathDest()` used appropriately.
- `MarkdownRenderer.render()` called with proper `component` parameter (the block itself), ensuring lifecycle is linked.
- `sanitizeHTMLToDom()` used in `HtmlBlock` with additional defense-in-depth regex stripping.

### 2.3 Workspace API -- PASS

- `app.workspace.openLinkText(path, '')` used consistently with empty source path.
- `app.workspace.onLayoutReady()` used in both `main.ts` (startup) and `FolderLinksBlock` (deferred first render).
- `app.workspace.getLeavesOfType()`, `app.workspace.revealLeaf()`, `app.workspace.getLeaf()` used correctly.

### 2.4 `onunload` Override Pattern

`HomepagePlugin.onunload()` is empty with a comment "Obsidian detaches views automatically". This is correct -- the `Plugin` base class handles view detachment. `BaseBlock.onunload()` properly cleans up timers and observers.

### 2.5 Immutable Layout Mutations -- PASS

The codebase strictly follows the immutable spread pattern:
```ts
const newBlocks = this.plugin.layout.blocks.map(b =>
  b.id === id ? { ...b, ...changes } : b,
);
void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
```
No direct mutations of `BlockInstance` objects found.

### 2.6 Save Serialization -- PASS

`saveLayout()` in `HomepagePlugin` chains promises to prevent concurrent writes:
```ts
this.savePromise = this.savePromise.then(() => this.saveData(layout)).catch(() => { ... });
```
This prevents data corruption from rapid successive saves.

### 2.7 `FolderLinksBlock.renderContent` Uses `this.app.workspace.onLayoutReady()`

This block defers its first render until layout is ready, which is good practice to ensure the vault index is populated. Other blocks that access `metadataCache` or `vault.getMarkdownFiles()` do not defer (e.g., `QuotesListBlock`, `RandomNoteBlock`). In practice this is fine because by the time the user sees the homepage, the vault is indexed -- the homepage opens via `onLayoutReady` callback in `main.ts`. **No action needed**.

---

## 3. Deprecated APIs

### 3.1 No Deprecated Obsidian APIs Detected

The plugin avoids deprecated patterns:
- Does not use `app.vault.adapter` directly.
- Does not use `app.vault.on('modify')` on non-file objects.
- Uses `ItemView` (not deprecated `TextFileView` for non-file views).
- Uses `PluginSettingTab` correctly.
- Does not use `workspace.activeLeaf` (deprecated since 1.0) -- uses `workspace.getLeavesOfType()`.

### 3.2 `moment` Import

`moment` is imported from `'obsidian'` (not from a separate package), which is the correct pattern. Obsidian bundles `moment` globally.

---

## 4. Modernization Opportunities

### 4.1 `clearTagCache` Exported but Never Called

`src/utils/tags.ts` exports `clearTagCache()` but it is never imported or called anywhere. The tag cache has a 5-second TTL which provides freshness, so the function may have been intended for explicit invalidation that was never wired up. **Consider removing the dead export or wiring it into metadata change events if stale cache is a concern.**

### 4.2 Inline Type Assertions in Settings Modals

Many settings modals do `draft.someField as string ?? ''` or `draft.someField as number ?? 25`. Since `draft` is `structuredClone(this.config)` which is `Record<string, unknown>`, these casts are expected. A helper function like `getString(config, key, fallback)` / `getNumber(config, key, fallback)` could reduce boilerplate. **Severity: Nice-to-have**.

### 4.3 `Promise.resolve()` in `HomepageView`

`onOpen()` and `onClose()` return `Promise.resolve()` instead of being declared as sync. Obsidian's `ItemView` declares these as returning `Promise<void>`, so the current pattern is correct. An alternative is declaring them `async` with no `return`, but the current approach avoids creating unnecessary async state machines. **No change needed**.

---

## 5. Package Management

### 5.1 Dependencies

| Package | Version | Role | Status |
|---------|---------|------|--------|
| `gridstack` | `^12.4.2` | Runtime | Only runtime dep -- appropriate |
| `obsidian` | `^1.7.2` | Dev (externalized) | Current |
| `typescript` | `^5.7.0` | Dev | Current |
| `esbuild` | `^0.24.0` | Dev | Current |
| `eslint` | `^9.39.4` | Dev | Current (flat config) |
| `eslint-plugin-obsidianmd` | `^0.1.9` | Dev | Current |
| `typescript-eslint` | `^8.57.0` | Dev | Current |
| `@types/node` | `^22.0.0` | Dev | Current |
| `builtin-modules` | `^3.3.0` | Dev | Used by esbuild config |
| `@eslint/js` | `^9.39.4` | Dev | Current |
| `globals` | `^17.4.0` | Dev | Current |

**No unnecessary dependencies detected.** The plugin has exactly one runtime dependency (`gridstack`), which is appropriate for the grid layout engine. All other dependencies are dev-only.

### 5.2 No Lock File Observed

The project does not appear to commit a `package-lock.json`. For reproducible builds in CI, a lock file is recommended. **Severity: Low** (typical for Obsidian plugins).

---

## 6. Build Configuration

### 6.1 esbuild Config -- Well Configured

`esbuild.config.mjs` (line-by-line analysis):

- **Entry**: `src/main.ts` -- correct single entry point.
- **Bundle**: `true` -- correct, bundles all imports.
- **External**: `['obsidian', 'electron', ...builtinModules]` -- correct, Obsidian provides these at runtime.
- **Format**: `cjs` -- required by Obsidian plugin system.
- **Target**: `es2022` -- matches `tsconfig.json` target.
- **Sourcemap**: `inline` in watch mode, `false` in prod -- good (no leaked source maps).
- **Tree shaking**: `true` -- good for bundle size.
- **Drop**: `['debugger']` in prod -- correct.
- **Pure**: `['console.debug']` in prod -- strips debug logs without affecting error/warn logging.
- **Output**: `main.js` in repo root -- required by Obsidian.

**One observation**: `console.log` and `console.warn` calls are NOT stripped in production. The codebase only uses `console.error` (which should not be stripped), so this is correct behavior. No `console.log` or `console.warn` calls exist in the source.

### 6.2 tsconfig.json -- Appropriate

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "moduleResolution": "bundler",
    "noEmit": true,
    "isolatedModules": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

- `moduleResolution: "bundler"` is the modern choice for esbuild.
- `isolatedModules: true` ensures compatibility with esbuild's per-file compilation.
- `skipLibCheck: true` speeds up type checking without loss of safety for the plugin's own code.

**Potential addition**: `"noUncheckedIndexedAccess": true` would catch unguarded array/object indexing. Currently, code like `entries[0]?.contentRect.width` is manually guarded, but this compiler option would enforce it everywhere. **Severity: Nice-to-have**.

---

## 7. ESLint Configuration

### 7.1 Flat Config with obsidianmd Plugin -- PASS

```js
export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: { ...globals.browser, ...globals.node, structuredClone: "readonly" },
    },
  },
]);
```

- Uses ESLint 9 flat config format.
- `eslint-plugin-obsidianmd` recommended rules are applied.
- TypeScript parser with project reference enabled.
- `structuredClone` declared as readonly global (not in all Node.js type libs).

### 7.2 Zero ESLint Violations -- PASS

`npx eslint src/` reports zero errors and zero warnings.

---

## 8. ObsidianReviewBot Compliance

### 8.1 `innerHTML` -- PASS

No `innerHTML` usage. GridStack internally uses `innerHTML` for its own DOM, but the plugin explicitly avoids passing `content` to GridStack widgets (line 99-100 of GridLayout.ts: "GridStack sets content via innerHTML which Obsidian blocks"). Block DOM is built via Obsidian's `createEl`/`createDiv` API.

### 8.2 `eval` / `Function()` -- PASS

No `eval` or `new Function()` usage.

### 8.3 `document.write` / `outerHTML` / `insertAdjacentHTML` -- PASS

None found.

### 8.4 `sanitizeHTMLToDom` Usage -- PASS

`HtmlBlock` uses Obsidian's `sanitizeHTMLToDom()` with an additional pre-filter regex that strips dangerous tags (`iframe`, `object`, `embed`, `form`, `meta`, `link`, `base`, `script`, `style`, `svg`).

### 8.5 `window.open` Security

Three `window.open` calls found:
- **BookmarkBlock:52** -- `window.open(item.url, '_blank', 'noopener,noreferrer')` -- PASS (has security options).
- **VideoEmbedBlock:175** -- `window.open(..., '_blank')` -- **Missing `noopener,noreferrer`**.
- **VideoEmbedBlock:403** -- `window.open(..., '_blank')` -- **Missing `noopener,noreferrer`**.

The VideoEmbed calls open hardcoded YouTube URLs (`YT_ORIGIN/watch?v=...`), so the risk is minimal, but ObsidianReviewBot may flag the missing `noopener,noreferrer` options. **Recommendation: Add `'noopener,noreferrer'` as the third argument to both calls.**

### 8.6 External Network Requests

- `VoiceDictationBlock` makes requests to `api.openai.com` and `generativelanguage.googleapis.com` via Obsidian's `requestUrl()` -- correct usage of Obsidian's network API.
- `VideoEmbedBlock` embeds iframes from YouTube, Vimeo, and Dailymotion with origin allowlisting.

The ReviewBot generally accepts external requests as long as they are transparent to the user. The Voice Dictation block shows a Notice when no API key is configured, and the API key storage warning is in the settings modal description. **PASS**.

### 8.7 `navigator` API Usage

- `navigator.clipboard.writeText()` / `readText()` for export/import -- acceptable.
- `navigator.mediaDevices.getUserMedia()` for voice recording -- acceptable.

### 8.8 `manifest.json` Compliance

```json
{
  "id": "homepage-blocks",
  "name": "Homepage Blocks",
  "version": "1.1.2",
  "minAppVersion": "1.5.0",
  "description": "A composable, drag-and-drop homepage...",
  "author": "Alfio Caprino",
  "authorUrl": "https://github.com/acaprino",
  "isDesktopOnly": false
}
```

- `isDesktopOnly: false` -- the plugin should work on mobile. The `VoiceDictationBlock` checks for `MediaRecorder` availability and degrades gracefully. **PASS**.
- Version matches `package.json`. **PASS**.
- `versions.json` present with correct mapping. **PASS**.

### 8.9 Iframe Sandbox

`VideoEmbedBlock` creates iframes with:
```
sandbox: 'allow-same-origin allow-scripts allow-popups allow-presentation'
```

The `allow-same-origin + allow-scripts` combination effectively nullifies the sandbox for the embedded origin. This is documented as required by the YouTube IFrame API (see comment on line 407-410 of VideoEmbedBlock.ts). An origin allowlist (`ALLOWED_EMBED_HOSTS`) gates which URLs can be loaded. **ObsidianReviewBot may flag this -- the code comments explain the rationale**.

---

## 9. Findings Summary

### Must Fix (for community submission)

| # | File | Finding | Severity |
|---|------|---------|----------|
| 1 | `VideoEmbedBlock.ts:175,403` | `window.open()` missing `noopener,noreferrer` | Medium |

### Should Fix

| # | File | Finding | Severity |
|---|------|---------|----------|
| 2 | `tags.ts` | `clearTagCache()` exported but never called -- dead code | Low |
| 3 | `GridLayout.ts:303` | `label.textContent = ...` instead of `setText()` | Trivial |

### Nice-to-Have

| # | Finding | Severity |
|---|---------|----------|
| 4 | Add `noUncheckedIndexedAccess: true` to tsconfig for stricter array indexing | Nice-to-have |
| 5 | Extract typed config accessor helpers to reduce boilerplate `as` casts in settings modals | Nice-to-have |
| 6 | Commit a `package-lock.json` for reproducible builds | Nice-to-have |

---

## 10. Overall Assessment

| Category | Grade |
|----------|-------|
| TypeScript strict mode compliance | A |
| Obsidian API usage | A |
| No deprecated APIs | A |
| Build configuration | A |
| ESLint compliance | A |
| ObsidianReviewBot readiness | A- (one `window.open` fix needed) |
| Code modernization | A- |
| Package management | A |

The codebase is well-structured, type-safe, and follows Obsidian plugin conventions consistently. The single actionable finding for community submission is adding `noopener,noreferrer` to two `window.open` calls in `VideoEmbedBlock.ts`.
