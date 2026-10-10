import { CachedMetadata } from 'obsidian';

/** A heading line: `#` to `######` and a space or the end. `#quote text` is a tag, not a heading (M45). */
const HEADING_RE = /^#{1,6}(\s|$)/;
const FENCE_RE = /^(`{3,}|~{3,})/;
/** A table row or its separator. */
const TABLE_RE = /^\|/;
/** A whole-line inline field, `key:: value`. */
const FIELD_LINE_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_ -]*::/u;
/** Tags at the start of a line, which Obsidian shows as tags, not as text. */
const LEADING_TAGS_RE = /^(?:#[\p{L}\p{N}_\-/]+\s*)+/u;

/**
 * The text of a note as Obsidian shows it, as plain-text paragraphs (each a list
 * of lines). One extractor for Quotes and Random note, which only trimmed lines
 * and showed callout markers, code (a Dataview query instead of the quote),
 * `%%` and HTML comments Obsidian hides, tables, inline fields, block ids and
 * link targets instead of their text (M44). Leaves `**bold**` and inline tags,
 * which the Quotes renderer formats.
 */
export function noteBlocks(content: string, cache: CachedMetadata | null): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  const flush = () => { if (current.length) blocks.push(current); current = []; };

  let text = content.slice(frontmatterEnd(content, cache));
  // Comments first: they can span lines and sit inside any other construct.
  text = text.replace(/%%[\s\S]*?%%/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

  let fence: string | null = null;
  let inMath = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (fence) {
      if (line.startsWith(fence)) fence = null;
      continue;
    }
    if (inMath) {
      if (line.startsWith('$$')) inMath = false;
      continue;
    }
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) { flush(); fence = fenceMatch[1]; continue; }
    if (line.startsWith('$$')) {
      flush();
      if (!(line.length > 2 && line.endsWith('$$'))) inMath = true;
      continue;
    }
    if (!line) { flush(); continue; }
    if (HEADING_RE.test(line) || TABLE_RE.test(line) || FIELD_LINE_RE.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      continue;
    }
    const cleaned = cleanLine(line);
    if (cleaned) current.push(cleaned);
  }
  flush();
  return blocks;
}

/** Where the body starts: after the frontmatter. */
function frontmatterEnd(content: string, cache: CachedMetadata | null): number {
  const fromCache = cache?.frontmatterPosition?.end.offset;
  if (typeof fromCache === 'number') return fromCache;
  const m = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
  return m ? m[0].length : 0;
}

/** One line as plain text: markers, ids, fields, embeds and link syntax removed. */
function cleanLine(line: string): string {
  let s = line;
  // Blockquote and callout markers, nested too; a callout's [!type] and fold sign.
  s = s.replace(/^(?:>\s*)+/, '');
  s = s.replace(/^\[!\w[\w-]*\][+-]?\s*/, '');
  // List and task markers.
  s = s.replace(/^(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/, '');
  // Embeds are not text; links show their alias or their target.
  s = s.replace(/!\[\[[^\]]*\]\]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, target: string) => target.replace(/#/g, ' > ').replace(/^ > /, ''));
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Bracketed inline fields and a trailing block id.
  s = s.replace(/[[(][\p{L}\p{N}_][\p{L}\p{N}_ -]*::[^\])]*[\])]/gu, '');
  s = s.replace(/\s\^[\w-]+$/, '');
  s = s.replace(LEADING_TAGS_RE, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Heading + body text of a note. The heading is the title only when the note
 * starts with it: the first heading anywhere ("Related" at the end) is not the
 * note's title, and the caller then uses the file name (M89).
 */
export function parseNoteInsight(content: string, cache: CachedMetadata | null): { heading: string; body: string } {
  const body = noteBlocks(content, cache).map(b => b.join(' ')).join(' ');
  return { heading: leadingHeading(content, cache), body };
}

function leadingHeading(content: string, cache: CachedMetadata | null): string {
  const text = content.slice(frontmatterEnd(content, cache));
  const first = text.split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? '';
  return HEADING_RE.test(first) ? first.replace(/^#{1,6}\s*/, '').replace(/\s#+$/, '').trim() : '';
}

/** A trailing attribution line: an em dash, an en dash or `--`. */
const AUTHOR_RE = /^(?:—|–|--)\s*/;

/**
 * The first paragraph of a note as a quote: in full, capped at `maxChars` with an
 * ellipsis, and its "— Author" line apart. List mode took 3 lines with no
 * ellipsis and lost the author line (M88).
 */
export function noteQuote(content: string, cache: CachedMetadata | null, maxChars = 280): { text: string; author: string } {
  const first = noteBlocks(content, cache)[0] ?? [];
  const last = first[first.length - 1] ?? '';
  const hasAuthor = first.length > 1 && AUTHOR_RE.test(last);
  const lines = hasAuthor ? first.slice(0, -1) : first;
  return { text: capText(lines.join(' '), maxChars), author: hasAuthor ? last.replace(AUTHOR_RE, '') : '' };
}

/** The first paragraph as plain text, without `**`/`*` emphasis, capped at `maxChars`. */
export function notePreview(content: string, cache: CachedMetadata | null, maxChars = 200): string {
  const first = (noteBlocks(content, cache)[0] ?? []).join(' ');
  return first.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').slice(0, maxChars);
}

function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}
