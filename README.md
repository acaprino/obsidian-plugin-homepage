# Homepage Blocks

A dynamic, composable homepage for [Obsidian](https://obsidian.md) — no Dataview required.

Build a personal dashboard with drag-and-drop blocks: clock, daily insight, image gallery, quotes, quick links, and more. Everything is native TypeScript + Obsidian DOM API with zero runtime dependencies.

![Homepage Blocks screenshot](https://raw.githubusercontent.com/acaprino/obsidian-plugin-homepage/master/screenshot.png)

## Features

- **Composable grid layout** — arrange blocks in a multi-column grid, resize column spans, and reorder with drag-and-drop
- **Live drag preview** — a placeholder shows exactly where the block will land before you drop it
- **Collapsible blocks** — click any block header to collapse/expand
- **Edit mode** — toggle a toolbar to add, remove, configure, and reorder blocks; hidden in read mode for a clean look
- **8 built-in block types** — no external plugins needed
- **Responsive** — automatically compresses to fewer columns on narrow panes
- **Zero dependencies** — pure TypeScript, no Dataview, no npm packages at runtime

## Block Types

| Block | Description |
|-------|-------------|
| **Clock / Date** | Live clock with optional seconds and date |
| **Greeting** | Time-aware greeting with your name |
| **Daily Insight** | Random note excerpt from a tagged set, re-seeded daily |
| **Quotes List** | Styled quote list from tagged notes |
| **Quick Links** | Configurable list of vault links or custom URLs |
| **Values / Tag Grid** | Button grid linking to tags or notes |
| **Image Gallery** | Photo/video grid from a vault folder, with masonry option |
| **Embedded Note** | Renders any note inline |
| **Static Text** | Markdown text block |
| **HTML Block** | Raw HTML for custom widgets |

## Installation

### From Community Plugins (recommended)

1. Open Obsidian Settings → Community Plugins
2. Click **Browse** and search for **Homepage Blocks**
3. Install and enable

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/acaprino/obsidian-plugin-homepage/releases/latest)
2. Copy them into `<vault>/.obsidian/plugins/homepage-blocks/`
3. Enable the plugin in Settings → Community Plugins

## Usage

1. Click the **house icon** in the ribbon (or run *Open Homepage* from the command palette)
2. Click the **pencil icon** (top-left) or press the toolbar button to enter **Edit mode**
3. Use **Add Block** to insert blocks, drag the grip handle to reorder, and the resize grip to change column span
4. Click a block's settings icon to configure its title, emoji, or block-specific options
5. Exit Edit mode — the toolbar disappears and the page is clean

## Configuration

Each block has its own settings accessible via the gear icon in Edit mode. Global options (default column count, open on startup) are in **Settings → Homepage Blocks**.

## Contributing

Issues and pull requests are welcome at [github.com/acaprino/obsidian-plugin-homepage](https://github.com/acaprino/obsidian-plugin-homepage).

## License

[MIT](LICENSE)
