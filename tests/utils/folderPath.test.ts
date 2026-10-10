import { describe, it, expect } from 'vitest';
import { isInFolder, normalizeFolderPath } from '../../src/utils/folderPath';

describe('normalizeFolderPath (M67)', () => {
  it('drops spaces and slashes around a typed folder', () => {
    expect(normalizeFolderPath(' /Photos/ ')).toBe('Photos');
    expect(normalizeFolderPath('Photos//2026/')).toBe('Photos/2026');
    expect(normalizeFolderPath('/')).toBe('');
  });
});

describe('isInFolder (M68)', () => {
  it('matches files inside the folder, letter case aside, and nothing for the root', () => {
    expect(isInFolder('Templates/T.md', 'templates')).toBe(true);
    expect(isInFolder('Templates2/T.md', 'Templates')).toBe(false);
    expect(isInFolder('a.md', '')).toBe(false);
  });
});
