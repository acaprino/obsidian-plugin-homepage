import { CachedMetadata } from 'obsidian';

/** Extract heading + first body line from note content using metadataCache offsets. */
export function parseNoteInsight(content: string, cache: CachedMetadata | null): { heading: string; body: string } {
  const heading = cache?.headings?.[0]?.heading ?? '';
  const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
  const afterFm = content.slice(fmEnd);
  const body = afterFm
    .split('\n')
    .map(l => l.trim())
    .find(l => l && !l.startsWith('#')) ?? '';
  return { heading, body };
}
