import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { imageCache } from '../../src/utils/imageCache';

const app = { vault: { getResourcePath: (f: TFile) => `app://${f.path}` } } as unknown as App;
function png(path: string): TFile {
  const f = new TFile();
  f.path = path;
  f.extension = 'png';
  f.basename = path;
  f.stat = { mtime: 1, ctime: 1, size: 1 };
  return f;
}

let revoked: string[] = [];
let made = 0;
let blobCallback: ((b: Blob | null) => void) | null = null;
let deferBlob = false;
const OriginalImage = globalThis.Image;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

beforeEach(() => {
  imageCache.destroy();
  imageCache.reset();
  revoked = [];
  made = 0;
  deferBlob = false;
  blobCallback = null;
  URL.createObjectURL = vi.fn(() => `blob:${++made}`);
  URL.revokeObjectURL = vi.fn((u: string) => { revoked.push(u); });
  // An 800x600 image that "loads" at once, so every thumbnail is a resized blob.
  globalThis.Image = class {
    naturalWidth = 800;
    naturalHeight = 600;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  } as unknown as typeof Image;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => {} } as unknown as CanvasRenderingContext2D);
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    if (deferBlob) blobCallback = cb;
    else cb(new Blob(['x']));
  };
});

afterEach(() => {
  globalThis.Image = OriginalImage;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function fill(from: number, to: number): Promise<void> {
  for (let i = from; i <= to; i++) await imageCache.get(app, png(`${i}.png`));
}

describe('imageCache (M96)', () => {
  it('revokes an evicted thumbnail that no gallery shows', async () => {
    const first = await imageCache.get(app, png('0.png'));
    await fill(1, 600); // 601 entries: one over the cap

    expect(first.isBlob).toBe(true);
    expect(revoked).toContain(first.thumbUrl);
  });

  it('keeps a thumbnail a gallery still shows when it is evicted, and revokes it once released', async () => {
    const first = await imageCache.get(app, png('0.png'));
    imageCache.retain(first.thumbUrl);
    await fill(1, 600);

    expect(revoked).not.toContain(first.thumbUrl);
    imageCache.release(first.thumbUrl);
    expect(revoked).toContain(first.thumbUrl);
  });

  it('keeps a recently shown image when an older one must go', async () => {
    await imageCache.get(app, png('0.png'));
    await fill(1, 599);
    expect(imageCache.getCached('0.png', 1)).not.toBeNull(); // a re-render shows it again
    await fill(600, 600);

    expect(imageCache.getCached('0.png', 1)).not.toBeNull();
    expect(imageCache.getCached('1.png', 1)).toBeNull();
  });

  it('creates no blob URL for a thumbnail that finishes after the timeout', async () => {
    vi.useFakeTimers();
    deferBlob = true;
    const pending = imageCache.get(app, png('slow.png'));
    await vi.advanceTimersByTimeAsync(5000);
    const entry = await pending;

    blobCallback?.(new Blob(['x']));

    expect(entry.isBlob).toBe(false);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
