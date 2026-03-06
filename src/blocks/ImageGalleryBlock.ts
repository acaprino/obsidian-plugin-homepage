import { App, Modal, Setting, SuggestModal, TFile, TFolder } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

// ── Folder picker ────────────────────────────────────────────────────────────

class FolderSuggestModal extends SuggestModal<TFolder> {
  constructor(
    app: App,
    private onChoose: (folder: TFolder) => void,
  ) {
    super(app);
    this.setPlaceholder('Type to search vault folders…');
  }

  private getAllFolders(): TFolder[] {
    const folders: TFolder[] = [];
    const recurse = (f: TFolder) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    return folders;
  }

  getSuggestions(query: string): TFolder[] {
    const q = query.toLowerCase();
    return this.getAllFolders().filter(f =>
      f.path.toLowerCase().includes(q),
    );
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createEl('span', { text: folder.path === '/' ? '/ (vault root)' : folder.path });
  }

  onChooseSuggestion(folder: TFolder): void {
    this.onChoose(folder);
  }
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv']);

export class ImageGalleryBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('image-gallery-block');
    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] ImageGalleryBlock failed to render:', e);
      el.setText('Error loading gallery. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const { folder = '', title = 'Gallery', columns = 3, maxItems = 20, layout = 'grid' } = this.instance.config as {
      folder?: string;
      title?: string;
      columns?: number;
      maxItems?: number;
      layout?: 'grid' | 'masonry';
    };

    this.renderHeader(el, title);

    const gallery = el.createDiv({ cls: 'image-gallery' });

    if (layout === 'masonry') {
      gallery.addClass('masonry-layout');
      const updateCols = () => {
        const w = gallery.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / 100))) : columns;
        gallery.style.columns = String(effective);
      };
      updateCols();
      const ro = new ResizeObserver(updateCols);
      ro.observe(gallery);
      this.register(() => ro.disconnect());
    } else {
      gallery.style.gridTemplateColumns = `repeat(auto-fill, minmax(max(70px, calc(100% / ${columns})), 1fr))`;
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

    const files = this.getMediaFiles(folderObj).slice(0, maxItems);

    for (const file of files) {
      const ext = `.${file.extension.toLowerCase()}`;
      const wrapper = gallery.createDiv({ cls: 'gallery-item' });

      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label', file.basename);
      const openFile = () => { this.app.workspace.openLinkText(file.path, ''); };
      wrapper.addEventListener('click', openFile);
      wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFile(); }
      });

      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl('img');
        img.src = this.app.vault.getResourcePath(file);
        img.alt = file.basename;
        img.loading = 'lazy';
      } else if (VIDEO_EXTS.has(ext)) {
        wrapper.addClass('gallery-item-video');
        wrapper.createDiv({ cls: 'video-play-overlay', text: '▶' });

        const video = wrapper.createEl('video') as HTMLVideoElement;
        video.src = this.app.vault.getResourcePath(file);
        video.muted = true;
        video.loop = true;
        video.setAttribute('playsinline', '');
        video.preload = 'metadata';

        wrapper.addEventListener('mouseenter', () => { void video.play(); });
        wrapper.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
      }
    }
  }

  private getMediaFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const recurse = (f: TFolder) => {
      for (const child of f.children) {
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

  openSettings(onSave: () => void): void {
    new ImageGallerySettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
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
    contentEl.createEl('h2', { text: 'Image Gallery Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(draft.title as string ?? 'Gallery')
       .onChange(v => { draft.title = v; }),
    );
    let folderText: import('obsidian').TextComponent;
    new Setting(contentEl)
      .setName('Folder')
      .setDesc('Pick a vault folder.')
      .addText(t => {
        folderText = t;
        t.setValue(draft.folder as string ?? '')
         .setPlaceholder('Attachments/Photos')
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
    new Setting(contentEl).setName('Layout').addDropdown(d =>
      d.addOption('grid', 'Grid').addOption('masonry', 'Masonry')
       .setValue(String(draft.layout ?? 'grid'))
       .onChange(v => { draft.layout = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3').addOption('4', '4')
       .setValue(String(draft.columns ?? 3))
       .onChange(v => { draft.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Max items').addText(t =>
      t.setValue(String(draft.maxItems ?? 20))
       .onChange(v => { draft.maxItems = parseInt(v) || 20; }),
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
