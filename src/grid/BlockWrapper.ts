import { BlockInstance } from '../types';
import { applyBlockStyling } from '../utils/blockStyling';
import { Scheduler } from '../utils/Scheduler';

/**
 * Block-wrapper / placeholder / skeleton / empty-state DOM builders, extracted
 * from GridLayout. These are presentation-only helpers: they build DOM from a
 * BlockInstance (plus, where needed, a Scheduler for the skeleton fade or
 * empty-state callbacks). No GridStack, no persistence — GridLayout owns the
 * lifecycle and calls these to populate each grid item's content container.
 *
 * Covered by tests/grid/GridLayout.render.test.ts (wrapper structure, edit-mode
 * placeholders, empty state).
 */

/** Build the block wrapper DOM inside a GridStack item content div using Obsidian's DOM API. */
export function buildBlockWrapper(container: HTMLElement, instance: BlockInstance, animDelayMs?: number): HTMLElement {
  const classes = ['homepage-block-wrapper'];
  // Don't collapse blocks with hidden titles — there's no visible header
  // to click for re-expansion, making them appear completely invisible.
  const effectiveCollapsed = instance.collapsed && instance.config._showTitle !== false;
  if (effectiveCollapsed) classes.push('block-collapsed');
  const wrapper = container.createDiv({
    cls: classes.join(' '),
    attr: { 'data-block-id': instance.id },
  });
  applyBlockStyling(wrapper, instance.config);
  if (animDelayMs !== undefined) {
    wrapper.style.setProperty('--hp-card-anim-delay', `${animDelayMs}ms`);
  }
  const headerZone = wrapper.createDiv({
    cls: 'block-header-zone',
    attr: { role: 'button', tabindex: '0', 'aria-expanded': String(!effectiveCollapsed) },
  });
  headerZone.createSpan({
    cls: 'block-collapse-chevron' + (effectiveCollapsed ? ' is-collapsed' : ''),
    attr: { 'aria-hidden': 'true' },
  });
  if (instance.config._showDivider === true) {
    wrapper.createDiv({ cls: 'block-header-divider' });
  }
  wrapper.createDiv({ cls: 'block-content' });
  return wrapper;
}

/** Create a shimmer skeleton overlay inside the block wrapper for perceived loading speed. */
export function createSkeleton(wrapper: HTMLElement): HTMLElement {
  const overlay = wrapper.createDiv({ cls: 'hp-skeleton-overlay' });
  overlay.createDiv({ cls: 'hp-skeleton-line' });
  overlay.createDiv({ cls: 'hp-skeleton-line' });
  overlay.createDiv({ cls: 'hp-skeleton-line' });
  return overlay;
}

/** Fade out and remove a skeleton overlay. The Scheduler keeps the fade timer cancellable on teardown. */
export function removeSkeleton(el: HTMLElement | null, scheduler: Scheduler): void {
  if (!el?.isConnected) return;
  el.classList.add('hp-skeleton-overlay--out');
  // Short-lived timer; cleanup binds to GridLayout's scheduler so a teardown
  // mid-fade doesn't leak a pending el.remove() on a detached node.
  const token = `skeleton-${Math.random()}`;
  scheduler.timeout(token, 200, () => el.remove());
}

/** Render a lightweight symbolic placeholder for edit mode (no real block content). */
export function renderCompactPlaceholder(
  headerZone: HTMLElement,
  contentEl: HTMLElement,
  factory: { displayName: string },
  instance: BlockInstance,
): void {
  // Show block type name in header zone
  const titleLabel = typeof instance.config._titleLabel === 'string' && instance.config._titleLabel
    ? instance.config._titleLabel
    : factory.displayName;
  const emoji = typeof instance.config._titleEmoji === 'string' ? instance.config._titleEmoji : '';
  const header = headerZone.createDiv({ cls: 'block-header' });
  if (emoji) header.createEl('em', { cls: 'block-header-emoji', text: emoji });
  header.createSpan({ text: titleLabel });

  // Compact info in content area
  const info = contentEl.createDiv({ cls: 'block-compact-info' });
  info.createSpan({ cls: 'block-compact-type', text: instance.type });
  info.createSpan({ cls: 'block-compact-size', text: `${instance.w}×${instance.h}` });
}

/** Render the homepage empty state (view-mode hint, or an edit-mode CTA). */
export function renderEmptyState(
  gridEl: HTMLElement,
  opts: { editMode: boolean; onRequestAddBlock: (() => void) | null },
): void {
  gridEl.empty();
  const empty = gridEl.createDiv({ cls: 'homepage-empty-state' });
  empty.createDiv({ cls: 'homepage-empty-icon', text: '\u{1F3E0}' });
  empty.createEl('p', { cls: 'homepage-empty-title', text: 'Your homepage is empty' });
  empty.createEl('p', {
    cls: 'homepage-empty-desc',
    text: opts.editMode
      ? 'Click the button below to add your first block.'
      : 'Toggle Edit mode in the toolbar to start adding blocks.',
  });
  if (opts.editMode && opts.onRequestAddBlock) {
    const cta = empty.createEl('button', { cls: 'homepage-empty-cta', text: 'Add your first block' });
    cta.addEventListener('click', () => { opts.onRequestAddBlock?.(); });
  }
}
