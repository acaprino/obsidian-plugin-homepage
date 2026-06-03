import { BlockInstance, LayoutPriority } from '../types';

/**
 * Pure grid-packing helpers, extracted from GridLayout so the layout math can
 * be unit-tested in isolation and GridLayout stays focused on the GridStack
 * lifecycle. No DOM, no instance state — just position arithmetic.
 */

/**
 * Row-group-aware packing: items sharing the same y form a "row group" and
 * stay on the same row in the output, preserving visual row grouping.
 * Mutates items in place. Works on any object with { x, y, w, h }.
 *
 * When `reflow=true` (responsive column change), falls back to greedy
 * column-height packing: each item is assigned the x with the lowest max
 * height. Row groups don't apply because old x positions are meaningless
 * after a column count change.
 *
 * @param _priority Reserved for future use; grouping is always by y.
 */
export function packRows<T extends { x?: number; y?: number; w?: number; h?: number }>(
  items: T[], columns: number, _priority: LayoutPriority = 'row', reflow = false,
): void {
  const safeCols = Math.max(1, columns);
  const colHeights = new Array<number>(safeCols).fill(0);

  if (reflow) {
    // Greedy best-fit placement for responsive column changes
    items.sort((a, b) =>
      (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
    );
    for (const item of items) {
      const w = Math.min(item.w ?? 1, safeCols);
      let x = 0;
      let bestY = Infinity;
      for (let cx = 0; cx <= safeCols - w; cx++) {
        let maxH = 0;
        for (let c = cx; c < cx + w; c++) {
          maxH = Math.max(maxH, colHeights[c] ?? 0);
        }
        if (maxH < bestY) { bestY = maxH; x = cx; }
      }
      item.x = x;
      item.w = w;
      item.y = bestY;
      for (let c = x; c < x + w; c++) {
        colHeights[c] = bestY + (item.h ?? 1);
      }
    }
    return;
  }

  // Row-group-aware packing: group items by their input y, preserving
  // the visual row layout. Blocks that shared a row in the input stay
  // together in the output, preventing greedy reordering.
  const groupMap = new Map<number, T[]>();
  for (const item of items) {
    const y = item.y ?? 0;
    let g = groupMap.get(y);
    if (!g) { g = []; groupMap.set(y, g); }
    g.push(item);
  }

  // Process groups by ascending input y; sort within group by x for
  // left-to-right placement.
  const groups = [...groupMap.values()];
  groups.sort((a, b) => (a[0].y ?? 0) - (b[0].y ?? 0));
  for (const g of groups) g.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  for (const group of groups) {
    // Find the earliest y where all blocks in this group fit (no overlap)
    let rowY = 0;
    for (const item of group) {
      const w = Math.min(item.w ?? 1, safeCols);
      const x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
      for (let c = x; c < x + w; c++) {
        rowY = Math.max(rowY, colHeights[c] ?? 0);
      }
    }

    // Place all items in the group at rowY, clamp x and w
    for (const item of group) {
      const w = Math.min(item.w ?? 1, safeCols);
      item.w = w;
      item.x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
      item.y = rowY;
    }

    // Advance column heights (Math.max handles overlapping spans safely)
    for (const item of group) {
      const x = item.x ?? 0;
      const w = item.w ?? 1;
      const h = item.h ?? 1;
      for (let c = x; c < x + w; c++) {
        colHeights[c] = Math.max(colHeights[c] ?? 0, rowY + h);
      }
    }
  }
}

/**
 * After exiting edit mode, y-positions saved during editing reflect compact
 * heights (COMPACT_EDIT_H) and may overlap at full view-mode heights. Re-pack
 * into a collision-free layout using real h values. Returns a new array; does
 * not mutate the input blocks.
 */
export function repackEditLayout(blocks: BlockInstance[], columns: number, priority: LayoutPriority = 'row'): BlockInstance[] {
  const packed = blocks.map(b => ({ ...b }));
  packRows(packed, columns, priority);
  return packed;
}
