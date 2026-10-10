import { describe, it, expect } from 'vitest';
import { buildNoteContent, voiceNotePath } from '../../src/utils/voiceNote';

const none = () => false;

describe('voiceNotePath', () => {
  it('names the note after the timestamp, inside the folder', () => {
    expect(voiceNotePath('Voice', '2026-10-10 10-00-00', none)).toEqual({ folder: 'Voice', path: 'Voice/2026-10-10 10-00-00.md' });
  });

  it('uses the vault root for an empty folder', () => {
    expect(voiceNotePath('', 't', none)).toEqual({ folder: '', path: 't.md' });
  });

  it('adds a number when a note saved in the same second exists (R10)', () => {
    const taken = new Set(['Voice/t.md', 'Voice/t 2.md']);
    expect(voiceNotePath('Voice', 't', p => taken.has(p))?.path).toBe('Voice/t 3.md');
  });

  it('refuses a folder that climbs out of the vault (M17)', () => {
    expect(voiceNotePath('notes/../..', 't', none)).toBeNull();
  });

  it('strips leading slashes, a drive prefix and backslashes', () => {
    expect(voiceNotePath(String.raw`\C:\x\y`, 't', none)?.folder).toBe('x/y');
  });
});

describe('buildNoteContent (M12)', () => {
  it('is the transcript alone without a template', () => {
    expect(buildNoteContent('', 'hello')).toEqual({ content: 'hello', templateIgnored: false });
  });

  it('fills {{transcript}} in plain text, every occurrence', () => {
    expect(buildNoteContent('# Note\n\n{{transcript}}\n\n> {{transcript}}', 'hi').content).toBe('# Note\n\nhi\n\n> hi');
  });

  it('keeps the transcript of a template without the placeholder, below the template', () => {
    expect(buildNoteContent('#voice', 'hi').content).toBe('#voice\n\nhi');
  });

  it('keeps a transcript used as link text', () => {
    expect(buildNoteContent('[{{transcript}}](Note.md)', 'hi').content).toBe('[hi](Note.md)');
  });

  it.each([
    ['inside an HTML tag', '<img src="https://x.test/?d={{transcript}}">'],
    ['inside an image target', '![](https://x.test/?d={{transcript}})'],
    ['inside a link target', '[a](https://x.test/?d={{transcript}})'],
    ['in a reference definition', '[a]: https://x.test/?d={{transcript}}'],
    ['inside a style element', '<style>body{background:url(https://x.test/{{transcript}})}</style>'],
    ['after a > inside a quoted attribute', '<img alt=">" src="https://x.test/?d={{transcript}}">'],
    ['inside a link target with balanced parentheses', '![](https://x.test/?a=(b){{transcript}})'],
    ['on the next line of an HTML tag', '<img\n  src="https://x.test/?d={{transcript}}">'],
    ['in an @import of a style element that holds a blank line', '<style>\n\n@import "https://x.test/{{transcript}}";\n</style>'],
  ])('ignores a template that puts the transcript %s', (_where, template) => {
    expect(buildNoteContent(template, 'secret')).toEqual({ content: 'secret', templateIgnored: true });
  });
});
