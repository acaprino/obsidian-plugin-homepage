import { normalizePath } from 'obsidian';

/**
 * A typed folder setting as a vault path: trimmed, without slashes around it;
 * '' for the root. Used as typed, `Photos/` or `/Photos` was "not found" (M67).
 */
export function normalizeFolderPath(raw: string): string {
  const path = normalizePath(raw.trim().replace(/^\/+|\/+$/g, ''));
  return path === '/' ? '' : path;
}

/** True when `path` lies inside `folder`, letter case aside; never for the root (M68). */
export function isInFolder(path: string, folder: string): boolean {
  return folder !== '' && path.toLowerCase().startsWith(folder.toLowerCase() + '/');
}
