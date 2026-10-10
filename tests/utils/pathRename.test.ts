import { describe, it, expect } from 'vitest';
import { followRenameInBlock, renameLink, renamePath } from '../../src/utils/pathRename';
import type { BlockInstance } from '../../src/types';

const block = (type: BlockInstance['type'], config: Record<string, unknown>): BlockInstance =>
  ({ id: 'b', type, x: 0, y: 0, w: 1, h: 3, config });

describe('renamePath', () => {
  it('follows the file itself, with or without .md', () => {
    expect(renamePath('Notes/Old.md', 'Notes/Old.md', 'Notes/New.md')).toBe('Notes/New.md');
    expect(renamePath('Notes/Old', 'Notes/Old.md', 'Notes/New.md')).toBe('Notes/New');
  });

  it('follows anything inside a renamed folder', () => {
    expect(renamePath('Projects/2026/Plan.md', 'Projects', 'Work')).toBe('Work/2026/Plan.md');
    expect(renamePath('Projects', 'Projects', 'Work')).toBe('Work');
  });

  it('leaves other paths alone, including ones that only share a prefix', () => {
    expect(renamePath('Projects-old/Plan.md', 'Projects', 'Work')).toBeNull();
    expect(renamePath('Other.md', 'Notes/Old.md', 'Notes/New.md')).toBeNull();
  });
});

describe('followRenameInBlock (M55, M22)', () => {
  it('follows folder settings', () => {
    expect(followRenameInBlock(block('image-gallery', { folder: 'Pics' }), 'Pics', 'Photos').config.folder).toBe('Photos');
    expect(followRenameInBlock(block('folder-links', { folder: 'Projects/*.md' }), 'Projects', 'Work').config.folder).toBe('Work/*.md');
    expect(followRenameInBlock(block('voice-dictation', { folder: 'Voice' }), 'Voice', 'Dictation').config.folder).toBe('Dictation');
    expect(followRenameInBlock(block('recent-files', { excludeFolders: 'Templates, Archive' }), 'Templates', 'Tpl').config.excludeFolders).toBe('Tpl, Archive');
  });

  it('follows typed note links', () => {
    const b = followRenameInBlock(block('button-grid', { items: [{ label: 'a', link: 'Old' }, { label: 'b', link: 'Keep.md' }] }), 'Old.md', 'New.md');
    expect((b.config.items as { link: string }[]).map(i => i.link)).toEqual(['New', 'Keep.md']);
    const f = followRenameInBlock(block('folder-links', { links: [{ label: 'x', path: 'Old.md' }] }), 'Old.md', 'New.md');
    expect((f.config.links as { path: string }[])[0].path).toBe('New.md');
    const k = followRenameInBlock(block('bookmarks', { items: [{ url: 'Old.md' }, { url: 'https://Old.md' }] }), 'Old.md', 'New.md');
    expect((k.config.items as { url: string }[]).map(i => i.url)).toEqual(['New.md', 'https://Old.md']);
  });

  it('follows an embedded note, also when its folder is renamed', () => {
    expect(followRenameInBlock(block('embedded-note', { filePath: 'A/Note.md' }), 'A', 'B').config.filePath).toBe('B/Note.md');
  });

  it('returns the same block when nothing changed', () => {
    const b = block('clock', { format: 'Old.md' });
    expect(followRenameInBlock(b, 'Old.md', 'New.md')).toBe(b);
  });
});

describe('renameLink: links typed by name (M22, after review)', () => {
  const none = () => false;

  it('follows a note renamed in place, keeping brackets, heading and alias', () => {
    expect(renameLink('Plan', 'Projects/Plan.md', 'Projects/Roadmap.md', none)).toBe('Roadmap');
    expect(renameLink('[[Plan#Goals|the plan]]', 'Projects/Plan.md', 'Projects/Roadmap.md', none)).toBe('[[Roadmap#Goals|the plan]]');
    expect(renameLink('Projects/Plan#Goals', 'Projects/Plan.md', 'Archive/Plan.md', none)).toBe('Archive/Plan#Goals');
  });

  it('leaves a name that still resolves to another note', () => {
    expect(renameLink('Plan', 'Projects/Plan.md', 'Projects/Roadmap.md', name => name === 'Plan')).toBeNull();
  });

  it('is followed in Button grid and Quick links', () => {
    const grid = { id: 'g', type: 'button-grid' as const, x: 0, y: 0, w: 1, h: 3, config: { items: [{ label: 'P', link: '[[Plan]]' }] } };
    const out = followRenameInBlock(grid, 'Projects/Plan.md', 'Projects/Roadmap.md', none);
    expect((out.config.items as { link: string }[])[0].link).toBe('[[Roadmap]]');
  });
});

describe('renamePath and how folders are typed (minor)', () => {
  it('follows a value typed with slashes around it', () => {
    expect(renamePath('/Photos/', 'Photos', 'Pictures')).toBe('Pictures');
  });

  it('follows a value typed in another letter case', () => {
    expect(renamePath('photos/2026', 'Photos', 'Pictures')).toBe('Pictures/2026');
  });
});
