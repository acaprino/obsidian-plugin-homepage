# Homepage Blocks developer docs

These pages document the Obsidian plugin **Homepage Blocks** as the code stands on branch `xray-remediation` after the X-ray fixes and the review-backlog fixes of 2026-10-10; line citations in sections that were not edited may be a few lines off. Every claim cites its source as `path:line`, relative to the repo root. When a comment, `CLAUDE.md` or the README says something else, the docs follow the code and list the difference.

## What each doc covers

| Doc | Covers |
|---|---|
| [architecture.md](architecture.md) | Layers, module map, import graph, runtime objects and their lifetimes, where state lives, the write funnel, build and test commands, where to add code |
| [data-model.md](data-model.md) | `LayoutConfig` and `BlockInstance` field by field, the default layout, block ids, validation and migration, load and recovery, the save chain, API keys at rest, device-local storage, and the field-level rules of export, import, copy to mobile and reset |
| [flows.md](flows.md) | Runtime sequences: startup and load, opening the homepage, rendering, edit mode (Done, Discard, one session at a time), Add Block, block settings, auto-height, responsive columns, collapse, the inline Static Text edit, export and import, and a `data.json` changed by another device |
| [blocks.md](blocks.md) | The 17 block types: config keys, rendering, live updates, auto-height, settings UI, network access, limits, test coverage |
| [styling.md](styling.md) | `styles.css`, tokens and CSS hooks, how the shared `_` keys become classes and custom properties, breakpoints and container queries, state classes, worked snippet examples |
| [api/plugin.md](api/plugin.md) | `IHomepagePlugin`, `HomepagePlugin`, the view, commands and ribbon, the settings tab, renames and external `data.json` changes, and the helper modules for validation, load recovery, encryption, import, config ranges, reset, startup, voice notes and transcription providers, timeouts, the Pomodoro timer, opening links, folder paths, renames, tags, note text and accent contrast |
| [api/blocks.md](api/blocks.md) | `BaseBlock`, `BlockFactory` and the `defaultConfig` contract, `BlockRegistry`, `BLOCK_META`, and a step-by-step guide to adding a block type |
| [api/grid.md](api/grid.md) | `HomepageView`, `GridLayout`, `Phase`, the `src/grid/*` managers, Scheduler keys, events, `EditToolbar` and the modals |

## Which doc for which task

| Task | Read |
|---|---|
| **Onboarding** | [architecture.md](architecture.md) first. Then [data-model.md](data-model.md) §1–§3 for the shape of the state, and [flows.md](flows.md) §0–§4 for how it is loaded, saved and rendered. Skim the summary table in [blocks.md](blocks.md). |
| **Adding a block type** | [api/blocks.md](api/blocks.md#adding-a-new-block-type): the steps and the checklist. Use [blocks.md](blocks.md#conventions-shared-by-all-blocks) and the closest existing block as a model, [styling.md](styling.md) for the wrapper classes and tokens, and [architecture.md](architecture.md#8-where-to-add-code) for the other places a change can touch. |
| **Changing persistence** (a `LayoutConfig` field, validation, migration, the save chain, `data.json`, API keys) | [data-model.md](data-model.md): [§6](data-model.md#6-validation-and-migration) validation and migration, [§7](data-model.md#7-load-path-and-recovery) load and recovery, [§8](data-model.md#8-save-chain) the save chain, [§9](data-model.md#9-api-keys-at-rest) API keys. The contracts of `saveLayout` and `updateBlockConfig` are in [api/plugin.md](api/plugin.md) §2, the write paths in [architecture.md](architecture.md#6-the-write-funnel) §6 and [flows.md](flows.md) §0. |
| **Theming** (CSS snippets, tokens, the shared `_` keys) | [styling.md](styling.md), [§13](styling.md#13-worked-snippet-examples) for ready snippets. Stored types and ranges of the `_` keys are in [data-model.md](data-model.md) §3.2; the settings-modal controls that edit them are in [api/grid.md](api/grid.md) §16.1. |
| **Debugging a flow** | The matching section of [flows.md](flows.md), including its "Observed" notes. Then [api/grid.md](api/grid.md) for phase gates (§4), Scheduler keys (§13), events (§14) and [risks](api/grid.md#19-risks-observed-in-the-code) (§19); [api/plugin.md](api/plugin.md#8-device-state-notices-and-log-lines) §8 for Notices and console lines; and the "Limits" of the block involved in [blocks.md](blocks.md). |

## Where known gaps are recorded

Each doc lists where comments, `CLAUDE.md` or the README disagree with the code, and the defects seen while reading it:

- [data-model.md §12](data-model.md#12-code-comments-that-disagree-with-the-code)
- [blocks.md, Known defects and doc drift](blocks.md#known-defects-and-doc-drift)
- [styling.md §14](styling.md#14-drift-and-known-gaps)
- [api/plugin.md §9](api/plugin.md#9-where-comments-and-claudemd-disagree-with-the-code)
- [api/blocks.md, Pitfalls](api/blocks.md#pitfalls-in-the-current-code) and [disagreements](api/blocks.md#where-comments-and-claudemd-disagree-with-the-code)
- [api/grid.md §18](api/grid.md#18-where-docs-and-comments-disagree-with-the-code) and [§19](api/grid.md#19-risks-observed-in-the-code)

The full list of defects found by the multi-agent code review of 2026-09-27 (127 defects, M1-M127, with a "Fix first" list; its status line records which are fixed) is in [reviews/2026-09-27-code-review.md](reviews/2026-09-27-code-review.md).

Statements marked *inferred* or *derived* follow from the code or the CSS cascade and were not observed in a running Obsidian.
