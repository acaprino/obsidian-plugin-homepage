import { App, Modal, Setting, TFile, moment } from 'obsidian';
import { cacheHasTag, clearTagCache, getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

const MS_PER_DAY = 86_400_000;
const DEBOUNCE_MS = 500;
const DELETE_RENAME_DEBOUNCE_MS = 2000;

/** Strip [[...]] wiki-link syntax to get the raw path */
function stripWikiLink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)(?:\|.*)?\]\]$/);
  return m ? m[1] : raw;
}

export class RandomNoteBlock extends BaseBlock {
  /** Cached daily-seed file path so the selection is stable across file-count changes. */
  private dailyCache: { dayIndex: number; path: string } | null = null;

  private getTag(): string {
    const { tag = '' } = this.instance.config as { tag?: string };
    return tag;
  }

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('random-note-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });
    const slowTrigger = () => this.scheduleRender(DELETE_RENAME_DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    this.registerEvent(this.app.metadataCache.on('changed', (_file, _data, cache) => {
      const tag = this.getTag();
      if (!tag) return;
      const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
      if (cacheHasTag(cache, tagSearch)) { clearTagCache(); trigger(); }
    }));

    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (!this.getTag() || !file.path.endsWith('.md')) return;
      clearTagCache(); slowTrigger();
    }));

    this.registerEvent(this.app.vault.on('rename', (file) => {
      if (!this.getTag() || !file.path.endsWith('.md')) return;
      clearTagCache(); slowTrigger();
    }));

    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] RandomNoteBlock failed to render:', e);
      el.setText('Error loading random note. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const {
      tag = '',
      dailySeed = false,
      imageProperty = 'cover',
      titleProperty = 'title',
      showImage = true,
      showPreview = true,
    } = this.instance.config as {
      tag?: string;
      dailySeed?: boolean;
      imageProperty?: string;
      titleProperty?: string;
      showImage?: boolean;
      showPreview?: boolean;
    };

    this.renderHeader(el, 'Random note');

    if (!tag) {
      const hint = el.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F3B2}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No tag configured. Add a tag in settings to show random notes.' });
      return;
    }

    const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
    // Sort by path for stable ordering — vault iteration order is non-deterministic
    const files = getFilesWithTag(this.app, tagSearch).sort((a, b) => a.path.localeCompare(b.path));

    if (files.length === 0) {
      el.createDiv({ cls: 'block-empty-hint' }).createDiv({
        cls: 'block-empty-hint-text',
        text: `No files found with tag ${tagSearch}`,
      });
      return;
    }

    const file = this.pickFile(files, dailySeed);
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};

    // ── Do all async work before any content DOM mutations ───────────────────
    let preview = '';
    if (showPreview) {
      const desc = typeof fm['description'] === 'string' ? fm['description']
        : typeof fm['excerpt'] === 'string' ? fm['excerpt']
        : '';
      if (desc) {
        preview = desc;
      } else {
        try {
          const content = await this.app.vault.read(file);
          if (this.isStale(gen)) return;
          preview = this.extractPreview(content, cache?.frontmatterPosition?.end.offset ?? 0);
        } catch (e) {
          console.error('[Homepage Blocks] RandomNoteBlock failed to read file:', e);
        }
      }
    }

    if (this.isStale(gen)) return;

    // ── Render all content atomically after async work completes ────────────

    // Mark for auto-height measurement
    el.setAttribute('data-auto-height-content', '');
    this.observeWidthForAutoHeight(el);

    // Cover image — supports vault paths, [[wiki-links]], https:// URLs,
    // and Obsidian Properties arrays (takes first element).
    if (showImage) {
      const rawProp: unknown = fm[imageProperty];
      // Obsidian Properties UI can store links as arrays — take first element
      const rawImage = typeof rawProp === 'string' ? rawProp
        : Array.isArray(rawProp) && typeof rawProp[0] === 'string' ? rawProp[0]
        : '';
      if (rawImage) {
        const trimmed = rawImage.trim();
        let imgSrc = '';
        if (trimmed.startsWith('https://')) {
          imgSrc = trimmed;
        } else {
          const imagePath = stripWikiLink(trimmed);
          // Use Obsidian's link resolution (O(1) via metadata cache index)
          const resolved = this.app.metadataCache.getFirstLinkpathDest(imagePath, file.path);
          const imageFile = resolved
            ?? this.app.vault.getAbstractFileByPath(imagePath)
            ?? null;
          if (imageFile instanceof TFile) {
            imgSrc = this.app.vault.getResourcePath(imageFile);
          }
        }
        if (imgSrc) {
          const img = el.createEl('img', { cls: 'random-note-cover' });
          img.src = imgSrc;
          img.alt = file.basename;
          img.referrerPolicy = 'no-referrer';
        }
      }
    }

    // Title
    const title = (typeof fm[titleProperty] === 'string' && fm[titleProperty])
      ? fm[titleProperty]
      : file.basename;

    const titleEl = el.createEl('button', { cls: 'random-note-title' });
    titleEl.setText(title);
    titleEl.addEventListener('click', () => {
      void this.app.workspace.openLinkText(file.path, '');
    });

    // Preview
    if (preview) {
      el.createDiv({ cls: 'random-note-preview', text: preview });
    }

    // Footer
    const footer = el.createDiv({ cls: 'random-note-footer' });
    footer.createSpan({ cls: 'random-note-filename', text: file.basename });
    const openBtn = footer.createEl('button', { cls: 'random-note-open-btn', text: 'Open' });
    openBtn.addEventListener('click', () => {
      void this.app.workspace.openLinkText(file.path, '');
    });

    this.requestAutoHeight();
  }

  /** Pick the file to display. Daily seed caches the path so the selection
   *  is stable even when the tagged-file count changes mid-day. */
  private pickFile(files: TFile[], dailySeed: boolean): TFile {
    if (!dailySeed) return files[Math.floor(Math.random() * files.length)];

    const dayIndex = Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
    // Return cached pick if it's still valid for today
    if (this.dailyCache?.dayIndex === dayIndex) {
      const cached = files.find(f => f.path === this.dailyCache!.path);
      if (cached) return cached;
    }
    const idx = dayIndex % files.length;
    const picked = files[idx];
    this.dailyCache = { dayIndex, path: picked.path };
    return picked;
  }

  private extractPreview(content: string, fmEnd: number): string {
    const afterFm = content.slice(fmEnd);
    for (const line of afterFm.split('\n')) {
      const trimmed = line.trim();
      if (
        trimmed
        && !trimmed.startsWith('#')
        && !trimmed.startsWith('!')
        && !trimmed.startsWith('```')
        && !trimmed.startsWith('---')
      ) {
        // Strip basic markdown (bold, italic, links) before capping length
        const capped = trimmed.slice(0, 500);
        return capped
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
          .slice(0, 200);
      }
    }
    return '';
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new RandomNoteSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class RandomNoteSettingsModal extends Modal {
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
    new Setting(contentEl).setName('Random note settings').setHeading();

    const draft = structuredClone(this.config) as {
      tag?: string;
      dailySeed?: boolean;
      imageProperty?: string;
      titleProperty?: string;
      showImage?: boolean;
      showPreview?: boolean;
    };

    new Setting(contentEl)
      .setName('Tag filter')
      .setDesc('Only notes with this tag will appear.')
      .addText(t =>
        t.setPlaceholder('#tag or tag')
         .setValue(draft.tag ?? '')
         .onChange(v => { draft.tag = v.trim(); }),
      );

    new Setting(contentEl)
      .setName('Daily seed')
      .setDesc('Same note all day, changes at midnight.')
      .addToggle(t =>
        t.setValue(draft.dailySeed ?? false)
         .onChange(v => { draft.dailySeed = v; }),
      );

    new Setting(contentEl)
      .setName('Show cover image')
      .addToggle(t =>
        t.setValue(draft.showImage ?? true)
         .onChange(v => { draft.showImage = v; }),
      );

    new Setting(contentEl)
      .setName('Cover image property')
      .setDesc('Frontmatter property with the image path.')
      .addText(t =>
        t.setPlaceholder('Cover')
         .setValue(draft.imageProperty ?? '')
         .onChange(v => { draft.imageProperty = v.trim() || 'cover'; }),
      );

    new Setting(contentEl)
      .setName('Title property')
      .setDesc('Frontmatter property for the title. Falls back to filename.')
      .addText(t =>
        t.setPlaceholder('Title')
         .setValue(draft.titleProperty ?? 'title')
         .onChange(v => { draft.titleProperty = v.trim() || 'title'; }),
      );

    new Setting(contentEl)
      .setName('Show content preview')
      .setDesc('Show the first paragraph or frontmatter description.')
      .addToggle(t =>
        t.setValue(draft.showPreview ?? true)
         .onChange(v => { draft.showPreview = v; }),
      );

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => {
          this.onSave(draft as Record<string, unknown>);
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
