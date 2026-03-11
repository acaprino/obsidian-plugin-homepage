import { App, Modal, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { createEmojiPicker, EmojiPickerInstance } from '../utils/emojiPicker';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';
import { enableDragReorder } from '../utils/dragReorder';

interface LinkItem {
  label: string;
  path: string;
  emoji?: string;
}

interface FolderLinksConfig {
  title?: string;
  folder?: string;
  folderEmoji?: string;
  links?: LinkItem[];
  linkAlign?: 'left' | 'center' | 'right';
}

const VALID_ALIGNS = new Set(['left', 'center', 'right']);

// ── Block ────────────────────────────────────────────────────────────────────

export class FolderLinksBlock extends BaseBlock {
  private static readonly DEBOUNCE_MS = 150;

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('folder-links-block');

    const trigger = () => this.scheduleRender(FolderLinksBlock.DEBOUNCE_MS, () => this.renderContent());
    const cfg = this.instance.config as FolderLinksConfig;
    const isRelevant = (file: TAbstractFile) => {
      const folder = (cfg.folder ?? '').trim().replace(/\/+$/, '');
      return !!folder && file.path.startsWith(folder + '/');
    };
    this.registerEvent(this.app.vault.on('create', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('delete', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      const folder = (cfg.folder ?? '').trim().replace(/\/+$/, '');
      if (isRelevant(f) || (folder && oldPath.startsWith(folder + '/'))) trigger();
    }));

    // Defer first render so vault is fully indexed
    this.app.workspace.onLayoutReady(() => this.renderContent());
  }

  private renderContent(): void {
    const el = this.containerEl;
    if (!el) return;
    el.empty();

    const cfg = this.instance.config as FolderLinksConfig;
    const folder = cfg.folder ?? '';
    const links = cfg.links ?? [];
    const linkAlign = VALID_ALIGNS.has(cfg.linkAlign ?? '') ? cfg.linkAlign! : 'left';
    const folderEmoji = cfg.folderEmoji ?? '';

    this.renderHeader(el, 'Folder links');

    const list = el.createDiv({ cls: 'folder-links-list' });
    list.addClass(`folder-links-align-${linkAlign}`);

    // Auto-list notes from selected folder (sorted alphabetically)
    if (folder) {
      const normalised = folder.trim().replace(/\/+$/, '');

      if (!normalised) {
        list.createEl('p', { text: 'Vault root listing is not supported. Select a subfolder.', cls: 'block-loading' });
      } else {
        const folderObj = this.app.vault.getAbstractFileByPath(normalised);

        if (!(folderObj instanceof TFolder)) {
          list.createEl('p', { text: `Folder "${normalised}" not found.`, cls: 'block-loading' });
        } else {
          const notes = this.getNotesInFolder(folderObj)
            .sort((a, b) => a.basename.localeCompare(b.basename));

          for (const file of notes) {
            const item = list.createDiv({ cls: 'folder-link-item' });
            const btn = item.createEl('button', { cls: 'folder-link-btn' });
            if (folderEmoji) {
              btn.createSpan({ cls: 'link-emoji', text: folderEmoji });
            }
            btn.createSpan({ text: file.basename });
            btn.addEventListener('click', () => {
              void this.app.workspace.openLinkText(file.path, '');
            });
          }

          if (notes.length === 0) {
            list.createEl('p', { text: `No notes in "${folderObj.path}".`, cls: 'block-loading' });
          }
        }
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
        void this.app.workspace.openLinkText(link.path, '');
      });
    }

    if (!folder && links.length === 0) {
      const hint = list.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F517}' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No links yet. Add manual links or pick a folder in settings.' });
    }
  }

  /** Recursively collect all files within a folder. */
  private getNotesInFolder(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const recurse = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) files.push(child);
        else if (child instanceof TFolder) recurse(child);
      }
    };
    recurse(folder);
    return files;
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new FolderLinksSettingsModal(
      this.app,
      this.instance.config as FolderLinksConfig,
      (newConfig) => { onSave(newConfig as Record<string, unknown>); },
    ).open();
  }
}

// ── Settings modal ───────────────────────────────────────────────────────────

class FolderLinksSettingsModal extends Modal {
  constructor(
    app: App,
    private config: FolderLinksConfig,
    private onSave: (config: FolderLinksConfig) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Quick links settings').setHeading();

    const draft: FolderLinksConfig = structuredClone(this.config);
    draft.links ??= [];
    const links = draft.links;

    // Track all pickers so we can close siblings when one opens
    const pickers: EmojiPickerInstance[] = [];
    const closeAllPickers = () => { for (const p of pickers) p.close(); };

    new Setting(contentEl)
      .setName('Link alignment')
      .setDesc('Align links to the left, center, or right.')
      .addDropdown(d =>
        d.addOptions({ left: 'Left', center: 'Center', right: 'Right' })
         .setValue(draft.linkAlign ?? 'left')
         .onChange(v => { draft.linkAlign = v as 'left' | 'center' | 'right'; }),
      );

    let folderText: import('obsidian').TextComponent;
    new Setting(contentEl)
      .setName('Auto-list folder')
      .setDesc('List all notes from this vault folder as links.')
      .addText(t => {
        folderText = t;
        t.setValue(draft.folder ?? '')
         .setPlaceholder('Projects')
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

    // Folder emoji picker
    const folderPicker = createEmojiPicker({
      container: contentEl,
      label: 'Folder link emoji',
      value: draft.folderEmoji ?? '',
      placeholder: 'None',
      rowClass: 'link-emoji-picker-row',
      panelClass: 'link-emoji-panel',
      onSelect: (emoji) => { draft.folderEmoji = emoji; },
      onClear: () => { draft.folderEmoji = ''; },
      onBeforeOpen: closeAllPickers,
    });
    pickers.push(folderPicker);

    new Setting(contentEl).setName('Manual links').setHeading();

    const linksContainer = contentEl.createDiv();

    const dragState = { dragIdx: -1 };
    const renderLinks = () => {
      // Remove old per-link pickers from the tracking array (keep folder picker at index 0)
      pickers.length = 1;
      linksContainer.empty();
      links.forEach((link, i) => {
        const row = linksContainer.createDiv({ cls: 'settings-link-row' });
        enableDragReorder(row, i, links, dragState, renderLinks);
        new Setting(row)
          .setName(`Link ${i + 1}`)
          .addText(t => t.setPlaceholder('Label').setValue(link.label).onChange(v => { link.label = v; }))
          .addText(t => t.setPlaceholder('Path').setValue(link.path).onChange(v => { link.path = v; }))
          .addButton(btn => btn.setIcon('trash').setTooltip('Remove').onClick(() => {
            links.splice(i, 1);
            renderLinks();
          }));

        // Emoji picker inline after the setting row
        const linkPicker = createEmojiPicker({
          container: row,
          panelContainer: row,
          value: link.emoji ?? '',
          placeholder: 'Emoji',
          rowClass: 'link-emoji-picker-row',
          panelClass: 'link-emoji-panel',
          onSelect: (emoji) => { link.emoji = emoji; },
          onClear: () => { link.emoji = undefined; },
          onBeforeOpen: closeAllPickers,
        });
        pickers.push(linkPicker);
      });
    };
    renderLinks();

    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Add link').onClick(() => {
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
