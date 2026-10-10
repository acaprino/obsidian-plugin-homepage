import { App, Keymap, Notice, TFile, parseLinktext } from 'obsidian';
import { isDangerousUrl } from './urls';

/** The event a block was clicked with: Ctrl/Cmd or a middle click opens a tab, +Alt a split. */
type OpenEvent = MouseEvent | KeyboardEvent | undefined;

/**
 * Open a file the block already holds. Not through openLinkText, which parses
 * the path as link text: a `#` in a file or folder name opened a different
 * note or created an empty one (M21). Modifier and middle clicks open a new
 * tab or split, as in the file explorer (M65).
 */
export function openFile(app: App, file: TFile, evt?: OpenEvent): void {
  void app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(file);
}

/** Run `fn` on a click and on a middle click (auxclick fires for any button but the left). */
export function onOpenClick(el: HTMLElement, fn: (evt: MouseEvent) => void): void {
  el.addEventListener('click', fn);
  el.addEventListener('auxclick', (evt: MouseEvent) => { if (evt.button === 1) fn(evt); });
}

/** A typed note link, cleaned: trimmed, `[[ ]]` and an `|alias` stripped; '' for none (M66). */
export function cleanLinkText(raw: string): string {
  let link = raw.trim();
  const wiki = /^\[\[([\s\S]*)\]\]$/.exec(link);
  if (wiki) link = wiki[1];
  const bar = link.indexOf('|');
  if (bar !== -1) link = link.slice(0, bar);
  return link.trim();
}

/**
 * Open the note a typed link names, only when it resolves. openLinkText created
 * an empty note at a link that no longer resolved, say after a rename, so it
 * looked as if the note had been wiped (M22, M66); a miss is now a notice.
 */
export function openNoteLink(app: App, raw: string, evt?: OpenEvent): void {
  const link = cleanLinkText(raw);
  if (!link) return;
  const { path, subpath } = parseLinktext(link);
  const file = app.metadataCache.getFirstLinkpathDest(path, '');
  if (!file) {
    new Notice(`Homepage blocks: no note named “${path}”.`);
    return;
  }
  void app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(file, subpath ? { eState: { subpath } } : undefined);
}

/** An absolute URL with a scheme (`https:`, `obsidian:`, `mailto:`, ...), not a drive letter. */
const SCHEME_RE = /^[a-z][a-z0-9+.-]+:/i;
/** A host name without a scheme, like `github.com/owner`; a file name such as `Plan.md` is not one. */
const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;
const FILE_EXT_RE = new RegExp('^[^/?#]+\\.(?:' + [
  'md', 'canvas', 'base', 'txt', 'pdf', 'csv', 'json', 'xml', 'html?', 'epub',
  'docx?', 'xlsx?', 'pptx?', 'od[tsp]', 'rtf', 'pages', 'numbers', 'key',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz',
  'png', 'jpe?g', 'gif', 'webp', 'svg', 'bmp', 'tiff?', 'heic', 'avif',
  'mp3', 'm4a', 'wav', 'ogg', 'flac', 'opus', 'mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm',
  'js', 'ts', 'py', 'css',
].join('|') + ')$', 'i');

/**
 * Open a Bookmarks or Button grid target: a URL externally (any scheme but the
 * dangerous ones), a domain without a scheme as https, anything else as a vault
 * note when it resolves. openLinkText turned `github.com` into a stray note and
 * could not open `obsidian://` or `mailto:` (M23).
 */
export function openLinkTarget(app: App, raw: string, evt?: OpenEvent): void {
  const value = raw.trim();
  if (!value) return;
  if (isDangerousUrl(value)) {
    new Notice('Homepage blocks: blocked an unsafe link.');
    return;
  }
  if (SCHEME_RE.test(value)) {
    window.open(value, '_blank', 'noopener,noreferrer');
    return;
  }
  const link = cleanLinkText(value);
  if (app.metadataCache.getFirstLinkpathDest(parseLinktext(link).path, '')) {
    openNoteLink(app, link, evt);
    return;
  }
  if (DOMAIN_RE.test(value) && !FILE_EXT_RE.test(value)) {
    window.open(`https://${value}`, '_blank', 'noopener,noreferrer');
    return;
  }
  openNoteLink(app, link, evt);
}
