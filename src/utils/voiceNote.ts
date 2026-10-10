import { normalizePath } from 'obsidian';

const PLACEHOLDER = '{{transcript}}';

/**
 * Where a voice note goes. The folder loses anything that could leave the vault
 * (leading slashes or tilde, a drive prefix, NUL, backslashes); a folder with a
 * `..` segment is refused (null). The name is the timestamp, numbered when a
 * note with that name exists (two notes in one second lost the second, R10).
 */
export function voiceNotePath(
  folder: string,
  timestamp: string,
  exists: (path: string) => boolean,
): { folder: string; path: string } | null {
  const raw = folder
    .replace(/^[/\\~]+/, '')
    .replace(/^[A-Za-z]:/, '')
    // NUL byte is a classic path-escape trick on some filesystems; string
    // replaceAll (not a regex) sidesteps the no-control-regex lint rule.
    .replaceAll('\u0000', '')
    .replace(/\\/g, '/')
    .trim();
  const segments = raw.split('/').filter(Boolean);
  if (segments.some(s => s === '..')) return null;
  const safe = normalizePath(segments.join('/'));
  const dir = safe && safe !== '/' ? safe : '';
  const base = dir ? `${dir}/${timestamp}` : timestamp;
  let path = `${base}.md`;
  for (let n = 2; exists(path); n++) path = `${base} ${n}.md`;
  return { folder: dir, path };
}

/** True when the placeholder at `index` sits in plain text, where no URL can carry it. */
function inPlainText(template: string, index: number): boolean {
  const before = template.slice(0, index);
  if (before.lastIndexOf('<') > before.lastIndexOf('>')) return false; // inside an HTML tag
  const lower = before.toLowerCase();
  for (const tag of ['style', 'svg']) {
    if (lower.lastIndexOf(`<${tag}`) > lower.lastIndexOf(`</${tag}`)) return false; // inside <style> / <svg>
  }
  if (before.lastIndexOf('](') > before.lastIndexOf(')')) return false; // link or image target
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if (/^\s*\[[^\]]*\]:/.test(line)) return false; // reference definition
  return true;
}

/**
 * A voice note's text: the template with `{{transcript}}` filled in, or the
 * transcript alone. The placeholder must sit in plain text: in an HTML tag, a
 * <style>/<svg> element or a link or image target the transcript would go into
 * a URL that is fetched when the note opens, which is how an imported template
 * could send every dictation to a remote server (M12). Such a template is
 * ignored, and the note holds the transcript alone. A template without the
 * placeholder gets the transcript below it, instead of losing it.
 */
export function buildNoteContent(template: string, transcript: string): { content: string; templateIgnored: boolean } {
  if (!template) return { content: transcript, templateIgnored: false };
  if (!template.includes(PLACEHOLDER)) return { content: `${template}\n\n${transcript}`, templateIgnored: false };
  for (let i = template.indexOf(PLACEHOLDER); i !== -1; i = template.indexOf(PLACEHOLDER, i + PLACEHOLDER.length)) {
    if (!inPlainText(template, i)) return { content: transcript, templateIgnored: true };
  }
  return { content: template.split(PLACEHOLDER).join(transcript), templateIgnored: false };
}
