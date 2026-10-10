import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import type { App } from 'obsidian';
import { ImageGalleryBlock } from '../../src/blocks/ImageGalleryBlock';
import { imageCache } from '../../src/utils/imageCache';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

function png(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = path.replace(/\.png$/, '');
  f.extension = 'png';
  f.stat = { mtime: 1, ctime: 1, size: 1 };
  return f;
}

beforeEach(() => { document.body.empty(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('ImageGalleryBlock thumbnails (M96)', () => {
  it('does not hold a thumbnail that finishes after the gallery was unloaded', async () => {
    const folder = new TFolder();
    folder.path = 'Pics';
    folder.children = [png('Pics/a.png')];
    const app = {
      vault: {
        on: () => ({}),
        getAbstractFileByPath: (p: string) => (p === 'Pics' ? folder : null),
        getResourcePath: (f: TFile) => `app://${f.path}`,
      },
    } as unknown as App;
    let finish: (url: string) => void = () => {};
    vi.spyOn(imageCache, 'get').mockImplementation(() => new Promise(resolve => {
      finish = (url) => resolve({ thumbUrl: url, fullUrl: url, mtime: 1, isBlob: true });
    }));
    const retain = vi.spyOn(imageCache, 'retain');
    const instance: BlockInstance = { id: 'g1', type: 'image-gallery', x: 0, y: 0, w: 3, h: 3, config: { folder: 'Pics', heightMode: 'fixed' } };
    const block = new ImageGalleryBlock(app, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    void block.render(el);
    await new Promise(resolve => setTimeout(resolve, 5));

    block.unload(); // edit mode starts, or the tab closes, while the thumbnail is generating
    finish('blob:late');
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(retain).not.toHaveBeenCalled();
  });
});

describe('ImageGalleryBlock folder input (M67)', () => {
  it('finds a folder typed with slashes around it', async () => {
    const folder = new TFolder();
    folder.path = 'Pics';
    folder.children = [png('Pics/a.png')];
    const app = {
      vault: {
        on: () => ({}),
        getAbstractFileByPath: (p: string) => (p === 'Pics' ? folder : null),
        getResourcePath: (f: TFile) => `app://${f.path}`,
      },
    } as unknown as App;
    vi.spyOn(imageCache, 'get').mockResolvedValue({ thumbUrl: 'u', fullUrl: 'u', mtime: 1, isBlob: false });
    const instance: BlockInstance = { id: 'g1', type: 'image-gallery', x: 0, y: 0, w: 3, h: 3, config: { folder: ' /Pics/ ', heightMode: 'fixed' } };
    const el = document.body.createDiv();
    const block = new ImageGalleryBlock(app, instance, {} as IHomepagePlugin);
    block.load();
    void block.render(el);
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(el.textContent).not.toContain('not found');
    block.unload();
  });
});

describe('ImageGalleryBlock fixed height (M42)', () => {
  it('finishes rendering without waiting for images that may never load', async () => {
    const folder = new TFolder();
    folder.path = 'Pics';
    folder.children = [png('Pics/a.png'), png('Pics/b.png'), png('Pics/c.png'), png('Pics/d.png')];
    const app = {
      vault: { on: () => ({}), getAbstractFileByPath: () => folder, getResourcePath: (f: TFile) => `app://${f.path}` },
    } as unknown as App;
    vi.spyOn(imageCache, 'get').mockResolvedValue({ thumbUrl: 'u', fullUrl: 'u', mtime: 1, isBlob: false });
    const instance: BlockInstance = { id: 'g1', type: 'image-gallery', x: 0, y: 0, w: 3, h: 3, config: { folder: 'Pics', heightMode: 'fixed', columns: 2 } };
    const block = new ImageGalleryBlock(app, instance, {} as IHomepagePlugin);
    block.load();

    const done = await Promise.race([
      Promise.resolve(block.render(document.body.createDiv())).then(() => 'done'),
      new Promise(resolve => setTimeout(() => resolve('still waiting'), 200)),
    ]);

    expect(done).toBe('done');
    block.unload();
  });
});

describe('ImageGalleryBlock lightbox keyboard (M113)', () => {
  async function openLightbox(files: TFile[]) {
    const folder = new TFolder();
    folder.path = 'Pics';
    folder.children = files;
    const app = { vault: { on: () => ({}), getAbstractFileByPath: () => folder, getResourcePath: (f: TFile) => `app://${f.path}` } } as unknown as App;
    vi.spyOn(imageCache, 'get').mockResolvedValue({ thumbUrl: 'u', fullUrl: 'u', mtime: 1, isBlob: false });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const instance: BlockInstance = { id: 'g1', type: 'image-gallery', x: 0, y: 0, w: 3, h: 3, config: { folder: 'Pics', heightMode: 'fixed' } };
    const block = new ImageGalleryBlock(app, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    await block.render(el);
    (el.querySelector('.gallery-item') as HTMLElement).click();
    return { block, overlay: document.querySelector('.gallery-lightbox') as HTMLElement };
  }
  const tab = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));

  it('has a labelled Close button', async () => {
    const { block, overlay } = await openLightbox([png('Pics/a.png'), png('Pics/b.png')]);
    const close = overlay.querySelector('[aria-label="Close"]') as HTMLButtonElement;
    expect(close).toBeTruthy();
    close.click();
    expect(document.querySelector('.gallery-lightbox')).toBeNull();
    block.unload();
  });

  it('lets Tab reach a video, and arrow keys then stay with the video', async () => {
    const clip = Object.assign(new TFile(), { path: 'Pics/v.mp4', basename: 'v', extension: 'mp4', stat: { mtime: 1, ctime: 1, size: 1 } });
    const { block, overlay } = await openLightbox([clip, png('Pics/a.png')]);
    const video = overlay.querySelector('video') as HTMLVideoElement;
    const reached = new Set<Element | null>();
    for (let i = 0; i < 5; i++) { tab(); reached.add(document.activeElement); }
    expect(reached.has(video)).toBe(true);

    video.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    expect(overlay.querySelector('video')).toBe(video); // still the same item
    block.unload();
    document.querySelector('.gallery-lightbox')?.remove();
  });
});
