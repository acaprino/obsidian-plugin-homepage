# Phase 3b -- Documentation Review

Reviewed: CLAUDE.md (developer guide), README.md (user-facing), manifest.json, package.json,
inline source comments across all 31 TypeScript files.

---

## 1. README.md Accuracy Issues

### 1.1 Block count mismatch (Severity: Medium)

README says "15 native block types" (line 3) and lists 15 blocks in the table.
The actual `BLOCK_TYPES` array in `src/types.ts` contains **16 types** -- the `voice-dictation`
block is missing from README entirely.

`manifest.json` correctly says "16 native block types".

**Recommendation:** Add voice-dictation to the README block table and update the count to 16.

### 1.2 Startup open mode description inaccurate (Severity: Low)

README Settings table describes Startup open mode as "How the homepage opens on startup
(replace active tab, new tab, or sidebar)". The actual `OpenMode` values are
`'replace-all'`, `'replace-last'`, and `'retain'` -- none of them open in a sidebar.
The `replace-all` mode closes **all** tabs, not just the active one. The `retain` mode
opens a new tab while keeping existing ones.

**Recommendation:** Update the description to match actual behavior:
"replace all tabs, replace active tab, or keep existing tabs (new tab)".

### 1.3 Manual open mode description says "sidebar" (Severity: Low)

Same issue as above -- README says "(replace, new tab, or sidebar)" but no sidebar mode exists.

**Recommendation:** Correct to match actual `OpenMode` values.

---

## 2. CLAUDE.md Accuracy Issues

### 2.1 Shared config keys list is incomplete (Severity: Medium)

The Block Settings Flow section lists these shared `_`-prefixed config keys:
`_titleLabel, _titleEmoji, _hideTitle, _titleSize, _showDivider, _hideBorder,
_hideBackground, _hideHeaderAccent, _cardPadding, _accentColor`

But `src/utils/blockStyling.ts` actually applies these additional config keys that are
**not documented** in CLAUDE.md:
- `_accentIntensity` (number, 5-100)
- `_titleGap` (number, 0-48)
- `_elevation` (number, 0-3)
- `_borderRadius` (number, 0-24)
- `_bgOpacity` (number, 0-100)
- `_backdropBlur` (number, 0-20)
- `_gradientStart` (hex color)
- `_gradientEnd` (hex color)
- `_gradientAngle` (number, 0-360)
- `_borderWidth` (number, 0-4)
- `_borderStyle` ('solid' | 'dashed' | 'dotted')

These 11 undocumented styling properties are actively used and make up the "Advanced"
card styling section visible to users.

**Recommendation:** Add the complete list of shared `_`-prefixed config keys to CLAUDE.md
Block Settings Flow section, grouped by category (Title, Accent, Card, Advanced).

### 2.2 Auto-height block list is slightly misleading (Severity: Low)

CLAUDE.md says auto-height is "Currently used by: `image-gallery`, `quotes-list` (extend mode),
`embedded-note` (grow mode), `static-text`, `button-grid`, `random-note`."

Actual `shouldAutoHeight()` in GridLayout.ts (line 426-436):
- `image-gallery`: returns true unless `heightMode === 'fixed'` (default = auto, so **always on** unless explicitly set to fixed)
- `quotes-list`: only when `heightMode === 'extend'`
- `button-grid`: **always** true (unconditional)
- `embedded-note`: only when `heightMode === 'grow'`
- `static-text`: returns true unless `heightMode === 'fixed'` (default = auto, so **always on** unless explicitly set to fixed)
- `random-note`: **always** true (unconditional)

The documentation is technically correct but could be clearer about which blocks have
auto-height on by default vs opt-in.

**Recommendation:** Annotate each block with whether auto-height is default-on (image-gallery,
button-grid, static-text, random-note) vs opt-in (quotes-list, embedded-note).

### 2.3 Live Reactivity table missing vault.on('modify') handler for QuotesList (Severity: Low)

CLAUDE.md lists `vault.on('modify')` handlers for EmbeddedNote and RecentFiles only.
Need to verify whether QuotesList also watches modify events.

Checked: QuotesList uses `metadataCache.on('changed')` rather than `vault.on('modify')`,
so the documentation is **correct** on this point.

### 2.4 Responsive grid documentation missing (Severity: Medium)

CLAUDE.md mentions `responsiveGrid.ts` in the utils list but does not explain the responsive
column reduction system. The file `src/utils/responsiveGrid.ts` uses CSS `auto-fill` with
`minmax()` to collapse columns on narrow containers. GridLayout also has a `ResizeObserver`-based
responsive system that reduces effective columns when the container width drops below thresholds.

The `effectiveColumns` / `userColumns` distinction in GridLayout (lines 28-29) is never
explained in any documentation, yet it drives the responsive behavior that prevents
layout corruption when the grid narrows.

**Recommendation:** Add a "Responsive Grid" subsection to CLAUDE.md Architecture section
explaining the dual responsive system (CSS auto-fill for inner block grids, GridStack
column reduction for the main grid).

### 2.5 Missing documentation for collapse/expand system (Severity: Low)

CLAUDE.md does not document the collapse/expand feature (`collapsed`, `_expandedH` fields
on BlockInstance, `setupCollapseToggle` in GridLayout). README mentions "Collapsible blocks"
as a feature but no developer docs exist.

**Recommendation:** Add a brief Collapse section to CLAUDE.md Architecture documenting
the data model (`collapsed`, `_expandedH`) and the toggle mechanism.

---

## 3. Security Documentation Gaps

### 3.1 API key plaintext storage warning is minimal (Severity: High)

CLAUDE.md has a single line in "What NOT to Do": "Do not store secrets in block config --
API keys in `data.json` are plaintext."

The VoiceDictation settings modal does include a per-field warning: "Stored in plaintext
in your vault data folder." However:

1. **No user-facing README warning** about API key storage risks.
2. No documentation about what `export layout` strips (it removes `apiKey` fields but
   this is only visible in the code at `main.ts` line 632-634).
3. No guidance for users on securing their vault data folder when API keys are configured.

**Recommendation:**
- Add a Security section to README warning users that API keys are stored unencrypted.
- Document the export-strips-apiKey behavior in both CLAUDE.md and README.
- Consider adding a note about vault sync services (iCloud, Dropbox) potentially
  exposing the `data.json` file.

### 3.2 HtmlBlock sanitization not documented for users (Severity: Medium)

The HTML block uses `sanitizeHTMLToDom()` with a regex-based pre-strip of dangerous tags
(iframe, object, embed, form, meta, link, base, script, style, svg). This defense-in-depth
approach is commented in the source code but:

1. README just says "Custom HTML (sanitized)" with no detail on what's stripped.
2. CLAUDE.md says "use `sanitizeHTMLToDom`" in the What NOT to Do section but doesn't
   document the additional regex pre-strip in HtmlBlock.
3. No documentation of the security rationale (Electron context can bypass some
   DOMPurify-style sanitization).

**Recommendation:** Add a Security Considerations section to CLAUDE.md documenting:
- The two-layer sanitization in HtmlBlock (regex pre-strip + sanitizeHTMLToDom).
- The Electron context concern that motivates the regex pre-strip.
- The list of blocked tags.

### 3.3 VideoEmbed iframe security not documented (Severity: Medium)

VideoEmbedBlock has a well-commented security invariant about `allow-same-origin + allow-scripts`
sandbox and an `ALLOWED_EMBED_HOSTS` allowlist. This security design decision is only
documented in inline comments -- not in CLAUDE.md or README.

**Recommendation:** Add to CLAUDE.md Architecture a brief note about the VideoEmbed
iframe security model (host allowlist, sandbox attributes, referrerpolicy).

### 3.4 VoiceDictation folder path not validated for traversal (Severity: Medium)

`VoiceDictationBlock.saveNote()` (line 176-198) builds a file path from user-configured
`folder` without sanitizing for path traversal. A user could theoretically configure
`folder` as `../../.obsidian/plugins` and create files outside the intended directory.

Obsidian's `vault.create()` API may reject paths outside the vault root, providing
implicit protection, but this is not documented or explicitly tested.

The `SAFE_ID_RE` validation in `main.ts` only applies to block IDs, not folder paths.

**Recommendation:** Document the path traversal risk in CLAUDE.md. Consider adding
explicit path validation (rejecting `..` segments) in VoiceDictation and ImageGallery
folder configs.

---

## 4. Inline Documentation Quality

### 4.1 Well-documented areas

- **BaseBlock.ts**: Good JSDoc comments on all public/protected methods explaining purpose,
  usage patterns, and cleanup semantics.
- **HtmlBlock.ts**: Clear "Defense-in-depth" comment explaining the regex pre-strip rationale.
- **VideoEmbedBlock.ts**: Thorough security invariant comment at the iframe creation point.
- **blockStyling.ts**: Section headers break up the long styling function for readability.
- **GridLayout.ts**: Key algorithmic decisions (e.g., "Build widget items WITHOUT content --
  DOM will be built manually using Obsidian API") are explained.
- **esbuild.config.mjs**: Clean and self-explanatory.
- **main.ts**: `validateLayout()` and `migrateBlockInstance()` are well-structured with
  clear intent.

### 4.2 Under-documented areas (Severity: Low-Medium)

| File | What's missing |
|------|---------------|
| `GridLayout.ts` | The `syncLayout()` method (line ~650-700) has complex responsive-vs-canonical logic with no high-level comment explaining the algorithm. The `effectiveColumns` vs `userColumns` distinction is not explained. |
| `responsiveGrid.ts` | Single function is well-commented but the overall responsive strategy (how CSS auto-fill interacts with GridStack column reduction) is not documented anywhere. |
| `blockStyling.ts` | The luminance-based bright accent detection algorithm (lines 40-50) has a good inline comment but the threshold value (0.18) and dark base luminance (0.05) are magic numbers that could use more explanation of how they were calibrated. |
| `EditToolbar.ts` | The discard/snapshot mechanism (lines 42-77) is clear in code but the interaction between `blocksSnapshot`, `setEditMode(false, true)`, and `skipRepack` is subtle. |
| `VoiceDictationBlock.ts` | The multipart form body construction (lines 309-328) for Whisper API is complex and uncommented beyond the surrounding code structure. |
| `ImageGalleryBlock.ts` | The lightbox module-level state (`activeLightboxAc`) and per-instance ownership (`myLightboxAc`) pattern could use a design rationale comment. |

### 4.3 Config schema documentation is absent (Severity: Medium)

No block has a formal TypeScript interface for its config shape. Most blocks use inline
type assertions like `this.instance.config as { folder?: string; columns?: number; ... }`.

Only `VoiceDictationBlock` defines a named `VoiceDictationConfig` interface.

This means developers adding new config fields or modifying existing blocks have no
single reference for what config keys each block supports, their types, and valid ranges.

**Recommendation:** Either:
- Add config interfaces to each block file (preferred), or
- Add a config schema reference table to CLAUDE.md documenting all config keys per block type.

---

## 5. README Completeness

### 5.1 No development/contributing section (Severity: Low)

README has no section for developers wanting to contribute. Build instructions are only
in CLAUDE.md. For an open-source plugin, a brief "Development" section with
`npm install && npm run dev` would be standard.

**Recommendation:** Add a minimal Development section to README pointing to build commands
or referencing CLAUDE.md for detailed developer docs.

### 5.2 No changelog or version history (Severity: Low)

No CHANGELOG.md exists. Version 1.1.2 is the current version but there's no record of
what changed between versions.

**Recommendation:** Consider adding a CHANGELOG.md following Keep a Changelog format.

### 5.3 Voice dictation feature undocumented (Severity: Medium)

The voice-dictation block is a significant feature requiring API key setup, provider
selection, and microphone permissions. It is completely absent from README:
- Not in the block table
- Not in the feature list
- No setup instructions for obtaining API keys

**Recommendation:** Add voice dictation to the README block table with a brief note about
required API key configuration. Consider a dedicated subsection given the setup complexity.

### 5.4 Screenshots may be missing (Severity: Low)

README references `screenshots/homepage-overview.png` and `screenshots/gallery-masonry.png`.
Cannot verify these exist without checking the git history, but if the screenshots directory
is not committed, the README will show broken images.

---

## 6. Cross-Document Consistency

### 6.1 manifest.json vs README block count (Severity: Low)

- `manifest.json`: "16 native block types" (correct)
- `README.md`: "15 native block types" (incorrect, missing voice-dictation)
- `CLAUDE.md`: "16 total" (correct)

### 6.2 Package.json missing lint script (Severity: Low)

`package.json` has no `lint` script despite eslint being configured as a dev dependency.
CLAUDE.md does not mention running eslint. The `eslint.config.mjs` file presumably exists
but is not referenced in build instructions.

**Recommendation:** Add `"lint": "eslint src"` to package.json scripts and mention it
in CLAUDE.md Build section.

---

## Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1.1 | README block count says 15, actual is 16 (missing voice-dictation) | Medium | Accuracy |
| 1.2 | README open mode descriptions mention nonexistent "sidebar" option | Low | Accuracy |
| 2.1 | CLAUDE.md missing 11 shared styling config keys from blockStyling.ts | Medium | Completeness |
| 2.2 | Auto-height documentation unclear on default-on vs opt-in | Low | Clarity |
| 2.4 | Responsive grid system undocumented in CLAUDE.md | Medium | Completeness |
| 2.5 | Collapse/expand system undocumented in CLAUDE.md | Low | Completeness |
| 3.1 | API key plaintext storage has no user-facing (README) warning | High | Security |
| 3.2 | HtmlBlock two-layer sanitization not documented in CLAUDE.md | Medium | Security |
| 3.3 | VideoEmbed iframe security model not in CLAUDE.md | Medium | Security |
| 3.4 | VoiceDictation folder path traversal risk undocumented | Medium | Security |
| 4.3 | No per-block config schema documentation or TypeScript interfaces | Medium | Completeness |
| 5.1 | README has no development/contributing section | Low | Completeness |
| 5.3 | Voice dictation completely absent from README | Medium | Completeness |
| 6.1 | Block count inconsistency across manifest.json and README | Low | Consistency |
| 6.2 | No lint script in package.json despite eslint being configured | Low | Completeness |
