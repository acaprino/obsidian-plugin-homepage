import { Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
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
  folder?: string;
  folderEmoji?: string;
  links?: LinkItem[];
  linkAlign?: 'left' | 'center' | 'right';
}

const VALID_ALIGNS = new Set(['left', 'center', 'right']);

// ── Glob parsing ─────────────────────────────────────────────────────────────

interface ParsedFolder {
  /** Static folder prefix to scan. Empty string means vault root. */
  folder: string;
  /** Whether the original input contained wildcard characters. */
  hasPattern: boolean;
  /** Test a path relative to `folder` against the glob pattern. */
  matches: (relPath: string) => boolean;
}

function parseFolderPattern(input: string): ParsedFolder {
  const trimmed = (input ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return { folder: '', hasPattern: false, matches: () => true };

  const wildcardIdx = trimmed.search(/[*?]/);
  if (wildcardIdx === -1) {
    return { folder: trimmed, hasPattern: false, matches: () => true };
  }

  const lastSlash = trimmed.lastIndexOf('/', wildcardIdx);
  const folder = lastSlash === -1 ? '' : trimmed.slice(0, lastSlash);
  const patternStr = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
  const re = globToRegex(patternStr);
  return { folder, hasPattern: true, matches: (p) => re.test(p) };
}

function globToRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$', 'i');
}

// ── Block ────────────────────────────────────────────────────────────────────

export class FolderLinksBlock extends BaseBlock {
  private static readonly DEBOUNCE_MS = 150;

  render(el: HTMLElement): void {
    this.containerEl = el;
    el.addClass('folder-links-block');

    const trigger = () => this.scheduleRender(FolderLinksBlock.DEBOUNCE_MS, () => this.renderContent());
    const cfg = this.instance.config as FolderLinksConfig;
    const scopeOf = () => parseFolderPattern(cfg.folder ?? '').folder;
    const isRelevant = (file: TAbstractFile) => {
      const folder = scopeOf();
      return folder === '' ? true : file.path.startsWith(folder + '/');
    };
    this.registerEvent(this.app.vault.on('create', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('delete', (f) => { if (isRelevant(f)) trigger(); }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      const folder = scopeOf();
      const underFolder = folder === '' || oldPath.startsWith(folder + '/');
      if (isRelevant(f) || underFolder) trigger();
    }));

    // Defer first render so vault is fully indexed
    this.app.workspace.onLayoutReady(() => this.renderContent());
  }

  private renderContent(): void {
    const el = this.containerEl;
    if (!el) return;
    el.empty();

    const cfg = this.instance.config as FolderLinksConfig;
    const folderInput = cfg.folder ?? '';
    const links = cfg.links ?? [];
    const linkAlign = VALID_ALIGNS.has(cfg.linkAlign ?? '') ? cfg.linkAlign! : 'left';
    const folderEmoji = cfg.folderEmoji ?? '';

    this.renderHeader(el, 'Folder links');

    const list = el.createDiv({ cls: 'folder-links-list' });
    list.addClass(`folder-links-align-${linkAlign}`);

    // Auto-list notes from selected folder (sorted alphabetically)
    if (folderInput.trim()) {
      const parsed = parseFolderPattern(folderInput);

      if (!parsed.folder && !parsed.hasPattern) {
        list.createEl('p', { text: 'Vault root listing is not supported. Select a subfolder.', cls: 'block-loading' });
      } else {
        const root = parsed.folder
          ? this.app.vault.getAbstractFileByPath(parsed.folder)
          : this.app.vault.getRoot();

        if (!(root instanceof TFolder)) {
          list.createEl('p', { text: `Folder "${parsed.folder}" not found.`, cls: 'block-loading' });
        } else {
          const prefix = parsed.folder ? parsed.folder + '/' : '';
          const notes = this.getNotesInFolder(root)
            .filter(f => parsed.matches(prefix ? f.path.slice(prefix.length) : f.path))
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
            const label = parsed.hasPattern ? `matching "${folderInput}"` : `in "${root.path}"`;
            list.createEl('p', { text: `No notes ${label}.`, cls: 'block-loading' });
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

    if (!folderInput.trim() && links.length === 0) {
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

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as FolderLinksConfig;
    cfg.links ??= [];
    const links = cfg.links;

    // Track all pickers so we can close siblings when one opens
    const pickers: EmojiPickerInstance[] = [];
    const closeAllPickers = () => { for (const p of pickers) p.close(); };

    new Setting(body)
      .setName('Link alignment')
      .setDesc('Left, center, or right.')
      .addDropdown(d =>
        d.addOptions({ left: 'Left', center: 'Center', right: 'Right' })
         .setValue(cfg.linkAlign ?? 'left')
         .onChange(v => { cfg.linkAlign = v as 'left' | 'center' | 'right'; }),
      );

    let folderText: import('obsidian').TextComponent;
    new Setting(body)
      .setName('Auto-list folder')
      .setDesc('Folder path, with optional wildcards. Examples: Projects, Projects/*.md, Projects/**/*-draft.md')
      .addText(t => {
        folderText = t;
        t.setValue(cfg.folder ?? '')
         .setPlaceholder('Projects/*.md')
         .onChange(v => { cfg.folder = v; });
      })
      .addButton(btn =>
        btn.setIcon('folder').setTooltip('Browse vault folders').onClick(() => {
          new FolderSuggestModal(this.app, (folder) => {
            const path = folder.path === '/' ? '' : folder.path;
            cfg.folder = path;
            folderText.setValue(path);
          }).open();
        }),
      );

    // Folder emoji picker
    const folderPicker = createEmojiPicker({
      container: body,
      label: 'Folder link emoji',
      value: cfg.folderEmoji ?? '',
      placeholder: 'None',
      rowClass: 'link-emoji-picker-row',
      panelClass: 'link-emoji-panel',
      onSelect: (emoji) => { cfg.folderEmoji = emoji; },
      onClear: () => { cfg.folderEmoji = ''; },
      onBeforeOpen: closeAllPickers,
    });
    pickers.push(folderPicker);

    new Setting(body).setName('Manual links').setHeading();

    const linksContainer = body.createDiv();

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

    new Setting(body)
      .addButton(btn => btn.setButtonText('Add link').onClick(() => {
        links.push({ label: '', path: '' });
        renderLinks();
      }));
  }
}
