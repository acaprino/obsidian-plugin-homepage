# Design & CSS Review — 2026-03-05

Full frontend audit · 10 block components · 1 stylesheet (456 lines) · Desktop-only Obsidian plugin

---

## Scores

| Category | Score |
|---|---|
| UX Consistency | 6.5/10 |
| Accessibility | 2.5/10 |
| Component Design | 6.0/10 |
| Layout System | 6.0/10 |
| Typography | 4.0/10 |
| Spacing | 5.0/10 |
| CSS Architecture | 7.5/10 |
| Visual Polish | 6.5/10 |
| Animations | 5.5/10 |
| **Overall** | **5.5/10** |

**Critical: 1 | High: 7 | Medium: 19 | Low: 18**

---

## Files Audited

- `src/HomepageView.ts` · `src/GridLayout.ts` · `src/EditToolbar.ts`
- `src/blocks/BaseBlock.ts` · `src/blocks/GreetingBlock.ts` · `src/blocks/ClockBlock.ts`
- `src/blocks/InsightBlock.ts` · `src/blocks/TagGridBlock.ts` · `src/blocks/QuotesListBlock.ts`
- `src/blocks/ImageGalleryBlock.ts` · `src/blocks/FolderLinksBlock.ts` · `src/blocks/EmbeddedNoteBlock.ts`
- `src/blocks/StaticTextBlock.ts` · `src/blocks/HtmlBlock.ts`
- `src/types.ts` · `src/BlockRegistry.ts` · `src/utils/tags.ts` · `src/main.ts`
- `styles.css`

---

## Critical Issues

### Security

#### `HtmlBlock.ts:25` — Raw innerHTML with no sanitization
- **Severity**: Critical
- **Issue**: `contentEl.innerHTML = html` injects arbitrary user HTML. Synced or shared vault configs can contain `<script>` tags, event handlers (`onload`, `onerror`), or `<iframe>` elements — a real XSS vector in collaborative vault setups. The codebase is security-aware elsewhere (`COLOR_RE` regex in QuotesListBlock) but this block bypasses all sanitization.
- **Fix**: Use Obsidian's `sanitizeHTMLToDom` API (available in Obsidian ≥1.1), or run the HTML through a DOM-based allowlist that strips `<script>`, event handler attributes, and `<iframe>`. If truly raw HTML is needed, add an in-modal warning to the user.
- [ ] Fixed

---

## High Issues

### UX & User Flow

#### `GridLayout.ts:88-94` — Block removal is irreversible with no safeguard
- **Severity**: High
- **Issue**: Clicking "×" immediately and permanently removes a block including all its configuration. No confirmation, no undo, no notice. A FolderLinksBlock with 20 manually configured links is destroyed on a single click.
- **Fix**: Add an undo mechanism via `new Notice('Block removed. Click to undo', 5000)` with a timed callback that re-inserts the block — or show a confirmation modal before removal.
- [ ] Fixed

#### `GridLayout.ts:104-201` — Drag/resize is mouse-only, no keyboard support
- **Severity**: High
- **Issue**: Drag handler uses `mousedown/mousemove/mouseup` exclusively. Resize handler is also mouse-only. No keyboard-based block reordering or resizing exists. Violates WCAG 2.1 SC 2.1.1 (Keyboard) Level A.
- **Fix**: Add keyboard handlers on the move handle — `Enter`/`Space` activates move mode, arrow keys change position, `Escape` cancels. Add `tabindex="0"` and `role="button"`. Similar arrow-key increments for the resize grip.
- [ ] Fixed

### Accessibility

#### Multiple files — No ARIA roles, labels, or landmarks
- **Severity**: High
- **Issue**: The entire grid, toolbar, block wrappers, handle buttons, and the column `<select>` have zero ARIA attributes. Drag handles use Braille/unicode characters as their only text content. Fails WCAG SC 1.3.1 and SC 4.1.2.
- **Fix**: `role="toolbar" aria-label="Homepage controls"` on `.homepage-toolbar`. `aria-label="Column count"` on the `<select>`. `role="region" aria-label={block title}` on each block wrapper. `aria-label="Move block"`, `aria-label="Block settings"`, `aria-label="Remove block"` on handle buttons. Use `setIcon()` from the Obsidian API instead of raw unicode characters.
- [ ] Fixed

#### `GridLayout.ts:247` — Focus destroyed on every rerender
- **Severity**: High
- **Issue**: Every `rerender()` call destroys all DOM and rebuilds it. Focus is lost after toggling edit mode, adding a block, removing a block, dragging, or resizing. Keyboard and screen reader users are thrown to the start of the page after every edit action.
- **Fix**: Record `document.activeElement` and its ancestor `data-block-id` before `rerender()`. After rebuild, find the matching wrapper via `data-block-id` and restore focus to the appropriate child element.
- [ ] Fixed

### Component Design

#### `GridLayout.ts:247-249` — Full DOM teardown on every state change
- **Severity**: High
- **Issue**: `rerender()` unloads all blocks and re-creates everything from scratch. Every timer-based block (ClockBlock, GreetingBlock) loses its interval; every async block re-fetches vault data. This fires on column change, edit toggle, add, remove, swap, and resize.
- **Fix**: Implement targeted updates. For position/span changes, only update `style.gridColumn`/`style.gridRow` on affected wrappers. For edit mode toggle, add/remove handles without destroying content. Only do full re-render when the block list actually changes.
- [ ] Fixed

### Layout System

#### `styles.css` — No max-width constraint on the grid
- **Severity**: High
- **Issue**: `.homepage-grid` has no `max-width`. On a 1920px ultrawide Obsidian window, a 3-column grid produces ~620px per card — well beyond comfortable reading measure.
- **Fix**: Add `max-width: 1400px; margin-inline: auto;` to `.homepage-grid`.
- [ ] Fixed

#### `styles.css` / `GridLayout.ts` — Zero responsive/container-aware behavior
- **Severity**: High
- **Issue**: No `@media` or `@container` queries exist. The grid uses bare `repeat(N, 1fr)` with no minimum column width. A user can drag the Obsidian pane to 400px while keeping "4 columns" selected, producing four ~85px columns where nothing fits.
- **Fix**: Use `repeat(N, minmax(180px, 1fr))` as a guard, and add container queries: `@container (max-width: 600px) { .homepage-grid { grid-template-columns: 1fr !important; } }`. Add `container-type: inline-size` to `.homepage-view`.
- [ ] Fixed

---

## Medium Issues

### UX & Components

#### All async blocks — No loading state while vault data is read
- **Severity**: Medium
- **Issue**: InsightBlock, TagGridBlock, QuotesListBlock, ImageGalleryBlock, EmbeddedNoteBlock, StaticTextBlock all show empty cards while their async operations complete. QuotesListBlock reads up to 20 files in parallel — the blank period is noticeable.
- **Fix**: Before the async call, set `el.setText('Loading...')` or insert a skeleton CSS class. Remove it at the start of the render path (several blocks already call `el.empty()`).
- [ ] Fixed

#### All settings modals — Config mutated in-place before Save is clicked
- **Severity**: Medium
- **Issue**: Every settings modal mutates `this.config` on each keystroke via `.onChange()`. If the user presses Escape or closes the modal without clicking Save, the in-memory config is already changed even though `onSave` was never called.
- **Fix**: Clone config at `onOpen()`: `const draft = structuredClone(this.config)`. Bind all `.onChange()` handlers to `draft`. Only write `draft` back to `this.config` inside the Save handler.
- [ ] Fixed

#### `EditToolbar.ts:94-120` — AddBlockModal is a flat list with no descriptions
- **Severity**: Medium
- **Issue**: 10 unlabeled block type buttons with no descriptions, icons, categories, or previews. Users new to the plugin cannot tell what "Daily Insight" or "Tag Grid" will produce.
- **Fix**: Add `description: string`, `icon: string`, and `category: string` to the `BlockFactory` interface. Render modal options as cards with icon + name + one-line description. Group by category.
- [ ] Fixed

### Accessibility

#### `ImageGalleryBlock.ts:47-53` — Gallery images have no alt text
- **Severity**: Medium
- **Issue**: `wrapper.createEl('img')` produces `<img>` with no `alt` attribute. Fails WCAG SC 1.1.1. Gallery items are also clickable `<div>` elements, not keyboard-focusable.
- **Fix**: Set `img.alt = file.basename`. Add `tabindex="0"`, `role="button"`, and `aria-label=\`Open ${file.basename}\`` to gallery item wrappers. Add `keydown` handler for Enter/Space.
- [ ] Fixed

#### `GridLayout.ts:72,74,88,97` — Unicode character handles have no accessible names
- **Severity**: Medium
- **Issue**: Move handle (⠿), settings (⚙), remove (×), and resize grip (⊿) are bare unicode characters. Screen readers announce them literally ("braille pattern dots", etc.).
- **Fix**: Use `setIcon(handle, 'grip-vertical')`, `setIcon(settingsBtn, 'settings')`, `setIcon(removeBtn, 'x')`, `setIcon(grip, 'maximize-2')`. Add `aria-label` to each.
- [ ] Fixed

### Visual Design / CSS

#### `styles.css:21` — Card shadow invisible in dark mode
- **Severity**: Medium
- **Issue**: `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` is near-invisible on dark backgrounds. Cards appear flat in dark themes.
- **Fix**: Add a theme-dark variant: `.theme-dark .homepage-block-wrapper { box-shadow: 0 1px 6px rgba(0,0,0,0.25); }` or use Obsidian's `var(--shadow-s)` if available.
- [ ] Fixed

#### `styles.css:331-334` — `!important` on `.toolbar-btn-active`
- **Severity**: Medium
- **Issue**: Three `!important` declarations force background, color, and border-color, preventing theme overrides. `.block-drag-clone` and `.block-drop-target` also use `!important`.
- **Fix**: Replace `.toolbar-btn-active` with compound `.toolbar-edit-btn.toolbar-btn-active`. Use `.homepage-grid .block-drag-clone` and `.homepage-grid .homepage-block-wrapper.block-drop-target` for the other two.
- [ ] Fixed

#### `styles.css:332` — Hardcoded `#fff` on active toolbar button
- **Severity**: Medium
- **Issue**: `.toolbar-btn-active { color: #fff !important }` assumes the accent color is always dark enough for white text. A light yellow accent theme will fail contrast.
- **Fix**: Replace with `color: var(--text-on-accent, #fff)` — Obsidian provides this variable in modern themes.
- [ ] Fixed

#### `styles.css` — No `prefers-reduced-motion` support
- **Severity**: Medium
- **Issue**: All transitions and the gallery hover scale play regardless of the user's reduced-motion preference.
- **Fix**: Add at the end of `styles.css`: `@media (prefers-reduced-motion: reduce) { .homepage-view, .homepage-view * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }`
- [ ] Fixed

### Layout / Typography

#### `styles.css` — All font sizes are hardcoded `px`
- **Severity**: Medium
- **Issue**: 14px body text inside homepage blocks clashes with a user's vault-wide 18px base font setting. No font size adapts to Obsidian's base font preference.
- **Fix**: Convert to `rem` units. E.g., 14px → `0.875rem`, 11px → `0.6875rem`, 26px → `1.625rem`, 32px → `2rem`. This inherits the user's base size.
- [ ] Fixed

#### `styles.css` — Typography scale has 6 sizes within 5px of each other
- **Severity**: Medium
- **Issue**: Sizes 11, 12, 13, 14, 15, 16px are perceptually indistinguishable. `.insight-title` at 15px is only 1px larger than body text — zero hierarchy contrast.
- **Fix**: Consolidate to 4 tiers: label `0.6875rem` (11px), body `0.875rem` (14px), subheading `1.125rem` (18px), heading `1.5rem` (24px), display `2rem` (32px). Assign insight-title to the subheading tier.
- [ ] Fixed

#### `GridLayout.ts` — colSpan not clamped when column count decreases
- **Severity**: Medium
- **Issue**: Switching from 4 to 2 columns leaves existing blocks with `colSpan: 3` or `4` intact. Their `gridColumn` overflows the grid. The default gallery block (`colSpan: 3`) breaks on a 2-column layout.
- **Fix**: In `setColumns()`, clamp all blocks: `colSpan = Math.min(b.colSpan, newCols)`, `col = Math.min(b.col, newCols)`. Apply the same normalization in `render()`.
- [ ] Fixed

#### `styles.css` — Toolbar absolute-positioned, overlaps block content
- **Severity**: Medium
- **Issue**: `.homepage-toolbar { position: absolute; top: 12px; right: 20px }` floats over the grid. In narrow Obsidian panes or when the "Add Block" button appears, it can cover the top-right block.
- **Fix**: Convert to a sticky toolbar row above the grid. Set `.homepage-view` to `display: flex; flex-direction: column`. Place toolbar before grid (non-scrolling), grid after (scrollable with `overflow-y: auto`).
- [ ] Fixed

#### `styles.css` — Gallery images have no `aspect-ratio` (layout shift)
- **Severity**: Medium
- **Issue**: `width: 100%` with no height reservation causes CLS as images load and push content down.
- **Fix**: Add `aspect-ratio: 1; object-fit: cover;` to `.gallery-item img`. Use `aspect-ratio: 3/2` for a landscape feel.
- [ ] Fixed

#### `styles.css` — Edit-mode border causes layout shift
- **Severity**: Medium
- **Issue**: `border: 2px dashed` added in edit mode pushes cards inward by 4px per axis (assuming `box-sizing: border-box`). Entering/leaving edit mode shifts all card content.
- **Fix**: Add a permanent 2px transparent border to `.homepage-block-wrapper { border: 2px solid transparent; }` and only change the color in edit mode. Or use `outline` which does not affect layout.
- [ ] Fixed

#### `styles.css` — `z-index: 9999` on drag clone
- **Severity**: Medium
- **Issue**: Brute-force z-index may conflict with Obsidian's own modal/command-palette overlays (which use values in the hundreds).
- **Fix**: Set `.block-drag-clone { z-index: 100; }`. 100 is above all homepage elements but below Obsidian's system UI.
- [ ] Fixed

### UX & Data Integrity

#### `GridLayout.ts` — No empty state when all blocks are removed
- **Severity**: Medium
- **Issue**: Removing all blocks leaves a blank page with only a floating toolbar. No guidance or CTA is shown.
- **Fix**: In `render()`, after the loop, when `blocks.length === 0` render a centered empty state: icon + message "Your homepage is empty" + "Add your first block" button that enters edit mode and opens AddBlockModal.
- [ ] Fixed

#### `main.ts` — Reset layout button has no confirmation
- **Severity**: Medium
- **Issue**: Despite `.setWarning()` styling and "Cannot be undone" description, clicking the reset button immediately destroys all block configurations. No confirmation modal.
- **Fix**: Wrap the reset handler in a confirmation modal: "Are you sure? All blocks and configurations will be replaced with defaults."
- [ ] Fixed

#### `ImageGalleryBlock.ts:65-66` — Video hover-play ignores reduced-motion preference
- **Severity**: Medium
- **Issue**: Videos auto-play on mouse hover with no `prefers-reduced-motion` check. Motion-sensitive users cannot prevent playback triggered by mouse movement.
- **Fix**: Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before attaching the `mouseenter` play handler. Fall back to click-to-play.
- [ ] Fixed

---

## Low Issues

### Component Design

#### All 8 settings modals — Duplicated modal boilerplate
- **Severity**: Low
- **Issue**: ~30 lines of identical scaffolding per modal (constructor, onOpen skeleton, Save button, onClose). ~240 lines of boilerplate across the codebase.
- **Fix**: Create `BlockSettingsModal` base class handling constructor, Save/Cancel buttons, and config-clone pattern. Subclasses implement only `buildSettings(contentEl, draft)`.
- [ ] Fixed

#### `types.ts` — BlockFactory missing description/icon/category
- **Severity**: Low
- **Issue**: No `description`, `icon`, or `category` fields on `BlockFactory`. AddBlockModal cannot show richer metadata; handles cannot display block-type icons.
- **Fix**: Add `description?: string`, `icon?: string` (Obsidian icon name), `category?: 'content' | 'data' | 'display' | 'media'` to the `BlockFactory` interface.
- [ ] Fixed

#### `EmbeddedNoteBlock.ts` — Manual `window.setTimeout` instead of Component lifecycle
- **Severity**: Low
- **Issue**: Debounce timer uses manual `window.setTimeout` with cleanup in `onunload()`. The Component lifecycle's `registerInterval` is designed for exactly this pattern.
- **Fix**: Low risk since `onunload()` does clean up correctly, but consider wrapping the debounce logic more explicitly or documenting why `registerInterval` isn't used here.
- [ ] Fixed

### CSS Architecture

#### `styles.css` — Flat class names risk collision with other Obsidian plugins
- **Severity**: Low
- **Issue**: Classes like `.clock-time`, `.tag-btn`, `.quote-content` are generic and may collide with other plugins or theme snippets.
- **Fix**: Prefix all classes with `hp-` (e.g., `.hp-clock-time`, `.hp-tag-btn`) or scope with CSS nesting under `.homepage-view { ... }`.
- [ ] Fixed

#### `styles.css` — Redundant `color: var(--text-normal)` in hover rules
- **Severity**: Low
- **Issue**: 4 hover rules repeat the same color as their base rule — a defensive pattern that could be consolidated.
- **Fix**: Consolidate into `.homepage-view button:hover { color: var(--text-normal); }`.
- [ ] Fixed

#### `styles.css` — `box-shadow: none` repeated on 6 button selectors
- **Severity**: Low
- **Fix**: Consolidate into `.homepage-view button { box-shadow: none; }`.
- [ ] Fixed

#### `styles.css` — `.gallery-item-video` redundant `position: relative`
- **Severity**: Low
- **Issue**: `.gallery-item` already sets `position: relative`; `.gallery-item-video` (which shares the same element) sets it again.
- **Fix**: Remove `position: relative` from `.gallery-item-video`.
- [ ] Fixed

### Visual Polish

#### `styles.css` — 4 border-radius tiers with no semantic system
- **Severity**: Low
- **Issue**: 4/6/8/10px radii used across similar interactive elements with no naming system. `.tag-btn` (8px) and `.folder-link-btn` (6px) serve similar roles but differ.
- **Fix**: Define `--hp-radius-sm: 4px; --hp-radius-md: 8px; --hp-radius-lg: 12px;`. Map: small action buttons → `--hp-radius-sm`, cards/inputs/buttons → `--hp-radius-md`, block wrappers → `--hp-radius-lg`.
- [ ] Fixed

#### `styles.css` — Inconsistent use of `--color-accent` vs `--interactive-accent`
- **Severity**: Low
- **Issue**: Both accent variables are used for highlight purposes (edit border uses `--color-accent`, drop-target uses `--interactive-accent`). They resolve to the same value in most themes but differ in some.
- **Fix**: Pick one consistently — prefer `--color-accent` for visual decoration and `--interactive-accent` for interactive state highlights.
- [ ] Fixed

#### `styles.css` — No explicit easing functions on transitions
- **Severity**: Low
- **Issue**: All transitions use the implicit `ease` default. No intentional timing curves.
- **Fix**: Add `ease-out` to hover-enter transitions (background, opacity, transform) for a snappier feel.
- [ ] Fixed

#### `styles.css` — `.block-dragging` opacity has no transition
- **Severity**: Low
- **Issue**: Source block snaps to `opacity: 0.4` instantly when drag begins.
- **Fix**: Add `transition: opacity 0.12s ease-out;` to `.homepage-block-wrapper` base rule so the drag-fade is smooth.
- [ ] Fixed

#### `styles.css` — `.block-resize-grip` opacity change has no transition
- **Severity**: Low
- **Issue**: Hover opacity snaps from `0.5` to `1.0` with no transition.
- **Fix**: Add `transition: opacity 0.15s ease-out;` to `.block-resize-grip`.
- [ ] Fixed

#### `styles.css` — `.block-move-handle` has no hover visual feedback
- **Severity**: Low
- **Issue**: The move handle only changes cursor on hover. No color or background change to indicate interactivity.
- **Fix**: Add `.block-move-handle:hover { color: var(--text-normal); background: var(--background-modifier-hover); border-radius: 4px; transition: background 0.12s; }`.
- [ ] Fixed

#### `styles.css` — No `focus-visible` styles on any interactive element
- **Severity**: Low
- **Issue**: Keyboard users have no visual focus indicator on any button, select, or textarea in the plugin.
- **Fix**: Add `.homepage-view button:focus-visible, .homepage-view select:focus-visible, .homepage-view textarea:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.
- [ ] Fixed

#### `styles.css` — Spacing scale has 10 distinct values, not 8-point aligned
- **Severity**: Low
- **Issue**: Values 5, 6, 10, 14, 20px are off a clean 4/8/12/16/24 scale.
- **Fix**: Define `--space-1: 4px` through `--space-6: 24px`. Replace 5px → 4px, 6px → 8px, 10px → 8px or 12px, 14px → 16px, 20px → 24px.
- [ ] Fixed

#### `styles.css` — `line-height` only set on 4 of the ~15 text elements
- **Severity**: Low
- **Issue**: Inconsistent vertical rhythm between blocks.
- **Fix**: Set a default on the grid container: `.homepage-grid { line-height: 1.5; }`. Override only where needed (e.g., clock-time at 1.1).
- [ ] Fixed

#### `styles.css` — `.quotes-columns` has no max-height
- **Severity**: Low
- **Issue**: A QuotesListBlock with maxItems: 20 can render an extremely tall card dominating the grid.
- **Fix**: Add `max-height: 500px; overflow-y: auto;` to `.quotes-columns`.
- [ ] Fixed

---

## What's Working Well

- **Consistent async error handling** — every async block wraps its render in `.catch()` with user-facing error text and `console.error`. Thorough coverage.
- **Excellent Obsidian CSS variable usage** — only 3 hardcoded color values in 456 lines of CSS. Theme compatibility is strong.
- **Robust layout validation** — `validateLayout()` + `isValidBlockInstance()` type guards prevent corrupt saved data from breaking the view.
- **AbortController for drag/resize** — modern, clean pattern that prevents event listener leaks and correctly handles rapid re-interactions.
- **Immutable layout updates** — `blocks.map()` throughout; `onLayoutChange` callback; no in-place mutation of the layout tree.
- **Proper Component lifecycle** — `registerInterval()` and `registerEvent()` used throughout; blocks auto-clean on unload.
- **CSS color injection prevention** — `COLOR_RE` regex in QuotesListBlock validates frontmatter color values before applying inline styles.
- **FolderSuggestModal** — `SuggestModal<TFolder>` with recursive vault traversal is a polished UX touch for folder selection.
- **GPU-friendly animations** — all animated CSS properties are `transform` and `opacity`. No layout-triggering animations anywhere.
- **`font-variant-numeric: tabular-nums`** on clock-time prevents digit-width jitter on every tick — a subtle but sharp detail.
- **`box-shadow: none` resets** — correctly overrides Obsidian's default button shadows across all interactive elements.
- **Flat CSS selector strategy** — max 2-level depth, zero specificity wars, no `@import`, no heavy selectors.

---

## Action Plan

1. - [ ] **[Critical]** Sanitize `HtmlBlock.ts` `innerHTML` using `sanitizeHTMLToDom` or a DOM allowlist — prevents XSS in shared vaults
2. - [ ] **[High]** Add undo/confirmation to block removal in `GridLayout.ts`
3. - [ ] **[High]** Add ARIA roles and labels throughout — toolbar, grid, block wrappers, handle buttons, select element
4. - [ ] **[High]** Fix focus restoration after `rerender()` — save focused `data-block-id`, restore after rebuild
5. - [ ] **[High]** Implement targeted DOM updates in `GridLayout` — only full rebuild when block list changes, not on every state change
6. - [ ] **[High]** Add container queries + `minmax()` column guards for narrow-pane Obsidian layouts
7. - [ ] **[High]** Add `max-width: 1400px; margin-inline: auto` to `.homepage-grid`
8. - [ ] **[Medium]** Convert all `px` font sizes to `rem` units
9. - [ ] **[Medium]** Fix settings modal config mutation — clone config as `draft` at `onOpen()`, write back only on Save
10. - [ ] **[Medium]** Add `@media (prefers-reduced-motion: reduce)` block to `styles.css`
11. - [ ] **[Medium]** Add `aspect-ratio: 1; object-fit: cover` to `.gallery-item img` to prevent layout shift
12. - [ ] **[Medium]** Replace `border` in edit mode with `outline` to eliminate layout shift
13. - [ ] **[Medium]** Add empty-state UI when `blocks.length === 0`
14. - [ ] **[Medium]** Clamp `colSpan` and `col` when column count decreases
15. - [ ] **[Low]** Add `focus-visible` outline styles for all interactive elements
16. - [ ] **[Low]** Add transition to `.block-resize-grip`, `.block-dragging`, and `.block-move-handle:hover`
17. - [ ] **[Low]** Replace `!important` on `.toolbar-btn-active` with compound selector
18. - [ ] **[Low]** Consolidate border-radius to 3 named CSS custom property tiers
19. - [ ] **[Low]** Add `max-height: 500px; overflow-y: auto` to `.quotes-columns`
20. - [ ] **[Low]** Use `setIcon()` from Obsidian API for handle bar icons with `aria-label`
