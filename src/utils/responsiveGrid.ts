/**
 * Build a CSS grid-template-columns value that uses auto-fill to
 * collapse gracefully on narrow containers while respecting the
 * user's desired column count as a maximum. Each track's minimum leaves room
 * for the `gapPx` gaps between the columns: N tracks of 100%/N plus the gaps
 * overflowed the row, and auto-fill drew one column fewer (M97).
 */
export function responsiveGridColumns(safeCols: number, minPx = 120, gapPx = 8): string {
  return `repeat(auto-fill, minmax(max(${minPx}px, calc((100% - ${(safeCols - 1) * gapPx}px) / ${safeCols})), 1fr))`;
}
