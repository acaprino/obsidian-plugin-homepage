import { describe, it, expect } from 'vitest';
import { noteBlocks, notePreview, noteQuote, parseNoteInsight } from '../../src/utils/noteContent';

const blocks = (md: string) => noteBlocks(md, null);

describe('noteBlocks: what Obsidian shows, as plain text (M44)', () => {
  it('drops callout and blockquote markers', () => {
    expect(blocks('> [!quote]\n> The obstacle is the way.')).toEqual([['The obstacle is the way.']]);
    expect(blocks('> [!quote]- Marcus\n> Text')).toEqual([['Marcus', 'Text']]);
    expect(blocks('> > Nested')).toEqual([['Nested']]);
  });

  it('skips code blocks and math', () => {
    expect(blocks('```dataview\nLIST FROM #q\n```\nReal quote')).toEqual([['Real quote']]);
    expect(blocks('~~~\ncode\n~~~\n$$\nx^2\n$$\nAfter')).toEqual([['After']]);
  });

  it('hides comments, which Obsidian hides', () => {
    expect(blocks('Public %%private%% text\n%%\nsecret\n%%\n<!-- hidden -->')).toEqual([['Public text']]);
    expect(blocks('<!--\nmulti\nline\n-->\nShown')).toEqual([['Shown']]);
  });

  it('skips tables, inline fields and block ids', () => {
    expect(blocks('| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter')).toEqual([['After']]);
    expect(blocks('rating:: 5\nA line ^abc-123\nSee [key:: v] here')).toEqual([['A line', 'See here']]);
  });

  it('shows link text, not targets, and drops embeds', () => {
    expect(blocks('[[Folder/Note|alias]] and [[Other]] and [text](https://x.it) ![[img.png]]')).toEqual([['alias and Other and text']]);
  });

  it('drops list and task markers', () => {
    expect(blocks('- item one\n- [ ] task\n1. first')).toEqual([['item one', 'task', 'first']]);
  });

  it('splits paragraphs at blank lines and skips the frontmatter', () => {
    expect(blocks('---\ntags: [q]\n---\nOne\n\nTwo')).toEqual([['One'], ['Two']]);
  });
});

describe('noteBlocks: a line that starts with a tag is not a heading (M45)', () => {
  it('keeps the line, without its leading tags', () => {
    expect(blocks('#quote The obstacle is the way.')).toEqual([['The obstacle is the way.']]);
    expect(blocks('#quote #stoic Text')).toEqual([['Text']]);
    expect(blocks('#quote')).toEqual([]);
  });

  it('drops headings', () => {
    expect(blocks('# Title\n## Sub\nBody')).toEqual([['Body']]);
  });
});

describe('parseNoteInsight (M89)', () => {
  it('takes the title from a heading only when the note starts with it', () => {
    expect(parseNoteInsight('# Stoic\nText', null)).toEqual({ heading: 'Stoic', body: 'Text' });
    expect(parseNoteInsight('Intro text\n\n## Related\n- x', null).heading).toBe('');
  });

  it('joins the whole body', () => {
    expect(parseNoteInsight('One\n\nTwo', null).body).toBe('One Two');
  });
});

describe('noteQuote (M88)', () => {
  it('takes the first paragraph in full and keeps the author line', () => {
    const q = noteQuote('Line one\nLine two\nLine three\nLine four\n— Seneca\n\nSecond paragraph', null);
    expect(q).toEqual({ text: 'Line one Line two Line three Line four', author: 'Seneca' });
  });

  it('caps a long quote by characters, with an ellipsis', () => {
    const q = noteQuote('word '.repeat(200), null, 50);
    expect(q.text.length).toBeLessThanOrEqual(50);
    expect(q.text.endsWith('…')).toBe(true);
  });
});

describe('notePreview', () => {
  it('is the first paragraph as plain text, capped', () => {
    expect(notePreview('> [!note]\n> **Bold** idea', null)).toBe('Bold idea');
    expect(notePreview('x'.repeat(500), null, 200)).toHaveLength(200);
  });
});
