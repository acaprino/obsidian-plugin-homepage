import { App, TFile } from 'obsidian';

/**
 * Returns all markdown files in the vault that have the given tag.
 * `tag` must include the leading `#` (e.g. `#values`).
 * Handles both inline tags and YAML frontmatter tags (with or without `#`),
 * and frontmatter tags that are a plain string instead of an array.
 */
export function getFilesWithTag(app: App, tag: string): TFile[] {
  return app.vault.getMarkdownFiles().filter(file => {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return false;

    const inlineTags = cache.tags?.map(t => t.tag) ?? [];

    const rawFmTags = cache.frontmatter?.tags;
    const fmTagArray: string[] =
      Array.isArray(rawFmTags) ? rawFmTags.filter((t): t is string => typeof t === 'string') :
      typeof rawFmTags === 'string' ? [rawFmTags] :
      [];
    const normalizedFmTags = fmTagArray.map(t => t.startsWith('#') ? t : `#${t}`);

    return inlineTags.includes(tag) || normalizedFmTags.includes(tag);
  });
}
