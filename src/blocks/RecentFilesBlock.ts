import { App, Modal, Setting, moment } from 'obsidian';
import { BaseBlock } from './BaseBlock';

const DEBOUNCE_MS = 500;

interface RecentFilesConfig {
  title?: string;
  maxItems?: number;
  showTimestamp?: boolean;
  excludeFolders?: string;
}

// ── Block ────────────────────────────────────────────────────────────────────

export class RecentFilesBlock extends BaseBlock {
  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('recent-files-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); this.renderContent(e); });

    this.registerEvent(this.app.vault.on('modify', () => trigger()));
    this.registerEvent(this.app.vault.on('create', () => trigger()));
    this.registerEvent(this.app.vault.on('delete', () => trigger()));
    this.registerEvent(this.app.vault.on('rename', () => trigger()));

    this.renderContent(el);
  }

  private renderContent(el: HTMLElement): void {
    const {
      maxItems = 10,
      showTimestamp = true,
      excludeFolders = '',
    } = this.instance.config as RecentFilesConfig;

    this.renderHeader(el, 'Recent files');

    const excluded = excludeFolders.split(',').map(f => f.trim()).filter(Boolean);

    const files = this.app.vault.getMarkdownFiles()
      .filter(file => !excluded.some(folder => file.path.startsWith(folder + '/')))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, maxItems);

    const list = el.createDiv({ cls: 'recent-files-list' });

    if (files.length === 0) {
      const hint = list.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\uD83D\uDCC4' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No recent files found.' });
      return;
    }

    for (const file of files) {
      const item = list.createDiv({ cls: 'recent-file-item' });
      const btn = item.createEl('button', { cls: 'recent-file-btn' });
      btn.createSpan({ cls: 'recent-file-name', text: file.basename });
      if (showTimestamp) {
        btn.createSpan({ cls: 'recent-file-time', text: moment(file.stat.mtime).fromNow() });
      }
      btn.addEventListener('click', () => {
        void this.app.workspace.openLinkText(file.path, '');
      });
    }
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new RecentFilesSettingsModal(this.app, this.instance.config as RecentFilesConfig, onSave).open();
  }
}

// ── Settings modal ───────────────────────────────────────────────────────────

class RecentFilesSettingsModal extends Modal {
  constructor(
    app: App,
    private config: RecentFilesConfig,
    private onSave: (cfg: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Recent files settings').setHeading();

    const draft: RecentFilesConfig = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Max items')
      .setDesc('Number of recent files to show (5\u201320).')
      .addSlider(s =>
        s.setLimits(5, 20, 1)
         .setValue(draft.maxItems ?? 10)
         .setDynamicTooltip()
         .onChange(v => { draft.maxItems = v; }),
      );

    new Setting(contentEl)
      .setName('Show timestamps')
      .setDesc('Display relative time next to each file name.')
      .addToggle(t =>
        t.setValue(draft.showTimestamp ?? true)
         .onChange(v => { draft.showTimestamp = v; }),
      );

    new Setting(contentEl)
      .setName('Exclude folders')
      .setDesc('Comma-separated folder paths to exclude.')
      .addText(t =>
        t.setPlaceholder('e.g. Templates, Archive/old')
         .setValue(draft.excludeFolders ?? '')
         .onChange(v => { draft.excludeFolders = v; }),
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
