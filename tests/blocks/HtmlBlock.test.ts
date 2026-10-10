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

describe('HtmlBlock accessible name (M112)', () => {
  it('gives the document frame a title', () => {
    const instance: BlockInstance = { id: 'h', type: 'html', x: 0, y: 0, w: 2, h: 3, config: { html: '<style></style><p>x</p>' } };
    const el = document.body.createDiv();
    new HtmlBlock({} as App, instance, {} as IHomepagePlugin).render(el);
    expect(el.querySelector('iframe')?.getAttribute('title')).toBeTruthy();
  });
});

describe('HtmlBlock inline fragments (M59)', () => {
  function inline(html: string): HTMLElement {
    const instance: BlockInstance = { id: 'h', type: 'html', x: 0, y: 0, w: 2, h: 3, config: { html } };
    const el = document.body.createDiv();
    new HtmlBlock({} as App, instance, {} as IHomepagePlugin).render(el);
    return el.querySelector('.html-block-content') as HTMLElement;
  }

  it('keeps no style attribute that could lay it over the homepage', () => {
    const out = inline('<p style="position:fixed;inset:0">cover</p>');
    expect(out.querySelector('[style]')).toBeNull();
    expect(out.textContent).toContain('cover');
  });

  it('loads no remote media', () => {
    const out = inline('<img src="https://t.example/p.png"><video src="https://t.example/v.mp4"></video><audio src="a"></audio><picture><source srcset="s"></picture><p>text</p>');
    expect(out.querySelector('img, video, audio, source, picture, iframe, object, embed')).toBeNull();
    expect(out.textContent).toContain('text');
  });

  it('keeps http(s) links and disarms every other scheme', () => {
    const out = inline('<a href="obsidian://new?file=Note&content=x&overwrite=true">o</a><a href="https://ok.example">k</a>');
    const [o, k] = [...out.querySelectorAll('a')];
    expect(o.hasAttribute('href')).toBe(false);
    expect(k.getAttribute('href')).toBe('https://ok.example');
  });
});

describe('HtmlBlock document CSP (M60)', () => {
  it('puts the CSP before any markup, so markup before <head> cannot void it', () => {
    const instance: BlockInstance = { id: 'h', type: 'html', x: 0, y: 0, w: 2, h: 3, config: { html: '<p>first</p><!DOCTYPE html><html><head><style>p{}</style></head><body>x</body></html>' } };
    const el = document.body.createDiv();
    new HtmlBlock({} as App, instance, {} as IHomepagePlugin).render(el);
    const srcdoc = (el.querySelector('iframe') as HTMLIFrameElement).srcdoc;
    expect(srcdoc.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(srcdoc.toLowerCase().indexOf('<!doctype', 1)).toBe(-1);
  });
});
