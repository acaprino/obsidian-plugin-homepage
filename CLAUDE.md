# Homepage Blocks — Obsidian Plugin

A native, composable CSS-grid homepage plugin for Obsidian.
No Dataview dependency. TypeScript + Obsidian DOM API only.

## Entry Points

- `src/main.ts` — plugin entry: block registration, view, command, ribbon, settings tab
- `src/HomepageView.ts` — `ItemView` (`VIEW_TYPE = 'homepage-blocks'`): mounts grid + toolbar
- `src/GridLayout.ts` — CSS grid renderer, drag-to-swap, colSpan resize
- `src/EditToolbar.ts` — edit mode toggle, add-block modal, column picker
- `src/types.ts` — `BlockInstance`, `LayoutConfig`, `BlockFactory`, `IHomepagePlugin`
- `src/BlockRegistry.ts` — module-level singleton `Map<BlockType, BlockFactory>`
- `src/blocks/BaseBlock.ts` — abstract class extending Obsidian `Component`
- `src/utils/tags.ts` — shared `getFilesWithTag(app, tag)` utility
- `src/blocks/` — one file per block type (8 total)
- `styles.css` — all styles at repo root (no build step needed)

## Build

```bash
npm run build          # esbuild → main.js (root)
npm run dev            # watch mode
npx tsc --noEmit       # type-check only (run after any .ts change)
```

TypeScript `strict: true` is enabled. After any `.ts` edit, run `npx tsc --noEmit` to confirm zero errors before finishing.

## Architecture Constraints

- **No classes without purpose** — plain functions for one-off operations.
- **`IHomepagePlugin` interface** in `types.ts` breaks the circular dep between `main.ts` ↔ blocks/views. Blocks and view depend on the interface, not the concrete class.
- **`BaseBlock extends Component`** — always use `this.registerInterval()` and `this.registerEvent()` (auto-cleanup on unload). Never call `setInterval`/`vault.on` directly without registering.
- **Layout mutations are immutable** — never mutate `BlockInstance` objects in place. Use `blocks.map(b => b.id === id ? { ...b, ...changes } : b)` then call `onLayoutChange()`.
- **`getFilesWithTag`** from `src/utils/tags.ts` — the single shared implementation for tag filtering. Do not duplicate in block files.
- **Block header labels** — use `this.renderHeader(el, title)` from `BaseBlock`. Do not inline `createDiv('block-header')`.
- **`openLinkText(path, '')`** — always use `''` (not `'/'`) as the source path for vault navigation.

## Adding a New Block Type

1. Create `src/blocks/MyBlock.ts` — extend `BaseBlock`:
   - Implement `render(el: HTMLElement): void | Promise<void>`
   - Async renders: add `.catch(e => { console.error(...); el.setText('...'); })`
   - Use `this.renderHeader(el, title)` for the block label
   - Use `this.registerInterval` / `this.registerEvent` for timers/events
   - Implement `openSettings(onSave)` → open a `Modal` subclass in the same file
2. Add the `BlockType` literal to the union in `src/types.ts`
3. Register in `src/main.ts` → `registerBlocks()`:
   ```typescript
   BlockRegistry.register({
     type: 'my-block',
     displayName: 'My Block',
     defaultConfig: { ... },
     defaultSize: { colSpan: 1, rowSpan: 1 },
     create: (app, instance, plugin) => new MyBlock(app, instance, plugin),
   });
   ```
4. Add CSS in `styles.css` using Obsidian CSS variables (`--background-secondary`, `--text-muted`, `--color-accent`, etc.)
5. Optionally add a default entry in `DEFAULT_LAYOUT_DATA` in `main.ts`

## Key Obsidian APIs Used

| API | Purpose |
|-----|---------|
| `app.vault.getMarkdownFiles()` | All markdown files |
| `app.vault.read(file)` | Read file content |
| `app.vault.getAbstractFileByPath(path)` | File/folder by path (`TFile \| TFolder \| null`) |
| `app.vault.getResourcePath(file)` | Vault URI for images/videos |
| `app.metadataCache.getFileCache(file)` | Tags, frontmatter, headings, frontmatterPosition |
| `app.workspace.openLinkText(path, '')` | Open a note |
| `MarkdownRenderer.render(app, md, el, path, component)` | Render markdown inline |
| `moment` (import from `'obsidian'`) | Date/time formatting |

## Layout Persistence

- Layout saved via `plugin.saveLayout(layout)` → `this.saveData(layout)` (Obsidian handles the file)
- Loaded in `onload()` via `validateLayout(await this.loadData())` — validates every field
- `getDefaultLayout()` in `main.ts` returns `structuredClone` of the template; never mutate the template

## Install / Test in Obsidian

Copy `main.js`, `manifest.json`, `styles.css` into:
```
<vault>/.obsidian/plugins/homepage-blocks/
```
Then enable the plugin in Obsidian → Settings → Community Plugins.

## What NOT to Do

- Do not add runtime npm dependencies (zero-dependency is intentional)
- Do not split `main.ts` unless the block count grows significantly
- Do not use `innerHTML` or `eval` — use Obsidian's DOM API (`createEl`, `createDiv`, `setText`)
- Do not mutate `this.plugin.layout.blocks[i]` in place — always return new objects
- Do not call `loadData()`/`saveData()` directly from blocks — go through `plugin.saveLayout()`
