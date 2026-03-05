# Homepage Blocks

A composable, drag-and-drop homepage for [Obsidian](https://obsidian.md) — no Dataview required.

Build a personal dashboard from ten native block types: clock, daily insight, image gallery, quotes, quick links, values grid, and more. Everything is saved to your vault and rendered with zero external dependencies.

> **Desktop only** · Requires Obsidian 1.5.0+

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Edit Mode](#edit-mode)
- [Block Types](#block-types)
- [Layout Controls](#layout-controls)
- [Global Settings](#global-settings)
- [CSS Customisation](#css-customisation)
- [Installation](#installation)
- [Contributing](#contributing)

---

## Features

- **10 built-in block types** — clock, greeting, daily insight, quotes, quick links, values grid, image gallery, embedded note, static text, HTML
- **Drag-to-reorder** — grab the grip handle and drop blocks anywhere; a live placeholder shows the landing spot
- **2D resize** — drag the corner grip to change column width *and* row height simultaneously
- **Force new row** — pin any block to the start of its own row, regardless of what comes before it
- **Collapsible blocks** — click any block header to collapse or expand it
- **Responsive** — automatically switches to fewer columns on narrow panes
- **Zero dependencies** — pure TypeScript, no Dataview, no runtime npm packages

---

## Quick Start

1. Click the **house icon** in the ribbon, or run **Open Homepage** from the command palette (`Ctrl/Cmd + P`)
2. Click the **pencil icon** in the top-left corner (or use the toolbar) to enter **Edit mode**
3. Click **Add Block** to insert a new block
4. Configure blocks with the **gear icon**, reorder with the **grip handle**, resize with the **corner grip**
5. Click **Done** to exit Edit mode — the toolbar disappears and the page is clean

---

## Edit Mode

Edit mode reveals the toolbar and a set of controls on each block:

| Control | Location | Action |
|---------|----------|--------|
| Grip handle (lines) | Top-left of block | Drag to reorder |
| Up / Down buttons | Handle bar | Move block up or down one position |
| Gear icon | Handle bar | Open block settings |
| X button | Handle bar | Remove block (with confirmation) |
| Corner grip | Bottom-right of block | Drag to resize column width and row height |

### Resizing blocks

Drag the **corner grip** diagonally:

- **Horizontal** — changes the column span (1 to the current column count)
- **Vertical** — changes the row height (1 to 12 row units; one unit is 200 px by default)

The block updates live while dragging.

---

## Block Types

### Clock / Date

Displays a live clock that updates every second.

| Setting | Description |
|---------|-------------|
| Show seconds | Include or hide the seconds field |
| Show date | Show the full date below the time |

---

### Greeting

A time-aware welcome message ("Good morning", "Good afternoon", "Good evening") based on the current hour.

| Setting | Description |
|---------|-------------|
| Name | Your name — shown as "Good morning, Name" |
| Show time | Include the current time alongside the greeting |

---

### Daily Insight

Shows a rotating excerpt from a set of notes that share a tag. Useful for surfacing a daily idea, affirmation, or reference.

| Setting | Description |
|---------|-------------|
| Tag | The tag to search (with or without `#`). All notes with this tag are candidates |
| Daily seed | **On** — shows the same note all day, changes at midnight. **Off** — picks a random note each time the homepage opens |

The excerpt is the first non-heading paragraph of the note, extracted via Obsidian's metadata cache.

---

### Quotes List

Renders a styled list of quotes, either pulled from tagged notes or entered manually.

| Setting | Description |
|---------|-------------|
| Source | **Notes with tag** — reads the first lines of each matching note. **Manual text** — paste quotes directly |
| Tag | Tag to search (when source is "Notes with tag") |
| Quotes (text) | One quote per block, separated by `---` on its own line. Add a source line starting with `—`, `–`, or `--` |
| Columns | 2 or 3 columns |
| Height mode | **Scroll** — fixed-height card with internal scrollbar. **Grow to fit** — card expands to show all quotes |
| Max items | Maximum number of quotes to display |

**Tip:** Add `color: "#e88"` to a note's frontmatter to colour its quote's left border and text.

**Manual text format:**

```
The only way to do great work is to love what you do.
— Steve Jobs
---
In the middle of difficulty lies opportunity.
— Albert Einstein
```

---

### Quick Links

A clickable list of vault notes or custom links.

| Setting | Description |
|---------|-------------|
| Auto-list folder | Automatically lists all notes inside a vault folder, sorted alphabetically. Updates live when notes are added or renamed |
| Manual links | Individual links with a label, a note path, and an optional emoji |

Both auto-list and manual links can be active at the same time — folder notes appear first.

---

### Values / Tag Grid

A button grid for quick navigation to key notes or areas of your vault.

| Setting | Description |
|---------|-------------|
| Columns | 1, 2, or 3 columns |
| Items | Each item has an emoji, a label, and an optional note path to open on click |

Items without a path are displayed as non-clickable labels.

---

### Image Gallery

Displays images and videos from a vault folder.

| Setting | Description |
|---------|-------------|
| Folder | The vault folder to scan. Subfolders are included recursively |
| Layout | **Grid** — uniform squares. **Masonry** — variable-height columns |
| Columns | 2, 3, or 4 columns |
| Max items | Maximum number of media files to show |

Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.mp4`, `.webm`, `.mov`, `.mkv`.

Videos play silently on hover and stop when the cursor leaves. Click any item to open the full file in Obsidian.

---

### Embedded Note

Renders any vault note inline using Obsidian's markdown renderer.

| Setting | Description |
|---------|-------------|
| File path | Path to the note to embed (e.g. `Journal/Today.md`) |
| Height mode | **Scroll** — fixed maximum height with a scrollbar. **Grow** — block expands to show the full note |

---

### Static Text

A freeform markdown block. Supports all standard Obsidian markdown: headings, lists, callouts, bold, links, and more.

| Setting | Description |
|---------|-------------|
| Content | Markdown text to render |

---

### HTML Block

A block for custom HTML. Useful for embedding widgets or anything that needs raw markup.

| Setting | Description |
|---------|-------------|
| HTML content | Raw HTML to render inside the block |

> HTML is rendered inside Obsidian's DOM. External scripts are not executed.

---

## Layout Controls

### Column width

Each block occupies 1 to N columns, where N is the current column count (set globally in Settings). Drag the corner grip horizontally to change this.

### Row height

Drag the corner grip downward to increase a block's minimum height. Each unit is 200 px by default (configurable via CSS). Maximum is 12 units.

### Force new row

In the block's gear menu, enable **Start on new row** to always place the block at the beginning of a new row, regardless of what comes before it.

### Collapsing blocks

Click any block's header to collapse it to just its title bar. Click again to expand. The state is saved automatically.

---

## Global Settings

Open **Settings → Homepage Blocks**:

| Setting | Description |
|---------|-------------|
| Open on startup | Automatically open the homepage when Obsidian launches |
| Default columns | Grid column count: 2, 3, or 4 |
| Reset to default layout | Restores the original demo blocks. **Cannot be undone** |

### Commands

Both commands are available in the command palette (`Ctrl/Cmd + P`):

| Command | Action |
|---------|--------|
| Open Homepage | Opens or focuses the homepage tab |
| Toggle edit mode | Switches between edit and read mode |

---

## CSS Customisation

Override any of these custom properties in a [CSS snippet](https://help.obsidian.md/Extending+Obsidian/CSS+snippets) to adjust the layout:

```css
/* .obsidian/snippets/homepage.css */
:root {
  --hp-gap: 16px;             /* space between blocks */
  --hp-padding: 24px;         /* padding around the grid */
  --hp-card-padding: 16px;    /* padding inside each block */
  --hp-card-min-width: 200px; /* minimum block width before wrapping */
  --hp-content-max-width: 1400px; /* maximum grid width */
  --hp-row-unit: 200px;       /* height of one row span unit */
}
```

---

## Installation

### Community Plugins (recommended)

1. Open **Settings → Community Plugins → Browse**
2. Search for **Homepage Blocks**
3. Click **Install**, then **Enable**

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/acaprino/obsidian-plugin-homepage/releases/latest)
2. Create the folder `<vault>/.obsidian/plugins/homepage-blocks/`
3. Copy the three files into that folder
4. Open **Settings → Community Plugins** and enable **Homepage Blocks**

---

## Contributing

Bug reports and pull requests are welcome at [github.com/acaprino/obsidian-plugin-homepage](https://github.com/acaprino/obsidian-plugin-homepage).

---

## License

[MIT](LICENSE)
