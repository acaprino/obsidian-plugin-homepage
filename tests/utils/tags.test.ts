import { describe, it, expect, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import type { App, CachedMetadata, Plugin } from 'obsidian';
import { cacheHasTag, getFilesWithTag, normalizeTag, installTagCacheListeners } from '../../src/utils/tags';

describe('normalizeTag', () => {
  it('adds a leading # when missing and is idempotent', () => {
    expect(normalizeTag('values')).toBe('#values');
    expect(normalizeTag('#values')).toBe('#values');
    expect(normalizeTag('  spaced  ')).toBe('#spaced');
    expect(normalizeTag('#already')).toBe('#already');
  });
});

describe('cacheHasTag', () => {
  it('matches inline tags and frontmatter tags (string or array, with/without #)', () => {
    expect(cacheHasTag({ tags: [{ tag: '#x' }] } as unknown as CachedMetadata, '#x')).toBe(true);
    expect(cacheHasTag({ frontmatter: { tags: ['x'] } } as CachedMetadata, '#x')).toBe(true);
    expect(cacheHasTag({ frontmatter: { tags: 'x' } } as CachedMetadata, '#x')).toBe(true);
    expect(cacheHasTag(null, '#x')).toBe(false);
    expect(cacheHasTag({} as CachedMetadata, '#x')).toBe(false);
  });
});

// ── Per-file invalidation (M5) ────────────────────────────────────────────────

type Listener = (...args: unknown[]) => void;

function mkFile(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.replace(/\.md$/, '');
  f.extension = 'md';
  f.stat = { mtime: 1, ctime: 1, size: 0 };
  return f;
}

/** Minimal event-emitting App + Plugin so we can drive the cache listeners. */
function makeHarness() {
  const fileCaches = new Map<string, CachedMetadata>();
  let mdFiles: TFile[] = [];
  const vaultL: Record<string, Listener[]> = {};
  const metaL: Record<string, Listener[]> = {};

  const app = {
    vault: {
      getMarkdownFiles: () => mdFiles,
      on: (evt: string, cb: Listener) => { (vaultL[evt] ??= []).push(cb); return { evt }; },
    },
    metadataCache: {
      getFileCache: (f: TFile) => fileCaches.get(f.path) ?? null,
      on: (evt: string, cb: Listener) => { (metaL[evt] ??= []).push(cb); return { evt }; },
    },
  } as unknown as App;

  const plugin = { app, register: () => {}, registerEvent: () => {} } as unknown as Plugin;

  return {
    app,
    plugin,
    setFiles: (f: TFile[]) => { mdFiles = f; },
    setTag: (path: string, tag: string | null) => {
      fileCaches.set(path, tag ? ({ tags: [{ tag }] } as unknown as CachedMetadata) : ({} as CachedMetadata));
    },
    emitMeta: (evt: string, ...args: unknown[]) => (metaL[evt] ?? []).forEach(l => l(...args)),
    emitVault: (evt: string, ...args: unknown[]) => (vaultL[evt] ?? []).forEach(l => l(...args)),
  };
}

describe('tag cache — per-file invalidation (M5)', () => {
  // The module-level cache + listenersInstalled flag are global; install once and
  // re-install before each test (which clears the cache) so tests are independent.
  const h = makeHarness();
  installTagCacheListeners(h.plugin);

  beforeEach(() => {
    installTagCacheListeners(h.plugin); // clears the cache, keeps the bound listeners
  });

  it('caches getFilesWithTag results', () => {
    const a = mkFile('a.md');
    h.setFiles([a]);
    h.setTag('a.md', '#proj');
    const first = getFilesWithTag(h.app, '#proj');
    expect(first.map(f => f.path)).toEqual(['a.md']);
    // Second call returns the same cached array instance.
    expect(getFilesWithTag(h.app, '#proj')).toBe(first);
  });

  it("a metadata 'changed' that adds the tag updates only that tag's list", () => {
    const a = mkFile('a.md');
    const b = mkFile('b.md');
    h.setFiles([a, b]);
    h.setTag('a.md', '#proj');
    h.setTag('b.md', null);
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path)).toEqual(['a.md']);

    // b gains the tag → 'changed' fires with b's fresh cache.
    h.setTag('b.md', '#proj');
    h.emitMeta('changed', b, '', { tags: [{ tag: '#proj' }] });
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path).sort()).toEqual(['a.md', 'b.md']);
  });

  it("a metadata 'changed' that removes the tag drops only that file", () => {
    const a = mkFile('a.md');
    const b = mkFile('b.md');
    h.setFiles([a, b]);
    h.setTag('a.md', '#proj');
    h.setTag('b.md', '#proj');
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path).sort()).toEqual(['a.md', 'b.md']);

    h.setTag('a.md', null);
    h.emitMeta('changed', a, '', {});
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path)).toEqual(['b.md']);
  });

  it("a 'changed' on a file unrelated to a cached tag does NOT clear that tag's cache (per-file, not global)", () => {
    const a = mkFile('a.md');
    const other = mkFile('other.md');
    h.setFiles([a, other]);
    h.setTag('a.md', '#proj');
    h.setTag('other.md', '#unrelated');
    const cached = getFilesWithTag(h.app, '#proj');
    expect(cached.map(f => f.path)).toEqual(['a.md']);

    // 'other' changes; it never had #proj. The #proj cache must survive intact
    // (a global clear would have invalidated it). Same array instance proves it.
    h.emitMeta('changed', other, '', { tags: [{ tag: '#unrelated' }] });
    expect(getFilesWithTag(h.app, '#proj')).toBe(cached);
  });

  it("a vault 'delete' drops the file from every cached tag list", () => {
    const a = mkFile('a.md');
    const b = mkFile('b.md');
    h.setFiles([a, b]);
    h.setTag('a.md', '#proj');
    h.setTag('b.md', '#proj');
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path).sort()).toEqual(['a.md', 'b.md']);

    h.emitVault('delete', a);
    expect(getFilesWithTag(h.app, '#proj').map(f => f.path)).toEqual(['b.md']);
  });
});
