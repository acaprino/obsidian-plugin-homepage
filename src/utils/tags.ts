import { App, CachedMetadata, Plugin, TFile } from 'obsidian';

/**
 * Check whether a metadata cache entry contains the given tag.
 * `tag` must include the leading `#` (e.g. `#values`).
 */
export function cacheHasTag(cache: CachedMetadata | null, tag: string): boolean {
  if (!cache) return false;

  if (cache.tags?.some(t => t.tag === tag)) return true;

  const rawFmTags: unknown = cache.frontmatter?.tags;
  const fmTagArray: string[] =
    Array.isArray(rawFmTags) ? rawFmTags.filter((t): t is string => typeof t === 'string') :
    typeof rawFmTags === 'string' ? [rawFmTags] :
    [];
  return fmTagArray.some(t => (t.startsWith('#') ? t : `#${t}`) === tag);
}

/** Normalize a tag to include the leading `#` (e.g. `values` -> `#values`). */
export function normalizeTag(tag: string): string {
  const t = tag.trim();
  return t.startsWith('#') ? t : `#${t}`;
}

/**
 * Cache of tag -> files keyed by the tag string (including `#`). Entries are
 * kept fresh by PER-FILE invalidation (see installTagCacheListeners). Previously
 * a 5s TTL (stale after edits), then a global clear on any metadata event (which
 * forced every getFilesWithTag caller back to an O(N) vault scan under metadata
 * churn); now only the changed file's membership is updated.
 */
const tagCache = new Map<string, TFile[]>();
let listenersInstalled = false;

/** Remove a file path (and, for folders, anything under it) from every cached tag list. */
function dropPathFromCache(path: string): void {
  const prefix = path + '/';
  for (const [tag, files] of tagCache) {
    const next = files.filter(f => f.path !== path && !f.path.startsWith(prefix));
    if (next.length !== files.length) tagCache.set(tag, next);
  }
}

/** Re-evaluate one file's membership across every cached tag, in place. */
function reindexFile(file: TFile, cache: CachedMetadata | null): void {
  if (file.extension !== 'md') return;
  for (const [tag, files] of tagCache) {
    const has = cacheHasTag(cache, tag);
    const idx = files.findIndex(f => f.path === file.path);
    if (has && idx === -1) {
      tagCache.set(tag, [...files, file]);
    } else if (!has && idx !== -1) {
      tagCache.set(tag, files.filter(f => f.path !== file.path));
    } else if (has && idx !== -1 && files[idx] !== file) {
      // Refresh a stale TFile reference (same path, new object).
      const next = files.slice();
      next[idx] = file;
      tagCache.set(tag, next);
    }
  }
}

/**
 * Register a plugin-wide invalidator so every caller of getFilesWithTag sees
 * fresh data without having to clear the cache themselves. Idempotent — safe
 * to call from both onload and unit tests.
 */
export function installTagCacheListeners(plugin: Plugin): void {
  // Always start cold. Without this, a plugin disable+enable cycle would re-use
  // entries computed against the prior session's vault state -- subtly stale
  // RandomNote / QuotesList results until the first vault event invalidates.
  tagCache.clear();
  if (listenersInstalled) return;
  listenersInstalled = true;
  plugin.register(() => {
    // Plugin unload: reset state so a fresh install after reload doesn't skip registration.
    listenersInstalled = false;
    tagCache.clear();
  });
  // Per-file invalidation (T cached tags is tiny) instead of a global clear:
  // metadataCache 'changed' fires per recomputed file, so updating only that
  // file's membership keeps lookups amortized-cheap under sync/bulk churn. The
  // old global clear on 'resolved' is dropped — per-file 'changed' covers it.
  plugin.registerEvent(plugin.app.vault.on('delete', (f) => { dropPathFromCache(f.path); }));
  plugin.registerEvent(plugin.app.vault.on('rename', (f, oldPath) => {
    dropPathFromCache(oldPath);
    if (f instanceof TFile) reindexFile(f, plugin.app.metadataCache.getFileCache(f));
  }));
  plugin.registerEvent(plugin.app.metadataCache.on('changed', (f, _data, cache) => {
    reindexFile(f, cache);
  }));
}

/**
 * Returns all markdown files in the vault that have the given tag.
 * `tag` must include the leading `#` (e.g. `#values`).
 * Handles both inline tags and YAML frontmatter tags (with or without `#`),
 * and frontmatter tags that are a plain string instead of an array.
 */
export function getFilesWithTag(app: App, tag: string): TFile[] {
  const cached = tagCache.get(tag);
  if (cached) return cached;
  const files = app.vault.getMarkdownFiles().filter(file =>
    cacheHasTag(app.metadataCache.getFileCache(file), tag),
  );
  tagCache.set(tag, files);
  return files;
}

