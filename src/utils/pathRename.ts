import type { BlockInstance } from '../types';

const stripMd = (p: string): string => (p.endsWith('.md') ? p.slice(0, -3) : p);

/**
 * `value` rewritten for a rename of `oldPath` to `newPath`, or null when the
 * rename does not concern it. A value names the renamed file (with or without
 * `.md`, as link text often omits it), or something inside a renamed folder.
 */
export function renamePath(value: string, oldPath: string, newPath: string): string | null {
  if (value === oldPath) return newPath;
  if (oldPath.endsWith('.md') && value === stripMd(oldPath)) return stripMd(newPath);
  if (value.startsWith(oldPath + '/')) return newPath + value.slice(oldPath.length);
  return null;
}

/** `value` when it is not a URL with a scheme (a bookmark can hold either). */
const isVaultPath = (value: string): boolean => !/^[a-z][a-z0-9+.-]*:/i.test(value);

function renameIn(value: unknown, oldPath: string, newPath: string): string | null {
  return typeof value === 'string' && value ? renamePath(value, oldPath, newPath) : null;
}

/** Rewrite `key` of each object in the array `list`; null when none changed. */
function renameInList(list: unknown, key: string, oldPath: string, newPath: string, guard: (v: string) => boolean = () => true): unknown[] | null {
  if (!Array.isArray(list)) return null;
  let changed = false;
  const next = list.map((item: unknown) => {
    if (!item || typeof item !== 'object') return item;
    const v = (item as Record<string, unknown>)[key];
    if (typeof v !== 'string' || !guard(v)) return item;
    const renamed = renameIn(v, oldPath, newPath);
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
export function followRenameInBlock(b: BlockInstance, oldPath: string, newPath: string): BlockInstance {
  const c = b.config;
  const patch: Record<string, unknown> = {};
  const set = (key: string, value: unknown): void => { if (value !== null) patch[key] = value; };
  switch (b.type) {
    case 'embedded-note': set('filePath', renameIn(c.filePath, oldPath, newPath)); break;
    case 'image-gallery': set('folder', renameIn(c.folder, oldPath, newPath)); break;
    case 'voice-dictation': set('folder', renameIn(c.folder, oldPath, newPath)); break;
    case 'folder-links':
      set('folder', renameIn(c.folder, oldPath, newPath));
      set('links', renameInList(c.links, 'path', oldPath, newPath));
      break;
    case 'button-grid': set('items', renameInList(c.items, 'link', oldPath, newPath)); break;
    case 'bookmarks': set('items', renameInList(c.items, 'url', oldPath, newPath, isVaultPath)); break;
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
