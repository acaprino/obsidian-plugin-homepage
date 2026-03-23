# Phase 3a: Testing Strategy & Coverage Review

**Plugin:** Homepage Blocks (Obsidian Plugin)
**Date:** 2026-03-21
**Branch:** develop
**Source files:** 31 TypeScript files across `src/`, `src/blocks/`, `src/utils/`

---

## Executive Summary

**The project has zero automated tests.** There is no test framework installed, no test runner configured, no test files, and no CI pipeline. The `package.json` contains only `build` and `dev` scripts -- no `test` script exists. The only quality gate is `npx tsc --noEmit` (type-checking) and ESLint with `eslint-plugin-obsidianmd`.

This means every code path -- including security-critical HTML sanitization, layout validation/migration, data persistence, and API key handling -- is verified only through manual testing. For a plugin with 16 block types, complex state management, and external API integrations, this represents a significant risk.

---

## 1. Current Test Infrastructure

| Aspect | Status |
|--------|--------|
| Test framework | **None** -- no jest, vitest, mocha, or any runner |
| Test files | **None** -- zero `.test.ts`, `.spec.ts`, or `__tests__/` directories |
| Test script in package.json | **Missing** |
| CI/CD pipeline | **None detected** |
| Coverage tooling | **None** |
| Snapshot testing | **None** |
| E2E / integration testing | **None** |
| Type checking | `npx tsc --noEmit` (manual, not in CI) |
| Linting | ESLint with obsidianmd plugin (manual) |

**Severity: Critical** -- The entire codebase is at 0% automated test coverage.

---

## 2. Testability Analysis

### 2.1 Highly Testable (Pure Functions / Minimal Dependencies)

These modules have pure or near-pure functions that can be unit tested immediately with no mocking:

| Module | Functions | Complexity |
|--------|-----------|------------|
| `src/main.ts` | `validateLayout()`, `migrateBlockInstance()`, `isValidBlockInstance()`, `isOpenMode()`, `getDefaultLayout()` | High -- many branches, migration paths |
| `src/utils/tags.ts` | `cacheHasTag()` | Medium -- frontmatter variations |
| `src/utils/noteContent.ts` | `parseNoteInsight()` | Low |
| `src/utils/blockStyling.ts` | `applyBlockStyling()`, `HEX_COLOR_RE`, luminance calculations | High -- many config permutations |
| `src/utils/responsiveGrid.ts` | `responsiveGridColumns()` | Low |
| `src/BlockRegistry.ts` | `register()`, `get()`, `getAll()`, `clear()` | Low |

### 2.2 Testable with Mocking

These require mocking Obsidian APIs (`App`, `vault`, `metadataCache`, `workspace`):

| Module | What to test | Mock complexity |
|--------|-------------|-----------------|
| `src/utils/tags.ts` | `getFilesWithTag()`, tag cache TTL/invalidation | Medium |
| `src/blocks/HtmlBlock.ts` | Sanitization regex bypass | Medium (needs `sanitizeHTMLToDom` mock) |
| `src/blocks/EmbeddedNoteBlock.ts` | Rename handler config update, grow mode | High |
| `src/blocks/VoiceDictationBlock.ts` | Stream cleanup, state machine | High (MediaRecorder mock) |
| `src/blocks/BaseBlock.ts` | `scheduleRender`, `nextGeneration`/`isStale`, `renderHeader` | Medium |

### 2.3 Hard to Unit Test (Tight DOM/GridStack Coupling)

| Module | Why |
|--------|-----|
| `src/GridLayout.ts` | Deeply coupled to GridStack instance, DOM manipulation, event listeners |
| `src/EditToolbar.ts` | Heavy DOM + modal interaction |
| `src/HomepageView.ts` | Obsidian `ItemView` subclass |

---

## 3. Critical Untested Code Paths

### 3.1 [CRITICAL] HtmlBlock XSS Sanitization Bypass

**File:** `src/blocks/HtmlBlock.ts:25-26`

The regex-based tag stripping is the primary defense against XSS in the Electron context. It is completely untested.

**What is untested:**
- Regex bypass via case variation, whitespace, null bytes
- Nested/obfuscated tags (`<scr<script>ipt>`)
- Event handler attributes on allowed tags (`<img onerror="...">`)
- SVG-based XSS vectors
- The interaction between regex stripping and `sanitizeHTMLToDom`

**Recommended tests:**

```typescript
// tests/blocks/HtmlBlock.test.ts
import { describe, it, expect } from 'vitest';

// Extract the regex for isolated testing
const DANGEROUS_TAGS_RE = /<\/?\s*(iframe|object|embed|form|meta|link|base|script|style|svg)\b[^>]*>/gi;

function stripDangerousTags(html: string): string {
  return html.replace(DANGEROUS_TAGS_RE, '');
}

describe('HtmlBlock dangerous tag stripping', () => {
  it('strips basic script tags', () => {
    expect(stripDangerousTags('<script>alert(1)</script>'))
      .toBe('alert(1)');
  });

  it('strips script tags with attributes', () => {
    expect(stripDangerousTags('<script src="evil.js"></script>'))
      .toBe('');
  });

  it('strips iframe tags', () => {
    expect(stripDangerousTags('<iframe src="evil.html"></iframe>'))
      .toBe('');
  });

  it('strips SVG tags (potential XSS vector)', () => {
    expect(stripDangerousTags('<svg onload="alert(1)"><circle/></svg>'))
      .toBe('<circle/>');
  });

  it('is case-insensitive', () => {
    expect(stripDangerousTags('<SCRIPT>alert(1)</SCRIPT>'))
      .toBe('alert(1)');
    expect(stripDangerousTags('<ScRiPt>alert(1)</ScRiPt>'))
      .toBe('alert(1)');
  });

  it('handles whitespace in tags', () => {
    expect(stripDangerousTags('< script>alert(1)</ script>'))
      .toBe('alert(1)');
  });

  // KNOWN BYPASS: nested tags survive stripping
  it('FAILS: nested script tags bypass regex', () => {
    const result = stripDangerousTags('<scr<script>ipt>alert(1)</scr</script>ipt>');
    // This will NOT equal '' -- it reconstructs <script>alert(1)</script>
    // Demonstrates the regex approach is fundamentally flawed
    expect(result).not.toContain('<script>');  // THIS WILL FAIL
  });

  it('strips style tags', () => {
    expect(stripDangerousTags('<style>body{display:none}</style>'))
      .toBe('body{display:none}');
  });

  it('strips object/embed tags', () => {
    expect(stripDangerousTags('<object data="evil.swf"></object>')).toBe('');
    expect(stripDangerousTags('<embed src="evil.swf">')).toBe('');
  });

  it('strips form tags', () => {
    expect(stripDangerousTags('<form action="evil"><input></form>'))
      .toBe('<input>');
  });

  it('preserves safe tags', () => {
    const safe = '<div><p>Hello <strong>world</strong></p></div>';
    expect(stripDangerousTags(safe)).toBe(safe);
  });

  // Event handler bypass -- NOT caught by regex
  it('does NOT strip event handlers on allowed tags', () => {
    const payload = '<img src=x onerror="alert(1)">';
    expect(stripDangerousTags(payload)).toBe(payload);
    // sanitizeHTMLToDom is expected to catch this, but that's untested too
  });
});
```

### 3.2 [CRITICAL] Layout Validation & Migration

**File:** `src/main.ts:118-228`

`validateLayout()` and `migrateBlockInstance()` handle untrusted data from disk. A bug here can corrupt layouts or crash the plugin on startup.

**What is untested:**
- Migration from old `col/row/colSpan/rowSpan` to `x/y/w/h`
- `tag-grid` to `button-grid` type rename
- `_transparent` to `_hideBorder`/`_hideBackground` migration
- Voice dictation field renames (`whisperApiKey` -> `apiKey`)
- Button-grid column clamping
- Title to `_titleLabel` migration
- Block ID validation (`SAFE_ID_RE`)
- `MAX_BLOCKS` limit enforcement
- Column clamping (`x + w <= columns`)
- Invalid/corrupt data handling (null, undefined, missing fields, wrong types)
- Import of externally crafted JSON (attack surface)

**Recommended tests:**

```typescript
// tests/main/validateLayout.test.ts
import { describe, it, expect } from 'vitest';

// These functions would need to be exported or extracted for testing
// Currently they are module-private in main.ts

describe('migrateBlockInstance', () => {
  it('migrates col/row/colSpan/rowSpan to x/y/w/h', () => {
    const old = { id: 'test', type: 'clock', col: 2, row: 3, colSpan: 2, rowSpan: 1, config: {} };
    const result = migrateBlockInstance(old);
    expect(result.x).toBe(1);  // col - 1
    expect(result.y).toBe(2);  // row - 1
    expect(result.w).toBe(2);
    expect(result.h).toBe(1);
    expect(result.col).toBeUndefined();
    expect(result.row).toBeUndefined();
  });

  it('renames tag-grid to button-grid', () => {
    const old = { id: 'test', type: 'tag-grid', x: 0, y: 0, w: 1, h: 1, config: {} };
    expect(migrateBlockInstance(old).type).toBe('button-grid');
  });

  it('migrates _transparent to _hideBorder + _hideBackground', () => {
    const old = { id: 'test', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: { _transparent: true } };
    const result = migrateBlockInstance(old);
    const cfg = result.config as Record<string, unknown>;
    expect(cfg._hideBorder).toBe(true);
    expect(cfg._hideBackground).toBe(true);
    expect(cfg._transparent).toBeUndefined();
  });

  it('migrates whisperApiKey to apiKey for voice-dictation', () => {
    const old = {
      id: 'test', type: 'voice-dictation', x: 0, y: 0, w: 1, h: 1,
      config: { whisperApiKey: 'sk-123', whisperLanguage: 'en' },
    };
    const result = migrateBlockInstance(old);
    const cfg = result.config as Record<string, unknown>;
    expect(cfg.apiKey).toBe('sk-123');
    expect(cfg.language).toBe('en');
    expect(cfg.whisperApiKey).toBeUndefined();
  });

  it('clamps button-grid columns to 3', () => {
    const old = { id: 'test', type: 'button-grid', x: 0, y: 0, w: 1, h: 1, config: { columns: 8 } };
    const result = migrateBlockInstance(old);
    expect((result.config as Record<string, unknown>).columns).toBe(3);
  });
});

describe('isValidBlockInstance', () => {
  it('accepts valid block', () => {
    expect(isValidBlockInstance({
      id: 'test-1', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {},
    })).toBe(true);
  });

  it('rejects unknown block type', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'unknown-type', x: 0, y: 0, w: 1, h: 1, config: {},
    })).toBe(false);
  });

  it('rejects negative coordinates', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'clock', x: -1, y: 0, w: 1, h: 1, config: {},
    })).toBe(false);
  });

  it('rejects zero width/height', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'clock', x: 0, y: 0, w: 0, h: 1, config: {},
    })).toBe(false);
  });

  it('rejects unsafe block IDs', () => {
    expect(isValidBlockInstance({
      id: '../etc/passwd', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {},
    })).toBe(false);
  });

  it('rejects NaN coordinates', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'clock', x: NaN, y: 0, w: 1, h: 1, config: {},
    })).toBe(false);
  });

  it('rejects array as config', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: [],
    })).toBe(false);
  });

  it('rejects null as config', () => {
    expect(isValidBlockInstance({
      id: 'test', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: null,
    })).toBe(false);
  });
});

describe('validateLayout', () => {
  it('returns default layout for null input', () => {
    const result = validateLayout(null);
    expect(result.columns).toBe(3);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('returns default layout for array input', () => {
    expect(validateLayout([1, 2, 3]).columns).toBe(3);
  });

  it('clamps invalid column count to default', () => {
    expect(validateLayout({ columns: 99, blocks: [] }).columns).toBe(3);
    expect(validateLayout({ columns: 1, blocks: [] }).columns).toBe(3);
  });

  it('accepts valid column counts', () => {
    expect(validateLayout({ columns: 2, blocks: [] }).columns).toBe(2);
    expect(validateLayout({ columns: 5, blocks: [] }).columns).toBe(5);
  });

  it('enforces MAX_BLOCKS limit', () => {
    const blocks = Array.from({ length: 150 }, (_, i) => ({
      id: `b${i}`, type: 'clock', x: 0, y: i, w: 1, h: 1, config: {},
    }));
    const result = validateLayout({ columns: 3, blocks });
    expect(result.blocks.length).toBeLessThanOrEqual(100);
  });

  it('clamps x position so block fits within columns', () => {
    const result = validateLayout({
      columns: 3,
      blocks: [{ id: 'test', type: 'clock', x: 10, y: 0, w: 1, h: 1, config: {} }],
    });
    expect(result.blocks[0].x).toBeLessThanOrEqual(2);
  });

  it('clamps w to column count', () => {
    const result = validateLayout({
      columns: 3,
      blocks: [{ id: 'test', type: 'clock', x: 0, y: 0, w: 10, h: 1, config: {} }],
    });
    expect(result.blocks[0].w).toBe(3);
  });

  it('strips invalid blocks from array', () => {
    const result = validateLayout({
      columns: 3,
      blocks: [
        { id: 'valid', type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} },
        { id: 'invalid', type: 'nonexistent', x: 0, y: 0, w: 1, h: 1, config: {} },
        null,
        42,
      ],
    });
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].id).toBe('valid');
  });
});
```

### 3.3 [HIGH] Tag Cache Staleness

**File:** `src/utils/tags.ts:26-38`

**What is untested:**
- Cache returns stale data after file deletion
- Cache holds references to deleted `TFile` objects
- `clearTagCache()` is never called from metadata change handlers
- TTL-based expiry (5-second window)
- Cache behavior with concurrent tag queries

**Recommended tests:**

```typescript
// tests/utils/tags.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cacheHasTag', () => {
  it('returns false for null cache', () => {
    expect(cacheHasTag(null, '#test')).toBe(false);
  });

  it('matches inline tags', () => {
    const cache = { tags: [{ tag: '#values', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 7, offset: 7 } } }] };
    expect(cacheHasTag(cache as any, '#values')).toBe(true);
  });

  it('matches frontmatter tags as array', () => {
    const cache = { frontmatter: { tags: ['values', 'quotes'] } };
    expect(cacheHasTag(cache as any, '#values')).toBe(true);
  });

  it('matches frontmatter tags with # prefix', () => {
    const cache = { frontmatter: { tags: ['#values'] } };
    expect(cacheHasTag(cache as any, '#values')).toBe(true);
  });

  it('matches frontmatter tag as string (not array)', () => {
    const cache = { frontmatter: { tags: 'values' } };
    expect(cacheHasTag(cache as any, '#values')).toBe(true);
  });

  it('filters non-string tags in frontmatter array', () => {
    const cache = { frontmatter: { tags: [42, null, 'values'] } };
    expect(cacheHasTag(cache as any, '#values')).toBe(true);
    expect(cacheHasTag(cache as any, '#42')).toBe(false);
  });

  it('returns false for non-matching tag', () => {
    const cache = { tags: [{ tag: '#other' }] };
    expect(cacheHasTag(cache as any, '#values')).toBe(false);
  });
});

describe('getFilesWithTag cache', () => {
  it('returns cached results within TTL', () => {
    // Would need to mock Date.now() and app.vault
  });

  it('refreshes after TTL expires', () => {
    // Would need vi.advanceTimersByTime(5001)
  });

  it('clearTagCache invalidates all entries', () => {
    clearTagCache();
    // Verify next call re-queries vault
  });
});
```

### 3.4 [HIGH] EmbeddedNote Rename Handler

**File:** `src/blocks/EmbeddedNoteBlock.ts:28-38`

**What is untested:**
- Rename handler updates config via immutable layout mutation
- After rename, `this.instance.config.filePath` still holds old value (stale config bug from prior review)
- The `trigger()` call after rename uses the current `this.instance.config` which may be stale
- Delete handler showing "File not found" correctly
- Race between rename save and re-render

**Recommended test:**

```typescript
describe('EmbeddedNoteBlock rename handler', () => {
  it('updates layout config when embedded file is renamed', async () => {
    const plugin = createMockPlugin({
      blocks: [{ id: 'emb1', type: 'embedded-note', x: 0, y: 0, w: 1, h: 1, config: { filePath: 'old/path.md' } }],
    });
    // Simulate rename event
    // Verify saveLayout called with updated filePath: 'new/path.md'
    // Verify this.instance.config.filePath is also updated for subsequent renders
  });

  it('re-renders after rename even when instance config is stale', () => {
    // This test documents the known bug: after rename, this.instance.config.filePath
    // still holds the old path because saveLayout creates new objects but the
    // block's this.instance reference is not updated.
  });
});
```

### 3.5 [HIGH] EmbeddedNote Grow Mode Missing auto-height Attribute

**File:** `src/blocks/EmbeddedNoteBlock.ts:46-89`

**What is untested:**
- `heightMode === 'grow'` should set `data-auto-height-content` on the content element
- Currently this attribute is never set (bug from prior review)
- Auto-height system relies on this attribute being present

**Recommended test:**

```typescript
describe('EmbeddedNoteBlock heightMode', () => {
  it('sets data-auto-height-content when heightMode is grow', async () => {
    // Render with config { heightMode: 'grow', filePath: 'test.md' }
    // Assert contentEl.hasAttribute('data-auto-height-content') === true
  });

  it('does not set data-auto-height-content when heightMode is scroll', async () => {
    // Render with config { heightMode: 'scroll', filePath: 'test.md' }
    // Assert contentEl.hasAttribute('data-auto-height-content') === false
  });
});
```

### 3.6 [HIGH] VoiceDictation Stream Cleanup

**File:** `src/blocks/VoiceDictationBlock.ts:106-114, 222`

**What is untested:**
- Multiple `this.register(() => stream.getTracks().forEach(...))` calls accumulate across recordings
- Each new recording registers a new cleanup callback but old ones still reference stopped tracks
- MediaRecorder cleanup on block unload
- State machine transitions (idle -> recording -> transcribing -> saved -> idle)

**Recommended test:**

```typescript
describe('VoiceDictationBlock stream cleanup', () => {
  it('does not accumulate stream cleanup callbacks across recordings', () => {
    // Start recording 1 -> stop -> start recording 2 -> stop
    // Unload block
    // Assert only the latest stream's tracks are stopped (not duplicates)
  });

  it('stops media tracks on block unload during recording', () => {
    // Start recording, then call block.unload()
    // Assert stream.getTracks() all have readyState === 'ended'
  });
});
```

### 3.7 [HIGH] Block Styling Pure Logic

**File:** `src/utils/blockStyling.ts`

**What is untested:**
- `HEX_COLOR_RE` validation (accepts `#aabbcc`, rejects `#abc`, `red`, etc.)
- Luminance calculation correctness
- Bright accent detection threshold
- Padding/gap/radius clamping
- Gradient rendering conditions
- Class toggling for all config flags

**Recommended test:**

```typescript
describe('blockStyling', () => {
  describe('HEX_COLOR_RE', () => {
    it('matches valid 6-digit hex', () => {
      expect(HEX_COLOR_RE.test('#ff0000')).toBe(true);
      expect(HEX_COLOR_RE.test('#AABBCC')).toBe(true);
    });

    it('rejects shorthand hex', () => {
      expect(HEX_COLOR_RE.test('#abc')).toBe(false);
    });

    it('rejects named colors', () => {
      expect(HEX_COLOR_RE.test('red')).toBe(false);
    });

    it('rejects 8-digit hex (with alpha)', () => {
      expect(HEX_COLOR_RE.test('#ff000080')).toBe(false);
    });
  });

  describe('bright accent detection', () => {
    it('flags yellow at high intensity as bright', () => {
      // Create mock element, call applyBlockStyling with _accentColor: '#f1c40f', _accentIntensity: 25
      // Assert el.classList.contains('block-bright-accent')
    });

    it('does not flag dark blue as bright', () => {
      // _accentColor: '#2980b9', _accentIntensity: 15
      // Assert !el.classList.contains('block-bright-accent')
    });
  });
});
```

---

## 4. Test Pyramid Assessment

| Level | Current | Recommended |
|-------|---------|-------------|
| **Unit tests** | 0 | ~80-100 tests covering pure functions, validation, migration, tag matching, styling logic |
| **Integration tests** | 0 | ~20-30 tests covering block render + vault mock interactions, layout persistence round-trips |
| **E2E tests** | 0 | ~5-10 tests (optional; Obsidian plugin E2E is inherently difficult) |

**Severity: Critical** -- The entire pyramid is empty. The foundation (unit tests) should be built first.

---

## 5. Security Test Gaps

| Gap | Severity | What to test |
|-----|----------|-------------|
| HTML sanitization bypass | **Critical** | Regex-based stripping can be defeated by nested tags, null bytes, and encoding tricks. Need regression tests for every known XSS vector. |
| Layout import injection | **High** | `validateLayout()` processes untrusted JSON from clipboard. Needs tests for prototype pollution, oversized payloads, and type confusion. |
| Block ID injection | **High** | `SAFE_ID_RE` rejects path traversal but is untested. Need tests for Unicode, null bytes, and extremely long IDs. |
| API key exposure in export | **Medium** | Export strips `apiKey` but this is untested. Need test confirming no API keys in exported JSON. |
| VoiceDictation model name injection | **Medium** | Gemini model validated with `/^[a-zA-Z0-9._-]+$/` -- untested. |

---

## 6. Performance Test Gaps

| Gap | Severity | What to test |
|-----|----------|-------------|
| Full GridStack rebuild on state change | **High** | `render()` calls `destroyAll()` every time. Need benchmark test to measure render time with 50+ blocks. |
| Tag cache memory growth | **Medium** | `tagCache` holds `TFile[]` references. Need test verifying cache size after many different tags. |
| Layout save serialization | **Medium** | `savePromise` chain for rapid saves. Need test confirming coalescing and no data loss. |
| Block re-render storm | **Medium** | Multiple vault events in quick succession. Need test confirming `scheduleRender` debouncing works. |

---

## 7. Recommended Testing Setup

### 7.1 Framework Selection

**Vitest** is recommended because:
- Native TypeScript support (no separate compilation step)
- Compatible with esbuild-based projects
- Fast execution with worker threads
- Built-in coverage via `@vitest/coverage-v8`
- Jest-compatible API (easy onboarding)

### 7.2 Installation

```bash
npm install -D vitest @vitest/coverage-v8 jsdom
```

### 7.3 Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',  // For DOM-dependent tests
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],  // Plugin lifecycle hard to unit test
      thresholds: {
        statements: 50,  // Start achievable, increase over time
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
  },
});
```

### 7.4 Obsidian API Mock

```typescript
// tests/mocks/obsidian.ts
export class Component {
  private cleanups: (() => void)[] = [];
  register(fn: () => void): void { this.cleanups.push(fn); }
  registerInterval(id: number): number { return id; }
  registerEvent(_: unknown): void {}
  load(): void {}
  unload(): void { this.cleanups.forEach(fn => fn()); }
}

export class Modal {
  app: unknown;
  contentEl = document.createElement('div');
  constructor(app: unknown) { this.app = app; }
  open(): void {}
  close(): void {}
}

export function sanitizeHTMLToDom(html: string): DocumentFragment {
  // Minimal mock -- in real tests, consider using DOMPurify for accuracy
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content;
}

export class Setting {
  constructor(_el: HTMLElement) {}
  setName(_: string): this { return this; }
  setDesc(_: string): this { return this; }
  setHeading(): this { return this; }
  addToggle(fn: (t: { setValue: (v: boolean) => unknown; onChange: (fn: (v: boolean) => void) => unknown }) => void): this { return this; }
  addText(fn: (t: { setValue: (v: string) => unknown; onChange: (fn: (v: string) => void) => unknown; inputEl: HTMLInputElement; setPlaceholder: (v: string) => unknown }) => void): this { return this; }
  addButton(fn: (b: { setButtonText: (v: string) => unknown; setCta: () => unknown; onClick: (fn: () => void) => unknown; setWarning: () => unknown }) => void): this { return this; }
  addDropdown(fn: (d: { addOption: (v: string, l: string) => unknown; setValue: (v: string) => unknown; onChange: (fn: (v: string) => void) => unknown }) => void): this { return this; }
}

export function setIcon(_el: HTMLElement, _icon: string): void {}
export function requestUrl(_opts: unknown): Promise<{ status: number; text: string; json: unknown }> {
  return Promise.resolve({ status: 200, text: '', json: {} });
}
```

### 7.5 Package.json Script

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 7.6 Refactoring for Testability

The most impactful refactoring to enable testing:

1. **Export `validateLayout`, `migrateBlockInstance`, `isValidBlockInstance`** from `main.ts` (or extract to `src/utils/layoutValidation.ts`). Currently these are module-private, making them untestable without extraction.

2. **Extract `DANGEROUS_TAGS_RE` and stripping logic** from `HtmlBlock.render()` into a standalone function in `src/utils/htmlSanitize.ts`.

3. **Extract tag cache** into a class with injectable `Date.now()` for deterministic TTL testing.

---

## 8. Prioritized Test Implementation Plan

| Priority | Area | Tests | Effort | Impact |
|----------|------|-------|--------|--------|
| **P0** | Layout validation/migration | ~25 tests | 1 day | Prevents data corruption on startup |
| **P0** | HTML sanitization regex | ~15 tests | 0.5 day | Documents XSS attack surface |
| **P1** | `cacheHasTag` / tag utilities | ~10 tests | 0.5 day | Ensures correct content filtering |
| **P1** | `applyBlockStyling` pure logic | ~15 tests | 0.5 day | Prevents visual regressions |
| **P1** | `parseNoteInsight` | ~5 tests | 0.25 day | Low effort, easy win |
| **P1** | `BlockRegistry` | ~5 tests | 0.25 day | Low effort, easy win |
| **P2** | BaseBlock scheduleRender/staleness | ~8 tests | 0.5 day | Prevents race conditions |
| **P2** | EmbeddedNote rename handler | ~5 tests | 0.5 day | Documents known stale config bug |
| **P2** | VoiceDictation state machine | ~8 tests | 1 day | Complex mocking required |
| **P2** | Export strips API keys | ~3 tests | 0.25 day | Security assertion |
| **P3** | Responsive grid columns | ~3 tests | 0.1 day | Trivial |
| **P3** | GridLayout integration | ~10 tests | 2 days | Requires GridStack mock |

**Total estimated effort:** ~7 days for P0+P1+P2, achieving meaningful coverage of all critical paths.

---

## 9. Test Maintainability Considerations

### What to Watch For

- **Mock drift:** Obsidian API mocks will need updating when the plugin upgrades its `obsidian` dependency. Pin mock structure to the actual API surface.
- **Test isolation:** All tests must reset `BlockRegistry` and `tagCache` state between runs. Use `beforeEach` hooks.
- **Flaky timer tests:** `scheduleRender` uses `setTimeout` -- use `vi.useFakeTimers()` consistently.
- **DOM cleanup:** jsdom environment accumulates DOM state. Clear `document.body` in `afterEach`.

### Anti-Patterns to Avoid

- Testing implementation details (e.g., checking internal `_renderGen` value instead of observing render output)
- Snapshot tests for DOM output (brittle, hard to review)
- Mocking too much (prefer testing real `validateLayout` with real input data)

---

## 10. Summary of Findings

| Severity | Count | Key Finding |
|----------|-------|-------------|
| **Critical** | 3 | Zero test infrastructure; XSS sanitization untested; layout validation/migration untested |
| **High** | 5 | Tag cache staleness untested; EmbeddedNote rename bug untested; VoiceDictation cleanup untested; block styling logic untested; no security regression tests |
| **Medium** | 4 | Performance characteristics unmeasured; save serialization untested; export API key stripping untested; model name validation untested |
| **Low** | 2 | BlockRegistry trivially untested; responsiveGridColumns untested |

The most urgent action is setting up Vitest and writing P0 tests for layout validation and HTML sanitization. These cover the highest-risk code paths (data integrity and security) with the lowest mocking overhead.
