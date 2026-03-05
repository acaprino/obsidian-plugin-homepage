import { App, CachedMetadata, Modal, Setting, TFile, moment } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { getFilesWithTag } from '../utils/tags';
import { BaseBlock } from './BaseBlock';

const MS_PER_DAY = 86_400_000;

export class InsightBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('insight-block');
    this.loadAndRender(el).catch(e => {
      console.error('[Homepage Blocks] InsightBlock failed to render:', e);
      el.setText('Error loading insight. Check console for details.');
    });
  }

  private async loadAndRender(el: HTMLElement): Promise<void> {
    const { tag = '', title = 'Daily Insight', dailySeed = true } = this.instance.config as {
      tag?: string;
      title?: string;
      dailySeed?: boolean;
    };

    this.renderHeader(el, title);

    const card = el.createDiv({ cls: 'insight-card' });

    if (!tag) {
      card.setText('Configure a tag in block settings.');
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
      const { heading, body } = this.parseContent(content, cache);

      card.createDiv({ cls: 'insight-title', text: heading || file.basename });
      card.createDiv({ cls: 'insight-body', text: body });
    } catch (e) {
      console.error('[Homepage Blocks] InsightBlock failed to read file:', e);
      card.setText('Error reading file.');
    }
  }

  /**
   * Extract the first heading and first paragraph using metadataCache offsets.
   * Falls back to manual parsing only if cache is unavailable.
   */
  private parseContent(content: string, cache: CachedMetadata | null): { heading: string; body: string } {
    // Use cached heading if available (avoids manual parsing)
    const heading = cache?.headings?.[0]?.heading ?? '';

    // Skip frontmatter using the cached offset
    const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
    const afterFm = content.slice(fmEnd);

    // First non-empty, non-heading line is the body
    const body = afterFm
      .split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('#')) ?? '';

    return { heading, body };
  }

  openSettings(onSave: () => void): void {
    new InsightSettingsModal(this.app, this.instance.config, (cfg) => {
      this.instance.config = cfg;
      onSave();
    }).open();
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
    contentEl.createEl('h2', { text: 'Insight Settings' });

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(this.config.title as string ?? 'Daily Insight')
       .onChange(v => { this.config.title = v; }),
    );
    new Setting(contentEl).setName('Tag').setDesc('Without # prefix').addText(t =>
      t.setValue(this.config.tag as string ?? '')
       .onChange(v => { this.config.tag = v; }),
    );
    new Setting(contentEl).setName('Daily seed').setDesc('Show same note all day').addToggle(t =>
      t.setValue(this.config.dailySeed as boolean ?? true)
       .onChange(v => { this.config.dailySeed = v; }),
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
