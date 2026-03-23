# Vault Search Block — Design Spec

## Overview

A search bar block for the Homepage Blocks plugin that lets users search vault notes by filename with live results in a floating dropdown. Keyboard navigable, minimal config.

## Block Type

- Type literal: `vault-search`
- Display name: `Vault Search`
- Default size: `{ w: 2, h: 2 }`

## Behavior

### Search

- Input field with search icon (Obsidian `setIcon('search')`) and placeholder "Search vault..."
- On input: debounce 150ms, filter `app.vault.getMarkdownFiles()` by `file.basename` case-insensitive `includes` match
- Max 10 results shown
- Empty input → dropdown hidden

### Results Dropdown

- Floating overlay: `position: absolute`, anchored below the input, full width of block
- High z-index (100) to float above other homepage content
- Each result shows: file icon + basename + muted folder path
- Click on result → `app.workspace.openLinkText(file.path, '')` → opens note in new tab
- No auto-height — block stays at fixed grid size, dropdown floats independently

### Keyboard Navigation

- Arrow Down/Up: move selection through results (wraps)
- Enter: open selected result (or first if none selected)
- Escape: close dropdown and clear input
- Focus on input: if text present, show dropdown

### Focus/Blur

- Focus input → show dropdown if there's text
- Blur → close dropdown after short delay (50ms) to allow click on result to register

## Settings Modal

One setting:

- **Placeholder text** — customizes the input placeholder (default: "Search vault...")

## File Structure

### `src/blocks/VaultSearchBlock.ts`

```typescript
class VaultSearchBlock extends BaseBlock {
  render(el: HTMLElement): void {
    // 1. renderHeader(el, 'Vault Search')
    // 2. Create .vault-search-block container
    // 3. Create input wrapper (icon + input)
    // 4. Create dropdown div (hidden)
    // 5. Wire input event (debounced) → filter files → render results
    // 6. Wire keyboard events (arrows, enter, escape)
    // 7. Wire focus/blur
  }

  openSettings(onSave): void {
    // Modal with placeholder text setting
  }
}
```

### CSS Classes (in `styles.css`)

| Class | Purpose |
|-------|---------|
| `.vault-search-block` | Container, `position: relative` (anchor for dropdown) |
| `.vault-search-input-wrapper` | Flex row: icon + input, rounded, `--background-secondary` |
| `.vault-search-input` | Borderless, transparent bg, full width |
| `.vault-search-dropdown` | Absolute positioned, below input, shadow, rounded, max-height + overflow-y auto |
| `.vault-search-result` | Flex row: icon + name + path, clickable |
| `.vault-search-result.is-selected` | Highlighted state (keyboard nav or hover) |
| `.vault-search-result-name` | File basename, normal weight |
| `.vault-search-result-path` | Folder path, smaller font, `--text-muted`, truncated |

### Registration (in `src/main.ts`)

```typescript
BlockRegistry.register({
  type: 'vault-search',
  displayName: 'Vault Search',
  defaultConfig: { placeholder: 'Search vault...' },
  defaultSize: { w: 2, h: 2 },
  create: (app, instance, plugin) => new VaultSearchBlock(app, instance, plugin),
});
```

### Edit Toolbar Meta (in `src/EditToolbar.ts`)

```typescript
'vault-search': { icon: '🔍', desc: 'Search notes by name' },
```

### Types (in `src/types.ts`)

Add `'vault-search'` to the `BLOCK_TYPES` array.

## Implementation Notes

- Use Obsidian DOM API (`createDiv`, `createEl`, `setIcon`) — no innerHTML
- Debounce via `setTimeout` / `clearTimeout` (no need for Scheduler — it's local to the block)
- `this.register()` for cleanup of any intervals/listeners
- No vault event watching needed — search is on-demand, reads file list at query time
- No `data-auto-height-content` — fixed height block, dropdown floats

## Out of Scope

- Full-text content search
- Search history / recent searches
- Saved/pinned searches
- Tag or frontmatter search
- Fuzzy matching (simple includes is sufficient for v1)
