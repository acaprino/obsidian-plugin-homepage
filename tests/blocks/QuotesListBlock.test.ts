import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { AUTO_HEIGHT_ATTR } from '../../src/grid/AutoHeight';
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

/** A Quotes block that is never rendered, for its settings UI. */
function mountQuotesBlock() {
  const instance: BlockInstance = { id: 'q2', type: 'quotes-list', x: 0, y: 0, w: 2, h: 3, config: {} };
  return { block: new QuotesListBlock({} as App, instance, {} as IHomepagePlugin) };
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

describe('QuotesListBlock live updates (R9)', () => {
  it('re-renders when a note it shows loses the tag', async () => {
    const shown = { path: 'Q.md', basename: 'Q' };
    const { rendered, fire, reads } = mountQuotes({ source: 'tag', tag: '#qr9', maxItems: 0, heightMode: 'extend' }, [shown]);
    await rendered;
    expect(reads()).toBe(1);

    fire('changed', shown, '', { tags: [] });
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(reads()).toBe(2);
  });
});

describe('QuotesListBlock Max quotes setting (N16)', () => {
  function maxQuotesField(draft: Record<string, unknown>): HTMLInputElement {
    const body = document.body.createDiv();
    const { block } = mountQuotesBlock();
    block.renderContentSettings(body, draft);
    const item = [...body.querySelectorAll('.setting-item')].find(el => el.querySelector('.setting-item-name')?.textContent === 'Max quotes');
    return item!.querySelector('input') as HTMLInputElement;
  }

  it('shows the 20 quotes a block without the setting renders, not "All"', () => {
    expect(maxQuotesField({}).value).toBe('20');
  });

  it('shows all for 0 and the stored number otherwise', () => {
    expect(maxQuotesField({ maxItems: 0 }).value).toBe('');
    expect(maxQuotesField({ maxItems: 7 }).value).toBe('7');
  });
});

describe('QuotesListBlock single text quote, Grow to fit (M36)', () => {
  it('is measured for auto-height like the other modes', () => {
    const { el } = mountQuotes({ source: 'text', maxItems: 1, quotes: 'A long quote\n— Someone', heightMode: 'extend' });
    const card = el.querySelector('.insight-card') as HTMLElement;
    expect(card.hasAttribute(AUTO_HEIGHT_ATTR)).toBe(true);
    expect(el.classList.contains('quotes-list-block--extend')).toBe(true);
  });

  it('is not in Wrap mode', () => {
    const { el } = mountQuotes({ source: 'text', maxItems: 1, quotes: 'A quote', heightMode: 'wrap' });
    expect((el.querySelector('.insight-card') as HTMLElement).hasAttribute(AUTO_HEIGHT_ATTR)).toBe(false);
  });
});
