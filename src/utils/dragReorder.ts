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
  // A button, so the keyboard reaches it: Alt+Arrow up or down moves the row,
  // which only a mouse drag could do (M115).
  const grip = row.createEl('button', { cls: 'drag-grip', text: '\u2630' });
  grip.setAttribute('aria-label', 'Reorder: drag, or hold alt and press the up or down arrow');
  grip.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    const parent = row.parentElement;
    const [moved] = items.splice(index, 1);
    items.splice(to, 0, moved);
    renderList();
    parent?.children[to]?.querySelector<HTMLElement>('.drag-grip')?.focus();
  });
}
