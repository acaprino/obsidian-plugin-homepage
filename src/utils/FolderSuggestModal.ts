import { App, SuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends SuggestModal<TFolder> {
  private cachedFolders: TFolder[] | null = null;

  constructor(
    app: App,
    private onChoose: (folder: TFolder) => void,
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
    el.createEl('span', { text: folder.path === '/' ? '/ (vault root)' : folder.path });
  }

  onChooseSuggestion(folder: TFolder): void {
    this.onChoose(folder);
  }
}
