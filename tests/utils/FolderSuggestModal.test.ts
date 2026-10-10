import { describe, it, expect } from 'vitest';
import { TFolder, type App } from 'obsidian';
import { FolderSuggestModal } from '../../src/utils/FolderSuggestModal';

function vaultWith(...paths: string[]): App {
  const root = new TFolder();
  root.path = '/';
  root.children = paths.map(p => { const f = new TFolder(); f.path = p; f.children = []; return f; });
  return { vault: { getRoot: () => root } } as unknown as App;
}

describe('FolderSuggestModal (M67)', () => {
  it('offers the vault root by default', () => {
    const modal = new FolderSuggestModal(vaultWith('Photos'), () => {});
    expect(modal.getSuggestions('').map(f => f.path)).toEqual(['/', 'Photos']);
  });

  it('leaves the root out for blocks that need a subfolder', () => {
    const modal = new FolderSuggestModal(vaultWith('Photos'), () => {}, { includeRoot: false });
    expect(modal.getSuggestions('').map(f => f.path)).toEqual(['Photos']);
  });
});
