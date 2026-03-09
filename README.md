# Homepage Blocks

A composable, drag-and-drop homepage for [Obsidian](https://obsidian.md) — no Dataview required.

Build a personal dashboard from **15 native block types**: clock, greeting, daily insight, image gallery, quotes, quick links, video embeds, pomodoro timer, and more. Everything is saved to your vault and rendered with zero external dependencies.

> **Desktop only** · Requires Obsidian 1.5.0+

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Edit Mode](#edit-mode)
- [Block Types](#block-types)
- [Per-Block Styling](#per-block-styling)
- [Layout Controls](#layout-controls)
- [Global Settings](#global-settings)
- [CSS Customisation](#css-customisation)
- [Installation](#installation)
- [Contributing](#contributing)

---

## Features

- **15 built-in block types** — clock, greeting, daily insight, quotes, quick links, values grid, image gallery, embedded note, static text, HTML, video embed, bookmarks, recent files, pomodoro timer, spacer
- **Drag-to-reorder** — grab the grip handle and drop blocks anywhere; a live placeholder shows the landing spot
- **2D resize** — drag the corner grip to change column width *and* row height simultaneously
- **Zoom slider** — in edit mode, zoom out from 100% to 10% to see the full layout at a glance
- **Accent colors with intensity control** — pick one color per block and adjust how strong the tint appears (5–100%); header, background, border, divider, and interactive controls are all auto-tinted to match
- **Collapsible blocks** — click any block header to collapse or expand it
- **Per-block styling** — custom title, emoji, divider, padding, elevation, border radius, background opacity, backdrop blur, gradients, and more
- **Responsive** — blocks automatically adapt to narrow containers using CSS container queries
- **Full-screen lightbox** — click any gallery image to view it at full size with keyboard and swipe navigation
- **Zero external dependencies** — only [GridStack](https://gridstackjs.com/) is bundled; no Dataview, no Templater

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
| Zoom slider | Toolbar | Zoom out (100%–10%) to see the full grid at a glance |

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

A time-aware, responsive welcome message ("Buongiorno", "Buon pomeriggio", "Buonasera") based on the current hour. Automatically stacks vertically on narrow blocks.

| Setting | Description |
|---------|-------------|
| Name | Your name — shown as "Buongiorno, Name" |
| Show emoji | Time-of-day emoji (sun, moon, etc.) |
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

Renders a styled, multi-column list of quotes, either pulled from tagged notes or entered manually.

| Setting | Description |
|---------|-------------|
| Source | **Notes with tag** — reads the first lines of each matching note. **Manual text** — paste quotes directly |
| Tag | Tag to search (when source is "Notes with tag") |
| Quotes (text) | One quote per block, separated by `---` on its own line. Add a source line starting with `—`, `–`, or `--` |
| Columns | 2 or 3 columns (auto-adjusts to fewer on narrow blocks) |
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

Displays images and videos from a vault folder in a responsive grid with a full-screen lightbox.

| Setting | Description |
|---------|-------------|
| Folder | The vault folder to scan. Subfolders are included recursively |
| Layout | **Grid** — uniform squares. **Masonry** — variable-height columns |
| Height mode | **Auto** — card expands to show all images. **Fixed** — scrolls within the card's row height |
| Columns | 2, 3, or 4 columns (auto-reduces on narrow blocks: ≤500px → 3, ≤400px → 2, ≤280px → 1) |
| Max items | Maximum number of media files to show (1–200) |

Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.mp4`, `.webm`, `.mov`, `.mkv`.

**Lightbox:** Click any image or video to open it full-screen. Navigate with arrow keys, swipe on touch devices, or click the prev/next buttons. Press Escape to close.

**Videos:** Play silently on hover in the gallery. In the lightbox, videos play with controls.

---

### Video Embed

Embed YouTube, Vimeo, or Dailymotion videos directly on your homepage.

| Setting | Description |
|---------|-------------|
| URL | Video or playlist URL |
| Shuffle on load | Start with a random video from a playlist each time the homepage opens |

Supports YouTube videos, shorts, and playlists; Vimeo videos; and Dailymotion videos.

---

### Bookmarks

A grid of web links and vault bookmarks with optional descriptions.

| Setting | Description |
|---------|-------------|
| Columns | 1, 2, or 3 columns |
| Show descriptions | Display description text under each bookmark |
| Items | Each item has an optional emoji, label, URL (web link or vault note path), and optional description |

---

### Recent Files

Shows your most recently modified vault notes.

| Setting | Description |
|---------|-------------|
| Max items | Number of files to show (5–20, default 10) |
| Show timestamp | Display relative time (e.g. "2 minutes ago") next to each file |
| Exclude folders | Comma-separated folder paths to exclude from results |

---

### Pomodoro Timer

A built-in pomodoro timer with configurable work/break cycles.

| Setting | Description |
|---------|-------------|
| Work minutes | Work session duration (1–60, default 25) |
| Break minutes | Short break duration (1–30, default 5) |
| Long break minutes | Long break duration (1–60, default 15) |
| Sessions before long break | Work sessions before a long break (2–8, default 4) |

---

### Embedded Note

Renders any vault note inline using Obsidian's markdown renderer.

| Setting | Description |
|---------|-------------|
| File path | Path to the note to embed (e.g. `Journal/Today.md`) |
| Height mode | **Scroll** — fixed maximum height with a scrollbar. **Grow** — block expands to show the full note |

---

### Static Text

A freeform markdown block. Supports all standard Obsidian markdown: headings, lists, callouts, bold, links, and more. Includes a quick-edit pencil button for fast inline editing.

| Setting | Description |
|---------|-------------|
| Content | Markdown text to render |

---

### HTML Block

A block for custom HTML. Useful for embedding widgets or anything that needs raw markup.

| Setting | Description |
|---------|-------------|
| HTML content | Raw HTML to render inside the block |

> HTML is sanitized before rendering. Potentially dangerous tags (iframe, object, embed, form) are stripped as a defense-in-depth measure.

---

### Spacer

An empty block for layout spacing. No settings — just drag and resize to create visual gaps between other blocks.

---

## Per-Block Styling

Every block has these options in its settings modal (gear icon):

### Title & Header

| Setting | Description |
|---------|-------------|
| Title label | Custom title text (leave empty for the default) |
| Title emoji | Pick an emoji from the built-in picker |
| Title size | Header size (h1–h6) |
| Hide title | Hides the title bar entirely |
| Show divider | Thin separator line between title and content |
| Title gap | Space between the title and content in pixels |

### Accent Color

| Setting | Description |
|---------|-------------|
| Accent color | Pick a color (or use a preset swatch) to tint the entire card |
| Accent intensity | How strong the tint appears on the background (5–100%, default 15%) |
| Hide header background | Keep the card tint but remove the colored header bar |

A single accent color automatically derives the header background, card background, border, title text, divider, and all interactive controls (checkboxes, toggles, radio buttons) — using darkened variants for contrast on light accents.

### Card Appearance

| Setting | Description |
|---------|-------------|
| Hide border | Remove the card border and hover highlight |
| Hide background | Remove the card background — the block blends into the page |
| Card padding | Custom inner padding in pixels |
| Shadow / Elevation | Card shadow depth (0–3) |
| Border radius | Corner rounding in pixels |
| Border width | Border thickness in pixels |
| Border style | Solid, dashed, or dotted |

### Advanced

| Setting | Description |
|---------|-------------|
| Background opacity | Background transparency (100 = fully opaque) |
| Backdrop blur | Glassmorphism blur behind the card (works when opacity < 100) |
| Gradient start / end | Two-color background gradient |
| Gradient angle | Direction of the gradient in degrees |

---

## Layout Controls

### Column width

Each block occupies 1 to N columns, where N is the current column count (set globally in Settings). Drag the corner grip horizontally to change this.

### Row height

Drag the corner grip downward to increase a block's minimum height. Each unit is 200 px by default (configurable via CSS). Maximum is 12 units.

### Auto-height

Some blocks (Image Gallery, Quotes List, Embedded Note, Static Text) can auto-expand to fit their content. When the block width changes (e.g. window resize), the height recalculates automatically.

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

<!--
TODO before publishing:
- [ ] Add hero screenshot (screenshots/hero.png) — dark theme, 3-column layout with several block types
- [ ] Add edit mode screenshot (screenshots/edit-mode.png) — showing drag handles and zoom slider
- [ ] Add accent color screenshot (screenshots/accent-colors.png) — blocks with different accent tints
- [ ] Create a GitHub release with main.js, manifest.json, styles.css
- [ ] Submit PR to obsidianmd/obsidian-releases with community-plugins.json entry
-->
