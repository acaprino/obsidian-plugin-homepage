import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { BaseBlock } from '../../src/blocks/BaseBlock';
import type { IHomepagePlugin, BlockInstance } from '../../src/types';

/** Concrete subclass that exposes the protected render helpers for testing. */
class TestBlock extends BaseBlock {
  render(): void { /* unused */ }
  showError(el: HTMLElement, msg: string): void { this.renderErrorHint(el, msg); }
  header(el: HTMLElement, title: string): void { this.renderHeader(el, title); }
}

function make(config: Record<string, unknown> = {}): TestBlock {
  const instance: BlockInstance = { id: 't1', type: 'clock', x: 0, y: 0, w: 1, h: 1, config };
  return new TestBlock({} as App, instance, {} as IHomepagePlugin);
}

let el: HTMLElement;
beforeEach(() => {
  document.body.empty();
  el = document.body.createDiv();
});

describe('BaseBlock.renderErrorHint', () => {
  it('clears the element and renders a styled error hint', () => {
    el.createDiv({ cls: 'leftover' }); // pre-existing content must be cleared
    make().showError(el, 'Could not load');

    expect(el.querySelector('.leftover')).toBeNull();
    const hint = el.querySelector('.block-empty-hint.block-error-hint');
    expect(hint).toBeTruthy();
    expect(hint!.querySelector('.block-empty-hint-icon')?.textContent).toBe('⚠');
    expect(hint!.querySelector('.block-empty-hint-text')?.textContent).toBe('Could not load');
  });
});

describe('BaseBlock.renderHeader', () => {
  it('renders the passed title by default', () => {
    make().header(el, 'Clock');
    expect(el.querySelector('.block-header')?.textContent).toContain('Clock');
  });

  it('prefers a configured _titleLabel over the passed title', () => {
    make({ _titleLabel: 'My label' }).header(el, 'Clock');
    expect(el.querySelector('.block-header')?.textContent).toContain('My label');
  });

  it('renders nothing when _showTitle is false', () => {
    make({ _showTitle: false }).header(el, 'Clock');
    expect(el.querySelector('.block-header')).toBeNull();
  });

  it('prepends the configured emoji', () => {
    make({ _titleEmoji: '⏰' }).header(el, 'Clock');
    expect(el.querySelector('.block-header-emoji')?.textContent).toBe('⏰');
  });
});
