# Styling and theming

How the homepage is styled, what a CSS snippet can override, and how per-block styling keys reach the DOM. It describes branch `xray-remediation` after the X-ray fixes and the review-backlog fixes of 2026-10-10. Everything here was read from `styles.css`, `src/utils/blockStyling.ts`, `src/utils/accentContrast.ts` and the TypeScript that toggles classes. Statements marked **(inferred)** follow from CSS cascade, `var()` or container rules and have not been checked in a running Obsidian.

Related: [architecture](architecture.md) · [data model](data-model.md) (where the `_` keys live and how they migrate) · [flows](flows.md) · [blocks](blocks.md) · [plugin API](api/plugin.md) · [block API](api/blocks.md) · [grid API](api/grid.md).

## 1. Stylesheet and element tree

- `styles.css` is the only stylesheet. Line 2 is GridStack's core CSS, copied from `gridstack/dist/gridstack.min.css` (`styles.css:1-2`). GridStack sets `--gs-*` variables at runtime; `styles.css` never declares them.
- GridStack runs with `cellHeight: 80`, `margin: 8` (`src/GridLayout.ts:378-381`).

```text
.view-content.homepage-view                 HomepageView.ts:30  (container "homepage", inline-size)
├── .homepage-edit-fab                      EditToolbar.ts:24   (inserted first, HomepageView.ts:51)
├── .homepage-toolbar                       EditToolbar.ts:34
└── .homepage-grid.grid-stack               GridLayout.ts:54
    └── .grid-stack-item [role=listitem] (+ .is-auto-height)          GridLayout.ts:467-473
        └── .grid-stack-item-content
            └── .homepage-block-wrapper.hp-block-<type> [data-block-id]  BlockWrapper.ts:20-28  (the card; inline-size container)
                ├── .block-handle-bar                edit mode only, EditHandleBar.ts:46
                ├── .block-header-zone               BlockWrapper.ts:41 ([role=button] only while a header is drawn, BaseBlock.ts:76-88)
                │   ├── .block-collapse-chevron
                │   └── .block-header (.block-header-h1..h6) > .block-header-emoji + span
                ├── .block-header-divider            only when _showDivider === true
                └── .block-content.<root-class>      render(el) receives this element
```

The block's own root class is added to `.block-content` itself, not to a child. The wrapper class uses the type id; the root class does not always match it:

| Type | Wrapper class | Root class on `.block-content` |
|---|---|---|
| `greeting` | `hp-block-greeting` | `greeting-block` (`GreetingBlock.ts:177`) |
| `clock` | `hp-block-clock` | `clock-block` (`ClockBlock.ts:24`) |
| `folder-links` | `hp-block-folder-links` | `folder-links-block` |
| `button-grid` | `hp-block-button-grid` | `button-grid-block` (`ButtonGridBlock.ts:16`) |
| `quotes-list` | `hp-block-quotes-list` | `quotes-list-block` |
| `image-gallery` | `hp-block-image-gallery` | `image-gallery-block` (`ImageGalleryBlock.ts:226`) |
| `embedded-note` | `hp-block-embedded-note` | `embedded-note-block` |
| `static-text` | `hp-block-static-text` | `static-text-block` |
| `html` | `hp-block-html` | `html-block` |
| `video-embed` | `hp-block-video-embed` | `video-embed-block` |
| `bookmarks` | `hp-block-bookmarks` | **`bookmark-block`** (`BookmarkBlock.ts:22`) |
| `recent-files` | `hp-block-recent-files` | `recent-files-block` |
| `pomodoro` | `hp-block-pomodoro` | `pomodoro-block` (`PomodoroBlock.ts:46`) |
| `spacer` | `hp-block-spacer` | `spacer-block` |
| `random-note` | `hp-block-random-note` | `random-note-block` |
| `voice-dictation` | `hp-block-voice-dictation` | **`voice-block`** (`VoiceDictationBlock.ts:131`) |
| `vault-search` | `hp-block-vault-search` | `vault-search-block` |

`styles.css` itself only uses `hp-block-pomodoro` and `hp-block-voice-dictation` (`styles.css:3048-3049`, `3547-3554`). The others exist for snippets.

**Children of `.block-content` are clipped.** The collapse animation makes `.block-content` a one-row grid and gives every direct child `overflow: hidden; min-height: 0` (`styles.css:2500-2509`). A block whose content must scroll inside its card therefore needs a rule that outranks that clip. Static Text has one for `.static-text-content` (`:2083-2087`). The height modes that scroll have one each (`:2511-2519`):

| Block, height mode | Scrolling element | Rule |
|---|---|---|
| Embedded note, every mode but Grow (the default is Scroll) | `.embedded-note-content` | `.block-content:not(.embedded-note-block--grow) > .embedded-note-content` |
| Quotes, every mode but Extend (Scroll (fixed height), Wrap) | `.quotes-columns` | `.block-content:not(.quotes-list-block--extend) > .quotes-columns` |
| Image gallery, Fixed (scroll) | `.image-gallery.image-gallery--fixed-height` | `.block-content > .image-gallery.image-gallery--fixed-height` |

Each sets `overflow-y: auto` at (0,3,0) or more, against the clip's (0,2,0). The Grow and Extend modes keep the clip; their card grows to fit through auto-height instead. These regions keep their scroll bar when Show scroll bar is off (§11).

The same generic rule makes `.block-content` a grid (`.homepage-block-wrapper .block-content { display: grid }`, (0,2,0), `styles.css:2592-2596`). A root class that lays its block out with flex must outrank it: the clock does at (0,3,0) (`.homepage-block-wrapper .block-content.clock-block`, `:896`), which centres the time in its card. Bookmark cards are buttons, so they set `height: auto` against Obsidian's fixed button height (`:3529`). In list mode a quote taken from a note shows its "— Author" line as `.quote-author` (`:1707-1712`). An inline HTML fragment (HTML without `<style>`) renders in `.html-block-content`, which has `contain: paint` (`:2246-2250`): an element of the fragment with `position: fixed` (an Obsidian class such as `modal-container`) is held and clipped inside the block instead of covering the page. The fragment keeps no `style` attributes, media or non-http(s) links (`HtmlBlock.ts`, `disarmInline`).

The card's shadows are not clipped: `.homepage-grid.grid-stack > .grid-stack-item > .grid-stack-item-content { overflow: visible }` (0,4,0, `:66-68`) outranks GridStack's bundled `overflow-x: hidden; overflow-y: auto` (0,3,0) on the cell.

## 2. Where a value can be set

Three layers feed the card, from weakest to strongest:

1. **Tokens declared on `.homepage-view`** (§3), and on the block settings modal (`.hp-block-settings-modal`) for its preview card. A value on `:root` or `body` is shadowed by the declaration. To override, match the element with a selector that outranks `.homepage-view` (0,1,0). This repo does not control whether snippets load before or after plugin CSS, so use `body .homepage-view` (0,1,1) instead of relying on source order.
2. **Hooks read with a `var()` fallback and never declared** (§4). Any ancestor works, `:root` included.
3. **Inline custom properties written by `applyBlockStyling`** on the card (§5). An inline declaration on the card beats any inherited value, so per-block settings override snippets for the same property.

Card padding is a hook with a declared default: every rule reads `var(--hp-card-padding, var(--hp-card-padding-default))`, and the plugin declares only `--hp-card-padding-default` (on `.homepage-view`, and smaller values on `.homepage-grid` in narrow panes and on mobile, §8). The plugin never declares `--hp-card-padding` itself, so a snippet value for it, on `.homepage-view` or any other ancestor, wins at every width, on desktop and mobile; a block's own `_cardPadding` (inline `--hp-card-padding` on the card) still wins over the snippet. The grid's own padding is still replaced by literals in narrow panes.

On the Obsidian mobile app, `:where(.is-mobile) .homepage-view` redeclares `--hp-padding: 6px` and `--hp-card-padding-default: 10px` (`styles.css:3851-3854`). `:where()` keeps it at (0,1,0), the specificity of `.homepage-view`, so a snippet on `.homepage-view` that loads after the plugin stylesheet wins on mobile too, and `body .homepage-view` (0,1,1) wins whatever the order. According to the comment at `styles.css:3843`, Obsidian sets `.is-mobile` on `<body>`. A snippet value meant for the mobile app only can still use `body.is-mobile .homepage-view` (0,2,1).

How card padding is resolved:

```mermaid
flowchart TD
  A["padding: var(--hp-card-padding, var(--hp-card-padding-default)) on .homepage-block-wrapper, styles.css:132"] --> C{"_cardPadding set and not 0?"}
  C -- yes --> I["inline --hp-card-padding: Npx, blockStyling.ts:126"]
  C -- no --> S{"a snippet sets --hp-card-padding?"}
  S -- yes --> V["the snippet value, at every width"]
  S -- no --> B{"@container homepage (max-width: 380px)?"}
  B -- yes --> L["default 8px on .homepage-grid, styles.css:3328-3330"]
  B -- no --> B2{"@container homepage (max-width: 540px)?"}
  B2 -- yes --> N["default 10px on .homepage-grid, styles.css:3260-3262"]
  B2 -- no --> D{"body.is-mobile?"}
  D -- yes --> M["default 10px, styles.css:3853"]
  D -- no --> T["default clamp(6px, 1.5cqi, 12px), styles.css:12"]
```

`_cardPadding` is limited to 0–48 in the slider, the render clamp and the import validator (`STYLE_RANGES`, `blockStyling.ts:17`), so a stored negative value renders as the default.

**(inferred)** `1.5cqi` in the token is substituted where it is used. For the card and the grid, the nearest ancestor query container is `.homepage-view`, so the default padding is 1.5% of the view width, clamped to 6–12px.

## 3. Tokens declared on `.homepage-view`

Declared at `styles.css:8-36`, on `.homepage-view, .hp-block-settings-modal`. The second selector is the content element of the block settings modal (`BlockSettingsModal.ts:52`), so its preview card resolves padding and elevation as a card on the homepage does. The comment at `styles.css:5` reads "Override in snippets/homepage.css via .homepage-view { ... }"; a snippet on `.homepage-view` does not reach the modal.

| Token | Default | Consumed at | Notes |
|---|---|---|---|
| `--hp-padding` | `clamp(8px, 1.5cqi, 16px)` | grid `padding` `:50`; toolbar side padding `:2260`, `:2278` | mobile `6px` (`:3851`). Grid padding replaced by literals ≤540px in single-column mode (8px) and ≤380px outside it (4px); the visible toolbar's by `6px 12px` at ≤540px (`:3128`). §8 |
| `--hp-card-padding-default` | `clamp(6px, 1.5cqi, 12px)` (`:12`) | the fallback of `var(--hp-card-padding, …)`: card `padding` `:132`; skeleton `:658`; pomodoro/voice `inset` `:3654` | mobile `10px` (`:3853`); `10px` / `8px` on `.homepage-grid` at ≤540px / ≤380px (`:3261`, `:3329`). `--hp-card-padding` itself is never declared: a snippet sets it on any ancestor and wins at every width; per-block `_cardPadding` writes it inline and wins over that |
| `--hp-content-max-width` | `1400px` | grid `max-width` `:51` | grid is centred (`margin-inline: auto`, `:54`) |
| `--hp-space-1` … `--hp-space-6` | 2, 4, 8, 12, 16, 24px | `--hp-space-4` `:2728`, `--hp-space-1` `:2743` (Add Block rows) | `-2`, `-3`, `-5`, `-6` are never read. The Add Block modal is outside `.homepage-view`, so its fallbacks apply there anyway |
| `--hp-dur-fast` / `-base` / `-slow` | 0.12s / 0.2s / 0.3s | only `--hp-dur-base` (`:2712`, drag dimming) | |
| `--hp-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | never read | |
| `--hp-ease-out` | `ease-out` | `:2712` | |
| `--hp-elevation-1` / `-2` / `-3` | shadow stacks | `.block-elevation-1..3` (`:3361-3369`), and with the border hidden `.block-no-border.block-elevation-1..3` (`:411-416`) | |
| `--hp-elevation-drag` | shadow stack | dragged card (`:2716-2722`) | |

`.homepage-view` also sets `display: flex; flex-direction: column; height: 100%; overflow: hidden; position: relative; container-type: inline-size; container-name: homepage` (`styles.css:38-46`), in a rule of its own.

In practice, the tokens a snippet can usefully override are `--hp-padding`, `--hp-card-padding`, `--hp-content-max-width`, `--hp-elevation-1..3` and `--hp-elevation-drag`. The spacing and motion tokens hardly reach anything.

## 4. Hooks read with a fallback (not declared)

A snippet can set these on any ancestor. `applyBlockStyling` writes some of them inline on the card, and the inline value wins for that block.

| Variable | Fallback | Read at | Also written inline by |
|---|---|---|---|
| `--hp-title-gap` | `8px` | card `gap` `:134`; skeleton `:596` | `_titleGap` |
| `--hp-border-radius` | `var(--radius-m, 8px)` | card `:124` | `_borderRadius` |
| `--hp-border-width` | `1px` | card `:126` | `_borderWidth` |
| `--hp-border-style` | `solid` | card `:127` | `_borderStyle` |
| `--hp-backdrop-blur` | `none` | card `backdrop-filter` `:139-140` | `_backdropBlur` |
| `--hp-bg-opacity` | `100%` | `:3373`, `:3376`, and the gradient layer `:3956`, only under `.block-custom-opacity` | `_bgOpacity` |
| `--block-accent-pct` | `15%` | `.block-accented` `:188` | `_accentIntensity` |
| `--block-accent` | (none inside `.block-accented`; `var(--color-accent)` elsewhere) | §6 | `_accentColor` |
| `--hp-btn-*` (14 names) | per property | `.button-grid .grid-btn` `:1525-1569` | button-grid `customCss`, §10 |
| `--hp-quote-font` | `inherit` | `:1703` | Quotes font preset class (`:1713-1720`) or custom font (`QuotesListBlock.ts:132`) |
| `--hp-quote-line-height` | `1.6` | `:1724` | handwriting preset (`:1719`) |
| `--hp-quote-valign` | `flex-start` | `:1020` | `QuotesListBlock.ts:109` |
| `--hp-quote-align` | `start` | `:1710` | `QuotesListBlock.ts:110` (Text alignment setting) |
| `--hp-card-anim-delay` | `0ms` | `:151` | `BlockWrapper.ts:31` (initial render only) |

Obsidian theme variables the card reads, which a snippet can re-scope under `.homepage-view` or `.homepage-block-wrapper`:
- `--background-secondary`: card background `:129`, and the base of the accent mix `:195` and of the opacity mix `:3373`; the loading skeleton takes the card's own background (`background: inherit`, `:662`)
- `--background-modifier-border`, `--background-modifier-border-hover`: `:128`, `:166`
- `--radius-m`, `--radius-s`
- `--color-accent`, `--interactive-accent`
- `--text-normal`, `--text-muted`, `--text-faint`
- `--h1-size` … `--h6-color`: size, weight, line-height, style, font and colour of `.block-header-h1..h6` (`:401-449`)

Variables written by TypeScript that are internal wiring, not hooks: `--hp-grid-cols` (`BookmarkBlock.ts:32`, `ImageGalleryBlock.ts:344`; `responsiveGridColumns` subtracts the gaps between the tracks from each track's minimum, so N columns fit their row), `--hp-grid-count` (Button grid, only the count: `ButtonGridBlock.ts:31`, read by `repeat(var(--hp-grid-count, 2), 1fr)` at `styles.css:3998`), `--hp-masonry-cols` (`ImageGalleryBlock.ts:336`), `--hp-iframe-height` (the HTML document's height in single-column mode, `HtmlBlock.ts:162`), `--hp-column-count` (`QuotesListBlock.ts:217`), `--hp-quote-color` (`:279`), `--hp-grid-transform` (`GridLayout.ts:268`), `--hp-search-dropdown-top/left/width` (`VaultSearchBlock.ts:217-219`), `--hp-swatch-bg` (`BlockSettingsModal.ts:322`), `--hp-body-width`/`--hp-body-scale` (inside the HTML block's iframe, `HtmlBlock.ts:124-133`). The stylesheet-side caps `--hp-grid-cap`, `--hp-masonry-cap` and `--hp-masonry-gap` are set by the gallery container queries (`styles.css:1849-1878`).

## 5. Per-block styling keys

The shared `_` keys live in each block's `config` (see [data model](data-model.md)). The Header, Body and Card tabs of `BlockSettingsModal` edit them. `applyBlockStyling(el, config)` (`src/utils/blockStyling.ts:73-210`) turns them into classes and inline custom properties. It has two callers:
- `buildBlockWrapper` (`src/grid/BlockWrapper.ts:29`)
- the settings preview card (`BlockSettingsModal.ts:85`)

### 5.1 Ranges: `STYLE_RANGES`

`STYLE_RANGES` (`blockStyling.ts:15-25`) is the one range table. It is used by:
- the sliders (`BlockSettingsModal.ts:194, 214, 232, 242, 286, 352, 376, 397`)
- the render clamps (`clampStyle`, `blockStyling.ts:30-33`)
- the clipboard-import validators (`ranged(key)`, `src/utils/importSanitizer.ts:30-31, 46-62`)

`validateLayout` does **not** clamp `_` keys on load. `src/validation.ts` has no reference to `STYLE_RANGES`, so a hand-edited `data.json` is clamped only at render.

### 5.2 Keys handled by `applyBlockStyling`

The table is in execution order. "0 = default" means that 0 removes the inline property, so the stylesheet fallback applies. That holds for `_cardPadding`, `_titleGap`, `_elevation`, `_borderRadius`, `_backdropBlur` and `_borderWidth`; for `_accentIntensity`, `_bgOpacity` and `_gradientAngle` an explicit 0 is clamped and applied like any other value.

| Key | Accepted | Range | Unset / 0 means | Output on the card | Control |
|---|---|---|---|---|---|
| `customCss` (button-grid only, no `_`) | string | — | nothing | allowlisted `--hp-btn-*` via `setProperty`; key list in `data-hp-custom-css-keys` (`:93-106`) | Content tab textarea, §10 |
| `_accentColor` | `#rrggbb` (`HEX_COLOR_RE`, `:6`) | — | no accent | class `block-accented`; `--block-accent` (`:109-114`) | Card: picker + 11 presets (`BlockSettingsModal.ts:23-26`) |
| `_showHeaderAccent` | boolean | — | shown | `false` → class `block-no-header-accent`, set even without an accent (`:112`) | Header: "Show header bar" |
| `_accentIntensity` | number | 5–100 | unset: 15 (CSS fallback); 0 clamps to 5 | `--block-accent-pct: N%` only when an accent is set and N ≠ 15 (`:117-123`) | Card slider, step 5 |
| (derived) | — | — | — | classes `block-bright-accent`, `block-dark-accent`, `hp-plain-header-light`/`-dark`, `hp-plain-accent-light`/`-dark`, `hp-dark-on-accent`, §6 (`:181-197`, after the background keys below) | — |
| `_showBorder` | boolean | — | shown | `false` → `block-no-border` (`:143`) | Card toggle |
| `_showBackground` | boolean | — | shown | `false` → `block-no-background` (`:144`); also suppresses the gradient (`:193`) | Body toggle |
| `_cardPadding` | number | 0–48 | token (§2) | `--hp-card-padding: Npx` (`:124-127`) | Body slider, step 4 |
| `_titleGap` | number | 0–48 | 8px | `--hp-title-gap: Npx` (`:153-156`) | Header slider, step 2 |
| `_elevation` | number | 0–3 | none | class `block-elevation-N` (`:159-162`) | Card dropdown None/Subtle/Medium/Elevated (`BlockSettingsModal.ts:391-398`) |
| `_borderRadius` | number | 0–24 | `var(--radius-m, 8px)` | `--hp-border-radius: Npx` (`:165-168`) | Card slider, step 2 |
| `_bgOpacity` | number | 0–100 | unset: 100; 0 = fully transparent | below 100, and only while the background is shown: class `block-custom-opacity` + `--hp-bg-opacity: N%` (`:148-155`) | Body slider, step 5 |
| `_backdropBlur` | number | 0–20 | none | `--hp-backdrop-blur: blur(Npx)` only when N > 0 **and** opacity < 100 (`:178-184`) | Body slider, step 1 |
| `_gradientStart`, `_gradientEnd` | `#rrggbb` | — | no gradient | both valid and background shown → class `block-has-gradient` + `--hp-bg-gradient: linear-gradient(<angle>deg, start, end)` (`:187-199`) | Body pickers (seeds `#667eea`, `#764ba2`) |
| `_gradientAngle` | number | 0–360 | unset: 135; 0 = 0deg | angle of the gradient | Body slider, step 15 |
| `_borderWidth` | number | 0–4 | 1px | `--hp-border-width: Npx` (`:202-205`) | Card slider, step 1 |
| `_borderStyle` | `solid` / `dashed` / `dotted` (`VALID_BORDER_STYLES`, `:45`) | — | `solid` | `--hp-border-style` (`:208-212`) | Card dropdown |

Consequences:
- Because 0 means "default", no per-block setting gives square corners or a 0px border. A snippet can (§13, example B).
- The colour pickers always show a colour (`#888888` for the accent, the two gradient seeds). The modal tracks whether a colour was set: the accent counts as set when it held a non-empty string at open or was picked, the gradient when both colours were `#rrggbb` at open or one was picked. Otherwise Save writes `''` for the accent, or for both gradient keys (`BlockSettingsModal.ts:60-63, 432-433`). Picking one gradient colour also takes the seed the other picker shows, so a single changed colour gives a gradient (`:265, 277`). **Clear accent color** and **Clear gradient** reset the pickers to their seeds before they clear the draft, so a cleared colour stays cleared on Save (`:296-301, 323-325`).
- **(inferred)** An imported fractional `_elevation` (e.g. `2.5`) is clamped but not rounded (`importSanitizer.ts:57`), so it produces the class `block-elevation-2.5`, which matches no rule.

### 5.3 Header keys (not in `applyBlockStyling`)

| Key | Handled by | Effect |
|---|---|---|
| `_titleLabel` | `BaseBlock.renderHeader` (`src/blocks/BaseBlock.ts:63-97`) | Trimmed label, else the block's default title, `blockTitle(type)` (`src/blockMeta.ts`). Edit-mode placeholder uses it untrimmed, else `blockTitle(type)` or, for the header-less types, the display name (`BlockWrapper.ts:84-86`) |
| `_titleEmoji` | same | `span.block-header-emoji` (edit mode: `em`, reset to `font-style: normal` at `styles.css:2763-2769`) |
| `_showTitle` | same | `false`, or an empty label → `hp-header-empty` on the header zone (`BaseBlock.ts:75`), which collapses it to height 0 (`styles.css:2533-2539`), and the zone loses `role=button`, `tabindex` and `aria-expanded` (`BaseBlock.ts:76-88`), so it is no Tab stop and cannot collapse the block (`CollapseToggle.ts` checks the role). A block with a hidden title is never rendered collapsed, nor is a Clock, Greeting or Spacer, which draw no header (`isCollapsible`, `src/grid/CollapseToggle.ts:22-24`; `BlockWrapper.ts:23-26`); `viewModeHeight` draws such a stored-collapsed block at its full height. The edit-mode placeholder always shows a header (`BlockWrapper.ts:88`) |
| `_titleSize` | same; `TITLE_SIZE_RE = /^h[1-6]$/` (`BaseBlock.ts:5`) | Class `block-header-h1..h6`, which uses Obsidian's heading variables (`styles.css:401-449`). Ignored in the edit placeholder |
| `_showDivider` | `buildBlockWrapper` (`BlockWrapper.ts:46-48`) | Shown only when `=== true`. Hidden when collapsed (`:460`) and in edit mode (`:465`) |

Clock, Greeting and Spacer draw no header (`blockTitle` returns `''` for them). Their Header tab shows only "This block has no title." and the settings preview hides its header (`BlockSettingsModal.ts:88, 141-146`).

Legacy keys (`_transparent`, `_hideTitle`, `_hideBorder`, `_hideBackground`, `_hideHeaderAccent`) are migrated to the `_show*` keys on load (`src/validation.ts:155-176`); see [data model](data-model.md).

## 6. Accent colour

```mermaid
flowchart LR
  AC["_accentColor #rrggbb"] --> F["applyBlockStyling"]
  AI["_accentIntensity 5-100"] --> F
  F --> C1["class block-accented"]
  F --> V1["inline --block-accent"]
  F --> V2["inline --block-accent-pct (only when not 15)"]
  F --> AC2["accentColors(), utils/accentContrast.ts<br/>contrast per theme"]
  AC2 --> C2["block-bright-accent / block-dark-accent<br/>hp-plain-header-* / hp-plain-accent-*<br/>hp-dark-on-accent"]
  C1 & V1 & V2 --> D[".block-accented derives --_accent-* and --_ctrl"]
  D --> O["redefines Obsidian accent variables inside the card"]
  C2 --> K["text colours scoped by .theme-light / .theme-dark"]
```

`.block-accented` (`styles.css:193-214`) derives the card palette from one colour. Every mix is `color-mix(in srgb, …)`:

| Private variable | Value |
|---|---|
| `--_ap` | `var(--block-accent-pct, 15%)` |
| `--_accent-bg` | accent at `--_ap` over `--background-secondary` → card `background` |
| `--_accent-border` / `--_accent-border-hover` | 50% / 70% accent over `--background-modifier-border` |
| `--_accent-header-bg` | 22% accent over transparent → header zone background (`:214-219`) |
| `--_accent-header-text` | 85% accent over `--text-normal` → `.block-header` colour (`:221-223`) |
| `--_accent-divider` | 40% accent over the border colour (`:225-227`) |
| `--_ctrl` / `--_ctrl-hover` | accent mixed 60% / 50% with black |

Inside the card, the following Obsidian variables are redefined from `--_ctrl`: `--interactive-accent(-hover)`, `--color-accent`, `--color-accent-1`, `--color-accent-2`, `--text-accent(-hover)` and `--checkbox-color(-hover)` (`:205-213`). As a result:
- Buttons and checkboxes rendered inside an accented block use the darkened accent.
- Accent-coloured text (`--text-accent`, links) uses it too in the light theme. In the dark theme `.theme-dark .block-accented` mixes it 60% / 50% toward **white** instead (`styles.css:301-304`), since the darkened accent was nearly invisible on a dark card; control fills keep `--_ctrl`.
- The edit-mode dashed border (`border: 2px dashed var(--color-accent)`, `:2562-2565`) resolves to the darkened accent on the same element.

**Text colours by contrast** (`blockStyling.ts:181-197`, `src/utils/accentContrast.ts`). `accentColors(accent, intensity, opaque, theme, headerAccent)` runs once for each theme; `headerAccent` is `_showHeaderAccent !== false`. It mixes the card the way the stylesheet does (`color-mix(in srgb)`, the accent at its intensity over the theme background) against Obsidian's default theme colours (light `#f6f6f6` / `#222222`, dark `#262626` / `#dadada`), and compares WCAG contrast ratios against 4.5:1. The card counts as opaque only when the background is shown, the opacity is 100 and no gradient is set; otherwise the theme's own text is kept. The results become classes on the card:

| Class | Set when | CSS |
|---|---|---|
| `block-bright-accent` | dark theme: the theme text is below 4.5:1 on the card and `#1a1a1a` reads better | `.theme-dark` (`styles.css:238-296`): `--text-normal: #1a1a1a`, black-alpha muted/faint text, controls mixed 50% / 40% with black, re-asserted on `.block-content` and `.markdown-rendered` so theme rules there cannot shadow them (`:265-281`), task items, links and `hr` coloured directly (`:285-296`) |
| `block-dark-accent` | light theme: the same test, with `#f5f5f5` as the other text | `.theme-light` (`:307-319`): light text, accent text and links mixed toward white, a light header mix |
| `hp-plain-header-light` / `-dark` | the 85% accent title mix is below 4.5:1 on what the title sits on: with the header bar on (`_showHeaderAccent !== false`) the header zone, the accent at 22% over the card (`--_accent-header-bg`, `headerBg` in `accentColors`); with it off, the card | the title falls back to `--text-normal` (`:322-325`) |
| `hp-plain-accent-light` / `-dark` | the accent text colour (mixed toward white on a dark card, toward black on a light one) is below 4.5:1 | `--text-accent`, `--link-color` and their hovers fall back to `--text-normal` (`:326-336`) |
| `hp-dark-on-accent` | `#1a1a1a` reads better than white on the raw accent | `--text-on-accent: #1a1a1a` (`:339-341`), for controls filled with the raw accent (the voice mic, Pomodoro's Start) |

A theme whose backgrounds sit far from Obsidian's defaults gets approximate choices (comment at `accentContrast.ts:1-7`). On mid-tone cards neither text reaches 4.5:1; the code then keeps whichever reads better.

**Header bar off** (`_showHeaderAccent: false`). `.block-accented.block-no-header-accent` makes the header zone transparent and sets the title to `--text-normal`, but keeps the card tint and border (`styles.css:344-351`).

**Rules that read the raw accent.** The first three read `var(--block-accent, var(--color-accent))`: undarkened, and falling back to the theme accent when the block has no accent:
- Clock "accent" style: `:888`, `:892`
- voice mic `:1223`, voice saved flash `:1305`
- `.pomodoro-btn.is-primary` `:3654-3656`
- `.block-accented .folder-link-btn:hover` `:1011-1013` reads `var(--block-accent)` with no fallback (it only matches accented blocks). It uses `color-mix(in oklch …)`, which contradicts the "srgb to avoid oklch hue shifts" comment at `:184`.

**Snippet interaction (derived from the CSS above).**
- `--block-accent` is inherited. A snippet value on `.homepage-view` becomes the colour of those raw-accent rules for blocks that have no accent of their own. It does not tint cards, because `block-accented` is only added from config.
- A snippet `--block-accent-pct` applies to accented blocks whose intensity is unset or 15. The contrast classes computed in JS still assume 15%, so the text colours can be wrong at that intensity.

## 7. Background, border and shadow precedence

These are cascade outcomes of rules that are each correct on their own. All are **(inferred)** from specificity and source order.

| Settings combination | Result | Why |
|---|---|---|
| `_showBackground: false` + `_bgOpacity < 100` | no background, hovered or not | `applyBlockStyling` sets `block-custom-opacity` only while the background is shown (`blockStyling.ts:152`), so only `.block-no-background` (`:418-423`) applies |
| accent + gradient | gradient shows | `.homepage-block-wrapper.homepage-block-wrapper.block-has-gradient` (0,3,0, `:3940-3942`), late in the file, beats `.block-accented` (0,1,0) and `.block-custom-opacity.block-accented` (0,3,0, `:3375`) |
| gradient + `_bgOpacity < 100` (with or without an accent) | translucent gradient; a backdrop blur still shows | `.block-has-gradient.block-custom-opacity` (0,4,0, `:3945-3948`) makes the card transparent and `isolation: isolate`; a `::before` layer behind the content paints the gradient at `opacity: var(--hp-bg-opacity)` (`:3949-3958`), so the opacity does not reach the content and the card's `backdrop-filter` still has a see-through background |
| `_showBorder: false` + `_elevation > 0` | the elevation shadow, also while hovered | `.block-no-border.block-elevation-N` and its `:hover` (0,3,0) / (0,4,0) (`:411-416`). Without an elevation, a hidden border also means no hover shadow (`:407-410`) |
| `_elevation > 0` + hover highlight on, border shown | while hovered, the elevation shadow is replaced by the lighter hover shadow | `.homepage-hover-highlight .homepage-block-wrapper:hover` (0,3,0, `:176-178`) beats `.block-elevation-N` (0,1,0) |
| `_backdropBlur` with opacity 100 | no blur | not written unless opacity < 100 (`blockStyling.ts:180`) |
| any border settings in edit mode | 2px dashed accent | `border` shorthand at (0,3,0), `:2562-2565`. Two (0,4,0) rules still change its colour: `.block-no-border.block-accented:hover` (`:403`) makes it transparent while an accented block with a hidden border is hovered, and the drag rule (`:2716-2722`) tints it while the card is dragged |

Hover highlight (`hoverHighlight`, default `true`, `src/validation.ts:44`) adds only `box-shadow: 0 2px 10px rgba(0,0,0,.06)` on card hover (`:176-178`) and reveals the collapse chevron of an expanded block while hovered (`:2586-2588`). There is no transform. The "lift" wording in the settings description (`HomepageSettingTab.ts:327`), README and CLAUDE.md describes a shadow. The comment at `styles.css:169` calls it "opt-in", but it defaults to on.

## 8. Breakpoints: container queries vs grid columns

Two independent systems react to the width of `.homepage-view`:
- **Container queries** (CSS) adapt the UI.
- **`ResponsiveColumnsManager`** (JS) changes the GridStack column count. It uses a `ResizeObserver` on `.homepage-view` (`src/grid/ResponsiveColumns.ts:62-76`; wired at `GridLayout.ts:430-431`).

| View width | Source | Effect |
|---|---|---|
| ≤ 380px | `@container homepage` `styles.css:3319-3336` | grid `padding: 4px` (0,2,0), which loses to the single-column `padding: 8px` (0,3,0, `:3253-3256`), so it shows only outside single-column mode (in practice edit mode with a canonical count above 1, since view mode below 480px is always single-column); `--hp-card-padding-default: 8px` on `.homepage-grid` (a snippet's `--hp-card-padding` still wins); zoom toolbar group hidden (the column picker stays, so a phone can still change columns); add-button text hidden |
| < 480px | `computeEffectiveColumns` `ResponsiveColumns.ts:40` | 1 column → single-column mode (§9) |
| ≤ 540px | `styles.css:3229-3316` | toolbar wraps, zoom label hidden; single-column `gap`/`padding: 8px`; `--hp-card-padding-default: 10px` on `.homepage-grid` (a snippet's `--hp-card-padding` still wins); entry animation off; folder links as chips; 44px min-heights; quote text 0.9375rem |
| < 768px | `ResponsiveColumns.ts:41` | `min(2, canonical)` columns |
| ≤ 768px | `styles.css:3097-3123` | 44px handle-bar buttons and FAB; larger resize handles |
| < 1024px | `ResponsiveColumns.ts:42` | `min(3, canonical)` columns |
| ≥ 1024px | `ResponsiveColumns.ts:43` | canonical (saved) columns |
| ≥ 1200px | `styles.css:3236-3240` | `.homepage-grid { padding: 32px }`: **never applies**, loses to `.homepage-grid.grid-stack` (0,2,0, `:44-50`) |

- CSS bounds are inclusive (`max-width`); JS bounds are exclusive (`<`). `COLUMN_BREAKPOINTS = { single: 480, double: 768, triple: 1024 }` (`ResponsiveColumns.ts:11`). The two sets are documented as separate at `styles.css:3093-3094` and `ResponsiveColumns.ts:7-9`.
- **Column reduction is suspended in edit mode.** The observer returns early (`ResponsiveColumns.ts:64`), and `setup` pins the canonical count (`:83-85`). Container queries keep firing.
- `.is-mobile` rules (`styles.css:3739-3790`) apply to the mobile app at any width: token overrides, 44px tap targets, folder-link chips, and no hover transforms.

### Containers and block-level queries

| Container | Type | Declared |
|---|---|---|
| `.homepage-view` (`homepage`) | inline-size | `:38-39` |
| `.homepage-block-wrapper` (unnamed) | inline-size | `:138` |
| `.greeting-block`, `.clock-block`, `.voice-block`, `.random-note-block`, `.pomodoro-block` | size; inline-size in single-column mode (`:3146-3164`) | `:646`, `:835`, `:1171`, `:1421`, `:3559` |
| `.button-grid-block`, `.image-gallery-block` | inline-size | `:1513`, `:1750` |

Unnamed `@container` queries resolve against the nearest suitable ancestor:
- greeting: width ≤350 `:701`, height ≤200 `:750`
- clock: height ≤160 `:899`
- voice: width ≤200 `:1334`, height 121–180 `:1345`, height ≤120 with width ≥200 `:1362`
- random note: height ≤160 `:1502`
- button grid / bookmarks: width ≤250 `:1572`
- gallery: width ≤500 / ≤400 / ≤280 `:1849-1878`
- pomodoro: height ≤220 `:3664`, height ≤120 `:3702`

Two exceptions use `@media`:
- the lightbox, `(max-width: 600px)` `:1952`, because it is mounted on `document.body` with no container ancestor (`:1951`)
- `(prefers-reduced-motion: reduce)` `:3796`

Rules in these queries that do not take effect **(inferred)**:
- **Greeting, height query:** `.block-content.greeting-block` (`:751`) targets the size container itself. Its ancestors are inline-size containers only, so a height query cannot match that rule. Its child rules do match. Random note avoids this: the card is `.random-note-body`, a child of the `.random-note-block` size container (`:1420-1428`), so `.random-note-body { gap: 4px }` (`:1504`) matches in a short card.
- **Button grid and bookmarks at ≤250px:** the button grid does collapse to one column: `.button-grid-block .button-grid { grid-template-columns: 1fr }` (0,2,0, `:1645-1648`) beats `.button-grid { grid-template-columns: repeat(var(--hp-grid-count, 2), 1fr) }` (0,1,0, `:3998`), and the block writes only the count inline (`ButtonGridBlock.ts:31`). `.grid-btn { padding; font-size }` (0,1,0, `:1649-1652`) still loses to `.button-grid .grid-btn` (0,2,0). The bookmark grid does not collapse: `.bookmark-grid { --hp-grid-cols: 1fr }` (`:1653-1656`) loses to the inline `--hp-grid-cols` on the same element (`BookmarkBlock.ts:32`).
- **Hover resets at ≤540px:** `.grid-btn:hover` (0,2,0, `:3167`) loses to `.button-grid .grid-btn:hover` (0,3,0). `.bookmark-card:hover` (`:3171`) loses to the later equal-specificity rule at `:3437`. The `.is-mobile` variants (`:3780-3784`) do apply.
- **Gallery grid mode:** `var(--hp-grid-cap, var(--hp-grid-cols))` (`:3876`) replaces the configured column count instead of capping it. From 281 to 400px it is `repeat(2, 1fr)`; from 401 to 500px it is `repeat(auto-fill, minmax(120px, 1fr))`. A 1-column gallery therefore shows more than one column there. Masonry mode does cap, via `min()` (`:3877`).

## 9. Single-column mode

- **Trigger:** the grid gets `hp-single-column` when the effective column count is 1, in view mode only.
  - At init: `GridLayout.ts:457`, never while editing
  - On resize: `ResponsiveColumns.ts:128` (the observer does nothing in edit mode)
  - This means a view narrower than 480px, or a canonical count of 1 (`mobileColumns` can be 1). A one-column layout in edit mode is drawn by GridStack itself: the flex layout below pinned a dragged item to the top, so every drag saved "move to top".
- **CSS** (`styles.css:2999-3090`):
  - The grid becomes `display: flex; flex-direction: column; gap: 12px`.
  - Items become `position: relative; top/left: auto !important; width: 100% !important; height: auto !important`. The `!important` reclaims GridStack's inline styles (comment `:3009-3012`).
  - Item content, card and `.block-content` get `height: auto`. `.block-content` gets `min-height: 60px`, except the spacer and a collapsed block (0, `:3134-3136`, `:3165-3168`).
  - Greeting, clock and random note become inline-size containers, like pomodoro and voice (`:3159-3164`): with size containment they had no intrinsic height and sat at the 60px floor.
  - The HTML block's document frame takes `height: var(--hp-iframe-height, 150px)`, which `HtmlBlock` sets to the document's height, unscaled, and refits only when the frame's width changes (a refit on its own height change grew it on every round); video embeds keep `aspect-ratio: 16 / 9` (`:2268-2279`).
  - Pomodoro and voice drop the absolute `.block-content` positioning they use in the grid (`:3547-3551`). They become inline-size containers, with a 100px ring (`:3074-3076`) and a 56px mic (`:1415-1417`). Buttons get a 44px min-height.
- **Order:** DOM order becomes visual order, so items are put in `(y, x)` order: at init (`GridLayout.ts:490`) and when narrowing (`ResponsiveColumns.ts:208`). `orderChildren` (`src/grid/domOrder.ts`) moves only the items out of place and leaves the longest run already in order where it is, so an iframe that stays put is not reloaded (a playing video kept playing).
- **Narrow and mobile tweaks:**
  - ≤540px: `gap: 8px; padding: 8px` (`:3150-3153`). This literal replaces `--hp-padding`.
  - `.is-mobile`: `gap: 6px` plus bottom safe-area padding (`:3787-3790`).
- **Auto-height after narrowing.** When the view narrows to 2 or 3 columns, `ResponsiveColumnsManager` asks every auto-height block to measure again at the new width, since the column change cancelled the measurements queued by the render. One column is sized by this CSS and needs no measurement (`ResponsiveColumns.ts:192-201`).

## 10. Button Grid custom CSS allowlist

`customCss` is a Button Grid config string. It is edited in a full-width textarea `.hp-custom-css-textarea` (`maxLength = 4096`, with an example placeholder; `src/blocks/ButtonGridBlock.ts:81-94`; styled at `styles.css:3374-3406`).

`applyBlockStyling` parses it (`parseAllowlistedCustomCss`, `blockStyling.ts:63-81`):

1. Strip `/* … */` comments.
2. Split on `;`. Split each part at the first `:` and trim both sides.
3. Drop the pair if the key or value is empty, if the key fails `^--hp-btn-[a-z0-9-]+$` (lowercase only, `:52`), if the value matches `\b(?:url|image|image-set|cross-fade|element|paint)\s*\(` (case-insensitive, `:58`), or if the value contains a `\p{Cc}` control character (`:77`).
4. Apply each surviving pair with `el.style.setProperty(key, value)` on the **card**, not on `cssText`, so other inline properties survive. Record the keys in `data-hp-custom-css-keys`, and remove the previous keys first (`:93-106`).

The values cascade from the card to `.button-grid .grid-btn`. Only these 14 names are read (`styles.css:1525-1569`); any other `--hp-btn-*` passes the filter but has no effect:

| Property | Fallback | Applies to |
|---|---|---|
| `--hp-btn-bg` | `var(--background-primary)` | `background` |
| `--hp-btn-border` | `1px solid var(--background-modifier-border)` | `border` |
| `--hp-btn-radius` | `var(--radius-m, 8px)` | `border-radius` |
| `--hp-btn-padding` | `8px 12px` | `padding` |
| `--hp-btn-color` | `var(--text-normal)` | `color` |
| `--hp-btn-shadow` | `none` | `box-shadow` |
| `--hp-btn-gap` | `6px` | gap between emoji and label |
| `--hp-btn-hover-bg` | `var(--background-modifier-hover)` | hover `background` |
| `--hp-btn-hover-border-color` | `var(--background-modifier-border-hover, …)` | hover `border-color` |
| `--hp-btn-hover-transform` | `translateY(-1px)` | hover `transform` |
| `--hp-btn-hover-shadow` | `0 2px 6px rgba(0,0,0,.06)` | hover `box-shadow` |
| `--hp-btn-active-transform` | `translateY(0) scale(0.98)` | `:active` `transform` |
| `--hp-btn-active-shadow` | `none` | `:active` `box-shadow` |
| `--hp-btn-emoji-size` | `1rem` | `.grid-btn-emoji` `font-size` |

Lifecycle:
- Deliberately absent from `defaultConfig` (`src/main.ts:78-80`).
- Stripped on export (`HomepageSettingTab.ts:376-383`) and on import (`importSanitizer.ts:10`).
- Deleted at load from every block type other than `button-grid` (`src/validation.ts:202-208`).

A layout can therefore only carry `customCss` through the user's own input or a hand-edited or synced `data.json`. The comment at `blockStyling.ts:49-51`, which still names "an imported layout" as the source, predates the import strip.

Notes:
- The same 14 names can be set by a snippet on any ancestor as a vault-wide default (§13, example D). Per-block `customCss` wins, because it is declared on the card.
- `setProperty` is called without a priority argument. **(inferred)** A value that ends in `!important` is therefore rejected by CSSOM and silently ignored.
- **Unverified:** the value filter matches literal function names. CSS escapes such as `u\rl(` are not normalised before the test. Whether Chromium would then fetch a resource from such a value has not been tested.

## 11. State classes set from TypeScript

| Class | Element | Set by | CSS |
|---|---|---|---|
| `homepage-no-scrollbar` | `.homepage-view` | `HomepageView.ts:33`; live `HomepageSettingTab.ts:316` | `:371-382` hides the scroll bar of the view and of its `.homepage-grid` only. Scrolling regions inside blocks (§1, the scrolling height modes) keep theirs, because without one nothing shows that they hold more content. |
| `homepage-hover-highlight` | `.homepage-view` | `HomepageView.ts:34`; live `HomepageSettingTab.ts:343` | `:170-178`, `:2490-2496` |
| `hp-toolbar-open` | `.homepage-view` | `EditToolbar.ts:141` | `:2288-2297` (view scrolls, grid gets `margin-top: 12px`) |
| `is-visible` / `is-hidden` | toolbar / FAB | `EditToolbar.ts:137-138` | toolbar sticky at top with accent bottom border. The hidden toolbar also carries the `inert` attribute (`:141`), so its controls leave the Tab order |
| `edit-mode` | grid | `GridLayout.ts:159-161` | resize handles, dashed card border, compact placeholders, handle bar (`:2561-2706`). The handle bar wraps its controls (`flex-wrap: wrap`, `:2707`) instead of clipping them on a narrow card |
| `homepage-grid--animating` | grid | `GridLayout.ts:152-154`, removed by a 500 ms timeout and in `teardown` (`:411`), so a later render does not replay it | `hp-card-enter` 0.3s with `--hp-card-anim-delay` (`:155-158`) |
| `hp-single-column` | grid | `GridLayout.ts:457` (view mode only), `ResponsiveColumns.ts:128` | §9 |
| `hp-dragging` | grid | `GridLayout.ts:502, 506` | siblings at opacity 0.5 (`:2710-2713`) |
| `hp-zoomed` + `viewport-fit` | grid | `GridLayout.setZoom`/`applyZoom` (`GridLayout.ts:322-345`); re-applied after an edit-mode re-render | `transform: var(--hp-grid-transform)` (`:3819-3823`), `overflow: visible` (`:2557-2559`) |
| `is-auto-height` | `.grid-stack-item` | `GridLayout.ts:563-565` | edit mode hides the `s`/`se` handles (`:2574-2577`) |
| `block-just-added` | card | `GridLayout.ts:529-531`, removed on `animationend` | `hp-block-appear` 0.4s (`:3345-3358`), played once |
| `block-collapsed` / `is-collapsed` | card / chevron | `BlockWrapper.ts:26, 43` (only for a block `isCollapsible` accepts, §5.3); `CollapseToggle.ts:55-56` | `.block-content` animates `grid-template-rows` 1fr→0fr (`:2591-2621`) |
| `hp-header-empty` | header zone | `BlockWrapper.ts:41`, `BaseBlock.ts:75`, `BlockWrapper.ts:88` | height 0 (`:2533-2539`) |
| `block-accented`, `block-bright-accent`, `block-dark-accent`, `hp-plain-header-light`/`-dark`, `hp-plain-accent-light`/`-dark`, `hp-dark-on-accent`, `block-no-header-accent`, `block-no-border`, `block-no-background`, `block-elevation-N`, `block-custom-opacity`, `block-has-gradient` | card | `applyBlockStyling` | §5–§7 |
| `voice-mic--push` | voice mic | push-to-talk mode (`VoiceDictationBlock.ts`) | `touch-action: none` (`:1300-1302`), so a slight pan does not cancel the hold |
| `hp-visually-hidden` | Vault search live region | `VaultSearchBlock.ts` | clipped to 1px, read by screen readers only (`:4005-4012`) |
| `hp-no-transition`, `hp-auto-rows` | `.block-content` | `src/grid/AutoHeight.ts:126-137` (while measuring) | `!important` (`:3828-3829`) |
| `hp-hidden` | various | e.g. `BlockSettingsModal.ts:78-84` | `display: none` (`:3816`) |

Collapse notes:
- The chevron of an expanded block has opacity 0 unless `homepage-hover-highlight` is on and the card is hovered (`:2563-2588`). A collapsed block always shows its chevron, with or without hover highlight (`:2582-2584`).
- The header zone is a `div[role=button]` only while it shows a header (§5.3). It has its own focus ring, `.block-header-zone[role="button"]:focus-visible`, as do the Embedded note content and other `[role=region][tabindex=0]` scroll regions inside `.homepage-view` (`:4032-4039`). The other plugin focus rings target `button`, `select`, `input` and `textarea` inside `.homepage-view` (`:2631-2644`).

The Static Text pencil button (`.static-text-edit-btn`) is hidden (opacity 0) until the block is hovered. It also turns visible on `:focus-visible`, so a keyboard user who tabs onto it sees it (`styles.css:2064-2067`). On the mobile app it stays at opacity 0.6, and edit mode hides it (`:2069-2081`).

## 12. Surfaces outside `.homepage-view`

The `.homepage-view` focus rings and the reduced-motion rule (`.homepage-view, .homepage-view *`, `:3796-3813`) do not reach elements mounted elsewhere. The tokens reach only the block settings modal, which declares them too (§3):

| Surface | Mounted on | Consequence (inferred unless noted) |
|---|---|---|
| Block settings modal, incl. preview card `div.settings-preview-card.homepage-block-wrapper` (`BlockSettingsModal.ts:68-76`) | Obsidian modal | The tokens are declared on `.hp-block-settings-modal` (`styles.css:8-36`), so the preview shows the default card padding and the elevation shadows. A snippet value on `.homepage-view` does not reach it. The swatch focus ring promised at `BlockSettingsModal.ts:332-333` is scoped to `.homepage-view` (`styles.css:2632`). The reorder grips of settings lists are `button.drag-grip` with the button chrome removed (`:4023-4030`) |
| Add Block `SuggestModal` | Obsidian modal | `--hp-space-*` fallbacks apply (same values) |
| Gallery lightbox | `doc.body` (`ImageGalleryBlock.ts:45`) | `@media (max-width: 600px)` instead of container queries (`:1951-1952`). Its Close button `.gallery-lightbox-close` sits top right (`:4015-4020`) |
| Vault-search dropdown | `el.doc.body` (`VaultSearchBlock.ts:62`) | positioned by inline `--hp-search-dropdown-*` |
| HTML block iframe (HTML containing `<style>`) | `srcdoc` iframe | each `var(--x)` referenced in the HTML is resolved against `getComputedStyle(doc.body)` and copied to the iframe's `:root` (`HtmlBlock.ts:54-81`, verified in code). `--hp-*` tokens and the accent overrides on a card are therefore not visible inside the iframe; theme variables are. The bridge stylesheet gives the iframe's `body` `display: flow-root`, so a first child's top margin stays inside it. See [blocks](blocks.md) |

## 13. Worked snippet examples

Save as `.obsidian/snippets/homepage.css` and enable the snippet in Appearance. Each example states the selector reasoning and where the plugin still wins.

**A. Layout tokens (desktop and mobile)**

```css
body .homepage-view {
  --hp-content-max-width: 1800px;
  --hp-padding: 24px;
  --hp-card-padding: 16px;
}
body.is-mobile .homepage-view {
  --hp-padding: 8px;
  --hp-card-padding: 12px;
}
```

- `body .homepage-view` (0,1,1) outranks the declaration on `.homepage-view` (0,1,0) and, on the mobile app, `:where(.is-mobile) .homepage-view` (0,1,0). The second rule is needed only for values that differ on mobile.
- `body.is-mobile .homepage-view` (0,2,1) applies only on the mobile app.
- Still overridden by:
  - the literal grid padding at ≤540px in single-column mode (8px) and at ≤380px outside single-column mode (4px)
  - on the mobile app, the literal single-column bottom padding (`styles.css:3787-3790`)
  - any block with `_cardPadding` ≠ 0
- `--hp-card-padding` applies at every width: the plugin's narrow-pane and mobile values are only `--hp-card-padding-default`, its fallback (§2).

**B. Card shape, vault-wide (including square corners)**

```css
body .homepage-view {
  --hp-border-radius: 0;
  --hp-border-width: 2px;
  --hp-border-style: dashed;
  --hp-title-gap: 4px;
}
```

- None of these is declared by the plugin, so `:root` would work too.
- `0` is a real value here, unlike `_borderRadius: 0`, which means "theme default".
- Per-block `_borderRadius`/`_borderWidth`/`_borderStyle`/`_titleGap` still win. Edit mode still draws its own dashed border.

**C. Elevation scale**

```css
body .homepage-view {
  --hp-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.12);
  --hp-elevation-2: 0 6px 16px rgba(0, 0, 0, 0.18);
  --hp-elevation-3: 0 14px 36px rgba(0, 0, 0, 0.24);
}
```

- Affects only blocks whose Elevation setting is Subtle, Medium or Elevated.
- The shadow stays when the block's border is hidden, hovered or not (§7). With the border shown and hover highlight on, the hover shadow replaces it while hovered.
- The block settings preview uses the plugin defaults, not these values: it sits outside `.homepage-view` (§12).

**D. Vault-wide "ghost" Button Grid buttons**

```css
body .homepage-view {
  --hp-btn-bg: transparent;
  --hp-btn-border: 1px solid transparent;
  --hp-btn-hover-bg: var(--background-modifier-hover);
  --hp-btn-hover-border-color: transparent;
  --hp-btn-hover-transform: none;
  --hp-btn-hover-shadow: none;
}
```

A block's own `customCss` overrides any of these per property.

**E. Per-block `customCss` (Button Grid → Content tab → Custom CSS)**

```text
--hp-btn-radius: 999px;
--hp-btn-padding: 6px 14px;
--hp-btn-bg: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
--hp-btn-hover-bg: color-mix(in srgb, var(--interactive-accent) 22%, transparent);
--hp-btn-emoji-size: 1.25rem;
```

- Only `--hp-btn-*` declarations survive the allowlist. Declarations only, no selectors or braces.
- **(inferred)** `var(--interactive-accent)` is substituted on the card. On an accented block that is the darkened accent (§6).

**F. Flat cards for one block type (view mode only)**

```css
.homepage-grid:not(.edit-mode) .homepage-block-wrapper.hp-block-clock,
.homepage-grid:not(.edit-mode) .homepage-block-wrapper.hp-block-greeting {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
```

- Specificity is (0,4,0). That beats every view-mode background, border and shadow rule on the card, including `.block-custom-opacity.block-accented` (0,3,0) and the hover-highlight shadow (0,3,0), except those it ties with. `.block-no-border.block-accented:hover` and `.block-no-background.block-accented:hover` (0,4,0, `:403`, `:421`) set the same transparent/none values. `.block-no-border.block-elevation-N:hover` (0,4,0, `:411-416`) sets a shadow, so the result for a hovered block with a hidden border and an Elevation depends on stylesheet order. A gradient with opacity below 100 is painted by a `::before` layer (§7), which this snippet does not remove; add `::before { display: none }` for that case.
- `:not(.edit-mode)` leaves the edit-mode dashed border alone.
- Use the wrapper classes from §1 (`hp-block-bookmarks`, `hp-block-voice-dictation`, …).

**G. One specific block**

```css
.homepage-block-wrapper[data-block-id="PASTE-ID-HERE"] .block-header {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

- The id is the card's `data-block-id` attribute (`BlockWrapper.ts:27`); read it in DevTools. Ids come from `crypto.randomUUID()`, with an `hp-<random><time>` fallback (`src/utils/ids.ts::newId`).
- (0,3,0) beats `.block-header` (0,1,0).

**H. Always-visible collapse chevron**

```css
.homepage-view .block-collapse-chevron { opacity: 0.5; }
```

- Shows a dimmed chevron on expanded blocks too, with or without hover highlight. A collapsed block already shows it at full opacity (`.block-collapse-chevron.is-collapsed`, (0,2,0), `styles.css:2582-2584`, which this (0,2,0) rule overrides if the snippet loads later; add `.homepage-view .block-collapse-chevron.is-collapsed { opacity: 1; }` to keep it).
- With hover highlight on, the plugin's hover rule (0,4,0, `styles.css:2586-2588`) still raises it to 1.
- Edit mode keeps it hidden. A header hidden with `_showTitle: false` has zero height, so no chevron shows there either.

**I. Default quote font**

```css
body .homepage-view {
  --hp-quote-font: "Iowan Old Style", Georgia, serif;
}
```

Applies to Quotes blocks whose font style is Default and that have no custom font. A preset class or an inline font on the block wins (`styles.css:1713-1720`, `QuotesListBlock.ts:132`).

**J. Disable the card entry animation**

```css
.homepage-view .homepage-grid--animating .homepage-block-wrapper {
  animation: none;
}
```

(0,3,0) beats `.homepage-grid--animating .homepage-block-wrapper` (0,2,0, `styles.css:149`).

**What does not work from a snippet:**
- `--hp-padding` on `:root` or `body`: shadowed by the `.homepage-view` declaration. (`--hp-card-padding` is not declared by the plugin, so it works there too, §2.)
- `.homepage-grid { padding }` without extra specificity: the plugin's `.homepage-grid.grid-stack` (0,2,0) wins.
- `.homepage-block-wrapper { padding }` without extra specificity: it ties at (0,1,0) with the plugin's card padding rule (`:132`), so the result depends on stylesheet order, which this repo does not control.
- Tinting cards through `--block-accent` alone: the `block-accented` class comes only from `_accentColor`.

## 14. Drift and known gaps

For maintainers. Each item was checked against the code on disk.

1. The ≥1200px padding rule never applies (§8).
2. Resolved (M102): the cell's `overflow: visible` now outranks GridStack's rule in view mode too (§1), so card shadows are no longer clipped.
3. The elevation-token comment (`styles.css:30-31`) says they drive "every transient shadow (hover, drag, popovers)". Only drag and the elevation presets use them; hover (`:177`), the search dropdown (`:1111`), button hover (`:1559`) and the active toolbar button (`:2411`) use literal shadows. The "prefer these over ad-hoc literals" note (`:15-16`) covers tokens that are unused (§3).
4. The comment "sized from the block wrapper" (`styles.css:1747-1748`) is wrong. The gallery's query container is `.block-content.image-gallery-block` (`:1749-1751`).
5. The `oklch` mix at `:1013` contradicts the srgb rationale at `:184`.
6. "Lifts" (settings description, README, CLAUDE.md) and "opt-in" (`styles.css:169`) misdescribe hover highlight (§7).
7. CLAUDE.md calls the `BlockWrapper.ts` helpers "pure DOM builders". In fact `removeSkeleton` schedules a timer (`:71`) and `renderEmptyState` attaches a click listener (`:115`).
8. `homepage-grid--animating` is removed at 500 ms (`GridLayout.ts:145`). The delays are 0, 50, 100, 140, 170, 195, 215, 230 ms, then 240 ms for every later card (`GridLayout.ts:486`), so from the seventh card on (215 ms delay + 300 ms animation = 515 ms) a card is still animating then and snaps to its final state. **(inferred)**
9. **(inferred)** `.block-accented.block-no-header-accent .block-header-zone` (0,3,0) outranks `.hp-header-empty` (0,2,0) on padding. An accented block with a hidden title and the header bar off therefore keeps 2px + 2px of header-zone padding. Every block with a hidden title also keeps one `--hp-title-gap` above its content, because the zero-height zone is still a flex item of the card (`styles.css:132-134`).
10. Resolved (M109): the skeleton overlay takes the card's own background (`background: inherit`, `:662`), so accented, translucent and gradient cards keep their look while loading.
11. The accent-swatch focus ring promised by the comment at `BlockSettingsModal.ts:332-333` does not exist in the modal: the button focus ring is scoped to `.homepage-view` (`styles.css:2632`).
