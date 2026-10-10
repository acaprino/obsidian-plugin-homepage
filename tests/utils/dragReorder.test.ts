import { describe, it, expect, beforeEach } from 'vitest';
import { enableDragReorder } from '../../src/utils/dragReorder';

beforeEach(() => { document.body.empty(); });

/** A list of rows like the Button grid, Bookmarks and Quick links settings draw. */
function list(items: string[]) {
  const parent = document.body.createDiv();
  const state = { dragIdx: -1 };
  const render = () => {
    parent.empty();
    items.forEach((label, i) => {
      const row = parent.createDiv({ cls: 'row', text: label });
      enableDragReorder(row, i, items, state, render);
    });
  };
  render();
  return { parent, items };
}

describe('enableDragReorder from the keyboard (M115)', () => {
  it('moves a row with Alt+Arrow on its grip, keeping the focus on it', () => {
    const { parent, items } = list(['a', 'b', 'c']);
    const grip = parent.children[0].querySelector('.drag-grip') as HTMLElement;
    expect(grip.tagName).toBe('BUTTON');
    grip.focus();

    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));

    expect(items).toEqual(['b', 'a', 'c']);
    expect(document.activeElement).toBe(parent.children[1].querySelector('.drag-grip'));
  });

  it('stops at the ends of the list', () => {
    const { parent, items } = list(['a', 'b']);
    const grip = parent.children[0].querySelector('.drag-grip') as HTMLElement;
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
    expect(items).toEqual(['a', 'b']);
  });
});
