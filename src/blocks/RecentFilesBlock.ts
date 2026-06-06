import { Setting, moment } from 'obsidian';
import { BaseBlock } from './BaseBlock';

const DEBOUNCE_MS = 500;

interface RecentFilesConfig {
  maxItems?: number;
  showTimestamp?: boolean;
  excludeFolders?: string;
}

export class RecentFilesBlock extends BaseBlock {
  /** Path of the currently-displayed most-recent file (set each renderContent). */
  private topPath: string | null = null;

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('recent-files-block');

    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => { e.empty(); this.renderContent(e); });

    this.registerEvent(this.app.vault.on('modify', (file) => {
      // O(1) guard — no full-vault sort here (the old version sorted every
      // markdown file on EVERY modify event, before the debounce). A modify
      // bumps the file's mtime to "now", so it jumps to the top of the
      // mtime-sorted list and changes the displayed list — UNLESS it was
      // already the top item. So: re-render unless the file is already #1.
      if (!file.path.endsWith('.md')) return;
      const cfg = this.instance.config as RecentFilesConfig;
      const excluded = (cfg.excludeFolders ?? '').split(',').map(f => f.trim()).filter(Boolean);
      if (excluded.some(folder => file.path.startsWith(folder + '/'))) return;
      if (file.path === this.topPath) return;
      trigger();
    }));
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

    // Cache the top file's path so the modify handler can skip re-rendering
    // when an already-#1 file is modified (the one case where the list is unchanged).
    this.topPath = files[0]?.path ?? null;

    const list = el.createDiv({ cls: 'recent-files-list' });

    if (files.length === 0) {
      const hint = list.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '📄' });
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

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as RecentFilesConfig;

    new Setting(body)
      .setName('Max items')
      .setDesc('How many files to show (5–20).')
      .addSlider(s =>
        s.setLimits(5, 20, 1)
         .setValue(cfg.maxItems ?? 10)
         .setDynamicTooltip()
         .onChange(v => { cfg.maxItems = v; }),
      );

    new Setting(body)
      .setName('Show timestamps')
      .setDesc('Show relative time next to each file.')
      .addToggle(t =>
        t.setValue(cfg.showTimestamp ?? true)
         .onChange(v => { cfg.showTimestamp = v; }),
      );

    new Setting(body)
      .setName('Exclude folders')
      .setDesc('Comma-separated folder paths to exclude.')
      .addText(t =>
        t.setPlaceholder('e.g. Templates, Archive/old')
         .setValue(cfg.excludeFolders ?? '')
         .onChange(v => { cfg.excludeFolders = v; }),
      );
  }
}
