import { App, Modal, Setting, SuggestModal, TFile, TFolder } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

interface LinkItem {
  label: string;
  path: string;
  emoji?: string;
}

// ── Folder picker ────────────────────────────────────────────────────────────

class FolderSuggestModal extends SuggestModal<TFolder> {
  constructor(app: App, private onChoose: (folder: TFolder) => void) {
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
    return this.getAllFolders().filter(f => f.path.toLowerCase().includes(q));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createEl('span', { text: folder.path === '/' ? '/ (vault root)' : folder.path });
  }

  onChooseSuggestion(folder: TFolder): void { this.onChoose(folder); }
}

// ── Block ────────────────────────────────────────────────────────────────────

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

    const { title = 'Quick Links', folder = '', links = [] } = this.instance.config as {
      title?: string;
      folder?: string;
      links?: LinkItem[];
    };

    this.renderHeader(el, title);

    const list = el.createDiv({ cls: 'folder-links-list' });

    // Auto-list notes from selected folder (sorted alphabetically)
    if (folder) {
      const folderObj = this.app.vault.getAbstractFileByPath(folder);
      if (folderObj instanceof TFolder) {
        const notes = folderObj.children
          .filter((child): child is TFile => child instanceof TFile && child.extension === 'md')
          .sort((a, b) => a.basename.localeCompare(b.basename));

        for (const file of notes) {
          const item = list.createDiv({ cls: 'folder-link-item' });
          const btn = item.createEl('button', { cls: 'folder-link-btn' });
          btn.createSpan({ text: file.basename });
          btn.addEventListener('click', () => {
            this.app.workspace.openLinkText(file.path, '');
          });
        }

        if (notes.length === 0) {
          list.createEl('p', { text: 'No notes in this folder.', cls: 'block-loading' });
        }
      } else {
        list.createEl('p', { text: `Folder "${folder}" not found.`, cls: 'block-loading' });
      }
    }

    // Manual links
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

    if (!folder && links.length === 0) {
      list.createEl('p', { text: 'Add links or select a folder in settings.', cls: 'block-loading' });
    }
  }

  openSettings(onSave: () => void): void {
    new FolderLinksSettingsModal(
      this.app,
      this.instance.config as { title?: string; folder?: string; links?: LinkItem[] },
      (newConfig) => {
        this.instance.config = newConfig as Record<string, unknown>;
        this.renderContent();
        onSave();
      },
    ).open();
  }
}

// ── Settings modal ───────────────────────────────────────────────────────────

class FolderLinksSettingsModal extends Modal {
  constructor(
    app: App,
    private config: { title?: string; folder?: string; links?: LinkItem[] },
    private onSave: (config: { title?: string; folder?: string; links?: LinkItem[] }) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Quick Links Settings' });

    const draft: { title?: string; folder?: string; links?: LinkItem[] } = structuredClone(this.config);
    draft.links ??= [];
    const links = draft.links;

    new Setting(contentEl).setName('Block title').addText(t =>
      t.setValue(draft.title ?? 'Quick Links')
       .onChange(v => { draft.title = v; }),
    );

    let folderText: import('obsidian').TextComponent;
    new Setting(contentEl)
      .setName('Auto-list folder')
      .setDesc('List all notes from this vault folder as links.')
      .addText(t => {
        folderText = t;
        t.setValue(draft.folder ?? '')
         .setPlaceholder('e.g. Projects')
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

    contentEl.createEl('h3', { text: 'Manual links' });

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
        this.onSave(draft);
        this.close();
      }));
  }

  onClose(): void { this.contentEl.empty(); }
}
