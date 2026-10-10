import { Notice, Platform, Plugin, WorkspaceLeaf, normalizePath } from 'obsidian';
import { VIEW_TYPE, HomepageView } from './HomepageView';
import { BlockInstance, LayoutConfig, LayoutPriority, OpenMode, IHomepagePlugin } from './types';
import { getDefaultLayout } from './validation';
import { DataFileGuard, fileName, loadLayoutWithRecovery, loadProblemMessage } from './utils/loadRecovery';
import { BlockRegistry } from './BlockRegistry';
import { HomepageSettingTab } from './settings/HomepageSettingTab';
import { installTagCacheListeners } from './utils/tags';
import { _resetDeviceKeyCache } from './utils/apiKeyCrypto';
import { decryptApiKeys, persistableLayout, unreadableKeyNotice } from './utils/apiKeyLayout';
import { mobileStartupActive, resolveStartup } from './utils/startupResolver';
import { GreetingBlock } from './blocks/GreetingBlock';
import { ClockBlock } from './blocks/ClockBlock';
import { FolderLinksBlock } from './blocks/FolderLinksBlock';
import { ButtonGridBlock } from './blocks/ButtonGridBlock';
import { QuotesListBlock } from './blocks/QuotesListBlock';
import { ImageGalleryBlock } from './blocks/ImageGalleryBlock';
import { EmbeddedNoteBlock } from './blocks/EmbeddedNoteBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import { HtmlBlock } from './blocks/HtmlBlock';
import { VideoEmbedBlock } from './blocks/VideoEmbedBlock';
import { BookmarkBlock } from './blocks/BookmarkBlock';
import { RecentFilesBlock } from './blocks/RecentFilesBlock';
import { PomodoroBlock } from './blocks/PomodoroBlock';
import { SpacerBlock } from './blocks/SpacerBlock';
import { RandomNoteBlock } from './blocks/RandomNoteBlock';
import { VoiceDictationBlock } from './blocks/VoiceDictationBlock';
import { VaultSearchBlock } from './blocks/VaultSearchBlock';
import { imageCache } from './utils/imageCache';
import { closeSharedAudioCtx, clearPomodoroState } from './blocks/PomodoroBlock';
import { abortActiveLightbox } from './blocks/ImageGalleryBlock';


// ── Block registration ───────────────────────────────────────────────────────

// Each factory's defaultConfig declares every config key its block reads: it
// seeds new blocks, and it is the clipboard-import allowlist that also
// type-checks imported values against these defaults (utils/importSanitizer.ts).
// A key the block reads with no default of its own (it falls back to a built-in
// value while unset) is declared as `undefined`, which never reaches data.json.
export function registerBlocks(): void {
  BlockRegistry.clear();

  BlockRegistry.register({
    type: 'greeting',
    displayName: 'Greeting',
    defaultConfig: {
      name: 'World', showTime: true, showEmoji: true, emojiMode: 'auto',
      emojiMorning: undefined, emojiAfternoon: undefined, emojiEvening: undefined, emojiNight: undefined,
      emojiPool: '', emojiDailySeed: false,
      salutationMode: 'auto', salutationPreset: 'it',
      salutMorning: undefined, salutAfternoon: undefined, salutEvening: undefined,
    },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'clock',
    displayName: 'Clock / date',
    defaultConfig: { showSeconds: false, showDate: true, clockStyle: 'minimal', format: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'folder-links',
    displayName: 'Quick links',
    defaultConfig: { _titleLabel: 'Quick links', folder: '', links: [], folderEmoji: '', linkAlign: 'left' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin),
  });


  BlockRegistry.register({
    type: 'button-grid',
    displayName: 'Button grid',
    // customCss is read but deliberately undeclared: like apiKey, it never
    // travels through export / import.
    defaultConfig: { _titleLabel: 'Button grid', columns: 2, items: [] },
    defaultSize: { w: 1, h: 5 },
    autoHeight: true,
    create: (app, instance, plugin) => new ButtonGridBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'quotes-list',
    displayName: 'Quotes',
    defaultConfig: {
      source: 'tag', tag: '', quotes: '', _titleLabel: 'Quotes', columns: 2, maxItems: 20,
      quoteStyle: 'classic', fontStyle: 'default', customFont: '', dailySeed: true, showNoteTitle: true,
      heightMode: 'extend', textAlign: 'left', verticalAlign: 'top', showAccentBar: true,
    },
    defaultSize: { w: 2, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'image-gallery',
    displayName: 'Image gallery',
    defaultConfig: { folder: '', _titleLabel: 'Gallery', columns: 3, maxItems: 0, layout: 'grid', heightMode: 'auto' },
    defaultSize: { w: 3, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'embedded-note',
    displayName: 'Embedded note',
    defaultConfig: { filePath: '', showTitle: true, heightMode: 'scroll' },
    defaultSize: { w: 1, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'static-text',
    displayName: 'Static text',
    defaultConfig: { content: '', heightMode: 'auto' },
    defaultSize: { w: 1, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'html',
    displayName: 'HTML block',
    defaultConfig: { html: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'video-embed',
    displayName: 'Video embed',
    defaultConfig: { url: '', shuffleOnLoad: false },
    defaultSize: { w: 2, h: 4 },
    create: (app, instance, plugin) => new VideoEmbedBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'bookmarks',
    displayName: 'Bookmarks',
    defaultConfig: { _titleLabel: 'Bookmarks', items: [], columns: 2, showDescriptions: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new BookmarkBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'recent-files',
    displayName: 'Recent files',
    defaultConfig: { _titleLabel: 'Recent files', maxItems: 10, showTimestamp: true, excludeFolders: '' },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RecentFilesBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'pomodoro',
    displayName: 'Pomodoro timer',
    defaultConfig: {
      _titleLabel: 'Pomodoro', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLong: 4,
      soundType: 'crystal', autoStartCycle: false,
    },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new PomodoroBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'spacer',
    displayName: 'Spacer',
    defaultConfig: { _showTitle: false, _showBorder: false, _showBackground: false, _showHeaderAccent: false },
    defaultSize: { w: 1, h: 2 },
    create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'random-note',
    displayName: 'Random note',
    defaultConfig: { _titleLabel: 'Random note', tag: '', dailySeed: false, imageProperty: 'cover', titleProperty: 'title', showImage: true, showPreview: true },
    defaultSize: { w: 1, h: 4 },
    autoHeight: true,
    create: (app, instance, plugin) => new RandomNoteBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'voice-dictation',
    displayName: 'Voice notes',
    defaultConfig: {
      folder: '',
      triggerMode: 'tap',
      provider: 'whisper',
      apiKey: '',
      model: '',
      language: '',
      noteTemplate: '',
    },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'vault-search',
    displayName: 'Vault Search',
    defaultConfig: { placeholder: 'Search vault...' },
    defaultSize: { w: 2, h: 2 },
    create: (app, instance, plugin) => new VaultSearchBlock(app, instance, plugin),
  });
}

// ── Plugin ───────────────────────────────────────────────────────────────────

/**
 * Vault-scoped localStorage key (per device): ids of the blocks whose API key
 * this device was already told it cannot read.
 */
const UNREADABLE_KEYS_STORAGE_KEY = 'hp-unreadable-api-keys';

export default class HomepagePlugin extends Plugin implements IHomepagePlugin {
  layout: LayoutConfig = getDefaultLayout();

  async onload(): Promise<void> {
    registerBlocks();

    // Re-arm the imageCache singleton in case a previous onunload disposed it.
    // The module-level cache survives across plugin disable+enable in the same
    // renderer; without this, every gallery thumbnail would rebuild forever.
    imageCache.reset();

    // Plugin-wide tag-cache invalidation so callers of getFilesWithTag() always
    // see fresh data without having to wire up vault listeners themselves.
    installTagCacheListeners(this);

    // An unusable data.json (unparseable, not an object, or with invalid blocks)
    // is copied verbatim to data.json.invalid before anything can resave over it.
    const raw = await this.loadData() as unknown;
    const loaded = await loadLayoutWithRecovery(raw, this.dataFilePath(), this.app.vault.adapter);
    if (loaded.problem) {
      if (loaded.problem.kind === 'blocks-dropped') {
        console.warn(`[Homepage Blocks] ${loaded.problem.count} invalid block(s) were dropped from the layout on load`);
      }
      new Notice(loadProblemMessage(loaded.problem, loaded.backupPath), 12_000);
    }
    // Every write asks this first: while a broken data.json could not be backed
    // up, writing would destroy the only copy.
    this.dataGuard = loaded.guard;
    const validated = loaded.layout;
    // At-rest apiKey values are encrypted (AES-GCM, non-extractable device key in
    // IndexedDB). Decrypt on load so blocks see plaintext; encrypt again on save.
    const decryptResult = await decryptApiKeys(validated);
    this.layout = decryptResult.layout;
    if (!decryptResult.stable) {
      new Notice('Homepage blocks: voice API key could not be loaded right now. It will be retried on next restart.', 10_000);
    }
    this.announceUnreadableKeys(decryptResult.unreadable, decryptResult.layout);
    // Persist cleaned layout to remove old-format properties and fix corruption,
    // BUT only when the apiKey decrypt was stable. A transient WebCrypto/IndexedDB
    // failure is retried at the next launch; nothing is gained by writing now.
    if (decryptResult.stable) {
      await this.saveLayout(this.layout);
    }

    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: 'open-homepage',
      name: 'Open homepage',
      callback: () => { void this.openHomepage(this.activeManualOpenMode()); },
    });

    this.addCommand({
      id: 'toggle-edit-mode',
      name: 'Toggle edit mode',
      callback: () => { this.targetHomepage()?.toggleEditMode(); },
    });

    this.addCommand({
      id: 'add-block',
      name: 'Add block',
      callback: () => { this.targetHomepage()?.openAddBlockModal(); },
    });

    this.addRibbonIcon('home', 'Open homepage', () => { void this.openHomepage(this.activeManualOpenMode()); });

    this.addSettingTab(new HomepageSettingTab(this.app, this));

    let layoutReady = false;
    this.app.workspace.onLayoutReady(() => {
      layoutReady = true;
      if (this.activeOpenOnStartup()) {
        void this.openHomepage(this.activeOpenMode());
      }
    });

    let emptyCheckTimer: number | null = null;
    let lastEmptyOpen = 0;
    this.register(() => { if (emptyCheckTimer) window.clearTimeout(emptyCheckTimer); });
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        if (!layoutReady || !this.activeOpenWhenEmpty()) return;
        if (emptyCheckTimer) window.clearTimeout(emptyCheckTimer);
        emptyCheckTimer = window.setTimeout(() => {
          emptyCheckTimer = null;
          if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
          // Another plugin may briefly close all leaves before opening its own.
          // Guard against racing it into opening a duplicate homepage.
          if (Date.now() - lastEmptyOpen < 2000) return;
          let hasContent = false;
          this.app.workspace.iterateRootLeaves(leaf => {
            if (leaf.view.getViewType() !== 'empty') hasContent = true;
          });
          if (!hasContent) {
            lastEmptyOpen = Date.now();
            void this.openHomepage('retain');
          }
        }, 500);
      }),
    );
  }

  onunload(): void {
    imageCache.destroy();
    clearPomodoroState();
    closeSharedAudioCtx();
    abortActiveLightbox();
    // Drop the cached CryptoKey reference. The IndexedDB record itself stays so
    // a re-enable on the same device decrypts existing ciphertext, but we don't
    // hold a stale reference into a possibly-wiped database across reloads.
    _resetDeviceKeyCache();
  }

  /**
   * Tell the user once per key when a voice API key in the blocks this device
   * renders can't be read here (saved on another device). The block itself keeps
   * saying so; repeating a Notice on every launch would only nag.
   */
  private announceUnreadableKeys(unreadable: Parameters<typeof unreadableKeyNotice>[0], layout: LayoutConfig): void {
    const rendered = Platform.isMobile && layout.responsiveMode === 'separate' ? 'mobileBlocks' : 'blocks';
    let recorded: unknown = null;
    try {
      recorded = this.app.loadLocalStorage(UNREADABLE_KEYS_STORAGE_KEY);
    } catch {
      // Storage unavailable: treat as nothing told yet.
    }
    const { notify, record } = unreadableKeyNotice(unreadable, rendered, recorded);
    try {
      this.app.saveLocalStorage(UNREADABLE_KEYS_STORAGE_KEY, record.length > 0 ? record : null);
    } catch {
      // Storage unavailable: the Notice may repeat at the next launch.
    }
    if (notify) {
      new Notice('Homepage blocks: the voice notes API key can\'t be read on this device, most likely because it was saved on another one. It was kept as it is; entering a key here replaces it.', 12_000);
    }
  }

  /**
   * The homepage a command acts on: the active one, else the one being edited,
   * else the first open. Acting on every open homepage put each of them in edit
   * mode, and their saves overwrote each other (N22).
   */
  private targetHomepage(): HomepageView | null {
    const active = this.app.workspace.getActiveViewOfType(HomepageView);
    if (active) return active;
    const views = this.app.workspace.getLeavesOfType(VIEW_TYPE)
      .map(leaf => leaf.view)
      .filter((v): v is HomepageView => v instanceof HomepageView);
    return views.find(v => v.isEditing()) ?? views[0] ?? null;
  }

  // ── Platform-aware layout helpers ─────────────────────────────────

  isMobileActive(): boolean {
    return Platform.isMobile && this.layout.responsiveMode === 'separate';
  }

  activeBlocks(): BlockInstance[] {
    return this.isMobileActive() ? this.layout.mobileBlocks : this.layout.blocks;
  }

  activeColumns(): number {
    return this.isMobileActive() ? this.layout.mobileColumns : this.layout.columns;
  }

  activeLayoutPriority(): LayoutPriority {
    return this.isMobileActive() ? this.layout.mobileLayoutPriority : this.layout.layoutPriority;
  }

  // ── Platform-aware startup helpers ────────────────────────────────
  //
  // Gated on `separateStartup` (NOT `responsiveMode`): startup behaviour can
  // diverge per platform even with a single unified layout. When the gate is
  // off, every accessor returns the desktop value, so existing vaults behave
  // exactly as before.

  isMobileStartupActive(): boolean {
    return mobileStartupActive(this.layout, Platform.isMobile);
  }

  activeOpenOnStartup(): boolean {
    return resolveStartup(this.layout, Platform.isMobile).openOnStartup;
  }

  activeOpenMode(): OpenMode {
    return resolveStartup(this.layout, Platform.isMobile).openMode;
  }

  activeManualOpenMode(): OpenMode {
    return resolveStartup(this.layout, Platform.isMobile).manualOpenMode;
  }

  activeOpenWhenEmpty(): boolean {
    return resolveStartup(this.layout, Platform.isMobile).openWhenEmpty;
  }

  activePin(): boolean {
    return resolveStartup(this.layout, Platform.isMobile).pin;
  }

  // ── Persistence ───────────────────────────────────────────────────

  private savePromise = Promise.resolve();
  private saveErrorNotified = false;
  private dataGuard: DataFileGuard | null = null;

  async saveLayout(layout: LayoutConfig): Promise<void> {
    this.layout = layout;
    // Serialize save ordering AND await the pre-save encryption inside the
    // chain so a later-queued save sees the updated ciphertext format.
    this.savePromise = this.savePromise.then(async () => {
      // A broken data.json that could not be backed up at load must not be
      // written over: each save retries the copy and writes only once it exists.
      if (this.dataGuard) {
        const { allowed, backupPath } = await this.dataGuard.allowWrite();
        if (backupPath) new Notice(`Homepage blocks: the original data.json was saved as ${fileName(backupPath)}; saving resumes.`, 12_000);
        if (!allowed) return;
      }
      // Keys are encrypted into a copy, so the live layout the blocks read from
      // stays plaintext. With no plaintext key to encrypt, the layout is written
      // as it is and the prior-on-disk read is skipped (every drag / auto-height persist).
      const persistable = await persistableLayout(layout, () => this.readPriorLayout());
      await this.saveData(persistable);
      this.lastWrittenJson = JSON.stringify(persistable);
    }).then(
      () => { this.saveErrorNotified = false; },
      (err) => {
        // In-memory state stays authoritative so the session keeps working.
        // The user needs to know that the edit didn't persist though.
        // Log only err.message (mirrors VoiceDictation's pattern) so a future
        // Electron version that attaches the failed-write payload to the error
        // object can never echo plaintext apiKey content into DevTools.
        const safeMsg = err instanceof Error ? err.message : 'unknown error';
        console.error('[Homepage Blocks] Failed to save layout:', safeMsg);
        if (!this.saveErrorNotified) {
          this.saveErrorNotified = true;
          new Notice('Homepage blocks: failed to save layout. Check disk space / permissions.', 8000);
        }
      },
    );
    await this.savePromise;
  }

  /** data.json of this plugin, in the vault's plugin folder. */
  private dataFilePath(): string {
    const dir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return normalizePath(`${dir}/data.json`);
  }

  /** What the last write put in data.json: a change event for it is this device's own save. */
  private lastWrittenJson: string | null = null;

  /** The homepage views open in this workspace. */
  private homepageViews(): HomepageView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE)
      .map(leaf => leaf.view)
      .filter((v): v is HomepageView => v instanceof HomepageView);
  }

  /**
   * Obsidian calls this when data.json changes on disk from outside, typically
   * a sync client bringing another device's layout. Without it, the next save
   * here wrote the stale in-memory layout over the newer one (R3). Ignored when
   * the change is this device's own save, when the file is gone (the next save
   * writes it again) and while a homepage is being edited: that session's Done
   * or Discard writes this device's layout, and the user is told. A file that
   * holds no usable layout is backed up as at load, and the loaded layout stays.
   */
  async onExternalSettingsChange(): Promise<void> {
    await this.savePromise;
    const raw = await this.loadData() as unknown;
    if (raw === null) return;
    if (raw !== undefined && this.lastWrittenJson !== null && JSON.stringify(raw) === this.lastWrittenJson) return;
    const loaded = await loadLayoutWithRecovery(raw, this.dataFilePath(), this.app.vault.adapter);
    if (loaded.problem) {
      this.dataGuard = loaded.guard;
      console.warn('[Homepage Blocks] data.json changed on disk but holds no usable layout; the loaded layout was kept');
      const backup = loaded.backupPath ? ` The file was saved as ${fileName(loaded.backupPath)}.` : '';
      new Notice(`Homepage blocks: data.json changed on disk but could not be used, so the current layout was kept.${backup}`, 12_000);
      return;
    }
    const views = this.homepageViews();
    if (views.some(v => v.isEditing())) {
      new Notice('Homepage blocks: the layout changed on another device. Leaving edit mode keeps the layout shown here.', 10_000);
      return;
    }
    const { layout } = await decryptApiKeys(loaded.layout);
    this.layout = layout;
    for (const view of views) await view.reload();
  }

  /**
   * The layout currently on disk, for encryptApiKeys to refuse to overwrite a
   * stored ciphertext with plaintext when WebCrypto is gated (cross-platform
   * vault sync: ciphertext on desktop, plaintext on a restricted mobile). A read
   * failure is benign: without prior context the plaintext fallback proceeds
   * (encryptStringEx still warns), since refusing the save would be worse.
   */
  private async readPriorLayout(): Promise<LayoutConfig | null> {
    try {
      const prior = await this.loadData() as unknown;
      return prior && typeof prior === 'object' && !Array.isArray(prior) ? prior as LayoutConfig : null;
    } catch {
      return null;
    }
  }

  async saveActiveBlocks(blocks: BlockInstance[]): Promise<void> {
    const next = this.isMobileActive()
      ? { ...this.layout, mobileBlocks: blocks }
      : { ...this.layout, blocks };
    await this.saveLayout(next);
  }

  /**
   * Patch one block's config and save (contract: IHomepagePlugin.updateBlockConfig).
   * Positions stay current because the in-memory layout is the ordering
   * authority: every saveLayout call, a dragstop's included, assigns it
   * synchronously, and the patch is computed from it. A caller that builds the
   * blocks array itself, from a value read earlier, is what loses a drag.
   */
  async updateBlockConfig(id: string, patch: Record<string, unknown>): Promise<void> {
    // Queue behind the writes already pending so this one lands after them.
    try {
      await this.savePromise;
    } catch {
      // Prior save's failure has already been notified in saveLayout's chain;
      // reading the current in-memory layout is still the right move.
    }
    const live = this.activeBlocks();
    if (!live.some(b => b.id === id)) {
      // The block was removed (or its id re-minted by an import / copy-to-mobile)
      // while we awaited the save chain. Drop the patch, but make it observable
      // rather than a silent no-op so a lost rename surfaces in the console.
      console.warn(`[Homepage Blocks] updateBlockConfig: block ${id} no longer exists; config patch dropped`);
      return;
    }
    const next = live.map(b =>
      b.id === id ? { ...b, config: { ...b.config, ...patch } } : b,
    );
    await this.saveActiveBlocks(next);
  }

  async openHomepage(mode: OpenMode = 'retain'): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];

    let leaf: WorkspaceLeaf;
    if (existing) {
      leaf = existing;
    } else if (mode === 'replace-all') {
      // Reuse the most recent tab of the main area, then close the rest below.
      // Closing every tab first leaves the main area without a tab group:
      // getLeaf(true) then throws "No tab group found." (the host refills an
      // empty main area only later), and it would also pick a popout window
      // if one was used last.
      leaf = workspace.getMostRecentLeaf(workspace.rootSplit) ?? workspace.getLeaf('tab');
    } else if (mode === 'replace-last') {
      leaf = workspace.getLeaf(false);
    } else {
      leaf = workspace.getLeaf('tab');
    }

    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });

    // "Close all tabs" leaves only the homepage in the main area, also when it
    // was already open (e.g. restored at startup next to other tabs).
    if (mode === 'replace-all') {
      const toClose: WorkspaceLeaf[] = [];
      workspace.iterateAllLeaves(l => {
        if (l !== leaf && l.getRoot() === workspace.rootSplit) toClose.push(l);
      });
      toClose.forEach(l => l.detach());
    }

    await workspace.revealLeaf(leaf);

    if (this.activePin()) leaf.setPinned(true);
  }
}
