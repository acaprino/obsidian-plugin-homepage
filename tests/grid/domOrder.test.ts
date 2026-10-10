import { describe, it, expect } from 'vitest';
import { orderChildren } from '../../src/grid/domOrder';

function list(...ids: string[]): HTMLElement {
  const parent = document.createElement('div');
  for (const id of ids) parent.appendChild(Object.assign(document.createElement('div'), { id }));
  return parent;
}

/** Counts the moves: each one reloads an iframe inside the moved item. */
function countMoves(parent: HTMLElement): () => number {
  let moves = 0;
  const insert = parent.insertBefore.bind(parent);
  const append = parent.appendChild.bind(parent);
  parent.insertBefore = (<T extends Node>(n: T, r: Node | null) => { moves++; return insert(n, r); }) as typeof parent.insertBefore;
  parent.appendChild = (<T extends Node>(n: T) => { moves++; return append(n); }) as typeof parent.appendChild;
  return () => moves;
}

describe('orderChildren (M78)', () => {
  it('moves nothing when the order is already right', () => {
    const parent = list('a', 'b', 'c');
    const moves = countMoves(parent);
    orderChildren(parent, [...parent.children] as HTMLElement[]);
    expect(moves()).toBe(0);
  });

  it('moves only the element that is out of place', () => {
    const parent = list('a', 'b', 'c', 'd');
    const [a, b, c, d] = [...parent.children] as HTMLElement[];
    const moves = countMoves(parent);

    orderChildren(parent, [a, c, d, b]);

    expect([...parent.children].map(e => e.id)).toEqual(['a', 'c', 'd', 'b']);
    expect(moves()).toBe(1);
  });
});
