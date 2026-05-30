import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { VaultSearchBlock } from '../../src/blocks/VaultSearchBlock';
import type { IHomepagePlugin, BlockInstance } from '../../src/types';

/**
 * Regression test for CONTRACT-1: VaultSearchBlock must opt into the
 * rerender-suppression guard whenever it holds a non-empty typed query, so an
 * external rerender can't wipe an in-progress search.
 */

function makeBlock(): VaultSearchBlock {
  const app = {
    vault: { getMarkdownFiles: () => [] },
    workspace: { openLinkText: () => {} },
  } as unknown as App;
  const instance: BlockInstance = { id: 's1', type: 'vault-search', x: 0, y: 0, w: 2, h: 2, config: {} };
  const plugin = { app } as unknown as IHomepagePlugin;
  return new VaultSearchBlock(app, instance, plugin);
}

describe('VaultSearchBlock.hasUnsavedInlineState (CONTRACT-1)', () => {
  let block: VaultSearchBlock;
  let input: HTMLInputElement;

  beforeEach(() => {
    document.body.empty();
    block = makeBlock();
    const el = document.body.createDiv();
    block.render(el);
    input = el.querySelector('.vault-search-input') as HTMLInputElement;
  });

  it('is false when the field is empty', () => {
    expect(input).toBeTruthy();
    expect(block.hasUnsavedInlineState()).toBe(false);
  });

  it('is true when a non-empty query is typed', () => {
    input.value = 'meeting notes';
    expect(block.hasUnsavedInlineState()).toBe(true);
  });

  it('treats a whitespace-only query as empty', () => {
    input.value = '   ';
    expect(block.hasUnsavedInlineState()).toBe(false);
  });
});
