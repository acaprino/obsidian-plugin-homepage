import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { QuotesListBlock } from '../../src/blocks/QuotesListBlock';
import { BlockRegistry } from '../../src/BlockRegistry';
import { registerBlocks } from '../../src/main';
import { getDefaultLayout } from '../../src/validation';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

type Handler = (...args: unknown[]) => void;

/** Each test uses its own tag: the module-level tag cache in utils/tags.ts outlives a test. */
function mountQuotes(config: Record<string, unknown>, files: { path: string; basename: string }[] = []) {
  const handlers: Record<string, Handler[]> = {};
  let reads = 0;
  const on = (event: string, h: Handler) => { (handlers[event] ??= []).push(h); return {}; };
  const app = {
    vault: { on, getMarkdownFiles: () => files, read: async () => { reads++; return 'A quote'; } },
    metadataCache: { on, getFileCache: () => ({ tags: [{ tag: config.tag }] }) },
  } as unknown as App;
  const instance: BlockInstance = { id: 'q1', type: 'quotes-list', x: 0, y: 0, w: 2, h: 3, config };
  const block = new QuotesListBlock(app, instance, { activeBlocks: () => [instance] } as unknown as IHomepagePlugin);
  const el = document.body.createDiv({ cls: 'block-content' });
  block.load();
  const rendered = block.render(el);
  const fire = (event: string, ...args: unknown[]) => { for (const h of handlers[event] ?? []) h(...args); };
  return { el, rendered, fire, reads: () => reads };
}

beforeEach(() => { document.body.empty(); registerBlocks(); });

describe('QuotesListBlock Max quotes default (N16)', () => {
  it('shows at most 20 quotes for a new block, like a block saved without the setting', async () => {
    const quotes = Array.from({ length: 25 }, (_, i) => `quote ${i}`).join('\n---\n');
    const defaults = BlockRegistry.get('quotes-list')!.defaultConfig;
    const { el, rendered } = mountQuotes({ ...defaults, source: 'text', quotes });
    await rendered;

    expect(el.querySelectorAll('.quote-item')).toHaveLength(20);
  });

  it('starts the default layout with one daily insight', () => {
    const insight = getDefaultLayout().blocks.find(b => b.id === 'default-insight')!;
    expect(insight.config.maxItems).toBe(1);
  });
});
