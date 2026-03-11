import { App, Modal, setIcon, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';
import { responsiveGridColumns } from '../utils/responsiveGrid';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv']);

interface LightboxItem { src: string; alt: string; type: 'image' | 'video'; }

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_DIRECTION_RATIO = 1.5;

/** Tracks the currently open lightbox so only one can exist at a time. */
let activeLightboxAc: AbortController | null = null;

/** Returns true when a lightbox is currently visible. */
function isLightboxOpen(): boolean { return activeLightboxAc !== null; }

function openMediaLightbox(items: LightboxItem[], startIndex: number): void {
  if (items.length === 0) return;
  // Abort previous lightbox listeners and remove its overlay
  activeLightboxAc?.abort();
  document.querySelector('.gallery-lightbox')?.remove();

  const ac = new AbortController();
  activeLightboxAc = ac;
  const { signal } = ac;

  let current = startIndex;
  const overlay = document.body.createDiv({ cls: 'gallery-lightbox' });

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
    activeLightboxAc = null;
  };

  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(current - 1); }, { signal });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(current + 1); }, { signal });
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === mediaContainer) close(); }, { signal });
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore when focus is in an input/textarea (e.g. another modal)
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
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
      if (dx < 0) showItem(current + 1);
      else showItem(current - 1);
    }
  }, { signal });

  showItem(current);
}

const DEBOUNCE_MS = 300;

export class ImageGalleryBlock extends BaseBlock {
  /** The AbortController for the lightbox opened by THIS instance (if any). */
  private myLightboxAc: AbortController | null = null;

  onunload(): void {
    super.onunload();
    // Only clean up the lightbox if THIS block instance owns it
    if (this.myLightboxAc && this.myLightboxAc === activeLightboxAc) {
      this.myLightboxAc.abort();
      document.querySelector('.gallery-lightbox')?.remove();
      activeLightboxAc = null;
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
    this.registerEvent(this.app.vault.on('delete', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      if (isRelevant(f) || this.isRelevantMedia(oldPath)) trigger();
    }));

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
    const columns = Math.max(1, Math.min(6, Math.floor(Number(cfg.columns) || 3)));
    const maxItems = Math.max(1, Math.min(200, Math.floor(Number(cfg.maxItems) || 20)));
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
      const ro = new ResizeObserver(updateCols);
      ro.observe(gallery);
      this.register(() => ro.disconnect());
    } else {
      const safeCols = Math.max(1, Math.min(6, Math.floor(Number(columns) || 3)));
      gallery.style.setProperty('--hp-grid-cols', responsiveGridColumns(safeCols, 150));
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

    const files = this.getMediaFiles(folderObj, maxItems);

    const lightboxItems: LightboxItem[] = files.map(f => {
      const e = `.${f.extension.toLowerCase()}`;
      return {
        src: this.app.vault.getResourcePath(f),
        alt: f.basename,
        type: IMAGE_EXTS.has(e) ? 'image' as const : 'video' as const,
      };
    });

    const imageLoadPromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = `.${file.extension.toLowerCase()}`;
      const wrapper = gallery.createDiv({ cls: 'gallery-item' });

      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label', file.basename);

      const index = i;
      const action = () => { openMediaLightbox(lightboxItems, index); this.myLightboxAc = activeLightboxAc; };
      wrapper.addEventListener('click', action);
      wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); }
      });

      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl('img');
        img.src = lightboxItems[index].src;
        img.alt = file.basename;
        // Not lazy — we need dimensions before GridStack can measure the block height.
        imageLoadPromises.push(
          new Promise<void>(resolve => {
            if (img.complete) { resolve(); return; }
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
        );
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

        wrapper.addEventListener('mouseenter', () => { if (!isLightboxOpen()) video.play().catch(() => { /* hover preview — ignore if autoplay restricted */ }); });
        wrapper.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0.1; });
      }
    }

    // Wait for images to report their natural dimensions so GridStack can
    // measure the block's true height before calling resizeToContent.
    await Promise.all(imageLoadPromises);
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

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new ImageGallerySettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class ImageGallerySettingsModal extends Modal {
  constructor(
    app: App,
    private config: Record<string, unknown>,
    private onSave: (cfg: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Image gallery settings').setHeading();

    const draft = structuredClone(this.config);

    let folderText: import('obsidian').TextComponent;
    new Setting(contentEl)
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
    new Setting(contentEl)
      .setName('Height')
      .setDesc('Auto: expands to show all images \u2014 fixed: uses the block\'s row height and scrolls.')
      .addDropdown(d =>
        d.addOption('auto', 'Auto (fit all images)')
         .addOption('fixed', 'Fixed (scroll)')
         .setValue(typeof draft.heightMode === 'string' ? draft.heightMode : 'auto')
         .onChange(v => { draft.heightMode = v === 'fixed' ? 'fixed' : 'auto'; }),
      );
    new Setting(contentEl).setName('Layout').addDropdown(d =>
      d.addOption('grid', 'Grid').addOption('masonry', 'Masonry')
       .setValue(typeof draft.layout === 'string' ? draft.layout : 'grid')
       .onChange(v => { draft.layout = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3').addOption('4', '4')
       .setValue(String(typeof draft.columns === 'number' ? draft.columns : 3))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Max items').addText(t =>
      t.setValue(String(typeof draft.maxItems === 'number' ? draft.maxItems : 20))
       .onChange(v => { draft.maxItems = Math.min(Math.max(1, parseInt(v) || 20), 200); }),
    );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
