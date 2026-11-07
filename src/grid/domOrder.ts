/**
 * Put `ordered` (children of `parent`) in that order, moving only the elements
 * out of place: the longest run already in order stays where it is. Re-appending
 * every item reloaded each iframe inside it, restarting a playing video (M78).
 */
export function orderChildren(parent: HTMLElement, ordered: HTMLElement[]): void {
  const position = new Map<Element, number>();
  Array.from(parent.children).forEach((el, i) => position.set(el, i));
  const keep = longestIncreasing(ordered.map(el => position.get(el) ?? -1));
  // From the end, so each moved element goes right before its settled successor.
  let next: HTMLElement | null = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (!keep.has(i)) parent.insertBefore(ordered[i], next);
    next = ordered[i];
  }
}

/**
 * Stop a GridStack from sorting its own items. Since 13.1 it re-appends them all
 * when a layout change alters the visual order. Without `moveBefore` (Safari, iOS,
 * Chromium before 133, so Obsidian 1.8.x) that reloads every iframe inside them (M78).
 * The cost: GridStack no longer keeps the DOM order equal to the visual order between
 * renders, so Tab and print follow the order of the last `render()`.
 *
 * `_sortDom` is GridStack's internal name. A release that renames it would turn this
 * into a silent no-op, so a missing method is reported instead of assigned over; the
 * DOM-order test in GridLayout.render.test.ts fails for the same reason.
 */
export function disableGridStackDomSort(grid: object): void {
  const target = grid as { _sortDom?: unknown };
  if (typeof target._sortDom !== 'function') {
    console.warn('[Homepage Blocks] GridStack has no _sortDom to turn off: video and iframe blocks may reload when blocks move. Check the gridstack version.');
    return;
  }
  target._sortDom = () => undefined;
}

/** Indices of a longest strictly increasing subsequence of `seq` (patience sorting). */
function longestIncreasing(seq: number[]): Set<number> {
  const tails: number[] = []; // index into seq of the smallest tail for each length
  const prev = new Array<number>(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]] < seq[i]) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const keep = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(i);
  return keep;
}
