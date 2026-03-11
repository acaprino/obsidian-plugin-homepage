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
export function getFilesWithTag(app: App, tag: string): TFile[] {
  return app.vault.getMarkdownFiles().filter(file =>
    cacheHasTag(app.metadataCache.getFileCache(file), tag),
  );
}
