import { App, TFile } from 'obsidian';

/** Maximum thumbnail dimension (width or height) in pixels. */
const THUMB_MAX_DIM = 400;
/** WebP quality for thumbnail encoding (0–1). */
const THUMB_QUALITY = 0.75;
/** Maximum cached entries before oldest are evicted. */
const MAX_ENTRIES = 300;
/** Timeout for canvas.toBlob — safety valve against silent browser failures. */
const THUMB_TIMEOUT_MS = 5000;
/** Maximum decoded pixel count to prevent decompression bombs. */
const MAX_PIXELS = 100_000_000;

/** Extensions eligible for canvas-based thumbnail generation. */
const THUMBABLE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

interface ImageCacheEntry {
  /** Thumbnail blob URL (or original URL when no resize was needed). */
  thumbUrl: string;
  /** Original full-resolution resource URL (for lightbox). */
  fullUrl: string;
  /** File mtime — used for staleness checks. */
  mtime: number;
  /** True when thumbUrl is a blob: URL that must be revoked on eviction. */
  isBlob: boolean;
}

class ImageCacheStore {
  private entries = new Map<string, ImageCacheEntry>();
  private pending = new Map<string, Promise<ImageCacheEntry>>();
  private disposed = false;

  /** Synchronous lookup — returns the entry only if already cached and fresh. */
  getCached(path: string, mtime: number): ImageCacheEntry | null {
    const e = this.entries.get(path);
    return e && e.mtime === mtime ? e : null;
  }

  /** Async lookup — generates a thumbnail if not cached. */
  async get(app: App, file: TFile): Promise<ImageCacheEntry> {
    const { path } = file;
    const mtime = file.stat.mtime;

    const hit = this.entries.get(path);
    if (hit && hit.mtime === mtime) return hit;

    const inflight = this.pending.get(path);
    if (inflight) return inflight;

    const work = this.generate(app, file, mtime);
    this.pending.set(path, work);
    try {
      const entry = await work;
      // Guard: if invalidate() or destroy() ran while we were generating,
      // the pending entry was removed — don't store a stale result.
      if (this.disposed || this.pending.get(path) !== work) {
        if (entry.isBlob) URL.revokeObjectURL(entry.thumbUrl);
        return entry;
      }
      // Re-read entries (not the pre-await `hit`) to avoid double-revoke races.
      const current = this.entries.get(path);
      if (current?.isBlob) URL.revokeObjectURL(current.thumbUrl);
      this.entries.set(path, entry);
      this.evict();
      return entry;
    } finally {
      // Only clear pending if it's still our work (not a newer request)
      if (this.pending.get(path) === work) {
        this.pending.delete(path);
      }
    }
  }

  /** Get full-res URL (sync — uses cached value or falls back to the Obsidian API). */
  fullUrl(app: App, file: TFile): string {
    const e = this.entries.get(file.path);
    return e && e.mtime === file.stat.mtime ? e.fullUrl : app.vault.getResourcePath(file);
  }

  /** Remove a path from cache, revoking its blob URL if any. */
  invalidate(path: string): void {
    const e = this.entries.get(path);
    if (e?.isBlob) URL.revokeObjectURL(e.thumbUrl);
    this.entries.delete(path);
    this.pending.delete(path);
  }

  /** Revoke all blob URLs and clear the cache entirely. */
  destroy(): void {
    this.disposed = true;
    for (const e of this.entries.values()) {
      if (e.isBlob) URL.revokeObjectURL(e.thumbUrl);
    }
    this.entries.clear();
    this.pending.clear();
  }

  // ── internals ──

  private async generate(app: App, file: TFile, mtime: number): Promise<ImageCacheEntry> {
    const fullUrl = app.vault.getResourcePath(file);
    const ext = `.${file.extension.toLowerCase()}`;

    // SVGs, videos, and other non-raster formats: skip thumbnail generation
    if (!THUMBABLE_EXTS.has(ext)) {
      return { thumbUrl: fullUrl, fullUrl, mtime, isBlob: false };
    }

    try {
      const thumbUrl = await resizeToBlob(fullUrl, THUMB_MAX_DIM, THUMB_QUALITY);
      return { thumbUrl, fullUrl, mtime, isBlob: thumbUrl !== fullUrl };
    } catch {
      return { thumbUrl: fullUrl, fullUrl, mtime, isBlob: false };
    }
  }

  /** Evict oldest entries (Map insertion order) when over capacity. */
  private evict(): void {
    if (this.entries.size <= MAX_ENTRIES) return;
    const excess = this.entries.size - MAX_ENTRIES;
    let n = 0;
    for (const [key] of this.entries) {
      if (n >= excess) break;
      // Do NOT revoke — the blob URL may still be displayed in an <img>.
      // The Blob data will be GC'd when the element is removed from DOM.
      this.entries.delete(key);
      n++;
    }
  }
}

/**
 * Down-scale an image to fit within `maxDim × maxDim` and return a blob URL.
 * Returns the original `src` unchanged if the image is already small enough.
 * Includes guards for decompression bombs and a timeout for toBlob hangs.
 */
function resizeToBlob(src: string, maxDim: number, quality: number): Promise<string> {
  return new Promise<string>(resolve => {
    const timeout = setTimeout(() => resolve(src), THUMB_TIMEOUT_MS);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      // Already small enough — use original URL
      if (w <= maxDim && h <= maxDim) { clearTimeout(timeout); resolve(src); return; }
      // Guard against decompression bombs
      if (w * h > MAX_PIXELS) { clearTimeout(timeout); resolve(src); return; }

      const scale = Math.min(maxDim / w, maxDim / h);
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) { clearTimeout(timeout); resolve(src); return; }
      ctx.drawImage(img, 0, 0, tw, th);
      try {
        canvas.toBlob(
          blob => { clearTimeout(timeout); resolve(blob ? URL.createObjectURL(blob) : src); },
          'image/webp',
          quality,
        );
      } catch {
        clearTimeout(timeout);
        resolve(src);
      }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(src); };
    img.src = src;
  });
}

/** Singleton image cache shared across all ImageGalleryBlock instances. */
export const imageCache = new ImageCacheStore();
