import { App, CachedMetadata, TFile } from 'obsidian';

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
 * Returns all markdown files in the vault that have the given tag.
 * `tag` must include the leading `#` (e.g. `#values`).
 * Handles both inline tags and YAML frontmatter tags (with or without `#`),
 * and frontmatter tags that are a plain string instead of an array.
 */
const tagCache = new Map<string, { files: TFile[]; timestamp: number }>();
const TAG_CACHE_TTL = 5000; // 5 seconds

export function getFilesWithTag(app: App, tag: string): TFile[] {
  const cached = tagCache.get(tag);
  if (cached && Date.now() - cached.timestamp < TAG_CACHE_TTL) {
    return cached.files;
  }
  const files = app.vault.getMarkdownFiles().filter(file =>
    cacheHasTag(app.metadataCache.getFileCache(file), tag),
  );
  tagCache.set(tag, { files, timestamp: Date.now() });
  return files;
}

/** Clear the tag cache. Call when metadata changes to ensure freshness. */
export function clearTagCache(): void {
  tagCache.clear();
}
