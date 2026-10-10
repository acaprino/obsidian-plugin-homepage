import type { BlockInstance } from '../types';

const stripMd = (p: string): string => (p.endsWith('.md') ? p.slice(0, -3) : p);

/**
 * `value` rewritten for a rename of `oldPath` to `newPath`, or null when the
 * rename does not concern it. A value names the renamed file (with or without
 * `.md`, as link text often omits it), or something inside a renamed folder.
 */
export function renamePath(value: string, oldPath: string, newPath: string): string | null {
  // As typed: slashes around it and another letter case still name the path
  // (folder settings are matched that way, M18, M67).
  const v = value.trim().replace(/^\/+|\/+$/g, '');
  const lower = v.toLowerCase();
  const old = oldPath.toLowerCase();
  if (lower === old) return newPath;
  if (old.endsWith('.md') && lower === stripMd(old)) return stripMd(newPath);
  if (lower.startsWith(old + '/')) return newPath + v.slice(oldPath.length);
  return null;
}

const baseName = (p: string): string => stripMd(p.slice(p.lastIndexOf('/') + 1));

/**
 * A typed note link (`Plan`, `[[Plan#Goals|alias]]`, `Projects/Plan`) rewritten
 * for a rename, keeping its brackets, heading and alias; null when it does not
 * name the renamed note. A bare name follows only when it no longer resolves
 * to another note (`resolves`), as Obsidian's own link update would see it.
 */
export function renameLink(value: string, oldPath: string, newPath: string, resolves: (name: string) => boolean): string | null {
  const wiki = /^(\s*\[\[)([\s\S]*)(\]\]\s*)$/.exec(value);
  const [open, inner, close] = wiki ? [wiki[1], wiki[2], wiki[3]] : ['', value, ''];
  const bar = inner.indexOf('|');
  const target = bar === -1 ? inner : inner.slice(0, bar);
  const alias = bar === -1 ? '' : inner.slice(bar);
  const hash = target.indexOf('#');
  const path = (hash === -1 ? target : target.slice(0, hash)).trim();
  const sub = hash === -1 ? '' : target.slice(hash);
  let renamed = path ? renamePath(path, oldPath, newPath) : null;
  if (renamed === null && path && !path.includes('/') && path === baseName(oldPath) && !resolves(path)) {
    renamed = baseName(newPath);
  }
  return renamed === null ? null : `${open}${renamed}${sub}${alias}${close}`;
}

/** `value` when it is not a URL with a scheme (a bookmark can hold either). */
const isVaultPath = (value: string): boolean => !/^[a-z][a-z0-9+.-]*:/i.test(value);

function renameIn(value: unknown, oldPath: string, newPath: string): string | null {
  return typeof value === 'string' && value ? renamePath(value, oldPath, newPath) : null;
}

/** Rewrite `key` of each object in the array `list`; null when none changed. */
function renameInList(list: unknown, key: string, rename: (v: string) => string | null, guard: (v: string) => boolean = () => true): unknown[] | null {
  if (!Array.isArray(list)) return null;
  let changed = false;
  const next = list.map((item: unknown) => {
    if (!item || typeof item !== 'object') return item;
    const v = (item as Record<string, unknown>)[key];
    if (typeof v !== 'string' || !guard(v)) return item;
    const renamed = v ? rename(v) : null;
    if (renamed === null) return item;
    changed = true;
    return { ...item, [key]: renamed };
  });
  return changed ? next : null;
}

/**
 * `b` with every path its config names updated for a rename of `oldPath` to
 * `newPath` (a file or a folder), or `b` itself when nothing changed: folder
 * settings (Gallery, Quick links, Voice notes, Recent files exclusions, M55),
 * typed note links (Button grid, Quick links, Bookmarks, M22) and the embedded
 * note. Without it a rename left "not found" blocks, and a click on a typed
 * link created an empty note at the old path.
 */
export function followRenameInBlock(b: BlockInstance, oldPath: string, newPath: string, resolves: (name: string) => boolean = () => false): BlockInstance {
  const c = b.config;
  const link = (v: string) => renameLink(v, oldPath, newPath, resolves);
  const patch: Record<string, unknown> = {};
  const set = (key: string, value: unknown): void => { if (value !== null) patch[key] = value; };
  switch (b.type) {
    case 'embedded-note': set('filePath', renameIn(c.filePath, oldPath, newPath)); break;
    case 'image-gallery': set('folder', renameIn(c.folder, oldPath, newPath)); break;
    case 'voice-dictation': set('folder', renameIn(c.folder, oldPath, newPath)); break;
    case 'folder-links':
      set('folder', renameIn(c.folder, oldPath, newPath));
      set('links', renameInList(c.links, 'path', link));
      break;
    case 'button-grid': set('items', renameInList(c.items, 'link', link, isVaultPath)); break;
    case 'bookmarks': set('items', renameInList(c.items, 'url', link, isVaultPath)); break;
    case 'recent-files': {
      if (typeof c.excludeFolders !== 'string') break;
      let changed = false;
      const parts = c.excludeFolders.split(',').map(part => {
        const renamed = renamePath(part.trim(), oldPath, newPath);
        if (renamed === null) return part;
        changed = true;
        return part.replace(part.trim(), renamed);
      });
      if (changed) patch.excludeFolders = parts.join(',');
      break;
    }
    default: break;
  }
  return Object.keys(patch).length > 0 ? { ...b, config: { ...c, ...patch } } : b;
}
