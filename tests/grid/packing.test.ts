import { describe, it, expect } from 'vitest';
import { packRows, repackEditLayout } from '../../src/grid/packing';
import type { BlockInstance } from '../../src/types';

type Item = { x?: number; y?: number; w?: number; h?: number };

describe('packRows (row-group-aware)', () => {
  it('is a no-op on an empty array', () => {
    const items: Item[] = [];
    expect(() => packRows(items, 3)).not.toThrow();
    expect(items).toEqual([]);
  });

  it('compacts a single item to the top (y=0)', () => {
    const items: Item[] = [{ x: 0, y: 10, w: 1, h: 2 }];
    packRows(items, 3);
    expect(items[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 2 });
  });

  it('keeps items that shared an input row on the same output row', () => {
    const items: Item[] = [
      { x: 0, y: 0, w: 1, h: 2 },
      { x: 1, y: 0, w: 1, h: 3 },
    ];
    packRows(items, 3);
    expect(items[0].y).toBe(0);
    expect(items[1].y).toBe(0);
  });

  it('stacks a lower row beneath the tallest block of the row above', () => {
    const items: Item[] = [
      { x: 0, y: 0, w: 1, h: 2 },
      { x: 0, y: 5, w: 1, h: 1 },
    ];
    packRows(items, 3);
    expect(items[0].y).toBe(0);
    // second item sits below the first (height 2) in the same column
    expect(items[1].y).toBe(2);
  });

  it('clamps width to the column count and x so the block fits', () => {
    const items: Item[] = [{ x: 5, y: 0, w: 5, h: 1 }];
    packRows(items, 3);
    expect(items[0].w).toBe(3);
    expect(items[0].x).toBe(0);
  });

  it('reflow mode places independent single-cell items side by side on the top row', () => {
    const items: Item[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0, y: 0, w: 1, h: 1 },
    ];
    packRows(items, 3, 'row', true);
    expect(items.every(i => i.y === 0)).toBe(true);
    // distinct columns
    expect(new Set(items.map(i => i.x)).size).toBe(2);
  });

  it('treats columns < 1 as a single column without crashing', () => {
    const items: Item[] = [{ x: 0, y: 0, w: 3, h: 1 }];
    packRows(items, 0);
    expect(items[0].w).toBe(1);
    expect(items[0].x).toBe(0);
  });
});

describe('repackEditLayout', () => {
  const block = (id: string, over: Partial<BlockInstance>): BlockInstance => ({
    id, type: 'clock', x: 0, y: 0, w: 1, h: 3, config: {}, ...over,
  });

  it('does not mutate the input blocks', () => {
    const input = [block('a', { x: 0, y: 99, w: 1, h: 2 })];
    const snapshot = structuredClone(input);
    repackEditLayout(input, 3);
    expect(input).toEqual(snapshot);
  });

  it('returns a collision-free, top-compacted layout', () => {
    const out = repackEditLayout([
      block('a', { x: 0, y: 10, w: 1, h: 2 }),
      block('b', { x: 0, y: 20, w: 1, h: 1 }),
    ], 3);
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBe(2);
  });
});
