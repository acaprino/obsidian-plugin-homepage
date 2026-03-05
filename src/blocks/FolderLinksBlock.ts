import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

interface LinkItem {
  label: string;
  path: string;
  emoji?: string;
}

export class FolderLinksBlock extends BaseBlock {
  private containerEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('folder-links-block');
    this.renderContent();
  }

  private renderContent(): void {
    const el = this.containerEl;
    if (!el) return;
    el.empty();

    const { title = 'Links', links = [] } = this.instance.config as {
      title?: string;
      links?: LinkItem[];
    };

    this.renderHeader(el, title);

    const list = el.createDiv({ cls: 'folder-links-list' });
    for (const link of links) {
      const item = list.createDiv({ cls: 'folder-link-item' });
      const btn = item.createEl('button', { cls: 'folder-link-btn' });
      if (link.emoji) {
        btn.createSpan({ cls: 'link-emoji', text: link.emoji });
      }
      btn.createSpan({ text: link.label });
      btn.addEventListener('click', () => {
        this.app.workspace.openLinkText(link.path, '');
      });
    }
  }

  openSettings(onSave: () => void): void {
    new FolderLinksSettingsModal(
      this.app,
      this.instance.config as { title?: string; links?: LinkItem[] },
      (newConfig) => {
        this.instance.config = newConfig as Record<string, unknown>;
        this.renderContent();
        onSave();
      },
    ).open();
  }
}

class FolderLinksSettingsModal extends Modal {
  constructor(
    app: App,
    private config: { title?: string; links?: LinkItem[] },
    private onSave: (config: { title?: string; links?: LinkItem[] }) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Folder Links Settings' });

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(this.config.title ?? 'Links')
       .onChange(v => { this.config.title = v; }),
    );

    contentEl.createEl('h3', { text: 'Links' });

    const links: LinkItem[] = (this.config.links ?? []).map(l => ({ ...l }));
    const linksContainer = contentEl.createDiv();

    const renderLinks = () => {
      linksContainer.empty();
      links.forEach((link, i) => {
        const row = linksContainer.createDiv({ cls: 'settings-link-row' });
        new Setting(row)
          .setName(`Link ${i + 1}`)
          .addText(t => t.setPlaceholder('Label').setValue(link.label).onChange(v => { links[i].label = v; }))
          .addText(t => t.setPlaceholder('Path').setValue(link.path).onChange(v => { links[i].path = v; }))
          .addText(t => t.setPlaceholder('Emoji').setValue(link.emoji ?? '').onChange(v => { links[i].emoji = v || undefined; }))
          .addButton(btn => btn.setIcon('trash').setTooltip('Remove').onClick(() => {
            links.splice(i, 1);
            renderLinks();
          }));
      });
    };
    renderLinks();

    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Add Link').onClick(() => {
        links.push({ label: '', path: '' });
        renderLinks();
      }))
      .addButton(btn => btn.setButtonText('Save').setCta().onClick(() => {
        this.config.links = links;
        this.onSave(this.config);
        this.close();
      }));
  }

  onClose(): void { this.contentEl.empty(); }
}
