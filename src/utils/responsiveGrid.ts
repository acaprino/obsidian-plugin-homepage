/**
 * Build a CSS grid-template-columns value that uses auto-fill to
 * collapse gracefully on narrow containers while respecting the
 * user's desired column count as a maximum.
 */
export function responsiveGridColumns(safeCols: number, minPx = 120): string {
  return `repeat(auto-fill, minmax(max(${minPx}px, calc(100% / ${safeCols})), 1fr))`;
}
