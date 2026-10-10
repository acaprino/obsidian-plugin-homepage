import { describe, it, expect } from 'vitest';
import { responsiveGridColumns } from '../../src/utils/responsiveGrid';

describe('responsiveGridColumns (M97)', () => {
  it('leaves room for the gaps, so N columns fit', () => {
    // N tracks of 100%/N plus N-1 gaps overflow the row: auto-fill then made one column fewer.
    expect(responsiveGridColumns(2, 120, 6)).toBe('repeat(auto-fill, minmax(max(120px, calc((100% - 6px) / 2)), 1fr))');
    expect(responsiveGridColumns(4, 100, 8)).toBe('repeat(auto-fill, minmax(max(100px, calc((100% - 24px) / 4)), 1fr))');
  });

  it('needs no gap allowance for one column', () => {
    expect(responsiveGridColumns(1, 120, 6)).toBe('repeat(auto-fill, minmax(max(120px, calc((100% - 0px) / 1)), 1fr))');
  });
});
