import { App, Modal, Setting, TFile, moment } from 'obsidian';
import { cacheHasTag, getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

const MS_PER_DAY = 86_400_000;
const DEBOUNCE_MS = 500;

/** Strip [[...]] wiki-link syntax to get the raw path */
function stripWikiLink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)(?:\|.*)?\]\]$/);
  return m ? m[1] : raw;
}

export class RandomNoteBlock extends BaseBlock {
  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('random-note-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    this.registerEvent(this.app.metadataCache.on('changed', (_file, _data, cache) => {
      const { tag = '' } = this.instance.config as { tag?: string };
      if (!tag) return;
      const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
      if (cacheHasTag(cache, tagSearch)) trigger();
    }));

    this.registerEvent(this.app.vault.on('delete', (file) => {
      const { tag = '' } = this.instance.config as { tag?: string };
      if (!tag || !file.path.endsWith('.md')) return;
      trigger();
    }));

    this.registerEvent(this.app.vault.on('rename', (file) => {
      const { tag = '' } = this.instance.config as { tag?: string };
      if (!tag || !file.path.endsWith('.md')) return;
      trigger();
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

    const dayIndex = Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
    const idx = dailySeed
      ? dayIndex % files.length
      : Math.floor(Math.random() * files.length);
    const file = files[idx];
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

    // Cover image — supports vault paths, [[wiki-links]], https:// URLs,
    // and Obsidian Properties arrays (takes first element).
    if (showImage) {
      const rawProp = fm[imageProperty];
      // Obsidian Properties UI can store links as arrays — take first element
      const rawImage = typeof rawProp === 'string' ? rawProp
        : Array.isArray(rawProp) && typeof rawProp[0] === 'string' ? rawProp[0] as string
        : '';
      if (rawImage) {
        const trimmed = rawImage.trim();
        let imgSrc = '';
        if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
          imgSrc = trimmed;
        } else {
          const imagePath = stripWikiLink(trimmed);
          // Try exact path first, then search all files by basename
          const imageFile = this.app.vault.getAbstractFileByPath(imagePath)
            ?? this.app.vault.getFiles().find(f => f.name === imagePath || f.path === imagePath)
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
      .setDesc('Required. Only notes with this tag are candidates.')
      .addText(t =>
        t.setPlaceholder('#tag or tag')
         .setValue(draft.tag ?? '')
         .onChange(v => { draft.tag = v.trim(); }),
      );

    new Setting(contentEl)
      .setName('Daily seed')
      .setDesc('Show the same note all day; changes at midnight.')
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
      .setDesc('Frontmatter property name that holds the image path.')
      .addText(t =>
        t.setPlaceholder('Cover')
         .setValue(draft.imageProperty ?? '')
         .onChange(v => { draft.imageProperty = v.trim() || 'cover'; }),
      );

    new Setting(contentEl)
      .setName('Title property')
      .setDesc('Frontmatter property for the note title. Falls back to filename.')
      .addText(t =>
        t.setPlaceholder('Title')
         .setValue(draft.titleProperty ?? 'title')
         .onChange(v => { draft.titleProperty = v.trim() || 'title'; }),
      );

    new Setting(contentEl)
      .setName('Show content preview')
      .setDesc('Show first paragraph or frontmatter description/excerpt.')
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
