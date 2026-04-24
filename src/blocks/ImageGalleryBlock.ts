import { setIcon, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';
import { responsiveGridColumns } from '../utils/responsiveGrid';
import { imageCache } from '../utils/imageCache';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv']);

interface LightboxItem { src: string; alt: string; type: 'image' | 'video'; }

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_DIRECTION_RATIO = 1.5;

/** Tracks the currently open lightbox so only one can exist at a time. */
let activeLightbox: { ac: AbortController; overlay: HTMLElement } | null = null;

/** Returns true when a lightbox is currently visible. */
function isLightboxOpen(): boolean { return activeLightbox !== null; }

/** Called by the plugin on unload to clean up any stuck lightbox from a previous session. */
export function abortActiveLightbox(): void {
  if (!activeLightbox) return;
  activeLightbox.ac.abort();
  activeLightbox.overlay.remove();
  activeLightbox = null;
}

function openMediaLightbox(items: LightboxItem[], startIndex: number): AbortController | null {
  if (items.length === 0) return null;
  // Abort previous lightbox listeners and remove ONLY the overlay we own
  abortActiveLightbox();

  const ac = new AbortController();
  const { signal } = ac;

  let current = startIndex;
  const overlay = document.body.createDiv({ cls: 'gallery-lightbox' });
  activeLightbox = { ac, overlay };

  const prevBtn = overlay.createEl('button', { cls: 'gallery-lightbox-prev', attr: { 'aria-label': 'Previous' } });
  setIcon(prevBtn, 'chevron-left');
  const mediaContainer = overlay.createDiv({ cls: 'gallery-lightbox-media' });
  const nextBtn = overlay.createEl('button', { cls: 'gallery-lightbox-next', attr: { 'aria-label': 'Next' } });
  setIcon(nextBtn, 'chevron-right');
  const counter = overlay.createEl('span', { cls: 'gallery-lightbox-counter' });

  if (items.length <= 1) {
    prevBtn.addClass('gallery-lightbox-nav-hidden');
    nextBtn.addClass('gallery-lightbox-nav-hidden');
    counter.addClass('gallery-lightbox-nav-hidden');
  }

  const pauseCurrentVideo = (): void => {
    const vid = mediaContainer.querySelector('video');
    if (vid) vid.pause();
  };

  const showItem = (index: number): void => {
    pauseCurrentVideo();
    mediaContainer.empty();
    current = ((index % items.length) + items.length) % items.length;
    const item = items[current];
    counter.setText(`${current + 1} / ${items.length}`);

    if (item.type === 'image') {
      const img = mediaContainer.createEl('img', { cls: 'gallery-lightbox-img', attr: { src: item.src, alt: item.alt } });
      img.addEventListener('click', (e) => e.stopPropagation());
      img.addEventListener('error', () => { img.alt = 'Image unavailable'; });
    } else {
      const video = mediaContainer.createEl('video', {
        cls: 'gallery-lightbox-video',
        attr: { src: item.src, 'aria-label': item.alt },
      });
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
      video.addEventListener('click', (e) => e.stopPropagation());
      video.play().catch(() => { /* autoplay blocked — user can use controls */ });
    }
  };

  const close = (): void => {
    pauseCurrentVideo();
    overlay.remove();
    ac.abort();
    if (activeLightbox?.ac === ac) activeLightbox = null;
  };

  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(current - 1); }, { signal });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(current + 1); }, { signal });

  // Click-to-close with a short guard after a touch swipe to suppress synthesized clicks.
  let swipedAt = 0;
  overlay.addEventListener('click', (e) => {
    if (Date.now() - swipedAt < 300) return;
    if (e.target === overlay || e.target === mediaContainer) close();
  }, { signal });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore when focus is in an input/textarea/contenteditable or when a modal is open.
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (active?.isContentEditable) return;
    if (document.querySelector('.modal-container')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showItem(current - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showItem(current + 1); }
  }, { signal });

  // Swipe navigation for touch devices
  let touchStartX = 0;
  let touchStartY = 0;
  overlay.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { signal, passive: true });
  overlay.addEventListener('touchend', (e: TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only trigger swipe if horizontal movement exceeds threshold and dominates vertical
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
      e.preventDefault(); // suppress synthesized click that would close the lightbox
      swipedAt = Date.now();
      if (dx < 0) showItem(current + 1);
      else showItem(current - 1);
    }
  }, { signal });

  showItem(current);
  return ac;
}

/** Resolve when an <img> finishes loading (or has already loaded). */
function waitForImage(img: HTMLImageElement): Promise<void> {
  return new Promise(resolve => {
    if (img.complete && img.naturalHeight > 0) { resolve(); return; }
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

const DEBOUNCE_MS = 300;

export class ImageGalleryBlock extends BaseBlock {
  /** The AbortController for the lightbox opened by THIS instance (if any). */
  private myLightboxAc: AbortController | null = null;
  /** Masonry column ResizeObserver — disconnected before each re-render. */
  private masonryRo: ResizeObserver | null = null;

  onunload(): void {
    super.onunload();
    // Only clean up the lightbox if THIS block instance owns it.
    if (this.myLightboxAc && activeLightbox?.ac === this.myLightboxAc) {
      abortActiveLightbox();
    }
    this.myLightboxAc = null;
  }

  render(el: HTMLElement): Promise<void> {
    this.containerEl = el;
    el.addClass('image-gallery-block');

    // Re-render only when media files inside the configured folder change
    const isRelevant = (file: TAbstractFile) => this.isRelevantMedia(file.path);
    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    this.registerEvent(this.app.vault.on('create', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('delete', (f) => {
      if (isRelevant(f)) { imageCache.invalidate(f.path); trigger(); }
    }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      if (isRelevant(f) || this.isRelevantMedia(oldPath)) {
        imageCache.invalidate(oldPath);
        trigger();
      }
    }));
    this.registerEvent(this.app.vault.on('modify', (f) => {
      if (isRelevant(f)) { imageCache.invalidate(f.path); trigger(); }
    }));

    // One-time masonry observer cleanup for component teardown
    this.register(() => { this.masonryRo?.disconnect(); this.masonryRo = null; });

    return this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] ImageGalleryBlock failed to render:', e);
      el.setText('Error loading gallery. Check console for details.');
    });
  }

  private isRelevantMedia(path: string): boolean {
    const { folder = '' } = this.instance.config as { folder?: string };
    if (!folder) return false;
    if (!path.startsWith(folder + '/')) return false;
    const dot = path.lastIndexOf('.');
    if (dot < 0) return false;
    const ext = path.slice(dot).toLowerCase();
    return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const cfg = this.instance.config as {
      folder?: string;
      columns?: number;
      maxItems?: number;
      layout?: 'grid' | 'masonry';
      heightMode?: 'auto' | 'fixed';
    };
    const folder = cfg.folder ?? '';
    const columns = Math.max(1, Math.min(7, Math.floor(Number(cfg.columns) || 3)));
    const rawMax = Number(cfg.maxItems);
    const maxItems = rawMax > 0 ? Math.max(1, Math.min(500, Math.floor(rawMax))) : 0;
    const layout = cfg.layout ?? 'grid';
    const heightMode = cfg.heightMode ?? 'auto';

    this.renderHeader(el, 'Gallery');

    const gallery = el.createDiv({ cls: 'image-gallery' });
    if (heightMode === 'fixed') {
      gallery.addClass('image-gallery--fixed-height');
    } else {
      // Mark for natural-height measurement after images load
      gallery.setAttribute('data-auto-height-content', '');
      // Width observer is started after images load (see below) to avoid
      // measuring before content is laid out.
    }

    if (layout === 'masonry') {
      gallery.addClass('masonry-layout');
      let currentCols = -1;
      const updateCols = () => {
        const w = gallery.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / 100))) : columns;
        if (effective !== currentCols) {
          currentCols = effective;
          gallery.style.setProperty('--hp-masonry-cols', String(effective));
        }
      };
      updateCols();
      this.masonryRo?.disconnect();
      this.masonryRo = new ResizeObserver(updateCols);
      this.masonryRo.observe(gallery);
    } else {
      gallery.style.setProperty('--hp-grid-cols', responsiveGridColumns(columns, 100));
    }

    if (!folder) {
      const hint = gallery.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F5BC}\uFE0F' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No folder selected. Pick an image folder in settings to display a gallery.' });
      return;
    }

    const folderObj = this.app.vault.getAbstractFileByPath(folder);
    if (!(folderObj instanceof TFolder)) {
      gallery.setText(`Folder "${folder}" not found.`);
      return;
    }

    const files = this.getMediaFiles(folderObj, maxItems || Infinity);

    // Lightbox always uses full-resolution URLs
    const lightboxItems: LightboxItem[] = files.map(f => {
      const e = `.${f.extension.toLowerCase()}`;
      return {
        src: imageCache.fullUrl(this.app, f),
        alt: f.basename,
        type: IMAGE_EXTS.has(e) ? 'image' as const : 'video' as const,
      };
    });

    const loadPromises: Promise<void>[] = [];
    // Only use lazy loading in fixed-height (scrollable) mode — auto-height
    // needs all dimensions upfront for GridStack measurement.
    const useLazy = heightMode === 'fixed';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = `.${file.extension.toLowerCase()}`;
      const wrapper = gallery.createDiv({ cls: 'gallery-item' });

      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label', file.basename);

      const index = i;
      const action = () => { this.myLightboxAc = openMediaLightbox(lightboxItems, index); };
      wrapper.addEventListener('click', action);
      wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); }
      });

      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl('img');
        img.alt = file.basename;
        if (useLazy && i >= columns) img.loading = 'lazy';

        // Synchronous cache hit → display immediately (second render onward)
        const cached = imageCache.getCached(file.path, file.stat.mtime);
        if (cached) {
          img.src = cached.thumbUrl;
          loadPromises.push(waitForImage(img));
        } else {
          // Show shimmer placeholder while thumbnail is generated
          wrapper.addClass('gallery-item--loading');
          loadPromises.push(
            imageCache.get(this.app, file).then(entry => {
              if (this.isStale(gen)) return;
              img.src = entry.thumbUrl;
              wrapper.removeClass('gallery-item--loading');
              return waitForImage(img);
            }),
          );
        }
      } else if (VIDEO_EXTS.has(ext)) {
        wrapper.addClass('gallery-item-video');
        wrapper.createDiv({ cls: 'video-play-overlay', text: '▶' });

        const video = wrapper.createEl('video');
        video.muted = true;
        video.loop = true;
        video.setAttribute('playsinline', '');
        video.preload = 'metadata';
        video.src = lightboxItems[index].src;
        // Seek to first frame so thumbnail isn't a black box
        video.addEventListener('loadedmetadata', () => { video.currentTime = 0.1; }, { once: true });
        // Wait for metadata so natural aspect ratio dimensions are available for auto-height
        loadPromises.push(
          new Promise<void>(resolve => {
            if (video.readyState >= 1) { resolve(); return; }
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
            video.addEventListener('error', () => resolve(), { once: true });
          }),
        );

        wrapper.addEventListener('mouseenter', () => { if (!isLightboxOpen()) video.play().catch(() => { /* hover preview — ignore if autoplay restricted */ }); });
        wrapper.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0.1; });
      }
    }

    // Wait for all thumbnails + image decodes so GridStack can measure true height.
    await Promise.all(loadPromises);
    if (this.isStale(gen)) return; // a newer render superseded this one

    // Start width observer AFTER images load so the initial measurement is accurate.
    if (heightMode !== 'fixed') {
      this.observeWidthForAutoHeight(gallery);
    }
  }

  private getMediaFiles(folder: TFolder, limit = Infinity): TFile[] {
    const files: TFile[] = [];
    const recurse = (f: TFolder) => {
      for (const child of f.children) {
        if (files.length >= limit) return;
        if (child instanceof TFile) {
          const ext = `.${child.extension.toLowerCase()}`;
          if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
            files.push(child);
          }
        } else if (child instanceof TFolder) {
          recurse(child);
        }
      }
    };
    recurse(folder);
    return files;
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    let folderText: import('obsidian').TextComponent;
    new Setting(body)
      .setName('Folder')
      .setDesc('Pick a vault folder.')
      .addText(t => {
        folderText = t;
        t.setValue(draft.folder as string ?? '')
         .setPlaceholder('Attachments/photos')
         .onChange(v => { draft.folder = v; });
      })
      .addButton(btn =>
        btn.setIcon('folder').setTooltip('Browse vault folders').onClick(() => {
          new FolderSuggestModal(this.app, (folder) => {
            const path = folder.path === '/' ? '' : folder.path;
            draft.folder = path;
            folderText.setValue(path);
          }).open();
        }),
      );
    new Setting(body)
      .setName('Height')
      .setDesc('Auto: expands to fit all images. Fixed: uses the block\'s row height and scrolls.')
      .addDropdown(d =>
        d.addOption('auto', 'Auto (fit all images)')
         .addOption('fixed', 'Fixed (scroll)')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'auto')
         .onChange(v => { draft.heightMode = v === 'fixed' ? 'fixed' : 'auto'; }),
      );
    new Setting(body).setName('Layout').addDropdown(d =>
      d.addOption('grid', 'Grid').addOption('masonry', 'Masonry')
       .setValue(typeof draft.layout === 'string' ? draft.layout : 'grid')
       .onChange(v => { draft.layout = v; }),
    );
    new Setting(body).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3').addOption('4', '4')
       .addOption('5', '5').addOption('6', '6').addOption('7', '7')
       .setValue(String(typeof draft.columns === 'number' ? draft.columns : 3))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(body).setName('Max items').setDesc('0 = show all files.').addText(t =>
      t.setValue(String(typeof draft.maxItems === 'number' ? draft.maxItems : 0))
       .onChange(v => {
         const n = parseInt(v) || 0;
         draft.maxItems = Math.min(Math.max(0, n), 500);
       }),
    );
  }
}
