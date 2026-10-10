import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { HtmlBlock } from '../../src/blocks/HtmlBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

/** happy-dom lays nothing out: a ResizeObserver stub that lets the test report sizes by hand. */
function stubResizeObserver() {
  const observers: { cb: (entries: { target: Element; contentRect: { width: number; height: number } }[]) => void; targets: Element[] }[] = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    private rec: (typeof observers)[number];
    constructor(cb: (typeof observers)[number]['cb']) { this.rec = { cb, targets: [] }; observers.push(this.rec); }
    observe(t: Element): void { this.rec.targets.push(t); }
    unobserve(): void {}
    disconnect(): void { this.rec.targets = []; }
  } as unknown as typeof ResizeObserver;
  return {
    /** Report a size for `el` to every observer watching it. */
    resize(el: Element, width: number, height: number): void {
      for (const o of observers) if (o.targets.includes(el)) o.cb([{ target: el, contentRect: { width, height } }]);
    },
    restore(): void { globalThis.ResizeObserver = original; },
  };
}

const frame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

beforeEach(() => { document.body.empty(); });

/** A document-mode HTML block whose iframe document is a double: a body taller than the frame. */
function mountDocument(host: HTMLElement) {
  const instance: BlockInstance = { id: 'h', type: 'html', x: 0, y: 0, w: 2, h: 3, config: { html: '<style>p{}</style><p>Hi</p>' } };
  const block = new HtmlBlock({} as App, instance, {} as IHomepagePlugin);
  const el = host.createDiv();
  block.load();
  block.render(el);
  const iframe = el.querySelector('iframe') as HTMLIFrameElement;
  const doc = document.implementation.createHTMLDocument('x');
  Object.defineProperty(doc.documentElement, 'scrollHeight', { configurable: true, get: () => 600 });
  let frameH = 0;
  Object.defineProperty(iframe, 'contentDocument', { configurable: true, get: () => doc });
  Object.defineProperty(iframe, 'clientHeight', { configurable: true, get: () => frameH });
  return { block, iframe, doc, setFrameHeight: (h: number) => { frameH = h; } };
}

describe('HtmlBlock document mode (M37)', () => {
  it('scales to its card once it has a size, also when it loaded while hidden', async () => {
    const ro = stubResizeObserver();
    try {
      const m = mountDocument(document.body);
      m.iframe.dispatchEvent(new Event('load')); // loaded in a hidden tab: no size yet
      await new Promise(resolve => setTimeout(resolve, 20)); // and any load the host fires itself
      expect(m.doc.body.style.getPropertyValue('--hp-body-scale')).toBe('');

      m.setFrameHeight(300); // the tab is shown
      ro.resize(m.iframe, 400, 300);
      await frame();

      expect(m.doc.body.style.getPropertyValue('--hp-body-scale')).not.toBe('');
      m.block.unload();
    } finally { ro.restore(); }
  });
});

describe('HtmlBlock in single column (M38)', () => {
  it('sizes the frame to its document instead of scaling it into 150 px', async () => {
    const ro = stubResizeObserver();
    try {
      const grid = document.body.createDiv({ cls: 'homepage-grid grid-stack hp-single-column' });
      const m = mountDocument(grid);
      m.setFrameHeight(150);
      m.iframe.dispatchEvent(new Event('load'));
      await frame();

      expect(m.doc.body.style.getPropertyValue('--hp-body-scale')).toBe('');
      expect(m.iframe.style.getPropertyValue('--hp-iframe-height')).toBe('600px');
      m.block.unload();
    } finally { ro.restore(); }
  });
});
