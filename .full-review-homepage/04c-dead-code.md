# Dead Code Analysis -- Homepage Blocks Plugin

## Summary

Analyzed all 31 TypeScript files in `src/` plus `package.json` and `styles.css`.
Found **11 findings** across unused exports, unused CSS classes, and one unnecessary exported interface.

Overall the codebase is clean -- most exports are consumed, all block types are
registered and used, and all runtime/dev dependencies are actively referenced.

---

## Findings

### 1. Unused export: `clearTagCache()` in `tags.ts`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **File** | `src/utils/tags.ts` line 42 |
| **Category** | Unused export (function) |
| **Confidence** | 95 |

`clearTagCache()` is exported but never imported or called anywhere in the
codebase. The tag cache relies on a 5-second TTL (`TAG_CACHE_TTL`) for
invalidation instead. The function was likely intended to be called on
`metadataCache` change events but was superseded by the TTL approach.

**Recommendation:** Remove the function and its export, or wire it into
`metadataCache.on('changed')` in blocks that use tag filtering for
immediate cache invalidation.

---

### 2. Unused export: `EmojiPickerOptions` interface

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/utils/emojiPicker.ts` line 3 |
| **Category** | Unused export (interface) |
| **Confidence** | 90 |

`EmojiPickerOptions` is exported but never imported by any consumer. Only
`createEmojiPicker` and `EmojiPickerInstance` are imported by other files.
The interface is used internally as the parameter type of `createEmojiPicker`.

**Recommendation:** Remove the `export` keyword. The interface is still
accessible to callers via the function signature's type inference; the
explicit export is unnecessary.

---

### 3. Unused CSS class: `block-empty-hint-action`

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `styles.css` lines 505-520 |
| **Category** | Unused CSS class |
| **Confidence** | 95 |

The class `block-empty-hint-action` is defined in `styles.css` (including a
`:hover` variant) but is never referenced in any TypeScript file. It was
likely intended for a CTA button inside empty-state hints but was never
wired up (the homepage empty state uses `homepage-empty-cta` instead).

**Recommendation:** Remove the `.block-empty-hint-action` and
`.block-empty-hint-action:hover` rule blocks from `styles.css`.

---

### 4. Unused CSS class: `toolbar-col-auto-hint`

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `styles.css` line 2154 |
| **Category** | Unused CSS class |
| **Confidence** | 95 |

The class `toolbar-col-auto-hint` is defined in `styles.css` but never
referenced in any TypeScript file. Likely a leftover from a removed
"auto column" hint feature in the toolbar.

**Recommendation:** Remove the CSS rule.

---

### 5. CSS class `block-loading` used as placeholder text styling

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/blocks/FolderLinksBlock.ts` lines 69, 74, 92 |
| **Category** | Semantic mismatch (not dead code per se) |
| **Confidence** | 70 |

`FolderLinksBlock` uses the CSS class `block-loading` for static error/empty
messages ("Folder not found", "No notes in folder", "Vault root not
supported"). The class name implies a loading state, but these are final
rendered states. This is not dead code but a semantic naming issue.

**Recommendation:** Consider renaming to `block-placeholder-text` or using
the `block-empty-hint` pattern that other blocks use, for consistency.

---

### 6. Module-level `tagCache` Map has no size bound

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/utils/tags.ts` line 26 |
| **Category** | Unreachable cleanup path |
| **Confidence** | 75 |

The `tagCache` Map grows unboundedly -- entries expire via TTL but are
never deleted. The exported `clearTagCache()` was the intended cleanup
mechanism but is never called (see finding #1). In practice, plugin
users are unlikely to have thousands of distinct tags, so this is low risk.

**Recommendation:** Either call `clearTagCache()` periodically or delete
stale entries during lookup to prevent theoretical unbounded growth.

---

### 7. `hexChannelToLinear` and `getRelativeLuminance` are private helpers but not marked

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/utils/blockStyling.ts` lines 8-17 |
| **Category** | Non-exported internal functions (not dead) |
| **Confidence** | 50 |

These functions are module-private (not exported) and only used by
`applyBlockStyling`. This is correct and not dead code. Listed for
completeness as they could appear to be unused in a surface-level scan.

**Recommendation:** No action needed. These are correctly scoped.

---

### 8. `VALID_BORDER_STYLES` array could be a Set

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/utils/blockStyling.ts` line 20 |
| **Category** | Minor inconsistency |
| **Confidence** | 60 |

`VALID_BORDER_STYLES` is an array checked via `.includes()`. Other
validation sets in the codebase (e.g., `VALID_BLOCK_TYPES`,
`VALID_OPEN_MODES`, `IMAGE_EXTS`, `VIDEO_EXTS`) use `Set` with `.has()`.
Not dead code, but a minor style inconsistency.

**Recommendation:** Convert to `Set<string>` for consistency.

---

### 9. `isLightboxOpen()` function in ImageGalleryBlock

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `src/blocks/ImageGalleryBlock.ts` line 18 |
| **Category** | Low-usage function |
| **Confidence** | 40 |

`isLightboxOpen()` is only called in one place (line 280, hover preview
guard for video thumbnails). The function is a simple null check on
`activeLightboxAc`. It's used and not dead -- just worth noting the
narrow usage.

**Recommendation:** No action needed.

---

### 10. All 16 block types are registered and referenced

| Field | Value |
|-------|-------|
| **Severity** | N/A (no finding) |
| **File** | `src/main.ts`, `src/types.ts`, `src/EditToolbar.ts` |
| **Category** | Dead block type check |
| **Confidence** | 100 |

All 16 entries in `BLOCK_TYPES` have corresponding:
- Registration in `registerBlocks()` (`src/main.ts`)
- Entry in `BLOCK_META` (`src/EditToolbar.ts`)
- Block class file in `src/blocks/`
- Default layout entry or preset usage

No dead block types found.

---

### 11. All package.json dependencies are used

| Field | Value |
|-------|-------|
| **Severity** | N/A (no finding) |
| **File** | `package.json` |
| **Category** | Unused dependency check |
| **Confidence** | 100 |

| Dependency | Used in |
|---|---|
| `gridstack` (runtime) | `src/GridLayout.ts` |
| `@eslint/js` (dev) | `eslint.config.mjs` |
| `@types/node` (dev) | TypeScript ambient types |
| `@typescript-eslint/parser` (dev) | `eslint.config.mjs` |
| `builtin-modules` (dev) | `esbuild.config.mjs` |
| `esbuild` (dev) | `esbuild.config.mjs` |
| `eslint` (dev) | lint tooling |
| `eslint-plugin-obsidianmd` (dev) | `eslint.config.mjs` |
| `globals` (dev) | `eslint.config.mjs` |
| `obsidian` (dev) | Type definitions, imported everywhere |
| `typescript` (dev) | `tsc` type checking |
| `typescript-eslint` (dev) | `eslint.config.mjs` |

No unused dependencies.

---

## Actionable Items (sorted by priority)

| # | Severity | Action | File |
|---|----------|--------|------|
| 1 | Medium | Remove or wire up `clearTagCache()` | `src/utils/tags.ts:42` |
| 2 | Low | Remove `export` from `EmojiPickerOptions` | `src/utils/emojiPicker.ts:3` |
| 3 | Low | Remove `.block-empty-hint-action` CSS rules | `styles.css:505-520` |
| 4 | Low | Remove `.toolbar-col-auto-hint` CSS rule | `styles.css:2154` |
| 5 | Low | Rename `block-loading` to `block-placeholder-text` | `src/blocks/FolderLinksBlock.ts` + `styles.css` |
