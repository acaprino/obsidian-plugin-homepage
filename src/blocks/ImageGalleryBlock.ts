import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

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
    const { folder = '', title = 'Gallery', columns = 3, maxItems = 20 } = this.instance.config as {
      folder?: string;
      title?: string;
      columns?: number;
      maxItems?: number;
    };

    this.renderHeader(el, title);

    const gallery = el.createDiv({ cls: 'image-gallery' });
    gallery.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    if (!folder) {
      gallery.setText('Configure a folder path in settings.');
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

      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl('img');
        img.src = this.app.vault.getResourcePath(file);
        img.loading = 'lazy';
        img.addEventListener('click', () => {
          this.app.workspace.openLinkText(file.path, '');
        });
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
        wrapper.addEventListener('click', () => {
          this.app.workspace.openLinkText(file.path, '');
        });
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

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(this.config.title as string ?? 'Gallery')
       .onChange(v => { this.config.title = v; }),
    );
    new Setting(contentEl).setName('Folder').setDesc('Vault folder path (e.g. Attachments/Photos)').addText(t =>
      t.setValue(this.config.folder as string ?? '')
       .onChange(v => { this.config.folder = v; }),
    );
    new Setting(contentEl).setName('Columns').addDropdown(d =>
      d.addOption('2', '2').addOption('3', '3').addOption('4', '4')
       .setValue(String(this.config.columns ?? 3))
       .onChange(v => { this.config.columns = Number(v); }),
    );
    new Setting(contentEl).setName('Max items').addText(t =>
      t.setValue(String(this.config.maxItems ?? 20))
       .onChange(v => { this.config.maxItems = parseInt(v) || 20; }),
    );
    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(this.config);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
