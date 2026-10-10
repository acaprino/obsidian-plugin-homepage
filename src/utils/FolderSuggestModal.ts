import { App, SuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends SuggestModal<TFolder> {
  private cachedFolders: TFolder[] | null = null;

  constructor(
    app: App,
    private onChoose: (folder: TFolder) => void,
    /** includeRoot false leaves the vault root out, for blocks that need a subfolder (M67). */
    private opts: { includeRoot?: boolean } = {},
  ) {
    super(app);
    this.setPlaceholder('Type to search vault folders\u2026');
  }

  private getAllFolders(): TFolder[] {
    if (this.cachedFolders) return this.cachedFolders;
    const folders: TFolder[] = [];
    const recurse = (f: TFolder) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    if (this.opts.includeRoot === false) folders.shift();
    this.cachedFolders = folders;
    return folders;
  }

  getSuggestions(query: string): TFolder[] {
    const q = query.toLowerCase();
    return this.getAllFolders().filter(f =>
      f.path.toLowerCase().includes(q),
    );
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createSpan({ text: folder.path === '/' ? '/ (vault root)' : folder.path });
  }

  onChooseSuggestion(folder: TFolder): void {
    this.onChoose(folder);
  }
}
