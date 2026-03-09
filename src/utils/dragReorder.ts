/**
 * Attach HTML5 Drag & Drop reordering to a list of items.
 * On drop, splices the source item to the new position and re-renders.
 */
export function enableDragReorder<T>(
  row: HTMLElement,
  index: number,
  items: T[],
  state: { dragIdx: number },
  renderList: () => void,
): void {
  row.setAttribute('draggable', 'true');
  row.addEventListener('dragstart', (e) => {
    state.dragIdx = index;
    row.addClass('is-dragging');
    e.dataTransfer?.setData('text/plain', String(index));
  });
  row.addEventListener('dragend', () => { row.removeClass('is-dragging'); });
  row.addEventListener('dragover', (e) => { e.preventDefault(); row.addClass('drag-over'); });
  row.addEventListener('dragleave', () => { row.removeClass('drag-over'); });
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.removeClass('drag-over');
    if (state.dragIdx >= 0 && state.dragIdx !== index) {
      const [moved] = items.splice(state.dragIdx, 1);
      items.splice(index, 0, moved);
      renderList();
    }
  });
  const grip = row.createSpan({ cls: 'drag-grip', text: '\u2630' });
  grip.setAttribute('aria-label', 'Drag to reorder');
}
