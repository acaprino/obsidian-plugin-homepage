import { App, Modal, Setting, moment } from 'obsidian';
import { cacheHasTag, getFilesWithTag } from '../utils/tags';
import { parseNoteInsight } from '../utils/noteContent';
import { BaseBlock } from './BaseBlock';

const MS_PER_DAY = 86_400_000;
const DEBOUNCE_MS = 500;

export class InsightBlock extends BaseBlock {
  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('insight-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); return this.loadAndRender(e); });

    // Re-render only when a file with the configured tag is modified
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      const { tag = '' } = this.instance.config as { tag?: string };
      if (!tag) return;
      const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
      if (cacheHasTag(cache, tagSearch)) trigger();
    }));

    // A source file may have been deleted — only re-render if it could be relevant
    this.registerEvent(this.app.vault.on('delete', (file) => {
      const { tag = '' } = this.instance.config as { tag?: string };
      if (!tag) return;
      // Cannot check cache (already removed), but only markdown files can have tags
      if (file.path.endsWith('.md')) trigger();
    }));

    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] InsightBlock failed to render:', e);
      el.setText('Error loading insight. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const gen = this.nextGeneration();
    const { tag = '', dailySeed = true } = this.instance.config as {
      tag?: string;
      dailySeed?: boolean;
    };

    this.renderHeader(el, 'Insight');

    const card = el.createDiv({ cls: 'insight-card' });

    if (!tag) {
      const hint = card.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F4A1}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No tag configured. Add a tag in settings to show a daily rotating note.' });
      return;
    }

    const tagSearch = tag.startsWith('#') ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch);

    if (files.length === 0) {
      card.setText(`No files found with tag ${tagSearch}`);
      return;
    }

    // Use local midnight as the day index so it changes at local midnight, not UTC
    const dayIndex = Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
    const index = dailySeed
      ? dayIndex % files.length
      : Math.floor(Math.random() * files.length);

    const file = files[index];
    const cache = this.app.metadataCache.getFileCache(file);

    try {
      const content = await this.app.vault.read(file);
      if (this.isStale(gen)) return;
      const { heading, body } = parseNoteInsight(content, cache);

      card.createDiv({ cls: 'insight-title', text: heading || file.basename });
      card.createDiv({ cls: 'insight-body', text: body });
    } catch (e) {
      console.error('[Homepage Blocks] InsightBlock failed to read file:', e);
      card.setText('Error reading file.');
    }
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new InsightSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class InsightSettingsModal extends Modal {
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
    new Setting(contentEl).setName('Insight settings').setHeading();

    const draft = structuredClone(this.config);

    new Setting(contentEl).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(draft.tag as string ?? '')
       .onChange(v => { draft.tag = v; }),
    );
    new Setting(contentEl).setName('Daily seed').setDesc('Show same note all day').addToggle(t =>
      t.setValue(draft.dailySeed as boolean ?? true)
       .onChange(v => { draft.dailySeed = v; }),
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
