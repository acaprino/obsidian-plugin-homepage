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

/**
 * Cache of tag -> files keyed by the tag string (including `#`). Entries live
 * until a vault or metadataCache event invalidates them — see
 * installTagCacheListeners. Previously keyed by a 5s TTL, which could serve
 * stale data after a rename or tag edit; now staleness is event-driven.
 */
const tagCache = new Map<string, TFile[]>();
let listenersInstalled = false;

/**
 * Register a plugin-wide invalidator so every caller of getFilesWithTag sees
 * fresh data without having to clear the cache themselves. Idempotent — safe
 * to call from both onload and unit tests.
 */
export function installTagCacheListeners(plugin: Plugin): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  plugin.register(() => {
    // Plugin unload: reset state so a fresh install after reload doesn't skip registration.
    listenersInstalled = false;
    tagCache.clear();
  });
  plugin.registerEvent(plugin.app.vault.on('delete', () => { tagCache.clear(); }));
  plugin.registerEvent(plugin.app.vault.on('rename', () => { tagCache.clear(); }));
  plugin.registerEvent(plugin.app.metadataCache.on('changed', () => { tagCache.clear(); }));
  plugin.registerEvent(plugin.app.metadataCache.on('resolved', () => { tagCache.clear(); }));
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

/**
 * Clear the tag cache manually. Normal invalidation happens through the listeners
 * installed by installTagCacheListeners; this is kept for tests and for callers
 * that want to force a refresh without waiting for the next vault event.
 */
export function clearTagCache(): void {
  tagCache.clear();
}
