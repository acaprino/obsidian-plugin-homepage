import { CachedMetadata } from 'obsidian';

/** Extract heading + body text from note content using metadataCache offsets. */
export function parseNoteInsight(content: string, cache: CachedMetadata | null): { heading: string; body: string } {
  const heading = cache?.headings?.[0]?.heading ?? '';
  const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
  const afterFm = content.slice(fmEnd);
  const body = afterFm
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .join(' ');
  return { heading, body };
}
